from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.db.models import VehicleTier, PartCatalog, RateMatrix

def compute_line_item_cost(
    labor_rate_hr: Decimal,
    damage_type: str,
    severity_band: str,
    rate_row: Optional[RateMatrix] = None
) -> Dict[str, Any]:
    """
    Computes repair-vs-replace decision and line-item total according to the formula:
    decision = REPLACE if severity_band == "SEVERE"
               or damage_type in {"shatter", "crack"}
               or repair_cost_base == 0
               else REPAIR
    """
    if rate_row is None:
        return {
            "decision": "REPAIR",
            "base_cost": Decimal("0.00"),
            "labor_hrs": Decimal("0.00"),
            "labor_cost": Decimal("0.00"),
            "line_total": Decimal("0.00"),
            "rate_row_found": False
        }

    # Deterministic Repair vs Replace decision
    should_replace = (
        severity_band == "SEVERE"
        or damage_type in {"shatter", "crack"}
        or rate_row.repair_cost_base == Decimal("0.00")
    )

    decision = "REPLACE" if should_replace else "REPAIR"
    base_cost = rate_row.replace_cost_base if decision == "REPLACE" else rate_row.repair_cost_base
    labor_hrs = rate_row.replace_labor_hrs if decision == "REPLACE" else rate_row.repair_labor_hrs
    labor_cost = round(labor_hrs * labor_rate_hr, 2)
    line_total = round(base_cost + labor_cost, 2)

    return {
        "decision": decision,
        "base_cost": base_cost,
        "labor_hrs": labor_hrs,
        "labor_cost": labor_cost,
        "line_total": line_total,
        "rate_row_found": True
    }

def calculate_claim_costs(
    db: Session,
    vehicle_tier_name: str,
    fused_line_items: List[Dict[str, Any]],
    deductible: Decimal = Decimal("1000.00")
) -> Dict[str, Any]:
    """
    Queries relational rate_matrix and computes full claim cost breakdown.
    A missing rate-matrix entry triggers rate_row_found=False (escalation E8).
    """
    tier = db.query(VehicleTier).filter_by(tier_name=vehicle_tier_name).first()
    if not tier:
        # Default tier fallback
        labor_rate_hr = Decimal("550.00")
        tier_id = 1
    else:
        labor_rate_hr = tier.labor_rate_hr
        tier_id = tier.tier_id

    processed_line_items = []
    subtotal = Decimal("0.00")

    for item in fused_line_items:
        part_name = item.get("part_name", "")
        damage_type = item.get("damage_type", "")
        severity_band = item.get("severity_band", "MINOR")
        unattributed = item.get("unattributed", False)

        part_obj = db.query(PartCatalog).filter_by(part_code=part_name).first()
        is_structural = part_obj.is_structural if part_obj else False

        rate_row = None
        if part_obj and not unattributed:
            rate_row = db.query(RateMatrix).filter_by(
                tier_id=tier_id,
                part_id=part_obj.part_id,
                damage_type=damage_type,
                severity_band=severity_band
            ).first()

        cost_res = compute_line_item_cost(
            labor_rate_hr=labor_rate_hr,
            damage_type=damage_type,
            severity_band=severity_band,
            rate_row=rate_row
        )

        item_total = cost_res["line_total"]
        if cost_res["rate_row_found"]:
            subtotal += item_total

        processed_line_items.append({
            "part_name": part_name,
            "damage_type": damage_type,
            "severity_band": severity_band,
            "decision": cost_res["decision"],
            "base_cost": cost_res["base_cost"],
            "labor_hrs": cost_res["labor_hrs"],
            "labor_cost": cost_res["labor_cost"],
            "line_total": item_total,
            "part_confidence": float(item.get("part_confidence", 0.0)),
            "damage_confidence": float(item.get("damage_confidence", 0.0)),
            "is_structural_part": is_structural,
            "rate_row_found": cost_res["rate_row_found"],
            "unattributed": unattributed,
            "bbox": item.get("bbox", [0, 0, 0, 0])
        })

    payable_amount = max(subtotal - deductible, Decimal("0.00"))

    return {
        "line_items": processed_line_items,
        "subtotal": subtotal,
        "deductible": deductible,
        "payable_amount": payable_amount
    }
