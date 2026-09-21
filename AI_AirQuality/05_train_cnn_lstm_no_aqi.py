import os
import pickle
import numpy as np
import tensorflow as tf

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import (
    Input,
    Conv1D,
    MaxPooling1D,
    LSTM,
    Dense,
    Dropout
)
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau
)

# ============================================================
# CONFIG - ABLATION MODEL B
# ============================================================

DATA_DIR = "outputs/processed/sequences_no_aqi"
MODEL_DIR = "outputs/models/no_aqi"

BATCH_SIZE = 64
EPOCHS = 50

SEED = 42

np.random.seed(SEED)
tf.random.set_seed(SEED)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 60)
print("05A - TRAIN CNN-LSTM ABLATION")
print("MODEL B: WITHOUT PAST AQI")
print("=" * 60)

print("\nLoading datasets...")

X_train = np.load(
    os.path.join(DATA_DIR, "X_train.npy")
)

y_train = np.load(
    os.path.join(DATA_DIR, "y_train.npy")
)

X_val = np.load(
    os.path.join(DATA_DIR, "X_val.npy")
)

y_val = np.load(
    os.path.join(DATA_DIR, "y_val.npy")
)

X_test = np.load(
    os.path.join(DATA_DIR, "X_test.npy")
)

y_test = np.load(
    os.path.join(DATA_DIR, "y_test.npy")
)


# ============================================================
# DATASET INFORMATION
# ============================================================

print("\nDataset:")
print(f"X_train: {X_train.shape}")
print(f"y_train: {y_train.shape}")

print(f"X_val:   {X_val.shape}")
print(f"y_val:   {y_val.shape}")

print(f"X_test:  {X_test.shape}")
print(f"y_test:  {y_test.shape}")


if X_train.shape[1:] != (24, 3):
    raise ValueError(
        f"Unexpected Model B input shape: {X_train.shape}"
    )

if y_train.shape[1:] != (12,):
    raise ValueError(
        f"Unexpected target shape: {y_train.shape}"
    )


# ============================================================
# BUILD SAME CNN-LSTM ARCHITECTURE
# ============================================================

print("\nBuilding CNN-LSTM model...")

model = Sequential([

    Input(
        shape=(X_train.shape[1], X_train.shape[2])
    ),

    # CNN feature extraction
    Conv1D(
        filters=64,
        kernel_size=3,
        activation="relu",
        padding="same"
    ),

    MaxPooling1D(
        pool_size=2
    ),

    # Temporal learning
    LSTM(
        64,
        return_sequences=True
    ),

    Dropout(0.2),

    LSTM(
        32
    ),

    Dropout(0.2),

    # Forecast representation
    Dense(
        64,
        activation="relu"
    ),

    Dense(
        12
    )
])


# ============================================================
# COMPILE
# ============================================================

model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.001
    ),
    loss="mse",
    metrics=[
        "mae"
    ]
)


# ============================================================
# MODEL SUMMARY
# ============================================================

print("\nModel architecture:\n")
model.summary()


# ============================================================
# CALLBACKS
# ============================================================

os.makedirs(
    MODEL_DIR,
    exist_ok=True
)

checkpoint_path = os.path.join(
    MODEL_DIR,
    "best_cnn_lstm_no_aqi.keras"
)

callbacks = [

    EarlyStopping(
        monitor="val_loss",
        patience=8,
        restore_best_weights=True,
        verbose=1
    ),

    ModelCheckpoint(
        checkpoint_path,
        monitor="val_loss",
        save_best_only=True,
        verbose=1
    ),

    ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=4,
        min_lr=1e-6,
        verbose=1
    )
]


# ============================================================
# TRAIN
# ============================================================

print("\nStarting training...")
print(f"Epochs: {EPOCHS}")
print(f"Batch size: {BATCH_SIZE}")

history = model.fit(
    X_train,
    y_train,
    validation_data=(
        X_val,
        y_val
    ),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    callbacks=callbacks,
    verbose=1
)


# ============================================================
# SAVE TRAINING HISTORY
# ============================================================

history_path = os.path.join(
    MODEL_DIR,
    "training_history_no_aqi.pkl"
)

with open(
    history_path,
    "wb"
) as f:
    pickle.dump(
        history.history,
        f
    )


# ============================================================
# FINAL EVALUATION
# ============================================================

print("\n" + "=" * 60)
print("MODEL B TEST EVALUATION")
print("=" * 60)

test_loss, test_mae = model.evaluate(
    X_test,
    y_test,
    verbose=1
)

print(
    f"\nTest Loss: {test_loss:.6f}"
)

print(
    f"Test MAE (scaled): {test_mae:.6f}"
)


# ============================================================
# SAVE FINAL MODEL
# ============================================================

final_model_path = os.path.join(
    MODEL_DIR,
    "cnn_lstm_no_aqi_final.keras"
)

model.save(
    final_model_path
)

print("\nModel saved:")
print(final_model_path)

print("\nTraining history saved:")
print(history_path)

print("\n" + "=" * 60)
print("MODEL B TRAINING COMPLETED")
print("=" * 60)
