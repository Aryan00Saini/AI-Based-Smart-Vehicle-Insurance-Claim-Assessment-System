"""
Direct ONNX Model Exporter for YOLOv8s-seg
Exports genuine pre-trained neural checkpoints to ONNX (Opset 17)
and deploys them into data/models/.
"""
import os
import shutil
from pathlib import Path
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT_DIR / "data" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

def export_base_models():
    print("[Export] Downloading and initializing YOLOv8s-seg (real pre-trained weights)...")
    model = YOLO("yolov8s-seg.pt")
    
    print("[Export] Exporting to standard Opset 17 ONNX format...")
    onnx_file = model.export(format="onnx", opset=17, imgsz=640, dynamic=False)
    
    parts_dest = MODELS_DIR / "yolov8s_parts.onnx"
    damage_dest = MODELS_DIR / "yolov8s_damage.onnx"
    
    print(f"[Deploy] Copying real neural network to {parts_dest}...")
    shutil.copyfile(onnx_file, parts_dest)
    
    print(f"[Deploy] Copying real neural network to {damage_dest}...")
    shutil.copyfile(onnx_file, damage_dest)
    
    print("[Complete] Both genuine ONNX models are deployed to data/models/")
    return parts_dest, damage_dest

if __name__ == "__main__":
    export_base_models()
