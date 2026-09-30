import cv2
import numpy as np
import math

from heap_localizer import extract_onion_crops
from size_estimator import estimate_size_tier
from heuristics import diagnose_damage


class RobustOnionTracker:
    """
    Tracker designed for sparse keyframes from a moving camera.

    Improvements:
    - Camera-motion compensation using ORB + homography
    - IoU + centroid matching
    - Track aging / missed-frame handling
    - Prevents duplicate tracks caused by camera panning
    - Prevents one old track from matching multiple detections
    """

    def __init__(
        self,
        max_distance=130,
        min_iou=0.05,
        max_missed=2,
        min_match_score=0.20
    ):
        self.next_id = 0
        self.tracks = {}

        self.max_distance = max_distance
        self.min_iou = min_iou
        self.max_missed = max_missed
        self.min_match_score = min_match_score

        self.prev_frame = None

        self.orb = cv2.ORB_create(
            nfeatures=1500,
            scaleFactor=1.2,
            nlevels=8
        )

        self.matcher = cv2.BFMatcher(
            cv2.NORM_HAMMING,
            crossCheck=False
        )

    # --------------------------------------------------------
    # CAMERA MOTION
    # --------------------------------------------------------

    def estimate_homography(self, previous_frame, current_frame):

        if previous_frame is None:
            return np.eye(3, dtype=np.float32)

        try:
            prev_gray = cv2.cvtColor(
                previous_frame,
                cv2.COLOR_BGR2GRAY
            )

            curr_gray = cv2.cvtColor(
                current_frame,
                cv2.COLOR_BGR2GRAY
            )

            kp1, des1 = self.orb.detectAndCompute(
                prev_gray,
                None
            )

            kp2, des2 = self.orb.detectAndCompute(
                curr_gray,
                None
            )

            if (
                des1 is None
                or des2 is None
                or len(kp1) < 8
                or len(kp2) < 8
            ):
                # Too few ORB features for a full homography -- fall back
                # to a translation-only estimate via phase correlation
                # instead of silently assuming zero camera motion. For a
                # panning shot, "no motion" is almost always the wrong
                # assumption and is what causes track matching to fail.
                return self._phase_correlation_translation(prev_gray, curr_gray)

            matches = self.matcher.knnMatch(
                des1,
                des2,
                k=2
            )

            good = []

            for pair in matches:
                if len(pair) != 2:
                    continue

                m, n = pair

                if m.distance < 0.72 * n.distance:
                    good.append(m)

            if len(good) < 8:
                return self._phase_correlation_translation(prev_gray, curr_gray)

            src_pts = np.float32(
                [kp1[m.queryIdx].pt for m in good]
            ).reshape(-1, 1, 2)

            dst_pts = np.float32(
                [kp2[m.trainIdx].pt for m in good]
            ).reshape(-1, 1, 2)

            H, mask = cv2.findHomography(
                src_pts,
                dst_pts,
                cv2.RANSAC,
                5.0
            )

            if H is None:
                return self._phase_correlation_translation(prev_gray, curr_gray)

            # Reject obviously unstable homographies
            if not np.isfinite(H).all():
                return self._phase_correlation_translation(prev_gray, curr_gray)

            return H.astype(np.float32)

        except Exception:
            return np.eye(3, dtype=np.float32)

    @staticmethod
    def _phase_correlation_translation(prev_gray, curr_gray):
        """
        Estimates a pure-translation motion between two frames using
        phase correlation. Used as the fallback whenever ORB feature
        matching is too weak for a full homography. Far more accurate
        for a panning shot than assuming zero motion (np.eye(3)), which
        was the previous fallback and the main cause of track loss on
        fast/wide pans.
        """
        try:
            prev_f = np.float32(prev_gray)
            curr_f = np.float32(curr_gray)
            (shift_x, shift_y), _ = cv2.phaseCorrelate(prev_f, curr_f)

            H = np.eye(3, dtype=np.float32)
            H[0, 2] = shift_x
            H[1, 2] = shift_y
            return H
        except Exception:
            return np.eye(3, dtype=np.float32)

    # --------------------------------------------------------
    # GEOMETRY
    # --------------------------------------------------------

    @staticmethod
    def transform_point(point, H):

        p = np.array(
            [[[float(point[0]), float(point[1])]]],
            dtype=np.float32
        )

        transformed = cv2.perspectiveTransform(
            p,
            H
        )[0][0]

        return (
            float(transformed[0]),
            float(transformed[1])
        )

    @staticmethod
    def bbox_from_center(
        center_x,
        center_y,
        width,
        height
    ):

        return (
            center_x - width / 2,
            center_y - height / 2,
            center_x + width / 2,
            center_y + height / 2
        )

    @staticmethod
    def calculate_iou(box1, box2):

        x1a, y1a, x2a, y2a = box1
        x1b, y1b, x2b, y2b = box2

        ix1 = max(x1a, x1b)
        iy1 = max(y1a, y1b)
        ix2 = min(x2a, x2b)
        iy2 = min(y2a, y2b)

        iw = max(0.0, ix2 - ix1)
        ih = max(0.0, iy2 - iy1)

        intersection = iw * ih

        area1 = max(0.0, x2a - x1a) * max(
            0.0,
            y2a - y1a
        )

        area2 = max(0.0, x2b - x1b) * max(
            0.0,
            y2b - y1b
        )

        union = area1 + area2 - intersection

        if union <= 0:
            return 0.0

        return intersection / union

    # --------------------------------------------------------
    # UPDATE
    # --------------------------------------------------------

    def update(
        self,
        frame,
        bounding_boxes,
        crops
    ):

        if not bounding_boxes:
            for track_id in list(self.tracks.keys()):
                self.tracks[track_id]["missed"] += 1

            self._remove_dead_tracks()
            self.prev_frame = frame.copy()

            return

        # ----------------------------------------------------
        # CURRENT DETECTIONS
        # ----------------------------------------------------

        detections = []

        for box, crop in zip(
            bounding_boxes,
            crops
        ):

            x, y, w, h = box

            cx = x + w / 2.0
            cy = y + h / 2.0

            detections.append(
                {
                    "box": (
                        float(x),
                        float(y),
                        float(w),
                        float(h)
                    ),
                    "center": (
                        float(cx),
                        float(cy)
                    ),
                    "crop": crop
                }
            )

        # ----------------------------------------------------
        # FIRST FRAME
        # ----------------------------------------------------

        if self.prev_frame is None:

            for detection in detections:

                self._create_track(
                    detection
                )

            self.prev_frame = frame.copy()

            return

        # ----------------------------------------------------
        # CAMERA MOTION COMPENSATION
        # ----------------------------------------------------

        H = self.estimate_homography(
            self.prev_frame,
            frame
        )

        # ----------------------------------------------------
        # PREDICT OLD TRACK POSITIONS
        # ----------------------------------------------------

        predicted_tracks = {}

        for track_id, track in self.tracks.items():

            predicted_center = self.transform_point(
                track["center"],
                H
            )

            predicted_tracks[track_id] = {
                "center": predicted_center,
                "width": track["width"],
                "height": track["height"]
            }

        # ----------------------------------------------------
        # BUILD MATCH CANDIDATES
        # ----------------------------------------------------

        candidates = []

        for track_id, predicted in predicted_tracks.items():

            px, py = predicted["center"]

            predicted_box = self.bbox_from_center(
                px,
                py,
                predicted["width"],
                predicted["height"]
            )

            for det_idx, detection in enumerate(
                detections
            ):

                dx, dy = detection["center"]

                distance = math.sqrt(
                    (px - dx) ** 2 +
                    (py - dy) ** 2
                )

                if distance > self.max_distance:
                    continue

                x, y, w, h = detection["box"]

                detection_box = (
                    x,
                    y,
                    x + w,
                    y + h
                )

                iou = self.calculate_iou(
                    predicted_box,
                    detection_box
                )

                distance_score = max(
                    0.0,
                    1.0 -
                    distance / self.max_distance
                )

                size_ratio = min(
                    w * h,
                    predicted["width"] *
                    predicted["height"]
                ) / max(
                    w * h,
                    predicted["width"] *
                    predicted["height"],
                    1.0
                )

                score = (
                    0.45 * distance_score +
                    0.35 * iou +
                    0.20 * size_ratio
                )

                if (
                    score >= self.min_match_score
                    or iou >= self.min_iou
                ):
                    candidates.append(
                        (
                            score,
                            track_id,
                            det_idx
                        )
                    )

        # ----------------------------------------------------
        # GREEDY UNIQUE MATCHING
        # ----------------------------------------------------

        candidates.sort(
            key=lambda x: x[0],
            reverse=True
        )

        used_tracks = set()
        used_detections = set()

        for score, track_id, det_idx in candidates:

            if track_id in used_tracks:
                continue

            if det_idx in used_detections:
                continue

            detection = detections[det_idx]

            self._update_track(
                track_id,
                detection
            )

            used_tracks.add(track_id)
            used_detections.add(det_idx)

        # ----------------------------------------------------
        # UNMATCHED OLD TRACKS
        # ----------------------------------------------------

        for track_id in self.tracks:

            if track_id not in used_tracks:
                self.tracks[track_id]["missed"] += 1

        # ----------------------------------------------------
        # ID RELOCATION (scene-aware relocation, per Li et al.,
        # "Video Object Counting With Scene-Aware Multi-Object
        # Tracking", J. Database Management 34(3), 2023)
        #
        # Core idea from the paper: in a scene where the object count
        # is known to be constant (their "non-transition region"), an
        # unmatched detection should be treated as a LOST TRACK
        # REAPPEARING, not a new object -- new IDs should only be
        # created where objects can genuinely enter/leave the scene.
        #
        # Our case is a simplified, single-region version of that: the
        # onions themselves never move or leave -- only the camera
        # pans. So an unmatched detection here is virtually always a
        # homography/feature-matching failure, not a new onion. Before
        # allowing a new track to be created, we try to reclaim the
        # nearest still-alive-but-unmatched track using its RAW last
        # known position (not the homography-predicted one, which may
        # itself be unreliable) and a more generous distance tolerance.
        # ----------------------------------------------------

        relocation_candidates = []
        relocatable_track_ids = [
            tid for tid in self.tracks
            if tid not in used_tracks and self.tracks[tid]["missed"] <= self.max_missed
        ]

        for det_idx, detection in enumerate(detections):
            if det_idx in used_detections:
                continue

            dx, dy = detection["center"]

            for track_id in relocatable_track_ids:
                tx, ty = self.tracks[track_id]["center"]  # raw last-known position

                distance = math.sqrt((tx - dx) ** 2 + (ty - dy) ** 2)
                relocation_tolerance = self.max_distance * 2.5

                if distance <= relocation_tolerance:
                    relocation_candidates.append((distance, track_id, det_idx))

        relocation_candidates.sort(key=lambda x: x[0])  # nearest first

        for distance, track_id, det_idx in relocation_candidates:
            if track_id in used_tracks or det_idx in used_detections:
                continue

            self._update_track(track_id, detections[det_idx])
            used_tracks.add(track_id)
            used_detections.add(det_idx)

        self._remove_dead_tracks()

        # ----------------------------------------------------
        # NEW DETECTIONS
        # (only genuinely new -- i.e. survived both the primary match
        # AND the relocation pass above without being claimed)
        # ----------------------------------------------------

        for det_idx, detection in enumerate(
            detections
        ):

            if det_idx not in used_detections:

                self._create_track(
                    detection
                )

        self.prev_frame = frame.copy()

    # --------------------------------------------------------
    # TRACK CREATION
    # --------------------------------------------------------

    def _create_track(
        self,
        detection
    ):

        x, y, w, h = detection["box"]
        cx, cy = detection["center"]

        self.tracks[self.next_id] = {
            "center": (
                cx,
                cy
            ),
            "width": w,
            "height": h,
            "missed": 0,
            "crops": [
                detection["crop"]
            ]
        }

        self.next_id += 1

    # --------------------------------------------------------
    # TRACK UPDATE
    # --------------------------------------------------------

    def _update_track(
        self,
        track_id,
        detection
    ):

        x, y, w, h = detection["box"]
        cx, cy = detection["center"]

        track = self.tracks[track_id]

        track["center"] = (
            cx,
            cy
        )

        track["width"] = w
        track["height"] = h

        track["missed"] = 0

        track["crops"].append(
            detection["crop"]
        )

        # Prevent unlimited memory growth
        if len(track["crops"]) > 20:
            track["crops"] = track["crops"][-20:]

    # --------------------------------------------------------
    # REMOVE LOST TRACKS
    # --------------------------------------------------------

    def _remove_dead_tracks(self):

        dead_ids = [
            track_id
            for track_id, track in self.tracks.items()
            if track["missed"] > self.max_missed
        ]

        for track_id in dead_ids:
            del self.tracks[track_id]


# ============================================================
# KEYFRAME EXTRACTION
# ============================================================

def extract_sharp_keyframes(
    video_path: str,
    target_count: int = 10,
    blur_thresh: float = 60.0
):

    cap = cv2.VideoCapture(
        video_path
    )

    if not cap.isOpened():
        print(
            f"Error opening video: {video_path}"
        )
        return []

    total_frames = int(
        cap.get(
            cv2.CAP_PROP_FRAME_COUNT
        )
    )

    if total_frames <= 0:
        cap.release()
        return []

    target_count = min(
        target_count,
        total_frames
    )

    interval = max(
        1,
        total_frames // target_count
    )

    keyframes = []

    for i in range(target_count):

        base_idx = i * interval

        best_frame = None
        max_var = 0.0

        for offset in range(
            -5,
            6
        ):

            idx = base_idx + offset

            if idx < 0 or idx >= total_frames:
                continue

            cap.set(
                cv2.CAP_PROP_POS_FRAMES,
                idx
            )

            ret, frame = cap.read()

            if not ret:
                continue

            gray = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2GRAY
            )

            var = cv2.Laplacian(
                gray,
                cv2.CV_64F
            ).var()

            if (
                var > max_var
                and var > blur_thresh
            ):

                max_var = var
                best_frame = frame.copy()

        if best_frame is not None:
            keyframes.append(
                best_frame
            )

    cap.release()

    return keyframes


# ============================================================
# MAIN PROCESSING
# ============================================================

def process_video_lot_with_tracking(
    video_path: str,
    weights_path: str,
    ppm: float
):

    print(
        f"Extracting keyframes from {video_path}..."
    )

    # NOTE: target_count was 10. With sparse, widely-spaced keyframes,
    # camera displacement between consecutive frames is large enough that
    # ORB+homography motion compensation frequently fails (falls back to
    # an identity matrix -- see estimate_homography()), which breaks
    # track matching and causes the SAME physical onion to be counted as
    # multiple "unique" tracks across the video. Denser keyframes keep
    # inter-frame motion small, which is what makes homography-based
    # tracking work reliably in the first place.
    frames = extract_sharp_keyframes(
        video_path,
        target_count=35
    )

    if not frames:

        print(
            "Failed to extract valid frames."
        )

        return

    # max_missed raised from 2 -> 5: with denser keyframes (see
    # target_count above), a track surviving a few consecutive missed
    # matches (e.g. transient blur, brief occlusion) is far more likely
    # to be the SAME onion reappearing than a genuinely new one. Killing
    # tracks too eagerly was the main source of duplicate counting.
    tracker = RobustOnionTracker(
        max_distance=160,
        min_iou=0.02,
        max_missed=5,
        min_match_score=0.18
    )

    print(
        "Stage 1: Localizing and tracking onions..."
    )

    # --------------------------------------------------------
    # TRACK ACROSS KEYFRAMES
    # --------------------------------------------------------

    for frame_index, frame in enumerate(frames):

        frame_data = extract_onion_crops(
            frame
        )

        if not frame_data:
            continue

        boxes = [
            (x, y, w, h)
            for (
                crop,
                x,
                y,
                w,
                h
            ) in frame_data
        ]

        crops = [
            (crop, w, h)
            for (
                crop,
                x,
                y,
                w,
                h
            ) in frame_data
        ]

        tracker.update(
            frame,
            boxes,
            crops
        )

        print(
            f"Frame {frame_index + 1}/{len(frames)}: "
            f"{len(frame_data)} detections | "
            f"{len(tracker.tracks)} active tracks"
        )

    # --------------------------------------------------------
    # REMOVE VERY WEAK TRACKS
    # --------------------------------------------------------

    valid_tracks = {}

    for track_id, track in tracker.tracks.items():

        # A real onion should normally appear
        # in at least one frame. Keep all tracks,
        # but require an actual crop.
        if track["crops"]:
            valid_tracks[track_id] = track

    tracker.tracks = valid_tracks

    unique_onions_count = len(
        tracker.tracks
    )

    print(
        f"Tracking Complete. "
        f"Identified {unique_onions_count} UNIQUE onions."
    )

    if unique_onions_count == 0:

        print(
            "No unique onions tracked."
        )

        return

    # --------------------------------------------------------
    # SELECT BEST VIEW FOR EACH ONION
    # --------------------------------------------------------

    final_crops = []
    final_meta = []
    final_ids = []

    for obj_id, track in tracker.tracks.items():

        crop_list = track["crops"]

        if not crop_list:
            continue

        # Largest crop generally gives the best
        # classification resolution.
        best_crop_data = max(
            crop_list,
            key=lambda item: (
                item[1] * item[2]
            )
        )

        best_crop = best_crop_data[0]
        best_w = best_crop_data[1]
        best_h = best_crop_data[2]

        final_crops.append(
            best_crop
        )

        final_meta.append(
            (
                best_w,
                best_h
            )
        )

        final_ids.append(
            obj_id
        )

    # --------------------------------------------------------
    # CLASSIFICATION
    # --------------------------------------------------------

    print(
        f"Stage 2: Classifying "
        f"{len(final_crops)} unique onions..."
    )

    from ultralytics import YOLO
    model = YOLO(
        weights_path
    )

    results = model.predict(
        final_crops,
        verbose=False
    )

    total_onions = len(
        results
    )

    grade_a_count = 0
    urs_count = 0

    defects = {}

    # --------------------------------------------------------
    # CLASSIFY EACH UNIQUE ONION ONCE
    # --------------------------------------------------------

    for i, result in enumerate(
        results
    ):

        best_crop = final_crops[i]

        w, h = final_meta[i]

        if result.probs is None:
            urs_count += 1
            continue

        top1 = result.probs.top1

        class_name = result.names[
            top1
        ]

        class_name = str(
            class_name
        ).lower().strip()

        # ----------------------------------------------------
        # HEALTHY ONION
        # ----------------------------------------------------

        if class_name == "healthy":

            size_data = estimate_size_tier(
                w,
                h,
                ppm
            )

            tier = str(
                size_data.get(
                    "tier",
                    ""
                )
            )

            if tier in [
                "Premium / Grade A",
                "Medium / Grade B"
            ]:

                grade_a_count += 1

            else:

                urs_count += 1

        # ----------------------------------------------------
        # DEFECTIVE ONION
        # ----------------------------------------------------

        else:

            urs_count += 1

            try:

                fault = diagnose_damage(
                    best_crop
                )

            except Exception:

                fault = class_name

            fault = str(
                fault
            )

            defects[fault] = (
                defects.get(
                    fault,
                    0
                ) + 1
            )

    # --------------------------------------------------------
    # FINAL PERCENTAGES
    # --------------------------------------------------------

    if total_onions > 0:

        grade_a_pct = (
            grade_a_count /
            total_onions
        ) * 100

        urs_pct = (
            urs_count /
            total_onions
        ) * 100

    else:

        grade_a_pct = 0.0
        urs_pct = 0.0

    # --------------------------------------------------------
    # REPORT
    # --------------------------------------------------------

    print(
        "\n=== DIGITAL QUALITY REPORT "
        "(TRACKED BATCH) ==="
    )

    print(
        f"Total Unique Onions Analyzed: "
        f"{total_onions}"
    )

    print(
        f"Grade A Percentage          : "
        f"{grade_a_pct:.1f}%"
    )

    print(
        f"URS Percentage              : "
        f"{urs_pct:.1f}%"
    )

    print(
        f"Grade A Count               : "
        f"{grade_a_count}"
    )

    print(
        f"URS Count                   : "
        f"{urs_count}"
    )

    if defects:

        print(
            "\nDefect Breakdown (URS):"
        )

        for fault, count in sorted(
            defects.items(),
            key=lambda x: x[1],
            reverse=True
        ):

            print(
                f"  - {fault}: {count}"
            )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    process_video_lot_with_tracking(
        "sample_pan.mp4",
        "best.pt",
        ppm=120.0 / 50.0
    )