# Onion Grader - Audit Report

## Architecture Summary & Data Flow

The "Onion Grader" system is composed of an Expo (React Native) mobile frontend and a Python FastAPI backend.
**Data Flow:**
1. **Calibration:** User captures a reference object on the frontend to calculate the `ppm` (pixels-per-metric).
2. **Sampling & Capture:** User takes 3 separate scans (Top, Middle, Bottom) following a forced sequence. The camera captures images or short videos (up to 5s).
3. **API Upload or Queue:** If online, the file and `ppm` are sent via multipart/form-data to `/analyze` on the FastAPI backend. If offline, the file and parameters are stored in a local SQLite/AsyncStorage queue.
4. **Backend Processing:**
   - **Video/Image Processing:** `video_processor.py` or `heap_localizer.py` identifies bounding boxes of onions using ORB/homography/watershed.
   - **Classification:** `best.pt` (YOLOv8) classifies each onion as healthy or damaged.
   - **Size Estimation:** `size_estimator.py` applies the `ppm` to categorize healthy onions.
   - **Defect Diagnosis:** `heuristics.py` checks damaged onions for specific defects via OpenCV.
5. **Report & Certificate:** The backend returns structured JSON. The frontend aggregates the 3 samples mathematically into a final result, displays a dashboard, and generates a PDF certificate containing a SHA-256 hash of the payload for tamper evidence.
6. **Dispute Mode:** If a procurement dispute arises, the cached images can be re-sent for reassessment or a new scan sequence can be initiated.

## Feature Completeness & Known Gaps

| # | Feature | Location | Status & Gaps |
|---|---------|----------|---------------|
| 1 | Rule-based grading engine | `main.py`, `app.py` | Complete. Relies on size tiers & confidence threshold. |
| 2 | Camera calibration card | `App.js` | Barebones. Uses a basic slider and hardcoded ₹5 coin assumption. Needs proper UI, zoom loupe, multiple coin selection, and persistence. |
| 3 | Evidence-linked certificate | `App.js` (PDF gen) | Barebones HTML to PDF. Needs better design, QR code, annotated bounding boxes (backend doesn't currently return box coordinates in the API response!). |
| 4 | Representative-sampling AI | `App.js` (State machine) | Implemented as a basic array in state (`sampleIndex`). Loses progress if app killed. |
| 5 | AI capture quality gate | `app.py` (Backend gates) | Backend implements gates (0 onions, <4 onions, >80% garbage). The frontend is missing a live real-time blur/lighting check before capturing. |
| 6 | Cryptographic audit trail | `App.js` (Crypto) | Basic SHA-256 implementation, but string format is brittle and not properly documented/deterministic. |
| 7 | Procurement dispute mode | `App.js` (Dispute Modal) | UI is functional but minimal. Needs a stored history of reassessments per batch and better side-by-side UX. |
| 8 | Severity-aware defect scoring | `heuristics.py`, `App.js` | Backend heuristics work. Frontend aggregates severities by simple average. Needs better visual representation (bars). |
| 9 | What-if simulator | `App.js` (Slider) | Functional, but re-uploads the whole media queue every time the slider moves. Needs debouncing. |
| 10 | Statistical confidence intervals| `app.py`, `App.js` | Standard 95% margin of error implemented. |
| 11 | Offline-first edge sync | `App.js` (Queue logic) | Uses `AsyncStorage`. Basic, lacks exponential backoff, proper idempotency keys, and storage size management. |

## Tech Debt, Bugs, and Risks

1. **Monolithic App.js:** All UI, state, API calls, PDF generation, and offline queue logic are crammed into a single 800+ line `App.js`.
2. **Missing Bounding Boxes in API Response:** The backend returns aggregate percentages but does *not* return the raw bounding boxes. To fulfill the requirement of "annotated image" in the certificate, the backend `/analyze` endpoint needs to be extended to return `x, y, w, h` coordinates for the drawn bounding boxes.
3. **Offline Queue Sync Reliability:** 
   - No background sync. It only syncs when the user manually taps the banner.
   - If the app crashes mid-upload, the queue state could be corrupted.
   - No retry backoff.
4. **Simulator Inefficiency:** Sliding the "min size" slider triggers 3 huge multipart API requests simultaneously per step. This will crush the backend and use massive data.
5. **No Navigation/Routing:** React Navigation or Expo Router is completely missing.
6. **Hardcoded IP Address:** `http://10.19.206.69:8000` is hardcoded everywhere.

## Target Architecture

We will adopt **Expo Router** and a modular folder structure:
```
onion-grader/
├── src/
│   ├── app/                # Expo Router screens (_layout.tsx, index.tsx, scan.tsx, report.tsx)
│   ├── components/         # Reusable UI (Button, Card, StatsBlock)
│   ├── features/           # Domain logic (calibration, capture, certificate)
│   ├── services/           # api.ts, offlineQueue.ts, hashing.ts
│   ├── store/              # Zustand or Redux for global state (queue, calibration)
│   ├── theme/              # Colors, typography
│   └── utils/
├── app.json
└── package.json
```

## Phase 1+ Task List

1. **Foundation:** Initialize Expo Router, configure base layout, setup global store (e.g. Zustand) for state management. Create `src/services/api.ts` with Axios (interceptors, env config).
2. **Refactor UI Components:** Create a Design System (Buttons, Cards, Modals).
3. **Backend Update (Safe Additive):** Add a `boxes` array to the `/analyze` and `/simulate-grading` responses containing coordinates for the frontend to draw.
4. **Quality Gate:** Implement a lightweight frame processor using `react-native-vision-camera` to measure live blur, or use a timer-based check to enforce steadiness.
5. **Calibration UI:** Build a dedicated calibration screen with coin selection and a magnifier loupe. Persist `ppm`.
6. **Sampling Flow:** Implement a resilient step-by-step wizard.
7. **Offline Queue:** Build a robust sync manager using SQLite or robust AsyncStorage, with background retry capabilities.
8. **Results & Certificate:** Build the dashboard, image canvas for drawing bounding boxes, and professional PDF generation.
9. **Simulator:** Debounce the simulator slider to avoid spamming the backend.
10. **Audit & Dispute:** Standardize the SHA-256 JSON hashing format. Build the side-by-side comparison UI.
