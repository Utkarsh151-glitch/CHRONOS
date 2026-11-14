"""
CHRONOS — evaluation on the held-out (chronologically last) test split.

Compares, on exactly the same test windows:
  A. the untrained LSTM (same architecture, initial random weights)
  B. the trained LSTM
  C. persistence baseline   (next hour = this hour)
  D. seasonal-naive baseline (next hour = same hour yesterday)
"""
import json
import os

import numpy as np
import pandas as pd
import torch

from dataset import LOOKBACK, generate_series, make_splits
from model import DEVICE, ChronosLSTM, load_model, verify_gates
from train import MODELS_DIR, RESULTS_DIR


def mae(a, b):
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def rmse(a, b):
    return float(np.sqrt(np.mean((np.asarray(a) - np.asarray(b)) ** 2)))


@torch.no_grad()
def predict_mw(model, data, X):
    return data.denormalize(model(torch.tensor(X, device=DEVICE))[:, 0].cpu().numpy())


@torch.no_grad()
def recursive_forecast(model, data, start_target_idx, steps=24):
    """Feed predictions back in as inputs to forecast `steps` hours ahead."""
    window = list(data.normalize(data.series[start_target_idx - LOOKBACK:start_target_idx]))
    out = []
    for _ in range(steps):
        x = torch.tensor(np.array(window[-LOOKBACK:], dtype=np.float32)[None, :, None], device=DEVICE)
        p = model(x).item()
        out.append(p)
        window.append(p)
    return data.denormalize(np.array(out))


def load_untrained(hidden):
    m = ChronosLSTM(1, hidden)
    m.load_state_dict(torch.load(os.path.join(MODELS_DIR, "untrained_lstm.pth"), map_location="cpu"))
    return m.to(DEVICE).eval()


def compare_models(trained, untrained, data, start_offset=0):
    """Predictions of every model on the same held-out test windows (+ a 24 h recursive forecast)."""
    actual = data.series[data.test_target_idx]
    out = {
        "hour": data.test_target_idx, "actual": actual,
        "trained": predict_mw(trained, data, data.X_test),
        "untrained": predict_mw(untrained, data, data.X_test),
        "persistence": data.series[data.test_target_idx - 1],
        "seasonal_naive": data.series[data.test_target_idx - 24],
    }
    start = int(data.test_target_idx[start_offset])
    out["rf_start"] = start
    out["rf_history"] = data.series[start - LOOKBACK:start]
    out["rf_actual"] = data.series[start:start + 24]
    out["rf_trained"] = recursive_forecast(trained, data, start)
    out["rf_untrained"] = recursive_forecast(untrained, data, start)
    out["one_trained"] = out["trained"][start_offset:start_offset + 24]
    out["one_untrained"] = out["untrained"][start_offset:start_offset + 24]
    return out


def run_evaluation(hidden=32, compute_seconds=None, history=None, data=None):
    data = data or make_splits(generate_series())
    trained = load_model(os.path.join(MODELS_DIR, "trained_lstm.pth"), hidden)   # proves reload works
    untrained = load_untrained(hidden)

    cmp = compare_models(trained, untrained, data)
    actual, p_tr, p_un = cmp["actual"], cmp["trained"], cmp["untrained"]
    p_persist, p_season = cmp["persistence"], cmp["seasonal_naive"]

    pd.DataFrame({"hour": data.test_target_idx, "actual_mw": actual, "trained_mw": p_tr,
                  "untrained_mw": p_un, "persistence_mw": p_persist, "seasonal_naive_mw": p_season}
                 ).to_csv(os.path.join(RESULTS_DIR, "predictions.csv"), index=False)

    rf_actual, rf_tr, rf_un = cmp["rf_actual"], cmp["rf_trained"], cmp["rf_untrained"]

    gate_check = verify_gates(trained, data.X_test[0, :, 0])

    metrics = {
        "data": "SIMULATED electricity demand (MW)",
        "test_windows": int(len(actual)),
        "one_step": {
            "trained_lstm": {"MAE": mae(actual, p_tr), "RMSE": rmse(actual, p_tr)},
            "untrained_lstm": {"MAE": mae(actual, p_un), "RMSE": rmse(actual, p_un)},
            "persistence": {"MAE": mae(actual, p_persist), "RMSE": rmse(actual, p_persist)},
            "seasonal_naive_24h": {"MAE": mae(actual, p_season), "RMSE": rmse(actual, p_season)},
        },
        "recursive_24h": {
            "trained_lstm": {"MAE": mae(rf_actual, rf_tr), "RMSE": rmse(rf_actual, rf_tr)},
            "untrained_lstm": {"MAE": mae(rf_actual, rf_un), "RMSE": rmse(rf_actual, rf_un)},
        },
        "gate_reconstruction_check": gate_check,
    }
    if history:
        metrics["final_train_loss_mse_normalized"] = history[-1]["train_loss"]
        metrics["final_val_loss_mse_normalized"] = history[-1]["val_loss"]
        metrics["epochs"] = history[-1]["epoch"]
    if compute_seconds is not None:
        metrics["training_compute_seconds"] = compute_seconds
    metrics["hidden_units"] = hidden
    metrics["device"] = str(DEVICE)
    with open(os.path.join(RESULTS_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    return metrics


if __name__ == "__main__":
    print(json.dumps(run_evaluation(), indent=2))
