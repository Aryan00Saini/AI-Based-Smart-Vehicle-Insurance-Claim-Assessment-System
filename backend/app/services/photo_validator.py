import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import cv2
from PIL import Image
import imagehash
import exifread
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.db.models import PhotoHashStore

class PhotoValidator:
    def __init__(self):
        self.blur_threshold = settings.BLUR_LAPLACIAN_THRESHOLD
        self.hamming_threshold = settings.DUPLICATE_HASH_HAMMING_THRESHOLD
        self.min_vehicle_ratio = settings.MIN_VEHICLE_COVERAGE_RATIO

    def calculate_blur_score(self, img_bgr: np.ndarray) -> float:
        """Computes the Laplacian variance on the grayscale image. Lower means blurrier."""
        if img_bgr is None or img_bgr.size == 0:
            return 0.0
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return round(score, 2)

    def check_vehicle_presence(
        self,
        img_bgr: np.ndarray,
        parts: Optional[List[Dict[str, Any]]] = None,
        simulated_presence: Optional[bool] = None
    ) -> Tuple[bool, float]:
        """
        Validates whether a vehicle is present and covers a meaningful fraction of the frame.
        Uses detected parts coverage or vehicle contour estimation.
        """
        if simulated_presence is not None:
            return simulated_presence, 0.50 if simulated_presence else 0.02

        h, w = img_bgr.shape[:2]
        total_pixels = h * w
        if total_pixels == 0:
            return False, 0.0

        if parts and len(parts) > 0:
            combined_mask = np.zeros((h, w), dtype=bool)
            for p in parts:
                mask = np.asarray(p["mask"], dtype=bool)
                if mask.shape[:2] != (h, w):
                    mask = cv2.resize(mask.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST).astype(bool)
                combined_mask |= mask
            coverage = float(np.sum(combined_mask) / total_pixels)
            return coverage >= self.min_vehicle_ratio, round(coverage, 4)

        # Fallback: estimate vehicle contour/silhouette via edge and color variance
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 40, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return False, 0.0

        max_contour_area = max(cv2.contourArea(c) for c in contours)
        coverage = float(max_contour_area / total_pixels)
        return coverage >= 0.05, round(coverage, 4)

    def compute_phash(self, img_bgr: np.ndarray) -> str:
        """Computes 64-bit perceptual hash (pHash) string."""
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)
        h = imagehash.phash(pil_img)
        return str(h)

    def check_duplicate_photos(
        self,
        db: Session,
        current_phash: str,
        current_policy_id: str
    ) -> Tuple[bool, Optional[str], int]:
        """
        Checks current photo hash against stored hashes in photo_hash_store.
        If Hamming distance <= threshold against a DIFFERENT policyholder, returns duplicate flag.
        """
        if not current_phash:
            return False, None, 999

        curr_hash_obj = imagehash.hex_to_hash(current_phash)
        stored_hashes = db.query(PhotoHashStore).all()

        for stored in stored_hashes:
            stored_hash_obj = imagehash.hex_to_hash(stored.phash)
            distance = curr_hash_obj - stored_hash_obj # Hamming distance
            
            if distance <= self.hamming_threshold:
                # Match found! If different policy, hard fraud!
                if stored.policy_id != current_policy_id:
                    return True, stored.claim_id, distance

        return False, None, 999

    def inspect_exif(
        self,
        image_bytes: bytes,
        reported_incident_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Extracts EXIF metadata. Evaluates timestamp vs incident time plausibility.
        Missing GPS is treated as a soft signal (not hard flag).
        """
        tags = exifread.process_file(io.BytesIO(image_bytes), details=False)
        datetime_tag = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        gps_latitude = tags.get("GPS GPSLatitude")
        
        has_gps = gps_latitude is not None
        capture_dt = None
        suspicious_timestamp = False
        timestamp_reason = ""

        if datetime_tag:
            try:
                dt_str = str(datetime_tag).strip()
                # standard EXIF format: 'YYYY:MM:DD HH:MM:SS'
                capture_dt = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
                
                if reported_incident_time:
                    # Strip tzinfo for naive comparison
                    rep_naive = reported_incident_time.replace(tzinfo=None)
                    
                    # If captured more than 48 hours BEFORE the reported incident time, suspicious!
                    if capture_dt < rep_naive - timedelta(hours=48):
                        suspicious_timestamp = True
                        timestamp_reason = "Photo capture time is more than 48 hours prior to incident time."
                    # If captured well in the future, suspicious
                    elif capture_dt > datetime.now() + timedelta(days=1):
                        suspicious_timestamp = True
                        timestamp_reason = "Photo capture time is in the future."
            except Exception:
                capture_dt = None

        return {
            "has_exif": len(tags) > 0,
            "capture_datetime": capture_dt.isoformat() if capture_dt else None,
            "has_gps": has_gps,
            "gps_soft_signal": not has_gps, # Soft signal, not hard flag
            "suspicious_timestamp": suspicious_timestamp,
            "timestamp_reason": timestamp_reason
        }

    def validate_photo_and_evaluate_fraud(
        self,
        db: Session,
        img_bgr: np.ndarray,
        image_bytes: bytes,
        policy_id: str,
        reported_incident_time: Optional[datetime] = None,
        detected_parts: Optional[List[Dict[str, Any]]] = None,
        simulated_presence: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Performs full Module 5 pipeline:
        - Laplacian blur check
        - Vehicle presence validation
        - Perceptual hash duplicate detection
        - EXIF consistency evaluation
        - Additive explainable fraud score
        """
        validation_reasons = []
        fraud_flags = []

        # 1. Blur Detection
        blur_score = self.calculate_blur_score(img_bgr)
        is_blurry = blur_score < self.blur_threshold
        if is_blurry:
            validation_reasons.append(f"Image blurred: Laplacian variance {blur_score:.1f} < threshold {self.blur_threshold}")

        # 2. Vehicle Presence Check
        vehicle_present, coverage = self.check_vehicle_presence(
            img_bgr, detected_parts, simulated_presence=simulated_presence
        )
        if not vehicle_present:
            validation_reasons.append(f"Vehicle not detected or frame coverage too low ({coverage:.1%})")

        # 3. Duplicate Perceptual Hash Check
        phash_str = self.compute_phash(img_bgr)
        is_duplicate, matched_claim_id, hamming_dist = self.check_duplicate_photos(
            db, phash_str, policy_id
        )
        if is_duplicate:
            fraud_flags.append(f"Duplicate photo detected: matches claim {matched_claim_id} (Hamming dist: {hamming_dist})")

        # 4. EXIF Inspection
        exif_info = self.inspect_exif(image_bytes, reported_incident_time)
        if exif_info["suspicious_timestamp"]:
            fraud_flags.append(f"EXIF anomaly: {exif_info['timestamp_reason']}")

        photo_validation_passed = (len(validation_reasons) == 0)
        fraud_score = len(fraud_flags) # Additive integer score of hard flags

        return {
            "photo_validation_passed": photo_validation_passed,
            "validation_reasons": validation_reasons,
            "blur_score": blur_score,
            "phash": phash_str,
            "is_duplicate": is_duplicate,
            "matched_claim_id": matched_claim_id,
            "vehicle_present": vehicle_present,
            "vehicle_coverage": coverage,
            "exif": exif_info,
            "fraud_score": fraud_score,
            "fraud_flags": fraud_flags
        }

photo_validator = PhotoValidator()
