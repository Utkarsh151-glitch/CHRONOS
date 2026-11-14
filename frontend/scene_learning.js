/* CHRONOS 2.0 — Chapter 02 · TrainingSequence
   A replay of the REAL training run (payload.learning.history): every loss, gradient magnitude,
   gradient norm and forecast shown comes from the executed PyTorch model.
   The travelling signals illustrate the order of computation (conceptual). */
(() => {
  const C = window.CHRONOS;
  const N = 24, X0 = 150, X1 = 1250, CY = 440, PX = 1385, PY = 440, AY = 600;
  const cx = k => X0 + (X1 - X0) * k / (N - 1);
  const PH = [
    { key: 'forward', ms: 1600, label: 'FORWARD PROPAGATION', col: '#7fd8f0' },
    { key: 'predict', ms: 700, label: 'PREDICTION', col: '#7fd8f0' },
    { key: 'error', ms: 900, label: 'ERROR', col: '#ffb15c' },
    { key: 'bptt', ms: 1600, label: 'BACKPROPAGATION THROUGH TIME', col: '#ff8a3d' },
    { key: 'grad', ms: 900, label: 'GRADIENTS', col: '#ff8a3d' },
    { key: 'adam', ms: 1100, label: 'ADAM UPDATE', col: '#b49cff' },
    { key: 'next', ms: 750, label: 'NEXT EPOCH', col: '#f3f1ea' },
  ];
  const st = document.createElement('style');
  st.textContent = `
  #s2 .read{position:absolute;left:3cqw;top:8cqh}
  #s2 .read .ep{font-size:3.4cqw;font-weight:200;letter-spacing:.14em;color:#fff;line-height:1}
  #s2 .read .ep small{font-size:1.1cqw;color:var(--dim);letter-spacing:.2em}
  #s2 .read .ls{margin-top:.8cqw;font-size:.95cqw;letter-spacing:.12em;color:var(--dim)}
  #s2 .read .ls b{font-weight:400}
  #s2 .phase{position:absolute;left:0;right:0;top:34.5cqh;text-align:center;font-size:1.05cqw;letter-spacing:.7em;transition:color .4s, opacity .4s}
  #s2 .pdots{position:absolute;left:0;right:0;top:38.5cqh;display:flex;justify-content:center;gap:.5cqw}
  #s2 .pdots i{width:1.6cqw;height:1px;background:rgba(255,255,255,.18);transition:background .3s}
  #s2 .ctrls{position:absolute;right:2.5cqw;top:7.6cqh;display:flex;gap:.2cqw;align-items:center}
  #s2 .ctrls .sep{width:1px;height:1.2cqw;background:rgba(255,255,255,.15);margin:0 .6cqw}
  #s2 .note{position:absolute;left:3cqw;bottom:.9cqh}
  #s2 .live{position:absolute;left:0;right:0;top:44cqh;text-align:center;font-size:.9cqw;letter-spacing:.5em;color:var(--amber);opacity:0;transition:opacity .5s}
  #s2 .live.on{opacity:1;animation:pulse 1.6s ease-in-out infinite}
  @keyframes pulse{50%{opacity:.45}}
  body.pm #s2 .note{display:none}
  `;
  document.head.appendChild(st);

  const S = { el: document.getElementById('s2'), epoch: 1, ph: 0, u: 0, playing: false, speed: 2, shown: 0, training: false };
  C.scenes[2] = S;
  const $ = s => S.el.querySelector(s);

  S.build = d => {
    S.el.innerHTML = `
      <svg class="world" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
        <defs><filter id="l-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="l-cube" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3a58" stop-opacity=".9"/><stop offset="1" stop-color="#070b14" stop-opacity=".95"/></linearGradient></defs>
        <g id="l-lattice"></g><g id="l-probe"></g><g id="l-chain"></g><g id="l-loss"></g>
      </svg>
      <canvas class="fx"></canvas>
      <div class="read"><div class="ep"></div><div class="ls"></div></div>
      <div class="phase"></div><div class="pdots"></div><div class="live">LIVE · PYTORCH IS TRAINING ON THIS MACHINE</div>
      <div class="ctrls">
        <button class="ctl" id="l-play">play</button><button class="ctl" id="l-step">step</button><button class="ctl" id="l-restart">restart</button>
        <span class="sep"></span><button class="ctl" data-sp="1">1×</button><button class="ctl" data-sp="2">2×</button><button class="ctl" data-sp="4">4×</button>
        <span class="sep"></span><button class="ctl" id="l-train">retrain live</button>
      </div>
      <div class="note tagline"><span class="m">measured</span> losses, ∂L/∂x<sub>t</sub>, gradient norms, forecasts · <span class="c">conceptual</span> signal motion · autograd computes the real gradients</div>`;
    S.svg = $('svg'); S.cv = $('canvas.fx'); S.g = S.cv.getContext('2d');
    $('#l-play').onclick = () => S.toggle();
    $('#l-step').onclick = () => { S.playing = false; S.narrate = true; nextPhase(); S.u = .999; ui(); };
    $('#l-restart').onclick = () => S.restart(true);
    $('#l-train').onclick = () => C.requestTrain();
    S.el.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.speed = +b.dataset.sp; ui(); });
    addEventListener('resize', size); size();
    S.load(d);
  };
  function size() { const r = S.el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5); S.cv.width = Math.max(1, r.width * dpr); S.cv.height = Math.max(1, r.height * dpr); S.sc = S.cv.width / 1600; }

  S.load = d => {
    S.L = d.learning; S.meta = d.meta;
    buildChain(); buildLattice();
    if (S.L) { buildLoss(); buildProbe(); S.restart(false); }
    else { $('#l-loss').innerHTML = ''; $('#l-probe').innerHTML = ''; ui(); }
  };

  function buildChain() {
    const L = S.L, inp = L ? L.probe_input_mw : Array.from({ length: N }, () => 0);
    const lo = Math.min(...inp), hi = Math.max(...inp);
    S.inY = inp.map(v => 690 - 120 * (v - lo) / (hi - lo + 1e-9));
    let s = `<line x1="${X0 - 70}" x2="${X1 + 30}" y1="${CY - 26}" y2="${CY - 26}" stroke="rgba(255,207,138,.28)" stroke-width="2"/>
      <line x1="${X0 - 70}" x2="${X1 + 30}" y1="${CY + 26}" y2="${CY + 26}" stroke="rgba(217,238,255,.2)" stroke-width="1.4"/>
      <path d="M ${X1 + 30} ${CY + 26} C ${X1 + 80} ${CY + 26}, ${PX - 70} ${PY}, ${PX - 28} ${PY}" fill="none" stroke="rgba(217,238,255,.25)" stroke-width="1.4"/>
      <text x="${X0 - 70}" y="${CY - 36}" fill="rgba(255,207,138,.6)" font-size="11" letter-spacing="5">c · MEMORY</text>
      <text x="${X0 - 70}" y="${CY + 48}" fill="rgba(217,238,255,.5)" font-size="11" letter-spacing="5">h</text>
      <polyline points="${S.inY.map((y, k) => `${cx(k)},${y}`).join(' ')}" fill="none" stroke="rgba(127,216,240,.35)" stroke-width="1.4"/>
      <text x="${X0 - 70}" y="726" fill="rgba(127,216,240,.65)" font-size="11" letter-spacing="5">x · 24 HOURS OF HISTORY</text>`;
    for (let k = 0; k < N; k++) {
      const x = cx(k);
      s += `<line x1="${x}" x2="${x}" y1="${S.inY[k]}" y2="${CY + 18}" stroke="rgba(127,216,240,.08)"/>
        <circle class="in" cx="${x}" cy="${S.inY[k]}" r="3.4" fill="#7fd8f0"/>
        <rect class="gcol" x="${x - 4}" y="${CY - 20}" width="8" height="0" fill="#ff8a3d" opacity=".8"/>
        <path d="M ${x - 15} ${CY - 15} l 6 -6 h 30 l -6 6 z" fill="rgba(160,185,225,.16)"/>
        <rect class="cube" x="${x - 15}" y="${CY - 15}" width="30" height="30" rx="3" fill="url(#l-cube)" stroke="rgba(160,190,230,.45)" stroke-width="1.2"/>
        <rect class="core" x="${x - 8}" y="${CY - 8}" width="16" height="16" rx="2" fill="#7fd8f0" opacity="0"/>`;
    }
    s += `<circle id="l-pred" cx="${PX}" cy="${PY}" r="26" fill="rgba(255,177,92,.06)" stroke="rgba(255,177,92,.6)" stroke-width="1.5"/>
      <circle id="l-predc" cx="${PX}" cy="${PY}" r="20" fill="#ffb15c" opacity="0" filter="url(#l-glow)"/>
      <text x="${PX}" y="${PY - 42}" text-anchor="middle" fill="rgba(243,241,234,.5)" font-size="11" letter-spacing="5">FORECAST ŷ</text>
      <text id="l-predt" x="${PX + 42}" y="${PY + 5}" fill="#ffb15c" font-size="17" letter-spacing="1"></text>
      <circle cx="${PX}" cy="${AY}" r="18" fill="none" stroke="rgba(243,241,234,.7)" stroke-width="1.4"/>
      <text x="${PX}" y="${AY + 44}" text-anchor="middle" fill="rgba(243,241,234,.5)" font-size="11" letter-spacing="5">ACTUAL y</text>
      <text id="l-actt" x="${PX + 42}" y="${AY + 5}" fill="#f3f1ea" font-size="17" letter-spacing="1">${L ? L.probe_actual_mw[0].toFixed(0) + ' MW' : ''}</text>
      <line id="l-err" x1="${PX}" x2="${PX}" y1="${PY + 26}" y2="${AY - 18}" stroke="#ffb15c" stroke-width="3" opacity="0" filter="url(#l-glow)"/>
      <text id="l-errt" x="${PX - 34}" y="${(PY + AY) / 2 + 5}" text-anchor="end" fill="#ffb15c" font-size="14" letter-spacing="1" opacity="0"></text>
      <text id="l-gradt" x="${X0 - 70}" y="${CY - 150}" fill="#ff8a3d" font-size="11" letter-spacing="4" opacity="0"></text>`;
    $('#l-chain').innerHTML = s;
    S.cubes = [...S.el.querySelectorAll('.cube')]; S.cores = [...S.el.querySelectorAll('.core')];
    S.ins = [...S.el.querySelectorAll('.in')]; S.gcols = [...S.el.querySelectorAll('.gcol')];
  }

  function buildLattice() {
    const g = $('#l-lattice'); let s = '';
    S.lat = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 50; c++) {
      const spread = .72 + r * .035, x = 700 - 520 * spread + c * (1040 * spread / 49), y = 128 + r * 13;
      S.lat.push({ x, y, r, c }); s += `<circle cx="${x.toFixed(1)}" cy="${y}" r="${(1 + r * .12).toFixed(2)}" fill="#b49cff" opacity=".22"/>`;
    }
    s += `<text x="180" y="262" fill="rgba(180,156,255,.6)" font-size="11" letter-spacing="5">θ · ${S.L ? S.L.n_params.toLocaleString() : '—'} PARAMETERS (EACH POINT ≈ ${S.L ? Math.round(S.L.n_params / 450) : '—'})</text>`;
    g.innerHTML = s; S.latEls = [...g.querySelectorAll('circle')];
  }

  function buildLoss() {
    const H = S.L.history, E = H.length - 1;
    const all = H.flatMap(h => [h.train_loss, h.val_loss]).filter(v => v > 0);
    S.lmin = Math.log10(Math.min(...all)) - .08; S.lmax = Math.log10(Math.max(...all)) + .08;
    S.LX = e => 150 + 1300 * e / Math.max(1, E); S.LY = v => 828 - 60 * (Math.log10(Math.max(v, 1e-8)) - S.lmin) / (S.lmax - S.lmin);
    let s = `<line x1="150" x2="1450" y1="832" y2="832" stroke="rgba(255,255,255,.12)"/>
      <text x="150" y="758" fill="rgba(243,241,234,.45)" font-size="10.5" letter-spacing="5">LOSS · MSE · LOG SCALE · <tspan fill="#7fd8f0">TRAIN</tspan> · <tspan fill="#ffb15c">VALIDATION</tspan> · click to jump to an epoch</text>`;
    for (let e = 0; e <= E; e++) s += `<line x1="${S.LX(e)}" x2="${S.LX(e)}" y1="828" y2="834" stroke="rgba(255,255,255,.25)"/>${e % 5 === 0 ? `<text x="${S.LX(e)}" y="850" text-anchor="middle" fill="rgba(243,241,234,.4)" font-size="10">${e}</text>` : ''}`;
    s += `<polyline id="l-tr" fill="none" stroke="#7fd8f0" stroke-width="2"/><polyline id="l-va" fill="none" stroke="#ffb15c" stroke-width="2"/>
      <line id="l-cur" y1="764" y2="834" stroke="rgba(255,255,255,.55)" stroke-dasharray="2 3"/>
      <circle id="l-trd" r="4" fill="#7fd8f0" filter="url(#l-glow)"/><circle id="l-vad" r="4" fill="#ffb15c" filter="url(#l-glow)"/>
      <rect id="l-hit" x="140" y="748" width="1320" height="110" fill="transparent" style="cursor:pointer"/>`;
    $('#l-loss').innerHTML = s;
    $('#l-hit').onclick = ev => {
      const r = S.svg.getBoundingClientRect(), vx = (ev.clientX - r.left) / r.width * 1600;
      const e = Math.round((vx - 150) / 1300 * E); S.jump(C.clamp(e, 1, E));
    };
  }

  function buildProbe() {
    const L = S.L, all = L.probe_actual_mw.concat(...L.history.map(h => h.probe_pred_mw));
    S.plo = Math.min(...all); S.phi = Math.max(...all);
    S.PXf = k => 1240 + 300 * k / 71; S.PYf = v => 250 - 120 * (v - S.plo) / (S.phi - S.plo);
    const line = arr => arr.map((v, k) => `${S.PXf(k).toFixed(1)},${S.PYf(v).toFixed(1)}`).join(' ');
    $('#l-probe').innerHTML = `
      <text x="1240" y="112" fill="rgba(243,241,234,.45)" font-size="10.5" letter-spacing="4">VALIDATION FORECAST</text>
      <text id="l-pmae" x="1540" y="112" text-anchor="end" fill="#ffb15c" font-size="11" letter-spacing="2"></text>
      <polyline points="${line(L.history[0].probe_pred_mw)}" fill="none" stroke="rgba(200,205,220,.35)" stroke-width="1.2" stroke-dasharray="2 3"/>
      <polyline points="${line(L.probe_actual_mw)}" fill="none" stroke="rgba(243,241,234,.7)" stroke-width="1.3" stroke-dasharray="5 3"/>
      <polyline id="l-pp" fill="none" stroke="#ffb15c" stroke-width="2" filter="url(#l-glow)"/>
      <text x="1240" y="272" fill="rgba(243,241,234,.4)" font-size="9.5" letter-spacing="2">- - actual   — model at this epoch   · · untrained</text>`;
  }

  function showEpoch(e, morph = 1) {
    const H = S.L.history, a = H[Math.max(0, e - 1)].probe_pred_mw, b = H[e].probe_pred_mw;
    const pp = b.map((v, k) => C.lerp(a[k], v, morph));
    $('#l-pp').setAttribute('points', pp.map((v, k) => `${S.PXf(k).toFixed(1)},${S.PYf(v).toFixed(1)}`).join(' '));
    const mae = pp.reduce((s, v, k) => s + Math.abs(v - S.L.probe_actual_mw[k]), 0) / pp.length;
    $('#l-pmae').textContent = `MAE ${mae.toFixed(1)} MW`;
    const pts = key => H.slice(0, e + 1).map(h => `${S.LX(h.epoch)},${S.LY(h[key])}`).join(' ');
    $('#l-tr').setAttribute('points', pts('train_loss')); $('#l-va').setAttribute('points', pts('val_loss'));
    $('#l-cur').setAttribute('x1', S.LX(e)); $('#l-cur').setAttribute('x2', S.LX(e));
    for (const [id, key] of [['#l-trd', 'train_loss'], ['#l-vad', 'val_loss']]) { $(id).setAttribute('cx', S.LX(e)); $(id).setAttribute('cy', S.LY(H[e][key])); }
    if (morph >= 1) S.shown = e;
  }

  // ---------- rendering of one phase at progress u ----------
  function render(key, u) {
    const L = S.L, g = S.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.cv.width, S.cv.height); g.setTransform(S.sc, 0, 0, S.sc, 0, 0);
    g.globalCompositeOperation = 'lighter';
    const prev = L ? L.history[Math.max(0, S.epoch - 1)] : null, grad = prev ? prev.input_grad : null, gmax = grad ? Math.max(...grad) || 1 : 1;
    const glow = (x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.25, `rgba(${rgb},${a * .7})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
    const trail = (xa, xb, rgb, a, y) => { const gr = g.createLinearGradient(xa, 0, xb, 0); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${a})`); g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke(); };
    for (let k = 0; k < N; k++) {
      const x = cx(k); let core = 0, col = '#7fd8f0', stroke = 'rgba(160,190,230,.45)', inY = S.inY[k], gh = 0;
      if (key === 'forward') {
        const hx = X0 - 60 + u * (PX - X0 + 60);
        if (x < hx) { core = .2 + .7 * Math.exp(-Math.pow((hx - x) / 60, 2)); stroke = 'rgba(127,216,240,.8)'; }
        const rise = C.clamp((hx - x + 60) / 80); inY = C.lerp(S.inY[k], CY + 15, C.ease.inOut(rise));
      } else if (key === 'predict' || key === 'error') { core = .18; stroke = 'rgba(127,216,240,.6)'; inY = CY + 15; }
      else if (key === 'bptt') {
        const hx = PX - u * (PX - X0 + 60), gi = grad ? grad[k] / gmax : 0;
        if (x > hx) { core = .15 + .8 * gi; col = '#ff8a3d'; stroke = `rgba(255,138,61,${.3 + .6 * gi})`; }
        inY = CY + 15;
      } else if (key === 'grad') { const gi = grad ? grad[k] / gmax : 0; core = .15 + .7 * gi; col = '#ff8a3d'; gh = C.ease.out(u) * 140 * gi; stroke = `rgba(255,138,61,${.3 + .6 * gi})`; inY = CY + 15; }
      else if (key === 'adam') { const gi = grad ? grad[k] / gmax : 0; gh = (1 - u) * 140 * gi; core = .5 * Math.exp(-Math.pow((u * 1.4 - k / N) * 6, 2)); col = '#d8ccff'; inY = C.lerp(CY + 15, S.inY[k], u); }
      S.cores[k].setAttribute('opacity', core.toFixed(3)); S.cores[k].setAttribute('fill', col); S.cubes[k].setAttribute('stroke', stroke);
      S.ins[k].setAttribute('cy', inY.toFixed(1)); S.ins[k].setAttribute('opacity', key === 'forward' || key === 'adam' || key === 'next' ? 1 : .35);
      S.gcols[k].setAttribute('y', (CY - 20 - gh).toFixed(1)); S.gcols[k].setAttribute('height', gh.toFixed(1));
    }
    if (key === 'forward') { const hx = X0 - 60 + u * (PX - X0 + 60); trail(X0 - 60, hx, '127,216,240', .8, CY - 26); trail(X0 - 60, hx, '217,238,255', .5, CY + 26); glow(hx, CY, 46, '127,216,240', .9); }
    if (key === 'bptt') { const hx = PX - u * (PX - X0 + 60); trail(PX, hx, '255,138,61', .0, CY); g.strokeStyle = 'rgba(255,138,61,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(hx, CY - 26); g.lineTo(PX - 30, CY - 26); g.stroke(); glow(hx, CY, 50, '255,138,61', .95); }
    if (key === 'adam') {
      const amp = S.L ? 10 * (S.L.history[S.epoch].grad_norm / S.gnMax) : 6;
      S.lat.forEach((p, j) => { const ph = u * 1.5 - p.c / 50, env = Math.exp(-Math.pow(ph * 5, 2)); S.latEls[j].setAttribute('cy', (p.y + Math.sin(p.c * .5 + u * 10) * amp * env).toFixed(1)); S.latEls[j].setAttribute('opacity', (.22 + .7 * env).toFixed(2)); });
      glow(700, 190, 300 * (.4 + .6 * Math.sin(Math.PI * u)), '180,156,255', .18);
    } else if (S.latDirty !== key) { S.latEls.forEach((e, j) => { e.setAttribute('cy', S.lat[j].y); e.setAttribute('opacity', .22); }); }
    S.latDirty = key;
    // prediction / error nodes
    const yhat = prev ? prev.probe_pred_mw[0] : null, y = L ? L.probe_actual_mw[0] : null;
    const pOn = key !== 'forward' || u > .92;
    $('#l-predc').setAttribute('opacity', pOn && key !== 'next' ? (key === 'predict' ? u : 1) * .75 : 0);
    $('#l-predt').textContent = pOn && yhat != null ? `${yhat.toFixed(0)} MW` : '';
    const eOn = key === 'error' || (key === 'bptt' && u < .25);
    $('#l-err').setAttribute('opacity', eOn ? .5 + .5 * Math.abs(Math.sin(u * 12)) : 0);
    $('#l-errt').setAttribute('opacity', eOn ? 1 : 0);
    if (yhat != null) $('#l-errt').textContent = `|ŷ − y| = ${Math.abs(yhat - y).toFixed(0)} MW`;
    $('#l-gradt').setAttribute('opacity', key === 'grad' || key === 'adam' ? 1 : 0);
    $('#l-gradt').textContent = `MEASURED |∂L/∂xₜ| FOR THIS WINDOW · MAX ${gmax.toExponential(2)}`;
    if (key === 'error') glow(PX, (PY + AY) / 2, 60, '255,177,92', .5 * Math.sin(Math.PI * u));
    if (key === 'beam') { const bx = PX + u * 400; trail(PX, bx, '255,177,92', .9, PY); glow(bx, PY, 40, '255,177,92', .9); }
    g.globalCompositeOperation = 'source-over';
  }

  // ---------- narration ----------
  function narrate() {
    const L = S.L, h = L.history[S.epoch], prev = L.history[S.epoch - 1], key = PH[S.ph].key;
    const t = {
      forward: `<b>Forward propagation.</b> 24 hours of history enter the unrolled network, one hour per cell, all sharing the same weights.`,
      predict: `After hour 24 the hidden state becomes a forecast: <b>${prev.probe_pred_mw[0].toFixed(0)} MW</b>.`,
      error: `The actual value was <b>${L.probe_actual_mw[0].toFixed(0)} MW</b>. The squared error is the loss. This epoch's average training loss: <span class="m">${h.train_loss.toFixed(4)}</span>.`,
      bptt: `<b>Backpropagation through time.</b> The error travels backwards through all 24 hours, along the memory pathway.`,
      grad: `The amber columns are the <span class="m">measured</span> gradients |∂L/∂x<sub>t</sub>|: how strongly each past hour influenced the error.`,
      adam: `<b>Adam</b> adjusts all ${L.n_params.toLocaleString()} parameters, ${L.n_batches} times per epoch. Mean gradient norm: <span class="m">${h.grad_norm.toFixed(3)}</span>.`,
      next: `Validation loss is now <span class="m">${h.val_loss.toFixed(4)}</span>. The forecast in the upper right moves closer to reality.`,
    }[key];
    C.say(t);
  }
  function ui() {
    const L = S.L;
    S.el.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === S.speed));
    $('#l-play').textContent = S.playing ? 'pause' : 'play'; $('#l-play').classList.toggle('on', S.playing);
    ['#l-play', '#l-step', '#l-restart'].forEach(id => $(id).disabled = !L || S.training);
    $('.live').classList.toggle('on', S.training);
    if (!L) {
      $('.read .ep').innerHTML = 'UNTRAINED'; $('.read .ls').innerHTML = 'random weights · no training run yet';
      $('.phase').textContent = ''; $('.pdots').innerHTML = ''; return;
    }
    const E = L.history.length - 1, h = L.history[S.shown];
    $('.read .ep').innerHTML = `EPOCH ${String(S.epoch).padStart(2, '0')} <small>/ ${E}</small>`;
    $('.read .ls').innerHTML = `train <b style="color:#7fd8f0">${h.train_loss.toFixed(4)}</b> · val <b style="color:#ffb15c">${h.val_loss.toFixed(4)}</b> · after epoch ${S.shown}`;
    $('.phase').textContent = S.training ? '' : PH[S.ph].label; $('.phase').style.color = PH[S.ph].col;
    $('.pdots').innerHTML = PH.map((p, k) => `<i style="background:${k <= S.ph ? p.col : ''}"></i>`).join('');
  }

  function nextPhase() {
    const E = S.L.history.length - 1;
    if (PH[S.ph].key === 'next') showEpoch(S.epoch, 1);
    S.ph++;
    if (S.ph >= PH.length) {
      if (S.epoch >= E) { S.ph = PH.length - 1; S.playing = false; S.done = true; ui(); C.say(`Training complete: ${E} epochs in <span class="m">${S.L.compute_seconds.toFixed(2)} s</span> of real CPU time. Loss fell from ${S.L.history[0].train_loss.toFixed(3)} to ${S.L.history[E].train_loss.toFixed(4)}.`); return; }
      S.ph = 0; S.epoch++; if (S.epoch > 1 && !S.stepping) S.narrate = false;
    }
    S.u = 0; ui();
    if (S.narrate) narrate(); else if (S.ph === 0) C.hush();
  }
  S.restart = (play = true) => {
    if (!S.L) return;
    S.gnMax = Math.max(...S.L.history.map(h => h.grad_norm)) || 1;
    S.epoch = 1; S.ph = 0; S.u = 0; S.done = false; S.narrate = true; showEpoch(0, 1); S.playing = play; ui(); render('forward', 0);
    if (play) narrate();
  };
  S.jump = e => { S.playing = false; S.epoch = e; S.ph = 0; S.u = 0; showEpoch(e - 1, 1); S.narrate = true; ui(); render('forward', 0); narrate(); };

  C.frame.push((now, dt) => {
    if (!S.el.classList.contains('live')) return;
    if (S.override) { render(S.override.key, S.override.u); return; }
    if (S.training) { const u = (now / 1000 * .7) % 2; render(u < 1 ? 'forward' : 'bptt', u % 1); return; }
    if (!S.L) { render('next', 0); return; }
    if (S.playing) {
      S.u += dt * 1000 * S.speed / PH[S.ph].ms;
      if (PH[S.ph].key === 'next') showEpoch(S.epoch, C.ease.inOut(C.clamp(S.u)));
      if (S.u >= 1) { S.u = 1; render(PH[S.ph].key, 1); nextPhase(); return; }
    }
    render(PH[S.ph].key, C.clamp(S.u));
  });

  S.enter = from => {
    size();
    if (S.training) { ui(); return; }
    if (!S.L) { C.say(S.meta && S.meta.trained === false ? 'This network has <b>random weights</b>. Choose <b>retrain live</b> to run real PyTorch training on this machine.' : ''); ui(); return; }
    if (from === 1 || S.done || S.epoch === 1) S.restart(true);
  };
  S.exit = () => { S.playing = false; S.override = null; C.hush(); ui(); };
  S.toggle = () => {
    if (!S.L || S.training) return;
    if (S.done) { S.restart(true); return; }
    S.playing = !S.playing; if (S.playing) S.narrate = S.narrate || S.epoch === 1; ui();
  };
  S.onKey = k => { if (k === 'ArrowDown') { S.playing = false; S.narrate = true; nextPhase(); } };
  S.setTraining = on => { S.training = on; S.playing = false; ui(); if (on) C.say('PyTorch is training the LSTM right now. When it finishes, the replay below will show <b>that</b> run.'); };

  // Transition 3, part A: last backward sweep, update, and the forecast leaves the present
  S.finale = async () => {
    S.playing = false; C.hush();
    const run = (key, ms) => C.tween(ms, e => { S.override = { key, u: e }; }, C.ease.inOut);
    if (S.L) { await run('bptt', 700); await run('adam', 600); }
    await run('forward', 700); await run('beam', 700);
    S.override = null;
  };
  S.update = d => {
    const wasTraining = S.training; S.training = false; S.load(d);
    if (wasTraining && d.event === 'train' && S.L) { C.toast('training finished · replaying the new run'); S.restart(true); }
  };
})();
