"""
06_evaluate_no_aqi.py
Evaluate Model B (CNN-LSTM without past AQI input).

Input:
- outputs/processed/sequences_no_aqi/
- outputs/models/no_aqi/best_cnn_lstm_no_aqi.keras

Output:
- outputs/models/no_aqi/evaluation_metrics_no_aqi.csv
- outputs/models/no_aqi/horizon_analysis_no_aqi.csv
- outputs/models/no_aqi/category_analysis_no_aqi.csv
- outputs/models/no_aqi/predictions_no_aqi.npz

Metrics are calculated after inverse-transforming AQI back to original units.
"""

from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import tensorflow as tf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# =========================
# CONFIG
# =========================
DATA_DIR = Path("outputs/processed/sequences_no_aqi")
MODEL_DIR = Path("outputs/models/no_aqi")

MODEL_FILE = MODEL_DIR / "best_cnn_lstm_no_aqi.keras"
X_TEST_FILE = DATA_DIR / "X_test.npy"
Y_TEST_FILE = DATA_DIR / "y_test.npy"
Y_SCALER_FILE = DATA_DIR / "y_scaler.pkl"

# AQI categories used in the project
CATEGORY_BINS = [50, 100, 150, 200, 300, np.inf]
CATEGORY_NAMES = [
    "Tốt",
    "Trung bình",
    "Kém",
    "Xấu",
    "Rất xấu",
    "Nguy hại",
]


def aqi_category(values):
    """Convert AQI values to the project's six categories."""
    values = np.asarray(values)
    clipped = np.clip(values, 0, 500)
    return np.select(
        [
            clipped <= 50,
            clipped <= 100,
            clipped <= 150,
            clipped <= 200,
            clipped <= 300,
            clipped > 300,
        ],
        CATEGORY_NAMES,
        default="Nguy hại",
    )


def inverse_transform_12(y_scaled, scaler):
    """Inverse-transform a (N, 12) AQI array using a 1D scaler."""
    original_shape = y_scaled.shape
    return scaler.inverse_transform(
        y_scaled.reshape(-1, 1)
    ).reshape(original_shape)


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("06 - EVALUATE CNN-LSTM WITHOUT PAST AQI")
    print("=" * 70)

    # -------------------------
    # Load data/model
    # -------------------------
    print("\n[1/5] Loading test data and model...")

    X_test = np.load(X_TEST_FILE)
    y_test_scaled = np.load(Y_TEST_FILE)

    with open(Y_SCALER_FILE, "rb") as f:
        y_scaler = pickle.load(f)

    model = tf.keras.models.load_model(MODEL_FILE)

    print(f"X_test shape: {X_test.shape}")
    print(f"y_test shape: {y_test_scaled.shape}")
    print(f"Model input shape: {model.input_shape}")
    print(f"Model output shape: {model.output_shape}")

    # -------------------------
    # Predict
    # -------------------------
    print("\n[2/5] Predicting...")

    y_pred_scaled = model.predict(X_test, batch_size=64, verbose=1)

    # Back to AQI units
    y_test = inverse_transform_12(y_test_scaled, y_scaler)
    y_pred = inverse_transform_12(y_pred_scaled, y_scaler)

    print(f"Prediction shape: {y_pred.shape}")

    # -------------------------
    # Overall metrics
    # -------------------------
    print("\n[3/5] Calculating overall metrics...")

    y_true_flat = y_test.reshape(-1)
    y_pred_flat = y_pred.reshape(-1)

    mae = mean_absolute_error(y_true_flat, y_pred_flat)
    rmse = np.sqrt(mean_squared_error(y_true_flat, y_pred_flat))
    r2 = r2_score(y_true_flat, y_pred_flat)

    mean_error = np.mean(y_pred_flat - y_true_flat)
    max_abs_error = np.max(np.abs(y_pred_flat - y_true_flat))

    metrics_df = pd.DataFrame({
        "metric": [
            "MAE",
            "RMSE",
            "R2",
            "Mean Error",
            "Max Absolute Error",
            "Test Samples",
            "Forecast Horizon",
        ],
        "value": [
            mae,
            rmse,
            r2,
            mean_error,
            max_abs_error,
            len(X_test),
            y_test.shape[1],
        ],
    })

    metrics_path = MODEL_DIR / "evaluation_metrics_no_aqi.csv"
    metrics_df.to_csv(metrics_path, index=False)

    print(f"\nOverall:")
    print(f"  MAE  = {mae:.4f} AQI")
    print(f"  RMSE = {rmse:.4f} AQI")
    print(f"  R²   = {r2:.4f}")
    print(f"  Mean Error = {mean_error:.4f} AQI")
    print(f"  Max Abs Error = {max_abs_error:.4f} AQI")

    # -------------------------
    # Horizon metrics
    # -------------------------
    print("\n[4/5] Calculating metrics by forecast horizon...")

    horizon_rows = []

    for h in range(y_test.shape[1]):
        actual = y_test[:, h]
        pred = y_pred[:, h]

        h_mae = mean_absolute_error(actual, pred)
        h_rmse = np.sqrt(mean_squared_error(actual, pred))
        h_r2 = r2_score(actual, pred)

        horizon_rows.append({
            "horizon": f"t+{h + 1}",
            "hours_ahead": h + 1,
            "MAE": h_mae,
            "RMSE": h_rmse,
            "R2": h_r2,
        })

    horizon_df = pd.DataFrame(horizon_rows)
    horizon_path = MODEL_DIR / "horizon_analysis_no_aqi.csv"
    horizon_df.to_csv(horizon_path, index=False)

    print(horizon_df.to_string(index=False, float_format=lambda x: f"{x:.4f}"))

    # -------------------------
    # Category agreement
    # -------------------------
    print("\n[5/5] Calculating AQI category agreement...")

    actual_categories = aqi_category(y_true_flat)
    pred_categories = aqi_category(y_pred_flat)

    agreement = np.mean(actual_categories == pred_categories) * 100
    overprediction = np.mean(y_pred_flat > y_true_flat) * 100
    underprediction = np.mean(y_pred_flat < y_true_flat) * 100

    category_rows = []

    for category in CATEGORY_NAMES:
        mask = actual_categories == category
        count = int(np.sum(mask))

        if count == 0:
            category_rows.append({
                "category": category,
                "samples": 0,
                "MAE": np.nan,
                "agreement_percent": np.nan,
            })
            continue

        category_mae = mean_absolute_error(
            y_true_flat[mask],
            y_pred_flat[mask]
        )
        category_agreement = (
            np.mean(pred_categories[mask] == category) * 100
        )

        category_rows.append({
            "category": category,
            "samples": count,
            "MAE": category_mae,
            "agreement_percent": category_agreement,
        })

    category_df = pd.DataFrame(category_rows)

    # Add summary rows separately for convenient inspection
    summary_rows = pd.DataFrame([
        {
            "category": "OVERALL_CATEGORY_AGREEMENT",
            "samples": len(y_true_flat),
            "MAE": mae,
            "agreement_percent": agreement,
        },
        {
            "category": "OVERPREDICTION",
            "samples": len(y_true_flat),
            "MAE": np.nan,
            "agreement_percent": overprediction,
        },
        {
            "category": "UNDERPREDICTION",
            "samples": len(y_true_flat),
            "MAE": np.nan,
            "agreement_percent": underprediction,
        },
    ])

    category_output = pd.concat(
        [category_df, summary_rows],
        ignore_index=True
    )

    category_path = MODEL_DIR / "category_analysis_no_aqi.csv"
    category_output.to_csv(category_path, index=False)

    print(f"\nCategory agreement: {agreement:.2f}%")
    print(f"Overprediction:      {overprediction:.2f}%")
    print(f"Underprediction:     {underprediction:.2f}%")
    print("\nCategory breakdown:")
    print(category_df.to_string(index=False, float_format=lambda x: f"{x:.4f}"))

    # -------------------------
    # Save predictions
    # -------------------------
    prediction_path = MODEL_DIR / "predictions_no_aqi.npz"
    np.savez_compressed(
        prediction_path,
        y_true=y_test,
        y_pred=y_pred,
        y_true_scaled=y_test_scaled,
        y_pred_scaled=y_pred_scaled,
    )

    print("\n" + "=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)
    print(f"Saved:")
    print(f"  {metrics_path}")
    print(f"  {horizon_path}")
    print(f"  {category_path}")
    print(f"  {prediction_path}")
    print("\nIMPORTANT:")
    print("The reported MAE/RMSE are in original AQI units,")
    print("not the scaled MAE shown during model.fit().")


if __name__ == "__main__":
    main()
