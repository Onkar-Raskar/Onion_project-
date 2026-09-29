import os
import re

with open("app.py", "r") as f:
    content = f.read()

# Restore the original generate_json_report, but with an additive detections list
new_report_func = """def generate_json_report(results, final_crops, dimensions, ppm, min_premium_mm=65.0, boxes=None):
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
            "confidence_interval_95": f"±{margin_error}%"
        },
        "defect_breakdown": detailed_defects,
        "detections": detections
    }"""

# Use regex to replace the broken generate_json_report up to @app.post("/analyze")
content = re.sub(r'def generate_json_report.*?@app\.post\("/analyze"\)', new_report_func + '\n\n@app.post("/analyze")', content, flags=re.DOTALL)

# Also update the image processing paths to pass `boxes`.
content = content.replace(
    'dimensions = [(data[3], data[4]) for data in extracted_data]',
    'dimensions = [(data[3], data[4]) for data in extracted_data]\n                boxes = [(data[1], data[2], data[3], data[4]) for data in extracted_data]'
)

content = content.replace(
    'report = generate_json_report(results, crops, dimensions, ppm)',
    'report = generate_json_report(results, crops, dimensions, ppm, boxes=boxes)'
)

content = content.replace(
    'report = generate_json_report(results, crops, dimensions, ppm, min_premium_mm=min_premium_mm)',
    'report = generate_json_report(results, crops, dimensions, ppm, min_premium_mm=min_premium_mm, boxes=boxes)'
)

with open("app.py", "w") as f:
    f.write(content)

print("Patched app.py successfully.")
