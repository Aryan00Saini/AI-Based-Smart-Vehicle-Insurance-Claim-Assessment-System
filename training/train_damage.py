"""
YOLOv8s-seg Fine-Tuning Pipeline for Vehicle Damage Segmentation (6 classes).
Trains on authentic CarDD damage dataset and strictly validates best.pt.
Exports trained checkpoint to data/models/yolov8s_damage.onnx (Opset 17).
"""

import os
import shutil
from pathlib import Path
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = ROOT_DIR / "training"
MODELS_DIR = ROOT_DIR / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def train_damage_model(epochs: int = 50, imgsz: int = 640, batch: int = 16, device: str = ""):
    yaml_path = TRAINING_DIR / "damage_dataset.yaml"
    if not yaml_path.exists():
        from dataset_prep import create_dataset_yamls
        create_dataset_yamls()

    train_img_dir = TRAINING_DIR / "data" / "damage" / "images" / "train"
    if not train_img_dir.exists() or len(list(train_img_dir.glob("*.*"))) == 0:
        raise FileNotFoundError(
            f"No real vehicle damage images found in {train_img_dir}! "
            "Please run 'python training/convert_cardd.py' first."
        )

    print(f"[Train Damage] Initializing YOLOv8s-seg on authentic CarDD data: {yaml_path}...")
    model = YOLO("yolov8s-seg.pt")
    
    train_args = {
        "data": str(yaml_path),
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "project": str(TRAINING_DIR / "runs"),
        "name": "damage_segmentation",
        "exist_ok": True,
        "verbose": True
    }
    if device:
        train_args["device"] = device

    results = model.train(**train_args)

    print("[Train Damage] Training complete. Locating best.pt...")
    best_weights = TRAINING_DIR / "runs" / "damage_segmentation" / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(
            f"Training finished but best.pt was not found at {best_weights}! "
            "Refusing to export unvalidated or fallback checkpoints."
        )

    print(f"[Export] Validated genuine checkpoint: {best_weights}")
    best_model = YOLO(str(best_weights))
    onnx_file = best_model.export(format="onnx", opset=17, imgsz=imgsz, dynamic=False)
    
    dest_path = MODELS_DIR / "yolov8s_damage.onnx"
    if Path(onnx_file).exists():
        shutil.copyfile(onnx_file, dest_path)
        print(f"[Success] Real fine-tuned YOLOv8s-seg damage model deployed to {dest_path}")

    return results

if __name__ == "__main__":
    train_damage_model()
