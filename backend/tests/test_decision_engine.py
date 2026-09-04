import pytest
from decimal import Decimal
from backend.app.services.decision_engine import (
    evaluate_claim, Decision, ClaimAssessmentInput, LineItemInput
)

def make_clean_line_item(part="bumper_front", damage="scratch", sev="MINOR", is_structural=False, conf=0.92):
    return LineItemInput(
        part_name=part,
        damage_type=damage,
        severity_band=sev,
        decision="REPAIR",
        base_cost=Decimal("1200.00"),
        labor_hrs=Decimal("1.5"),
        labor_cost=Decimal("825.00"),
        line_total=Decimal("2025.00"),
        part_confidence=conf,
        damage_confidence=conf,
        is_structural_part=is_structural,
        rate_row_found=True,
        unattributed=False
    )

def test_auto_approved_clean_claim():
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("1025.00"),
        subtotal=Decimal("2025.00"),
        deductible=Decimal("1000.00"),
        line_items=[make_clean_line_item()]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.AUTO_APPROVED
    assert len(result.reasons) == 0

def test_rule_e1_unattributed_damage():
    # E1 trigger
    claim = ClaimAssessmentInput(
        unattributed_damage_present=True,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("1500.00"),
        line_items=[make_clean_line_item()]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E1" in r for r in result.reasons)

def test_rule_e2_structural_part():
    # E2 trigger: damaged part is structural (e.g. fender / hood)
    structural_item = make_clean_line_item(part="fender", is_structural=True)
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("1500.00"),
        line_items=[structural_item]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E2" in r for r in result.reasons)

def test_rule_e3_low_confidence():
    # E3 trigger: confidence < 0.80
    low_conf_item = make_clean_line_item(conf=0.74)
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("1500.00"),
        line_items=[low_conf_item]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E3" in r for r in result.reasons)

def test_rule_e4_more_than_two_distinct_parts():
    # E4 trigger: > 2 distinct parts damaged
    items = [
        make_clean_line_item(part="bumper_front"),
        make_clean_line_item(part="door"),
        make_clean_line_item(part="mirror")
    ]
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("3500.00"),
        line_items=items
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E4" in r for r in result.reasons)

def test_rule_e5_severe_damage():
    # E5 trigger: any line item graded SEVERE
    severe_item = make_clean_line_item(sev="SEVERE")
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("4500.00"),
        line_items=[severe_item]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E5" in r for r in result.reasons)

def test_rule_e6_payable_ceiling_exceeded():
    # E6 trigger: payable > Rs. 25,000
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("26000.00"),
        subtotal=Decimal("27000.00"),
        deductible=Decimal("1000.00"),
        line_items=[make_clean_line_item()]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E6" in r for r in result.reasons)

def test_rule_e7_fraud_score_fired():
    # E7 trigger: fraud_score > 0
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=1,
        total_payable=Decimal("1500.00"),
        line_items=[make_clean_line_item()]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E7" in r for r in result.reasons)

def test_rule_e8_missing_rate_row():
    # E8 trigger: missing rate matrix row
    missing_rate_item = make_clean_line_item()
    missing_rate_item.rate_row_found = False
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=True,
        fraud_score=0,
        total_payable=Decimal("1500.00"),
        line_items=[missing_rate_item]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E8" in r for r in result.reasons)

def test_rule_e9_photo_validation_failed():
    # E9 trigger: photo validation failed
    claim = ClaimAssessmentInput(
        unattributed_damage_present=False,
        photo_validation_passed=False,
        fraud_score=0,
        total_payable=Decimal("1500.00"),
        line_items=[make_clean_line_item()]
    )
    result = evaluate_claim(claim)
    assert result.decision == Decision.SURVEYOR_REVIEW
    assert any("E9" in r for r in result.reasons)
