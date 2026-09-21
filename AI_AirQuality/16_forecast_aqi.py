import pickle
from pathlib import Path

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
    Dense,
)


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = (
    BASE_DIR
    / "outputs"
    / "processed"
    / "air_quality_aqi.csv"
)

MODEL_WEIGHTS = (
    BASE_DIR
    / "outputs"
    / "models"
    / "weighted_huber"
    / "best_cnn_lstm_weighted_huber.weights.h5"
)

SCALER_DIR = (
    BASE_DIR
    / "outputs"
    / "processed"
    / "sequences_no_aqi"
)

X_SCALER_PATH = SCALER_DIR / "x_scaler.pkl"
Y_SCALER_PATH = SCALER_DIR / "y_scaler.pkl"
CONFIG_PATH = SCALER_DIR / "config.pkl"

LOOKBACK = 24
FORECAST_HORIZON = 12
N_FEATURES = 3

FEATURES = [
    "PM2.5",
    "Temperature",
    "Humidity",
]


# ============================================================
# MODEL ARCHITECTURE
# ============================================================

def build_base_model():
    """
    Recreate the exact CNN-LSTM architecture used by Model E.
    """

    model = Sequential(
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

    return model


# ============================================================
# WEIGHTED HUBER MODEL WRAPPER
# ============================================================

class WeightedHuberModel(tf.keras.Model):

    def __init__(
        self,
        model
    ):
        super().__init__()

        # IMPORTANT:
        # The original checkpoint was saved with
        # WeightedHuberModel -> sequential
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


# ============================================================
# START
# ============================================================

print("=" * 70)
print("MODEL E - 12-HOUR AQI FORECAST")
print("=" * 70)


# ============================================================
# LOAD CONFIGURATION
# ============================================================

print("\n[1] Loading configuration...")

with open(
    CONFIG_PATH,
    "rb"
) as f:

    config = pickle.load(f)

print(
    "Config:",
    config
)

if config["lookback"] != LOOKBACK:

    raise ValueError(
        f"Unexpected lookback: "
        f"{config['lookback']}"
    )

if config["forecast_horizon"] != FORECAST_HORIZON:

    raise ValueError(
        f"Unexpected forecast horizon: "
        f"{config['forecast_horizon']}"
    )

if config["features"] != FEATURES:

    raise ValueError(
        f"Unexpected features: "
        f"{config['features']}"
    )


# ============================================================
# LOAD SCALERS
# ============================================================

print("\n[2] Loading scalers...")

with open(
    X_SCALER_PATH,
    "rb"
) as f:

    x_scaler = pickle.load(f)


with open(
    Y_SCALER_PATH,
    "rb"
) as f:

    y_scaler = pickle.load(f)


print(
    "X scaler features:",
    x_scaler.n_features_in_
)

print(
    "Y scaler features:",
    y_scaler.n_features_in_
)


if x_scaler.n_features_in_ != N_FEATURES:

    raise ValueError(
        "X scaler does not match "
        f"{N_FEATURES} input features."
    )

if y_scaler.n_features_in_ != 1:

    raise ValueError(
        "Y scaler must have exactly "
        "1 feature."
    )


# ============================================================
# BUILD MODEL E
# ============================================================

print("\n[3] Loading Model E...")

# Build the original CNN-LSTM
base_model = build_base_model()


# Build inner Sequential model
base_model.build(
    input_shape=(
        None,
        LOOKBACK,
        N_FEATURES
    )
)


# Create the same outer wrapper
# used during Model E training
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


# ============================================================
# LOAD MODEL WEIGHTS
# ============================================================

print("\nLoading Model E weights...")

weighted_model.load_weights(
    MODEL_WEIGHTS
)

print(
    "Model E weights loaded successfully."
)


# Use the inner Sequential model
# for prediction
model = weighted_model.sequential


# ============================================================
# LOAD AQI DATASET
# ============================================================

print("\n[4] Loading AQI dataset...")

df = pd.read_csv(
    DATA_PATH
)

df["date"] = pd.to_datetime(
    df["date"]
)

df = (
    df
    .sort_values(
        [
            "Station_No",
            "date"
        ]
    )
    .reset_index(drop=True)
)

print(
    "Dataset shape:",
    df.shape
)


# ============================================================
# CHECK REQUIRED COLUMNS
# ============================================================

required_columns = [
    "Station_No",
    "date",
    "PM2.5",
    "Temperature",
    "Humidity",
    "AQI",
]

missing_columns = [
    col
    for col in required_columns
    if col not in df.columns
]

if missing_columns:

    raise ValueError(
        "Missing columns: "
        f"{missing_columns}"
    )


# ============================================================
# SELECT VALID 24-HOUR INPUT WINDOW
# ============================================================

print(
    "\n[5] Searching for a valid "
    "24-hour input window..."
)


selected_station = None
selected_window = None


for station_id, station_df in df.groupby(
    "Station_No"
):

    station_df = (
        station_df
        .sort_values("date")
        .reset_index(drop=True)
    )

    # Need:
    # 24 hours input
    # +
    # 12 hours future target
    total_required = (
        LOOKBACK
        + FORECAST_HORIZON
    )

    if len(station_df) < total_required:
        continue


    for i in range(
        LOOKBACK,
        len(station_df) - FORECAST_HORIZON + 1
    ):

        # ----------------------------------------------------
        # Input: previous 24 hours
        # ----------------------------------------------------

        input_window = station_df.iloc[
            i - LOOKBACK:i
        ]


        # ----------------------------------------------------
        # Target: next 12 hours
        # ----------------------------------------------------

        target_window = station_df.iloc[
            i:i + FORECAST_HORIZON
        ]


        # ----------------------------------------------------
        # Require exactly 1-hour intervals
        # ----------------------------------------------------

        time_diff = (
            input_window["date"]
            .diff()
            .dropna()
        )

        if not (
            time_diff
            == pd.Timedelta(hours=1)
        ).all():

            continue


        # ----------------------------------------------------
        # Input cannot contain missing values
        # ----------------------------------------------------

        if (
            input_window[FEATURES]
            .isna()
            .any()
            .any()
        ):

            continue


        # ----------------------------------------------------
        # Future AQI must exist
        # ----------------------------------------------------

        if (
            target_window["AQI"]
            .isna()
            .any()
        ):

            continue


        # ----------------------------------------------------
        # Valid window found
        # ----------------------------------------------------

        selected_station = station_id
        selected_window = input_window.copy()

        break


    if selected_window is not None:
        break


if selected_window is None:

    raise RuntimeError(
        "Could not find a valid "
        "24-hour input window."
    )


print(
    "Selected Station:",
    selected_station
)

print(
    "Input period:",
    selected_window["date"].iloc[0],
    "->",
    selected_window["date"].iloc[-1]
)


# ============================================================
# PREPARE MODEL INPUT
# ============================================================

print(
    "\n[6] Preparing model input..."
)


# Raw input
x_raw = selected_window[
    FEATURES
].values


print(
    "Raw input shape:",
    x_raw.shape
)


# Scale using training scaler
x_scaled = x_scaler.transform(
    pd.DataFrame(
        x_raw,
        columns=FEATURES
    )
)


# Convert to float32
x_scaled = x_scaled.astype(
    np.float32
)


# Add batch dimension
# (24, 3) -> (1, 24, 3)
X = np.expand_dims(
    x_scaled,
    axis=0
)


print(
    "Model input shape:",
    X.shape
)


# ============================================================
# RUN MODEL E
# ============================================================

print(
    "\n[7] Running Model E prediction..."
)


prediction_scaled = model.predict(
    X,
    verbose=0
)


print(
    "Scaled prediction shape:",
    prediction_scaled.shape
)


# ============================================================
# INVERSE TRANSFORM
# ============================================================

prediction_scaled = (
    prediction_scaled
    .reshape(-1, 1)
)


prediction = (
    y_scaler
    .inverse_transform(
        prediction_scaled
    )
    .flatten()
)


# ============================================================
# CLIP AQI
# ============================================================

# AQI is limited to 0-500
prediction = np.clip(
    prediction,
    0,
    500
)


# Round for display/storage
prediction = np.round(
    prediction,
    2
)


# ============================================================
# FORECAST TIMESTAMPS
# ============================================================

last_input_time = (
    selected_window["date"].iloc[-1]
)


forecast_times = pd.date_range(
    start=(
        last_input_time
        + pd.Timedelta(hours=1)
    ),
    periods=FORECAST_HORIZON,
    freq="h"
)


# ============================================================
# CREATE FORECAST DATAFRAME
# ============================================================

forecast_df = pd.DataFrame(
    {
        "forecast_for": forecast_times,
        "aqi": prediction
    }
)


# ============================================================
# DISPLAY RESULTS
# ============================================================

print(
    "\n"
    + "=" * 70
)

print(
    "12-HOUR AQI FORECAST"
)

print(
    "=" * 70
)

print(
    forecast_df.to_string(
        index=False
    )
)


# ============================================================
# SAVE FORECAST
# ============================================================

output_dir = (
    BASE_DIR
    / "outputs"
    / "forecast"
)

output_dir.mkdir(
    parents=True,
    exist_ok=True
)


output_path = (
    output_dir
    / "forecast_test.csv"
)


forecast_df.to_csv(
    output_path,
    index=False
)


print(
    "\nForecast saved to:"
)

print(
    output_path
)


# ============================================================
# DONE
# ============================================================

print(
    "\nInference completed successfully."
)