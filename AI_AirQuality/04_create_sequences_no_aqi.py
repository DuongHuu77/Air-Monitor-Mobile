import os
import pickle
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

# ============================================================
# CONFIG - ABLATION MODEL B (WITHOUT PAST AQI)
# ============================================================

INPUT_FILE = "outputs/processed/air_quality_aqi.csv"
OUTPUT_DIR = "outputs/processed/sequences_no_aqi"

LOOKBACK = 24
FORECAST_HORIZON = 12

# IMPORTANT:
# AQI is removed from INPUT only.
# AQI remains the prediction TARGET.
FEATURES = [
    "PM2.5",
    "Temperature",
    "Humidity"
]

TARGET = "AQI"

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 60)
print("04A - CREATE CNN-LSTM ABLATION SEQUENCES")
print("MODEL B: WITHOUT PAST AQI")
print("=" * 60)

df = pd.read_csv(INPUT_FILE)

df["date"] = pd.to_datetime(df["date"])

df = df.sort_values(
    ["Station_No", "date"]
).reset_index(drop=True)

print(f"Input shape: {df.shape}")
print(f"Stations: {sorted(df['Station_No'].unique())}")

required_columns = ["Station_No", "date"] + FEATURES + [TARGET]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(f"Missing columns: {missing_columns}")


# ============================================================
# CREATE CONTINUOUS SEGMENTS
# ============================================================

def split_continuous_segments(station_df):
    """
    Split station data whenever timestamp is not exactly
    1 hour apart.

    This is intentionally identical to Model A.
    """

    station_df = station_df.sort_values("date").copy()

    time_diff = station_df["date"].diff()

    break_points = (
        time_diff != pd.Timedelta(hours=1)
    )

    segment_id = break_points.cumsum()

    segments = []

    for _, segment in station_df.groupby(segment_id):

        segment = segment.reset_index(drop=True)

        minimum_length = LOOKBACK + FORECAST_HORIZON

        if len(segment) >= minimum_length:
            segments.append(segment)

    return segments


# ============================================================
# FIRST PASS:
# DETERMINE TRAIN / VAL / TEST TIMELINE
# ============================================================

station_splits = {}

for station_id, station_df in df.groupby("Station_No"):

    station_df = station_df.sort_values("date").reset_index(drop=True)

    n = len(station_df)

    train_end = int(n * TRAIN_RATIO)
    val_end = int(n * (TRAIN_RATIO + VAL_RATIO))

    train_df = station_df.iloc[:train_end].copy()
    val_df = station_df.iloc[train_end:val_end].copy()
    test_df = station_df.iloc[val_end:].copy()

    station_splits[station_id] = {
        "train": train_df,
        "val": val_df,
        "test": test_df
    }

    print(
        f"\nStation {station_id}:"
        f"\n  Total: {n}"
        f"\n  Train: {len(train_df)}"
        f"\n  Val:   {len(val_df)}"
        f"\n  Test:  {len(test_df)}"
    )


# ============================================================
# FIT SCALERS ONLY ON TRAIN DATA
# ============================================================

train_all = pd.concat(
    [
        splits["train"]
        for splits in station_splits.values()
    ],
    ignore_index=True
)

# X scaler: only Model B input features.
train_x_complete = train_all[FEATURES].dropna()

# y scaler: AQI target, same target definition as Model A.
train_y_complete = train_all[[TARGET]].dropna()

print(
    f"\nTraining rows used for X scaler: "
    f"{len(train_x_complete)}"
)

print(
    f"Training rows used for y scaler: "
    f"{len(train_y_complete)}"
)

x_scaler = StandardScaler()
x_scaler.fit(train_x_complete[FEATURES])

y_scaler = StandardScaler()
y_scaler.fit(train_y_complete[[TARGET]])

print("\nScalers fitted using TRAIN data only.")


# ============================================================
# CREATE SEQUENCES
# ============================================================

def create_sequences(segment, x_scaler, y_scaler):

    X = []
    y = []

    segment = segment.sort_values("date").reset_index(drop=True)

    x_values = segment[FEATURES].values
    y_values = segment[TARGET].values

    for i in range(
        LOOKBACK,
        len(segment) - FORECAST_HORIZON + 1
    ):

        x_window = x_values[
            i - LOOKBACK:i
        ]

        y_window = y_values[
            i:i + FORECAST_HORIZON
        ]

        # Skip windows containing missing input values.
        if np.isnan(x_window).any():
            continue

        # Skip windows containing missing target values.
        if np.isnan(y_window).any():
            continue

        x_scaled = x_scaler.transform(
            pd.DataFrame(
                x_window,
                columns=FEATURES
            )
        )

        y_scaled = y_scaler.transform(
            pd.DataFrame(
                y_window.reshape(-1, 1),
                columns=[TARGET]
            )
        ).flatten()

        X.append(x_scaled)
        y.append(y_scaled)

    return (
        np.array(X, dtype=np.float32),
        np.array(y, dtype=np.float32)
    )


# ============================================================
# BUILD DATASETS
# ============================================================

datasets = {
    "train": [],
    "val": [],
    "test": []
}

for station_id, splits in station_splits.items():

    print(f"\nProcessing Station {station_id}...")

    for split_name in ["train", "val", "test"]:

        split_df = splits[split_name]

        # IMPORTANT:
        # Split again at timestamp gaps exactly like Model A.
        segments = split_continuous_segments(split_df)

        station_X = []
        station_y = []

        for segment in segments:

            X_seg, y_seg = create_sequences(
                segment,
                x_scaler,
                y_scaler
            )

            if len(X_seg) > 0:
                station_X.append(X_seg)
                station_y.append(y_seg)

        if station_X:

            X_station = np.concatenate(
                station_X,
                axis=0
            )

            y_station = np.concatenate(
                station_y,
                axis=0
            )

            datasets[split_name].append(
                (
                    X_station,
                    y_station
                )
            )

            print(
                f"  {split_name}: "
                f"{len(X_station)} sequences"
            )

        else:

            print(
                f"  {split_name}: "
                f"0 sequences"
            )


# ============================================================
# MERGE STATIONS
# ============================================================

final_data = {}

for split_name in ["train", "val", "test"]:

    parts = datasets[split_name]

    if not parts:
        raise RuntimeError(
            f"No sequences created for {split_name}"
        )

    X = np.concatenate(
        [part[0] for part in parts],
        axis=0
    )

    y = np.concatenate(
        [part[1] for part in parts],
        axis=0
    )

    final_data[split_name] = {
        "X": X,
        "y": y
    }

    print(
        f"\n{split_name.upper()}:"
        f"\n  X shape = {X.shape}"
        f"\n  y shape = {y.shape}"
    )


# ============================================================
# SAVE
# ============================================================

os.makedirs(OUTPUT_DIR, exist_ok=True)

for split_name in ["train", "val", "test"]:

    np.save(
        os.path.join(
            OUTPUT_DIR,
            f"X_{split_name}.npy"
        ),
        final_data[split_name]["X"]
    )

    np.save(
        os.path.join(
            OUTPUT_DIR,
            f"y_{split_name}.npy"
        ),
        final_data[split_name]["y"]
    )

with open(
    os.path.join(OUTPUT_DIR, "x_scaler.pkl"),
    "wb"
) as f:
    pickle.dump(x_scaler, f)

with open(
    os.path.join(OUTPUT_DIR, "y_scaler.pkl"),
    "wb"
) as f:
    pickle.dump(y_scaler, f)

config = {
    "lookback": LOOKBACK,
    "forecast_horizon": FORECAST_HORIZON,
    "features": FEATURES,
    "target": TARGET,
    "train_ratio": TRAIN_RATIO,
    "val_ratio": VAL_RATIO,
    "test_ratio": TEST_RATIO,
    "ablation": "without_past_aqi"
}

with open(
    os.path.join(OUTPUT_DIR, "config.pkl"),
    "wb"
) as f:
    pickle.dump(config, f)


# ============================================================
# FINAL SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("MODEL B SEQUENCE CREATION COMPLETED")
print("=" * 60)

for split_name in ["train", "val", "test"]:

    X = final_data[split_name]["X"]
    y = final_data[split_name]["y"]

    print(
        f"{split_name.upper():5s} "
        f"X={X.shape}, "
        f"y={y.shape}"
    )

print("\nOutput directory:")
print(OUTPUT_DIR)

print("\nExpected format:")
print("  X = (samples, 24, 3)")
print("  y = (samples, 12)")
