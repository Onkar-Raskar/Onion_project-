import os
import math
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
import uvicorn
from ultralytics import YOLO

# Import your existing pipeline modules
from heap_localizer import extract_onion_crops
from size_estimator import estimate_size_tier
from heuristics import diagnose_damage
from video_processor import extract_sharp_keyframes, RobustOnionTracker

app = FastAPI(title="SIH Onion Procurement API", version="1.0")

# Load model globally to keep the API fast
MODEL_PATH = "best.pt"
print("Loading YOLOv8 Model into memory...")
model = YOLO(MODEL_PATH)

def calculate_confidence_interval(p: float, n: int, z: float = 1.96) -> float:
    if n == 0: return 0.0
    margin = z * math.sqrt((p * (1 - p)) / n)
    return round(margin * 100, 2)

def generate_json_report(results, final_crops, dimensions, ppm, min_premium_mm=65.0):
    total_onions = len(results)
    
    # GATE 1: No circular objects found at all
    if total_onions == 0:
        return {"gate_failed": True, "reason": "No circular objects resembling onions found."}

    # GATE 2: Too few objects. A real mandi heap will have dozens of onions.
    if total_onions < 4:
        return {"gate_failed": True, "reason": f"Only {total_onions} object(s) detected. Please frame a larger section of the onion heap."}

    grade_a_count = 0
    grade_c_count = 0
    urs_count = 0
    detailed_defects = []

    for i, result in enumerate(results):
        crop = final_crops[i]
        w, h = dimensions[i]
        
        if result.probs is None:
            urs_count += 1
            continue

        top1 = result.probs.top1
        conf = float(result.probs.top1conf)
        class_name = str(result.names[top1]).lower().strip()
        
        # If YOLO is under 65% confident, flag it as a foreign object
        if conf < 0.65:
            urs_count += 1
            detailed_defects.append({"fault": "Unrecognized/Foreign Object", "severity_pct": 100.0})
            continue
        
        if class_name == "healthy":
            size_data = estimate_size_tier(w, h, ppm)
            diameter_mm = size_data.get("diameter_mm", 0)
            
            if diameter_mm >= min_premium_mm:
                grade_a_count += 1
            else:
                grade_c_count += 1 
        else:
            urs_count += 1
            try:
                fault_data = diagnose_damage(crop)
            except Exception:
                fault_data = {"fault": class_name, "severity_pct": 100.0}
            
            detailed_defects.append(fault_data)

    # GATE 3: THE STRICT NON-ONION GATE
    # If 80% or more of the detected objects are garbage/unrecognized/severe defects, block the whole scan.
    if (urs_count / total_onions) >= 0.80:
        return {"gate_failed": True, "reason": "Scan rejected. The AI detected too many non-onion shapes or an overwhelming amount of spoilage. Please rescan a valid heap."}

    p_grade_a = grade_a_count / total_onions if total_onions > 0 else 0.0
    margin_error = calculate_confidence_interval(p_grade_a, total_onions)

    grade_a_pct = round(p_grade_a * 100, 1)
    grade_c_pct = round((grade_c_count / total_onions) * 100, 1) if total_onions > 0 else 0.0
    urs_pct = round((urs_count / total_onions) * 100, 1) if total_onions > 0 else 0.0

    return {
        "batch_metrics": {
            "total_unique_onions": total_onions,
            "grade_a_pct": grade_a_pct,
            "grade_c_pct": grade_c_pct,
            "urs_pct": urs_pct,
            "confidence_interval_95": f"±{margin_error}%"
        },
        "defect_breakdown": detailed_defects
    }

@app.post("/analyze")
async def analyze_batch(file: UploadFile = File(...), ppm: float = Form(2.4)):
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ext = os.path.splitext(temp_file_path)[1].lower()
    
    try:
        if ext in ['.mp4', '.avi', '.mov']:
            frames = extract_sharp_keyframes(temp_file_path, target_count=10)
            tracker = RobustOnionTracker(max_distance=160, min_iou=0.02, max_missed=2, min_match_score=0.18)
            
            for frame in frames:
                frame_data = extract_onion_crops(frame)
                if not frame_data: continue
                boxes = [(x, y, w, h) for (crop, x, y, w, h) in frame_data]
                crops = [(crop, w, h) for (crop, x, y, w, h) in frame_data]
                tracker.update(frame, boxes, crops)

            valid_tracks = {tid: t for tid, t in tracker.tracks.items() if t["crops"]}
            final_crops = []
            dimensions = []
            
            for obj_id, track in valid_tracks.items():
                best_crop_data = max(track["crops"], key=lambda item: item[1] * item[2])
                final_crops.append(best_crop_data[0])
                dimensions.append((best_crop_data[1], best_crop_data[2]))

            if not final_crops:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the video. Please scan a valid heap."}
            else:
                results = model.predict(final_crops, verbose=False)
                report = generate_json_report(results, final_crops, dimensions, ppm)
            
        else:
            extracted_data = extract_onion_crops(temp_file_path)
            
            if not extracted_data:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the image. Please scan a valid heap."}
            else:
                crops = [data[0] for data in extracted_data]
                dimensions = [(data[3], data[4]) for data in extracted_data]
                
                results = model.predict(crops, verbose=False)
                report = generate_json_report(results, crops, dimensions, ppm)

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    return report

@app.post("/simulate-grading")
async def simulate_grading(file: UploadFile = File(...), ppm: float = Form(2.4), min_premium_mm: float = Form(65.0)):
    temp_file_path = f"temp_sim_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    ext = os.path.splitext(temp_file_path)[1].lower()
    
    try:
        if ext in ['.mp4', '.avi', '.mov']:
            frames = extract_sharp_keyframes(temp_file_path, target_count=10)
            tracker = RobustOnionTracker(max_distance=160, min_iou=0.02, max_missed=2, min_match_score=0.18)
            
            for frame in frames:
                frame_data = extract_onion_crops(frame)
                if not frame_data: continue
                boxes = [(x, y, w, h) for (crop, x, y, w, h) in frame_data]
                crops = [(crop, w, h) for (crop, x, y, w, h) in frame_data]
                tracker.update(frame, boxes, crops)

            valid_tracks = {tid: t for tid, t in tracker.tracks.items() if t["crops"]}
            final_crops = []
            dimensions = []
            
            for obj_id, track in valid_tracks.items():
                best_crop_data = max(track["crops"], key=lambda item: item[1] * item[2])
                final_crops.append(best_crop_data[0])
                dimensions.append((best_crop_data[1], best_crop_data[2]))

            if not final_crops:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the video. Please scan a valid heap."}
            else:
                results = model.predict(final_crops, verbose=False)
                report = generate_json_report(results, final_crops, dimensions, ppm, min_premium_mm=min_premium_mm)
            
        else:
            extracted_data = extract_onion_crops(temp_file_path)
            
            if not extracted_data:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the image. Please scan a valid heap."}
            else:
                crops = [data[0] for data in extracted_data]
                dimensions = [(data[3], data[4]) for data in extracted_data]
                
                results = model.predict(crops, verbose=False)
                report = generate_json_report(results, crops, dimensions, ppm, min_premium_mm=min_premium_mm)

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    return report

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)