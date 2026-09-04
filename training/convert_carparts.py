"""
Real Carparts Dataset Converter & Remapper
Converts the 3,833 real annotated images from Ultralytics carparts-seg
into the 9-class vehicle parts taxonomy defined in this project.
"""

import os
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT_DIR / "datasets" / "carparts-seg"
TARGET_DIR = ROOT_DIR / "training" / "data" / "parts"

# Source class IDs in carparts-seg (23 classes):
# 0: back_bumper, 1: back_door, 2: back_glass, 3: back_left_door, 4: back_left_light,
# 5: back_light, 6: back_right_door, 7: back_right_light, 8: front_bumper, 9: front_door,
# 10: front_glass, 11: front_left_door, 12: front_left_light, 13: front_light,
# 14: front_right_door, 15: front_right_light, 16: hood, 17: left_mirror, 18: object,
# 19: right_mirror, 20: tailgate, 21: trunk, 22: wheel

# Target 9-class taxonomy:
# 0: bumper_front
# 1: bumper_rear
# 2: door
# 3: fender
# 4: headlamp
# 5: taillamp
# 6: mirror
# 7: hood
# 8: windshield

CARPARTS_TO_TARGET_MAP = {
    8: 0,   # front_bumper -> bumper_front
    0: 1,   # back_bumper -> bumper_rear
    1: 2,   # back_door -> door
    3: 2,   # back_left_door -> door
    6: 2,   # back_right_door -> door
    9: 2,   # front_door -> door
    11: 2,  # front_left_door -> door
    14: 2,  # front_right_door -> door
    20: 2,  # tailgate -> door
    21: 2,  # trunk -> door
    12: 4,  # front_left_light -> headlamp
    13: 4,  # front_light -> headlamp
    15: 4,  # front_right_light -> headlamp
    4: 5,   # back_left_light -> taillamp
    5: 5,   # back_light -> taillamp
    7: 5,   # back_right_light -> taillamp
    17: 6,  # left_mirror -> mirror
    19: 6,  # right_mirror -> mirror
    16: 7,  # hood -> hood
    2: 8,   # back_glass -> windshield
    10: 8,  # front_glass -> windshield
}

def remap_and_deploy_carparts(max_samples_per_split=None):
    if not SOURCE_DIR.exists():
        print(f"[Error] Source dataset not found at {SOURCE_DIR}")
        return False

    print(f"[Converter] Reading real vehicle parts data from {SOURCE_DIR}...")
    
    # Clean previous target folder
    if TARGET_DIR.exists():
        shutil.rmtree(TARGET_DIR)

    for split in ["train", "val"]:
        src_split = split
        src_img_dir = SOURCE_DIR / "images" / src_split
        src_lbl_dir = SOURCE_DIR / "labels" / src_split

        tgt_img_dir = TARGET_DIR / "images" / split
        tgt_lbl_dir = TARGET_DIR / "labels" / split
        tgt_img_dir.mkdir(parents=True, exist_ok=True)
        tgt_lbl_dir.mkdir(parents=True, exist_ok=True)

        if not src_lbl_dir.exists():
            continue

        label_files = list(src_lbl_dir.glob("*.txt"))
        if max_samples_per_split:
            label_files = label_files[:max_samples_per_split]

        converted_count = 0
        total_annotations = 0

        for lbl_file in label_files:
            img_name = lbl_file.stem + ".jpg"
            src_img_file = src_img_dir / img_name
            if not src_img_file.exists():
                # Try png or jpeg
                alternatives = list(src_img_dir.glob(f"{lbl_file.stem}.*"))
                if alternatives:
                    src_img_file = alternatives[0]
                else:
                    continue

            new_lines = []
            with open(lbl_file, "r") as lf:
                for line in lf:
                    parts = line.strip().split()
                    if len(parts) < 5:
                        continue
                    src_cls = int(parts[0])
                    if src_cls in CARPARTS_TO_TARGET_MAP:
                        target_cls = CARPARTS_TO_TARGET_MAP[src_cls]
                        coords = parts[1:]
                        new_lines.append(f"{target_cls} {' '.join(coords)}")

            if new_lines:
                # Copy image and save remapped label
                shutil.copyfile(src_img_file, tgt_img_dir / src_img_file.name)
                with open(tgt_lbl_dir / lbl_file.name, "w") as out_f:
                    out_f.write("\n".join(new_lines) + "\n")
                converted_count += 1
                total_annotations += len(new_lines)

        print(f"[Converter] {split.upper()}: {converted_count} real images with {total_annotations} remapped polygon instances deployed to {tgt_img_dir}")

    print("[Converter] Real vehicle parts dataset successfully prepared!")
    return True

if __name__ == "__main__":
    remap_and_deploy_carparts()
