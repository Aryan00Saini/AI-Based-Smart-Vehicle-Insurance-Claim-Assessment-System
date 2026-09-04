from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2

DAMAGE_TYPE_WEIGHT = {
    "scratch": 1,
    "paint_chip": 1,
    "dent": 2,
    "misalignment": 3,
    "crack": 3,
    "shatter": 4,
}

def grade_severity(area_ratio: float, damage_type: str) -> str:
    """Calculates categorical severity band (MINOR, MODERATE, SEVERE) deterministically."""
    weight = DAMAGE_TYPE_WEIGHT.get(damage_type, 2)
    score = area_ratio * weight
    if score < 0.15:
        return "MINOR"
    elif score < 0.45:
        return "MODERATE"
    else:
        return "SEVERE"

def fuse_masks(
    parts: List[Dict[str, Any]],
    damages: List[Dict[str, Any]],
    vehicle_mask: Optional[np.ndarray] = None,
    min_damage_pixels: int = 50,
    attribution_threshold: float = 0.05
) -> Dict[str, Any]:
    """
    Fuses Model 1 (Vehicle Parts) and Model 2 (Damage Types) predictions.
    
    Each item in parts:
      { "part_name": str, "confidence": float, "bbox": [x1, y1, x2, y2], "mask": np.ndarray(bool/uint8) }
      
    Each item in damages:
      { "damage_type": str, "confidence": float, "bbox": [x1, y1, x2, y2], "mask": np.ndarray(bool/uint8) }

    Returns:
      {
        "line_items": List[Dict],
        "unattributed_damage_present": bool,
        "fused_parts": List[Dict],
        "fused_damages": List[Dict]
      }
    """
    line_items = []
    unattributed_damage_present = False
    
    for dmg_idx, dmg in enumerate(damages):
        dmg_mask = np.asarray(dmg["mask"], dtype=bool)
        dmg_type = dmg["damage_type"]
        dmg_conf = float(dmg.get("confidence", 0.85))
        dmg_area = int(np.sum(dmg_mask))
        
        # 1. Discard sub-threshold noise blobs
        if dmg_area < min_damage_pixels:
            continue
            
        # 2. Discard damage falling mostly outside vehicle silhouette
        if vehicle_mask is not None:
            v_overlap = np.sum(dmg_mask & np.asarray(vehicle_mask, dtype=bool))
            if v_overlap / dmg_area < 0.50:
                continue

        best_part = None
        best_intersection = 0
        best_area_ratio = 0.0

        # 3. Find best-overlapping part
        for part in parts:
            part_mask = np.asarray(part["mask"], dtype=bool)
            part_area = int(np.sum(part_mask))
            if part_area == 0:
                continue

            intersection = int(np.sum(dmg_mask & part_mask))
            if intersection > best_intersection:
                best_intersection = intersection
                best_part = part
                best_area_ratio = float(intersection / part_area)

        # 4. Check attribution threshold against damage area
        overlap_on_damage = (best_intersection / dmg_area) if dmg_area > 0 else 0.0
        
        if best_part is None or overlap_on_damage < attribution_threshold:
            unattributed_damage_present = True
            line_items.append({
                "part_name": "UNATTRIBUTED",
                "damage_type": dmg_type,
                "severity_band": grade_severity(1.0, dmg_type), # severe fallback
                "area_ratio": 1.0,
                "part_confidence": 0.0,
                "damage_confidence": dmg_conf,
                "is_structural_part": False,
                "unattributed": True,
                "rate_row_found": False,
                "bbox": dmg.get("bbox", [0, 0, 0, 0]),
                "mask": dmg_mask
            })
        else:
            sev_band = grade_severity(best_area_ratio, dmg_type)
            part_name = best_part["part_name"]
            part_conf = float(best_part.get("confidence", 0.90))
            is_structural = best_part.get("is_structural", False)

            line_items.append({
                "part_name": part_name,
                "damage_type": dmg_type,
                "severity_band": sev_band,
                "area_ratio": round(best_area_ratio, 4),
                "part_confidence": part_conf,
                "damage_confidence": dmg_conf,
                "is_structural_part": is_structural,
                "unattributed": False,
                "rate_row_found": True,
                "bbox": dmg.get("bbox", best_part.get("bbox", [0, 0, 0, 0])),
                "mask": dmg_mask
            })

    return {
        "line_items": line_items,
        "unattributed_damage_present": unattributed_damage_present,
        "parts": parts,
        "damages": damages
    }

def generate_visual_overlay(
    img_bgr: np.ndarray,
    parts: List[Dict[str, Any]],
    line_items: List[Dict[str, Any]]
) -> np.ndarray:
    """Renders high-clarity color overlay with part masks and severity-coded damage boundaries."""
    overlay = img_bgr.copy()
    h, w = img_bgr.shape[:2]

    # 1. Render Part Masks (Soft Cyan/Blue tint)
    part_layer = np.zeros_like(img_bgr, dtype=np.uint8)
    for p in parts:
        mask = np.asarray(p["mask"], dtype=np.uint8)
        if mask.shape[:2] != (h, w):
            mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
        # Cyan color (BGR: 255, 200, 0)
        part_layer[mask > 0] = [230, 180, 40]
        # Outline
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, (255, 215, 0), 2)

    # Blend parts
    cv2.addWeighted(part_layer, 0.25, overlay, 0.75, 0, overlay)

    # 2. Render Damage Masks with Severity Colors
    severity_colors = {
        "MINOR": (30, 215, 250),     # Yellow-gold (BGR)
        "MODERATE": (20, 140, 255),  # Orange (BGR)
        "SEVERE": (40, 40, 240),     # Crimson Red (BGR)
    }

    damage_layer = np.zeros_like(img_bgr, dtype=np.uint8)
    for li in line_items:
        mask = np.asarray(li["mask"], dtype=np.uint8)
        if mask.shape[:2] != (h, w):
            mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)

        sev = li.get("severity_band", "MINOR")
        color = severity_colors.get(sev, (50, 50, 240))
        
        damage_layer[mask > 0] = color
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, color, 3)

        # Draw label box
        bbox = li.get("bbox")
        if bbox and len(bbox) == 4:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            # scale bbox if coordinates were in 640x640
            label = f"{li['part_name']} | {li['damage_type']} [{sev}]"
            cv2.rectangle(overlay, (x1, max(0, y1 - 22)), (x1 + len(label) * 8 + 10, y1), color, -1)
            cv2.putText(
                overlay, label, (x1 + 4, y1 - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
            )

    cv2.addWeighted(damage_layer, 0.45, overlay, 0.55, 0, overlay)
    return overlay
