import sys
from decimal import Decimal
from sqlalchemy.orm import Session
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.models import VehicleTier, PartCatalog, RateMatrix, Policy, User
from backend.app.core.security import get_password_hash

def seed_database(db: Session = None):
    close_at_end = False
    if db is None:
        init_db()
        db = SessionLocal()
        close_at_end = True

    try:
        # 1. Seed Vehicle Tiers
        tiers_data = [
            {"tier_name": "HATCHBACK", "labor_rate_hr": Decimal("450.00")},
            {"tier_name": "SEDAN", "labor_rate_hr": Decimal("550.00")},
            {"tier_name": "SUV", "labor_rate_hr": Decimal("700.00")},
        ]
        
        tier_objs = {}
        for t in tiers_data:
            existing = db.query(VehicleTier).filter_by(tier_name=t["tier_name"]).first()
            if not existing:
                existing = VehicleTier(**t)
                db.add(existing)
                db.flush()
            tier_objs[t["tier_name"]] = existing

        # 2. Seed Part Catalog (9 classes)
        parts_data = [
            {"part_code": "bumper_front", "part_label": "Front Bumper Cover", "is_structural": False, "criticality": 1},
            {"part_code": "bumper_rear", "part_label": "Rear Bumper Cover", "is_structural": False, "criticality": 1},
            {"part_code": "door", "part_label": "Side Door Panel", "is_structural": False, "criticality": 2},
            {"part_code": "fender", "part_label": "Quarter Fender", "is_structural": True, "criticality": 2},
            {"part_code": "headlamp", "part_label": "Headlamp Assembly", "is_structural": False, "criticality": 2},
            {"part_code": "taillamp", "part_label": "Tail Lamp Assembly", "is_structural": False, "criticality": 1},
            {"part_code": "mirror", "part_label": "Side Rearview Mirror", "is_structural": False, "criticality": 1},
            {"part_code": "hood", "part_label": "Engine Hood / Bonnet", "is_structural": True, "criticality": 3},
            {"part_code": "windshield", "part_label": "Front Windshield Glass", "is_structural": False, "criticality": 2},
        ]
        
        part_objs = {}
        for p in parts_data:
            existing = db.query(PartCatalog).filter_by(part_code=p["part_code"]).first()
            if not existing:
                existing = PartCatalog(**p)
                db.add(existing)
                db.flush()
            part_objs[p["part_code"]] = existing

        # 3. Seed Rate Matrix
        damage_types = ["scratch", "dent", "crack", "shatter", "paint_chip", "misalignment"]
        severity_bands = ["MINOR", "MODERATE", "SEVERE"]
        
        tier_multiplier = {
            "HATCHBACK": Decimal("1.0"),
            "SEDAN": Decimal("1.35"),
            "SUV": Decimal("1.75"),
        }

        # Base part prices for HATCHBACK
        part_base_pricing = {
            "bumper_front": {"replace_base": 4200.0, "replace_labor": 2.5, "repair_base": 750.0, "repair_labor": 1.5},
            "bumper_rear": {"replace_base": 4000.0, "replace_labor": 2.2, "repair_base": 700.0, "repair_labor": 1.4},
            "door": {"replace_base": 8500.0, "replace_labor": 3.5, "repair_base": 1200.0, "repair_labor": 2.0},
            "fender": {"replace_base": 3800.0, "replace_labor": 2.2, "repair_base": 800.0, "repair_labor": 1.6},
            "headlamp": {"replace_base": 4500.0, "replace_labor": 1.2, "repair_base": 0.0, "repair_labor": 0.0},
            "taillamp": {"replace_base": 2800.0, "replace_labor": 1.0, "repair_base": 0.0, "repair_labor": 0.0},
            "mirror": {"replace_base": 2200.0, "replace_labor": 0.8, "repair_base": 400.0, "repair_labor": 0.5},
            "hood": {"replace_base": 9500.0, "replace_labor": 3.0, "repair_base": 1400.0, "repair_labor": 2.2},
            "windshield": {"replace_base": 6500.0, "replace_labor": 2.5, "repair_base": 0.0, "repair_labor": 0.0},
        }

        for t_name, t_obj in tier_objs.items():
            mult = tier_multiplier[t_name]
            for p_code, p_obj in part_objs.items():
                p_info = part_base_pricing[p_code]
                
                for d_type in damage_types:
                    for sev in severity_bands:
                        # Check existing
                        existing = db.query(RateMatrix).filter_by(
                            tier_id=t_obj.tier_id,
                            part_id=p_obj.part_id,
                            damage_type=d_type,
                            severity_band=sev
                        ).first()
                        if existing:
                            continue

                        # Severity factor
                        sev_factor = Decimal("1.0") if sev == "MINOR" else (Decimal("1.8") if sev == "MODERATE" else Decimal("2.8"))
                        
                        replace_cost = Decimal(str(p_info["replace_base"])) * mult
                        replace_labor = Decimal(str(p_info["replace_labor"]))

                        # Glass / Lamps cannot be repaired if cracked or shattered
                        is_glass_lamp = p_code in ["windshield", "headlamp", "taillamp"]
                        if is_glass_lamp or d_type in ["shatter", "crack"]:
                            repair_cost = Decimal("0.00")
                            repair_labor = Decimal("0.00")
                        else:
                            repair_cost = Decimal(str(p_info["repair_base"])) * mult * sev_factor
                            repair_labor = Decimal(str(p_info["repair_labor"])) * (Decimal("1.0") if sev == "MINOR" else Decimal("1.4"))

                        row = RateMatrix(
                            tier_id=t_obj.tier_id,
                            part_id=p_obj.part_id,
                            damage_type=d_type,
                            severity_band=sev,
                            repair_cost_base=round(repair_cost, 2),
                            replace_cost_base=round(replace_cost, 2),
                            replace_labor_hrs=round(replace_labor, 2),
                            repair_labor_hrs=round(repair_labor, 2)
                        )
                        db.add(row)

        # 4. Seed Demo Policies
        demo_policies = [
            {
                "policy_id": "POL-2026-004821",
                "policyholder_name": "Aarav Sharma",
                "vehicle_reg_no": "UK07AB1234",
                "vehicle_tier": "SEDAN",
                "deductible": Decimal("1000.00"),
                "active": True
            },
            {
                "policy_id": "POL-2026-009912",
                "policyholder_name": "Priya Patel",
                "vehicle_reg_no": "DL01XY9876",
                "vehicle_tier": "HATCHBACK",
                "deductible": Decimal("1500.00"),
                "active": True
            },
            {
                "policy_id": "POL-2026-007733",
                "policyholder_name": "Vikram Malhotra",
                "vehicle_reg_no": "MH02CD5555",
                "vehicle_tier": "SUV",
                "deductible": Decimal("2500.00"),
                "active": True
            }
        ]
        for pol in demo_policies:
            existing = db.query(Policy).filter_by(policy_id=pol["policy_id"]).first()
            if not existing:
                db.add(Policy(**pol))

        # 5. Seed Users
        demo_users = [
            {
                "username": "surveyor1",
                "hashed_password": get_password_hash("surveyor123"),
                "role": "surveyor",
                "full_name": "Senior Surveyor Rajesh Verma"
            },
            {
                "username": "policyholder1",
                "hashed_password": get_password_hash("user123"),
                "role": "policyholder",
                "full_name": "Aarav Sharma"
            },
            {
                "username": "admin1",
                "hashed_password": get_password_hash("admin123"),
                "role": "admin",
                "full_name": "Claims Admin Officer"
            }
        ]
        for usr in demo_users:
            existing = db.query(User).filter_by(username=usr["username"]).first()
            if not existing:
                db.add(User(**usr))

        db.commit()
        print("Database seeded successfully with tiers, parts, rate matrix, demo policies, and users!")
    finally:
        if close_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
