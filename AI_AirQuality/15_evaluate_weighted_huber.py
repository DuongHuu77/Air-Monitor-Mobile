import os
import json
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf

from tensorflow.keras import Sequential
from tensorflow.keras.layers import (
    Input,
    Conv1D,
    MaxPooling1D,
    LSTM,
    Dropout,
    Dense
)

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)


# ============================================================
# CONFIG
# ============================================================

SEQUENCE_DIR = "outputs/processed/sequences_no_aqi"

WEIGHTS_PATH = (
    "outputs/models/weighted_huber/"
    "best_cnn_lstm_weighted_huber.weights.h5"
)

RESULT_DIR = "outputs/results/weighted_huber"

LOOKBACK = 24
FORECAST_HORIZON = 12
N_FEATURES = 3


# ============================================================
# AQI CATEGORY
# ============================================================

def get_aqi_category(aqi):

    if aqi <= 50:
        return "Tốt"
    elif aqi <= 100:
        return "Trung bình"
    elif aqi <= 150:
        return "Kém"
    elif aqi <= 200:
        return "Xấu"
    elif aqi <= 300:
        return "Rất xấu"
    else:
        return "Nguy hại"


# ============================================================
# CREATE RESULT DIRECTORY
# ============================================================

os.makedirs(
    RESULT_DIR,
    exist_ok=True
)


print("=" * 70)
print("15 - EVALUATE CNN-LSTM WEIGHTED HUBER")
print("MODEL E")
print("=" * 70)


# ============================================================
# LOAD TEST DATA
# ============================================================

print("\nLoading test data...")

X_test = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "X_test.npy"
    )
)

y_test_scaled = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "y_test.npy"
    )
)

print(
    f"X_test shape: {X_test.shape}"
)

print(
    f"y_test shape: {y_test_scaled.shape}"
)


# ============================================================
# LOAD Y SCALER
# ============================================================

print("\nLoading y scaler...")

with open(
    os.path.join(
        SEQUENCE_DIR,
        "y_scaler.pkl"
    ),
    "rb"
) as f:

    y_scaler = pickle.load(f)


# ============================================================
# BUILD ORIGINAL WEIGHTED HUBER MODEL STRUCTURE
# ============================================================

print("\n" + "=" * 70)
print("BUILDING MODEL E")
print("=" * 70)


# ------------------------------------------------------------
# Base CNN-LSTM model
# ------------------------------------------------------------

base_model = Sequential(
    [
        Input(
            shape=(
                LOOKBACK,
                N_FEATURES
            )
        ),

        Conv1D(
            filters=64,
            kernel_size=3,
            activation="relu",
            padding="same"
        ),

        MaxPooling1D(
            pool_size=2
        ),

        LSTM(
            64,
            return_sequences=True
        ),

        Dropout(
            0.2
        ),

        LSTM(
            32
        ),

        Dropout(
            0.2
        ),

        Dense(
            64,
            activation="relu"
        ),

        Dense(
            FORECAST_HORIZON
        )
    ],
    name="sequential"
)


# ------------------------------------------------------------
# Build model
# ------------------------------------------------------------

base_model.build(
    input_shape=(
        None,
        LOOKBACK,
        N_FEATURES
    )
)

base_model.summary()


# ============================================================
# LOAD WEIGHTS FROM NESTED CHECKPOINT
# ============================================================

print("\nLoading best Model E weights...")

import h5py


with h5py.File(
    WEIGHTS_PATH,
    "r"
) as f:

    print(
        "\nCheckpoint structure:"
    )

    print(
        list(f.keys())
    )

    print(
        "layers:",
        list(f["layers"].keys())
    )


# ------------------------------------------------------------
# IMPORTANT
# ------------------------------------------------------------
#
# The checkpoint was saved from:
#
# WeightedHuberModel
#       |
#       +-- sequential
#
# Therefore Keras expects the outer model structure.
#
# We recreate the original custom wrapper here.
# ------------------------------------------------------------


class WeightedHuberModel(tf.keras.Model):

    def __init__(
        self,
        model
    ):
        super().__init__()

        self.sequential = model

    def call(
        self,
        inputs,
        training=False
    ):
        return self.sequential(
            inputs,
            training=training
        )


# Create wrapper
weighted_model = WeightedHuberModel(
    base_model
)


# Build wrapper
weighted_model.build(
    input_shape=(
        None,
        LOOKBACK,
        N_FEATURES
    )
)


# Load checkpoint
weighted_model.load_weights(
    WEIGHTS_PATH
)

print(
    "\nModel E weights loaded successfully."
)


# Use inner Sequential model for prediction
model = weighted_model.sequential


# ============================================================
# GENERATE PREDICTIONS
# ============================================================

print("\n" + "=" * 70)
print("GENERATING PREDICTIONS")
print("=" * 70)

y_pred_scaled = model.predict(
    X_test,
    batch_size=64,
    verbose=1
)

print(
    f"\nPrediction shape: "
    f"{y_pred_scaled.shape}"
)


# ============================================================
# CHECK OUTPUT SHAPE
# ============================================================

if y_pred_scaled.shape != y_test_scaled.shape:

    raise ValueError(
        f"Prediction shape {y_pred_scaled.shape} "
        f"does not match target shape "
        f"{y_test_scaled.shape}"
    )


# ============================================================
# INVERSE TRANSFORM
# ============================================================

print(
    "\nConverting predictions "
    "back to real AQI..."
)

y_test = y_scaler.inverse_transform(
    y_test_scaled.reshape(-1, 1)
).reshape(
    y_test_scaled.shape
)

y_pred = y_scaler.inverse_transform(
    y_pred_scaled.reshape(-1, 1)
).reshape(
    y_pred_scaled.shape
)


# ============================================================
# CLIP AQI
# ============================================================

y_pred = np.clip(
    y_pred,
    0,
    500
)


# ============================================================
# FLATTEN
# ============================================================

y_true_flat = y_test.flatten()
y_pred_flat = y_pred.flatten()


# ============================================================
# OVERALL METRICS
# ============================================================

mae = mean_absolute_error(
    y_true_flat,
    y_pred_flat
)

rmse = np.sqrt(
    mean_squared_error(
        y_true_flat,
        y_pred_flat
    )
)

r2 = r2_score(
    y_true_flat,
    y_pred_flat
)

mean_error = np.mean(
    y_pred_flat - y_true_flat
)

max_abs_error = np.max(
    np.abs(
        y_pred_flat - y_true_flat
    )
)


# ============================================================
# CATEGORY AGREEMENT
# ============================================================

true_categories = np.array(
    [
        get_aqi_category(x)
        for x in y_true_flat
    ]
)

pred_categories = np.array(
    [
        get_aqi_category(x)
        for x in y_pred_flat
    ]
)

category_agreement = (
    np.mean(
        true_categories == pred_categories
    )
    * 100
)


# ============================================================
# OVER / UNDER PREDICTION
# ============================================================

overprediction = (
    np.mean(
        y_pred_flat > y_true_flat
    )
    * 100
)

underprediction = (
    np.mean(
        y_pred_flat < y_true_flat
    )
    * 100
)


# ============================================================
# OVERALL RESULTS
# ============================================================

print("\n" + "=" * 70)
print("OVERALL RESULTS - MODEL E")
print("=" * 70)

print(f"\nMAE: {mae:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"R²: {r2:.4f}")

print(
    f"Category Agreement: "
    f"{category_agreement:.2f}%"
)

print(
    f"Mean Error: "
    f"{mean_error:.4f}"
)

print(
    f"Max Absolute Error: "
    f"{max_abs_error:.4f}"
)

print(
    f"Overprediction: "
    f"{overprediction:.2f}%"
)

print(
    f"Underprediction: "
    f"{underprediction:.2f}%"
)


# ============================================================
# HORIZON METRICS
# ============================================================

print("\n" + "=" * 70)
print("HORIZON METRICS")
print("=" * 70)

horizon_results = []

for h in range(
    FORECAST_HORIZON
):

    true_h = y_test[:, h]
    pred_h = y_pred[:, h]

    horizon_mae = mean_absolute_error(
        true_h,
        pred_h
    )

    horizon_rmse = np.sqrt(
        mean_squared_error(
            true_h,
            pred_h
        )
    )

    horizon_r2 = r2_score(
        true_h,
        pred_h
    )

    horizon_results.append(
        {
            "horizon": h + 1,
            "MAE": horizon_mae,
            "RMSE": horizon_rmse,
            "R2": horizon_r2
        }
    )

    print(
        f"t+{h+1:02d}: "
        f"MAE={horizon_mae:.4f}, "
        f"RMSE={horizon_rmse:.4f}, "
        f"R²={horizon_r2:.4f}"
    )


horizon_df = pd.DataFrame(
    horizon_results
)


# ============================================================
# AQI RANGE METRICS
# ============================================================

print("\n" + "=" * 70)
print("AQI RANGE METRICS")
print("=" * 70)

aqi_ranges = [
    ("Tốt", 0, 50),
    ("Trung bình", 50, 100),
    ("Kém", 100, 150),
    ("Xấu", 150, 200),
    ("Rất xấu", 200, 300),
    ("Nguy hại", 300, 501)
]

category_results = []

for category, lower, upper in aqi_ranges:

    mask = (
        (y_true_flat >= lower)
        & (y_true_flat < upper)
    )

    count = int(
        np.sum(mask)
    )

    if count == 0:

        print(
            f"{category}: 0 samples"
        )

        category_results.append(
            {
                "category": category,
                "count": 0,
                "MAE": np.nan,
                "RMSE": np.nan,
                "mean_error": np.nan,
                "category_agreement": np.nan
            }
        )

        continue

    true_range = y_true_flat[mask]
    pred_range = y_pred_flat[mask]

    range_mae = mean_absolute_error(
        true_range,
        pred_range
    )

    range_rmse = np.sqrt(
        mean_squared_error(
            true_range,
            pred_range
        )
    )

    range_mean_error = np.mean(
        pred_range - true_range
    )

    true_cat = np.array(
        [
            get_aqi_category(x)
            for x in true_range
        ]
    )

    pred_cat = np.array(
        [
            get_aqi_category(x)
            for x in pred_range
        ]
    )

    agreement = (
        np.mean(
            true_cat == pred_cat
        )
        * 100
    )

    category_results.append(
        {
            "category": category,
            "count": count,
            "MAE": range_mae,
            "RMSE": range_rmse,
            "mean_error": range_mean_error,
            "category_agreement": agreement
        }
    )

    print(
        f"{category}: "
        f"n={count}, "
        f"MAE={range_mae:.4f}, "
        f"RMSE={range_rmse:.4f}, "
        f"Agreement={agreement:.2f}%"
    )


category_df = pd.DataFrame(
    category_results
)


# ============================================================
# HIGH AQI
# ============================================================

print("\n" + "=" * 70)
print("HIGH-AQI PERFORMANCE")
print("=" * 70)

thresholds = [
    50,
    100,
    150,
    200,
    300
]

high_aqi_results = []

for threshold in thresholds:

    mask = (
        y_true_flat >= threshold
    )

    count = int(
        np.sum(mask)
    )

    if count == 0:

        print(
            f"AQI >= {threshold}: "
            f"0 samples"
        )

        high_aqi_results.append(
            {
                "threshold": threshold,
                "count": 0,
                "MAE": np.nan,
                "RMSE": np.nan,
                "mean_error": np.nan
            }
        )

        continue

    true_high = y_true_flat[mask]
    pred_high = y_pred_flat[mask]

    high_mae = mean_absolute_error(
        true_high,
        pred_high
    )

    high_rmse = np.sqrt(
        mean_squared_error(
            true_high,
            pred_high
        )
    )

    high_mean_error = np.mean(
        pred_high - true_high
    )

    high_aqi_results.append(
        {
            "threshold": threshold,
            "count": count,
            "MAE": high_mae,
            "RMSE": high_rmse,
            "mean_error": high_mean_error
        }
    )

    print(
        f"AQI >= {threshold}: "
        f"n={count}, "
        f"MAE={high_mae:.4f}, "
        f"RMSE={high_rmse:.4f}, "
        f"Mean Error={high_mean_error:.4f}"
    )


high_aqi_df = pd.DataFrame(
    high_aqi_results
)


# ============================================================
# SAVE RESULTS
# ============================================================

print("\n" + "=" * 70)
print("SAVING RESULTS")
print("=" * 70)


# Predictions
predictions_data = {}

for h in range(
    FORECAST_HORIZON
):

    predictions_data[
        f"actual_t+{h+1}"
    ] = y_test[:, h]

    predictions_data[
        f"predicted_t+{h+1}"
    ] = y_pred[:, h]

    predictions_data[
        f"error_t+{h+1}"
    ] = (
        y_pred[:, h]
        - y_test[:, h]
    )


predictions_df = pd.DataFrame(
    predictions_data
)

predictions_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "predictions.csv"
    ),
    index=False
)


# Horizon
horizon_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "horizon_metrics.csv"
    ),
    index=False
)


# Category
category_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "category_metrics.csv"
    ),
    index=False
)


# High AQI
high_aqi_df.to_csv(
    os.path.join(
        RESULT_DIR,
        "high_aqi_metrics.csv"
    ),
    index=False
)


# Overall
metrics = {
    "model": "Model E - Weighted Huber",
    "lookback": LOOKBACK,
    "forecast_horizon": FORECAST_HORIZON,
    "features": [
        "PM2.5",
        "Temperature",
        "Humidity"
    ],
    "loss": "Weighted Huber",
    "MAE": float(mae),
    "RMSE": float(rmse),
    "R2": float(r2),
    "category_agreement":
        float(category_agreement),
    "mean_error":
        float(mean_error),
    "max_absolute_error":
        float(max_abs_error),
    "overprediction_percent":
        float(overprediction),
    "underprediction_percent":
        float(underprediction)
}

with open(
    os.path.join(
        RESULT_DIR,
        "metrics.json"
    ),
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        metrics,
        f,
        indent=4,
        ensure_ascii=False
    )


# ============================================================
# DONE
# ============================================================

print("\n" + "=" * 70)
print("MODEL E EVALUATION COMPLETED")
print("=" * 70)

print(
    f"\nMAE  = {mae:.4f}"
)

print(
    f"RMSE = {rmse:.4f}"
)

print(
    f"R²   = {r2:.4f}"
)

print(
    f"Category Agreement = "
    f"{category_agreement:.2f}%"
)

print(
    "\nResults saved to:"
)

print(
    RESULT_DIR
)

print("\nDone.")