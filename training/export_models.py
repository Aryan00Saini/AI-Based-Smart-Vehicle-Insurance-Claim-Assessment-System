"""
Production ONNX Model Exporter for YOLOv8s-seg Checkpoints.
Strictly validates trained checkpoints (best.pt) and exports to ONNX (Opset 17)
for deployment to data/models/.
"""

import sys
import shutil
from pathlib import Path
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = ROOT_DIR / "training"
MODELS_DIR = ROOT_DIR / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def export_checkpoint(pt_path: Path, dest_onnx: Path, imgsz: int = 640):
    if not pt_path.exists():
        raise FileNotFoundError(f"Source checkpoint does not exist: {pt_path}")

    print(f"[Export] Loading trained weights from {pt_path}...")
    model = YOLO(str(pt_path))

    print(f"[Export] Exporting to Opset 17 ONNX (imgsz={imgsz})...")
    exported_file = model.export(format="onnx", opset=17, imgsz=imgsz, dynamic=False)
    
    if not Path(exported_file).exists():
        raise RuntimeError(f"Export failed; output file not found: {exported_file}")

    shutil.copyfile(exported_file, dest_onnx)
    size_mb = dest_onnx.stat().st_size / (1024 * 1024)
    print(f"[Export] Successfully deployed {dest_onnx.name} ({size_mb:.2f} MB) to {dest_onnx}")
    return dest_onnx

def export_finetuned_models():
    """
    Exports best.pt from parts and damage training runs.
    Enforces strict quality: will NEVER fall back to last.pt or unvalidated checkpoints.
    """
    parts_best = TRAINING_DIR / "runs" / "parts_segmentation" / "weights" / "best.pt"
    damage_best = TRAINING_DIR / "runs" / "damage_segmentation" / "weights" / "best.pt"

    print("=" * 60)
    print("VERIFYING AND EXPORTING TRAINED NEURAL CHECKPOINTS")
    print("=" * 60)

    # 1. Parts Model
    if parts_best.exists():
        print(f"-> Found parts checkpoint: {parts_best}")
        export_checkpoint(parts_best, MODELS_DIR / "yolov8s_parts.onnx")
    else:
        print(f"[Notice] Fine-tuned parts checkpoint not found at {parts_best}.")
        print("  Train on Google Colab or locally via: python training/train_parts.py")

    # 2. Damage Model
    if damage_best.exists():
        print(f"-> Found damage checkpoint: {damage_best}")
        export_checkpoint(damage_best, MODELS_DIR / "yolov8s_damage.onnx")
    else:
        print(f"[Notice] Fine-tuned damage checkpoint not found at {damage_best}.")
        print("  Train on Google Colab or locally via: python training/train_damage.py")

    print("=" * 60)

if __name__ == "__main__":
    export_finetuned_models()
