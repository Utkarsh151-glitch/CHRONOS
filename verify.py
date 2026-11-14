"""
CHRONOS — verification checks (run: python verify.py).
1. trained weights reload from disk
2. gate reconstruction == nn.LSTM forward pass on many test windows (trained AND untrained)
3. metrics recomputed independently from predictions.csv match metrics.json
"""
import json
import os

import numpy as np
import pandas as pd

from dataset import generate_series, make_splits
from evaluate import load_untrained
from model import load_model, verify_gates
from train import MODELS_DIR, RESULTS_DIR

data = make_splits(generate_series())
with open(os.path.join(RESULTS_DIR, "metrics.json")) as f:
    metrics = json.load(f)
H = metrics["hidden_units"]
trained = load_model(os.path.join(MODELS_DIR, "trained_lstm.pth"), H)
untrained = load_untrained(H)
print("[1] trained + untrained weights reloaded OK")

worst_h = worst_c = 0.0
for name, m in (("trained", trained), ("untrained", untrained)):
    for w in range(0, len(data.X_test), 10):
        r = verify_gates(m, data.X_test[w, :, 0])
        assert r["passed"], (name, w, r)
        worst_h, worst_c = max(worst_h, r["max_abs_err_h"]), max(worst_c, r["max_abs_err_c"])
print(f"[2] gate reconstruction matches nn.LSTM on {2 * len(range(0, len(data.X_test), 10))} sequences "
      f"(worst |dh| = {worst_h:.2e}, worst |dc| = {worst_c:.2e})")

p = pd.read_csv(os.path.join(RESULTS_DIR, "predictions.csv"))
for col, key in (("trained_mw", "trained_lstm"), ("untrained_mw", "untrained_lstm"), ("persistence_mw", "persistence")):
    mae = np.mean(np.abs(p[col] - p["actual_mw"]))
    rmse = np.sqrt(np.mean((p[col] - p["actual_mw"]) ** 2))
    assert abs(mae - metrics["one_step"][key]["MAE"]) < 1e-6 and abs(rmse - metrics["one_step"][key]["RMSE"]) < 1e-6
    print(f"[3] {key:15s} MAE {mae:7.2f} MW  RMSE {rmse:7.2f} MW  (matches metrics.json)")
assert np.allclose(p["actual_mw"], data.series[data.test_target_idx])
print("ALL CHECKS PASSED")
