"""
Real CarDD Damage Dataset Converter & Remapper
Supports dual ingestion modes:
1. Official FiftyOne SDK loader (`load_from_hub('harpreetsahota/CarDD')`) when fiftyone is installed (e.g. Google Colab/Linux).
2. Direct HuggingFace Hub JSON/LFS parser (zero external MongoDB/FiftyOne dependencies) for lightweight/Windows environments.

Remaps authentic CarDD instance segmentations into YOLOv8-seg polygonal format
for the 6-class damage taxonomy:
0: scratch
1: dent
2: crack
3: shatter
4: paint_chip
5: misalignment
"""

import os
import shutil
import json
import base64
import zlib
import io
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import cv2

ROOT_DIR = Path(__file__).resolve().parent.parent
SOURCE_JSON = ROOT_DIR / "datasets" / "cardd" / "samples.json"
TARGET_DIR = ROOT_DIR / "training" / "data" / "damage"

HF_BASE_URL = "https://huggingface.co/datasets/harpreetsahota/CarDD/resolve/main"

DAMAGE_CLASS_MAP = {
    "scratch": 0,
    "dent": 1,
    "crack": 2,
    "glass shatter": 3,
    "shatter": 3,
    "paint chip": 4,
    "paint_chip": 4,
    "lamp broken": 5,
    "broken lamp": 5,
    "tire flat": 5,
    "misalignment": 5
}

def _mask_to_yolo_polygons(mask_uint8: np.ndarray, bbox: list[float], img_w: int, img_h: int, cls_id: int) -> list[str]:
    bx, by, bw, bh = bbox
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    lines = []
    for c in contours:
        epsilon = 0.005 * cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, epsilon, True)
        if len(approx) < 3:
            continue

        pts_norm = []
        for pt in approx:
            px, py = pt[0]
            gx = bx * img_w + px
            gy = by * img_h + py
            nx = round(float(np.clip(gx / img_w, 0.0, 1.0)), 5)
            ny = round(float(np.clip(gy / img_h, 0.0, 1.0)), 5)
            pts_norm.extend([nx, ny])

        if len(pts_norm) >= 6:
            lines.append(f"{cls_id} " + " ".join(map(str, pts_norm)))
    return lines

# ==============================================================================
# MODE 1: Official FiftyOne SDK Ingestion
# ==============================================================================
def try_ingest_via_fiftyone(max_train_samples: int = 150, max_val_samples: int = 40) -> bool:
    try:
        import fiftyone as fo
        from fiftyone.utils.huggingface import load_from_hub
        print("[Converter:FiftyOne] FiftyOne SDK detected. Loading 'harpreetsahota/CarDD' from Hugging Face Hub...")
        dataset = load_from_hub("harpreetsahota/CarDD")
    except Exception as e:
        print(f"[Converter:FiftyOne] FiftyOne SDK load unavailable ({e}). Switching to Direct Hub parser...")
        return False

    valid_samples = []
    for sample in dataset:
        segs = getattr(sample, "segmentations", None)
        if segs and getattr(segs, "detections", None):
            valid_samples.append(sample)

    print(f"[Converter:FiftyOne] Loaded {len(valid_samples)} CarDD samples with damage segmentations.")
    if not valid_samples:
        return False

    if TARGET_DIR.exists():
        shutil.rmtree(TARGET_DIR)

    np.random.seed(42)
    shuffled = list(valid_samples)
    np.random.shuffle(shuffled)

    train_limit = max_train_samples if max_train_samples else int(len(shuffled) * 0.8)
    val_limit = max_val_samples if max_val_samples else len(shuffled) - train_limit

    splits = [
        ("train", shuffled[:train_limit]),
        ("val", shuffled[train_limit:train_limit + val_limit])
    ]

    for split_name, samples in splits:
        img_dir = TARGET_DIR / "images" / split_name
        lbl_dir = TARGET_DIR / "labels" / split_name
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        converted_count = 0
        total_instances = 0

        for sample in samples:
            src_img_path = Path(sample.filepath)
            if not src_img_path.exists():
                continue

            # Read dimensions
            w = sample.metadata.width if sample.metadata else None
            h = sample.metadata.height if sample.metadata else None
            if not w or not h:
                im = cv2.imread(str(src_img_path))
                if im is None:
                    continue
                h, w = im.shape[:2]

            lines = []
            for det in sample.segmentations.detections:
                label = det.label.lower() if det.label else ""
                if label not in DAMAGE_CLASS_MAP:
                    continue
                cls_id = DAMAGE_CLASS_MAP[label]
                bbox = det.bounding_box
                if not bbox or len(bbox) != 4 or det.mask is None:
                    continue

                mask_uint8 = det.mask.astype(np.uint8) * 255
                poly_lines = _mask_to_yolo_polygons(mask_uint8, bbox, w, h, cls_id)
                lines.extend(poly_lines)

            if lines:
                dest_img = img_dir / src_img_path.name
                shutil.copyfile(src_img_path, dest_img)
                lbl_file = lbl_dir / f"{src_img_path.stem}.txt"
                with open(lbl_file, "w") as lf:
                    lf.write("\n".join(lines) + "\n")
                converted_count += 1
                total_instances += len(lines)

        print(f"[Converter:FiftyOne] {split_name.upper()}: Deployed {converted_count} images with {total_instances} polygons.")

    print(f"[Converter:FiftyOne] CarDD damage dataset successfully prepared in {TARGET_DIR}!")
    return True

# ==============================================================================
# MODE 2: Direct Hugging Face Hub REST API & LFS Parser (Zero Dependencies)
# ==============================================================================
def ensure_cardd_samples():
    if not SOURCE_JSON.exists():
        SOURCE_JSON.parent.mkdir(parents=True, exist_ok=True)
        url = f"{HF_BASE_URL}/samples.json"
        print(f"[Converter:Direct] Downloading CarDD annotations from {url}...")
        urllib.request.urlretrieve(url, str(SOURCE_JSON))
        print(f"[Converter:Direct] Downloaded CarDD annotations ({SOURCE_JSON.stat().st_size / 1024 / 1024:.2f} MB)")
    return SOURCE_JSON

def download_image(rel_path: str, dest_path: Path):
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        return True
    try:
        url = f"{HF_BASE_URL}/{rel_path}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(dest_path, "wb") as out_f:
            out_f.write(resp.read())
        return True
    except Exception as e:
        print(f"[Warn] Failed downloading {rel_path}: {e}")
        if dest_path.exists():
            dest_path.unlink()
        return False

def extract_yolo_polygons_from_json(sample: dict) -> list[str]:
    w = sample.get("metadata", {}).get("width")
    h = sample.get("metadata", {}).get("height")
    if not w or not h:
        return []

    lines = []
    segs = sample.get("segmentations", {}).get("detections", [])
    for det in segs:
        label = det.get("label", "").lower()
        if label not in DAMAGE_CLASS_MAP:
            continue
        cls_id = DAMAGE_CLASS_MAP[label]
        bbox = det.get("bounding_box")
        if not bbox or len(bbox) != 4:
            continue

        mask_dict = det.get("mask")
        if not mask_dict or "$binary" not in mask_dict:
            continue

        try:
            b64 = mask_dict["$binary"]["base64"]
            raw = zlib.decompress(base64.b64decode(b64))
            mask_arr = np.load(io.BytesIO(raw)).astype(np.uint8) * 255
        except Exception:
            continue

        poly_lines = _mask_to_yolo_polygons(mask_arr, bbox, w, h, cls_id)
        lines.extend(poly_lines)

    return lines

def convert_cardd_via_direct_hub(max_train_samples: int = 150, max_val_samples: int = 40):
    samples_path = ensure_cardd_samples()
    print(f"[Converter:Direct] Parsing CarDD annotations from {samples_path}...")
    with open(samples_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_samples = data.get("samples", [])
    valid_samples = [s for s in all_samples if s.get("segmentations", {}).get("detections")]
    print(f"[Converter:Direct] Found {len(valid_samples)} CarDD samples with damage segmentations.")

    if TARGET_DIR.exists():
        shutil.rmtree(TARGET_DIR)

    np.random.seed(42)
    shuffled = list(valid_samples)
    np.random.shuffle(shuffled)

    train_limit = max_train_samples if max_train_samples else int(len(shuffled) * 0.8)
    val_limit = max_val_samples if max_val_samples else len(shuffled) - train_limit

    splits = [
        ("train", shuffled[:train_limit]),
        ("val", shuffled[train_limit:train_limit + val_limit])
    ]

    for split_name, samples in splits:
        img_dir = TARGET_DIR / "images" / split_name
        lbl_dir = TARGET_DIR / "labels" / split_name
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        print(f"[Converter:Direct] Processing {len(samples)} real damage images for {split_name.upper()}...")

        sample_tasks = []
        for s in samples:
            lines = extract_yolo_polygons_from_json(s)
            if not lines:
                continue
            rel_path = s.get("filepath", "")
            img_name = Path(rel_path).name
            lbl_name = Path(rel_path).stem + ".txt"
            sample_tasks.append((s, rel_path, img_name, lbl_name, lines))

        saved_count = 0
        total_instances = 0
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_info = {
                executor.submit(download_image, rel_p, img_dir / img_n): (lbl_n, lines)
                for (_, rel_p, img_n, lbl_n, lines) in sample_tasks
            }
            for future in as_completed(future_to_info):
                lbl_n, lines = future_to_info[future]
                success = future.result()
                if success:
                    with open(lbl_dir / lbl_n, "w") as out_f:
                        out_f.write("\n".join(lines) + "\n")
                    saved_count += 1
                    total_instances += len(lines)

        print(f"[Converter:Direct] {split_name.upper()}: Deployed {saved_count} real CarDD images with {total_instances} damage polygons.")

    print(f"[Converter:Direct] CarDD damage dataset successfully prepared in {TARGET_DIR}!")
    return True

# ==============================================================================
# Main Dispatcher
# ==============================================================================
def convert_cardd_dataset(max_train_samples: int = 150, max_val_samples: int = 40):
    # Try FiftyOne first if present; fallback to direct hub reader if absent
    success = try_ingest_via_fiftyone(max_train_samples, max_val_samples)
    if not success:
        success = convert_cardd_via_direct_hub(max_train_samples, max_val_samples)
    return success

if __name__ == "__main__":
    convert_cardd_dataset()
