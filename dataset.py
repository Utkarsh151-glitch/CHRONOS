"""
CHRONOS — simulated electricity-demand dataset.

All data in this project is SIMULATED with NumPy. It is not real grid data.
The signal combines: daily cycle + evening-peak harmonic + weekly seasonality
(with amplitude modulation) + slow trend + small Gaussian noise.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd

LOOKBACK = 24  # hours of history the LSTM sees
HORIZON = 1    # predict the next hour


def generate_series(n_days: int = 70, seed: int = 7, noise_std: float = 12.0) -> pd.DataFrame:
    """Hourly simulated demand in MW."""
    rng = np.random.default_rng(seed)
    t = np.arange(n_days * 24, dtype=np.float64)
    weekly = np.sin(2 * np.pi * t / 168.0)
    daily_amp = 120.0 * (1.0 + 0.25 * weekly)                      # amplitude varies over the week
    daily = daily_amp * np.sin(2 * np.pi * (t - 9) / 24.0)          # main daily cycle (peak mid-afternoon)
    evening = 45.0 * np.sin(4 * np.pi * (t - 2) / 24.0)             # second harmonic -> evening peak
    weekend = -55.0 * (((t // 24) % 7) >= 5)                         # weekends use less power
    trend = 0.06 * t                                                 # slow growth
    noise = rng.normal(0.0, noise_std, size=t.shape)
    demand = 600.0 + daily + evening + 40.0 * weekly + weekend + trend + noise
    return pd.DataFrame({"hour": t.astype(int), "demand_mw": demand})


@dataclass
class SplitData:
    series: np.ndarray            # raw MW values
    mean: float                   # TRAIN-only statistics
    std: float
    train_end: int                # index boundaries in the raw series
    val_end: int
    X_train: np.ndarray           # (N, LOOKBACK, 1) normalized
    y_train: np.ndarray           # (N, 1) normalized
    X_val: np.ndarray
    y_val: np.ndarray
    X_test: np.ndarray
    y_test: np.ndarray
    test_target_idx: np.ndarray   # raw-series index of each test target

    def normalize(self, v):
        return (v - self.mean) / self.std

    def denormalize(self, v):
        return v * self.std + self.mean


def _windows(z: np.ndarray, start: int, end: int):
    """Windows whose TARGET index lies in [start, end). History may reach back before `start`."""
    X, y, idx = [], [], []
    for target in range(max(start, LOOKBACK), end):
        X.append(z[target - LOOKBACK:target])
        y.append(z[target])
        idx.append(target)
    return (np.asarray(X, dtype=np.float32)[..., None],
            np.asarray(y, dtype=np.float32)[:, None],
            np.asarray(idx))


def make_splits(df: pd.DataFrame, train_frac: float = 0.70, val_frac: float = 0.15) -> SplitData:
    """Chronological split; normalization uses training-set statistics only."""
    s = df["demand_mw"].to_numpy(dtype=np.float64)
    n = len(s)
    train_end = int(n * train_frac)
    val_end = int(n * (train_frac + val_frac))
    mean, std = float(s[:train_end].mean()), float(s[:train_end].std())
    z = (s - mean) / std
    Xtr, ytr, _ = _windows(z, 0, train_end)
    Xva, yva, _ = _windows(z, train_end, val_end)
    Xte, yte, te_idx = _windows(z, val_end, n)
    return SplitData(s, mean, std, train_end, val_end, Xtr, ytr, Xva, yva, Xte, yte, te_idx)
