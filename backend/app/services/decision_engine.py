from enum import Enum
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
from backend.app.core.config import settings

class Decision(str, Enum):
    AUTO_APPROVED = "AUTO_APPROVED"
    SURVEYOR_REVIEW = "SURVEYOR_REVIEW"

class LineItemInput(BaseModel):
    part_name: str
    damage_type: str
    severity_band: str # MINOR, MODERATE, SEVERE
    decision: str # REPAIR, REPLACE
    base_cost: Decimal = Decimal("0.00")
    labor_hrs: Decimal = Decimal("0.00")
    labor_cost: Decimal = Decimal("0.00")
    line_total: Decimal = Decimal("0.00")
    part_confidence: float = 0.90
    damage_confidence: float = 0.90
    is_structural_part: bool = False
    rate_row_found: bool = True
    unattributed: bool = False

class ClaimAssessmentInput(BaseModel):
    unattributed_damage_present: bool = False
    photo_validation_passed: bool = True
    fraud_score: int = 0
    total_payable: Decimal = Decimal("0.00")
    subtotal: Decimal = Decimal("0.00")
    deductible: Decimal = Decimal("0.00")
    line_items: List[LineItemInput] = []

class DecisionResult(BaseModel):
    decision: Decision
    reasons: List[str]

def evaluate_claim(claim: ClaimAssessmentInput) -> DecisionResult:
    """
    Deterministic rule-based evaluator implementing escalation rules E1 through E9.
    No probabilistic routing: clean claims matching cosmetic whitelist are AUTO_APPROVED,
    all others route to SURVEYOR_REVIEW with explicit explainable reasons.
    """
    reasons: List[str] = []

    # E1: Unattributed damage region detected
    if claim.unattributed_damage_present or any(li.unattributed or li.part_name == "UNATTRIBUTED" for li in claim.line_items):
        reasons.append("E1: unattributed damage region detected")

    # E2: Structural-adjacent part damaged
    if any(li.is_structural_part for li in claim.line_items):
        reasons.append("E2: structural-adjacent part damaged")

    # E3: Low model confidence on a line item (< 0.80)
    confidence_thresh = settings.MODEL_CONFIDENCE_THRESHOLD
    if any(li.part_confidence < confidence_thresh or li.damage_confidence < confidence_thresh for li in claim.line_items):
        reasons.append("E3: low model confidence on a line item")

    # E4: More than allowed number of distinct parts damaged (> 2)
    distinct_parts = {li.part_name for li in claim.line_items if li.part_name != "UNATTRIBUTED"}
    if len(distinct_parts) > settings.MAX_DISTINCT_PARTS_FOR_AUTO_APPROVE:
        reasons.append("E4: more than allowed number of distinct parts damaged")

    # E5: Severe damage present
    if any(li.severity_band == "SEVERE" for li in claim.line_items):
        reasons.append("E5: severe damage present")

    # E6: Total payable amount exceeds auto-approval ceiling (₹25,000)
    if claim.total_payable > settings.AUTO_APPROVE_CEILING:
        reasons.append("E6: payable amount exceeds auto-approve ceiling")

    # E7: Fraud heuristic flags fired
    if claim.fraud_score > 0:
        reasons.append("E7: fraud heuristic flags fired")

    # E8: Missing rate-matrix entry for a line item
    if any(not li.rate_row_found for li in claim.line_items):
        reasons.append("E8: missing rate-matrix entry for a line item")

    # E9: Photo validation failed
    if not claim.photo_validation_passed:
        reasons.append("E9: photo validation failed")

    # Additional Cosmetic Whitelist Enforcement
    for li in claim.line_items:
        if li.damage_type.lower() not in settings.COSMETIC_DAMAGE_WHITELIST:
            msg = f"Non-cosmetic damage type detected ({li.damage_type})"
            if msg not in reasons:
                reasons.append(msg)
        if li.severity_band.upper() not in settings.ALLOWED_SEVERITY_BANDS:
            msg = f"Non-cosmetic severity level ({li.severity_band})"
            if msg not in reasons:
                reasons.append(msg)

    # Empty claim safeguard
    if not claim.line_items and not reasons:
        reasons.append("No damage line items identified")

    decision = Decision.SURVEYOR_REVIEW if reasons else Decision.AUTO_APPROVED
    return DecisionResult(decision=decision, reasons=reasons)
