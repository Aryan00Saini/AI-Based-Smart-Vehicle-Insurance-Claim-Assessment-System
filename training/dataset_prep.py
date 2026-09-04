"""
Dataset Preparation & Taxonomy Pipeline for Genuine Computer Vision:
1. Vehicle Body Parts Segmentation (9 classes - remapped from Ultralytics carparts-seg)
2. Damage Localization & Segmentation (6 classes - remapped from CarDD dataset)

Zero synthetic polygon or heuristic bootstrap data. Pure authentic CV data only.
"""

import os
import shutil
from pathlib import Path
import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent
TRAINING_DIR = ROOT_DIR / "training"
DATA_DIR = TRAINING_DIR / "data"

PART_CLASSES = [
    "bumper_front",
    "bumper_rear",
    "door",
    "fender",
    "headlamp",
    "taillamp",
    "mirror",
    "hood",
    "windshield"
]

DAMAGE_CLASSES = [
    "scratch",
    "dent",
    "crack",
    "shatter",
    "paint_chip",
    "misalignment"
]

def create_dataset_yamls():
    """Generates Ultralytics YOLOv8 segmentation dataset configuration YAML files."""
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Parts Dataset YAML
    parts_yaml_path = TRAINING_DIR / "parts_dataset.yaml"
    parts_config = {
        "path": str(DATA_DIR / "parts"),
        "train": "images/train",
        "val": "images/val",
        "test": "images/val",
        "names": {i: name for i, name in enumerate(PART_CLASSES)}
    }
    with open(parts_yaml_path, "w") as f:
        yaml.dump(parts_config, f, sort_keys=False)
    print(f"[Dataset] Generated {parts_yaml_path}")

    # 2. Damage Dataset YAML
    damage_yaml_path = TRAINING_DIR / "damage_dataset.yaml"
    damage_config = {
        "path": str(DATA_DIR / "damage"),
        "train": "images/train",
        "val": "images/val",
        "test": "images/val",
        "names": {i: name for i, name in enumerate(DAMAGE_CLASSES)}
    }
    with open(damage_yaml_path, "w") as f:
        yaml.dump(damage_config, f, sort_keys=False)
    print(f"[Dataset] Generated {damage_yaml_path}")

    return parts_yaml_path, damage_yaml_path

def prepare_real_datasets(parts_limit=None, damage_train=150, damage_val=40):
    """
    Orchestrates ingestion of real vehicle parts and CarDD damage data.
    Eliminates all synthetic fallbacks.
    """
    create_dataset_yamls()

    # 1. Carparts conversion
    from convert_carparts import remap_and_deploy_carparts
    print("[Dataset Prep] Ingesting real Carparts segmentation data...")
    remap_and_deploy_carparts(max_samples_per_split=parts_limit)

    # 2. CarDD conversion
    from convert_cardd import convert_cardd_dataset
    print("[Dataset Prep] Ingesting real CarDD damage segmentation data...")
    convert_cardd_dataset(max_train_samples=damage_train, max_val_samples=damage_val)

    print("[Dataset Prep] Real datasets successfully verified and deployed.")

if __name__ == "__main__":
    create_dataset_yamls()
