"""
CHRONOS — Inside the Memory of AI
A cinematic, interactive walk through a REAL PyTorch LSTM.

Launch:  streamlit run app.py
"""
import json
import math
import os
import time

import numpy as np
import streamlit as st
import streamlit.components.v1 as components
import torch

import visualization as V
from dataset import generate_series, make_splits
from evaluate import compare_models, mae, rmse, run_evaluation
from model import ChronosLSTM, DEVICE, build_model, extract_gates, verify_gates
from train import MODELS_DIR, RESULTS_DIR, make_replay, save_artifacts, train_model

st.set_page_config(page_title="CHRONOS — Inside the Memory of AI", page_icon="⏳", layout="wide",
                   initial_sidebar_state="collapsed")
st.markdown(V.app_css(), unsafe_allow_html=True)

CHAPTERS = [("00", "THE ARRIVAL OF TIME"), ("01", "THE MEMORY CHAMBER"),
            ("02", "THE LEARNING SEQUENCE"), ("03", "THE FUTURE")]
ss = st.session_state


# ------------------------------------------------------------------ state
def _load_state_dict(path, hidden):
    m = ChronosLSTM(1, hidden)
    m.load_state_dict(torch.load(path, map_location="cpu"))
    return m.to(DEVICE).eval()


def load_saved_run():
    replay_p = os.path.join(RESULTS_DIR, "training_replay.json")
    tr_p, un_p = os.path.join(MODELS_DIR, "trained_lstm.pth"), os.path.join(MODELS_DIR, "untrained_lstm.pth")
    if not all(os.path.exists(p) for p in (replay_p, tr_p, un_p)):
        return False
    with open(replay_p) as f:
        replay = json.load(f)
    ss.hidden = replay["hidden"]
    ss.model = _load_state_dict(tr_p, ss.hidden)
    ss.untrained = _load_state_dict(un_p, ss.hidden)
    ss.replay = replay
    ss.trained_on = (7, 12.0)
    ss.run_source = "saved run (python train.py)"
    return True


def reset_model(hidden=32):
    ss.hidden = hidden
    ss.model = None
    ss.untrained = build_model(hidden, 42).eval()
    ss.replay = None
    ss.trained_on = None
    ss.compared = False


if "init" not in ss:
    ss.init = True
    ss.entered, ss.chapter, ss.pm, ss.compared = False, 0, False, False
    ss.data_cfg = (7, 12.0)
    ss.data = make_splits(generate_series(seed=7, noise_std=12.0))
    if not load_saved_run():
        reset_model(32)

pm = ss.pm
if pm:
    st.markdown("""<style>header[data-testid="stHeader"],[data-testid="stSidebar"],[data-testid="stToolbar"],footer{display:none!important}
      .block-container{max-width:100%!important;padding:.5rem 1.6rem 2rem!important}
      .stMarkdown p,.stMarkdown li{font-size:1.15rem!important}</style>""", unsafe_allow_html=True)


def go_chapter(k):
    ss.chapter = max(0, min(len(CHAPTERS) - 1, k))


def kpis(items):
    html = '<div class="kpis">' + "".join(
        f'<div class="kpi" style="--acc:{c}"><div class="k">{k}</div><div class="v">{v}</div><div class="s">{s}</div></div>'
        for k, v, s, c in items) + "</div>"
    st.markdown(html, unsafe_allow_html=True)


def chapter_header(k, lead):
    num, title = CHAPTERS[k]
    st.markdown(f'<div class="chap" id="chap{k}"><div class="num">CHAPTER {num}</div><div class="ttl">{title}</div>'
                f'<div class="lead">{lead}</div></div>', unsafe_allow_html=True)


def nav(where):
    c1, c2, c3 = st.columns([1, 4, 1])
    with c1:
        st.button("◀ PREVIOUS CHAPTER", key=f"prev_{where}", on_click=go_chapter, args=(ss.chapter - 1,),
                  disabled=ss.chapter == 0, use_container_width=True)
    with c3:
        st.button("NEXT CHAPTER ▶", key=f"next_{where}", on_click=go_chapter, args=(ss.chapter + 1,),
                  disabled=ss.chapter == len(CHAPTERS) - 1, use_container_width=True, type="primary")


def n_params(model):
    return sum(p.numel() for p in model.parameters())


# ------------------------------------------------------------------ opening
if not ss.entered:
    components.html(V.component("hero.html"), height=600)
    c = st.columns([2, 1, 2])[1]
    if c.button("ENTER EXPERIENCE", type="primary", use_container_width=True):
        ss.entered = True
        st.rerun()
    st.markdown('<p style="text-align:center;color:#6f82a8;font-size:.85rem">All data in CHRONOS is simulated. '
                'All model results come from a real PyTorch LSTM trained on this machine.</p>', unsafe_allow_html=True)
    st.stop()

# ------------------------------------------------------------------ top bar
top = st.columns([1.3, 5, 1.2])
top[0].markdown('<div class="brand" style="padding-top:.7rem">CHRON<span>O</span>S</div>', unsafe_allow_html=True)
segs = "".join(f'<div class="seg {"on" if k == ss.chapter else "done" if k < ss.chapter else ""}">{n} · {t}</div>'
               for k, (n, t) in enumerate(CHAPTERS))
top[1].markdown(f'<div class="prog">{segs}</div>', unsafe_allow_html=True)
ss.pm = top[2].toggle("Presentation mode", value=ss.pm)
if ss.pm != pm:
    st.rerun()
nav("top")

model_ready = ss.model is not None
active_model = ss.model if model_ready else ss.untrained
data = ss.data

# ================================================================== CHAPTER 00
if ss.chapter == 0:
    chapter_header(0, "Electricity demand rises and falls with the rhythm of human life. "
                      "Can a neural network learn that rhythm from the past, and forecast the next hour?")
    components.html(V.component("pipeline.html"), height=290)
    c1, c2 = st.columns([1.15, 1])
    with c1:
        st.markdown("""<div class="glass"><h4>THE PROBLEM</h4>
        Power grids must know <b>tomorrow's demand today</b>. Demand follows <b>daily cycles</b> (people wake, work, cook),
        <b>weekly cycles</b> (weekends are quieter), slow <b>trends</b>, and random <b>noise</b>.<br><br>
        A plain feed-forward network sees a single snapshot. An <b>LSTM</b> reads the last <b>24 hours in order</b>,
        keeps a running <b>memory</b>, and uses it to predict hour 25.</div>""", unsafe_allow_html=True)
    with c2:
        st.markdown("""<div class="glass"><h4>THE MISSION</h4>
        <b>01</b> · open the LSTM cell and see its four gates<br>
        <b>02</b> · watch a real PyTorch LSTM learn, epoch by epoch<br>
        <b>03</b> · test it on future data it has never seen<br><br>
        <span class="badge m">MEASURED</span> = numbers from the real model &nbsp;
        <span class="badge c">CONCEPTUAL</span> = illustrative animation</div>""", unsafe_allow_html=True)
    st.plotly_chart(V.dataset_figure(data), use_container_width=True)
    kpis([("TRAIN WINDOWS", f"{len(data.X_train):,}", f"hours 1–{data.train_end}", V.CYAN),
          ("VALIDATION WINDOWS", f"{len(data.X_val):,}", "model selection", V.VIOLET),
          ("TEST WINDOWS", f"{len(data.X_test):,}", "never seen in training", V.ORANGE),
          ("INPUT → OUTPUT", "24 h → 1 h", f"normalised with train μ={data.mean:.0f}, σ={data.std:.0f}", V.GOLD)])
    if not pm:
        with st.expander("⚙ Generate a new simulated dataset"):
            g1, g2, g3 = st.columns(3)
            seed = g1.number_input("Random seed", 0, 9999, ss.data_cfg[0])
            noise = g2.slider("Noise level (MW std)", 0.0, 40.0, float(ss.data_cfg[1]), 1.0)
            g3.write("")
            if g3.button("GENERATE DATASET", use_container_width=True):
                ss.data_cfg = (int(seed), float(noise))
                ss.data = make_splits(generate_series(seed=int(seed), noise_std=float(noise)))
                ss.compared = False
                st.rerun()
            st.caption("Signal = 600 + daily sine (amplitude modulated weekly) + evening-peak harmonic + weekly cycle "
                       "− weekend dip + 0.06·t trend + Gaussian noise. Split 70/15/15 chronologically.")
    if ss.trained_on is not None and ss.trained_on != ss.data_cfg:
        st.warning("The current model was trained on a different simulated dataset. Retrain it in Chapter 02 for a fair test.")

# ================================================================== CHAPTER 01
elif ss.chapter == 1:
    chapter_header(1, "Inside every LSTM cell, four gates decide what to forget, what to write, and what to reveal. "
                      "Below: the real activations of our trained network, hour by hour.")
    if not model_ready:
        st.warning("No trained model in memory: showing the UNTRAINED network's activations. Train it in Chapter 02.")
    GATE_OPTS = {"▶ Auto-play all gates": (None, "f"), "Forget gate": ("forget", "f"), "Input gate": ("input", "i"),
                 "Candidate state": ("candidate", "g"), "Cell state": ("cell", "c"), "Output gate": ("output", "o"),
                 "Hidden state": ("hidden", "h")}
    c1, c2, c3 = st.columns([2.4, 1.2, 1.2])
    gate_choice = c1.radio("Select LSTM gate", list(GATE_OPTS), horizontal=True)
    t_sel = c2.slider("Select time step (hour)", 1, 24, 1) - 1
    win = c3.slider("Test sequence #", 0, len(data.X_test) - 1, 0, help="Which held-out 24-hour window to inspect")
    focus, hm_key = GATE_OPTS[gate_choice]

    seq = data.X_test[win, :, 0]
    gates = extract_gates(active_model, seq)
    x_mw = data.denormalize(seq)
    actual_mw = float(data.series[data.test_target_idx[win]])
    pred_mw = float(data.denormalize(gates["prediction"]))
    components.html(V.lstm_cell_html(gates, seq, x_mw, actual_mw, pred_mw, t0=t_sel, focus=focus,
                                     autoplay=focus is None), height=880)

    chk = verify_gates(active_model, seq)
    st.markdown(
        f'<span class="badge {"ok" if chk["passed"] else "m"}">{"✓" if chk["passed"] else "✗"} GATE RECONSTRUCTION VERIFIED</span>'
        f'<span class="badge m">max |Δh| = {chk["max_abs_err_h"]:.1e}</span><span class="badge m">max |Δc| = {chk["max_abs_err_c"]:.1e}</span>'
        f'<span style="color:#8aa0c8;font-size:.85rem"> gates recomputed by hand from weight_ih_l0, weight_hh_l0, bias_ih_l0, bias_hh_l0 '
        f'(PyTorch order i, f, g, o) and compared with nn.LSTM\'s own forward pass</span>', unsafe_allow_html=True)

    h1, h2 = st.columns(2)
    h1.plotly_chart(V.gate_heatmap(gates, hm_key, t_sel), use_container_width=True)
    h2.plotly_chart(V.gate_lines_figure(gates, t_sel), use_container_width=True)

    e1, e2 = st.columns([1, 1])
    with e1:
        st.markdown('<div class="glass"><h4>THE SIX EQUATIONS</h4>', unsafe_allow_html=True)
        st.latex(r"f_t=\sigma(W_f[h_{t-1},x_t]+b_f)\qquad i_t=\sigma(W_i[h_{t-1},x_t]+b_i)")
        st.latex(r"g_t=\tanh(W_g[h_{t-1},x_t]+b_g)\qquad o_t=\sigma(W_o[h_{t-1},x_t]+b_o)")
        st.latex(r"c_t=f_t\odot c_{t-1}+i_t\odot g_t\qquad h_t=o_t\odot\tanh(c_t)")
        st.markdown("""<b>Cell state c</b> = long-term memory, changed only by gated <i>addition</i>.
        <b>Hidden state h</b> = short-term output, what the cell exposes each hour.</div>""", unsafe_allow_html=True)
    with e2:
        st.plotly_chart(V.retention_figure(gates), use_container_width=True)
    if not pm:
        st.markdown("""<div class="glass"><h4>WHY GATES HELP WITH VANISHING GRADIENTS</h4>
        In a plain RNN the gradient travelling back k steps is multiplied by the recurrent Jacobian k times, so it usually
        shrinks (or explodes) exponentially. In an LSTM the cell state has a direct path:
        ∂c<sub>t</sub>/∂c<sub>t−1</sub> includes the term f<sub>t</sub>, so when the forget gate stays near 1 the signal survives
        many steps. The gold curve above uses the <b>measured</b> forget gates of this sequence; the grey curve is illustrative.
        This <b>mitigates</b> vanishing gradients; it does not eliminate them: other paths still shrink, very long dependencies
        remain hard, and exploding gradients are still controlled with clipping (we clip at norm 1.0).</div>""", unsafe_allow_html=True)

# ================================================================== CHAPTER 02
elif ss.chapter == 2:
    chapter_header(2, "Press TRAIN and a real PyTorch LSTM learns from simulated history: forward pass, error, "
                      "backpropagation through time, Adam update, over and over.")
    if not pm:
        with st.expander("⚙ Training configuration", expanded=not model_ready):
            a, b, c, d = st.columns(4)
            ss.cfg_epochs = a.slider("Epochs", 5, 40, ss.get("cfg_epochs", 20))
            ss.cfg_hidden = b.selectbox("Hidden units", [16, 32], index=[16, 32].index(ss.get("cfg_hidden", 32)))
            ss.cfg_lr = c.select_slider("Learning rate (Adam)", [1e-3, 2e-3, 3e-3, 5e-3, 1e-2], value=ss.get("cfg_lr", 3e-3))
            ss.cfg_pace = d.slider("Cinematic pace (s / epoch)", 0.0, 1.5, ss.get("cfg_pace", 0.5), 0.1,
                                   help="Pauses between real epochs so the audience can follow. Excluded from reported training time.")
            st.caption(f"Architecture: LSTM(input=1, hidden={ss.cfg_hidden}, layers=1) → Linear({ss.cfg_hidden}→1) · "
                       f"loss = MSE · optimizer = Adam · batch = 64 · lookback = 24 h · device = {DEVICE}")
    epochs, hidden = ss.get("cfg_epochs", 20), ss.get("cfg_hidden", 32)
    lr, pace = ss.get("cfg_lr", 3e-3), ss.get("cfg_pace", 0.5)

    b1, b2, _ = st.columns([1.3, 1, 3])
    train_clicked = b1.button("⚡ TRAIN MODEL", type="primary", use_container_width=True)
    if b2.button("⟲ RESET MODEL", use_container_width=True):
        reset_model(hidden)
        st.rerun()

    if train_clicked:
        hud, chart = st.empty(), st.empty()
        live = []

        def on_epoch(rec):
            live.append(rec)
            hud.markdown(V.live_hud_html(rec, epochs, pace), unsafe_allow_html=True)
            chart.plotly_chart(V.loss_figure(live), use_container_width=True, key=f"live_{rec['epoch']}")

        model, untrained_state, history, compute = train_model(data, epochs, hidden, lr, callback=on_epoch, pace=pace)
        ss.model, ss.hidden = model, hidden
        ss.untrained = ChronosLSTM(1, hidden).to(DEVICE)
        ss.untrained.load_state_dict(untrained_state)
        ss.untrained.eval()
        ss.replay = save_artifacts(model, untrained_state, history, compute, hidden, epochs, data)
        try:
            run_evaluation(hidden=hidden, compute_seconds=compute, history=history, data=data)
        except Exception as e:  # results files are a bonus; never break the live demo
            st.caption(f"(metrics.json not written: {e})")
        ss.trained_on, ss.run_source, ss.compared = ss.data_cfg, "live run in this app", False
        hud.empty(); chart.empty()
        ss.just_trained = True
        st.rerun()

    if ss.replay is None:
        st.markdown("""<div class="glass"><h4>READY</h4>The network is initialised with random weights. Press <b>TRAIN MODEL</b>.
        The HUD will update after every real epoch, and afterwards the full run can be replayed as an animated sequence.</div>""",
                    unsafe_allow_html=True)
    else:
        rp, hist = ss.replay, ss.replay["history"]
        st.markdown('<span class="badge m">MEASURED</span><span class="badge c">CONCEPTUAL MOTION</span>'
                    '<span style="color:#8aa0c8;font-size:.86rem"> The moving pulses illustrate the order of computation. '
                    'Every number, bar and curve is a value recorded from the real training run '
                    f'({ss.get("run_source", "")}). The backward pulse illustrates BPTT; the actual gradients are computed by PyTorch autograd.</span>',
                    unsafe_allow_html=True)
        components.html(V.theater_html(rp, rp.get("probe_input_mw", data.denormalize(data.X_val[0, :, 0]).tolist()),
                                       len(data.X_train), math.ceil(len(data.X_train) / 64),
                                       n_params(ss.model) if ss.model is not None else 0,
                                       autoplay=ss.pop("just_trained", False)), height=830)
        kpis([("EPOCHS", f"{hist[-1]['epoch']}", f"{rp['hidden']} hidden units", V.CYAN),
              ("FINAL TRAIN LOSS", f"{hist[-1]['train_loss']:.4f}", f"from {hist[0]['train_loss']:.3f} untrained", V.CYAN),
              ("FINAL VAL LOSS", f"{hist[-1]['val_loss']:.4f}", f"best {min(h['val_loss'] for h in hist):.4f}", V.ORANGE),
              ("TRAINING TIME", f"{rp['compute_seconds']:.2f} s", f"pure compute on {DEVICE}", V.VIOLET),
              ("PARAMETERS", f"{n_params(ss.model):,}" if ss.model is not None else "—", "weights saved to models/", V.GOLD)])
        if not pm:
            st.plotly_chart(V.loss_figure(hist), use_container_width=True)

# ================================================================== CHAPTER 03
elif ss.chapter == 3:
    chapter_header(3, "The moment of truth: future hours the network has never seen. "
                      "Same test data, same architecture: untrained memory versus trained memory.")
    if not model_ready:
        st.warning("Train the model in Chapter 02 first.")
    else:
        c1, c2, _ = st.columns([1.2, 1.6, 2])
        if c1.button("🔭 COMPARE PREDICTIONS", type="primary", use_container_width=True):
            ss.compared = True
        day = c2.slider("Forecast start (test day)", 0, (len(data.X_test) - 24) // 24, 0)
        if ss.compared:
            cmp = compare_models(ss.model, ss.untrained, data, start_offset=day * 24)
            components.html(V.future_html(cmp, autoplay=True), height=600)
            a = cmp["actual"]
            res = {k: (mae(a, cmp[k]), rmse(a, cmp[k])) for k in ("trained", "untrained", "persistence", "seasonal_naive")}
            hist = ss.replay["history"] if ss.replay else None
            kpis([("TRAINED LSTM · MAE", f"{res['trained'][0]:.1f} MW", f"RMSE {res['trained'][1]:.1f} MW", V.ORANGE),
                  ("UNTRAINED LSTM · MAE", f"{res['untrained'][0]:.1f} MW", f"RMSE {res['untrained'][1]:.1f} MW", "#8a93b0"),
                  ("PERSISTENCE · MAE", f"{res['persistence'][0]:.1f} MW", f"RMSE {res['persistence'][1]:.1f} MW", V.VIOLET),
                  ("SEASONAL NAIVE · MAE", f"{res['seasonal_naive'][0]:.1f} MW", f"RMSE {res['seasonal_naive'][1]:.1f} MW", V.BLUE),
                  ("TRAIN / VAL LOSS", f"{hist[-1]['train_loss']:.3f} / {hist[-1]['val_loss']:.3f}" if hist else "—", "MSE, normalised", V.CYAN),
                  ("TRAINING TIME", f"{ss.replay['compute_seconds']:.2f} s" if ss.replay else "—", f"{len(a)} test hours evaluated", V.GOLD)])
            best_base = min(res["persistence"][0], res["seasonal_naive"][0])
            if res["trained"][0] < res["untrained"][0] and res["trained"][0] < best_base:
                verdict = (f"The trained LSTM cuts the error by <b>{100 * (1 - res['trained'][0] / res['untrained'][0]):.0f}%</b> versus "
                           f"its untrained self and by <b>{100 * (1 - res['trained'][0] / best_base):.0f}%</b> versus the best simple baseline. "
                           f"The remaining error is close to the injected noise (σ = {ss.data_cfg[1]:.0f} MW, i.e. MAE ≈ {0.8 * ss.data_cfg[1]:.0f} MW "
                           "is the floor for any model).")
            else:
                verdict = ("The trained LSTM did <b>not</b> beat every baseline on this run. Possible reasons: too few epochs, "
                           "a learning rate that is too high or low, a model trained on a different simulated dataset, or a test "
                           "period that differs from training. This is the real outcome; nothing has been adjusted.")
            st.markdown(f'<div class="glass"><h4>VERDICT · MEASURED</h4>{verdict}</div>', unsafe_allow_html=True)
            p1, p2 = st.columns([1.4, 1])
            p1.plotly_chart(V.compare_figure(cmp), use_container_width=True)
            p2.plotly_chart(V.error_figure(cmp), use_container_width=True)
            st.markdown('<div class="closing">"Can a machine use what it remembers<br>to predict what happens next?"</div>',
                        unsafe_allow_html=True)
        else:
            st.markdown("""<div class="glass"><h4>READY</h4>Press <b>COMPARE PREDICTIONS</b> to run the untrained and the trained
            LSTM on the same held-out test hours, alongside persistence ("next hour = this hour") and seasonal-naive
            ("next hour = same hour yesterday") baselines.</div>""", unsafe_allow_html=True)

st.write("")
nav("bottom")
