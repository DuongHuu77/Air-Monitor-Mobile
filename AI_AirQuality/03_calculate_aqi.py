import pandas as pd
import numpy as np
from pathlib import Path


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "processed"
    / "air_quality_preprocessed.csv"
)

OUTPUT_DIR = BASE_DIR / "outputs" / "processed"

OUTPUT_PATH = (
    OUTPUT_DIR
    / "air_quality_aqi.csv"
)

PM25_COLUMN = "PM2.5"

# VN_AQI PM2.5 breakpoints
#
# AQI:
# 0     -> 0
# 50    -> 25 µg/m3
# 100   -> 50 µg/m3
# 150   -> 80 µg/m3
# 200   -> 150 µg/m3
# 300   -> 250 µg/m3
# 400   -> 350 µg/m3
# 500   -> 500 µg/m3
#
# Based on Table 2 of Decision 1459/QD-TCMT.

PM25_BREAKPOINTS = np.array([
    0,
    25,
    50,
    80,
    150,
    250,
    350,
    500
], dtype=float)

AQI_BREAKPOINTS = np.array([
    0,
    50,
    100,
    150,
    200,
    300,
    400,
    500
], dtype=float)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("VN_AQI CALCULATION - PM2.5 BASED")
print("=" * 70)

print("\n[1] Loading preprocessed dataset...")

df = pd.read_csv(INPUT_PATH)

df["date"] = pd.to_datetime(
    df["date"],
    format="%Y-%m-%d %H:%M:%S",
    errors="coerce"
)

df[PM25_COLUMN] = pd.to_numeric(
    df[PM25_COLUMN],
    errors="coerce"
)

df = df.sort_values(
    ["Station_No", "date"]
).reset_index(drop=True)

print("Input shape:", df.shape)

print(
    "Date range:",
    df["date"].min(),
    "->",
    df["date"].max()
)

print(
    "Stations:",
    sorted(df["Station_No"].unique())
)


# ============================================================
# CHECK PM2.5
# ============================================================

print("\n" + "=" * 70)
print("[2] PM2.5 DATA CHECK")
print("=" * 70)

pm25_missing = df[PM25_COLUMN].isna().sum()
pm25_negative = (df[PM25_COLUMN] < 0).sum()

print("PM2.5 missing:", pm25_missing)
print("PM2.5 negative:", pm25_negative)

if pm25_missing > 0:
    print(
        "\nWARNING:",
        "Some PM2.5 values are missing."
    )

if pm25_negative > 0:
    raise ValueError(
        "PM2.5 contains negative values."
    )


# ============================================================
# NOWCAST FUNCTION
# ============================================================

def calculate_nowcast(values):
    """
    Calculate PM2.5 Nowcast according to
    Decision 1459/QD-TCMT.

    values:
        12 hourly PM2.5 values ordered from
        current hour backwards:

        c1, c2, ..., c12

    Rules:
    - At least 2 of c1, c2, c3 must exist.
    - Missing values inside the 12-hour window are ignored
      by assigning their weight to zero.
    - w* = Cmin / Cmax
    - if w* <= 0.5 -> w = 0.5
    - otherwise w = w*
    """

    values = np.asarray(values, dtype=float)

    # --------------------------------------------------------
    # Need at least 2 of the latest 3 values
    # --------------------------------------------------------

    latest_three = values[:3]

    if np.sum(~np.isnan(latest_three)) < 2:
        return np.nan

    # --------------------------------------------------------
    # Available values
    # --------------------------------------------------------

    valid = ~np.isnan(values)

    if not np.any(valid):
        return np.nan

    available_values = values[valid]

    c_min = np.min(available_values)
    c_max = np.max(available_values)

    # --------------------------------------------------------
    # Avoid division by zero
    # --------------------------------------------------------

    if c_max == 0:
        return 0.0

    # --------------------------------------------------------
    # Calculate w*
    # --------------------------------------------------------

    w_star = c_min / c_max

    # --------------------------------------------------------
    # VN_AQI rule:
    #
    # w* <= 0.5 -> w = 0.5
    # w* >  0.5 -> w = w*
    # --------------------------------------------------------

    w = max(0.5, w_star)

    # --------------------------------------------------------
    # Calculate weighted average
    #
    # c1 has exponent 0
    # c2 has exponent 1
    # ...
    # c12 has exponent 11
    #
    # Missing ci => corresponding weight = 0
    # --------------------------------------------------------

    exponents = np.arange(len(values))

    weights = np.power(w, exponents)

    weights[~valid] = 0.0

    denominator = np.sum(weights)

    if denominator == 0:
        return np.nan

    nowcast = np.sum(
        values * weights
    ) / denominator

    return nowcast


# ============================================================
# CREATE NOWCAST
# ============================================================

print("\n" + "=" * 70)
print("[3] Calculating PM2.5 Nowcast")
print("=" * 70)

df["PM2.5_nowcast"] = np.nan


for station in sorted(df["Station_No"].unique()):

    station_mask = (
        df["Station_No"] == station
    )

    station_indices = df.index[
        station_mask
    ]

    station_df = df.loc[
        station_indices
    ].sort_values("date")

    pm25_values = (
        station_df[PM25_COLUMN]
        .to_numpy(dtype=float)
    )

    dates = (
        station_df["date"]
        .to_numpy()
    )

    nowcasts = np.full(
        len(station_df),
        np.nan
    )

    for i in range(len(station_df)):

        # ----------------------------------------------------
        # Check timestamp continuity.
        #
        # We must NOT allow a Nowcast window to cross
        # a large station data gap.
        # ----------------------------------------------------

        start_index = i

        count = 0

        while (
            start_index > 0
            and count < 11
        ):

            current_time = pd.Timestamp(
                dates[start_index]
            )

            previous_time = pd.Timestamp(
                dates[start_index - 1]
            )

            diff = (
                current_time
                - previous_time
            )

            if diff != pd.Timedelta(hours=1):
                break

            start_index -= 1
            count += 1

        # ----------------------------------------------------
        # Extract continuous window.
        #
        # The window is ordered:
        #
        # c1 = current
        # c2 = previous hour
        # ...
        # ----------------------------------------------------

        window = pm25_values[
            start_index:i + 1
        ][::-1]

        nowcasts[i] = calculate_nowcast(
            window
        )

    df.loc[
        station_indices,
        "PM2.5_nowcast"
    ] = nowcasts

    valid_nowcasts = np.sum(
        ~np.isnan(nowcasts)
    )

    print(
        f"Station {station}: "
        f"{valid_nowcasts:,} valid Nowcast / "
        f"{len(nowcasts):,} records"
    )


# ============================================================
# AQI INTERPOLATION FUNCTION
# ============================================================

def calculate_pm25_aqi(pm25_nowcast):
    """
    Convert PM2.5 Nowcast to PM2.5 AQI
    using the linear interpolation formula
    from Decision 1459/QD-TCMT.

    AQI = ((I_high - I_low)
           / (BP_high - BP_low))
           * (C - BP_low)
           + I_low
    """

    if pd.isna(pm25_nowcast):
        return np.nan

    c = float(pm25_nowcast)

    # --------------------------------------------------------
    # Below minimum
    # --------------------------------------------------------

    if c <= PM25_BREAKPOINTS[0]:
        return 0.0

    # --------------------------------------------------------
    # Above maximum
    # --------------------------------------------------------

    if c >= PM25_BREAKPOINTS[-1]:
        return 500.0

    # --------------------------------------------------------
    # Find interval
    # --------------------------------------------------------

    index = np.searchsorted(
        PM25_BREAKPOINTS,
        c,
        side="right"
    ) - 1

    bp_low = PM25_BREAKPOINTS[index]
    bp_high = PM25_BREAKPOINTS[index + 1]

    aqi_low = AQI_BREAKPOINTS[index]
    aqi_high = AQI_BREAKPOINTS[index + 1]

    # --------------------------------------------------------
    # Linear interpolation
    # --------------------------------------------------------

    aqi = (
        (aqi_high - aqi_low)
        / (bp_high - bp_low)
        * (c - bp_low)
        + aqi_low
    )

    return aqi


# ============================================================
# CALCULATE AQI
# ============================================================

print("\n" + "=" * 70)
print("[4] Calculating PM2.5 AQI")
print("=" * 70)

df["AQI"] = df[
    "PM2.5_nowcast"
].apply(
    calculate_pm25_aqi
)


# ============================================================
# ROUND AQI
# ============================================================

# Decision 1459:
# Hourly AQI is rounded to integer.

df["AQI"] = (
    df["AQI"]
    .round()
)


# Ensure AQI stays within VN_AQI range
df["AQI"] = df["AQI"].clip(
    lower=0,
    upper=500
)


# ============================================================
# AQI CATEGORY
# ============================================================

def get_aqi_category(aqi):

    if pd.isna(aqi):
        return np.nan

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


df["AQI_category"] = df[
    "AQI"
].apply(
    get_aqi_category
)


# ============================================================
# VALID AQI SUMMARY
# ============================================================

print("\n" + "=" * 70)
print("[5] AQI SUMMARY")
print("=" * 70)

total_records = len(df)

valid_nowcast = (
    df["PM2.5_nowcast"]
    .notna()
    .sum()
)

valid_aqi = (
    df["AQI"]
    .notna()
    .sum()
)

print(
    "Total records:",
    f"{total_records:,}"
)

print(
    "Valid Nowcast:",
    f"{valid_nowcast:,}",
    f"({valid_nowcast / total_records * 100:.2f}%)"
)

print(
    "Valid AQI:",
    f"{valid_aqi:,}",
    f"({valid_aqi / total_records * 100:.2f}%)"
)


# ============================================================
# AQI SUMMARY BY STATION
# ============================================================

print("\n" + "=" * 70)
print("[6] AQI SUMMARY BY STATION")
print("=" * 70)

for station in sorted(
    df["Station_No"].unique()
):

    station_aqi = df.loc[
        df["Station_No"] == station,
        "AQI"
    ].dropna()

    print(
        f"\nStation {station}"
    )

    if len(station_aqi) == 0:
        print("No valid AQI.")
        continue

    print(
        "Valid AQI:",
        len(station_aqi)
    )

    print(
        "Min:",
        int(station_aqi.min())
    )

    print(
        "Mean:",
        round(station_aqi.mean(), 2)
    )

    print(
        "Median:",
        round(station_aqi.median(), 2)
    )

    print(
        "Max:",
        int(station_aqi.max())
    )


# ============================================================
# AQI CATEGORY DISTRIBUTION
# ============================================================

print("\n" + "=" * 70)
print("[7] AQI CATEGORY DISTRIBUTION")
print("=" * 70)

category_counts = (
    df["AQI_category"]
    .value_counts()
    .reindex([
        "Tốt",
        "Trung bình",
        "Kém",
        "Xấu",
        "Rất xấu",
        "Nguy hại"
    ])
    .fillna(0)
    .astype(int)
)

print(category_counts)


# ============================================================
# AQI VALUE DISTRIBUTION
# ============================================================

print("\n" + "=" * 70)
print("[8] AQI VALUE DISTRIBUTION")
print("=" * 70)

valid_aqi_values = df[
    "AQI"
].dropna()

if len(valid_aqi_values) > 0:

    print(
        "AQI <= 50:",
        int(
            (valid_aqi_values <= 50)
            .sum()
        )
    )

    print(
        "AQI 51-100:",
        int(
            (
                (valid_aqi_values > 50)
                &
                (valid_aqi_values <= 100)
            ).sum()
        )
    )

    print(
        "AQI 101-150:",
        int(
            (
                (valid_aqi_values > 100)
                &
                (valid_aqi_values <= 150)
            ).sum()
        )
    )

    print(
        "AQI 151-200:",
        int(
            (
                (valid_aqi_values > 150)
                &
                (valid_aqi_values <= 200)
            ).sum()
        )
    )

    print(
        "AQI 201-300:",
        int(
            (
                (valid_aqi_values > 200)
                &
                (valid_aqi_values <= 300)
            ).sum()
        )
    )

    print(
        "AQI 301-500:",
        int(
            (
                valid_aqi_values > 300
            ).sum()
        )
    )


# ============================================================
# SAMPLE CALCULATIONS
# ============================================================

print("\n" + "=" * 70)
print("[9] SAMPLE AQI RESULTS")
print("=" * 70)

sample_columns = [
    "date",
    "Station_No",
    "PM2.5",
    "PM2.5_nowcast",
    "AQI",
    "AQI_category"
]

sample = (
    df[
        df["AQI"].notna()
    ][sample_columns]
    .head(15)
)

print(
    sample.to_string(
        index=False
    )
)


# ============================================================
# SAVE OUTPUT
# ============================================================

print("\n" + "=" * 70)
print("[10] Saving AQI dataset")
print("=" * 70)

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print(
    "Output file:"
)

print(
    OUTPUT_PATH
)

print(
    "\nFinal shape:",
    df.shape
)

print(
    "\nNew columns:"
)

print(
    "- PM2.5_nowcast"
)

print(
    "- AQI"
)

print(
    "- AQI_category"
)

print(
    "\nAQI calculation completed successfully."
)