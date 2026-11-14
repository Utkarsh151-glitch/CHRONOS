"""
CHRONOS 2.0 — A journey through the memory of AI.

One full-screen cinematic experience (frontend/) driven by the verified PyTorch backend.
Launch:  streamlit run app.py          (classic dashboard: streamlit run app_classic.py)
"""
import json
import os

import streamlit as st
import streamlit.components.v1 as components
import torch

from dataset import generate_series, make_splits
from experience import build_payload
from model import DEVICE, ChronosLSTM, build_model
from train import MODELS_DIR, RESULTS_DIR, make_replay, train_model

ROOT = os.path.dirname(os.path.abspath(__file__))
LIVE_MODELS, LIVE_RESULTS = os.path.join(MODELS_DIR, "live"), os.path.join(RESULTS_DIR, "live")
st.set_page_config(page_title="CHRONOS — Inside the Memory of AI", page_icon="⏳", layout="wide",
                   initial_sidebar_state="collapsed")
st.markdown("""<style>
header,[data-testid="stHeader"],[data-testid="stToolbar"],[data-testid="stDecoration"],
[data-testid="stStatusWidget"],[data-testid="stSidebar"],footer{display:none!important}
html,body,.stApp{background:#000!important;overflow:hidden!important}
.block-container,[data-testid="stMainBlockContainer"]{padding:0!important;max-width:100%!important}
iframe[title*="chronos"]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;
  border:0!important;z-index:9999!important;display:block!important;background:#000}
[data-stale="true"],.stale-element{opacity:1!important;transition:none!important}
</style>""", unsafe_allow_html=True)

_chronos = components.declare_component("chronos", path=os.path.join(ROOT, "frontend"))
ss = st.session_state


def _load(path, hidden):
    m = ChronosLSTM(1, hidden)
    m.load_state_dict(torch.load(path, map_location="cpu"))
    return m.to(DEVICE).eval()


def load_saved_run():
    paths = [os.path.join(RESULTS_DIR, "training_replay.json"),
             os.path.join(MODELS_DIR, "trained_lstm.pth"), os.path.join(MODELS_DIR, "untrained_lstm.pth")]
    if not all(os.path.exists(p) for p in paths):
        return False
    with open(paths[0]) as f:
        ss.replay = json.load(f)
    hidden = ss.replay["hidden"]
    ss.model, ss.untrained = _load(paths[1], hidden), _load(paths[2], hidden)
    ss.trained_on, ss.run_source = (7, 12.0), "saved run · python train.py"
    return True


def reset_model(hidden):
    ss.model, ss.replay, ss.trained_on, ss.run_source = None, None, None, ""
    ss.untrained = build_model(hidden, 42).eval()


def rebuild(event=None, error=None):
    ss.version += 1
    ss.payload = build_payload(ss.data, ss.model, ss.untrained, ss.replay, {
        "version": ss.version, "event": event, "run_source": ss.run_source, "data_cfg": ss.data_cfg,
        "trained_on": ss.trained_on, "error": error})


if "init" not in ss:
    ss.init, ss.version, ss.last_evt = True, 0, None
    ss.data_cfg = (7, 12.0)
    ss.data = make_splits(generate_series(seed=7, noise_std=12.0))
    if not load_saved_run():
        reset_model(32)
    rebuild()

evt = _chronos(payload=ss.payload, key="chronos", default=None)

if evt and evt.get("id") != ss.last_evt:
    ss.last_evt = evt["id"]
    action, err = evt.get("action"), None
    try:
        if action == "train":
            epochs = int(min(60, max(1, evt.get("epochs", 20))))
            hidden = 16 if int(evt.get("hidden", 32)) == 16 else 32
            lr = float(min(0.05, max(1e-4, evt.get("lr", 3e-3))))
            model, untrained_state, history, compute = train_model(ss.data, epochs, hidden, lr)
            ss.model = model
            ss.untrained = ChronosLSTM(1, hidden).to(DEVICE)
            ss.untrained.load_state_dict(untrained_state)
            ss.untrained.eval()
            # Live runs never overwrite the verified artifacts in models/ and results/;
            # they are kept separately in models/live/ and results/live/.
            ss.replay = make_replay(history, ss.data, hidden, epochs, compute)
            os.makedirs(LIVE_MODELS, exist_ok=True)
            os.makedirs(LIVE_RESULTS, exist_ok=True)
            torch.save(model.state_dict(), os.path.join(LIVE_MODELS, "live_trained_lstm.pth"))
            torch.save(untrained_state, os.path.join(LIVE_MODELS, "live_untrained_lstm.pth"))
            with open(os.path.join(LIVE_RESULTS, "live_training_replay.json"), "w") as f:
                json.dump(ss.replay, f)
            ss.trained_on, ss.run_source = ss.data_cfg, "live run · trained in this session (saved to models/live/)"
        elif action == "reset":
            reset_model(ss.model.hidden_size if ss.model is not None else 32)
        elif action == "dataset":
            ss.data_cfg = (int(evt.get("seed", 7)), float(min(60, max(0, evt.get("noise", 12.0)))))
            ss.data = make_splits(generate_series(seed=ss.data_cfg[0], noise_std=ss.data_cfg[1]))
    except Exception as e:  # never break the live presentation
        err = f"{type(e).__name__}: {e}"
    rebuild(event=action, error=err)
    st.rerun()
