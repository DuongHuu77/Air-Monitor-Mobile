import pandas as pd
import numpy as np

DATA_PATH = "D:/Mobile/AI_AirQuality/data/Air Quality Ho Chi Minh City.csv"

df = pd.read_csv(DATA_PATH)

print("=" * 60)
print("DATASET INFORMATION")
print("=" * 60)

print("Shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

print("\nData types:")
print(df.dtypes)

print("\nFirst 5 rows:")
print(df.head())

# --------------------------------------------------
# Timestamp
# --------------------------------------------------

df["date"] = pd.to_datetime(
    df["date"],
    format="%d-%m-%Y %H:%M"
)

print("\nTime range:")
print("Start:", df["date"].min())
print("End  :", df["date"].max())

# --------------------------------------------------
# Station
# --------------------------------------------------

print("\nRecords per station:")
print(df["Station_No"].value_counts().sort_index())

# --------------------------------------------------
# Missing values
# --------------------------------------------------

print("\nMissing values:")
print(df.isna().sum())

print("\nMissing percentage:")
print(
    (df.isna().mean() * 100)
    .round(2)
    .sort_values(ascending=False)
)

# --------------------------------------------------
# Negative values
# --------------------------------------------------

numeric_cols = [
    "TSP",
    "PM2.5",
    "O3",
    "CO",
    "NO2",
    "SO2",
    "Temperature",
    "Humidity"
]

print("\nNegative values:")
print((df[numeric_cols] < 0).sum())

# --------------------------------------------------
# Duplicate
# --------------------------------------------------

print("\nDuplicate rows:")
print(df.duplicated().sum())

print("\nDuplicate Station + Timestamp:")
print(
    df.duplicated(
        subset=["Station_No", "date"]
    ).sum()
)

# --------------------------------------------------
# Statistics
# --------------------------------------------------

print("\nStatistics:")
print(df[numeric_cols].describe().T)

# --------------------------------------------------
# Missing Streak
# --------------------------------------------------

print("\n" + "=" * 60)
print("MISSING VALUE STREAK ANALYSIS")
print("=" * 60)

df = df.sort_values(["Station_No", "date"]).reset_index(drop=True)

check_cols = [
    "TSP",
    "PM2.5",
    "O3",
    "CO",
    "NO2",
    "SO2",
    "Temperature",
    "Humidity"
]

for station in sorted(df["Station_No"].unique()):

    print(f"\n========== STATION {station} ==========")

    station_df = df[df["Station_No"] == station].copy()

    for col in check_cols:

        missing = station_df[col].isna()

        # Tạo nhóm liên tiếp của missing/non-missing
        groups = missing.ne(missing.shift()).cumsum()

        streaks = (
            missing
            .groupby(groups)
            .sum()
        )

        streaks = streaks[streaks > 0]

        if len(streaks) > 0:
            print(
                f"{col:12s} | "
                f"missing={missing.sum():5d} | "
                f"max_streak={int(streaks.max()):4d} hours"
            )
        else:
            print(
                f"{col:12s} | "
                f"missing=0"
            )


# --------------------------------------------------
# Gap Timestamp
# --------------------------------------------------

print("\n" + "=" * 60)
print("TIMESTAMP GAP ANALYSIS")
print("=" * 60)

for station in sorted(df["Station_No"].unique()):

    station_df = (
        df[df["Station_No"] == station]
        .sort_values("date")
    )

    diff = station_df["date"].diff()

    gaps = diff[diff > pd.Timedelta(hours=1)]

    print(f"\nStation {station}")
    print("Total records:", len(station_df))
    print("Gaps > 1 hour:", len(gaps))

    if len(gaps) > 0:
        print("Largest gap:", gaps.max())
        print("Average gap:", gaps.mean())