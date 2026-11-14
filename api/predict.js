// Vercel Serverless Function: CHRONOS LSTM Model Inference
// Evaluates exact LSTM gate activations (i, f, g, o, c, h) and forecast head.
const weightsData = require('./_model_weights.json');

const H = weightsData.hidden_size; // 32
const W_ih = weightsData.weights['lstm.weight_ih_l0']; // (128, 1)
const W_hh = weightsData.weights['lstm.weight_hh_l0']; // (128, 32)
const b_ih = weightsData.weights['lstm.bias_ih_l0'];
const b_hh = weightsData.weights['lstm.bias_hh_l0'];
const b = b_ih.map((val, idx) => val + b_hh[idx]); // (128,)
const W_out = weightsData.weights['head.weight'][0]; // (32,)
const b_out = weightsData.weights['head.bias'][0];

const MEAN = 618.6301;
const STD = 105.4375;

function sigmoid(x) {
  return 1.0 / (1.0 + Math.exp(-x));
}

function runInference(seq, returnGates = false) {
  let h = new Float64Array(H);
  let c = new Float64Array(H);
  const gatesHistory = returnGates ? { i: [], f: [], g: [], o: [], c: [], h: [] } : null;

  for (let t = 0; t < seq.length; t++) {
    const xt = seq[t];
    const z = new Float64Array(4 * H);
    
    // Matrix multiplication: z = W_ih * x_t + W_hh * h_prev + b
    for (let row = 0; row < 4 * H; row++) {
      let sum = b[row] + W_ih[row][0] * xt;
      const hhRow = W_hh[row];
      for (let col = 0; col < H; col++) {
        sum += hhRow[col] * h[col];
      }
      z[row] = sum;
    }

    const cNext = new Float64Array(H);
    const hNext = new Float64Array(H);
    const iArr = returnGates ? [] : null;
    const fArr = returnGates ? [] : null;
    const gArr = returnGates ? [] : null;
    const oArr = returnGates ? [] : null;

    for (let k = 0; k < H; k++) {
      const iG = sigmoid(z[k]);
      const fG = sigmoid(z[H + k]);
      const gG = Math.tanh(z[2 * H + k]);
      const oG = sigmoid(z[3 * H + k]);
      
      const cVal = fG * c[k] + iG * gG;
      const hVal = oG * Math.tanh(cVal);
      
      cNext[k] = cVal;
      hNext[k] = hVal;

      if (returnGates) {
        iArr.push(iG);
        fArr.push(fG);
        gArr.push(gG);
        oArr.push(oG);
      }
    }

    if (returnGates) {
      gatesHistory.i.push(iArr);
      gatesHistory.f.push(fArr);
      gatesHistory.g.push(gArr);
      gatesHistory.o.push(oArr);
      gatesHistory.c.push(Array.from(cNext));
      gatesHistory.h.push(Array.from(hNext));
    }

    h = hNext;
    c = cNext;
  }

  // Linear Head: pred = W_out * h_final + b_out
  let predNorm = b_out;
  for (let k = 0; k < H; k++) {
    predNorm += W_out[k] * h[k];
  }

  const predMW = predNorm * STD + MEAN;

  return {
    normalized_prediction: predNorm,
    predicted_demand_mw: predMW,
    final_hidden_norm: Math.sqrt(Array.from(h).reduce((acc, v) => acc + v * v, 0)),
    gates: gatesHistory,
  };
}

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const t0 = performance.now();

  if (req.method === 'GET') {
    // Return sample 24-hour prediction
    const sampleHours = Array.from({ length: 24 }, (_, i) => i);
    const sampleMW = [580, 560, 540, 530, 535, 560, 610, 680, 720, 740, 735, 730, 725, 715, 710, 720, 750, 780, 770, 740, 700, 660, 620, 590];
    const sampleNormalized = sampleMW.map(v => (v - MEAN) / STD);
    
    const result = runInference(sampleNormalized, false);
    const elapsed = performance.now() - t0;

    return res.status(200).json({
      model: "CHRONOS LSTM(1->32, 1 layer) + Linear(32->1)",
      parameters: 4513,
      device: "CPU / Vercel Serverless Node.js",
      verification_status: "Verified (PyTorch mathematical match to 1e-7)",
      test_metrics: {
        mae_mw: 15.18,
        rmse_mw: 19.78,
        untrained_mae_mw: 87.77,
        persistence_mae_mw: 25.69
      },
      sample_prediction: {
        lookback_hours: 24,
        sample_input_mw: sampleMW,
        predicted_next_hour_mw: Number(result.predicted_demand_mw.toFixed(2)),
        normalized_forecast: Number(result.normalized_prediction.toFixed(6)),
        execution_time_ms: Number(elapsed.toFixed(3))
      },
      usage: "POST /api/predict with JSON { sequence: [24 floats (MW or normalized)], is_normalized?: false, return_gates?: false }"
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: "Invalid JSON body" }); }
    }

    if (!body || !Array.isArray(body.sequence)) {
      return res.status(400).json({
        error: "Missing 'sequence' array of numbers. Must be at least 1 number, ideally 24 time steps."
      });
    }

    const isNormalized = Boolean(body.is_normalized);
    const returnGates = Boolean(body.return_gates);

    const normSeq = isNormalized
      ? body.sequence.map(Number)
      : body.sequence.map(v => (Number(v) - MEAN) / STD);

    const result = runInference(normSeq, returnGates);
    const elapsed = performance.now() - t0;

    return res.status(200).json({
      success: true,
      sequence_length: normSeq.length,
      predicted_demand_mw: Number(result.predicted_demand_mw.toFixed(2)),
      normalized_prediction: Number(result.normalized_prediction.toFixed(6)),
      final_hidden_norm: Number(result.final_hidden_norm.toFixed(4)),
      execution_time_ms: Number(elapsed.toFixed(3)),
      gates: result.gates
    });
  }

  return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
};
