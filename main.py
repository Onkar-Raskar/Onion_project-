import os
import cv2
from ultralytics import YOLO

# Import your existing pipeline modules
from heap_localizer import extract_onion_crops
from size_estimator import estimate_size_tier
from heuristics import diagnose_damage

# Import the video handling tools from the file we just built
from video_processor import extract_sharp_keyframes, RobustOnionTracker

def generate_realistic_report(results, final_crops, dimensions, ppm):
    """
    Shared grading logic for both images and videos.
    Splits output into Grade A (Premium), Grade C (Undersized), and URS (Rot).
    """
    total_onions = len(results)
    grade_a_count = 0  # Premium & Medium
    grade_c_count = 0  # Undersized (Edible)
    urs_count = 0      # Truly Damaged / Rotten / Fungal
    defects = {}

    for i, result in enumerate(results):
        crop = final_crops[i]
        w, h = dimensions[i]
        
        if result.probs is None:
            urs_count += 1
            continue

        top1 = result.probs.top1
        class_name = str(result.names[top1]).lower().strip()
        
        if class_name == "healthy":
            size_data = estimate_size_tier(w, h, ppm)
            tier = str(size_data.get("tier", ""))
            
            # Categorize by commercial market tiers
            if tier in ["Premium / Grade A", "Medium / Grade B"]:
                grade_a_count += 1
            else:
                grade_c_count += 1 
        else:
            # Biological damage goes to URS
            urs_count += 1
            try:
                fault = diagnose_damage(crop)
            except Exception:
                fault = class_name
            
            fault = str(fault)
            defects[fault] = defects.get(fault, 0) + 1

    grade_a_pct = (grade_a_count / total_onions) * 100 if total_onions > 0 else 0
    grade_c_pct = (grade_c_count / total_onions) * 100 if total_onions > 0 else 0
    urs_pct = (urs_count / total_onions) * 100 if total_onions > 0 else 0

    print("\n=== REALISTIC DIGITAL QUALITY REPORT ===")
    print(f"Total Unique Onions Analyzed : {total_onions}")
    print(f"Grade A (Premium/Medium)     : {grade_a_pct:.1f}% ({grade_a_count} onions)")
    print(f"Grade C (Undersized/Edible)  : {grade_c_pct:.1f}% ({grade_c_count} onions)")
    print(f"URS / Rejected (Damaged/Rot) : {urs_pct:.1f}% ({urs_count} onions)")
    
    if defects:
        print("\nDefect Breakdown (URS):")
        for fault, count in sorted(defects.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {fault}: {count}")

    # Return the data so our future API can send it as JSON
    return {
        "total": total_onions,
        "grade_a_pct": grade_a_pct,
        "grade_c_pct": grade_c_pct,
        "urs_pct": urs_pct,
        "defects": defects
    }

def process_image(image_path: str, model: YOLO, ppm: float):
    print(f"Processing static image: {image_path}...")
    extracted_data = extract_onion_crops(image_path)
    
    if not extracted_data:
        print("No onions detected.")
        return None

    # Unpack for YOLO and reporting
    crops = [data[0] for data in extracted_data]
    dimensions = [(data[3], data[4]) for data in extracted_data] # w, h
    
    print(f"Stage 2: Classifying {len(crops)} onions...")
    results = model.predict(crops, verbose=False)
    
    return generate_realistic_report(results, crops, dimensions, ppm)

def process_video(video_path: str, model: YOLO, ppm: float):
    print(f"Processing video lot: {video_path}...")
    frames = extract_sharp_keyframes(video_path, target_count=10)
    
    if not frames:
        print("Failed to extract valid frames.")
        return None

    tracker = RobustOnionTracker(max_distance=160, min_iou=0.02, max_missed=2, min_match_score=0.18)
    
    print("Stage 1: Localizing and tracking onions across sweeps...")
    for frame in frames:
        frame_data = extract_onion_crops(frame)
        if not frame_data: continue
            
        boxes = [(x, y, w, h) for (crop, x, y, w, h) in frame_data]
        crops = [(crop, w, h) for (crop, x, y, w, h) in frame_data]
        tracker.update(frame, boxes, crops)

    # Filter out weak tracks
    valid_tracks = {tid: t for tid, t in tracker.tracks.items() if t["crops"]}
    if not valid_tracks:
        print("No unique onions tracked.")
        return None

    # Select best views
    final_crops = []
    dimensions = []
    
    for obj_id, track in valid_tracks.items():
        best_crop_data = max(track["crops"], key=lambda item: item[1] * item[2])
        final_crops.append(best_crop_data[0])
        dimensions.append((best_crop_data[1], best_crop_data[2]))

    print(f"Stage 2: Classifying {len(final_crops)} UNIQUE onions...")
    results = model.predict(final_crops, verbose=False)
    
    return generate_realistic_report(results, final_crops, dimensions, ppm)

def analyze_lot(file_path: str, weights_path: str, ppm: float):
    """
    The master router. Determines if the file is an image or video 
    and triggers the appropriate computer vision pipeline.
    """
    print("Loading YOLOv8 Model...")
    model = YOLO(weights_path)
    
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.mp4', '.avi', '.mov', '.mkv']:
        return process_video(file_path, model, ppm)
    elif ext in ['.jpg', '.jpeg', '.png', '.bmp']:
        return process_image(file_path, model, ppm)
    else:
        print(f"Unsupported file format: {ext}")
        return None

if __name__ == "__main__":
    # Test your unified architecture (swap the filename to test photo vs video)
    test_file = "sample_pan.mp4" # or "sample_heap.jpg"
    
    analyze_lot(
        file_path=test_file, 
        weights_path="best.pt", 
        ppm=120.0 / 50.0
    )