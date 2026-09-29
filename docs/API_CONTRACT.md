# Onion Grader - API Contract

## Base URL
Backend is a FastAPI application running on `http://<host>:8000`.

## 1. POST /analyze

**Description:**
Processes an image or video file of an onion heap, identifies individual onions, classifies them using the YOLOv8 model, calculates size tiers based on the provided PPM, and runs heuristics on damaged onions.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: (UploadFile) The image (e.g., .jpg, .png) or video (e.g., .mp4) to analyze.
- `ppm`: (float) Pixels-per-metric ratio used for size estimation (default: 2.4). Passed as form data.

**Responses:**

*Success Response (200 OK):*
```json
{
  "batch_metrics": {
    "total_unique_onions": 45,
    "grade_a_pct": 75.5,
    "grade_c_pct": 10.2,
    "urs_pct": 14.3,
    "confidence_interval_95": "±14.6%"
  },
  "defect_breakdown": [
    {
      "fault": "Black Smut / Fungus",
      "severity_pct": 12.4
    },
    {
      "fault": "Sprouting",
      "severity_pct": 3.2
    }
  ]
}
```

*Rejection (Quality Gate Failed) (200 OK):*
```json
{
  "gate_failed": true,
  "reason": "No objects resembling onions found in the video. Please scan a valid heap."
}
```
*Note: This can also trigger if < 4 onions are detected or if >= 80% are unrecognized/garbage.*

## 2. POST /simulate-grading

**Description:**
Same pipeline as `/analyze`, but allows overriding the threshold for Grade A classification.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: (UploadFile) Image or video file.
- `ppm`: (float) Pixels-per-metric ratio.
- `min_premium_mm`: (float) The minimum diameter in mm for an onion to be classified as Grade A (default: 65.0). Passed as form data.

**Responses:**
Returns the same JSON format as `/analyze`, adjusted based on the new `min_premium_mm` threshold.
