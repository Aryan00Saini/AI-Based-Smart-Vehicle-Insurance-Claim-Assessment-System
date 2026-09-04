import io
import pytest
from datetime import datetime, timezone, timedelta
import numpy as np
import cv2
from PIL import Image
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.models import PhotoHashStore
from backend.app.services.photo_validator import photo_validator

@pytest.fixture(scope="module")
def db_session():
    init_db()
    db = SessionLocal()
    # Clean any leftover hashes
    db.query(PhotoHashStore).delete()
    db.commit()
    yield db
    db.close()

def create_synthetic_image(sharp: bool = True, seed: int = 42):
    """Generates synthetic image with sharp lines or blurred gradient using seed for unique hashes."""
    np.random.seed(seed)
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    if sharp:
        # High contrast checkerboard and random patterns
        step = 32 + (seed % 8)
        for y in range(0, 640, step):
            for x in range(0, 640, step):
                if (x // step + y // step) % 2 == 0:
                    img[y:y+step, x:x+step] = [255, 255, 255]
                else:
                    img[y:y+step, x:x+step] = [0, 0, 0]
        # Add high frequency lines
        for i in range(0, 640, 15):
            cv2.line(img, (i, 0), (640 - i, 640), (120, 200, 50), 2)
    else:
        img.fill(120)
        img = cv2.GaussianBlur(img, (51, 51), 0)

    _, enc = cv2.imencode(".jpg", img)
    return img, enc.tobytes()

def test_blur_detection_sharp_vs_blurred():
    sharp_img, _ = create_synthetic_image(sharp=True, seed=1)
    blur_score_sharp = photo_validator.calculate_blur_score(sharp_img)
    assert blur_score_sharp > 100.0

    blurry_img, _ = create_synthetic_image(sharp=False, seed=2)
    blur_score_blurry = photo_validator.calculate_blur_score(blurry_img)
    assert blur_score_blurry < 100.0

def test_vehicle_presence_check():
    img, _ = create_synthetic_image(sharp=True, seed=3)
    part_mask = np.zeros((640, 640), dtype=bool)
    part_mask[100:450, 100:450] = True # ~30%
    parts = [{"part_name": "door", "mask": part_mask}]

    present, coverage = photo_validator.check_vehicle_presence(img, parts)
    assert present is True
    assert coverage >= 0.15

    present_empty, _ = photo_validator.check_vehicle_presence(img, parts=[], simulated_presence=False)
    assert present_empty is False

def test_duplicate_photo_detection(db_session):
    img, bytes_data = create_synthetic_image(sharp=True, seed=10)
    phash_val = photo_validator.compute_phash(img)

    # Store hash in DB under Policy A
    store_record = PhotoHashStore(
        phash=phash_val,
        claim_id="CLAIM-EXISTING-001",
        policy_id="POL-POLICY-A",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(store_record)
    db_session.commit()

    # Case 1: Policy B submits identical image -> Fraud match!
    is_dup, matched_id, dist = photo_validator.check_duplicate_photos(
        db_session, phash_val, current_policy_id="POL-POLICY-B"
    )
    assert is_dup is True
    assert matched_id == "CLAIM-EXISTING-001"
    assert dist == 0

    # Case 2: Same policy resubmitting is permitted
    is_dup_same, _, _ = photo_validator.check_duplicate_photos(
        db_session, phash_val, current_policy_id="POL-POLICY-A"
    )
    assert is_dup_same is False

def test_exif_soft_gps_and_timestamp_anomaly():
    img, bytes_data = create_synthetic_image(sharp=True, seed=20)
    incident_time = datetime.now()
    res = photo_validator.inspect_exif(bytes_data, incident_time)

    assert res["has_gps"] is False
    assert res["gps_soft_signal"] is True
    assert res["suspicious_timestamp"] is False

def test_validate_photo_and_fraud_score_clean(db_session):
    # Unique seed so hash doesn't match POL-POLICY-A
    img, bytes_data = create_synthetic_image(sharp=True, seed=999)
    parts = [{"part_name": "bumper_front", "mask": np.ones((640, 640), dtype=bool)}]
    result = photo_validator.validate_photo_and_evaluate_fraud(
        db=db_session,
        img_bgr=img,
        image_bytes=bytes_data,
        policy_id="POL-CLEAN-001",
        detected_parts=parts
    )
    assert result["photo_validation_passed"] is True
    assert result["fraud_score"] == 0
    assert len(result["fraud_flags"]) == 0
