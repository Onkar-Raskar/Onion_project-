"""
build_dataset_v3.py
====================
Converts the Mendeley onion dataset into a standard YOLOv8 Image Classification
directory structure. Drops all object detection labels and bounding boxes.

Input structure:
    <mendeley_root>/
        healthy/
            red/single/*.jpg
            white/multiple/*.jpg
            ...
        unhealthy/
            ...

Output structure:
    <out_root>/
        train/
            healthy/
            damaged/
        val/
            healthy/
            damaged/
        test/
            healthy/
            damaged/
"""

import argparse
import logging
import random
import shutil
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("build_dataset_v3")

# Map Mendeley root folders to target classification folder names
CLASS_MAP = {
    "healthy": "healthy",
    "unhealthy": "damaged"
}

def gather_images(mendeley_root: Path, include_multiple: bool) -> dict:
    """Finds all images and groups them by their target class."""
    records_by_class = {"healthy": [], "damaged": []}
    
    if not mendeley_root.exists():
        log.error("Mendeley root not found: %s", mendeley_root)
        return records_by_class

    for mendeley_folder, target_class in CLASS_MAP.items():
        source_dir = mendeley_root / mendeley_folder
        if not source_dir.exists():
            log.warning("Expected folder missing: %s", source_dir)
            continue

        for color in ("red", "white"):
            color_dir = source_dir / color
            if not color_dir.exists():
                continue

            counts_dirs = ["single"] + (["multiple"] if include_multiple else [])
            for count_folder in counts_dirs:
                count_dir = color_dir / count_folder
                if not count_dir.exists():
                    continue
                
                for img_path in count_dir.glob("*.*"):
                    if img_path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                        records_by_class[target_class].append(img_path)

    for cls_name, paths in records_by_class.items():
        log.info("Found %d images for class '%s'", len(paths), cls_name)
        
    return records_by_class

def split_and_copy(records_by_class: dict, out_root: Path, val_split: float, test_split: float, seed: int):
    """Shuffles, splits, and copies images into the YOLOv8 classification structure."""
    rng = random.Random(seed)
    
    for cls_name, paths in records_by_class.items():
        if not paths:
            continue
            
        rng.shuffle(paths)
        n = len(paths)
        n_val = int(n * val_split)
        n_test = int(n * test_split)
        n_train = n - n_val - n_test

        splits = {
            "train": paths[:n_train],
            "val": paths[n_train:n_train + n_val],
            "test": paths[n_train + n_val:]
        }

        for split_name, split_paths in splits.items():
            dest_dir = out_root / split_name / cls_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            
            for img_path in split_paths:
                # Prefix the filename with its original parent folders to prevent name collisions
                new_name = f"{img_path.parts[-3]}_{img_path.parts[-2]}_{img_path.name}"
                dest_path = dest_dir / new_name
                try:
                    shutil.copy2(img_path, dest_path)
                except OSError as exc:
                    log.warning("Failed to copy %s: %s", img_path, exc)
            
            log.info("Copied %d images to %s/%s", len(split_paths), split_name, cls_name)

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mendeley-root", type=Path, required=True, help="Path to Mendeley root folder")
    parser.add_argument("--out-root", type=Path, required=True, help="Path to output classification dataset")
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--test-split", type=float, default=0.10)
    parser.add_argument("--exclude-multiple", action="store_true", help="Drop images with multiple onions")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args([
        "--mendeley-root", "mendeley_root",
        "--out-root", "onion_classification_dataset"
    ])

    # 1. Gather all images by target class
    records_by_class = gather_images(args.mendeley_root, not args.exclude_multiple)
    
    # 2. Split and write to disk
    if any(records_by_class.values()):
        split_and_copy(records_by_class, args.out_root, args.val_split, args.test_split, args.seed)
        log.info("Dataset successfully built at: %s", args.out_root.resolve())
    else:
        log.error("No images found. Check your --mendeley-root path.")

if __name__ == "__main__":
    main()