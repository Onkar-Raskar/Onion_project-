import os
import math
import shutil

import cv2
import numpy as np

# Low-memory environment settings for Render Free Tier (512MB limit)
os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import existing pipeline modules
from heap_localizer import extract_onion_crops
from size_estimator import estimate_size_tier
from heuristics import diagnose_damage
from video_processor import extract_sharp_keyframes, RobustOnionTracker

app = FastAPI(title="SIH Onion Procurement API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OnnxClassifier:
    """
    Ultra-lightweight ONNX classifier (~40MB RAM) that completely replaces 
    heavy PyTorch and Ultralytics dependencies on 512MB RAM cloud containers.
    """
    def __init__(self, model_path="best.onnx"):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        self.session = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.names = {0: 'damaged', 1: 'healthy'}

    def predict(self, crops, verbose=False):
        results = []
        for crop in crops:
            if crop is None or getattr(crop, 'size', 0) == 0:
                results.append(type('Result', (), {'probs': None, 'names': self.names})())
                continue
            
            # Preprocess: resize to 224x224 RGB float32 in [0, 1]
            img = cv2.resize(crop, (224, 224))
            if len(img.shape) == 2:
                img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
            elif img.shape[2] == 4:
                img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            tensor = img.transpose(2, 0, 1).astype(np.float32) / 255.0
            batch = np.expand_dims(tensor, axis=0)
            logits = self.session.run(None, {self.input_name: batch})[0]
            
            # Numerically stable softmax
            exp = np.exp(logits[0] - np.max(logits[0]))
            probs_arr = exp / np.sum(exp)
            top1 = int(np.argmax(probs_arr))
            top1conf = float(probs_arr[top1])
            
            class Probs:
                def __init__(self, top1, top1conf):
                    self.top1 = top1
                    self.top1conf = top1conf

            class Result:
                def __init__(self, probs, names):
                    self.probs = probs
                    self.names = names

            results.append(Result(Probs(top1, top1conf), self.names))
        return results

_model = None

def get_model():
    global _model
    if _model is None:
        if os.path.exists("best.onnx"):
            print("Loading ultra-lightweight ONNX model (uses only ~45MB RAM)...")
            _model = OnnxClassifier("best.onnx")
        else:
            print("best.onnx not found, falling back to PyTorch YOLO...")
            import torch
            from ultralytics import YOLO
            _orig_torch_load = torch.load
            torch.load = lambda *args, **kwargs: _orig_torch_load(*args, **{**kwargs, "weights_only": False})
            _model = YOLO("best.pt")
    return _model

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Onion Grader Backend is running"}

def calculate_confidence_interval(p: float, n: int, z: float = 1.96) -> float:
    if n == 0: return 0.0
    margin = z * math.sqrt((p * (1 - p)) / n)
    return round(margin * 100, 2)

def generate_json_report(results, final_crops, dimensions, ppm, min_premium_mm=65.0, boxes=None):
    total_onions = len(results)
    
    if total_onions == 0:
        return {"gate_failed": True, "reason": "No circular objects resembling onions found."}

    if total_onions < 4:
        return {"gate_failed": True, "reason": f"Only {total_onions} object(s) detected. Please frame a larger section of the onion heap."}

    grade_a_count = 0
    grade_c_count = 0
    urs_count = 0
    detailed_defects = []
    detections = []

    for i, result in enumerate(results):
        crop = final_crops[i]
        w, h = dimensions[i]
        box = boxes[i] if boxes and i < len(boxes) else None
        
        if result.probs is None:
            urs_count += 1
            if box: detections.append({"box": box, "class": "unrecognized", "defect": "None"})
            continue

        top1 = result.probs.top1
        conf = float(result.probs.top1conf)
        class_name = str(result.names[top1]).lower().strip()
        
        if conf < 0.65:
            urs_count += 1
            detailed_defects.append({"fault": "Unrecognized/Foreign Object", "severity_pct": 100.0})
            if box: detections.append({"box": box, "class": "unrecognized", "defect": "Unrecognized/Foreign Object"})
            continue
        
        if class_name == "healthy":
            size_data = estimate_size_tier(w, h, ppm)
            diameter_mm = size_data.get("diameter_mm", 0)
            
            if diameter_mm >= min_premium_mm:
                grade_a_count += 1
                tier = "Grade A"
            else:
                grade_c_count += 1 
                tier = "Grade C"
            if box: detections.append({"box": box, "class": "healthy", "tier": tier, "defect": "None"})
        else:
            urs_count += 1
            try:
                fault_data = diagnose_damage(crop)
            except Exception:
                fault_data = {"fault": class_name, "severity_pct": 100.0}
            
            detailed_defects.append(fault_data)
            if box: detections.append({"box": box, "class": "damaged", "defect": fault_data["fault"]})

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
            "confidence_interval_95": f"+/-{margin_error}%"
        },
        "defect_breakdown": detailed_defects,
        "detections": detections
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
                results = get_model().predict(final_crops, verbose=False)
                report = generate_json_report(results, final_crops, dimensions, ppm)
            
        else:
            extracted_data = extract_onion_crops(temp_file_path)
            
            if not extracted_data:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the image. Please scan a valid heap."}
            else:
                crops = [data[0] for data in extracted_data]
                dimensions = [(data[3], data[4]) for data in extracted_data]
                boxes = [(data[1], data[2], data[3], data[4]) for data in extracted_data]
                
                results = get_model().predict(crops, verbose=False)
                report = generate_json_report(results, crops, dimensions, ppm, boxes=boxes)

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
                results = get_model().predict(final_crops, verbose=False)
                report = generate_json_report(results, final_crops, dimensions, ppm, min_premium_mm=min_premium_mm)
            
        else:
            extracted_data = extract_onion_crops(temp_file_path)
            
            if not extracted_data:
                report = {"gate_failed": True, "reason": "No objects resembling onions found in the image. Please scan a valid heap."}
            else:
                crops = [data[0] for data in extracted_data]
                dimensions = [(data[3], data[4]) for data in extracted_data]
                boxes = [(data[1], data[2], data[3], data[4]) for data in extracted_data]
                
                results = get_model().predict(crops, verbose=False)
                report = generate_json_report(results, crops, dimensions, ppm, min_premium_mm=min_premium_mm, boxes=boxes)

    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    return report

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)