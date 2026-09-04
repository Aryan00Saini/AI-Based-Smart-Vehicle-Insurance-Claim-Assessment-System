from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class IncidentLocation(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None

class IncidentDetails(BaseModel):
    date_time: Optional[datetime] = None
    location: Optional[IncidentLocation] = None
    description: Optional[str] = None

class VehicleDetails(BaseModel):
    registration_no: str
    tier: str = "SEDAN" # HATCHBACK, SEDAN, SUV

class PhotoSubmission(BaseModel):
    s3_key: str
    base64_data: Optional[str] = None

class ClaimSubmissionRequest(BaseModel):
    policy_id: str
    incident: Optional[IncidentDetails] = None
    vehicle: VehicleDetails
    photos: List[PhotoSubmission] = []
    # Optional test simulation hooks
    simulated_parts: Optional[List[Dict[str, Any]]] = None
    simulated_damages: Optional[List[Dict[str, Any]]] = None

class LineItemResponse(BaseModel):
    line_id: Optional[str] = None
    part_name: str
    damage_type: str
    severity_band: str
    decision: str
    base_cost: Decimal
    labor_hrs: Decimal
    labor_cost: Decimal
    line_total: Decimal
    part_confidence: float = 0.0
    damage_confidence: float = 0.0
    is_structural_part: bool = False
    rate_row_found: bool = True
    unattributed: bool = False

class PhotoResponse(BaseModel):
    photo_id: str
    s3_key: str
    overlay_s3_key: Optional[str] = None
    blur_score: Optional[float] = None
    phash: Optional[str] = None
    exif_data: Optional[Dict[str, Any]] = None

class OverrideRequest(BaseModel):
    surveyor_id: str
    reason: str
    updated_line_items: Optional[List[Dict[str, Any]]] = None
    updated_subtotal: Optional[Decimal] = None
    updated_payable_amount: Optional[Decimal] = None
    decision: Optional[str] = None

class FinalDecisionRequest(BaseModel):
    surveyor_id: str
    action: str # "APPROVED" or "REJECTED"
    remarks: Optional[str] = None

class ClaimResponse(BaseModel):
    claim_id: str
    policy_id: str
    incident_date_time: Optional[datetime] = None
    incident_location_lat: Optional[float] = None
    incident_location_lng: Optional[float] = None
    incident_description: Optional[str] = None
    vehicle_reg_no: str
    vehicle_tier: str
    status: str
    ai_assessment_jsonb: Optional[Dict[str, Any]] = None
    subtotal: Decimal
    deductible: Decimal
    payable_amount: Decimal
    decision: Optional[str] = None
    decision_reasons: Optional[List[str]] = []
    fraud_score: int = 0
    photo_validation_passed: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    photos: List[PhotoResponse] = []
    line_items: List[LineItemResponse] = []
    overrides: List[Dict[str, Any]] = []
