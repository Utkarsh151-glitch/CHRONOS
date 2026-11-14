# CHRONOS — Final Status

**Launch command**

```bash
cd "C:\deep learning\CHRONOS"
streamlit run app.py
```

Then open http://localhost:8501. To retrain from the command line: `python train.py --epochs 20 --hidden 32`. To re-check everything: `python verify.py`.

## Actual model training (executed on this machine, CPU)

| Item | Value |
|---|---|
| Architecture | LSTM(1→32, 1 layer) + Linear(32→1), **4,513 parameters** |
| Data | Simulated hourly demand, 70 days (1,680 h). Chronological split: 1,152 train / 252 val / 252 test windows |
| Training | Adam lr 3e-3, MSE, batch 64, grad clip 1.0, **20 epochs** |
| Training compute time | **1.28 – 1.46 s** (CLI and in-app runs, excluding the optional "cinematic pace" pauses) |
| Final train loss (MSE, normalised) | **0.0262** (epoch 0, untrained: 0.992) |
| Final validation loss | **0.0395** (best 0.0349) |

## Held-out test metrics (252 test hours, MW)

| Model | MAE | RMSE |
|---|---|---|
| **Trained LSTM** | **15.18** | **19.78** |
| Untrained LSTM (same init) | 87.77 | 112.86 |
| Persistence (t → t+1) | 25.69 | 32.87 |
| Seasonal naive (same hour yesterday) | 39.48 | 48.48 |
| Trained LSTM, 24 h recursive | 25.13 | 32.59 |
| Untrained LSTM, 24 h recursive | 84.15 | 110.52 |

The trained model beats every baseline. The injected noise has σ = 12 MW, so MAE ≈ 9.6 MW is the theoretical floor.

## Gate-extraction verification ✓

* Gates are recomputed by hand from `weight_ih_l0`, `weight_hh_l0`, `bias_ih_l0` and `bias_hh_l0` (order i, f, g, o).
* They are compared with `nn.LSTM`: h from its output tensor, c from stepping it one step at a time.
* **52 test sequences** (trained + untrained): worst |Δh| = 2.1e-7, worst |Δc| = 1.1e-6 (tolerance 1e-5). **PASSED.**
* The prediction from the reconstructed h₂₄ equals `model(x)` exactly.

## Tests performed

* `python train.py`: trains, saves `models/trained_lstm.pth` + `untrained_lstm.pth` and writes all `results/` files ✓
* `python verify.py`: reloads weights, checks gate reconstruction on 52 sequences, and recomputes MAE/RMSE from `predictions.csv` to match `metrics.json` ✓
* Streamlit app launched and driven in a real browser (Playwright, 1440×900):
  * Opening scene → ENTER EXPERIENCE ✓
  * Next/Previous chapter navigation ✓, chapter progress bar ✓
  * Chapter 01: auto-play, gate selection (radio and in-diagram buttons), time-step slider, test-sequence slider, heatmaps, verification badge ✓
  * Chapter 02: TRAIN MODEL runs real training with a live HUD per epoch (values matched the CLI run). Replay theater auto-plays with play/pause/step/speed/epoch slider ✓. RESET MODEL ✓
  * Chapter 03: COMPARE PREDICTIONS shows the animated forecast (recursive / one-step), KPIs and verdict ✓
  * Presentation mode hides the Streamlit chrome and config panels ✓
  * No JavaScript errors in the console (only Streamlit's standard iframe-sandbox warnings)

## Features implemented

* 4 cinematic chapters with animated transitions, opening hero scene, data-flow animation
* **Interactive LSTM cell** (Scenes A/B): 7-phase sequence, particle flow, gate glow and unit strips driven by measured activations, equations, plain-language interpretation
* **Training theater** (Scenes A/C): epoch-by-epoch replay of the real run. Measured ∂L/∂xₜ drives the BPTT pulse, and the probe forecast, loss curve and gate means evolve per epoch
* **Live training HUD** while PyTorch trains
* **Future scene** (Scene D): animated 24 h forecast, trained vs untrained, recursive vs one-step
* Plotly gate heatmaps (f, i, g, o, c, h), gate averages, memory-retention curve (measured Π f vs illustrative RNN)
* Honest automatic verdict, including a fallback explanation if the model fails to beat the baselines
* Generate Dataset (seed, noise) with a warning when the model was trained on different data
* Presentation script, 15 viva Q&As, screenshots in `assets/diagrams/`

## Known limitations / incomplete

* `assets/diagrams/` holds screenshots, not hand-drawn vector diagrams.
* Fonts (Orbitron, Inter) load from Google Fonts. Offline, the app falls back to system fonts and everything still works.
* The Streamlit slider and the in-diagram hour scrubber are independent. The slider sets the starting hour and the heatmap marker.
* Retraining in the app overwrites `models/` and `results/`. Training is deterministic (seed 42), so the default config reproduces the same numbers.
* Chapter navigation re-runs the Streamlit script, so components restart their animations when you change chapter (by design).
