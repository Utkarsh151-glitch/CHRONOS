"""
CHRONOS — visual layer: HTML/SVG animation components + Plotly figures.
Every component receives REAL arrays from the model; nothing is synthesised here.
"""
import json
import os

import numpy as np
import plotly.graph_objects as go

ROOT = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.join(ROOT, "assets", "animations")
CSS_PATH = os.path.join(ROOT, "assets", "css", "chronos.css")

CYAN, ORANGE, VIOLET, BLUE, GOLD, MINT = "#38e8ff", "#ff9d3c", "#a66bff", "#5b8cff", "#ffd27a", "#7dffcf"
GATE_META = {
    "f": ("Forget gate f", ORANGE), "i": ("Input gate i", CYAN), "g": ("Candidate g", VIOLET),
    "o": ("Output gate o", BLUE), "c": ("Cell state c", GOLD), "h": ("Hidden state h", MINT),
}


def _read(name):
    with open(os.path.join(ANIM, name), encoding="utf-8") as f:
        return f.read()


def _to_py(o):
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    if isinstance(o, dict):
        return {k: _to_py(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_to_py(v) for v in o]
    return o


def component(name, data=None):
    html = _read(name).replace("/*__CSS__*/", _read("base.css"))
    if data is not None:
        html = html.replace("__DATA__", json.dumps(_to_py(data)))
    return html


def app_css():
    with open(CSS_PATH, encoding="utf-8") as f:
        return f"<style>{f.read()}</style>"


# ---------------------------------------------------------------- components
def lstm_cell_html(gates, x_norm, x_mw, actual_mw, pred_mw, t0=0, focus=None, autoplay=True):
    T, H = gates["h"].shape
    return component("lstm_cell.html", {
        "T": T, "H": H, "x": x_norm, "x_mw": x_mw, "actual_mw": actual_mw, "pred_mw": pred_mw,
        "i": gates["i"], "f": gates["f"], "g": gates["g"], "o": gates["o"], "c": gates["c"], "h": gates["h"],
        "t0": t0, "focus": focus, "autoplay": autoplay,
    })


def theater_html(replay, probe_input_mw, n_train, n_batches, n_params, autoplay=True, start_at_end=False):
    hist = [{k: h[k] for k in ("epoch", "train_loss", "val_loss", "grad_norm", "probe_pred_mw", "input_grad", "gate_means")}
            for h in replay["history"]]
    return component("training_theater.html", {
        "history": hist, "probe_actual_mw": replay["probe_actual_mw"], "probe_input_mw": probe_input_mw,
        "n_train": n_train, "n_batches": n_batches, "n_params": n_params,
        "autoplay": autoplay, "start_at_end": start_at_end,
    })


def future_html(cmp, autoplay=False):
    return component("future.html", {
        "history_mw": cmp["rf_history"], "actual_mw": cmp["rf_actual"],
        "rec_trained": cmp["rf_trained"], "rec_untrained": cmp["rf_untrained"],
        "one_trained": cmp["one_trained"], "one_untrained": cmp["one_untrained"], "autoplay": autoplay,
    })


def live_hud_html(rec, epochs, pace):
    """Markdown HUD redrawn after every real epoch; one forward+backward pulse per redraw."""
    pct = 100 * rec["epoch"] / max(1, epochs)
    dur = max(0.6, pace + 0.35)
    cells = "".join(f'<div class="hc" style="--k:{k}"></div>' for k in range(12))
    return f"""
<div class="hud" style="--dur:{dur}s">
  <div class="hud-top">
    <div><div class="hud-k">EPOCH</div><div class="hud-v">{rec['epoch']:02d}<span>/{epochs:02d}</span></div></div>
    <div><div class="hud-k">TRAIN LOSS</div><div class="hud-v c">{rec['train_loss']:.4f}</div></div>
    <div><div class="hud-k">VAL LOSS</div><div class="hud-v o">{rec['val_loss']:.4f}</div></div>
    <div><div class="hud-k">GRAD NORM</div><div class="hud-v v">{rec['grad_norm']:.3f}</div></div>
  </div>
  <div class="hud-chain" key="{rec['epoch']}">
    <div class="hud-lbl">x<sub>t</sub> →</div>{cells}<div class="hud-y">ŷ</div><div class="hud-L">L</div>
    <div class="fw"></div><div class="bw"></div>
  </div>
  <div class="hud-cap"><span class="cy">● forward pass</span> &nbsp; <span class="or">● error → backprop through time</span> &nbsp; <span class="vi">● Adam update</span>
     &nbsp;·&nbsp; real PyTorch training in progress</div>
  <div class="hud-bar"><div style="width:{pct:.1f}%"></div></div>
</div>"""


# ---------------------------------------------------------------- plotly
def _layout(fig, h=360, title=None):
    fig.update_layout(
        height=h, margin=dict(l=50, r=20, t=50 if title else 20, b=40),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(8,14,34,.55)",
        font=dict(family="Inter, Segoe UI, sans-serif", color="#dbe7ff", size=13),
        title=dict(text=title, font=dict(family="Orbitron, sans-serif", size=14, color="#cfe8ff")) if title else None,
        legend=dict(orientation="h", y=1.08, x=0, bgcolor="rgba(0,0,0,0)"),
        xaxis=dict(gridcolor="rgba(255,255,255,.06)", zeroline=False),
        yaxis=dict(gridcolor="rgba(255,255,255,.06)", zeroline=False),
        hoverlabel=dict(bgcolor="#0a1330"),
    )
    return fig


def dataset_figure(data):
    s = data.series
    x = np.arange(len(s))
    fig = go.Figure()
    for a, b, name, col in [(0, data.train_end, "train", CYAN), (data.train_end, data.val_end, "validation", VIOLET),
                            (data.val_end, len(s), "test (held out)", ORANGE)]:
        fig.add_trace(go.Scatter(x=x[a:b], y=s[a:b], name=name, line=dict(color=col, width=1.4)))
    fig.update_xaxes(title="hour")
    fig.update_yaxes(title="demand (MW, simulated)")
    return _layout(fig, 330, "SIMULATED HOURLY ELECTRICITY DEMAND · CHRONOLOGICAL SPLIT")


def gate_heatmap(gates, key, t_sel):
    name, col = GATE_META[key]
    z = gates[key].T  # (H, T)
    if key in ("f", "i", "o"):
        cs, zmin, zmax, zmid = [[0, "#070b1f"], [0.5, "#5a35c8"], [1, CYAN]], 0, 1, None
    else:
        m = float(np.abs(z).max()) or 1.0
        cs, zmin, zmax, zmid = [[0, ORANGE], [0.5, "#070b1f"], [1, CYAN]], -m, m, 0
    fig = go.Figure(go.Heatmap(z=z, x=np.arange(1, z.shape[1] + 1), y=np.arange(1, z.shape[0] + 1),
                               colorscale=cs, zmin=zmin, zmax=zmax, zmid=zmid,
                               colorbar=dict(thickness=10, len=.9),
                               hovertemplate="hour %{x}<br>unit %{y}<br>value %{z:.3f}<extra></extra>"))
    fig.add_vrect(x0=t_sel + .5, x1=t_sel + 1.5, line=dict(color="#ffffff", width=2), fillcolor="rgba(255,255,255,.06)")
    fig.update_xaxes(title="hour t", dtick=2)
    fig.update_yaxes(title="memory unit")
    return _layout(fig, 300, f"{name.upper()} · MEASURED")


def gate_lines_figure(gates, t_sel):
    fig = go.Figure()
    T = gates["h"].shape[0]
    for k in ("f", "i", "o"):
        fig.add_trace(go.Scatter(x=np.arange(1, T + 1), y=gates[k].mean(1), name=GATE_META[k][0], line=dict(color=GATE_META[k][1], width=3)))
    fig.add_trace(go.Scatter(x=np.arange(1, T + 1), y=np.abs(gates["c"]).mean(1), name="mean |c| (memory)", line=dict(color=GOLD, width=3, dash="dot")))
    fig.add_trace(go.Scatter(x=np.arange(1, T + 1), y=np.abs(gates["h"]).mean(1), name="mean |h|", line=dict(color=MINT, width=2, dash="dash")))
    fig.add_vline(x=t_sel + 1, line=dict(color="white", width=1, dash="dot"))
    fig.update_xaxes(title="hour t")
    return _layout(fig, 300, "GATE AVERAGES OVER THE SEQUENCE · MEASURED")


def retention_figure(gates):
    """Direct-path factor dc_T/dc_t = prod f_k (k>t) along the cell-state highway, measured, vs an illustrative RNN."""
    f = gates["f"]
    T = f.shape[0]
    lstm = [float(np.mean(np.prod(f[t + 1:], axis=0))) if t < T - 1 else 1.0 for t in range(T)]
    rnn = [0.6 ** (T - 1 - t) for t in range(T)]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=np.arange(1, T + 1), y=lstm, name="LSTM: Π forget gates (measured)", line=dict(color=GOLD, width=3)))
    fig.add_trace(go.Scatter(x=np.arange(1, T + 1), y=rnn, name="plain RNN: 0.6ⁿ (illustrative)", line=dict(color="#8a93b0", width=2, dash="dash")))
    fig.update_yaxes(type="log", title="signal surviving to hour 24")
    fig.update_xaxes(title="hour t")
    return _layout(fig, 300, "HOW FAR BACK CAN MEMORY REACH?")


def loss_figure(history):
    e = [h["epoch"] for h in history]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=e, y=[h["train_loss"] for h in history], name="train", line=dict(color=CYAN, width=3), mode="lines+markers"))
    fig.add_trace(go.Scatter(x=e, y=[h["val_loss"] for h in history], name="validation", line=dict(color=ORANGE, width=3), mode="lines+markers"))
    fig.update_yaxes(type="log", title="MSE (normalised)")
    fig.update_xaxes(title="epoch")
    return _layout(fig, 320, "REAL LOSS CURVE")


def compare_figure(cmp, n=96):
    x = cmp["hour"][:n]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=x, y=cmp["actual"][:n], name="actual", line=dict(color="#e6f1ff", width=2, dash="dash")))
    fig.add_trace(go.Scatter(x=x, y=cmp["untrained"][:n], name="untrained LSTM", line=dict(color="#8a93b0", width=2, dash="dot")))
    fig.add_trace(go.Scatter(x=x, y=cmp["persistence"][:n], name="persistence baseline", line=dict(color=VIOLET, width=1.5)))
    fig.add_trace(go.Scatter(x=x, y=cmp["trained"][:n], name="trained LSTM", line=dict(color=ORANGE, width=3)))
    fig.update_xaxes(title="hour (test period)")
    fig.update_yaxes(title="MW (simulated)")
    return _layout(fig, 380, "ONE-STEP FORECASTS ON HELD-OUT TEST DATA")


def error_figure(cmp, n=96):
    x = cmp["hour"][:n]
    a = cmp["actual"][:n]
    fig = go.Figure()
    fig.add_trace(go.Bar(x=x, y=np.abs(cmp["untrained"][:n] - a), name="|error| untrained", marker_color="rgba(138,147,176,.55)"))
    fig.add_trace(go.Bar(x=x, y=np.abs(cmp["trained"][:n] - a), name="|error| trained", marker_color=ORANGE))
    fig.update_layout(barmode="overlay")
    fig.update_xaxes(title="hour (test period)")
    fig.update_yaxes(title="absolute error (MW)")
    return _layout(fig, 300, "PREDICTION ERRORS")
