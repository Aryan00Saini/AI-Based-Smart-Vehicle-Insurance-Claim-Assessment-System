from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import VehicleTier, PartCatalog, RateMatrix

router = APIRouter(prefix="/rates", tags=["Rate Matrix"])

@router.get("/tiers")
def list_vehicle_tiers(db: Session = Depends(get_db)):
    tiers = db.query(VehicleTier).all()
    return [
        {"tier_id": t.tier_id, "tier_name": t.tier_name, "labor_rate_hr": float(t.labor_rate_hr)}
        for t in tiers
    ]

@router.get("/parts")
def list_part_catalog(db: Session = Depends(get_db)):
    parts = db.query(PartCatalog).all()
    return [
        {
            "part_id": p.part_id,
            "part_code": p.part_code,
            "part_label": p.part_label,
            "is_structural": p.is_structural,
            "criticality": p.criticality
        }
        for p in parts
    ]

@router.get("/matrix")
def get_rate_matrix(
    tier_name: Optional[str] = None,
    part_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RateMatrix).join(VehicleTier).join(PartCatalog)
    if tier_name:
        query = query.filter(VehicleTier.tier_name == tier_name.upper())
    if part_code:
        query = query.filter(PartCatalog.part_code == part_code)
    
    rows = query.all()
    return [
        {
            "rate_id": r.rate_id,
            "tier_name": r.tier.tier_name,
            "part_code": r.part.part_code,
            "part_label": r.part.part_label,
            "damage_type": r.damage_type,
            "severity_band": r.severity_band,
            "repair_cost_base": float(r.repair_cost_base),
            "replace_cost_base": float(r.replace_cost_base),
            "replace_labor_hrs": float(r.replace_labor_hrs),
            "repair_labor_hrs": float(r.repair_labor_hrs)
        }
        for r in rows
    ]


@router.get("/part-pricing")
def get_part_pricing(
    tier_name: str = "SEDAN",
    part_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns deterministic replacement parts pricing suggestions, including
    genuine OEM, certified aftermarket, and recycled options with labor estimates.
    """
    tier = db.query(VehicleTier).filter(VehicleTier.tier_name == tier_name.upper()).first()
    if not tier:
        raise HTTPException(status_code=404, detail=f"Vehicle tier '{tier_name}' not found.")

    parts_query = db.query(PartCatalog)
    if part_code:
        parts_query = parts_query.filter(PartCatalog.part_code == part_code)
    parts = parts_query.all()

    if not parts and part_code:
        raise HTTPException(status_code=404, detail=f"Part code '{part_code}' not found.")

    results = []
    labor_rate = float(tier.labor_rate_hr)

    for p in parts:
        matrix_row = db.query(RateMatrix).filter(
            RateMatrix.tier_id == tier.tier_id,
            RateMatrix.part_id == p.part_id
        ).first()

        if not matrix_row:
            continue

        oem_part_cost = float(matrix_row.replace_cost_base)
        labor_hrs = float(matrix_row.replace_labor_hrs)
        labor_cost = round(labor_hrs * labor_rate, 2)
        oem_total = round(oem_part_cost + labor_cost, 2)

        aft_part_cost = round(oem_part_cost * 0.70, 2)
        aft_total = round(aft_part_cost + labor_cost, 2)
        aft_savings = round(oem_total - aft_total, 2)

        recycled_part_cost = round(oem_part_cost * 0.50, 2)
        recycled_total = round(recycled_part_cost + labor_cost, 2)
        recycled_savings = round(oem_total - recycled_total, 2)

        code_prefix = "".join([w[0].upper() for w in p.part_code.split("_")])
        tier_short = tier.tier_name[:3]

        results.append({
            "part_code": p.part_code,
            "part_label": p.part_label,
            "vehicle_tier": tier.tier_name,
            "is_structural": p.is_structural,
            "criticality": p.criticality,
            "labor_hours": labor_hrs,
            "labor_rate_hr": labor_rate,
            "labor_cost": labor_cost,
            "options": {
                "oem": {
                    "type": "OEM Genuine",
                    "part_number": f"OEM-{tier_short}-{code_prefix}-9{p.part_id:03d}",
                    "brand": "OEM Authorized Genuine",
                    "part_cost": oem_part_cost,
                    "labor_cost": labor_cost,
                    "total_cost": oem_total,
                    "warranty": "24 Months / Unlimited km",
                    "availability": "In Stock (1-2 days)",
                    "description": "Factory authentic original manufacturer component with full factory warranty."
                },
                "aftermarket": {
                    "type": "Certified Aftermarket",
                    "part_number": f"AFT-{tier_short}-{code_prefix}-4{p.part_id:03d}",
                    "brand": "ARAI / CAPA Certified (Uno Minda / Valeo)",
                    "part_cost": aft_part_cost,
                    "labor_cost": labor_cost,
                    "total_cost": aft_total,
                    "savings": aft_savings,
                    "warranty": "12 Months / 20,000 km",
                    "availability": "In Stock (Same day)",
                    "description": "Meets or exceeds OEM tensile and impact tolerances at a 30% discount on base part pricing."
                },
                "recycled": {
                    "type": "Eco-Recycled OEM",
                    "part_number": f"REC-{tier_short}-{code_prefix}-1{p.part_id:03d}",
                    "brand": "Grade-A Recycled OEM",
                    "part_cost": recycled_part_cost,
                    "labor_cost": labor_cost,
                    "total_cost": recycled_total,
                    "savings": recycled_savings,
                    "warranty": "6 Months",
                    "availability": "Available on request",
                    "description": "Green insurance claim option: high-integrity donor OEM part, ultrasound-inspected."
                }
            }
        })

    if part_code and results:
        return results[0]
    return results
