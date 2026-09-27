import cv2
import numpy as np

def diagnose_damage(onion_crop: np.ndarray) -> dict:
    """
    Analyzes a damaged onion crop to explain the specific defect.
    Returns a dictionary containing the primary fault and severity percentage.
    """
    # 0. Create a rough mask of the onion to ignore the background corners of the bounding box
    gray = cv2.cvtColor(onion_crop, cv2.COLOR_BGR2GRAY)
    _, onion_mask = cv2.threshold(gray, 20, 255, cv2.THRESH_BINARY)
    onion_area = cv2.countNonZero(onion_mask)

    if onion_area == 0:
        return {"fault": "Unknown Defect", "severity_pct": 0.0}

    # 1. Black Smut / Fungus Detection
    # Fungal infections appear as extremely dark, concentrated patches.
    smut_mask = cv2.inRange(gray, 0, 40)
    smut_mask = cv2.bitwise_and(smut_mask, onion_mask)
    smut_ratio = cv2.countNonZero(smut_mask) / onion_area
    
    if smut_ratio > 0.04:  # If more than 4% of the surface is pitch black
        return {"fault": "Black Smut / Fungus", "severity_pct": round(smut_ratio * 100, 1)}

    # 2. Sprouting Detection
    # Looks for distinct green hues (H: 35-85) at the top of the onion.
    hsv = cv2.cvtColor(onion_crop, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    
    green_mask = cv2.inRange(hsv, lower_green, upper_green)
    green_mask = cv2.bitwise_and(green_mask, onion_mask)
    green_ratio = cv2.countNonZero(green_mask) / onion_area
    
    if green_ratio > 0.015:  # Sprouts are small, so the threshold is very sensitive
        return {"fault": "Sprouting", "severity_pct": round(green_ratio * 100, 1)}

    # 3. Mechanical Damage / Cracking
    # Healthy onions are smooth. Deep cracks, cuts, or peeled flesh create 
    # dense, high-frequency internal edges.
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.bitwise_and(edges, onion_mask)
    edge_density = cv2.countNonZero(edges) / onion_area
    
    if edge_density > 0.10: 
        return {"fault": "Cracked / Mechanical Damage", "severity_pct": round(edge_density * 100, 1)}

    # If it fails all specific heuristics but YOLO still called it damaged:
    return {"fault": "General Surface Defect", "severity_pct": 100.0}