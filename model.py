"""
CHRONOS — the LSTM forecaster and exact gate-activation reconstruction.

PyTorch's nn.LSTM stacks its four gates in the order  i, f, g, o
inside weight_ih_l0 (4H x I), weight_hh_l0 (4H x H), bias_ih_l0 and bias_hh_l0.
"""
import numpy as np
import torch
import torch.nn as nn

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class ChronosLSTM(nn.Module):
    def __init__(self, input_size: int = 1, hidden_size: int = 32):
        super().__init__()
        self.hidden_size = hidden_size
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=True)
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x):                 # x: (B, T, 1)
        out, _ = self.lstm(x)             # out: (B, T, H) = h_t for every step
        return self.head(out[:, -1, :])   # forecast from the final hidden state


def build_model(hidden_size: int = 32, seed: int = 42) -> ChronosLSTM:
    torch.manual_seed(seed)
    return ChronosLSTM(1, hidden_size).to(DEVICE)


def load_model(path: str, hidden_size: int = 32) -> ChronosLSTM:
    m = ChronosLSTM(1, hidden_size)
    m.load_state_dict(torch.load(path, map_location="cpu"))
    return m.to(DEVICE).eval()


@torch.no_grad()
def extract_gates(model: ChronosLSTM, seq: np.ndarray) -> dict:
    """
    Manually re-run one sequence through the LSTM using its own learned parameters,
    recording every gate at every time step.  seq: (T,) or (T,1) normalized values.
    Returns arrays of shape (T, H) for i, f, g, o, c, h (+ c_prev/h_prev at t).
    """
    lstm = model.lstm
    W_ih, W_hh = lstm.weight_ih_l0.cpu().double(), lstm.weight_hh_l0.cpu().double()
    b = (lstm.bias_ih_l0 + lstm.bias_hh_l0).cpu().double()
    H = model.hidden_size
    x = torch.as_tensor(np.asarray(seq, dtype=np.float64).reshape(-1, 1))
    h = torch.zeros(H, dtype=torch.float64)
    c = torch.zeros(H, dtype=torch.float64)
    rec = {k: [] for k in ("i", "f", "g", "o", "c", "h")}
    for t in range(x.shape[0]):
        z = W_ih @ x[t] + W_hh @ h + b
        i = torch.sigmoid(z[0:H])
        f = torch.sigmoid(z[H:2 * H])
        g = torch.tanh(z[2 * H:3 * H])
        o = torch.sigmoid(z[3 * H:4 * H])
        c = f * c + i * g
        h = o * torch.tanh(c)
        for k, v in zip(("i", "f", "g", "o", "c", "h"), (i, f, g, o, c, h)):
            rec[k].append(v.numpy().copy())
    out = {k: np.stack(v) for k, v in rec.items()}
    pred = model.head(torch.as_tensor(out["h"][-1], dtype=torch.float32).to(DEVICE)).item()
    out["prediction"] = pred
    return out


@torch.no_grad()
def verify_gates(model: ChronosLSTM, seq: np.ndarray) -> dict:
    """
    Compare the manual reconstruction with PyTorch's own nn.LSTM.
    - h_t for all t: from nn.LSTM's output tensor
    - c_t for all t: by stepping nn.LSTM one time step at a time and reading c_n
    """
    rec = extract_gates(model, seq)
    x = torch.as_tensor(np.asarray(seq, dtype=np.float32).reshape(1, -1, 1)).to(DEVICE)
    out, _ = model.lstm(x)
    h_torch = out[0].cpu().double().numpy()
    state, c_list = None, []
    for t in range(x.shape[1]):
        _, state = model.lstm(x[:, t:t + 1, :], state)
        c_list.append(state[1][0, 0].cpu().double().numpy())
    c_torch = np.stack(c_list)
    pred_torch = model(x).item()
    return {
        "max_abs_err_h": float(np.abs(rec["h"] - h_torch).max()),
        "max_abs_err_c": float(np.abs(rec["c"] - c_torch).max()),
        "abs_err_prediction": float(abs(rec["prediction"] - pred_torch)),
        "tolerance": 1e-5,
        "passed": bool(np.abs(rec["h"] - h_torch).max() < 1e-5 and np.abs(rec["c"] - c_torch).max() < 1e-5),
    }
