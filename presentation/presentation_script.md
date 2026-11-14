# CHRONOS — Presentation Script (about 10 minutes)

**Before you start:** run `streamlit run app.py`, open http://localhost:8501, click once inside the page (so it receives key presses), then press **P** (presentation mode) and **F** (full screen, or F11).
Let the 15-second opening play, or press → to skip it. Everything runs offline; the font is bundled locally.

> **CHRONOS 2.0 controls:** → / ← (or a presenter clicker) move between chapters, **Space** plays or pauses, **Esc** leaves a gate close-up or opens the chapter map, **1–6** select gates in Chapter 01, **P** presentation mode, **F** full screen.
> In 2.0 the buttons below map to: ENTER EXPERIENCE → *START EXPEDITION*; gate radio buttons → click the glass vessels; TRAIN MODEL → *retrain live* (top right of Chapter 02; the default replay already shows the real saved run); COMPARE PREDICTIONS → plays automatically on arrival in Chapter 03.

---

## Opening (30 s) · Title screen

> "Every sequence has a past. Every prediction has a memory. Today we'll go inside the memory of a neural network:
> a real LSTM I trained in PyTorch, and ask whether it can remember the past to predict the future."

Click **ENTER EXPERIENCE**.

## Chapter 00 · The Arrival of Time (1.5 min)

* Point at the flow animation: *past data → LSTM → memory → future prediction.*
* "The task is electricity-demand forecasting. Demand has daily cycles, weekly cycles, a slow trend and noise.
  The data is **simulated**, so we know exactly what patterns exist."
* Chart: "We split the data **chronologically**: train on the past, validate, and test on a future period the model never sees.
  Normalisation uses **training statistics only** to avoid leakage."
* "Input: the last 24 hours. Output: the next hour."

## Chapter 01 · The Memory Chamber (3 min) ★

* Let **Auto-play** run for one or two hours of the sequence. "Data arrives, then forget gate, input gate, candidate, cell update,
  output gate, hidden state."
* Click **FORGET**. Read the equation. "The colours and numbers here are not decoration. They are the **measured activations**
  of the trained model for this exact hour. Each square below is one of the 32 memory units."
* Click **INPUT** and **CANDIDATE**: "The input gate decides *how much* to write; the candidate decides *what* to write."
* Click **CELL**: "This gold highway is the cell state. It is updated by **addition**: forget a bit, add a bit."
* Click **OUTPUT** / **HIDDEN**: "c is private long-term memory; h is what the cell says out loud. At hour 24, h becomes the prediction."
* Scroll to the green **✓ GATE RECONSTRUCTION VERIFIED** badge: "I recomputed every gate by hand from PyTorch's weights
  and it matches nn.LSTM to within 10⁻⁷."
* Retention chart: "The product of the measured forget gates shows how much memory survives back in time. A plain RNN decays much faster.
  This *mitigates* vanishing gradients; it doesn't eliminate them."

## Chapter 02 · The Learning Sequence (3 min) ★

* Press **⚡ TRAIN MODEL**. "This is real PyTorch training, happening right now on the laptop CPU."
  The HUD updates after every epoch: forward pulse in cyan, backward pulse in orange.
* When training finishes, the **Training Theater** auto-plays. Narrate one epoch:
  1. *Data arrival:* 24 hours enter the unrolled network. The same weights are used at every hour.
  2. *Forward pass:* the state flows left to right and produces a prediction.
  3. *Error:* prediction vs actual, then MSE.
  4. *Backprop through time:* "The orange bars are the **measured** gradient of the loss with respect to each input hour.
     Recent hours matter most, but older hours still get signal."
  5. *Adam update:* all 4,513 parameters move.
* Point at the validation probe: "Watch the cyan forecast lock onto the dashed actual curve as epochs pass."
* Use **4×** or drag the epoch slider if short on time.

## Chapter 03 · The Future (2 min)

* Press **🔭 COMPARE PREDICTIONS**. The 24-hour forecast draws itself.
* "Grey dotted is the *same network* before training. It just predicts the average. Orange is after training."
* Switch **RECURSIVE / ONE-STEP**: "Recursive feeds its own predictions back, so errors can accumulate."
* Read the KPI cards: trained MAE vs untrained vs persistence vs seasonal naive.
* Read the verdict. "The remaining error is close to the noise we injected, which is the floor for any model."
* Closing line on screen: **"Can a machine use what it remembers to predict what happens next?"**
  > "On this data, measurably yes, and now you've seen exactly how."
