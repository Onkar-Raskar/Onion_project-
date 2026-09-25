pip install ultralytics

"""
train_and_test_cls.py
=====================
Kaggle/Jupyter-compatible YOLOv8 Image Classification training + testing script.

Run directly in a Kaggle notebook:
    !python train_and_test_cls.py

OR:
    !python train_and_test_cls.py --data /kaggle/working/onion_classification_dataset

The script automatically uses Kaggle-friendly defaults if --data is not supplied.
"""

import argparse
import csv
import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path

from ultralytics import YOLO


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

log = logging.getLogger("train_and_test_cls")


# ============================================================
# DATASET AUTO-DETECTION
# ============================================================

def find_dataset():
    """
    Automatically locate a classification dataset on Kaggle.

    Expected structure:

        dataset/
        ├── train/
        │   ├── class1/
        │   ├── class2/
        │   └── ...
        ├── val/
        │   ├── class1/
        │   └── ...
        └── test/
            ├── class1/
            └── ...
    """

    possible_paths = [
        Path("/kaggle/working/onion_classification_dataset"),
        Path("/kaggle/input/datasets/pranitmathane/data-onion/proj_onion/onion_classification_dataset"),
        Path("/kaggle/working/"),
        Path("/kaggle/working/dataset"),
        Path("/kaggle/input/dataset"),
    ]

    for path in possible_paths:
        if path.exists() and (path / "train").exists():
            log.info("Automatically detected dataset: %s", path)
            return str(path)

    # Search Kaggle input directories
    kaggle_input = Path("/kaggle/input")

    if kaggle_input.exists():
        for path in kaggle_input.iterdir():
            if path.is_dir() and (path / "train").exists():
                log.info("Automatically detected dataset: %s", path)
                return str(path)

    return None


# ============================================================
# TRAIN
# ============================================================

def train(
    data_dir: str,
    base_model: str,
    epochs: int,
    imgsz: int,
    batch: int,
    patience: int,
    device,
    name: str,
    out_dir: str
):

    model = YOLO(base_model)

    results = model.train(
        data=data_dir,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=patience,
        device=device,
        name=name,
        project=out_dir,

        # Classification augmentations
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,

        degrees=15,
        translate=0.1,
        scale=0.2,
        fliplr=0.5,

        # Prevent excessive console output
        verbose=True
    )

    return str(results.save_dir)


# ============================================================
# TEST
# ============================================================

def test(weights_path: str, data_dir: str):

    model = YOLO(weights_path)

    test_dir = Path(data_dir) / "test"

    if not test_dir.exists():
        log.warning(
            "Test directory not found: %s. Skipping test evaluation.",
            test_dir
        )
        return None

    metrics = model.val(
        data=data_dir,
        split="test"
    )

    log.info("=" * 60)
    log.info("TEST SET RESULTS (CLASSIFICATION)")
    log.info("Top-1 Accuracy: %.4f", metrics.top1)
    log.info("Top-5 Accuracy: %.4f", metrics.top5)
    log.info("=" * 60)

    return metrics


# ============================================================
# SAVE BEST MODEL
# ============================================================

def save_best_model(
    run_dir: str,
    best_models_dir: str = "best_models",
    run_name: str = "onion_cls_v1"
):

    run_path = Path(run_dir)

    best_pt = run_path / "weights" / "best.pt"
    results_csv = run_path / "results.csv"

    if not best_pt.exists():
        raise FileNotFoundError(
            f"best.pt not found at {best_pt}"
        )

    log.info("Found best.pt at %s", best_pt)

    best_epoch_row = None

    if results_csv.exists():

        with open(results_csv, newline="") as f:

            reader = csv.DictReader(f)

            rows = [
                {
                    k.strip(): v.strip()
                    for k, v in row.items()
                    if k is not None and v is not None
                }
                for row in reader
            ]

        if rows:

            acc_key = next(
                (
                    k
                    for k in rows[0]
                    if "accuracy_top1" in k.lower()
                ),
                None
            )

            if acc_key:

                valid_rows = []

                for row in rows:
                    try:
                        value = float(row.get(acc_key, 0))
                        valid_rows.append((value, row))
                    except (ValueError, TypeError):
                        pass

                if valid_rows:

                    _, best_epoch_row = max(
                        valid_rows,
                        key=lambda x: x[0]
                    )

                    log.info(
                        "Best validation Top-1 accuracy: %.4f",
                        max(valid_rows, key=lambda x: x[0])[0]
                    )

    out_dir = Path(best_models_dir)

    out_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    versioned_path = (
        out_dir /
        f"{run_name}_{timestamp}_best.pt"
    )

    latest_path = (
        out_dir /
        "latest_best.pt"
    )

    shutil.copy2(
        best_pt,
        versioned_path
    )

    shutil.copy2(
        best_pt,
        latest_path
    )

    metadata = {
        "run_name": run_name,
        "versioned_copy": str(versioned_path),
        "saved_at": timestamp,
        "best_epoch_metrics": best_epoch_row,
    }

    metadata_path = (
        out_dir /
        f"{run_name}_{timestamp}_metadata.json"
    )

    metadata_path.write_text(
        json.dumps(
            metadata,
            indent=2,
            default=str
        )
    )

    log.info(
        "Stable latest model: %s",
        latest_path
    )

    return str(versioned_path)


# ============================================================
# PREDICT SAMPLE
# ============================================================

def predict_sample(
    weights_path: str,
    image_path: str
):

    image_path = Path(image_path)

    if not image_path.exists():
        log.error(
            "Prediction image not found: %s",
            image_path
        )
        return

    model = YOLO(weights_path)

    results = model.predict(
        str(image_path),
        save=True,
        verbose=False
    )

    for result in results:

        if result.probs is None:
            log.warning(
                "No classification probabilities returned."
            )
            continue

        top1_index = result.probs.top1
        conf_val = float(
            result.probs.top1conf
        )

        cls_name = result.names[top1_index]

        log.info(
            "Classification for %s:",
            image_path
        )

        log.info(
            "  -> %s (Confidence: %.2f%%)",
            cls_name,
            conf_val * 100
        )


# ============================================================
# CHECK DATASET
# ============================================================

def validate_dataset(data_dir: str):

    data_path = Path(data_dir)

    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset directory does not exist: {data_path}"
        )

    train_dir = data_path / "train"
    val_dir = data_path / "val"
    test_dir = data_path / "test"

    if not train_dir.exists():
        raise FileNotFoundError(
            f"Missing train directory: {train_dir}"
        )

    if not val_dir.exists():
        raise FileNotFoundError(
            f"Missing val directory: {val_dir}"
        )

    log.info("=" * 60)
    log.info("DATASET")
    log.info("Path: %s", data_path)
    log.info("Train: %s", train_dir)
    log.info("Val:   %s", val_dir)
    log.info("Test:  %s", test_dir if test_dir.exists() else "Not found")
    log.info("=" * 60)

    train_classes = sorted(
        [
            p.name
            for p in train_dir.iterdir()
            if p.is_dir()
        ]
    )

    val_classes = sorted(
        [
            p.name
            for p in val_dir.iterdir()
            if p.is_dir()
        ]
    )

    log.info(
        "Training classes (%d): %s",
        len(train_classes),
        train_classes
    )

    log.info(
        "Validation classes (%d): %s",
        len(val_classes),
        val_classes
    )

    if train_classes != val_classes:
        log.warning(
            "Train and validation class folders do not match."
        )


# ============================================================
# MAIN
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--data",
        default=None,
        help="Path to classification dataset root"
    )

    parser.add_argument(
        "--base-model",
        default="yolov8n-cls.pt",
        help="Classification base checkpoint"
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=50
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=224
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=32
    )

    parser.add_argument(
        "--patience",
        type=int,
        default=15
    )

    parser.add_argument(
        "--device",
        default=0,
        help="GPU index or 'cpu'"
    )

    parser.add_argument(
        "--name",
        default="onion_cls_v1"
    )

    parser.add_argument(
        "--out-dir",
        default="/kaggle/working/runs"
    )

    parser.add_argument(
        "--predict-sample",
        default=None
    )

    parser.add_argument(
        "--best-models-dir",
        default="/kaggle/working/best_models"
    )

    # IMPORTANT:
    # parse_known_args prevents Kaggle/Jupyter's own arguments
    # from breaking argparse.
    args, _ = parser.parse_known_args()

    # --------------------------------------------------------
    # AUTO DETECT DATASET
    # --------------------------------------------------------

    if args.data is None:

        args.data = find_dataset()

        if args.data is None:

            raise RuntimeError(
                "\nDataset path was not provided and could not "
                "be automatically detected.\n\n"
                "Either place your dataset at:\n"
                "/kaggle/working/onion_classification_dataset\n\n"
                "or run:\n"
                "!python train_and_test_cls.py "
                "--data /kaggle/input/YOUR_DATASET\n"
            )

    # --------------------------------------------------------
    # DEVICE
    # --------------------------------------------------------

    # Kaggle sometimes passes device values as strings.
    if str(args.device).lower() == "cpu":
        device = "cpu"
    else:
        try:
            device = int(args.device)
        except (ValueError, TypeError):
            device = 0

    # --------------------------------------------------------
    # VALIDATE DATASET
    # --------------------------------------------------------

    validate_dataset(args.data)

    log.info(
        "Base checkpoint: %s | Task: Classification",
        args.base_model
    )

    # --------------------------------------------------------
    # TRAIN
    # --------------------------------------------------------

    run_dir = train(
        data_dir=args.data,
        base_model=args.base_model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        device=device,
        name=args.name,
        out_dir=args.out_dir,
    )

    log.info(
        "Training completed."
    )

    log.info(
        "Run directory: %s",
        run_dir
    )

    # --------------------------------------------------------
    # SAVE BEST MODEL
    # --------------------------------------------------------

    best_weights = save_best_model(
        run_dir,
        best_models_dir=args.best_models_dir,
        run_name=args.name
    )

    # --------------------------------------------------------
    # TEST
    # --------------------------------------------------------

    test(
        best_weights,
        args.data
    )

    # --------------------------------------------------------
    # OPTIONAL SAMPLE PREDICTION
    # --------------------------------------------------------

    if args.predict_sample:

        predict_sample(
            best_weights,
            args.predict_sample
        )

    log.info("=" * 60)
    log.info("DONE")
    log.info(
        "Best model: %s",
        best_weights
    )
    log.info("=" * 60)


if __name__ == "__main__":
    main()