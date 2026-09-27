import numpy as np

def calculate_ppm(reference_pixels: float, reference_mm: float) -> float:
    """
    Calculates the Pixels-Per-Metric ratio. 
    Run this once during machine calibration using a known object.
    """
    return reference_pixels / reference_mm

def estimate_size_tier(w_pixels: int, h_pixels: int, ppm: float) -> dict:
    """
    Calculates the physical diameter of the onion and assigns a grading tier.
    """
    if ppm <= 0:
        return {"diameter_mm": 0, "tier": "Uncalibrated"}

    # Onions are graded by their maximum diameter
    max_pixel_dim = max(w_pixels, h_pixels)
    diameter_mm = max_pixel_dim / ppm

    # Standard commercial grading tiers (adjust these thresholds for your specific market)
    if diameter_mm < 45:
        tier = "Undersized / Grade C"
    elif 45 <= diameter_mm <= 65:
        tier = "Medium / Grade B"
    elif diameter_mm > 65:
        tier = "Premium / Grade A"
    else:
        tier = "Unknown"

    return {
        "diameter_mm": round(diameter_mm, 2),
        "tier": tier
    }