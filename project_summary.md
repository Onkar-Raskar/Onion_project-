# Project Onion (SIH PS 31 Prototype) - Progress Summary

Based on the analysis of the `proj_onion` directory, you have built a sophisticated, end-to-end computer vision pipeline for automated onion grading and quality assessment. The system is capable of processing both static images of onion heaps and video pans of onion lots.

Here is a comprehensive breakdown of what has been accomplished so far:

## 1. Core Architecture & Pipeline (`main.py`)
You have a unified master router (`main.py`) that handles both images and videos. The pipeline flows logically:
1. **Localization:** Extracts individual onions from a scene.
2. **Classification:** Uses a trained AI model (YOLOv8) to classify each onion as healthy or damaged.
3. **Size Grading:** If healthy, measures the onion to categorize it into commercial grades.
4. **Defect Diagnosis:** If damaged, uses heuristics to identify the specific type of rot or damage.
5. **Reporting:** Generates a realistic digital quality report (Grade A, Grade C, URS/Rejected).

## 2. Image Segmentation & Localization (`heap_localizer.py`)
Instead of relying purely on deep learning for object detection, you've built a robust traditional CV pipeline to isolate onions from heaps:
- **Color Segmentation:** Uses LAB color space (A-channel) and HSV (Saturation gate) to separate red onions from backgrounds (like green leaves or tiled floors).
- **Peak Detection & Watershed:** Uses distance transforms and neighborhood peak search to identify individual onion crowns, followed by Watershed segmentation to separate overlapping/stacked onions.
- **Filtering:** Filters out noise using contour area, aspect ratio, and solidity constraints.

## 3. Video Processing & Tracking (`video_processor.py`)
To handle video pans across onion lots, you've implemented a custom tracking system:
- **Keyframe Extraction:** `extract_sharp_keyframes` evaluates variance of the Laplacian to pull only the sharpest, least blurry frames from a video.
- **Robust Onion Tracker:** A custom tracker that compensates for camera panning using **ORB feature matching** and **Homography**. If ORB fails, it falls back to phase correlation translation. 
- **De-duplication:** Tracks onions across frames using IoU, distance, and size matching, ensuring the same physical onion isn't counted twice as the camera moves.

## 4. Defect Diagnosis Heuristics (`heuristics.py`)
When the YOLO model flags an onion as "damaged", this module kicks in to explain *why* using deterministic OpenCV techniques:
- **Black Smut / Fungus:** Detects highly concentrated dark patches.
- **Sprouting:** Detects specific green hues (HSV thresholding) at the top of the onion.
- **Mechanical Damage / Cracks:** Uses Gaussian blur and Canny edge detection to find high-frequency internal edges indicative of peeling or deep cuts.

## 5. Size Estimation & Grading (`size_estimator.py`)
Provides physical dimension estimation based on a calibrated Pixels-Per-Metric (PPM) ratio.
- Categorizes healthy onions into commercial tiers: 
  - **Grade A (Premium):** > 65mm
  - **Grade B (Medium):** 45mm - 65mm
  - **Grade C (Undersized):** < 45mm

## 6. AI Model Training & Dataset Prep (`build_dataset_v3.py`, `train_test_cls.py`)
- **Dataset Preparation:** `build_dataset_v3.py` converts the raw Mendeley dataset into a YOLOv8-compatible classification structure (Train/Val/Test splits with `healthy` and `damaged` classes).
- **Model Training:** `train_test_cls.py` is a Kaggle-ready script that trains a YOLOv8 classification model (`yolov8n-cls.pt`) with custom augmentations (HSV shifts, rotation, scaling) and automatically saves the best performing weights (`best.pt`).

---

### What's Next / Potential Areas for Improvement
* **White Onion Support:** The segmentation logic in `heap_localizer.py` relies heavily on the 'A' channel in LAB space (redness). You might need to adjust this if you plan to support white onions equally well.
* **API Integration:** `main.py` is currently structured to print reports, but it returns a dictionary (`generate_realistic_report`). This is perfectly primed to be wrapped in a FastAPI or Flask endpoint for a web/mobile frontend.
* **Real-time Performance:** The tracker in `video_processor.py` uses ORB and homography which is great, but if real-time edge processing is a goal, performance profiling might be needed.
