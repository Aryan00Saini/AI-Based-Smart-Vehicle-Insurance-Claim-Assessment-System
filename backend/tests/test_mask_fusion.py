import pytest
import numpy as np
from backend.app.services.mask_fusion import (
    grade_severity, fuse_masks, generate_visual_overlay, deduplicate_cross_photo_line_items
)

def test_grade_severity_formula():
    # Scratch (weight 1)
    assert grade_severity(0.10, "scratch") == "MINOR"     # score = 0.10
    assert grade_severity(0.25, "scratch") == "MODERATE"  # score = 0.25
    assert grade_severity(0.50, "scratch") == "SEVERE"    # score = 0.50

    # Dent (weight 2)
    assert grade_severity(0.05, "dent") == "MINOR"        # score = 0.10
    assert grade_severity(0.15, "dent") == "MODERATE"     # score = 0.30
    assert grade_severity(0.25, "dent") == "SEVERE"       # score = 0.50

    # Crack (weight 3)
    assert grade_severity(0.04, "crack") == "MINOR"       # score = 0.12
    assert grade_severity(0.10, "crack") == "MODERATE"    # score = 0.30
    assert grade_severity(0.20, "crack") == "SEVERE"      # score = 0.60

    # Shatter (weight 4)
    assert grade_severity(0.03, "shatter") == "MINOR"     # score = 0.12
    assert grade_severity(0.08, "shatter") == "MODERATE"  # score = 0.32
    assert grade_severity(0.15, "shatter") == "SEVERE"    # score = 0.60

def test_fuse_masks_clean_attribution():
    # Synthetic 640x640 masks
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[100:300, 100:300] = True # area = 40,000 pixels

    # Minor scratch inside bumper
    dmg_mask = np.zeros((640, 640), dtype=bool)
    dmg_mask[120:160, 120:160] = True # area = 1,600 pixels, ratio = 1600 / 40000 = 0.04

    parts = [{
        "part_name": "bumper_front",
        "confidence": 0.94,
        "bbox": [100, 100, 300, 300],
        "mask": part_mask,
        "is_structural": False
    }]
    damages = [{
        "damage_type": "scratch",
        "confidence": 0.89,
        "bbox": [120, 120, 160, 160],
        "mask": dmg_mask
    }]

    result = fuse_masks(parts, damages)
    assert result["unattributed_damage_present"] is False
    assert len(result["line_items"]) == 1

    item = result["line_items"][0]
    assert item["part_name"] == "bumper_front"
    assert item["damage_type"] == "scratch"
    assert item["severity_band"] == "MINOR"
    assert item["area_ratio"] == 0.04
    assert item["unattributed"] is False

def test_fuse_masks_unattributed_damage():
    # Part on top-left
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[50:150, 50:150] = True

    # Damage far on bottom-right (outside any part)
    dmg_mask = np.zeros((640, 640), dtype=bool)
    dmg_mask[500:580, 500:580] = True # area = 6,400 pixels

    parts = [{
        "part_name": "hood",
        "confidence": 0.92,
        "bbox": [50, 50, 150, 150],
        "mask": part_mask,
        "is_structural": True
    }]
    damages = [{
        "damage_type": "dent",
        "confidence": 0.87,
        "bbox": [500, 500, 580, 580],
        "mask": dmg_mask
    }]

    result = fuse_masks(parts, damages)
    assert result["unattributed_damage_present"] is True
    assert len(result["line_items"]) == 1
    assert result["line_items"][0]["part_name"] == "UNATTRIBUTED"
    assert result["line_items"][0]["unattributed"] is True

def test_fuse_masks_noise_blob_discard():
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[100:200, 100:200] = True

    # Tiny noise blob (< 50 pixels)
    noise_mask = np.zeros((640, 640), dtype=bool)
    noise_mask[110:114, 110:114] = True # 16 pixels

    parts = [{"part_name": "door", "mask": part_mask}]
    damages = [{"damage_type": "scratch", "mask": noise_mask}]

    result = fuse_masks(parts, damages, min_damage_pixels=50)
    assert len(result["line_items"]) == 0
    assert result["unattributed_damage_present"] is False

def test_generate_visual_overlay():
    img = np.ones((640, 640, 3), dtype=np.uint8) * 128
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[100:300, 100:300] = True

    dmg_mask = np.zeros((640, 640), dtype=bool)
    dmg_mask[150:250, 150:250] = True

    parts = [{"part_name": "door", "mask": part_mask}]
    damages = [{"damage_type": "dent", "mask": dmg_mask, "bbox": [150, 150, 250, 250]}]

    fused = fuse_masks(parts, damages)
    overlay = generate_visual_overlay(img, parts, fused["line_items"])
    assert overlay.shape == (640, 640, 3)
    assert not np.array_equal(overlay, img) # overlay has been modified with contours & colors

def test_deduplicate_cross_photo_same_part_damage_keeps_higher_conf():
    item_photo1 = {
        "part_name": "bumper_front",
        "damage_type": "scratch",
        "severity_band": "MINOR",
        "part_confidence": 0.88,
        "damage_confidence": 0.82, # sum = 1.70
        "unattributed": False,
        "rate_row_found": True
    }
    item_photo2 = {
        "part_name": "bumper_front",
        "damage_type": "scratch",
        "severity_band": "MINOR",
        "part_confidence": 0.95,
        "damage_confidence": 0.93, # sum = 1.88
        "unattributed": False,
        "rate_row_found": True
    }

    result = deduplicate_cross_photo_line_items([item_photo1, item_photo2])
    assert len(result) == 1
    # Preserves the higher-confidence line item
    assert result[0]["part_confidence"] == 0.95
    assert result[0]["damage_confidence"] == 0.93

def test_deduplicate_cross_photo_tiebreaker_prefers_higher_severity():
    item_photo1 = {
        "part_name": "door",
        "damage_type": "dent",
        "severity_band": "MODERATE",
        "part_confidence": 0.90,
        "damage_confidence": 0.90, # sum = 1.80
        "unattributed": False,
        "rate_row_found": True
    }
    item_photo2 = {
        "part_name": "door",
        "damage_type": "dent",
        "severity_band": "SEVERE",
        "part_confidence": 0.90,
        "damage_confidence": 0.90, # sum = 1.80, tied confidence
        "unattributed": False,
        "rate_row_found": True
    }

    result = deduplicate_cross_photo_line_items([item_photo1, item_photo2])
    assert len(result) == 1
    # Tiebreaker chooses SEVERE over MODERATE so severity is never under-reported
    assert result[0]["severity_band"] == "SEVERE"

def test_deduplicate_cross_photo_different_parts_and_types_all_survive():
    item1 = {
        "part_name": "bumper_front",
        "damage_type": "scratch",
        "severity_band": "MINOR",
        "part_confidence": 0.90,
        "damage_confidence": 0.85,
        "unattributed": False
    }
    item2 = {
        "part_name": "bumper_front",
        "damage_type": "dent", # different damage type on same part
        "severity_band": "MODERATE",
        "part_confidence": 0.90,
        "damage_confidence": 0.85,
        "unattributed": False
    }
    item3 = {
        "part_name": "door", # different part
        "damage_type": "scratch",
        "severity_band": "MINOR",
        "part_confidence": 0.92,
        "damage_confidence": 0.88,
        "unattributed": False
    }

    result = deduplicate_cross_photo_line_items([item1, item2, item3])
    # None of these represent the same part+damage pair, all survive
    assert len(result) == 3
    assert {r["damage_type"] for r in result} == {"scratch", "dent"}
    assert {r["part_name"] for r in result} == {"bumper_front", "door"}

def test_deduplicate_cross_photo_unattributed_never_merged():
    unattr1 = {
        "part_name": "UNATTRIBUTED",
        "damage_type": "scratch",
        "severity_band": "SEVERE",
        "part_confidence": 0.0,
        "damage_confidence": 0.85,
        "unattributed": True
    }
    unattr2 = {
        "part_name": "UNATTRIBUTED",
        "damage_type": "scratch",
        "severity_band": "SEVERE",
        "part_confidence": 0.0,
        "damage_confidence": 0.90,
        "unattributed": True
    }

    result = deduplicate_cross_photo_line_items([unattr1, unattr2])
    # Unattributed items must never be merged across photos
    assert len(result) == 2
    assert all(r["unattributed"] is True for r in result)

def test_deduplicate_cross_photo_empty_and_single():
    assert deduplicate_cross_photo_line_items([]) == []
    single = [{"part_name": "hood", "damage_type": "dent", "unattributed": False, "part_confidence": 0.9, "damage_confidence": 0.9}]
    assert len(deduplicate_cross_photo_line_items(single)) == 1

