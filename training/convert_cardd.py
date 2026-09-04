"""
Real CarDD Damage Dataset Converter & Remapper
Converts authentic CarDD instance segmentations into YOLOv8-seg polygonal format
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

def ensure_cardd_samples():
    if not SOURCE_JSON.exists():
        SOURCE_JSON.parent.mkdir(parents=True, exist_ok=True)
        url = f"{HF_BASE_URL}/samples.json"
        print(f"[Converter] Downloading CarDD annotations from {url}...")
        urllib.request.urlretrieve(url, str(SOURCE_JSON))
        print(f"[Converter] Downloaded CarDD annotations ({SOURCE_JSON.stat().st_size / 1024 / 1024:.2f} MB)")
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

def extract_yolo_polygons(sample: dict) -> list[str]:
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
        bx, by, bw, bh = bbox
        
        mask_dict = det.get("mask")
        if not mask_dict or "$binary" not in mask_dict:
            continue
        
        try:
            b64 = mask_dict["$binary"]["base64"]
            raw = zlib.decompress(base64.b64decode(b64))
            mask_arr = np.load(io.BytesIO(raw)).astype(np.uint8) * 255
        except Exception:
            continue

        contours, _ = cv2.findContours(mask_arr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            epsilon = 0.005 * cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, epsilon, True)
            if len(approx) < 3:
                continue

            pts_norm = []
            for pt in approx:
                px, py = pt[0]
                gx = bx * w + px
                gy = by * h + py
                nx = round(float(np.clip(gx / w, 0.0, 1.0)), 5)
                ny = round(float(np.clip(gy / h, 0.0, 1.0)), 5)
                pts_norm.extend([nx, ny])

            if len(pts_norm) >= 6:
                line_str = f"{cls_id} " + " ".join(map(str, pts_norm))
                lines.append(line_str)

    return lines

def convert_cardd_dataset(max_train_samples: int = 150, max_val_samples: int = 40):
    samples_path = ensure_cardd_samples()
    print(f"[Converter] Loading CarDD annotations from {samples_path}...")
    with open(samples_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_samples = data.get("samples", [])
    valid_samples = [s for s in all_samples if s.get("segmentations", {}).get("detections")]
    print(f"[Converter] Found {len(valid_samples)} CarDD samples with damage segmentations.")

    # Clean previous target folder
    if TARGET_DIR.exists():
        shutil.rmtree(TARGET_DIR)

    # 80/20 train/val split
    np.random.seed(42)
    shuffled = list(valid_samples)
    np.random.shuffle(shuffled)

    train_limit = max_train_samples if max_train_samples else int(len(shuffled) * 0.8)
    val_limit = max_val_samples if max_val_samples else len(shuffled) - train_limit

    train_samples = shuffled[:train_limit]
    val_samples = shuffled[train_limit:train_limit + val_limit]

    splits = [("train", train_samples), ("val", val_samples)]

    for split_name, samples in splits:
        img_dir = TARGET_DIR / "images" / split_name
        lbl_dir = TARGET_DIR / "labels" / split_name
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        print(f"[Converter] Processing {len(samples)} real damage images for {split_name.upper()}...")
        
        # 1. Generate labels first
        sample_tasks = []
        for s in samples:
            lines = extract_yolo_polygons(s)
            if not lines:
                continue
            rel_path = s.get("filepath", "")
            img_name = Path(rel_path).name
            lbl_name = Path(rel_path).stem + ".txt"
            sample_tasks.append((s, rel_path, img_name, lbl_name, lines))

        # 2. Parallel download images
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

        print(f"[Converter] {split_name.upper()}: Deployed {saved_count} real CarDD images with {total_instances} damage polygons.")

    print(f"[Converter] CarDD damage dataset successfully prepared in {TARGET_DIR}!")
    return True

if __name__ == "__main__":
    convert_cardd_dataset()
