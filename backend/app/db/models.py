import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, SmallInteger, String, Numeric, Boolean,
    DateTime, ForeignKey, Text, Float, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class VehicleTier(Base):
    __tablename__ = "vehicle_tier"

    tier_id = Column(Integer, primary_key=True, autoincrement=True)
    tier_name = Column(String(20), unique=True, nullable=False) # HATCHBACK / SEDAN / SUV
    labor_rate_hr = Column(Numeric(8, 2), nullable=False)

    rate_matrix_entries = relationship("RateMatrix", back_populates="tier", cascade="all, delete-orphan")


class PartCatalog(Base):
    __tablename__ = "part_catalog"

    part_id = Column(Integer, primary_key=True, autoincrement=True)
    part_code = Column(String(40), unique=True, nullable=False)
    part_label = Column(String(80), nullable=False)
    is_structural = Column(Boolean, nullable=False, default=False)
    criticality = Column(SmallInteger, nullable=False, default=1)

    rate_matrix_entries = relationship("RateMatrix", back_populates="part", cascade="all, delete-orphan")


class RateMatrix(Base):
    __tablename__ = "rate_matrix"

    rate_id = Column(Integer, primary_key=True, autoincrement=True)
    tier_id = Column(Integer, ForeignKey("vehicle_tier.tier_id"), nullable=False)
    part_id = Column(Integer, ForeignKey("part_catalog.part_id"), nullable=False)
    damage_type = Column(String(20), nullable=False)
    severity_band = Column(String(10), nullable=False)
    repair_cost_base = Column(Numeric(10, 2), nullable=False)
    replace_cost_base = Column(Numeric(10, 2), nullable=False)
    replace_labor_hrs = Column(Numeric(4, 2), nullable=False)
    repair_labor_hrs = Column(Numeric(4, 2), nullable=False)

    tier = relationship("VehicleTier", back_populates="rate_matrix_entries")
    part = relationship("PartCatalog", back_populates="rate_matrix_entries")

    __table_args__ = (
        UniqueConstraint("tier_id", "part_id", "damage_type", "severity_band", name="uq_tier_part_damage_severity"),
    )


class Policy(Base):
    __tablename__ = "policies"

    policy_id = Column(String(50), primary_key=True)
    policyholder_name = Column(String(100), nullable=False)
    vehicle_reg_no = Column(String(20), nullable=False)
    vehicle_tier = Column(String(20), nullable=False)
    deductible = Column(Numeric(10, 2), nullable=False, default=1000.00)
    active = Column(Boolean, default=True)


class Claim(Base):
    __tablename__ = "claims"

    claim_id = Column(String(64), primary_key=True, default=generate_uuid)
    policy_id = Column(String(50), nullable=False)
    incident_date_time = Column(DateTime(timezone=True), nullable=True)
    incident_location_lat = Column(Float, nullable=True)
    incident_location_lng = Column(Float, nullable=True)
    incident_description = Column(Text, nullable=True)
    
    vehicle_reg_no = Column(String(20), nullable=False)
    vehicle_tier = Column(String(20), nullable=False) # HATCHBACK, SEDAN, SUV
    
    status = Column(String(30), nullable=False, default="SUBMITTED") # SUBMITTED, PROCESSING, ASSESSED, SURVEYOR_REVIEWED, APPROVED, REJECTED
    ai_assessment_jsonb = Column(JSON, nullable=True)
    
    subtotal = Column(Numeric(10, 2), nullable=False, default=0.00)
    deductible = Column(Numeric(10, 2), nullable=False, default=0.00)
    payable_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    
    decision = Column(String(30), nullable=True) # AUTO_APPROVED, SURVEYOR_REVIEW
    decision_reasons = Column(JSON, nullable=True) # Array of reason codes/strings
    fraud_score = Column(Integer, nullable=False, default=0)
    photo_validation_passed = Column(Boolean, nullable=False, default=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    photos = relationship("ClaimPhoto", back_populates="claim", cascade="all, delete-orphan")
    line_items = relationship("ClaimLineItem", back_populates="claim", cascade="all, delete-orphan")
    overrides = relationship("ClaimOverride", back_populates="claim", cascade="all, delete-orphan")


class ClaimPhoto(Base):
    __tablename__ = "claim_photos"

    photo_id = Column(String(64), primary_key=True, default=generate_uuid)
    claim_id = Column(String(64), ForeignKey("claims.claim_id"), nullable=False)
    s3_key = Column(String(255), nullable=False)
    overlay_s3_key = Column(String(255), nullable=True)
    phash = Column(String(64), nullable=True)
    blur_score = Column(Float, nullable=True)
    exif_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    claim = relationship("Claim", back_populates="photos")


class ClaimLineItem(Base):
    __tablename__ = "claim_line_items"

    line_id = Column(String(64), primary_key=True, default=generate_uuid)
    claim_id = Column(String(64), ForeignKey("claims.claim_id"), nullable=False)
    part_name = Column(String(50), nullable=False)
    damage_type = Column(String(50), nullable=False)
    severity_band = Column(String(20), nullable=False) # MINOR, MODERATE, SEVERE
    decision = Column(String(20), nullable=False) # REPAIR, REPLACE
    
    base_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    labor_hrs = Column(Numeric(4, 2), nullable=False, default=0.00)
    labor_cost = Column(Numeric(10, 2), nullable=False, default=0.00)
    line_total = Column(Numeric(10, 2), nullable=False, default=0.00)
    
    part_confidence = Column(Float, nullable=False, default=0.0)
    damage_confidence = Column(Float, nullable=False, default=0.0)
    is_structural_part = Column(Boolean, nullable=False, default=False)
    rate_row_found = Column(Boolean, nullable=False, default=True)
    unattributed = Column(Boolean, nullable=False, default=False)

    claim = relationship("Claim", back_populates="line_items")


class ClaimOverride(Base):
    __tablename__ = "claim_overrides"

    override_id = Column(String(64), primary_key=True, default=generate_uuid)
    claim_id = Column(String(64), ForeignKey("claims.claim_id"), nullable=False)
    surveyor_id = Column(String(50), nullable=False)
    previous_assessment = Column(JSON, nullable=False)
    override_data = Column(JSON, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    claim = relationship("Claim", back_populates="overrides")


class PhotoHashStore(Base):
    __tablename__ = "photo_hash_store"

    hash_id = Column(String(64), primary_key=True, default=generate_uuid)
    phash = Column(String(64), nullable=False, index=True)
    claim_id = Column(String(64), nullable=False)
    policy_id = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class User(Base):
    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False) # policyholder, surveyor, admin
    full_name = Column(String(100), nullable=False)
