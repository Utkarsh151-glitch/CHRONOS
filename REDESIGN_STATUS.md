# CHRONOS 2.0 — Redesign Status

**Launch:** `cd "C:\deep learning\CHRONOS"` then `streamlit run app.py` and open http://localhost:8501. Press **F** for full screen and **P** for presentation mode.
The previous dashboard is kept as a fallback: `streamlit run app_classic.py`.

## What changed

The dashboard (cards, radio buttons, pill controls, Plotly panels) is replaced by **one continuous, full-screen cinematic experience** inside a single persistent browser canvas world. Streamlit now only hosts it: `app.py` hides all Streamlit chrome and renders one bidirectional component (`frontend/`) fixed to the whole viewport. Chapters are scenes in the same world, and chapter changes are camera moves rather than page reloads.

| Before (screenshots in `CHRONOS_Visual_References/01_…`) | After (`assets/diagrams/redesign/`) |
|---|---|
| Landing page with an "Enter" button | A 15 s opening: darkness, then a distant light, stars, the approach to a luminous gravitational horizon, a real-data timeline, and a title reveal |
| Flat SVG cell diagram, radio buttons, heatmap cards | A spatial **memory chamber**: four glass gate vessels whose light levels and 32 light threads are the measured activations, plus a memory pathway, pipes and junctions |
| Training HUD cards + replay panel | A **training sequence** in space: forward and backward energy signals across 24 unrolled cells, a measured-gradient column field, a parameter lattice that ripples on Adam updates, and a loss timeline along the floor |
| Forecast chart + KPI cards | A **forecast horizon**: history travels to a bright present-time boundary over a planet at dawn, the forecast emerges, then reality is revealed, followed by the closing statement |

## Components (frontend/)

| File | Component |
|---|---|
| `cosmos.js` | **CinematicBackground**: 3-D star field with warp and parallax, procedural gravitational horizon (pre-rendered, lensed halo, Doppler-bright side, bloom, two cross-faded variants), nebula, planet with atmosphere and dawn, the **corridor** effect, dust; film grain and vignette in CSS |
| `scene_arrival.js` | **TimelineScene** (chapter 00) |
| `scene_chamber.js` | **MemoryChamber / LSTMCellScene / GateMechanism** (chapter 01) |
| `scene_learning.js` | **TrainingSequence** (chapter 02) |
| `scene_future.js` | **ForecastHorizon** (chapter 03) |
| `director.js` | **CameraTransition** + chapter flow + boot |
| `core.js` | **ChapterNavigation** (indicator, Esc map, keys), Streamlit bridge, captions, settings |
| `experience.py` | Python-side payload builder: packages real model outputs only |

## Animations implemented

**Chapter 00: The Arrival of Time.** Dark start, distant light, star fade-in, slow approach to the horizon. The timeline draws itself from the **real simulated series**: 120 h before and 120 h after the validation/test boundary, so NOW is a real boundary between data the model learned from and held-out hours. Light pulses travel past → future. The title letters resolve from blur, followed by the subtitle and question, then a minimal START EXPEDITION control. Skippable (→ / Space / "skip intro").

**Transition 1 (timeline → corridor → chamber).** The camera dives into the timeline at NOW, the data points swell, the timeline becomes a ribbed luminous corridor (warp stars, data lights along the walls), and the chamber resolves at the end of the passage.

**Chapter 01: The Memory Chamber.** A step-by-step reveal with documentary captions: architecture, then x<sub>t</sub>, then h<sub>t−1</sub>, then c<sub>t−1</sub>, then the four gates one by one, then the junctions.
* **Forget gate:** memory particles reach the × junction and each survives with probability f̄<sub>t</sub> (measured). The forgotten ones fall away and fade.
* **Input gate / candidate:** new light is written into the pathway at the + junction, at a rate proportional to mean(i<sub>t</sub>·|g<sub>t</sub>|) (measured). Candidate threads rise above or fall below the midline for positive and negative values.
* **Output gate:** the tapped memory passes through tanh, and particles continue into h<sub>t</sub> with probability ō<sub>t</sub> (measured).
* **Hidden state:** h<sub>t</sub> leaves toward the next hour. At hour 24 the forecast ŷ appears (real prediction).
* **Gate selection:** click a vessel, a pathway label, or press 1–6. The camera zooms (viewBox animation) and the rest of the mechanism subdues. A floating overlay shows the equation, a 1–2 sentence explanation, the measured mean, 32 per-unit bars, a units × hours heatmap and an interpretation. The cell-state focus adds the measured Π f<sub>t</sub> retention curve against an illustrative RNN decay. Esc returns to the whole chamber.
* Hour scrubber (click or Space to play hours), 7 held-out sequences, and a verification line: ✓ gates rebuilt from PyTorch weights match nn.LSTM.

**Transition 2 (chamber → learning).** The gates fire in sequence and a hidden-state signal leaves the cell. The camera pulls back while the chamber shrinks into the position of the **first of 24 unrolled cells**: one cell becomes the sequence.

**Chapter 02: The Learning Sequence.** Seven phases per epoch, each with its own motion: forward propagation (cyan signal, inputs rise into cells), prediction, error (|ŷ − y|), BPTT (orange signal right→left, cells glow by measured |∂L/∂x<sub>t</sub>|), gradients (measured columns), Adam update (lattice ripple scaled by the measured gradient norm), next epoch (loss timeline extends, probe forecast morphs). The first epoch is narrated. Controls: play, pause, step, restart, 1×/2×/4×, click the loss timeline to jump to an epoch, and **retrain live**.

**Transition 3 (learning → future).** A final backward sweep, the update ripple, a forward pass, then a forecast beam leaves the prediction node. The camera follows it right while the planet rises and dawn breaks at the present boundary.

**Chapter 03: The Future.** The 24 history points fly in toward the present, the camera reaches NOW, a pause, then the amber recursive forecast emerges hour by hour from the boundary. The held-out actual line is revealed with error threads. Floating per-day MAE/RMSE, then whole-test-set metrics, then **"THE PAST INFORMS THE FUTURE."** and the measured conclusion and closing question. Toggles: recursive / one-step, untrained, persistence, test day 1–9, replay.

**Other moves** (backward navigation, jumps from the map) use a short warp through space. Reduced effects turns the transitions into short cross-fades.

## Scientific functions preserved

* `model.py`, `train.py`, `dataset.py`, `evaluate.py`: **not modified**.
* `models/trained_lstm.pth`, `models/untrained_lstm.pth`, `results/metrics.json`, `predictions.csv`, `training_history.csv`, `training_replay.json`: **byte-identical** (SHA-256 checked before and after a live retrain test).
* **Live retraining no longer overwrites them.** It writes to `models/live/` and `results/live/`.
* All values on screen come from `experience.build_payload`: gate activations from `extract_gates`, per-sequence `verify_gates` results, recorded training history (losses, gradient norms, ∂L/∂x<sub>t</sub>, probe forecasts, gate means), and `compare_models` forecasts and metrics. JavaScript only does arithmetic on those arrays: means, per-day MAE, the Π f retention product.
* Labelled **conceptual**: particle motion, travelling signals, the transition choreography, and the "plain RNN 0.6ⁿ" comparison curve.

## Tests performed

| Test | Result |
|---|---|
| `python verify.py` (reload, gate reconstruction on 52 sequences, metric recomputation) | ✓ ALL CHECKS PASSED (worst \|Δh\| 2.1e-7, \|Δc\| 1.1e-6) |
| `node --check` on all 7 frontend scripts | ✓ |
| `py_compile` app.py, experience.py, app_classic.py | ✓ |
| Browser at 1600×900: full-screen component, Streamlit chrome hidden, payload received through the bridge | ✓ |
| Opening sequence, skip, START / → | ✓ |
| Transition 1 (corridor), Transition 2 (ignition + pull-back), Transition 3 (beam + dawn) | ✓ screenshots in `assets/diagrams/redesign/` |
| Chamber reveal, gate focus (click + keys 1–6), Esc unfocus, Space plays hours | ✓ |
| Training replay: phases, measured gradient columns, loss timeline, probe morph | ✓ |
| **Live retrain end-to-end** (browser → Python → PyTorch → new payload → replay): 12 epochs, 16 hidden, 0.86 s, test MAE 17.0 MW | ✓ verified artifacts unchanged |
| Future sequence, toggles, closing statement with measured percentages | ✓ |
| Chapter map (Esc), presentation mode (P), warp jump 0 → 3 | ✓ |
| Console errors | none (only Streamlit's standard iframe sandbox warnings) |

**Refinement passes made after inspecting screenshots:** brightened the accretion disk and fixed its shadow draw order; relaid out the opening to remove label/caption collisions; moved chamber captions to the top and the hour scrubber to the bottom edge; reframed the gate focus camera; removed the horizon from behind the epoch readout; fixed overlaps in the probe and loss timeline labels; moved and centred the future ending over the horizon; fixed tween ownership so a skipped intro can no longer drag the black hole into later scenes.

## Unfinished / known limitations

* Not tested on a low-end laptop. If motion stutters, use **reduced effects** (chapter map) or the OS reduced-motion setting, which is honoured automatically.
* Full-screen uses the browser Fullscreen API on the Streamlit page. If the browser refuses, press **F11**.
* `frontend/dev_payload.json` (real outputs of the saved run) lets `frontend/index.html` run from a static server without Streamlit. Live actions need Streamlit.
* Audio / soundtrack: intentionally none.
* The classic dashboard (`app_classic.py`) still writes to `models/` and `results/` when it trains. Use the new app for live demos.
