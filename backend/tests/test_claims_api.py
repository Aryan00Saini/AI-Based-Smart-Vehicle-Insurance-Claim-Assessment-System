import base64
import time
import pytest
from decimal import Decimal
import numpy as np
import cv2
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.seed import seed_database
from backend.app.db.models import Claim, ClaimLineItem, ClaimOverride, PhotoHashStore

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def init_test_env():
    init_db()
    seed_database()
    db = SessionLocal()
    # Clean test claims
    db.query(PhotoHashStore).delete()
    db.query(ClaimLineItem).delete()
    db.query(ClaimOverride).delete()
    db.query(Claim).delete()
    db.commit()
    db.close()

def make_test_photo_base64(seed=42):
    np.random.seed(seed)
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    for y in range(0, 640, 32):
        for x in range(0, 640, 32):
            img[y:y+32, x:x+32] = [255, 255, 255] if (x//32 + y//32) % 2 == 0 else [0, 0, 0]
    for i in range(0, 640, 15):
        cv2.line(img, (i, 0), (640 - i, 640), (120, 200, 50), 2)
    _, enc = cv2.imencode(".jpg", img)
    return base64.b64encode(enc.tobytes()).decode("utf-8")

def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

def test_auth_login():
    resp = client.post("/api/v1/auth/login", json={"username": "surveyor1", "password": "surveyor123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "surveyor"

def test_submit_claim_and_assessment_pipeline():
    b64_img = make_test_photo_base64(seed=101)
    
    # Simulate a minor bumper scratch covering 25% of frame
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[100:420, 100:420] = True # 102,400 px (~25% of frame)
    sim_parts = [{
        "part_name": "bumper_front",
        "confidence": 0.94,
        "bbox": [100, 100, 420, 420],
        "mask": part_mask.tolist(),
        "is_structural": False
    }]

    dmg_mask = np.zeros((640, 640), dtype=bool)
    dmg_mask[150:190, 150:190] = True # 1,600 px (ratio: 1600 / 102400 = 0.015 -> MINOR)
    sim_damages = [{
        "damage_type": "scratch",
        "confidence": 0.92,
        "bbox": [150, 150, 190, 190],
        "mask": dmg_mask.tolist()
    }]

    payload = {
        "policy_id": "POL-2026-004821",
        "incident": {
            "date_time": "2026-08-30T14:22:00",
            "location": {"lat": 30.3165, "lng": 78.0322},
            "description": "Reversed into a pole in parking lot, minor bumper scrape."
        },
        "vehicle": {"registration_no": "UK07AB1234", "tier": "SEDAN"},
        "photos": [
            {
                "s3_key": "uploads/POL-2026-004821/front_bumper_1.jpg",
                "base64_data": b64_img
            }
        ],
        "simulated_parts": sim_parts,
        "simulated_damages": sim_damages
    }

    # 1. Submit claim (background task processes it)
    resp = client.post("/api/v1/claims/submit", json=payload)
    assert resp.status_code == 202
    claim_id = resp.json()["claim_id"]
    assert claim_id is not None

    # 2. Retrieve claim detail
    detail_resp = client.get(f"/api/v1/claims/{claim_id}")
    assert detail_resp.status_code == 200
    claim_data = detail_resp.json()

    assert claim_data["decision"] == "AUTO_APPROVED"
    assert claim_data["status"] in ["ASSESSED", "APPROVED"]
    assert len(claim_data["decision_reasons"]) == 0
    assert len(claim_data["line_items"]) == 1
    assert claim_data["line_items"][0]["part_name"] == "bumper_front"
    assert claim_data["line_items"][0]["damage_type"] == "scratch"
    assert claim_data["line_items"][0]["severity_band"] == "MINOR"
    assert claim_data["line_items"][0]["decision"] == "REPAIR"

    # Verify AI assessment JSONB contract from report
    ai_jsonb = claim_data["ai_assessment_jsonb"]
    assert ai_jsonb is not None
    assert "line_items" in ai_jsonb
    assert "subtotal" in ai_jsonb
    assert "deductible" in ai_jsonb
    assert "payable_amount" in ai_jsonb
    assert ai_jsonb["decision"] == "AUTO_APPROVED"

def test_surveyor_override_and_decision_lifecycle():
    b64_img = make_test_photo_base64(seed=202)
    payload = {
        "policy_id": "POL-2026-004821",
        "vehicle": {"registration_no": "UK07AB1234", "tier": "SEDAN"},
        "photos": [{"s3_key": "uploads/test_override.jpg", "base64_data": b64_img}]
    }
    resp = client.post("/api/v1/claims/submit", json=payload)
    claim_id = resp.json()["claim_id"]

    # Surveyor override
    override_payload = {
        "surveyor_id": "surveyor1",
        "reason": "Adjusted labor hours due to panel buffing requirement.",
        "updated_subtotal": 2200.00,
        "decision": "SURVEYOR_REVIEWED"
    }
    over_resp = client.post(f"/api/v1/claims/{claim_id}/override", json=override_payload)
    assert over_resp.status_code == 200

    # Verify override recorded in DB
    detail_resp = client.get(f"/api/v1/claims/{claim_id}")
    claim_data = detail_resp.json()
    assert claim_data["status"] == "SURVEYOR_REVIEWED"
    assert float(claim_data["subtotal"]) == 2200.00
    assert len(claim_data["overrides"]) == 1
    assert claim_data["overrides"][0]["surveyor_id"] == "surveyor1"

    # Surveyor final approval
    dec_resp = client.post(f"/api/v1/claims/{claim_id}/decision", json={
        "surveyor_id": "surveyor1",
        "action": "APPROVED",
        "remarks": "Claim verified and formally approved for settlement."
    })
    assert dec_resp.status_code == 200
    assert dec_resp.json()["final_status"] == "APPROVED"

    final_resp = client.get(f"/api/v1/claims/{claim_id}")
    assert final_resp.json()["status"] == "APPROVED"
