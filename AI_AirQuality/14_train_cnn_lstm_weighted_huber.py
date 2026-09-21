import os
import pickle
import numpy as np
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
from tensorflow.keras.callbacks import (
    EarlyStopping,
    ModelCheckpoint,
    ReduceLROnPlateau
)
from tensorflow.keras.optimizers import Adam


# ============================================================
# CONFIG
# ============================================================

SEQUENCE_DIR = (
    "outputs/processed/"
    "sequences_no_aqi"
)

OUTPUT_DIR = (
    "outputs/models/"
    "weighted_huber"
)

WEIGHTS_PATH = os.path.join(
    OUTPUT_DIR,
    "best_cnn_lstm_weighted_huber.weights.h5"
)

HISTORY_PATH = os.path.join(
    OUTPUT_DIR,
    "training_history.pkl"
)

LOOKBACK = 24
FORECAST_HORIZON = 12
N_FEATURES = 3

BATCH_SIZE = 64
EPOCHS = 50

LEARNING_RATE = 0.001


# ============================================================
# WEIGHT CONFIG
# ============================================================

# Base weight = 1.0
#
# AQI > 50:
# gradually increase importance
#
# Maximum weight = 3.0
#
# This is intentionally milder than Model C.
HIGH_AQI_START = 50.0
WEIGHT_STRENGTH = 1.0
MAX_WEIGHT = 3.0


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True
)


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("14 - TRAIN CNN-LSTM WEIGHTED HUBER")
print("MODEL E")
print("=" * 70)

print("\nLoading sequence data...")

X_train = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "X_train.npy"
    )
)

y_train = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "y_train.npy"
    )

)

X_val = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "X_val.npy"
    )
)

y_val = np.load(
    os.path.join(
        SEQUENCE_DIR,
        "y_val.npy"
    )
)

print(
    f"X_train: {X_train.shape}"
)

print(
    f"y_train: {y_train.shape}"
)

print(
    f"X_val:   {X_val.shape}"
)

print(
    f"y_val:   {y_val.shape}"
)


# ============================================================
# LOAD Y SCALER
# ============================================================

SCALER_PATH = os.path.join(
    SEQUENCE_DIR,
    "y_scaler.pkl"
)

with open(
    SCALER_PATH,
    "rb"
) as f:

    y_scaler = pickle.load(f)


# ============================================================
# CONVERT SCALED AQI BACK TO REAL AQI
# ============================================================

y_train_real = y_scaler.inverse_transform(
    y_train.reshape(-1, 1)
).reshape(
    y_train.shape
)

y_val_real = y_scaler.inverse_transform(
    y_val.reshape(-1, 1)
).reshape(
    y_val.shape
)


print("\nAQI statistics:")

print(
    f"Train AQI min: "
    f"{y_train_real.min():.4f}"
)

print(
    f"Train AQI max: "
    f"{y_train_real.max():.4f}"
)

print(
    f"Train AQI mean: "
    f"{y_train_real.mean():.4f}"
)


# ============================================================
# CALCULATE SAMPLE WEIGHTS
# ============================================================

def calculate_weights(y_real):

    """
    Calculate one weight for every forecasting sample.

    The weight is based on the maximum AQI among
    the 12 forecasted hours.

    Normal AQI <= 50:
        weight = 1

    Higher AQI:
        gradually larger weight

    Maximum:
        MAX_WEIGHT
    """

    max_aqi = np.max(
        y_real,
        axis=1
    )

    weights = (
        1.0
        + WEIGHT_STRENGTH
        * np.maximum(
            0,
            max_aqi - HIGH_AQI_START
        )
        / 100.0
    )

    weights = np.clip(
        weights,
        1.0,
        MAX_WEIGHT
    )

    return weights.astype(
        np.float32
    )


train_weights = calculate_weights(
    y_train_real
)

val_weights = calculate_weights(
    y_val_real
)


print("\nSample weight statistics:")

print(
    f"Train weight min: "
    f"{train_weights.min():.4f}"
)

print(
    f"Train weight max: "
    f"{train_weights.max():.4f}"
)

print(
    f"Train weight mean: "
    f"{train_weights.mean():.4f}"
)

print(
    f"Validation weight mean: "
    f"{val_weights.mean():.4f}"
)


# ============================================================
# CUSTOM WEIGHTED HUBER LOSS
# ============================================================

class WeightedHuberLoss(
    tf.keras.losses.Loss
):

    def __init__(
        self,
        delta=1.0,
        **kwargs
    ):

        super().__init__(
            **kwargs
        )

        self.delta = delta

    def call(
        self,
        y_true,
        y_pred
    ):

        error = (
            y_true
            - y_pred
        )

        abs_error = tf.abs(
            error
        )

        quadratic = tf.minimum(
            abs_error,
            self.delta
        )

        linear = (
            abs_error
            - quadratic
        )

        huber = (
            0.5
            * tf.square(quadratic)
            + self.delta
            * linear
        )

        # Weight is encoded through
        # the first target element.
        #
        # We will use a custom wrapper below
        # instead of putting weights into y_true.
        return tf.reduce_mean(
            huber
        )


# ============================================================
# MODEL
# ============================================================

print("\n" + "=" * 70)
print("BUILDING MODEL E")
print("=" * 70)

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
    ]
)


# ============================================================
# CUSTOM TRAINING MODEL
# ============================================================

class WeightedHuberModel(
    tf.keras.Model
):

    def __init__(
        self,
        model,
        delta=1.0
    ):

        super().__init__()

        self.network = model
        self.delta = delta

        self.loss_tracker = (
            tf.keras.metrics.Mean(
                name="loss"
            )
        )

        self.mae_metric = (
            tf.keras.metrics.MeanAbsoluteError(
                name="mae"
            )
        )

    @property
    def metrics(self):

        return [
            self.loss_tracker,
            self.mae_metric
        ]

    def call(
        self,
        inputs,
        training=False
    ):

        return self.network(
            inputs,
            training=training
        )

    def weighted_huber(
        self,
        y_true,
        y_pred,
        weights
    ):

        error = (
            y_true
            - y_pred
        )

        abs_error = tf.abs(
            error
        )

        quadratic = tf.minimum(
            abs_error,
            self.delta
        )

        linear = (
            abs_error
            - quadratic
        )

        huber = (
            0.5
            * tf.square(quadratic)
            + self.delta
            * linear
        )

        loss_per_sample = tf.reduce_mean(
            huber,
            axis=1
        )

        weighted_loss = (
            loss_per_sample
            * weights
        )

        return tf.reduce_mean(
            weighted_loss
        )

    def train_step(
        self,
        data
    ):

        x, y, sample_weight = data

        with tf.GradientTape() as tape:

            y_pred = self(
                x,
                training=True
            )

            loss = self.weighted_huber(
                y,
                y_pred,
                sample_weight
            )

        gradients = tape.gradient(
            loss,
            self.trainable_variables
        )

        self.optimizer.apply_gradients(
            zip(
                gradients,
                self.trainable_variables
            )
        )

        self.loss_tracker.update_state(
            loss
        )

        self.mae_metric.update_state(
            y,
            y_pred
        )

        return {
            "loss":
                self.loss_tracker.result(),

            "mae":
                self.mae_metric.result()
        }

    def test_step(
        self,
        data
    ):

        x, y, sample_weight = data

        y_pred = self(
            x,
            training=False
        )

        loss = self.weighted_huber(
            y,
            y_pred,
            sample_weight
        )

        self.loss_tracker.update_state(
            loss
        )

        self.mae_metric.update_state(
            y,
            y_pred
        )

        return {
            "loss":
                self.loss_tracker.result(),

            "mae":
                self.mae_metric.result()
        }


# ============================================================
# WRAP MODEL
# ============================================================

weighted_model = WeightedHuberModel(
    model,
    delta=1.0
)


weighted_model.compile(
    optimizer=Adam(
        learning_rate=LEARNING_RATE
    )
)


print("\nModel architecture:")

model.summary()


# ============================================================
# CALLBACKS
# ============================================================

WEIGHTS_PATH = os.path.join(
    OUTPUT_DIR,
    "best_cnn_lstm_weighted_huber.weights.h5"
)

checkpoint = ModelCheckpoint(
    WEIGHTS_PATH,
    monitor="val_loss",
    save_best_only=True,
    save_weights_only=True,
    verbose=1
)

early_stopping = EarlyStopping(
    monitor="val_loss",
    patience=8,
    restore_best_weights=True,
    verbose=1
)

reduce_lr = ReduceLROnPlateau(
    monitor="val_loss",
    factor=0.5,
    patience=3,
    min_lr=1e-6,
    verbose=1
)


# ============================================================
# TRAIN
# ============================================================

print("\n" + "=" * 70)
print("TRAINING MODEL E")
print("=" * 70)

history = weighted_model.fit(
    X_train,
    y_train,
    sample_weight=train_weights,

    validation_data=(
        X_val,
        y_val,
        val_weights
    ),

    epochs=EPOCHS,
    batch_size=BATCH_SIZE,

    callbacks=[
        checkpoint,
        early_stopping,
        reduce_lr
    ],

    verbose=1
)


# ============================================================
# SAVE HISTORY
# ============================================================

with open(
    HISTORY_PATH,
    "wb"
) as f:

    pickle.dump(
        history.history,
        f
    )


# ============================================================
# BEST EPOCH
# ============================================================

best_epoch = (
    np.argmin(
        history.history[
            "val_loss"
        ]
    )
    + 1
)

best_val_loss = min(
    history.history[
        "val_loss"
    ]
)

best_val_mae = min(
    history.history[
        "val_mae"
    ]
)


print("\n" + "=" * 70)
print("TRAINING COMPLETED")
print("=" * 70)

print(
    f"Best epoch: "
    f"{best_epoch}"
)

print(
    f"Best validation loss: "
    f"{best_val_loss:.6f}"
)

print(
    f"Best validation MAE: "
    f"{best_val_mae:.6f}"
)

print(
    f"\nBest weights saved to:"
)

print(
    WEIGHTS_PATH
)

print(
    f"\nHistory saved to:"
)

print(
    HISTORY_PATH
)

print("\nDone.")