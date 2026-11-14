"""
CHRONOS — real PyTorch training loop.

Run from the command line to execute the full pipeline:
    python train.py --epochs 20 --hidden 32
It trains the LSTM, saves weights + history, then calls evaluate.py.
Every number recorded here comes from the executed model.
"""
import argparse
import json
import os
import time

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from dataset import generate_series, make_splits
from model import DEVICE, build_model

ROOT = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(ROOT, "models")
RESULTS_DIR = os.path.join(ROOT, "results")
PROBE_LEN = 72  # validation hours replayed in the training theater


def _probe(data):
    """A fixed validation stretch used to snapshot the model's behaviour each epoch."""
    return data.X_val[:PROBE_LEN], data.y_val[:PROBE_LEN]


def _input_gradients(model, x_window, y_target, loss_fn):
    """|dLoss/dx_t| for one window: how strongly the error flows back to each past hour (BPTT)."""
    x = torch.tensor(x_window[None], device=DEVICE, requires_grad=True)
    y = torch.tensor(y_target[None], device=DEVICE)
    model.zero_grad()
    loss_fn(model(x), y).backward()
    g = x.grad[0, :, 0].abs().cpu().numpy()
    model.zero_grad()
    return g.tolist()


@torch.no_grad()
def _gate_means(model, x_window):
    from model import extract_gates
    r = extract_gates(model, x_window[:, 0])
    return {k: float(r[k].mean()) for k in ("i", "f", "g", "o")}


def train_model(data, epochs=20, hidden=32, lr=3e-3, batch_size=64, seed=42, callback=None, pace=0.0):
    """
    Trains a fresh model. `callback(record)` is called after every epoch with real metrics.
    `pace` (seconds) only slows the UI so the audience can follow; it is excluded from
    the reported compute time.
    Returns (model, untrained_state_dict, history list, compute_seconds).
    """
    model = build_model(hidden, seed)
    untrained_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    Xtr = torch.tensor(data.X_train, device=DEVICE)
    ytr = torch.tensor(data.y_train, device=DEVICE)
    Xva = torch.tensor(data.X_val, device=DEVICE)
    yva = torch.tensor(data.y_val, device=DEVICE)
    px, py = _probe(data)
    px_t = torch.tensor(px, device=DEVICE)
    g = torch.Generator().manual_seed(seed)

    history, compute = [], 0.0

    def snapshot(epoch, train_loss, grad_norm, batch_losses):
        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(Xva), yva).item()
            probe_pred = model(px_t)[:, 0].cpu().numpy()
        rec = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "grad_norm": grad_norm,
            "probe_pred_mw": data.denormalize(probe_pred).tolist(),
            "input_grad": _input_gradients(model, px[0], py[0], loss_fn),
            "gate_means": _gate_means(model, px[0]),
            "batch_losses": batch_losses,
        }
        model.train()
        return rec

    # epoch 0 = the untrained network, measured the same way
    with torch.no_grad():
        l0 = loss_fn(model(Xtr), ytr).item()
    rec = snapshot(0, l0, 0.0, [])
    rec["seconds"] = 0.0
    history.append(rec)
    if callback:
        callback(rec)

    for epoch in range(1, epochs + 1):
        t0 = time.perf_counter()
        model.train()
        perm = torch.randperm(len(Xtr), generator=g).to(DEVICE)
        total, n, norms, batch_losses = 0.0, 0, [], []
        for s in range(0, len(Xtr), batch_size):
            idx = perm[s:s + batch_size]
            opt.zero_grad()
            loss = loss_fn(model(Xtr[idx]), ytr[idx])
            loss.backward()                                   # backpropagation through time
            norms.append(nn.utils.clip_grad_norm_(model.parameters(), 1.0).item())
            opt.step()                                        # Adam parameter update
            total += loss.item() * len(idx)
            n += len(idx)
            batch_losses.append(loss.item())
        rec = snapshot(epoch, total / n, float(np.mean(norms)), batch_losses)
        dt = time.perf_counter() - t0
        compute += dt
        rec["seconds"] = dt
        history.append(rec)
        if callback:
            callback(rec)
        if pace:
            time.sleep(pace)

    model.eval()
    return model, untrained_state, history, compute


def make_replay(history, data, hidden, epochs, compute):
    return {"history": history, "probe_actual_mw": data.denormalize(data.y_val[:PROBE_LEN, 0]).tolist(),
            "probe_input_mw": data.denormalize(data.X_val[0, :, 0]).tolist(),
            "hidden": hidden, "epochs": epochs, "compute_seconds": compute}


def save_artifacts(model, untrained_state, history, compute, hidden, epochs, data):
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(MODELS_DIR, "trained_lstm.pth"))
    torch.save(untrained_state, os.path.join(MODELS_DIR, "untrained_lstm.pth"))
    pd.DataFrame([{k: h[k] for k in ("epoch", "train_loss", "val_loss", "grad_norm", "seconds")}
                  for h in history]).to_csv(os.path.join(RESULTS_DIR, "training_history.csv"), index=False)
    replay = make_replay(history, data, hidden, epochs, compute)
    with open(os.path.join(RESULTS_DIR, "training_replay.json"), "w") as f:
        json.dump(replay, f)
    return replay


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--hidden", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-3)
    a = ap.parse_args()

    data = make_splits(generate_series())
    print(f"Device: {DEVICE} | train {len(data.X_train)} / val {len(data.X_val)} / test {len(data.X_test)} windows")
    model, untrained, hist, compute = train_model(
        data, a.epochs, a.hidden, a.lr,
        callback=lambda r: print(f"epoch {r['epoch']:2d}  train {r['train_loss']:.4f}  val {r['val_loss']:.4f}"))
    save_artifacts(model, untrained, hist, compute, a.hidden, a.epochs, data)
    print(f"Training compute time: {compute:.2f}s — weights saved to models/trained_lstm.pth")

    from evaluate import run_evaluation
    m = run_evaluation(hidden=a.hidden, compute_seconds=compute, history=hist)
    print(json.dumps(m, indent=2))


if __name__ == "__main__":
    main()
