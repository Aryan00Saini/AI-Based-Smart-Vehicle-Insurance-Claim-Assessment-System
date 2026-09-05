from decimal import Decimal
from typing import Optional, List, Dict, Any
import numpy as np
import cv2
from sqlalchemy.orm import Session
from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    Claim, ClaimPhoto, ClaimLineItem, Policy, PhotoHashStore
)
from backend.app.services.storage import storage_service
from backend.app.services.photo_validator import photo_validator
from backend.app.services.cv_inference import cv_inference_engine
from backend.app.services.mask_fusion import (
    fuse_masks, generate_visual_overlay, deduplicate_cross_photo_line_items
)
from backend.app.services.cost_engine import calculate_claim_costs
from backend.app.services.decision_engine import (
    evaluate_claim, ClaimAssessmentInput, LineItemInput, Decision
)

def run_claim_assessment_pipeline(
    claim_id: str,
    simulated_parts: Optional[List[Dict[str, Any]]] = None,
    simulated_damages: Optional[List[Dict[str, Any]]] = None
):
    """
    Asynchronous background pipeline for claim assessment:
    1. Photo validation & fraud scoring (Module 5)
    2. Computer Vision inference on parts & damage (Module 1)
    3. Mask Fusion & severity grading (Module 1)
    4. Deterministic rate-matrix cost estimation (Module 2)
    5. Rule-based Decision Engine (Module 3)
    6. Database update and audit persistence (Module 4)
    """
    db: Session = SessionLocal()
    try:
        claim = db.query(Claim).filter_by(claim_id=claim_id).first()
        if not claim:
            print(f"[Orchestrator] Claim {claim_id} not found.")
            return

        claim.status = "PROCESSING"
        db.commit()

        # Get policy deductible
        policy = db.query(Policy).filter_by(policy_id=claim.policy_id).first()
        deductible = policy.deductible if policy else claim.deductible or Decimal("1000.00")
        claim.deductible = deductible

        all_fused_line_items = []
        any_unattributed = False
        photo_validation_passed = True
        accumulated_fraud_score = 0
        fraud_reasons = []

        # Process each submitted photo
        for photo in claim.photos:
            try:
                # Read photo bytes from storage
                img_bytes = storage_service.get_file(photo.s3_key)
                img_arr = np.frombuffer(img_bytes, dtype=np.uint8)
                img_bgr = cv2.imdecode(img_arr, cv2.IMREAD_COLOR)

                if img_bgr is None:
                    # Fallback blank image
                    img_bgr = np.zeros((640, 640, 3), dtype=np.uint8)

                # 1. CV Inference
                parts = cv_inference_engine.run_part_inference(
                    img_bgr, simulated_parts=simulated_parts
                )
                damages = cv_inference_engine.run_damage_inference(
                    img_bgr, simulated_damage=simulated_damages
                )

                # 2. Photo validation & fraud heuristics
                val_res = photo_validator.validate_photo_and_evaluate_fraud(
                    db=db,
                    img_bgr=img_bgr,
                    image_bytes=img_bytes,
                    policy_id=claim.policy_id,
                    reported_incident_time=claim.incident_date_time,
                    detected_parts=parts
                )

                photo.blur_score = val_res["blur_score"]
                photo.phash = val_res["phash"]
                photo.exif_data = val_res["exif"]

                if not val_res["photo_validation_passed"]:
                    photo_validation_passed = False

                if val_res["fraud_score"] > 0:
                    accumulated_fraud_score += val_res["fraud_score"]
                    fraud_reasons.extend(val_res["fraud_flags"])

                # Store perceptual hash for future duplicate detection
                if val_res["photo_validation_passed"] and not val_res["is_duplicate"] and photo.phash:
                    hash_rec = PhotoHashStore(
                        phash=photo.phash,
                        claim_id=claim.claim_id,
                        policy_id=claim.policy_id
                    )
                    db.add(hash_rec)

                # 3. Mask Fusion
                fusion_res = fuse_masks(parts, damages)
                if fusion_res["unattributed_damage_present"]:
                    any_unattributed = True

                all_fused_line_items.extend(fusion_res["line_items"])

                # 4. Generate Visual Overlay
                overlay_bgr = generate_visual_overlay(img_bgr, parts, fusion_res["line_items"])
                _, enc_overlay = cv2.imencode(".jpg", overlay_bgr)
                overlay_key = f"overlays/{claim.claim_id}/{photo.photo_id}.jpg"
                storage_service.put_file(enc_overlay.tobytes(), overlay_key, "image/jpeg")
                photo.overlay_s3_key = overlay_key

            except Exception as e:
                print(f"[Orchestrator] Error processing photo {photo.photo_id}: {e}")
                photo_validation_passed = False

        # Cross-photo deduplication: merge line items representing the same damage
        all_fused_line_items = deduplicate_cross_photo_line_items(all_fused_line_items)

        # 5. Deterministic Cost Estimation
        cost_res = calculate_claim_costs(
            db=db,
            vehicle_tier_name=claim.vehicle_tier,
            fused_line_items=all_fused_line_items,
            deductible=deductible
        )

        # 6. Decision Engine Evaluation
        assessment_input = ClaimAssessmentInput(
            unattributed_damage_present=any_unattributed,
            photo_validation_passed=photo_validation_passed,
            fraud_score=accumulated_fraud_score,
            total_payable=cost_res["payable_amount"],
            subtotal=cost_res["subtotal"],
            deductible=cost_res["deductible"],
            line_items=[
                LineItemInput(
                    part_name=li["part_name"],
                    damage_type=li["damage_type"],
                    severity_band=li["severity_band"],
                    decision=li["decision"],
                    base_cost=li["base_cost"],
                    labor_hrs=li["labor_hrs"],
                    labor_cost=li["labor_cost"],
                    line_total=li["line_total"],
                    part_confidence=li["part_confidence"],
                    damage_confidence=li["damage_confidence"],
                    is_structural_part=li["is_structural_part"],
                    rate_row_found=li["rate_row_found"],
                    unattributed=li["unattributed"]
                )
                for li in cost_res["line_items"]
            ]
        )

        decision_res = evaluate_claim(assessment_input)

        # 7. Persist Line Items
        # Clear existing line items if any
        db.query(ClaimLineItem).filter_by(claim_id=claim.claim_id).delete()
        for li in cost_res["line_items"]:
            db_li = ClaimLineItem(
                claim_id=claim.claim_id,
                part_name=li["part_name"],
                damage_type=li["damage_type"],
                severity_band=li["severity_band"],
                decision=li["decision"],
                base_cost=li["base_cost"],
                labor_hrs=li["labor_hrs"],
                labor_cost=li["labor_cost"],
                line_total=li["line_total"],
                part_confidence=li["part_confidence"],
                damage_confidence=li["damage_confidence"],
                is_structural_part=li["is_structural_part"],
                rate_row_found=li["rate_row_found"],
                unattributed=li["unattributed"]
            )
            db.add(db_li)

        # 8. Build JSONB Assessment Contract matching specification
        ai_assessment_jsonb = {
            "line_items": [
                {
                    "part_name": li["part_name"],
                    "damage_type": li["damage_type"],
                    "severity_band": li["severity_band"],
                    "decision": li["decision"],
                    "line_total": str(li["line_total"])
                }
                for li in cost_res["line_items"]
            ],
            "subtotal": str(cost_res["subtotal"]),
            "deductible": str(cost_res["deductible"]),
            "payable_amount": str(cost_res["payable_amount"]),
            "decision": decision_res.decision.value,
            "decision_reasons": decision_res.reasons
        }

        # 9. Update Claim fields
        claim.subtotal = cost_res["subtotal"]
        claim.payable_amount = cost_res["payable_amount"]
        claim.decision = decision_res.decision.value
        claim.decision_reasons = decision_res.reasons
        claim.fraud_score = accumulated_fraud_score
        claim.photo_validation_passed = photo_validation_passed
        claim.ai_assessment_jsonb = ai_assessment_jsonb
        
        # Set status
        if decision_res.decision == Decision.AUTO_APPROVED:
            claim.status = "APPROVED"
        else:
            claim.status = "ASSESSED"

        db.commit()
        print(f"[Orchestrator] Claim {claim_id} assessment finished. Decision: {claim.decision}")

    except Exception as e:
        print(f"[Orchestrator] Error assessing claim {claim_id}: {e}")
        db.rollback()
    finally:
        db.close()
