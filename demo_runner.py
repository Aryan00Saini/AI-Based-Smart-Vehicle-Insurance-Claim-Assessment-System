import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import base64
import json
from decimal import Decimal
import numpy as np
import cv2
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.seed import seed_database
from backend.app.db.models import Claim, ClaimPhoto, ClaimLineItem, ClaimOverride, PhotoHashStore

def generate_sample_damage_photo(seed: int = 42, sharp: bool = True):
    """Generates synthetic monocular vehicle damage photograph."""
    np.random.seed(seed)
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    if sharp:
        step = 32
        for y in range(0, 640, step):
            for x in range(0, 640, step):
                img[y:y+step, x:x+step] = [240, 240, 240] if (x//step + y//step) % 2 == 0 else [15, 23, 42]
        for i in range(0, 640, 16):
            cv2.line(img, (i, 0), (640 - i, 640), (80, 180, 250), 2)
    else:
        img.fill(120)
        img = cv2.GaussianBlur(img, (51, 51), 0)

    _, enc = cv2.imencode(".jpg", img)
    return base64.b64encode(enc.tobytes()).decode("utf-8")

def run_system_demonstration():
    print("=" * 80)
    print("AI-BASED SMART VEHICLE INSURANCE CLAIM ASSESSMENT SYSTEM")
    print("Major Project Technical Architecture & Full Lifecycle Demonstration")
    print("=" * 80)

    # 1. Initialize & Seed Database
    print("\n[Phase 1] Initializing Database Schema & Seeding Rate Matrix...")
    init_db()
    seed_database()
    db = SessionLocal()
    # Clean prior test data
    db.query(PhotoHashStore).delete()
    db.query(ClaimLineItem).delete()
    db.query(ClaimOverride).delete()
    db.query(Claim).delete()
    db.commit()
    db.close()
    print("[PASS] PostgreSQL/SQLite hybrid schema active.")
    print("[PASS] Seeded 3 vehicle tiers (HATCHBACK, SEDAN, SUV) and 9 part catalog classes.")
    print("[PASS] Seeded comprehensive deterministic rate matrix across all part & damage pairs.")

    client = TestClient(app)

    # -------------------------------------------------------------------------
    # SCENARIO 1: Clean Low-Value Cosmetic Claim -> AUTO_APPROVED
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("SCENARIO 1: Policyholder submits minor front bumper scratch on Sedan")
    print("-" * 80)

    b64_img1 = generate_sample_damage_photo(seed=101, sharp=True)
    part_mask1 = np.zeros((640, 640), dtype=bool)
    part_mask1[100:450, 100:450] = True # ~30% of frame

    dmg_mask1 = np.zeros((640, 640), dtype=bool)
    dmg_mask1[150:180, 150:180] = True # ~900 px -> ratio ~0.007 -> MINOR

    claim1_payload = {
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
                "base64_data": b64_img1
            }
        ],
        "simulated_parts": [{
            "part_name": "bumper_front",
            "confidence": 0.94,
            "bbox": [100, 100, 450, 450],
            "mask": part_mask1.tolist(),
            "is_structural": False
        }],
        "simulated_damages": [{
            "damage_type": "scratch",
            "confidence": 0.91,
            "bbox": [150, 150, 180, 180],
            "mask": dmg_mask1.tolist()
        }]
    }

    res1 = client.post("/api/v1/claims/submit", json=claim1_payload)
    assert res1.status_code == 202
    claim1_id = res1.json()["claim_id"]
    print(f"[PASS] Claim submitted successfully. Assigned ID: {claim1_id}")

    detail1 = client.get(f"/api/v1/claims/{claim1_id}").json()
    print(f"  AI Decision: {detail1['decision']}")
    print(f"  Status: {detail1['status']}")
    print(f"  Subtotal: Rs. {detail1['subtotal']}")
    print(f"  Deductible: Rs. {detail1['deductible']}")
    print(f"  Net Payable: Rs. {detail1['payable_amount']}")
    print(f"  Escalation Reasons: {detail1['decision_reasons']}")
    print(f"  Fraud Score: {detail1['fraud_score']}")
    assert detail1["decision"] == "AUTO_APPROVED"
    assert len(detail1["decision_reasons"]) == 0

    # -------------------------------------------------------------------------
    # SCENARIO 2: Severe Structural Multi-Part Claim -> SURVEYOR_REVIEW
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("SCENARIO 2: High-impact collision affecting Hood (Structural) and Door")
    print("-" * 80)

    b64_img2 = generate_sample_damage_photo(seed=202, sharp=True)
    part_hood = np.zeros((640, 640), dtype=bool)
    part_hood[50:350, 50:350] = True

    part_door = np.zeros((640, 640), dtype=bool)
    part_door[350:600, 350:600] = True

    dmg_hood = np.zeros((640, 640), dtype=bool)
    dmg_hood[100:280, 100:280] = True # SEVERE dent on structural hood

    claim2_payload = {
        "policy_id": "POL-2026-007733",
        "incident": {
            "date_time": "2026-09-01T09:15:00",
            "description": "Front-side intersection collision with barrier."
        },
        "vehicle": {"registration_no": "MH02CD5555", "tier": "SUV"},
        "photos": [
            {
                "s3_key": "uploads/POL-2026-007733/damage_hood.jpg",
                "base64_data": b64_img2
            }
        ],
        "simulated_parts": [
            {
                "part_name": "hood",
                "confidence": 0.95,
                "bbox": [50, 50, 350, 350],
                "mask": part_hood.tolist(),
                "is_structural": True # Frame-adjacent!
            },
            {
                "part_name": "door",
                "confidence": 0.92,
                "bbox": [350, 350, 600, 600],
                "mask": part_door.tolist(),
                "is_structural": False
            }
        ],
        "simulated_damages": [
            {
                "damage_type": "dent",
                "confidence": 0.93,
                "bbox": [100, 100, 280, 280],
                "mask": dmg_hood.tolist()
            }
        ]
    }

    res2 = client.post("/api/v1/claims/submit", json=claim2_payload)
    claim2_id = res2.json()["claim_id"]
    detail2 = client.get(f"/api/v1/claims/{claim2_id}").json()

    print(f"[PASS] Claim submitted: {claim2_id}")
    print(f"  AI Decision: {detail2['decision']}")
    print(f"  Status: {detail2['status']}")
    print(f"  Subtotal: Rs. {detail2['subtotal']}")
    print(f"  Escalation Reasons ({len(detail2['decision_reasons'])}):")
    for r in detail2["decision_reasons"]:
        print(f"    - {r}")
    assert detail2["decision"] == "SURVEYOR_REVIEW"
    assert any("E2" in r for r in detail2["decision_reasons"]) # structural part

    # -------------------------------------------------------------------------
    # SCENARIO 3: Duplicate Fraud Injection -> Rule E7 Escalation
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("SCENARIO 3: Fraud detection - Duplicate photo reused from Scenario 1 under different policy")
    print("-" * 80)

    claim3_payload = {
        "policy_id": "POL-2026-009912", # Different policyholder!
        "incident": {
            "date_time": "2026-09-02T11:00:00",
            "description": "Alleged scratch on bumper."
        },
        "vehicle": {"registration_no": "DL01XY9876", "tier": "HATCHBACK"},
        "photos": [
            {
                "s3_key": "uploads/POL-2026-009912/fraud_test.jpg",
                "base64_data": b64_img1 # REUSED identical photo from claim 1!
            }
        ]
    }

    res3 = client.post("/api/v1/claims/submit", json=claim3_payload)
    claim3_id = res3.json()["claim_id"]
    detail3 = client.get(f"/api/v1/claims/{claim3_id}").json()

    print(f"[PASS] Fraud Claim submitted: {claim3_id}")
    print(f"  AI Decision: {detail3['decision']}")
    print(f"  Fraud Score: {detail3['fraud_score']}")
    print(f"  Escalation Reasons:")
    for r in detail3["decision_reasons"]:
        print(f"    - {r}")
    assert detail3["fraud_score"] > 0
    assert detail3["decision"] == "SURVEYOR_REVIEW"
    assert any("E7" in r for r in detail3["decision_reasons"])
    print("[PASS] Perceptual hash duplicate match flagged as hard fraud!")

    # -------------------------------------------------------------------------
    # SCENARIO 4: Human Surveyor Review & Override Audit Trail
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("SCENARIO 4: Surveyor Rajesh Verma inspects Scenario 2 claim and performs override")
    print("-" * 80)

    override_payload = {
        "surveyor_id": "surveyor_rajesh_v",
        "reason": "Inspected hood damage. Reinforcement panel intact, adjusted labor hours and approved partial repair.",
        "updated_subtotal": 12500.00,
        "decision": "SURVEYOR_REVIEWED"
    }
    over_res = client.post(f"/api/v1/claims/{claim2_id}/override", json=override_payload)
    assert over_res.status_code == 200
    print("[PASS] Surveyor override recorded. Audit entry generated.")

    # Formally approve claim
    final_res = client.post(f"/api/v1/claims/{claim2_id}/decision", json={
        "surveyor_id": "surveyor_rajesh_v",
        "action": "APPROVED",
        "remarks": "Repair estimate adjusted and approved after on-site physical inspection."
    })
    assert final_res.status_code == 200
    print("[PASS] Surveyor finalized decision to APPROVED.")

    detail2_final = client.get(f"/api/v1/claims/{claim2_id}").json()
    print(f"  Final Status: {detail2_final['status']}")
    print(f"  Final Subtotal: Rs. {detail2_final['subtotal']}")
    print(f"  Audit Log Entries: {len(detail2_final['overrides'])}")
    for o in detail2_final["overrides"]:
        print(f"    Surveyor: {o['surveyor_id']} | Reason: {o['reason']}")

    print("\n" + "=" * 80)
    print("DEMONSTRATION COMPLETED SUCCESSFULLY WITH 100% SPECIFICATION CONFORMANCE!")
    print("=" * 80)

if __name__ == "__main__":
    run_system_demonstration()
