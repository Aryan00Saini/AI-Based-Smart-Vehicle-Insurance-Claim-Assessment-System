import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal, init_db
from backend.app.db.seed import seed_database

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def init_test_env():
    init_db()
    seed_database()

def test_list_tiers():
    resp = client.get("/api/v1/rates/tiers")
    assert resp.status_code == 200
    tiers = resp.json()
    assert len(tiers) >= 3
    tier_names = [t["tier_name"] for t in tiers]
    assert "HATCHBACK" in tier_names
    assert "SEDAN" in tier_names
    assert "SUV" in tier_names

def test_list_parts():
    resp = client.get("/api/v1/rates/parts")
    assert resp.status_code == 200
    parts = resp.json()
    assert len(parts) >= 9
    part_codes = [p["part_code"] for p in parts]
    assert "bumper_front" in part_codes
    assert "hood" in part_codes

def test_get_rate_matrix():
    resp = client.get("/api/v1/rates/matrix?tier_name=SUV&part_code=bumper_front")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) > 0
    first = rows[0]
    assert first["tier_name"] == "SUV"
    assert first["part_code"] == "bumper_front"
    assert first["replace_cost_base"] > 0

def test_part_pricing_suggestions_single_part():
    resp = client.get("/api/v1/rates/part-pricing?tier_name=SUV&part_code=bumper_front")
    assert resp.status_code == 200
    data = resp.json()
    assert data["part_code"] == "bumper_front"
    assert data["vehicle_tier"] == "SUV"
    assert "options" in data
    
    oem = data["options"]["oem"]
    assert oem["type"] == "OEM Genuine"
    assert oem["part_cost"] == 7350.0  # 4200 * 1.75
    assert oem["labor_cost"] == 1750.0  # 2.5 hr * 700
    assert oem["total_cost"] == 9100.0

    aft = data["options"]["aftermarket"]
    assert aft["type"] == "Certified Aftermarket"
    assert aft["part_cost"] == round(7350.0 * 0.70, 2)
    assert aft["savings"] > 0

    rec = data["options"]["recycled"]
    assert rec["type"] == "Eco-Recycled OEM"
    assert rec["part_cost"] == round(7350.0 * 0.50, 2)

def test_part_pricing_suggestions_all_parts():
    resp = client.get("/api/v1/rates/part-pricing?tier_name=SEDAN")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 9
