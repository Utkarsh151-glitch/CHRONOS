"""
CHRONOS 2.0 — bridge between the verified PyTorch backend and the cinematic frontend.

Builds one JSON payload of REAL model outputs (gate activations, training history,
forecasts, metrics). The frontend only animates what it receives here; nothing is
invented in JavaScript.
"""
import math

import numpy as np

from evaluate import compare_models, mae, rmse
from model import DEVICE, extract_gates, verify_gates

N_WINDOWS = 7      # held-out sequences explorable in the Memory Chamber
WINDOW_STEP = 36   # hours between them


def _r(a, d=4):
    return np.round(np.asarray(a, dtype=np.float64), d).tolist()


def _chamber(model, data):
    out = []
    for w in list(range(0, len(data.X_test), WINDOW_STEP))[:N_WINDOWS]:
        seq = data.X_test[w, :, 0]
        g = extract_gates(model, seq)
        chk = verify_gates(model, seq)
        out.append({
            "index": int(w),
            "x": _r(seq), "x_mw": _r(data.denormalize(seq), 1),
            **{k: _r(g[k]) for k in ("i", "f", "g", "o", "c", "h")},
            "pred_mw": round(float(data.denormalize(g["prediction"])), 1),
            "actual_mw": round(float(data.series[data.test_target_idx[w]]), 1),
            "check": {k: chk[k] for k in ("max_abs_err_h", "max_abs_err_c", "passed")},
        })
    return out


def _learning(replay, data, model):
    if not replay:
        return None
    keep = ("epoch", "train_loss", "val_loss", "grad_norm", "probe_pred_mw", "input_grad", "gate_means")
    hist = []
    for h in replay["history"]:
        rec = {k: h[k] for k in keep}
        rec["probe_pred_mw"] = _r(rec["probe_pred_mw"], 1)
        rec["input_grad"] = [float(f"{v:.4g}") for v in rec["input_grad"]]
        hist.append(rec)
    return {
        "history": hist,
        "probe_actual_mw": _r(replay["probe_actual_mw"], 1),
        "probe_input_mw": _r(replay.get("probe_input_mw", data.denormalize(data.X_val[0, :, 0])), 1),
        "n_train": int(len(data.X_train)),
        "n_batches": int(math.ceil(len(data.X_train) / 64)),
        "n_params": int(sum(p.numel() for p in model.parameters())) if model is not None else 0,
        "compute_seconds": float(replay["compute_seconds"]),
        "hidden": int(replay["hidden"]),
        "epochs": int(replay["epochs"]),
    }


def _future(model, untrained, data):
    if model is None:
        return None
    days, overall = [], None
    for d in range((len(data.X_test) - 24) // 24):
        cmp = compare_models(model, untrained, data, start_offset=d * 24)
        if overall is None:
            a = cmp["actual"]
            overall = {k: {"MAE": mae(a, cmp[k]), "RMSE": rmse(a, cmp[k])}
                       for k in ("trained", "untrained", "persistence", "seasonal_naive")}
            overall["n_test"] = int(len(a))
        off = d * 24
        hist = cmp["rf_history"]
        days.append({
            "start_hour": int(cmp["rf_start"]),
            "history_mw": _r(hist, 1), "actual_mw": _r(cmp["rf_actual"], 1),
            "rec_trained": _r(cmp["rf_trained"], 1), "rec_untrained": _r(cmp["rf_untrained"], 1),
            "one_trained": _r(cmp["one_trained"], 1), "one_untrained": _r(cmp["one_untrained"], 1),
            "one_persistence": _r(cmp["persistence"][off:off + 24], 1),
            "rec_persistence": _r([hist[-1]] * 24, 1),   # multi-step persistence = last observed value
        })
    return {"days": days, "overall": overall}


def build_payload(data, model, untrained, replay, meta):
    active = model if model is not None else untrained
    lo, hi = max(0, data.val_end - 120), min(len(data.series), data.val_end + 120)
    return {
        "version": meta["version"],
        "event": meta.get("event"),
        "meta": {
            "trained": model is not None,
            "run_source": meta.get("run_source", ""),
            "data_cfg": list(meta["data_cfg"]),
            "mismatch": bool(meta.get("trained_on") and tuple(meta["trained_on"]) != tuple(meta["data_cfg"])),
            "hidden": int(active.hidden_size),
            "device": str(DEVICE),
            "noise_std": float(meta["data_cfg"][1]),
            "error": meta.get("error"),
        },
        "series": {
            "window_mw": _r(data.series[lo:hi], 1), "now_index": int(data.val_end - lo),
            "n_hours": int(len(data.series)), "train_end": int(data.train_end), "val_end": int(data.val_end),
            "n_train": int(len(data.X_train)), "n_val": int(len(data.X_val)), "n_test": int(len(data.X_test)),
            "mean": round(data.mean, 1), "std": round(data.std, 1),
        },
        "chamber": _chamber(active, data),
        "learning": _learning(replay, data, model),
        "future": _future(model, untrained, data),
    }
