import cv2
from ultralytics import YOLO
from heap_localizer import extract_onion_crops
from size_estimator import calculate_ppm, estimate_size_tier
from heuristics import diagnose_damage

def process_onion_batch(image_path: str, weights_path: str, ppm: float):
    print("Loading YOLOv8 Classification Model...")
    model = YOLO(weights_path)

    print("Stage 1: Localizing and extracting onions...")
    # This now returns a list of tuples: (crop_array, x, y, w, h)
    extracted_data = extract_onion_crops(image_path)
    
    if not extracted_data:
        print("No onions detected.")
        return

    # Unpack the crops for YOLO batch processing
    crops_only = [data[0] for data in extracted_data]
    
    print(f"Stage 2: Classifying {len(crops_only)} onions in real-time...")
    # Run all crops through YOLO simultaneously for speed
    yolo_results = model.predict(crops_only, verbose=False)

    print("\n--- FINAL GRADING REPORT ---")
    for i, result in enumerate(yolo_results):
        crop, x, y, w, h = extracted_data[i]
        
        # YOLOv8 Classification Output
        top1_index = result.probs.top1
        class_name = result.names[top1_index]
        confidence = float(result.probs.top1conf)

        print(f"\nOnion #{i+1}:")
        
        if class_name == "healthy":
            # Stage 4: Size Estimation
            size_data = estimate_size_tier(w, h, ppm)
            print(f"  Status : HEALTHY ({confidence*100:.1f}%)")
            print(f"  Size   : {size_data['diameter_mm']}mm")
            print(f"  Grade  : {size_data['tier']}")
            
        elif class_name == "damaged":
            # Stage 3: Explainability Heuristics
            fault_reason = diagnose_damage(crop)
            print(f"  Status : REJECTED ({confidence*100:.1f}%)")
            print(f"  Reason : {fault_reason}")

if __name__ == "__main__":
    # --- CALIBRATION ---
    # Example: If a 50mm reference square takes up 120 pixels on screen
    calibrated_ppm = calculate_ppm(reference_pixels=120.0, reference_mm=50.0)
    
    # --- EXECUTION ---
    # Ensure best.pt and sample_heap.jpg are in your current folder
    process_onion_batch("sample_heap.jpg", "best.pt", ppm=calibrated_ppm)