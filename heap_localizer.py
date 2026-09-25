import cv2
import numpy as np
from scipy.ndimage import maximum_filter

def extract_onion_crops(image_source, debug_save_path: str = None) -> list:
    """
    Isolates individual onions from a heap/mound, robust to multi-onion clusters,
    patterned backgrounds, and 3D stacking.
    """
    if isinstance(image_source, str):
        img = cv2.imread(image_source)
        if img is None:
            print(f"Error loading {image_source}")
            return []
    else:
        img = image_source.copy()

    # 1. Color Segmentation: LAB A-Channel + Saturation Gate
    # Rejects both green backgrounds and neutral white/tiled floor stripes
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    l_chan, a_chan, b_chan = cv2.split(lab)
    _, s_chan, _ = cv2.split(hsv)

    # Red onions have high 'A' value in LAB (typically > 133 in 8-bit scale 0-255)
    # Saturation gate (> 40) strips out neutral white stripes and light flooring
    _, a_mask = cv2.threshold(a_chan, 133, 255, cv2.THRESH_BINARY)
    _, s_mask = cv2.threshold(s_chan, 40, 255, cv2.THRESH_BINARY)
    
    onion_mask = cv2.bitwise_and(a_mask, s_mask)

    # 2. Morphological Cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    opening = cv2.morphologyEx(onion_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # 3. Local Peak Detection (Replaces global 0.6*max threshold)
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    
    # Neighborhood peak search to identify every individual onion crown
    local_max = maximum_filter(dist_transform, size=21)
    peak_mask = (dist_transform == local_max) & (dist_transform > 12)
    
    sure_fg = np.uint8(peak_mask) * 255
    # Slightly dilate markers so connectedComponents cleanly separates them
    sure_fg = cv2.dilate(sure_fg, np.ones((3, 3), np.uint8), iterations=1)

    # 4. Watershed Segmentation
    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(img, markers)

    # 5. Extraction with Stacking-Tolerant Filters
    onion_crops = []
    total_image_area = img.shape[0] * img.shape[1]

    for label in np.unique(markers):
        if label <= 1:
            continue

        mask = np.zeros(opening.shape, dtype="uint8")
        mask[markers == label] = 255

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)

        contour_area = cv2.contourArea(c)
        relative_area = contour_area / total_image_area
        aspect_ratio = float(w) / h if h > 0 else 0

        hull = cv2.convexHull(c)
        hull_area = cv2.contourArea(hull)
        solidity = contour_area / hull_area if hull_area > 0 else 0

        # Tolerances adjusted for partially occluded/stacked onions:
        # Relative area: 0.3% to 35% of image
        # Aspect ratio: 0.35 to 2.8
        # Solidity: > 0.60 (tolerates overlapping boundaries)
        if 0.003 < relative_area < 0.35 and 0.35 < aspect_ratio < 2.8 and solidity > 0.60:
            crop = img[y:y+h, x:x+w]
            onion_crops.append((crop, x, y, w, h))

            if debug_save_path:
                cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 2)

    if debug_save_path:
        cv2.imwrite(debug_save_path, img)

    return onion_crops

if __name__ == "__main__":
    # Test on a frame or still photo
    crops = extract_onion_crops("sample_heap.png", debug_save_path="debug_segmented.jpg")
    print(f"Successfully extracted {len(crops)} onions.")