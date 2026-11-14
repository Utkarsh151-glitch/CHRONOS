/* CHRONOS 2.0 — Chapter 01 · MemoryChamber / LSTMCellScene / GateMechanism
   Fill levels, light threads, survival probabilities and every number come from the
   trained model's measured activations (payload.chamber). Particle motion is conceptual. */
(() => {
  const C = window.CHRONOS, K = C.cosmos;
  const COL = { f: '#ffb15c', i: '#7fd8f0', g: '#b49cff', o: '#9fb8ff', c: '#ffcf8a', h: '#d9eeff', x: '#7fd8f0' };
  const RGB = { f: '255,177,92', i: '127,216,240', g: '180,156,255', o: '159,184,255', c: '255,207,138', h: '217,238,255', x: '127,216,240', d: '120,120,130' };
  const GX = { f: 520, i: 720, g: 920, o: 1120 }, TOP = 440, BOT = 640, HW = 52, IH = BOT - TOP - 8;
  const INFO = {
    f: { k: 'GATE 1 · FORGET', name: 'Forget gate', eq: 'f_t = σ( W_f · [h_{t−1}, x_t] + b_f )',
      desc: 'Decides how much of the old memory <b>survives</b>. 1 keeps everything, 0 erases it. At the × junction, forgotten particles fall away from the memory stream.' },
    i: { k: 'GATE 2 · INPUT', name: 'Input gate', eq: 'i_t = σ( W_i · [h_{t−1}, x_t] + b_i )',
      desc: 'Decides how much <b>new</b> information may enter the memory this hour. It opens the way for the candidate.' },
    g: { k: 'GATE 3 · CANDIDATE', name: 'Candidate state', eq: 'g_t = tanh( W_g · [h_{t−1}, x_t] + b_g )',
      desc: 'Proposes <b>what</b> to write, from −1 to +1. Threads above the midline push memory up, threads below push it down. The write is i<sub>t</sub> ⊙ g<sub>t</sub>.' },
    o: { k: 'GATE 4 · OUTPUT', name: 'Output gate', eq: 'o_t = σ( W_o · [h_{t−1}, x_t] + b_o )',
      desc: 'Decides how much of the squashed memory tanh(c<sub>t</sub>) is <b>revealed</b> as the hidden state.' },
    c: { k: 'LONG-TERM MEMORY', name: 'Cell state', eq: 'c_t = f_t ⊙ c_{t−1} + i_t ⊙ g_t',
      desc: 'A pathway that runs through every hour. It changes by gated <b>addition</b>, so information and gradients can travel far. This mitigates the vanishing-gradient problem; it does not remove it.' },
    h: { k: 'SHORT-TERM OUTPUT', name: 'Hidden state', eq: 'h_t = o_t ⊙ tanh( c_t )',
      desc: 'What the cell <b>says out loud</b>. It travels on to the next hour, and after hour 24 a linear layer turns it into the forecast.' },
  };
  const FOCUS = {
    f: { x: 520, y: 445, z: 1.48, show: ['gf', 'pf', 'jfx', 'mem', 'drop'], boost: ['mem0', 'mem1', 'fF', 'fUp'] },
    i: { x: 720, y: 445, z: 1.48, show: ['gi', 'pi', 'jix', 'jplus', 'mem'], boost: ['fI', 'iUp', 'igUp'] },
    g: { x: 920, y: 445, z: 1.48, show: ['gg', 'pg', 'jix', 'jplus', 'mem'], boost: ['fG', 'gUp', 'igUp'] },
    o: { x: 1120, y: 445, z: 1.48, show: ['go', 'po', 'jtanh', 'jox', 'mem', 'hid'], boost: ['fO', 'oUp', 'tapC', 'tanhD', 'hOut'] },
    c: { x: 660, y: 300, z: 1.45, show: ['mem', 'jfx', 'jplus', 'jix', 'drop'], boost: ['mem0', 'mem1', 'mem2', 'igUp'] },
    h: { x: 1310, y: 600, z: 1.6, show: ['hid', 'jox', 'jtanh', 'po', 'yhat'], boost: ['hOut', 'tanhD'] },
  };
  const PATHS = {
    mem0: 'M -60 225 L 506 225', mem1: 'M 534 225 L 806 225', mem2: 'M 834 225 L 1680 225',
    hprev: 'M -60 770 L 1140 770', xin: 'M 330 930 L 330 770',
    fF: 'M 520 770 L 520 654', fI: 'M 720 770 L 720 654', fG: 'M 920 770 L 920 654', fO: 'M 1120 770 L 1120 654',
    fUp: 'M 520 426 L 520 239', iUp: 'M 720 426 L 720 345 L 806 345', gUp: 'M 920 426 L 920 345 L 834 345',
    igUp: 'M 820 331 L 820 239', tapC: 'M 1310 239 L 1310 296', tanhD: 'M 1310 324 L 1310 386',
    oUp: 'M 1120 426 L 1120 400 L 1296 400', hOut: 'M 1310 414 L 1310 770 L 1680 770',
  };

  const st = document.createElement('style');
  st.textContent = `
  #s1 .grp{transition:opacity .7s ease}
  #s1 .grp.rv{opacity:0}
  #s1 .grp.dimmed{opacity:.13}
  #s1 .gate{cursor:pointer}
  #s1 .gate:hover .body{stroke:rgba(255,255,255,.55)}
  #s1 .hot{cursor:pointer}
  #s1 .ov.focus{left:57cqw;top:15cqh;width:36cqw;opacity:0;transition:opacity .6s ease .25s;pointer-events:none}
  #s1 .ov.focus.on{opacity:1;pointer-events:auto}
  #s1 .scrim{position:absolute;inset:0;background:linear-gradient(90deg,transparent 40%,rgba(0,0,0,.72) 62%,rgba(0,0,0,.8));opacity:0;transition:opacity .7s;pointer-events:none}
  #s1 .scrim.on{opacity:1}
  #s1 .units{display:block;width:26cqw;height:4.4cqw;margin-top:1.2cqw}
  #s1 .heat{display:flex;gap:1cqw;align-items:flex-end;margin-top:1.1cqw}
  #s1 .heat canvas{width:17cqw;height:6cqw;image-rendering:pixelated;opacity:.95}
  #s1 .heat .lab{font-size:.62cqw;letter-spacing:.25em;color:var(--faint);line-height:1.7;text-transform:uppercase}
  #s1 .interp{margin-top:1cqw;font-size:1cqw;color:var(--ink);line-height:1.6;max-width:32cqw}
  #s1 .back{margin-top:1.6cqw;margin-left:-.7cqw}
  #s1 .hud{position:absolute;left:3cqw;right:15cqw;bottom:2.4cqh;display:flex;align-items:flex-end;gap:2cqw;transition:opacity .6s}
  #s1 .hud .hour{font-size:.75cqw;letter-spacing:.4em;color:var(--dim);white-space:nowrap;min-width:16cqw}
  #s1 .hud .hour b{color:#fff;font-weight:400;font-size:1.25cqw;letter-spacing:.2em}
  #s1 .ticks{flex:1;display:flex;gap:.25cqw;align-items:flex-end;height:3.2cqh;cursor:pointer}
  #s1 .ticks i{flex:1;background:rgba(255,255,255,.18);border-radius:1px;transition:background .3s}
  #s1 .ticks i.past{background:rgba(127,216,240,.45)}
  #s1 .ticks i.on{background:var(--amber);box-shadow:0 0 10px var(--amber)}
  #s1 .seq{white-space:nowrap}
  #s1 .legend{position:absolute;right:3cqw;top:3.4cqh;text-align:right}
  #s1 .verify{position:absolute;right:3cqw;top:5.6cqh;text-align:right}
  #s1 .hint{position:absolute;left:0;right:0;top:9cqh;text-align:center;transition:opacity .6s}
  body.pm #s1 .legend,body.pm #s1 .verify{display:none}
  `;
  document.head.appendChild(st);

  const S = { el: document.getElementById('s1'), win: 0, t: 0, playing: false, focus: null, revealed: false,
    cam: { x: 800, y: 450, z: 1 }, disp: {}, rates: 1, ignite: null };
  C.scenes[1] = S;
  const $ = s => S.el.querySelector(s);

  // ---------- build ----------
  S.build = d => {
    S.d = d; S.W = d.chamber;
    S.el.innerHTML = `
      <svg class="world" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="c-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="c-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
          <linearGradient id="c-glass" x1="0" x2="1"><stop offset="0" stop-color="#cfe2ff" stop-opacity=".22"/><stop offset=".18" stop-color="#cfe2ff" stop-opacity=".05"/>
            <stop offset=".62" stop-color="#cfe2ff" stop-opacity=".02"/><stop offset=".86" stop-color="#cfe2ff" stop-opacity=".1"/><stop offset="1" stop-color="#cfe2ff" stop-opacity=".26"/></linearGradient>
          <linearGradient id="c-metal" x1="0" x2="1"><stop offset="0" stop-color="#1b2433"/><stop offset=".3" stop-color="#5a6b84"/><stop offset=".55" stop-color="#26324a"/><stop offset="1" stop-color="#0d121c"/></linearGradient>
          <radialGradient id="c-plat" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#2a3954" stop-opacity=".55"/><stop offset="1" stop-color="#05080f" stop-opacity="0"/></radialGradient>
          <linearGradient id="c-tube" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".0"/><stop offset=".5" stop-color="#ffcf8a" stop-opacity=".18"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></linearGradient>
        </defs>
        <g id="c-cam">
          <g class="grp rv" id="g-arch"></g>
          <g class="grp rv" id="g-mem"></g>
          <g class="grp rv" id="g-hid"></g>
          <g class="grp rv" id="g-xin"></g>
          <g id="g-pipes"></g>
          <g id="g-gates"></g>
          <g class="grp rv" id="g-junc"></g>
          <g class="grp" id="g-yhat" opacity="0"></g>
        </g>
      </svg>
      <canvas class="fx"></canvas>
      <div class="scrim"></div>
            <div class="ov focus"></div>
      <div class="hud grp rv" id="hud">
        <div class="hour"></div><div class="ticks"></div>
        <div class="seq dev"><button class="ctl" id="c-sp">‹</button><span class="tagline" id="c-sl"></span><button class="ctl" id="c-sn">›</button></div>
        <button class="ctl" id="c-play">play hours</button>
      </div>
      <div class="legend tagline"><span class="m">measured</span> fill levels, threads &amp; numbers · <span class="c">conceptual</span> particle flow</div>
      <div class="verify tagline mono"></div>`;
    S.svg = $('svg'); S.camG = $('#c-cam'); S.cv = $('canvas.fx'); S.cx = S.cv.getContext('2d');
    drawStatic(); buildGates(); samplePaths();
    $('#c-play').onclick = () => S.toggle();
    $('#c-sp').onclick = () => S.setWin(S.win - 1);
    $('#c-sn').onclick = () => S.setWin(S.win + 1);
    $('.ticks').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); S.setHour(Math.floor((e.clientX - r.left) / r.width * 24)); };
    S.svg.addEventListener('click', e => { if (e.target === S.svg && S.focus) S.unfocus(); });
    addEventListener('resize', sizeCanvas); sizeCanvas();
    S.setWin(0, true);
  };

  function sizeCanvas() {
    const r = S.el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    S.cv.width = Math.max(1, r.width * dpr); S.cv.height = Math.max(1, r.height * dpr); S.cvScale = S.cv.width / 1600;
  }

  function drawStatic() {
    // chamber architecture: vast arches receding into darkness
    let arch = `<ellipse cx="820" cy="700" rx="560" ry="70" fill="url(#c-plat)"/>`;
    for (let k = 0; k < 6; k++) {
      const rx = 980 - k * 95, ry = 720 - k * 70, a = .11 - k * .014;
      arch += `<path d="M ${820 - rx} 760 A ${rx} ${ry} 0 0 1 ${820 + rx} 760" fill="none" stroke="rgba(150,170,200,${a})" stroke-width="${3 - k * .35}"/>`;
      for (let j = 1; j < 10; j++) {
        const th = Math.PI * j / 10, px = 820 - Math.cos(th) * rx, py = 760 - Math.sin(th) * ry;
        arch += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${1.6 - k * .15}" fill="rgba(255,190,120,${.45 - k * .06})"/>`;
      }
    }
    arch += `<line x1="250" x2="1390" y1="704" y2="704" stroke="rgba(150,170,200,.18)"/>
      <text x="820" y="740" text-anchor="middle" fill="rgba(243,241,234,.45)" font-size="12" letter-spacing="9" id="c-celllab">LSTM CELL · HOUR 1</text>`;
    $('#g-arch').innerHTML = arch;
    $('#g-mem').innerHTML = `
      <rect x="-60" y="207" width="1740" height="36" fill="url(#c-tube)"/>
      <line x1="-60" x2="1680" y1="212" y2="212" stroke="rgba(255,207,138,.22)"/><line x1="-60" x2="1680" y1="238" y2="238" stroke="rgba(255,207,138,.22)"/>
      <line id="c-memline" x1="-60" x2="1680" y1="225" y2="225" stroke="#ffcf8a" stroke-opacity=".55" stroke-width="2" filter="url(#c-glow)"/>
      <text x="40" y="196" fill="#ffcf8a" font-size="13" letter-spacing="6" class="hot" id="c-memlab">c — CELL STATE · LONG-TERM MEMORY</text>
      <text x="1560" y="196" text-anchor="end" fill="rgba(255,207,138,.6)" font-size="12" letter-spacing="5">TO HOUR t+1 →</text>
      <text x="40" y="268" fill="rgba(255,207,138,.55)" font-size="12" letter-spacing="4">c<tspan font-size="9" dy="4">t−1</tspan></text>
      <text id="c-cval" x="1450" y="268" fill="rgba(255,207,138,.8)" font-size="13" letter-spacing="2"></text>`;
    $('#g-hid').innerHTML = `
      <line x1="-60" x2="1140" y1="770" y2="770" stroke="rgba(217,238,255,.32)" stroke-width="1.6"/>
      <line x1="1310" x2="1680" y1="770" y2="770" stroke="rgba(217,238,255,.32)" stroke-width="1.6"/>
      <text x="40" y="756" fill="rgba(217,238,255,.75)" font-size="13" letter-spacing="6">h<tspan font-size="9" dy="4">t−1</tspan><tspan dy="-4"> — HIDDEN STATE</tspan></text>
      <text x="1560" y="756" text-anchor="end" fill="rgba(217,238,255,.75)" font-size="13" letter-spacing="6" class="hot" id="c-hlab">h<tspan font-size="9" dy="4">t</tspan><tspan dy="-4"> →</tspan></text>
      <text id="c-hval" x="1440" y="756" text-anchor="end" fill="rgba(217,238,255,.55)" font-size="12" letter-spacing="2"></text>`;
    $('#g-xin').innerHTML = `
      <line x1="330" x2="330" y1="930" y2="770" stroke="rgba(127,216,240,.45)" stroke-width="1.6"/>
      <circle cx="330" cy="770" r="4" fill="#7fd8f0" filter="url(#c-glow)"/>
      <text x="345" y="806" fill="#7fd8f0" font-size="13" letter-spacing="6">x<tspan font-size="9" dy="4">t</tspan><tspan dy="-4"> — INPUT</tspan></text>
      <text id="c-xval" x="345" y="828" fill="rgba(127,216,240,.7)" font-size="12" letter-spacing="2"></text>`;
    const J = (id, x, y, sym, r = 14) => `<g id="${id}" class="grp"><circle cx="${x}" cy="${y}" r="${r}" fill="#05080f" stroke="rgba(235,240,250,.55)" stroke-width="1.5"/>
      <text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="${sym.length > 1 ? 10 : 17}">${sym}</text></g>`;
    $('#g-junc').innerHTML = J('jfx', 520, 225, '×') + J('jplus', 820, 225, '+') + J('jix', 820, 345, '×') + J('jtanh', 1310, 310, 'tanh', 15) + J('jox', 1310, 400, '×');
    $('#g-yhat').innerHTML = `<circle cx="1590" cy="770" r="16" fill="rgba(255,177,92,.12)" stroke="#ffb15c" stroke-width="1.5" filter="url(#c-glow)"/>
      <text x="1590" y="771" text-anchor="middle" dominant-baseline="central" fill="#ffb15c" font-size="15" font-style="italic" font-family="Cambria Math,serif">ŷ</text>
      <text id="c-yv" x="1590" y="738" text-anchor="middle" fill="#ffb15c" font-size="13" letter-spacing="2"></text>`;
    $('#c-memlab').onclick = () => S.select('c');
    $('#c-hlab').onclick = () => S.select('h');
  }

  function buildGates() {
    const gg = $('#g-gates'), pp = $('#g-pipes');
    const pipe = (d, id) => `<path d="${d}" fill="none" stroke="rgba(160,180,215,.28)" stroke-width="3"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`;
    const pipes = { f: ['fF', 'fUp'], i: ['fI', 'iUp', 'igUp'], g: ['fG', 'gUp'], o: ['fO', 'oUp', 'tapC', 'tanhD', 'hOut'] };
    S.gate = {};
    for (const k of ['f', 'i', 'g', 'o']) {
      const pg = C.svg('g', { class: 'grp rv', id: 'p' + k }, pp);
      pg.innerHTML = pipes[k].map(id => pipe(PATHS[id])).join('');
      const x = GX[k], g = C.svg('g', { class: 'grp rv gate', id: 'g' + k }, gg);
      const sym = { f: 'f', i: 'i', g: 'g', o: 'o' }[k];
      let threads = '';
      for (let u = 0; u < S.W[0].h[0].length; u++) threads += `<rect class="th" x="0" y="0" width="1.7" height="0" fill="${COL[k]}" opacity=".55"/>`;
      g.innerHTML = `
        <rect class="halo" x="${x - 70}" y="${TOP - 30}" width="140" height="${BOT - TOP + 60}" rx="40" fill="${COL[k]}" opacity="0" filter="url(#c-soft)"/>
        <ellipse cx="${x}" cy="${TOP}" rx="${HW}" ry="13" fill="rgba(10,14,24,.9)"/>
        <rect class="liquid" x="${x - HW + 3}" y="${BOT}" width="${2 * HW - 6}" height="0" fill="${COL[k]}" opacity=".1"/>
        <g class="threads">${threads}</g>
        <ellipse class="surf" cx="${x}" cy="${BOT}" rx="${HW - 5}" ry="9" fill="${COL[k]}" opacity=".42" filter="url(#c-glow)"/>
        ${k === 'g' ? `<line x1="${x - HW + 4}" x2="${x + HW - 4}" y1="${(TOP + BOT) / 2}" y2="${(TOP + BOT) / 2}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 4"/>` : ''}
        <rect class="body" x="${x - HW}" y="${TOP}" width="${2 * HW}" height="${BOT - TOP}" fill="url(#c-glass)" stroke="rgba(210,225,255,.28)" stroke-width="1.2"/>
        <text x="${x}" y="${TOP + 64}" text-anchor="middle" fill="#fff" fill-opacity=".9" font-size="40" font-style="italic" font-family="Cambria Math,Cambria,serif">${sym}<tspan font-size="20" dy="9">t</tspan></text>
        <ellipse cx="${x}" cy="${BOT}" rx="${HW + 7}" ry="16" fill="url(#c-metal)"/>
        <ellipse cx="${x}" cy="${TOP}" rx="${HW + 7}" ry="16" fill="none" stroke="url(#c-metal)" stroke-width="7"/>
        <rect x="${x - HW - 7}" y="${BOT}" width="${2 * HW + 14}" height="14" fill="url(#c-metal)"/>
        <ellipse cx="${x}" cy="${BOT + 14}" rx="${HW + 7}" ry="16" fill="#0b111c"/>
        <text x="${x}" y="${BOT + 58}" text-anchor="middle" fill="${COL[k]}" font-size="12.5" letter-spacing="7">${{ f: 'FORGET', i: 'INPUT', g: 'CANDIDATE', o: 'OUTPUT' }[k]}</text>
        <text class="val" x="${x}" y="${TOP - 26}" text-anchor="middle" fill="${COL[k]}" font-size="15" letter-spacing="2"></text>`;
      g.addEventListener('click', ev => { ev.stopPropagation(); S.select(k); });
      S.gate[k] = { g, th: [...g.querySelectorAll('.th')], liquid: g.querySelector('.liquid'), surf: g.querySelector('.surf'), halo: g.querySelector('.halo'), val: g.querySelector('.val') };
    }
  }

  function samplePaths() {
    S.P = {};
    const tmp = C.svg('path', {}, S.svg);
    for (const [id, d] of Object.entries(PATHS)) {
      tmp.setAttribute('d', d);
      const L = tmp.getTotalLength(), n = Math.max(2, Math.ceil(L / 6)), pts = [];
      for (let k = 0; k <= n; k++) { const p = tmp.getPointAtLength(L * k / n); pts.push([p.x, p.y]); }
      S.P[id] = { pts, L };
    }
    tmp.remove();
  }

  // ---------- data selection ----------
  S.setWin = (w, silent) => {
    S.win = (w + S.W.length) % S.W.length; const W = S.W[S.win];
    S.CMAX = Math.max(1e-6, ...W.c.flat().map(Math.abs)); S.HMAX = Math.max(1e-6, ...W.h.flat().map(Math.abs));
    $('#c-sl').textContent = `sequence ${S.win + 1}/${S.W.length}`;
    const chk = W.check;
    $('.verify').innerHTML = `${chk.passed ? '✓' : '✗'} gates rebuilt from PyTorch weights match nn.LSTM · max |Δh| ${chk.max_abs_err_h.toExponential(1)} · max |Δc| ${chk.max_abs_err_c.toExponential(1)}`;
    S.setHour(silent ? 0 : S.t);
  };
  S.setHour = t => {
    S.t = C.clamp(t, 0, 23); const W = S.W[S.win], tt = S.t;
    const xs = W.x_mw, lo = Math.min(...xs), hi = Math.max(...xs);
    $('.ticks').innerHTML = xs.map((v, k) => `<i class="${k === tt ? 'on' : k < tt ? 'past' : ''}" style="height:${25 + 75 * (v - lo) / (hi - lo + 1e-9)}%"></i>`).join('');
    $('.hud .hour').innerHTML = `HOUR <b>${String(tt + 1).padStart(2, '0')}</b> / 24 &nbsp; ${xs[tt].toFixed(0)} MW`;
    $('#c-celllab').textContent = `LSTM CELL · HOUR ${tt + 1}`;
    $('#c-xval').textContent = `${xs[tt].toFixed(0)} MW (simulated)`;
    $('#c-cval').textContent = `mean |c| ${C.absmean(W.c[tt]).toFixed(2)}`;
    $('#c-hval').textContent = `mean |h| ${C.absmean(W.h[tt]).toFixed(2)}`;
    $('#c-memline').setAttribute('stroke-opacity', .25 + .7 * C.absmean(W.c[tt]) / S.CMAX);
    for (const k of ['f', 'i', 'g', 'o']) {
      const m = k === 'g' ? C.mean(W[k][tt]) : C.mean(W[k][tt]);
      S.gate[k].val.textContent = k === 'g' ? `mean ${C.fmt(m, 2)}` : m.toFixed(2);
    }
    const last = tt === 23;
    $('#g-yhat').setAttribute('opacity', last ? 1 : 0);
    $('#c-yv').textContent = `${W.pred_mw.toFixed(0)} MW`;
    if (S.focus) renderFocus();
  };

  // ---------- per-frame: animate threads toward the measured targets + particles ----------
  const parts = [], drops = [];
  const sprites = {};
  function sprite(rgb) {
    if (sprites[rgb]) return sprites[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, `rgba(255,255,255,1)`); gr.addColorStop(.18, `rgba(${rgb},.95)`); gr.addColorStop(.5, `rgba(${rgb},.25)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (sprites[rgb] = c);
  }
  function spawn(path, rgb, speed, onEnd, size = 1) { parts.push({ p: S.P[path], id: path, u: 0, v: speed / S.P[path].L, rgb, onEnd, size }); }
  function at(P, u) { const n = P.pts.length - 1, f = u * n, k = Math.min(n - 1, Math.floor(f)), r = f - k; return [P.pts[k][0] + (P.pts[k + 1][0] - P.pts[k][0]) * r, P.pts[k][1] + (P.pts[k + 1][1] - P.pts[k][1]) * r]; }
  const acc = {};
  function emit(id, rate, dt, fn) { acc[id] = (acc[id] || 0) + rate * dt; while (acc[id] >= 1) { acc[id] -= 1; fn(); } }
  const shown = id => !S.el.querySelector('#' + id).classList.contains('rv');
  function boost(id) { if (!S.focus) return 1; return FOCUS[S.focus].boost.includes(id) ? 2.6 : .25; }

  function frame(now, dt) {
    if (!S.el.classList.contains('live') || !S.W) return;
    const W = S.W[S.win], t = S.t, prevC = t > 0 ? W.c[t - 1] : W.c[0].map(() => 0);
    const red = C.settings.reduced ? .5 : 1;
    // gates: threads ease toward the measured per-unit activations
    for (const k of ['f', 'i', 'g', 'o']) {
      const G = S.gate[k], vals = W[k][t], H = vals.length, w = (2 * HW - 10) / H;
      if (!S.disp[k]) S.disp[k] = vals.map(() => 0);
      const D = S.disp[k];
      for (let u = 0; u < H; u++) {
        D[u] += (vals[u] - D[u]) * Math.min(1, dt * 4);
        const r = G.th[u], xx = GX[k] - HW + 5 + u * w;
        r.setAttribute('x', xx.toFixed(1)); r.setAttribute('width', Math.max(1, w - .9).toFixed(1));
        if (k === 'g') { const mid = (TOP + BOT) / 2, hh = Math.abs(D[u]) * IH / 2; r.setAttribute('y', (D[u] >= 0 ? mid - hh : mid).toFixed(1)); r.setAttribute('height', hh.toFixed(1)); r.setAttribute('fill', D[u] >= 0 ? COL.g : COL.f); }
        else { const hh = D[u] * IH; r.setAttribute('y', (BOT - 4 - hh).toFixed(1)); r.setAttribute('height', hh.toFixed(1)); }
      }
      const m = C.mean(D);
      if (k === 'g') { const mid = (TOP + BOT) / 2, y = mid - m * IH / 2; G.surf.setAttribute('cy', y); G.liquid.setAttribute('y', Math.min(y, mid)); G.liquid.setAttribute('height', Math.abs(mid - y)); }
      else { const y = BOT - 4 - m * IH; G.surf.setAttribute('cy', y); G.liquid.setAttribute('y', y); G.liquid.setAttribute('height', BOT - 4 - y); }
      const ign = S.ignite && S.ignite[k] ? S.ignite[k] : 0;
      G.halo.setAttribute('opacity', Math.max(S.focus === k ? .22 : 0, ign * .5));
    }
    // emitters: rates follow measured values
    const fbar = C.mean(W.f[t]), ibar = C.mean(W.i[t]), obar = C.mean(W.o[t]), write = C.mean(W.i[t].map((v, u) => v * Math.abs(W.g[t][u])));
    const cin = C.absmean(prevC) / S.CMAX;
    if (shown('g-mem')) emit('mem0', (2.2 + 5 * cin) * boost('mem0') * red, dt, () => spawn('mem0', RGB.c, 150, p => {
      if (Math.random() < fbar) spawn('mem1', RGB.c, 150, () => spawn('mem2', RGB.c, 170));
      else drops.push({ x: 520, y: 225, vx: 30 + Math.random() * 40, vy: 25 + Math.random() * 50, a: 1, rgb: RGB.c });
    }));
    if (shown('g-hid')) emit('hprev', 2.4 * red * (S.focus ? .5 : 1), dt, () => spawn('hprev', RGB.h, 160));
    if (shown('g-xin')) emit('xin', 1.6 * red, dt, () => spawn('xin', RGB.x, 120));
    if (shown('gf')) { emit('fF', 1.2 * boost('fF') * red, dt, () => spawn('fF', RGB.h, 90)); emit('fUp', (.6 + 3 * fbar) * boost('fUp') * red, dt, () => spawn('fUp', RGB.f, 140)); }
    if (shown('gi')) { emit('fI', 1.2 * boost('fI') * red, dt, () => spawn('fI', RGB.h, 90)); emit('iUp', (.5 + 3 * ibar) * boost('iUp') * red, dt, () => spawn('iUp', RGB.i, 140)); }
    if (shown('gg')) { emit('fG', 1.2 * boost('fG') * red, dt, () => spawn('fG', RGB.h, 90)); emit('gUp', (.5 + 3 * C.absmean(W.g[t])) * boost('gUp') * red, dt, () => spawn('gUp', RGB.g, 140)); }
    if (shown('g-junc')) emit('igUp', (.4 + 9 * write) * boost('igUp') * red, dt, () => spawn('igUp', '235,225,255', 120, () => spawn('mem2', RGB.c, 170, null, 1.25)));
    if (shown('go')) {
      emit('fO', 1.2 * boost('fO') * red, dt, () => spawn('fO', RGB.h, 90));
      emit('oUp', (.5 + 3 * obar) * boost('oUp') * red, dt, () => spawn('oUp', RGB.o, 140));
      emit('tapC', (1 + 3 * C.absmean(W.c[t]) / S.CMAX) * boost('tapC') * red, dt, () => spawn('tapC', RGB.c, 110, () => spawn('tanhD', '255,236,205', 110, () => {
        if (Math.random() < obar) spawn('hOut', RGB.h, 170, null, 1.1);
        else drops.push({ x: 1310, y: 400, vx: 40, vy: 20 + Math.random() * 30, a: 1, rgb: '200,210,230' });
      })));
    }
    // render particles
    const g = S.cx, cam = S.cam, vw = 1600 / cam.z, vh = 900 / cam.z, sc = S.cvScale * cam.z;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.cv.width, S.cv.height);
    g.setTransform(sc, 0, 0, sc, -(cam.x - vw / 2) * sc, -(cam.y - vh / 2) * sc);
    g.globalCompositeOperation = 'lighter';
    const dim = id => S.focus && !FOCUS[S.focus].boost.includes(id) ? .2 : 1;
    for (let k = parts.length - 1; k >= 0; k--) {
      const q = parts[k]; q.u += q.v * dt;
      if (q.u >= 1) { parts.splice(k, 1); q.onEnd && q.onEnd(q); continue; }
      const [px, py] = at(q.p, q.u), r = 7 * q.size;
      g.globalAlpha = (.35 + .65 * Math.sin(Math.PI * Math.min(1, q.u * 1.2 + .1))) * dim(q.id);
      g.drawImage(sprite(q.rgb), px - r, py - r, 2 * r, 2 * r);
    }
    for (let k = drops.length - 1; k >= 0; k--) {
      const q = drops[k]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; q.a -= dt * .8;
      if (q.a <= 0) { drops.splice(k, 1); continue; }
      g.globalAlpha = q.a * .6 * (S.focus && !['f', 'c', 'o'].includes(S.focus) ? .2 : 1);
      g.drawImage(sprite('150,150,160'), q.x - 5, q.y - 5, 10, 10);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // hour playback
    if (S.playing && now - S.lastHour > 2600) { S.lastHour = now; S.setHour((S.t + 1) % 24); burst(); }
  }
  C.frame.push(frame);
  function burst() { for (let k = 0; k < 5; k++) setTimeout(() => spawn('xin', RGB.x, 220, null, 1.4), k * 60); }

  // ---------- camera ----------
  function applyCam() {
    const c = S.cam, w = 1600 / c.z, h = 900 / c.z;
    S.svg.setAttribute('viewBox', `${(c.x - w / 2).toFixed(2)} ${(c.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  }
  S.camId = 0;
  S.camTo = (x, y, z, ms = 1300) => { const a = { ...S.cam }, id = ++S.camId; return C.tween(ms, e => { if (id !== S.camId) return; S.cam = { x: C.lerp(a.x, x, e), y: C.lerp(a.y, y, e), z: C.lerp(a.z, z, e) }; applyCam(); }); };

  // ---------- focus (gate selection) ----------
  const GROUPS = ['g-arch', 'g-mem', 'g-hid', 'g-xin', 'gf', 'gi', 'gg', 'go', 'pf', 'pi', 'pg', 'po', 'jfx', 'jplus', 'jix', 'jtanh', 'jox', 'g-yhat'];
  S.select = k => {
    if (!S.revealed) return;
    S.focus = k; S.playing = false; updatePlay();
    const F = FOCUS[k];
    const show = new Set(F.show.map(s => s === 'mem' ? 'g-mem' : s === 'hid' ? 'g-hid' : s === 'yhat' ? 'g-yhat' : s));
    GROUPS.forEach(id => { const e = S.el.querySelector('#' + id); if (e) e.classList.toggle('dimmed', !show.has(id)); });
    $('#g-junc').classList.remove('dimmed');
    S.camTo(F.x + .2 * 1600 / F.z, F.y, F.z, 1200);
    $('.scrim').classList.add('on'); $('.hud').style.opacity = .35;
    renderFocus(); $('.ov.focus').classList.add('on');
    C.hush();
  };
  S.unfocus = () => {
    S.focus = null;
    GROUPS.forEach(id => { const e = S.el.querySelector('#' + id); if (e) e.classList.remove('dimmed'); });
    S.camTo(800, 450, 1, 1100);
    $('.scrim').classList.remove('on'); $('.ov.focus').classList.remove('on'); $('.hud').style.opacity = 1;
  };
  S.onEscape = () => { if (S.focus) { S.unfocus(); return true; } return false; };

  function heatColor(k, v, sc) {
    if (k === 'f' || k === 'i' || k === 'o') {
      const [r, g, b] = RGB[k].split(',').map(Number), u = C.clamp(v);
      return [8 + (r - 8) * u, 10 + (g - 10) * u, 20 + (b - 20) * u];
    }
    const u = C.clamp(v / sc, -1, 1);
    return u >= 0 ? [8 + 119 * u, 10 + 206 * u, 20 + 220 * u] : [8 + 247 * -u, 10 + 167 * -u, 20 + 72 * -u];
  }
  function renderFocus() {
    const k = S.focus, W = S.W[S.win], t = S.t, I = INFO[k], H = W.h[0].length;
    const key = k, vals = W[key][t];
    const sc = key === 'c' ? S.CMAX : key === 'h' ? S.HMAX : 1;
    const m = (key === 'f' || key === 'i' || key === 'o') ? C.mean(vals) : C.absmean(vals);
    let interp = '';
    if (k === 'f') { const keep = vals.filter(v => v > .9).length, er = vals.filter(v => v < .1).length; interp = `About <b>${Math.round(m * 100)}%</b> of the previous memory is kept at hour ${t + 1}. ${keep} of ${H} units hold more than 90%, ${er} erase almost everything.`; }
    if (k === 'i') interp = `New information is written at about <b>${Math.round(m * 100)}%</b> strength this hour. The most open unit admits ${Math.max(...vals).toFixed(2)}.`;
    if (k === 'g') { const pos = vals.filter(v => v > 0).length; interp = `${pos} units propose raising their memory, ${H - pos} propose lowering it. Mean |g| = <b>${m.toFixed(2)}</b>.`; }
    if (k === 'o') interp = `About <b>${Math.round(m * 100)}%</b> of the squashed memory is exposed as h<sub>t</sub>.`;
    if (k === 'c') { const prev = t > 0 ? C.absmean(W.c[t - 1]) : 0; interp = `Mean |c| moves from <b>${prev.toFixed(2)}</b> to <b>${m.toFixed(2)}</b> at hour ${t + 1}. The memory is carried, not rebuilt, from hour to hour.`; }
    if (k === 'h') interp = t === 23 ? `Hour 24: h<sub>24</sub> → linear layer → forecast <b>${W.pred_mw.toFixed(1)} MW</b>. Actual next hour: <b>${W.actual_mw.toFixed(1)} MW</b> (error ${C.fmt(W.pred_mw - W.actual_mw, 1)} MW).`
      : `This vector becomes h<sub>t−1</sub> for hour ${t + 2}. Step to hour 24 to see it become the forecast.`;
    let extra = '';
    if (k === 'c') {
      // direct-path factor along the memory highway: product of measured forget gates (vs illustrative RNN decay)
      const T = 24, f = W.f, ret = [];
      for (let s = 0; s < T; s++) { let p = 0; for (let u = 0; u < H; u++) { let q = 1; for (let r = s + 1; r < T; r++) q *= f[r][u]; p += q; } ret.push(p / H); }
      const X = s => 10 + s * 290 / 23, Y = v => 64 - 54 * (Math.log10(Math.max(v, 1e-6)) + 6) / 6;
      extra = `<svg viewBox="0 0 310 80" style="width:24cqw;height:6.2cqw;margin-top:1.2cqw">
        <polyline points="${ret.map((v, s) => `${X(s)},${Y(v)}`).join(' ')}" fill="none" stroke="#ffcf8a" stroke-width="2"/>
        <polyline points="${ret.map((_, s) => `${X(s)},${Y(Math.pow(.6, 23 - s))}`).join(' ')}" fill="none" stroke="rgba(200,205,220,.5)" stroke-width="1.4" stroke-dasharray="4 3"/>
        <text x="10" y="78" fill="rgba(243,241,234,.4)" font-size="8.5" letter-spacing="1.5">HOUR 1</text><text x="300" y="78" text-anchor="end" fill="rgba(243,241,234,.4)" font-size="8.5" letter-spacing="1.5">HOUR 24</text></svg>
        <div class="tagline"><span class="m">— measured</span> Π forget gates: memory surviving to hour 24 &nbsp; <span style="color:rgba(200,205,220,.7)">- - plain RNN 0.6ⁿ (illustrative)</span></div>`;
    }
    const bars = vals.map((v, u) => {
      const x = u * (300 / H), w = 300 / H - 1.4;
      if (key === 'f' || key === 'i' || key === 'o') return `<rect x="${x}" y="${50 - v * 48}" width="${w}" height="${v * 48}" fill="${COL[k]}" opacity=".85"/>`;
      const hh = Math.abs(v) / sc * 24; return `<rect x="${x}" y="${v >= 0 ? 26 - hh : 26}" width="${w}" height="${hh}" fill="${v >= 0 ? COL[k === 'g' ? 'g' : 'i'] : COL.f}" opacity=".85"/>`;
    }).join('');
    const ov = $('.ov.focus');
    ov.innerHTML = `<div class="k">${I.k}</div><div class="t">${I.name}</div>
      <div class="eq">${C.sub(I.eq)}</div><p>${I.desc}</p>
      <div class="meas"><div class="big">${(key === 'f' || key === 'i' || key === 'o') ? m.toFixed(2) : m.toFixed(2)}</div>
        <div class="sm">${(key === 'f' || key === 'i' || key === 'o') ? 'mean activation' : 'mean |value|'} · hour ${t + 1} · measured</div></div>
      <svg class="units" viewBox="0 0 300 52" preserveAspectRatio="none">${bars}</svg>
      <div class="tagline">each bar = one of ${H} memory units</div>
      <div class="interp">${interp}</div>
      ${extra || `<div class="heat"><canvas width="24" height="${H}"></canvas><div class="lab">${H} units ↕<br>24 hours →<br><span style="color:var(--amber)">▮ hour ${t + 1}</span></div></div>`}
      <button class="ctl back" id="c-back">← whole chamber · esc</button>`;
    ov.querySelector('#c-back').onclick = () => S.unfocus();
    const cvh = ov.querySelector('.heat canvas');
    if (cvh) {
      const g = cvh.getContext('2d'), img = g.createImageData(24, H), all = W[key];
      for (let s = 0; s < 24; s++) for (let u = 0; u < H; u++) {
        const [r, gg, b] = heatColor(key, all[s][u], sc), o = (u * 24 + s) * 4, hl = s === t ? 1.0 : .78;
        img.data[o] = r * hl + (s === t ? 40 : 0); img.data[o + 1] = gg * hl + (s === t ? 30 : 0); img.data[o + 2] = b * hl; img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
  }

  // ---------- reveal sequence (first arrival) ----------
  const rv = id => S.el.querySelector('#' + id).classList.remove('rv');
  S.reveal = async () => {
    const tok = S.tok = (S.tok || 0) + 1;
    const step = async ms => { await C.wait(ms); if (tok !== S.tok) throw 0; };
    S.cam = { x: 800, y: 470, z: .8 }; applyCam();
    try {
      S.camTo(800, 450, 1, 9000);
      rv('g-arch'); C.say('The memory chamber. One LSTM cell, processing <b>one hour</b> at a time.', 3000);
      await step(2200); rv('g-xin'); C.say('<b>x<sub>t</sub></b>: the demand at this hour enters from below.', 2600);
      await step(2300); rv('g-hid'); C.say('<b>h<sub>t−1</sub></b>: the hidden state, what the cell concluded one hour ago.', 2600);
      await step(2300); rv('g-mem'); C.say('<b>c<sub>t−1</sub></b>: the cell state, a long-term memory that runs through time.', 3000);
      await step(2400);
      C.say('Four gates read <b>[h<sub>t−1</sub>, x<sub>t</sub>]</b>. Their light is the <span class="m">measured</span> activation of our trained network.', 4200);
      for (const k of ['f', 'i', 'g', 'o']) { rv('g' + k); rv('p' + k); await step(650); }
      rv('g-junc'); await step(700); rv('hud');
      S.revealed = true; C.say('Select a gate to look inside it. <b>Space</b> plays the hours.', 4000);
    } catch (e) { }
  };
  function revealAll() { S.tok = (S.tok || 0) + 1; S.camId++; S.el.querySelectorAll('.rv').forEach(e => e.classList.remove('rv')); S.revealed = true; S.cam = { x: 800, y: 450, z: 1 }; applyCam(); }

  S.enter = async from => {
    document.body.classList.add('cap-top'); sizeCanvas(); S.lastHour = performance.now();
    if (!S.revealed && from === 0) await S.reveal();
    else { revealAll(); C.say('Select a gate to look inside it. <b>Space</b> plays the hours.', 3500); }
  };
  S.exit = () => { document.body.classList.remove('cap-top'); S.playing = false; updatePlay(); if (S.focus) S.unfocus(); C.hush(); };
  function updatePlay() { const b = $('#c-play'); if (b) { b.textContent = S.playing ? 'pause hours' : 'play hours'; b.classList.toggle('on', S.playing); } }
  S.toggle = () => {
    if (!S.revealed) { revealAll(); return; }
    S.playing = !S.playing; S.lastHour = performance.now() - 2000; updatePlay();
  };
  S.onKey = k => {
    if (!S.revealed) return;
    const map = { '1': 'f', '2': 'i', '3': 'g', '4': 'o', '5': 'c', '6': 'h' };
    if (map[k]) S.select(map[k]);
    if (k === '.' || k === 'ArrowDown') S.setHour(S.t + 1);
    if (k === ',' || k === 'ArrowUp') S.setHour(S.t - 1);
  };
  // Transition 2, part A: the gates fire in sequence and the signal leaves the cell
  S.ignite = null;
  S.igniteSeq = async () => {
    if (S.focus) { S.unfocus(); await C.wait(500); }
    revealAll(); S.playing = false; updatePlay();
    S.ignite = {};
    for (const k of ['f', 'i', 'g', 'o']) {
      C.tween(700, e => { S.ignite[k] = Math.sin(Math.PI * e); }, C.ease.lin);
      for (let j = 0; j < 4; j++) spawn({ f: 'fUp', i: 'iUp', g: 'gUp', o: 'oUp' }[k], RGB[k], 260, null, 1.3);
      await C.wait(260);
    }
    for (let j = 0; j < 14; j++) setTimeout(() => spawn('hOut', RGB.h, 520, null, 1.6), j * 35);
    await C.wait(900);
  };
  S.update = d => { S.d = d; S.W = d.chamber; S.disp = {}; S.setWin(Math.min(S.win, S.W.length - 1)); };
})();
