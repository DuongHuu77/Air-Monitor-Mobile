import pandas as pd
import numpy as np
from pathlib import Path


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = BASE_DIR / "data" / "Air Quality Ho Chi Minh City.csv"
OUTPUT_DIR = BASE_DIR / "outputs" / "processed"

OUTPUT_PATH = OUTPUT_DIR / "air_quality_preprocessed.csv"

MAX_INTERPOLATION_HOURS = 3

NUMERIC_COLS = [
    "TSP",
    "PM2.5",
    "O3",
    "CO",
    "NO2",
    "SO2",
    "Temperature",
    "Humidity"
]


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("AIR QUALITY DATA PREPROCESSING")
print("=" * 70)

print("\n[1] Loading dataset...")

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)


# ============================================================
# BASIC CLEANING
# ============================================================

print("\n[2] Basic cleaning...")

# Convert date to datetime
df["date"] = pd.to_datetime(
    df["date"],
    format="%d-%m-%Y %H:%M",
    errors="coerce"
)

# Convert numeric columns
for col in NUMERIC_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Remove rows with invalid timestamps
invalid_dates = df["date"].isna().sum()

if invalid_dates > 0:
    print("Removing invalid dates:", invalid_dates)
    df = df.dropna(subset=["date"])


# Sort data
df = df.sort_values(
    ["Station_No", "date"]
).reset_index(drop=True)


# Remove exact duplicates
duplicate_count = df.duplicated().sum()

print("Duplicate rows:", duplicate_count)

if duplicate_count > 0:
    df = df.drop_duplicates()


# ============================================================
# NEGATIVE VALUES
# ============================================================

print("\n[3] Checking negative values...")

negative_summary = {}

for col in NUMERIC_COLS:
    count = (df[col] < 0).sum()
    negative_summary[col] = count

    if count > 0:
        print(f"{col:12s}: {count}")

total_negative = sum(negative_summary.values())

print("Total negative values:", total_negative)

# Dataset currently has no negative values,
# so we do not modify anything here.


# ============================================================
# SHORT MISSING VALUE INTERPOLATION
# ============================================================

print("\n[4] Interpolating short missing gaps...")
print(
    f"Maximum interpolation length: "
    f"{MAX_INTERPOLATION_HOURS} hours"
)


# Keep track of values that were originally missing
# and later interpolated.
for col in NUMERIC_COLS:
    df[f"{col}_interpolated"] = False


processed_stations = []


for station in sorted(df["Station_No"].unique()):

    station_df = df[
        df["Station_No"] == station
    ].copy()

    station_df = station_df.sort_values("date")

    print(f"\n--- Station {station} ---")

    for col in NUMERIC_COLS:

        original_missing = station_df[col].isna()

        # Interpolate ONLY short internal gaps.
        interpolated_values = station_df[col].interpolate(
            method="linear",
            limit=MAX_INTERPOLATION_HOURS,
            limit_area="inside"
        )

        # Values that were NaN before but are now filled
        was_interpolated = (
            original_missing &
            interpolated_values.notna()
        )

        station_df.loc[:, col] = interpolated_values

        station_df.loc[
            was_interpolated.index,
            f"{col}_interpolated"
        ] = was_interpolated

        print(
            f"{col:12s} | "
            f"original missing = {original_missing.sum():5d} | "
            f"interpolated = {was_interpolated.sum():5d} | "
            f"remaining missing = {station_df[col].isna().sum():5d}"
        )

    processed_stations.append(station_df)


# Combine stations again
df = pd.concat(
    processed_stations,
    ignore_index=True
)

df = df.sort_values(
    ["Station_No", "date"]
).reset_index(drop=True)


# ============================================================
# TIMESTAMP GAP DETECTION
# ============================================================

print("\n" + "=" * 70)
print("[5] Detecting timestamp gaps")
print("=" * 70)

df["hours_from_previous"] = (
    df.groupby("Station_No")["date"]
    .diff()
    .dt.total_seconds()
    / 3600
)


# A new sequence must start when:
# - it is the first record of a station
# - previous timestamp gap > 1 hour

df["sequence_break"] = (
    df["hours_from_previous"].isna()
    |
    (df["hours_from_previous"] > 1)
)


# Count gaps
for station in sorted(df["Station_No"].unique()):

    station_df = df[
        df["Station_No"] == station
    ]

    gaps = station_df[
        station_df["hours_from_previous"] > 1
    ]["hours_from_previous"]

    print(f"\nStation {station}")
    print("Records:", len(station_df))
    print("Gaps > 1 hour:", len(gaps))

    if len(gaps) > 0:
        print(
            "Largest gap:",
            f"{gaps.max():.2f} hours"
        )

        print(
            "Median gap:",
            f"{gaps.median():.2f} hours"
        )


# ============================================================
# REMAINING MISSING VALUES
# ============================================================

print("\n" + "=" * 70)
print("[6] Remaining missing values")
print("=" * 70)

for station in sorted(df["Station_No"].unique()):

    station_df = df[
        df["Station_No"] == station
    ]

    print(f"\nStation {station}")

    for col in NUMERIC_COLS:

        missing = station_df[col].isna().sum()

        if missing > 0:
            print(
                f"{col:12s}: {missing:5d}"
            )


# ============================================================
# PM2.5 CHECK
# ============================================================

print("\n" + "=" * 70)
print("[7] PM2.5 quality check")
print("=" * 70)

pm25_missing = df["PM2.5"].isna().sum()

print("PM2.5 missing:", pm25_missing)

print(
    "PM2.5 coverage:",
    f"{(1 - pm25_missing / len(df)) * 100:.2f}%"
)


# ============================================================
# SAVE
# ============================================================

print("\n" + "=" * 70)
print("[8] Saving processed dataset")
print("=" * 70)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("Output file:")
print(OUTPUT_PATH)

print("\nFinal shape:", df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nPreprocessing completed successfully.")