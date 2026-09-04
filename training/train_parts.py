"""
YOLOv8s-seg Fine-Tuning Pipeline for Vehicle Body Part Segmentation (9 classes).
Exports trained checkpoint to data/models/yolov8s_parts.onnx.
"""
import os
import shutil
from pathlib import Path
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = ROOT_DIR / "training"
MODELS_DIR = ROOT_DIR / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def train_parts_model(epochs: int = 3, imgsz: int = 640, batch: int = 4):
    yaml_path = TRAINING_DIR / "parts_dataset.yaml"
    if not yaml_path.exists():
        from dataset_prep import create_dataset_yamls, bootstrap_synthetic_training_data
        create_dataset_yamls()
        bootstrap_synthetic_training_data()

    print(f"[Train] Initializing YOLOv8s-seg on {yaml_path}...")
    model = YOLO("yolov8s-seg.pt")
    
    results = model.train(
        data=str(yaml_path),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=str(TRAINING_DIR / "runs"),
        name="parts_segmentation",
        exist_ok=True,
        verbose=True
    )

    print("[Train] Parts segmentation training complete.")
    best_weights = TRAINING_DIR / "runs" / "parts_segmentation" / "weights" / "best.pt"
    if not best_weights.exists():
        best_weights = TRAINING_DIR / "runs" / "parts_segmentation" / "weights" / "last.pt"

    print(f"[Export] Exporting {best_weights} to ONNX (opset=17)...")
    onnx_file = model.export(format="onnx", opset=17, imgsz=imgsz, dynamic=False)
    
    dest_path = MODELS_DIR / "yolov8s_parts.onnx"
    if Path(onnx_file).exists():
        shutil.copyfile(onnx_file, dest_path)
        print(f"[Success] Real YOLOv8s-seg parts model deployed to {dest_path}")

    return results

if __name__ == "__main__":
    train_parts_model()
