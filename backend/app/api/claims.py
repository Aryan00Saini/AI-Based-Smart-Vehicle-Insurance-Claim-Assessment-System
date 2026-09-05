import base64
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import Claim, ClaimPhoto, ClaimLineItem, ClaimOverride, Policy
from backend.app.schemas.claim import (
    ClaimSubmissionRequest, ClaimResponse, OverrideRequest, FinalDecisionRequest
)
from backend.app.services.storage import storage_service
from backend.app.services.orchestrator import run_claim_assessment_pipeline
from backend.app.core.config import settings

router = APIRouter(prefix="/claims", tags=["Claims"])

@router.post("/submit", status_code=status.HTTP_202_ACCEPTED)
def submit_claim(
    request: ClaimSubmissionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submits a vehicle insurance claim. Returns 202 Accepted.
    Assessment executes asynchronously via FastAPI BackgroundTasks.
    """
    claim_id = str(uuid.uuid4())

    # Check policy deductible
    policy = db.query(Policy).filter_by(policy_id=request.policy_id).first()
    deductible = policy.deductible if policy else Decimal("1000.00")

    inc_dt = request.incident.date_time if request.incident else None
    inc_lat = request.incident.location.lat if (request.incident and request.incident.location) else None
    inc_lng = request.incident.location.lng if (request.incident and request.incident.location) else None
    inc_desc = request.incident.description if request.incident else None

    claim = Claim(
        claim_id=claim_id,
        policy_id=request.policy_id,
        incident_date_time=inc_dt,
        incident_location_lat=inc_lat,
        incident_location_lng=inc_lng,
        incident_description=inc_desc,
        vehicle_reg_no=request.vehicle.registration_no,
        vehicle_tier=request.vehicle.tier.upper(),
        status="SUBMITTED",
        deductible=deductible,
        subtotal=Decimal("0.00"),
        payable_amount=Decimal("0.00")
    )
    db.add(claim)
    db.flush()

    # Save photos
    for p in request.photos:
        s3_key = p.s3_key
        if p.base64_data:
            # Decode and write to storage
            try:
                img_data = base64.b64decode(p.base64_data)
                storage_service.put_file(img_data, s3_key, "image/jpeg")
            except Exception as e:
                print(f"[API] Error writing base64 image: {e}")
        elif not storage_service.file_exists(s3_key):
            # Create a blank image file if not present for test simulation
            blank_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
            storage_service.put_file(blank_jpg, s3_key, "image/jpeg")

        photo_rec = ClaimPhoto(
            claim_id=claim_id,
            s3_key=s3_key
        )
        db.add(photo_rec)

    db.commit()

    # Trigger async background assessment
    background_tasks.add_task(
        run_claim_assessment_pipeline,
        claim_id=claim_id,
        simulated_parts=request.simulated_parts,
        simulated_damages=request.simulated_damages
    )

    return {
        "claim_id": claim_id,
        "status": "SUBMITTED",
        "message": "Claim received and queued for automated assessment."
    }

@router.post("/submit-multipart", status_code=status.HTTP_202_ACCEPTED)
async def submit_claim_multipart(
    background_tasks: BackgroundTasks,
    policy_id: str = Form(...),
    registration_no: str = Form(...),
    vehicle_tier: str = Form("SEDAN"),
    incident_description: Optional[str] = Form(None),
    incident_date_time: Optional[str] = Form(None),
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Submits claim via multipart/form-data with uploaded photo files."""
    claim_id = str(uuid.uuid4())

    policy = db.query(Policy).filter_by(policy_id=policy_id).first()
    deductible = policy.deductible if policy else Decimal("1000.00")

    inc_dt = None
    if incident_date_time:
        try:
            inc_dt = datetime.fromisoformat(incident_date_time)
        except Exception:
            inc_dt = datetime.now(timezone.utc)

    claim = Claim(
        claim_id=claim_id,
        policy_id=policy_id,
        incident_date_time=inc_dt,
        incident_description=incident_description,
        vehicle_reg_no=registration_no,
        vehicle_tier=vehicle_tier.upper(),
        status="SUBMITTED",
        deductible=deductible
    )
    db.add(claim)
    db.flush()

    max_bytes = settings.MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024

    for idx, upload in enumerate(photos):
        content = await upload.read()

        if len(content) > max_bytes:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=(
                    f"Photo '{upload.filename}' is "
                    f"{len(content) / (1024 * 1024):.1f}MB, which exceeds the "
                    f"{settings.MAX_UPLOAD_FILE_SIZE_MB}MB limit per photo."
                )
            )

        content_type = (upload.content_type or "").lower()
        if content_type not in settings.ALLOWED_UPLOAD_CONTENT_TYPES:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Photo '{upload.filename}' has unsupported type "
                    f"'{content_type or 'unknown'}'. Allowed types: "
                    f"{', '.join(settings.ALLOWED_UPLOAD_CONTENT_TYPES)}."
                )
            )

        s3_key = f"uploads/{policy_id}/{claim_id}_{idx}_{upload.filename}"
        storage_service.put_file(content, s3_key, upload.content_type or "image/jpeg")

        photo_rec = ClaimPhoto(
            claim_id=claim_id,
            s3_key=s3_key
        )
        db.add(photo_rec)

    db.commit()

    background_tasks.add_task(
        run_claim_assessment_pipeline,
        claim_id=claim_id
    )

    return {
        "claim_id": claim_id,
        "status": "SUBMITTED",
        "message": f"Claim received with {len(photos)} photo(s) and queued for assessment."
    }

@router.get("/", response_model=List[ClaimResponse])
def list_claims(status_filter: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists claims with optional status filtering."""
    query = db.query(Claim)
    if status_filter:
        query = query.filter(Claim.status == status_filter.upper())
    claims = query.order_by(Claim.created_at.desc()).all()
    
    res = []
    for c in claims:
        res.append(ClaimResponse(
            claim_id=c.claim_id,
            policy_id=c.policy_id,
            incident_date_time=c.incident_date_time,
            incident_location_lat=c.incident_location_lat,
            incident_location_lng=c.incident_location_lng,
            incident_description=c.incident_description,
            vehicle_reg_no=c.vehicle_reg_no,
            vehicle_tier=c.vehicle_tier,
            status=c.status,
            ai_assessment_jsonb=c.ai_assessment_jsonb,
            subtotal=c.subtotal,
            deductible=c.deductible,
            payable_amount=c.payable_amount,
            decision=c.decision,
            decision_reasons=c.decision_reasons or [],
            fraud_score=c.fraud_score,
            photo_validation_passed=c.photo_validation_passed,
            created_at=c.created_at,
            updated_at=c.updated_at,
            photos=[
                {
                    "photo_id": p.photo_id,
                    "s3_key": p.s3_key,
                    "overlay_s3_key": p.overlay_s3_key,
                    "blur_score": p.blur_score,
                    "phash": p.phash,
                    "exif_data": p.exif_data
                }
                for p in c.photos
            ],
            line_items=[
                {
                    "line_id": li.line_id,
                    "part_name": li.part_name,
                    "damage_type": li.damage_type,
                    "severity_band": li.severity_band,
                    "decision": li.decision,
                    "base_cost": li.base_cost,
                    "labor_hrs": li.labor_hrs,
                    "labor_cost": li.labor_cost,
                    "line_total": li.line_total,
                    "part_confidence": li.part_confidence,
                    "damage_confidence": li.damage_confidence,
                    "is_structural_part": li.is_structural_part,
                    "rate_row_found": li.rate_row_found,
                    "unattributed": li.unattributed
                }
                for li in c.line_items
            ],
            overrides=[
                {
                    "override_id": o.override_id,
                    "surveyor_id": o.surveyor_id,
                    "previous_assessment": o.previous_assessment,
                    "override_data": o.override_data,
                    "reason": o.reason,
                    "created_at": o.created_at.isoformat() if o.created_at else None
                }
                for o in c.overrides
            ]
        ))
    return res

@router.get("/{claim_id}", response_model=ClaimResponse)
def get_claim_detail(claim_id: str, db: Session = Depends(get_db)):
    """Retrieves full claim detail, assessment, line items, and audit trail."""
    c = db.query(Claim).filter_by(claim_id=claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")

    return ClaimResponse(
        claim_id=c.claim_id,
        policy_id=c.policy_id,
        incident_date_time=c.incident_date_time,
        incident_location_lat=c.incident_location_lat,
        incident_location_lng=c.incident_location_lng,
        incident_description=c.incident_description,
        vehicle_reg_no=c.vehicle_reg_no,
        vehicle_tier=c.vehicle_tier,
        status=c.status,
        ai_assessment_jsonb=c.ai_assessment_jsonb,
        subtotal=c.subtotal,
        deductible=c.deductible,
        payable_amount=c.payable_amount,
        decision=c.decision,
        decision_reasons=c.decision_reasons or [],
        fraud_score=c.fraud_score,
        photo_validation_passed=c.photo_validation_passed,
        created_at=c.created_at,
        updated_at=c.updated_at,
        photos=[
            {
                "photo_id": p.photo_id,
                "s3_key": p.s3_key,
                "overlay_s3_key": p.overlay_s3_key,
                "blur_score": p.blur_score,
                "phash": p.phash,
                "exif_data": p.exif_data
            }
            for p in c.photos
        ],
        line_items=[
            {
                "line_id": li.line_id,
                "part_name": li.part_name,
                "damage_type": li.damage_type,
                "severity_band": li.severity_band,
                "decision": li.decision,
                "base_cost": li.base_cost,
                "labor_hrs": li.labor_hrs,
                "labor_cost": li.labor_cost,
                "line_total": li.line_total,
                "part_confidence": li.part_confidence,
                "damage_confidence": li.damage_confidence,
                "is_structural_part": li.is_structural_part,
                "rate_row_found": li.rate_row_found,
                "unattributed": li.unattributed
            }
            for li in c.line_items
        ],
        overrides=[
            {
                "override_id": o.override_id,
                "surveyor_id": o.surveyor_id,
                "previous_assessment": o.previous_assessment,
                "override_data": o.override_data,
                "reason": o.reason,
                "created_at": o.created_at.isoformat() if o.created_at else None
            }
            for o in c.overrides
        ]
    )

@router.post("/{claim_id}/override")
def record_surveyor_override(
    claim_id: str,
    request: OverrideRequest,
    db: Session = Depends(get_db)
):
    """
    Surveyor overrides AI assessment: adjusts line items or financial totals,
    records surveyor ID, and preserves previous assessment state in claim_overrides.
    """
    c = db.query(Claim).filter_by(claim_id=claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Snapshot current state for audit trail
    previous_state = {
        "status": c.status,
        "decision": c.decision,
        "subtotal": str(c.subtotal),
        "deductible": str(c.deductible),
        "payable_amount": str(c.payable_amount),
        "line_items": [
            {
                "line_id": li.line_id,
                "part_name": li.part_name,
                "damage_type": li.damage_type,
                "severity_band": li.severity_band,
                "decision": li.decision,
                "line_total": str(li.line_total)
            }
            for li in c.line_items
        ]
    }

    override_data = {}

    # Update line items if provided
    if request.updated_line_items:
        new_subtotal = Decimal("0.00")
        for updated in request.updated_line_items:
            line_id = updated.get("line_id")
            if line_id:
                li = db.query(ClaimLineItem).filter_by(line_id=line_id, claim_id=claim_id).first()
                if li:
                    if "decision" in updated:
                        li.decision = updated["decision"]
                    if "base_cost" in updated:
                        li.base_cost = Decimal(str(updated["base_cost"]))
                    if "labor_hrs" in updated:
                        li.labor_hrs = Decimal(str(updated["labor_hrs"]))
                    if "labor_cost" in updated:
                        li.labor_cost = Decimal(str(updated["labor_cost"]))
                    if "line_total" in updated:
                        li.line_total = Decimal(str(updated["line_total"]))
                    new_subtotal += li.line_total
        
        c.subtotal = new_subtotal
        c.payable_amount = max(new_subtotal - c.deductible, Decimal("0.00"))
        override_data["updated_line_items"] = request.updated_line_items
        override_data["recalculated_subtotal"] = str(c.subtotal)
        override_data["recalculated_payable"] = str(c.payable_amount)

    if request.updated_subtotal is not None:
        c.subtotal = request.updated_subtotal
        c.payable_amount = max(c.subtotal - c.deductible, Decimal("0.00"))
        override_data["forced_subtotal"] = str(request.updated_subtotal)

    if request.decision:
        c.decision = request.decision
        override_data["decision"] = request.decision

    c.status = "SURVEYOR_REVIEWED"

    # Save to claim_overrides table
    override_record = ClaimOverride(
        claim_id=claim_id,
        surveyor_id=request.surveyor_id,
        previous_assessment=previous_state,
        override_data=override_data,
        reason=request.reason
    )
    db.add(override_record)
    db.commit()

    return {
        "status": "success",
        "message": "Surveyor override recorded with full audit trail.",
        "override_id": override_record.override_id
    }

@router.post("/{claim_id}/decision")
def finalize_claim_decision(
    claim_id: str,
    request: FinalDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Surveyor records final approval or rejection.
    """
    c = db.query(Claim).filter_by(claim_id=claim_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")

    action = request.action.upper()
    if action not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Action must be APPROVED or REJECTED")

    previous_status = c.status
    c.status = action
    c.decision = action

    # Record decision in audit trail
    override_record = ClaimOverride(
        claim_id=claim_id,
        surveyor_id=request.surveyor_id,
        previous_assessment={"status": previous_status, "decision": c.decision},
        override_data={"final_action": action, "remarks": request.remarks},
        reason=request.remarks or f"Surveyor finalized decision: {action}"
    )
    db.add(override_record)
    db.commit()

    return {
        "status": "success",
        "claim_id": claim_id,
        "final_status": c.status,
        "message": f"Claim finalized to {c.status}."
    }
