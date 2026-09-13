# AI-Based Smart Vehicle Insurance Claim Assessment System

An end-to-end autonomous software engineering and machine learning system for vehicle insurance damage detection, deterministic cost estimation, automated fraud forensics, and human-in-the-loop surveyor claims auditing — featuring a fully-upgraded cyber-dark React portal.

---

## 🚀 Key Features

### 🤖 AI Assessment Pipeline

1. **Dual Independent Vision Segmentation Models (ONNX Runtime)**
   - **Model 1 (Vehicle Parts)**: Localizes 9 critical automotive body panels (`bumper_front`, `bumper_rear`, `door`, `fender`, `headlamp`, `taillamp`, `mirror`, `hood`, `windshield`).
   - **Model 2 (Damage Types)**: Detects 6 classes of damage (`scratch`, `dent`, `crack`, `shatter`, `paint_chip`, `misalignment`).
   - **Dual-Path Dent & Scratch Edge Localizer**: Morphological Black-Hat concavity analysis combined with Laplacian gradient boundary detection.

2. **Deterministic Geometric Mask Fusion**
   - Computes `Damage Area / Part Area` intersection ratios.
   - Assigns severity bands (`MINOR`, `MODERATE`, `SEVERE`) using weighted damage coefficients — no probabilistic hallucinations.
   - Cross-photo deduplication merges multi-angle evidence of the same damage by `(part_name, damage_type)` key, keeping the highest-confidence item.

3. **Purely Deterministic Rate Matrix & Cost Engine**
   - Cost calculation evaluated strictly against a relational database rate matrix (`VehicleTier`, `PartCatalog`, `RateMatrix`).
   - Vehicle tier-based pricing multipliers: Hatchback (`1.0×`), Sedan (`1.35×`), SUV (`1.75×`).
   - Deductible calculation and repair vs. replacement evaluation.

4. **Deterministic Escalation Rules Engine (E1–E9)**
   | Rule | Trigger |
   | :--- | :--- |
   | **E1** | Unattributed damage (outside any localized part boundary) |
   | **E2** | Structural or critical panel damage (hood, fender, frame) |
   | **E3** | Low detection confidence (< 0.80) |
   | **E4** | High-impact collision (> 2 distinct damaged panels) |
   | **E5** | Severe damage band present |
   | **E6** | Total claim exceeds auto-approval ceiling (₹25,000.00) |
   | **E7** | Anti-fraud heuristics fired |
   | **E8** | Rate matrix missing row fallback |
   | **E9** | Photo validation failure |

5. **Multi-Layer Fraud & Forensics Inspection**
   - **Sharpness Check**: Laplacian variance blur scoring (< 100.0 rejected).
   - **Vehicle Presence**: Minimum vehicle coverage ratio verification.
   - **Perceptual Hash Deduplication**: 64-bit pHash Hamming distance tracking to reject reused photos across different claims.
   - **EXIF Plausibility**: Timestamp anomaly and GPS coordinate verification.

6. **Parts Pricing Advisor & Replacement Catalog**
   - Interactive lookup API (`GET /api/v1/rates/part-pricing`) offering:
     - **OEM Factory Genuine** — Authentic manufacturer parts, 24-month warranty
     - **Certified Aftermarket** — ARAI/CAPA certified, 30% discount on base pricing
     - **Eco-Recycled OEM** — Grade-A inspected green parts, 50% discount
   - One-click price application with automatic audit note synchronization.

---

### 🖥️ Surveyor Portal (Frontend)

A fully upgraded **cyber-dark React portal** for end-to-end claim inspection and decision-making.

7. **Dynamic Policy Dropdown**
   - Fetches active policies live from the database (`GET /api/v1/policies`) on form mount.
   - Auto-fills Vehicle Registration and Vehicle Category from the selected policy record.
   - Handles loading, error, and empty states gracefully.

8. **Claim Submission Page (`SubmitClaimPage`)**
   - 4-slot guided photo upload (wide shot, close-up, angle, additional) with drag-and-drop.
   - Quick test scenario presets for rapid demo.
   - Multipart form submission wired directly to the AI assessment pipeline.

9. **Claim Detail Modal — 5-Tab Architecture (`ClaimDetailModal`)**
   - **Tab 1 – Photos & Masks**: Full interactive canvas annotator with raw ↔ AI overlay toggle, zoom controls, and severity legend.
   - **Tab 2 – Decision & Rules**: Live E1–E9 rules audit card showing which rules fired and escalation triggers.
   - **Tab 3 – Cost Breakdown**: Editable line items table with part catalog pricing, OEM/aftermarket/recycled catalog lookup, GST, and financial summary.
   - **Tab 4 – Forensic & Fraud**: Forensic radar metrics — Laplacian blur, vehicle detection, pHash duplicate, and EXIF metadata inspection.
   - **Tab 5 – Overrides & Audit**: Surveyor override form with justification notes and immutable chronological audit history.
   - **Persistent Sticky Footer**: Live Subtotal / Deductible / Net Payable and Chief Surveyor action buttons (`Reject Claim` / `Sign & Authorize Payout`) accessible from any tab.

10. **Surveyor Dashboard (`SurveyorDashboard`)**
    - Shimmer metric cards: Total Claims, Pending Review, Auto-Approved, Fraud Flagged.
    - Real-time search with `⌘K` / `Ctrl+K` keyboard shortcut.
    - Status filter buttons with live counts and 720° refresh animation.
    - CSV export utility and copy-to-clipboard feedback on claim IDs.

11. **Analytics & Audit Modal (`AnalyticsModal`)**
    - Fleet-level statistics breakdown over all submitted claims.

12. **Notification System (`Toast`)**
    - Non-blocking toast alerts for claim actions, overrides, and API errors.

13. **Navbar**
    - Cyan glowing brand logo, live pending claim count badge, dual-ring backend telemetry beacon, and surveyor profile pill.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite / PostgreSQL |
| **Computer Vision / ML** | ONNX Runtime, OpenCV, NumPy, Ultralytics YOLOv8 |
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS 3, Lucide Icons |
| **Admin Panel** | SQLAdmin (mounted at `/admin`) |
| **Storage** | Local filesystem (dev) / AWS S3-compatible (production) |
| **Testing** | Pytest — 45 automated unit & integration tests |

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route controllers
│   │   │   ├── claims.py     # Claim submission, listing, detail, override, decision
│   │   │   ├── policies.py   # GET /api/v1/policies — active policy list
│   │   │   ├── rates.py      # Part catalog, rate matrix, pricing advisor
│   │   │   ├── auth.py       # JWT login / register
│   │   │   └── router.py     # Central router registration
│   │   ├── core/             # Config, thresholds, security (bcrypt & JWT)
│   │   ├── db/               # SQLAlchemy models, database connection & seed data
│   │   ├── schemas/          # Pydantic data contracts
│   │   ├── services/         # CV inference, mask fusion, cost engine, decision engine, fraud
│   │   ├── admin.py          # SQLAdmin views
│   │   └── main.py           # FastAPI application entrypoint
│   └── tests/                # 45 pytest test suites
├── data/
│   ├── models/               # ONNX model files (parts + damage models)
│   └── storage/              # Local file storage for uploads and overlay renders
├── training/                 # Model training & dataset pipeline
│   ├── dataset_prep.py
│   ├── train_parts.py
│   ├── train_damage.py
│   └── export_models.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── ClaimDetailModal.tsx   # 5-tab claim inspector
│   │   │   ├── CanvasAnnotator.tsx    # AI overlay canvas
│   │   │   ├── CostBreakdownTable.tsx
│   │   │   ├── DecisionAuditCard.tsx  # E1–E9 rules display
│   │   │   ├── FraudInspectionCard.tsx
│   │   │   ├── ClaimStatusStepper.tsx
│   │   │   ├── AnalyticsModal.tsx
│   │   │   ├── PartPricingModal.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   └── Toast.tsx
│   │   ├── pages/
│   │   │   ├── SurveyorDashboard.tsx
│   │   │   └── SubmitClaimPage.tsx
│   │   ├── services/
│   │   │   └── api.ts                 # All backend API calls
│   │   └── types.ts                   # TypeScript interfaces
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── demo_runner.py            # End-to-end 4-scenario automated demonstrator
├── requirements.txt
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend

```bash
git clone https://github.com/Aryan00Saini/AI-Based-Smart-Vehicle-Insurance-Claim-Assessment-System.git
cd AI-Based-Smart-Vehicle-Insurance-Claim-Assessment-System

pip install -r requirements.txt

# Copy env config (adjust as needed)
cp .env.example .env       # Linux/macOS
copy .env.example .env     # Windows

# Start the backend (auto-seeds DB on first run)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Swagger API docs**: `http://localhost:8000/docs`
- **Admin panel**: `http://localhost:8000/admin`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

- **Surveyor Portal**: `http://localhost:5173`

### 3. Tests & Demo

```bash
# Run all 45 pytest tests
python -m pytest backend/tests/ -v

# Run the 4-scenario end-to-end demonstration
python demo_runner.py
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/policies` | List all active policies |
| `POST` | `/api/v1/claims/submit-multipart` | Submit claim with photos |
| `GET` | `/api/v1/claims/` | List all claims (with optional status filter) |
| `GET` | `/api/v1/claims/{id}` | Full claim detail |
| `POST` | `/api/v1/claims/{id}/override` | Surveyor price/decision override |
| `POST` | `/api/v1/claims/{id}/decision` | Finalize claim (APPROVED / REJECTED) |
| `GET` | `/api/v1/rates/part-pricing` | OEM / aftermarket / recycled pricing |
| `GET` | `/api/v1/rates/tiers` | Vehicle tiers |
| `GET` | `/api/v1/rates/parts` | Parts catalog |
| `POST` | `/api/v1/auth/login` | JWT login |
| `POST` | `/api/v1/auth/register` | Register user |

---

## 👥 Demo Credentials

The auth API is fully functional. The frontend does not yet gate views behind login — both tabs are open/unauthenticated. Credentials below are for exercising the auth API via `/docs`.

| Role | Username | Password |
| :--- | :--- | :--- |
| **Licensed Surveyor** | `surveyor1` | `surveyor123` |
| **Policyholder** | `user1` | `user123` |

---

## 🌱 Demo Policies (seeded on first run)

| Policy ID | Policyholder | Registration | Tier | Deductible |
| :--- | :--- | :--- | :--- | :--- |
| `POL-2026-004821` | Aarav Sharma | UK07AB1234 | SEDAN | ₹1,000 |
| `POL-2026-009912` | Priya Patel | DL01XY9876 | HATCHBACK | ₹1,500 |
| `POL-2026-007733` | Vikram Malhotra | MH02CD5555 | SUV | ₹2,500 |

---

## ⚠️ Known Limitations & Future Work

1. **Exterior cosmetic damage only** — structural, mechanical, or internal damage is always escalated to a human surveyor by design.
2. **Authentication not yet connected to frontend** — JWT API is fully functional and tested; the React UI does not gate views behind login yet.
3. **Escalation rules are deterministic, not learned** — thresholds live in `backend/app/core/config.py` for full auditability (common in insurance/fintech), but require manual tuning rather than automatic adaptation.
4. **Duplicate-photo fraud detection does a full historical scan** — fine at demo scale; production would need an indexed approximate-nearest-neighbor lookup.
5. **Cross-photo deduplication uses `(part, damage_type)` key** — two distinct scratches on the same bumper from different angles are merged into one line item. A future version could use spatial/viewpoint-aware geometric matching.
6. **ONNX model weights (~96 MB total) committed directly to the repo** — no Git LFS or model registry for simplicity of a single-clone setup.

