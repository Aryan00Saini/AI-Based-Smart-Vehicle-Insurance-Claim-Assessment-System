import os
import pytest
from decimal import Decimal
from backend.app.db.database import SessionLocal, init_db, engine, Base
from backend.app.db.models import (
    VehicleTier, PartCatalog, RateMatrix, Policy, User,
    Claim, ClaimPhoto, ClaimLineItem, ClaimOverride, PhotoHashStore
)
from backend.app.db.seed import seed_database
from backend.app.services.storage import storage_service

@pytest.fixture(scope="module")
def setup_db():
    init_db()
    seed_database()
    yield
    # Cleanup if needed

def test_tiers_and_parts_seeded(setup_db):
    db = SessionLocal()
    try:
        tiers = db.query(VehicleTier).all()
        tier_names = {t.tier_name for t in tiers}
        assert "HATCHBACK" in tier_names
        assert "SEDAN" in tier_names
        assert "SUV" in tier_names
        assert len(tiers) == 3

        parts = db.query(PartCatalog).all()
        part_codes = {p.part_code for p in parts}
        expected_parts = {
            "bumper_front", "bumper_rear", "door", "fender",
            "headlamp", "taillamp", "mirror", "hood", "windshield"
        }
        assert expected_parts.issubset(part_codes)
        assert len(parts) == 9

        # Verify structural flags
        fender = db.query(PartCatalog).filter_by(part_code="fender").first()
        assert fender.is_structural is True

        bumper = db.query(PartCatalog).filter_by(part_code="bumper_front").first()
        assert bumper.is_structural is False
    finally:
        db.close()

def test_rate_matrix_pricing(setup_db):
    db = SessionLocal()
    try:
        sedan = db.query(VehicleTier).filter_by(tier_name="SEDAN").first()
        bumper = db.query(PartCatalog).filter_by(part_code="bumper_front").first()

        rate = db.query(RateMatrix).filter_by(
            tier_id=sedan.tier_id,
            part_id=bumper.part_id,
            damage_type="scratch",
            severity_band="MINOR"
        ).first()

        assert rate is not None
        assert rate.repair_cost_base > Decimal("0.00")
        assert rate.replace_cost_base > Decimal("0.00")
        assert rate.repair_labor_hrs > Decimal("0.00")
        assert rate.replace_labor_hrs > Decimal("0.00")

        # Glass shatter should have repair_cost_base == 0 (must replace)
        windshield = db.query(PartCatalog).filter_by(part_code="windshield").first()
        glass_shatter = db.query(RateMatrix).filter_by(
            tier_id=sedan.tier_id,
            part_id=windshield.part_id,
            damage_type="shatter",
            severity_band="SEVERE"
        ).first()
        assert glass_shatter is not None
        assert glass_shatter.repair_cost_base == Decimal("0.00")
        assert glass_shatter.replace_cost_base > Decimal("5000.00")
    finally:
        db.close()

def test_claims_relationships(setup_db):
    db = SessionLocal()
    try:
        claim = Claim(
            policy_id="POL-2026-004821",
            vehicle_reg_no="UK07AB1234",
            vehicle_tier="SEDAN",
            status="SUBMITTED",
            subtotal=Decimal("1500.00"),
            deductible=Decimal("1000.00"),
            payable_amount=Decimal("500.00")
        )
        db.add(claim)
        db.flush()

        photo = ClaimPhoto(
            claim_id=claim.claim_id,
            s3_key="uploads/test_photo.jpg",
            blur_score=145.2
        )
        db.add(photo)

        line_item = ClaimLineItem(
            claim_id=claim.claim_id,
            part_name="bumper_front",
            damage_type="scratch",
            severity_band="MINOR",
            decision="REPAIR",
            base_cost=Decimal("750.00"),
            labor_hrs=Decimal("1.5"),
            labor_cost=Decimal("750.00"),
            line_total=Decimal("1500.00"),
            part_confidence=0.92,
            damage_confidence=0.88
        )
        db.add(line_item)

        override = ClaimOverride(
            claim_id=claim.claim_id,
            surveyor_id="surveyor1",
            previous_assessment={"status": "ASSESSED"},
            override_data={"decision": "APPROVED"},
            reason="Verified superficial scratch."
        )
        db.add(override)
        db.commit()

        # Query back and verify relations
        saved_claim = db.query(Claim).filter_by(claim_id=claim.claim_id).first()
        assert len(saved_claim.photos) == 1
        assert len(saved_claim.line_items) == 1
        assert len(saved_claim.overrides) == 1
        assert saved_claim.line_items[0].part_name == "bumper_front"
    finally:
        db.close()

def test_storage_service():
    test_key = "tests/sample_artifact.txt"
    content = b"Vehicle Insurance Assessment Engine Storage Test"
    storage_service.put_file(content, test_key, "text/plain")

    assert storage_service.file_exists(test_key) is True
    retrieved = storage_service.get_file(test_key)
    assert retrieved == content
