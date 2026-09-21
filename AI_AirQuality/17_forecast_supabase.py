"""
17_forecast_supabase.py

Model E - CNN-LSTM Weighted Huber
---------------------------------
Pipeline:

Supabase air_quality_readings
        ↓
Hourly aggregation
        ↓
Find 24 consecutive hours
        ↓
PM2.5 + Temperature + Humidity
        ↓
StandardScaler
        ↓
Model E
        ↓
12-hour AQI forecast
        ↓
Supabase air_quality_forecasts
"""

from pathlib import Path
import os
import pickle

import numpy as np
import pandas as pd
import tensorflow as tf
from dotenv import load_dotenv
from supabase import create_client, Client


# ============================================================
# 1. PATH CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

SEQUENCE_DIR = BASE_DIR / "outputs" / "processed" / "sequences_no_aqi"

WEIGHTS_PATH = (
    BASE_DIR
    / "outputs"
    / "models"
    / "weighted_huber"
    / "best_cnn_lstm_weighted_huber.weights.h5"
)

X_SCALER_PATH = SEQUENCE_DIR / "x_scaler.pkl"
Y_SCALER_PATH = SEQUENCE_DIR / "y_scaler.pkl"


# ============================================================
# 2. MODEL CONFIGURATION
# ============================================================

LOOKBACK = 24
FORECAST_HORIZON = 12
FETCH_HOURS = 72

FEATURES = [
    "pm25",
    "temperature",
    "humidity",
]

MODEL_VERSION = "CNN-LSTM-WeightedHuber-E"
PREDICTION_METHOD = "CNN-LSTM"
AQI_STANDARD = "VN_AQI"
AQI_SCOPE = "PM2.5"
INPUT_MODE = "PM2.5 + Temperature + Humidity"


# ============================================================
# 3. SUPABASE CONFIGURATION
# ============================================================

load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL:
    raise ValueError(
        "SUPABASE_URL is missing. "
        "Please add SUPABASE_URL to your .env file."
    )

if not SUPABASE_KEY:
    raise ValueError(
        "SUPABASE_SECRET_KEY is missing. "
        "Please add SUPABASE_SECRET_KEY to your .env file."
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
)


# ============================================================
# 4. DEVICE CONFIGURATION
# ============================================================

# Device đang có dữ liệu trong Supabase.
DEVICE_ID = "e224eb59-8a23-407b-a307-67f9f8b2591b"


# ============================================================
# 5. RANDOM / NUMPY SETTINGS
# ============================================================

np.set_printoptions(precision=4, suppress=True)


# ============================================================
# 6. BUILD MODEL E
# ============================================================

def build_base_model():
    """
    Recreate exactly the same architecture as Model E.
    """

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(
                shape=(LOOKBACK, 3)
            ),

            tf.keras.layers.Conv1D(
                filters=64,
                kernel_size=3,
                activation="relu",
                padding="same",
            ),

            tf.keras.layers.MaxPooling1D(
                pool_size=2
            ),

            tf.keras.layers.LSTM(
                64,
                return_sequences=True,
            ),

            tf.keras.layers.Dropout(
                0.2
            ),

            tf.keras.layers.LSTM(
                32
            ),

            tf.keras.layers.Dropout(
                0.2
            ),

            tf.keras.layers.Dense(
                64,
                activation="relu",
            ),

            tf.keras.layers.Dense(
                FORECAST_HORIZON
            ),
        ],
        name="sequential",
    )

    model.build(
        input_shape=(None, LOOKBACK, 3)
    )

    return model


# ============================================================
# 7. WEIGHTED HUBER WRAPPER
# ============================================================

class WeightedHuberModel(tf.keras.Model):

    def __init__(self, model):
        super().__init__()

        self.sequential = model

    def call(
        self,
        inputs,
        training=False,
    ):
        return self.sequential(
            inputs,
            training=training,
        )


# ============================================================
# 8. LOAD MODEL
# ============================================================

def load_model_e():

    print("[1] Loading Model E...")

    if not WEIGHTS_PATH.exists():
        raise FileNotFoundError(
            f"Model weights not found:\n{WEIGHTS_PATH}"
        )

    base_model = build_base_model()

    weighted_model = WeightedHuberModel(
        base_model
    )

    weighted_model.build(
        input_shape=(
            None,
            LOOKBACK,
            3,
        )
    )

    weighted_model.load_weights(
        WEIGHTS_PATH
    )

    print("Model E weights loaded successfully.")

    return weighted_model.sequential


# ============================================================
# 9. LOAD SCALERS
# ============================================================

def load_scalers():

    print("[2] Loading scalers...")

    if not X_SCALER_PATH.exists():
        raise FileNotFoundError(
            f"X scaler not found:\n{X_SCALER_PATH}"
        )

    if not Y_SCALER_PATH.exists():
        raise FileNotFoundError(
            f"Y scaler not found:\n{Y_SCALER_PATH}"
        )

    with open(
        X_SCALER_PATH,
        "rb",
    ) as f:

        x_scaler = pickle.load(f)

    with open(
        Y_SCALER_PATH,
        "rb",
    ) as f:

        y_scaler = pickle.load(f)

    print(
        f"X scaler features: "
        f"{x_scaler.n_features_in_}"
    )

    print(
        f"Y scaler features: "
        f"{y_scaler.n_features_in_}"
    )

    return x_scaler, y_scaler


# ============================================================
# 10. FETCH SUPABASE READINGS
# ============================================================

def fetch_readings():
    """
    Fetch only the latest FETCH_HOURS of raw sensor readings.

    Because Supabase/PostgREST limits the number of rows returned
    per request, pagination is still used.

    Strategy:
        1. Fetch the newest page.
        2. Get the newest recorded_at timestamp.
        3. Calculate the earliest timestamp we need.
        4. Fetch only records inside that time range.
    """

    print("[3] Fetching latest sensor readings from Supabase...")

    PAGE_SIZE = 1000

    # --------------------------------------------------------
    # Step 1: Get the newest reading
    # --------------------------------------------------------

    response = (
        supabase
        .table("air_quality_readings")
        .select(
            """
            device_id,
            recorded_at,
            temperature,
            humidity,
            pm25,
            aqi
            """
        )
        .eq("device_id", DEVICE_ID)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"No readings found for device {DEVICE_ID}."
        )

    latest_record = response.data[0]

    latest_time = pd.to_datetime(
        latest_record["recorded_at"],
        utc=True,
    )

    earliest_time = (
        latest_time
        - pd.Timedelta(hours=FETCH_HOURS)
    )

    print(f"Latest sensor record : {latest_time}")
    print(f"Fetch window          : {earliest_time}")
    print(f"                      -> {latest_time}")

    # --------------------------------------------------------
    # Step 2: Fetch only this time range
    # --------------------------------------------------------

    all_rows = []
    offset = 0

    while True:

        response = (
            supabase
            .table("air_quality_readings")
            .select(
                """
                device_id,
                recorded_at,
                temperature,
                humidity,
                pm25,
                aqi
                """
            )
            .eq("device_id", DEVICE_ID)
            .gte(
                "recorded_at",
                earliest_time.isoformat(),
            )
            .lte(
                "recorded_at",
                latest_time.isoformat(),
            )
            .order(
                "recorded_at",
                desc=False,
            )
            .range(
                offset,
                offset + PAGE_SIZE - 1,
            )
            .execute()
        )

        rows = response.data

        if not rows:
            break

        all_rows.extend(rows)

        print(
            f"  Fetched rows "
            f"{offset + 1} -> "
            f"{offset + len(rows)}"
        )

        if len(rows) < PAGE_SIZE:
            break

        offset += PAGE_SIZE

    if not all_rows:
        raise RuntimeError(
            "No sensor readings found in the latest "
            f"{FETCH_HOURS} hours."
        )

    df = pd.DataFrame(all_rows)

    print(
        f"Total recent Supabase records: "
        f"{len(df)}"
    )

    return df


# ============================================================
# 11. PREPARE RAW DATA
# ============================================================

def prepare_dataframe(df):

    required_columns = [
        "device_id",
        "recorded_at",
        "temperature",
        "humidity",
        "pm25",
    ]

    missing_columns = [
        col
        for col in required_columns
        if col not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing columns: "
            + ", ".join(missing_columns)
        )

    df = df.copy()

    # Keep timezone information.
    df["recorded_at"] = pd.to_datetime(
        df["recorded_at"],
        utc=True,
        errors="coerce",
    )

    numeric_columns = [
        "temperature",
        "humidity",
        "pm25",
    ]

    for column in numeric_columns:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    # Remove invalid rows.
    df = df.dropna(
        subset=[
            "recorded_at",
            "temperature",
            "humidity",
            "pm25",
        ]
    )

    # Sort chronologically.
    df = df.sort_values(
        "recorded_at"
    ).reset_index(drop=True)

    return df


# ============================================================
# 12. AGGREGATE SENSOR DATA TO HOURLY
# ============================================================

def aggregate_hourly(df):

    print("[4] Aggregating sensor data to hourly...")

    # Round down to the beginning of each hour.
    df["hour"] = (
        df["recorded_at"]
        .dt.floor("h")
    )

    hourly = (
        df.groupby("hour")
        .agg(
            pm25=("pm25", "mean"),
            temperature=("temperature", "mean"),
            humidity=("humidity", "mean"),
            samples=("pm25", "count"),
        )
        .reset_index()
    )

    hourly = hourly.sort_values(
        "hour"
    ).reset_index(drop=True)

    print(
        f"Hourly observations: {len(hourly)}"
    )

    return hourly


# ============================================================
# 13. FIND 24 CONSECUTIVE HOURS
# ============================================================

def print_hourly_gaps(hourly_df):
    """Print missing hourly timestamps in the fetched time range."""

    if hourly_df.empty:
        print("\nHourly gaps: no hourly data available.")
        return

    hours = (
        pd.to_datetime(hourly_df["hour"], utc=True)
        .drop_duplicates()
        .sort_values()
    )

    if len(hours) < 2:
        print("\nHourly gaps: not enough hourly observations to check.")
        return

    expected = pd.date_range(
        start=hours.iloc[0],
        end=hours.iloc[-1],
        freq="1h",
        tz="UTC",
    )

    actual = pd.DatetimeIndex(hours)
    missing = expected.difference(actual)

    print("\nHourly gaps:")
    print(f"  Expected hours : {len(expected)}")
    print(f"  Actual hours   : {len(actual)}")
    print(f"  Missing hours  : {len(missing)}")

    if len(missing) == 0:
        print("  No missing hours.")
        return

    print("\n  Missing timestamps:")
    for ts in missing:
        print(f"    - {ts}")

    # Group consecutive missing hours
    missing_list = list(missing)
    groups = []

    start = missing_list[0]
    prev = missing_list[0]

    for ts in missing_list[1:]:
        if ts - prev == pd.Timedelta(hours=1):
            prev = ts
        else:
            groups.append((start, prev))
            start = ts
            prev = ts

    groups.append((start, prev))

    print("\n  Missing ranges:")
    for start, end in groups:
        count = int(
            (end - start) / pd.Timedelta(hours=1)
        ) + 1

        if count == 1:
            print(f"    - {start}")
        else:
            print(
                f"    - {start} -> {end} "
                f"({count} consecutive hours)"
            )


def find_latest_continuous_window(
    hourly_df,
    lookback=24,
):
    """
    Find the latest continuous hourly window.

    Requirements:
        - Exactly `lookback` consecutive hourly timestamps
        - No missing hour
        - All model features must be available

    Missing hours are NOT interpolated.
    """

    if len(hourly_df) < lookback:
        raise RuntimeError(
            f"Only {len(hourly_df)} hourly observations available. "
            f"Need at least {lookback}."
        )

    df = hourly_df.copy()

    df["hour"] = pd.to_datetime(
        df["hour"],
        utc=True,
        errors="coerce",
    )

    df = (
        df
        .dropna(subset=["hour"])
        .sort_values("hour")
        .drop_duplicates(
            subset=["hour"],
            keep="last",
        )
        .reset_index(drop=True)
    )

    # Search from the newest possible window backwards.
    for end_idx in range(
        len(df) - 1,
        lookback - 2,
        -1,
    ):
        start_idx = end_idx - lookback + 1

        window = df.iloc[
            start_idx:end_idx + 1
        ].copy()

        timestamps = pd.DatetimeIndex(
            window["hour"]
        )

        expected = pd.date_range(
            start=timestamps[0],
            periods=lookback,
            freq="h",
            tz="UTC",
        )

        # Check hourly continuity.
        if not timestamps.equals(expected):
            continue

        # Check model features.
        if window[FEATURES].isnull().any().any():
            continue

        print("Continuous window found:")
        print(
            f"Start: {window['hour'].iloc[0]}"
        )
        print(
            f"End:   {window['hour'].iloc[-1]}"
        )

        return window

    raise RuntimeError(
        f"No {lookback}-hour continuous window "
        f"found in the latest {FETCH_HOURS} hours. "
        "Missing hours are not interpolated."
    )


# ============================================================
# 14. PREPARE MODEL INPUT
# ============================================================

def prepare_model_input(
    window,
    x_scaler,
):
    print("[6] Preparing model input...")

    raw_input = window[FEATURES].copy()

    print(
        f"Raw input shape: {raw_input.shape}"
    )

    if raw_input.shape != (
        LOOKBACK,
        3,
    ):
        raise ValueError(
            f"Unexpected input shape: "
            f"{raw_input.shape}"
        )

    # The scaler was fitted using feature names.
    # Keep the DataFrame here to avoid sklearn's
    # "X does not have valid feature names" warning.
    scaled_values = x_scaler.transform(
        raw_input
    )

    model_input = np.expand_dims(
        scaled_values,
        axis=0,
    ).astype(
        np.float32
    )

    print(
        f"Model input shape: "
        f"{model_input.shape}"
    )

    return model_input


# ============================================================
# 15. PREDICT 12 HOURS
# ============================================================

def predict_aqi(
    model,
    model_input,
    y_scaler,
):

    print("[7] Running Model E prediction...")

    prediction_scaled = model.predict(
        model_input,
        verbose=0,
    )

    print(
        f"Scaled prediction shape: "
        f"{prediction_scaled.shape}"
    )

    if prediction_scaled.shape != (
        1,
        FORECAST_HORIZON,
    ):

        raise ValueError(
            "Unexpected prediction shape: "
            f"{prediction_scaled.shape}"
        )

    # Inverse transform.
    prediction = y_scaler.inverse_transform(
        prediction_scaled.reshape(
            -1,
            1,
        )
    ).reshape(
        1,
        FORECAST_HORIZON,
    )

    # AQI valid range.
    prediction = np.clip(
        prediction,
        0,
        500,
    )

    prediction = prediction[0]

    return prediction


# ============================================================
# 16. AQI CATEGORY
# ============================================================

def get_aqi_level(aqi):

    if aqi <= 50:
        return "Tốt"

    if aqi <= 100:
        return "Trung bình"

    if aqi <= 150:
        return "Kém"

    if aqi <= 200:
        return "Xấu"

    if aqi <= 300:
        return "Rất xấu"

    return "Nguy hại"


# ============================================================
# 17. AQI COLOR
# ============================================================

def get_aqi_color(aqi):

    if aqi <= 50:
        return "#00E400"

    if aqi <= 100:
        return "#FFFF00"

    if aqi <= 150:
        return "#FF7E00"

    if aqi <= 200:
        return "#FF0000"

    if aqi <= 300:
        return "#8F3F97"

    return "#7E0023"


# ============================================================
# 18. HEALTH MESSAGE
# ============================================================

def get_health_message(aqi):

    if aqi <= 50:
        return "Chất lượng không khí tốt."

    if aqi <= 100:
        return (
            "Chất lượng không khí ở mức trung bình."
        )

    if aqi <= 150:
        return (
            "Chất lượng không khí kém. "
            "Người nhạy cảm nên hạn chế tiếp xúc lâu."
        )

    if aqi <= 200:
        return (
            "Chất lượng không khí xấu. "
            "Nên hạn chế hoạt động ngoài trời."
        )

    if aqi <= 300:
        return (
            "Chất lượng không khí rất xấu. "
            "Nên hạn chế tối đa tiếp xúc ngoài trời."
        )

    return (
        "Chất lượng không khí nguy hại."
    )


# ============================================================
# 19. BUILD FORECAST RECORDS
# ============================================================

def build_forecast_records(
    prediction,
    base_time,
):

    print("[8] Building forecast records...")

    records = []

    created_at = pd.Timestamp.now(
        tz="UTC"
    )

    for i, value in enumerate(
        prediction,
        start=1,
    ):

        forecast_time = (
            base_time
            + pd.Timedelta(
                hours=i
            )
        )

        aqi_value = int(
            round(
                float(value)
            )
        )

        aqi_value = max(
            0,
            min(
                500,
                aqi_value,
            ),
        )

        record = {
            "device_id": DEVICE_ID,

            "forecast_for":
                forecast_time.isoformat(),

            "aqi":
                aqi_value,

            "created_at":
                created_at.isoformat(),

            "base_time":
                base_time.isoformat(),

            "horizon_hours":
                i,

            "aqi_level":
                get_aqi_level(
                    aqi_value
                ),

            "aqi_color_rgb":
                get_aqi_color(
                    aqi_value
                ),

            "health_message":
                get_health_message(
                    aqi_value
                ),

            "prediction_method":
                PREDICTION_METHOD,

            "aqi_standard":
                AQI_STANDARD,

            "aqi_scope":
                AQI_SCOPE,

            "model_version":
                MODEL_VERSION,

            "input_lookback_hours":
                LOOKBACK,

            "input_mode":
                INPUT_MODE,
        }

        records.append(record)

    return records


# ============================================================
# 20. DELETE OLD FORECASTS
# ============================================================

def delete_old_forecasts(base_time):
    """
    Remove only the forecast rows that overlap the new
    12-hour forecast period.

    Historical forecasts outside this period are preserved.
    """

    print(
        "[9] Removing existing forecasts "
        "for the new forecast period..."
    )

    forecast_start = (
        base_time
        + pd.Timedelta(hours=1)
    )

    forecast_end = (
        base_time
        + pd.Timedelta(hours=FORECAST_HORIZON)
    )

    (
        supabase
        .table("air_quality_forecasts")
        .delete()
        .eq("device_id", DEVICE_ID)
        .gte(
            "forecast_for",
            forecast_start.isoformat(),
        )
        .lte(
            "forecast_for",
            forecast_end.isoformat(),
        )
        .execute()
    )

    print("Existing forecast period cleaned.")


# ============================================================
# 21. INSERT FORECASTS
# ============================================================

def insert_forecasts(records):

    print(
        "[10] Inserting 12 forecast records..."
    )

    response = (
        supabase
        .table(
            "air_quality_forecasts"
        )
        .insert(records)
        .execute()
    )

    inserted = response.data

    if inserted is None:
        raise RuntimeError(
            "Supabase returned no inserted data."
        )

    print(
        f"Inserted records: "
        f"{len(inserted)}"
    )

    return inserted


# ============================================================
# 22. PRINT FORECAST
# ============================================================

def print_forecast(
    records,
    base_time,
):

    print()
    print("=" * 70)
    print(
        "MODEL E - 12-HOUR AQI FORECAST"
    )
    print("=" * 70)

    print(
        f"Device ID : {DEVICE_ID}"
    )

    print(
        f"Base time : {base_time}"
    )

    print()

    for record in records:

        print(
            f"H+{record['horizon_hours']:02d} | "
            f"{record['forecast_for']} | "
            f"AQI = {record['aqi']:3d} | "
            f"{record['aqi_level']}"
        )

    print("=" * 70)


# ============================================================
# 23. MAIN
# ============================================================

def main():

    print()
    print("=" * 70)
    print(
        "AIR QUALITY - SUPABASE FORECAST PIPELINE"
    )
    print("=" * 70)
    print()

    # --------------------------------------------------------
    # Load model
    # --------------------------------------------------------

    model = load_model_e()

    print()

    # --------------------------------------------------------
    # Load scalers
    # --------------------------------------------------------

    x_scaler, y_scaler = load_scalers()

    print()

    # --------------------------------------------------------
    # Fetch Supabase
    # --------------------------------------------------------

    df = fetch_readings()

    print()

    # --------------------------------------------------------
    # Prepare dataframe
    # --------------------------------------------------------

    df = prepare_dataframe(
        df
    )

    print(
        f"Valid sensor records: "
        f"{len(df)}"
    )

    print()

    # --------------------------------------------------------
    # Aggregate hourly
    # --------------------------------------------------------

    hourly = aggregate_hourly(
        df
    )

    print_hourly_gaps(hourly)

    print()

    # --------------------------------------------------------
    # Find latest continuous window
    # --------------------------------------------------------

    window = find_latest_continuous_window(
        hourly,
        LOOKBACK,
    )

    print()

    # --------------------------------------------------------
    # Prepare model input
    # --------------------------------------------------------

    model_input = prepare_model_input(
        window,
        x_scaler,
    )

    print()

    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------

    prediction = predict_aqi(
        model,
        model_input,
        y_scaler,
    )

    print()

    # --------------------------------------------------------
    # Base time
    # --------------------------------------------------------

    base_time = pd.Timestamp(
        window["hour"].iloc[-1]
    )

    # --------------------------------------------------------
    # Build records
    # --------------------------------------------------------

    records = build_forecast_records(
        prediction,
        base_time,
    )

    # --------------------------------------------------------
    # Print prediction
    # --------------------------------------------------------

    print_forecast(
        records,
        base_time,
    )

    print()

    # --------------------------------------------------------
    # Upload
    # --------------------------------------------------------

    delete_old_forecasts(
        base_time
    )

    insert_forecasts(
        records
    )

    print()

    print(
        "Forecast uploaded successfully."
    )

    print(
        "Table: air_quality_forecasts"
    )

    print()
    print(
        "Pipeline completed successfully."
    )


# ============================================================
# 24. ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()