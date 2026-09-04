import pytest
from decimal import Decimal
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.seed import seed_database
from backend.app.services.cost_engine import compute_line_item_cost, calculate_claim_costs
from backend.app.db.models import VehicleTier, PartCatalog, RateMatrix

@pytest.fixture(scope="module")
def db_session():
    init_db()
    seed_database()
    db = SessionLocal()
    yield db
    db.close()

def test_compute_line_item_cost_repair(db_session):
    sedan = db_session.query(VehicleTier).filter_by(tier_name="SEDAN").first()
    bumper = db_session.query(PartCatalog).filter_by(part_code="bumper_front").first()
    rate = db_session.query(RateMatrix).filter_by(
        tier_id=sedan.tier_id,
        part_id=bumper.part_id,
        damage_type="scratch",
        severity_band="MINOR"
    ).first()

    res = compute_line_item_cost(sedan.labor_rate_hr, "scratch", "MINOR", rate)
    assert res["decision"] == "REPAIR"
    assert res["base_cost"] == rate.repair_cost_base
    assert res["labor_hrs"] == rate.repair_labor_hrs
    expected_labor_cost = round(rate.repair_labor_hrs * sedan.labor_rate_hr, 2)
    assert res["labor_cost"] == expected_labor_cost
    assert res["line_total"] == round(rate.repair_cost_base + expected_labor_cost, 2)
    assert res["rate_row_found"] is True

def test_compute_line_item_cost_replace_severe(db_session):
    sedan = db_session.query(VehicleTier).filter_by(tier_name="SEDAN").first()
    door = db_session.query(PartCatalog).filter_by(part_code="door").first()
    rate = db_session.query(RateMatrix).filter_by(
        tier_id=sedan.tier_id,
        part_id=door.part_id,
        damage_type="dent",
        severity_band="SEVERE"
    ).first()

    res = compute_line_item_cost(sedan.labor_rate_hr, "dent", "SEVERE", rate)
    assert res["decision"] == "REPLACE"
    assert res["base_cost"] == rate.replace_cost_base
    assert res["labor_hrs"] == rate.replace_labor_hrs
    assert res["line_total"] == round(rate.replace_cost_base + rate.replace_labor_hrs * sedan.labor_rate_hr, 2)

def test_compute_line_item_cost_replace_shatter(db_session):
    suv = db_session.query(VehicleTier).filter_by(tier_name="SUV").first()
    windshield = db_session.query(PartCatalog).filter_by(part_code="windshield").first()
    rate = db_session.query(RateMatrix).filter_by(
        tier_id=suv.tier_id,
        part_id=windshield.part_id,
        damage_type="shatter",
        severity_band="MINOR"
    ).first()

    res = compute_line_item_cost(suv.labor_rate_hr, "shatter", "MINOR", rate)
    assert res["decision"] == "REPLACE"
    assert res["base_cost"] == rate.replace_cost_base

def test_compute_line_item_cost_missing_row():
    res = compute_line_item_cost(Decimal("500.00"), "unknown_damage", "MINOR", None)
    assert res["rate_row_found"] is False
    assert res["line_total"] == Decimal("0.00")

def test_calculate_claim_costs_with_deductible(db_session):
    fused_items = [
        {
            "part_name": "bumper_front",
            "damage_type": "scratch",
            "severity_band": "MINOR",
            "part_confidence": 0.95,
            "damage_confidence": 0.90,
            "unattributed": False
        },
        {
            "part_name": "mirror",
            "damage_type": "scratch",
            "severity_band": "MINOR",
            "part_confidence": 0.92,
            "damage_confidence": 0.88,
            "unattributed": False
        }
    ]

    deductible = Decimal("1000.00")
    res = calculate_claim_costs(db_session, "SEDAN", fused_items, deductible=deductible)

    assert len(res["line_items"]) == 2
    assert res["subtotal"] > Decimal("0.00")
    expected_payable = max(res["subtotal"] - deductible, Decimal("0.00"))
    assert res["payable_amount"] == expected_payable
