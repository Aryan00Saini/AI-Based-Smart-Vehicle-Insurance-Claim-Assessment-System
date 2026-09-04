# AI-Based Smart Vehicle Insurance Claim Assessment System

An end-to-end autonomous software engineering and machine learning system for vehicle insurance damage detection, deterministic cost estimation, automated fraud forensics, and human-in-the-loop surveyor claims auditing.

---

## 🚀 Key Features

1. **Dual Independent Vision Segmentation Models (ONNX Runtime)**:
   - **Model 1 (Vehicle Parts)**: Localizes 9 critical automotive body panels (`bumper_front`, `bumper_rear`, `door`, `fender`, `headlamp`, `taillamp`, `mirror`, `hood`, `windshield`).
   - **Model 2 (Damage Types)**: Detects 6 classes of damage (`scratch`, `dent`, `crack`, `shatter`, `paint_chip`, `misalignment`).
   - **Dual-Path Dent & Scratch Edge Localizer**: Utilizes morphological Black-Hat concavity analysis combined with Laplacian gradient boundary detection.

2. **Deterministic Geometric Mask Fusion**:
   - Computes `Damage Area / Part Area` intersection ratios.
   - Assigns severity bands (`MINOR`, `MODERATE`, `SEVERE`) using weighted damage coefficients without probabilistic hallucinations.

3. **Purely Deterministic Rate Matrix & Cost Engine**:
   - Cost calculation is evaluated strictly against a relational database rate matrix (`VehicleTier`, `PartCatalog`, `RateMatrix`).
   - Vehicle tier-based pricing multipliers: Hatchback (`1.0×`), Sedan (`1.35×`), SUV (`1.75×`).
   - Deductible calculation and repair vs. replacement evaluation.

4. **Deterministic Escalation Rules Engine (E1–E9)**:
   - **E1**: Unattributed damage (damage detected outside any localized part boundary).
   - **E2**: Structural or critical panel damage (e.g., hood, fender, frame).
   - **E3**: Low detection confidence (<0.80).
   - **E4**: High-impact collision (>2 distinct damaged panels).
   - **E5**: Severe damage band present.
   - **E6**: Total claim amount exceeds statutory auto-approval ceiling (₹25,000.00).
   - **E7**: Anti-fraud heuristics fired.
   - **E8**: Rate matrix missing row fallback.
   - **E9**: Photo validation failure.

5. **Multi-Layer Fraud & Forensics Inspection**:
   - **Sharpness Check**: Laplacian variance blur scoring ($<100.0$ rejected).
   - **Vehicle Presence**: Minimum vehicle coverage ratio verification.
   - **Perceptual Hash Deduplication**: 64-bit image pHash Hamming distance tracking to reject reused photos across different claims.
   - **EXIF Plausibility**: Timestamp anomaly and GPS verification.

6. **Parts Pricing Advisor & Replacement Catalog**:
   - Interactive lookup API (`GET /api/v1/rates/part-pricing`) offering:
     - **OEM Factory Genuine** (Authentic manufacturer parts with 24-month warranty)
     - **Certified Aftermarket** (ARAI/CAPA certified with 30% discount on base part pricing)
     - **Eco-Recycled OEM** (Grade-A inspected green parts with 50% discount)
   - One-click price application and audit note synchronization in the review portal.

7. **Human-in-the-Loop Surveyor Portal (React + Vite + Tailwind CSS)**:
   - Visual inspection annotator toggling between raw evidence and AI segmentation overlays.
   - Inline surveyor override editor for decision actions (`REPAIR` ↔ `REPLACE`), labor, and pricing.
   - Full auditable history in `claim_overrides`.
   - Surveyor sign-off for formal approval or rejection.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite / PostgreSQL
- **Computer Vision & ML**: ONNX Runtime, OpenCV, NumPy
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Testing**: Pytest (38 automated unit & integration tests)

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route controllers (claims, rates, auth)
│   │   ├── core/         # Config, thresholds, security (bcrypt & JWT)
│   │   ├── db/           # SQLAlchemy models, database connection & seed data
│   │   ├── schemas/      # Pydantic data contracts
│   │   ├── services/     # CV inference, mask fusion, cost engine, decision engine, fraud
│   │   └── main.py       # FastAPI application entrypoint
│   └── tests/            # 38 pytest test suites
├── data/
│   ├── models/           # ONNX model files (parts and damage models)
│   └── storage/          # Local file storage for uploads and overlay renders
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components (Dashboard, Annotator, CostBreakdown, Modals)
│   │   ├── pages/        # SurveyorDashboard & SubmitClaimPage
│   │   ├── services/     # API client
│   │   └── types.ts      # TypeScript interfaces
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── demo_runner.py        # End-to-end 4-scenario automated demonstrator
├── requirements.txt      # Python dependencies
└── README.md
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Aryan00Saini/AI-Based-Smart-Vehicle-Insurance-Claim-Assessment-System.git
cd AI-Based-Smart-Vehicle-Insurance-Claim-Assessment-System

# Install Python dependencies
pip install -r requirements.txt

# Seed the database and run backend
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger API docs will be live at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the Surveyor Review Portal at: `http://localhost:5173`

### 4. Running Automated Tests & Demos
```bash
# Run all 38 pytest tests
python -m pytest backend/tests/ -v

# Run the 4-scenario end-to-end demonstration
python demo_runner.py
```

---

## 👥 Default Demo Credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| **Licensed Surveyor** | `surveyor1` | `surveyor123` |
| **Policyholder** | `user1` | `user123` |

---
