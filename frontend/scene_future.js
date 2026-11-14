/* CHRONOS 2.0 — Chapter 03 · ForecastHorizon
   History, forecasts, baselines and all metrics come from payload.future (real model outputs
   on held-out test data). Only the order of appearance is choreographed. */
(() => {
  const C = window.CHRONOS, K = C.cosmos;
  const NOWX = 800, STEP = 26, X = i => NOWX + (i - 23.5) * STEP;
  const st = document.createElement('style');
  st.textContent = `
  #s3 .end{position:absolute;left:0;right:0;bottom:2.6cqh;text-align:center;pointer-events:none}
  #s3 .end .big{font-size:1.8cqw;white-space:nowrap;font-weight:200;letter-spacing:.42em;margin-left:.42em;color:#fff;opacity:0;transition:opacity 2s, letter-spacing 3s}
  #s3 .end .big.in{opacity:1;letter-spacing:.5em}
  #s3 .end .con{font-size:.98cqw;color:var(--ink);margin:1.4cqh auto 0;max-width:44cqw;opacity:0;transition:opacity 1.6s;line-height:1.6}
  #s3 .end .qq{font-size:1cqw;font-style:italic;color:var(--dim);margin-top:.8cqh;opacity:0;transition:opacity 1.6s}
  #s3 .end .in{opacity:1}
  #s3 .ctrls{position:absolute;right:2.5cqw;top:7.6cqh;display:flex;gap:.1cqw;align-items:center;transition:opacity .8s}
  #s3 .ctrls .sep{width:1px;height:1.2cqw;background:rgba(255,255,255,.15);margin:0 .5cqw}
  #s3 .metrics{position:absolute;left:3cqw;bottom:3.4cqh;font-size:.85cqw;letter-spacing:.12em;color:var(--dim);line-height:1.9;opacity:0;transition:opacity 1.2s}
  #s3 .metrics.in{opacity:1}
  #s3 .metrics .h{font-size:.62cqw;letter-spacing:.4em;color:var(--faint)}
  #s3 .metrics b{font-weight:400}
  #s3 .msg{position:absolute;left:0;right:0;top:44cqh;text-align:center;font-size:1.2cqw;color:var(--dim)}
  body.pm #s3 .ctrls .dev{display:none}
  `;
  document.head.appendChild(st);

  const S = { el: document.getElementById('s3'), day: 0, mode: 'rec', show: { untrained: true, persistence: false }, k: 0, tok: 0, cam: { x: 800, y: 450, z: 1 } };
  C.scenes[3] = S;
  const $ = s => S.el.querySelector(s);

  S.build = d => {
    S.el.innerHTML = `
      <svg class="world" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
        <defs><filter id="f-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="f-col" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#ffe0bd" stop-opacity=".95"/></linearGradient>
          <linearGradient id="f-fut" x1="0" x2="1"><stop offset="0" stop-color="#ffb15c" stop-opacity=".07"/><stop offset="1" stop-color="#ffb15c" stop-opacity="0"/></linearGradient></defs>
        <g id="f-cam">
          <rect x="${NOWX}" y="150" width="660" height="560" fill="url(#f-fut)"/>
          <line x1="${NOWX}" x2="${NOWX}" y1="140" y2="708" stroke="url(#f-col)" stroke-width="2.2" filter="url(#f-glow)"/>
          <text x="${NOWX}" y="128" text-anchor="middle" fill="#fff" font-size="13" letter-spacing="10">PRESENT</text>
          <text x="${X(0)}" y="128" fill="#7fd8f0" font-size="11" letter-spacing="6" opacity=".8">PAST 24 h · INPUT</text>
          <text x="${X(47)}" y="128" text-anchor="end" fill="#ffb15c" font-size="11" letter-spacing="6" opacity=".8">NEXT 24 h · NEVER SEEN</text>
          <g id="f-grid"></g>
          <polyline id="f-hist" fill="none" stroke="#7fd8f0" stroke-width="2.4" filter="url(#f-glow)"/>
          <g id="f-hdots"></g>
          <polyline id="f-pers" fill="none" stroke="#b49cff" stroke-width="1.4" stroke-dasharray="6 5" opacity="0"/>
          <polyline id="f-un" fill="none" stroke="rgba(190,195,210,.6)" stroke-width="1.6" stroke-dasharray="2 5" opacity="0"/>
          <g id="f-thr"></g>
          <polyline id="f-act" fill="none" stroke="#eef3ff" stroke-width="1.8" stroke-dasharray="7 5" opacity="0"/>
          <polyline id="f-tr" fill="none" stroke="#ffb15c" stroke-width="3.2" filter="url(#f-glow)"/>
          <circle id="f-head" r="7" fill="#ffd9a8" filter="url(#f-glow)" opacity="0"/>
          <g id="f-ann" opacity="0"></g>
        </g>
      </svg>
      <div class="end"><div class="big">THE PAST INFORMS THE FUTURE.</div><div class="con"></div>
        <div class="qq">“Can a machine use what it remembers to predict what happens next?”</div></div>
      <div class="ctrls">
        <button class="ctl" id="f-replay">replay</button><span class="sep"></span>
        <button class="ctl" id="f-rec">recursive 24 h</button><button class="ctl" id="f-one">one-step</button><span class="sep"></span>
        <button class="ctl" id="f-un-t">untrained</button><button class="ctl" id="f-pe-t">persistence</button><span class="sep"></span>
        <button class="ctl" id="f-dp">‹</button><span class="tagline" id="f-dl"></span><button class="ctl" id="f-dn">›</button>
      </div>
      <div class="metrics"></div><div class="msg"></div>`;
    $('#f-replay').onclick = () => S.play();
    $('#f-rec').onclick = () => { S.mode = 'rec'; S.play(true); };
    $('#f-one').onclick = () => { S.mode = 'one'; S.play(true); };
    $('#f-un-t').onclick = () => { S.show.untrained = !S.show.untrained; draw(); };
    $('#f-pe-t').onclick = () => { S.show.persistence = !S.show.persistence; draw(); };
    $('#f-dp').onclick = () => { S.day = (S.day - 1 + S.F.days.length) % S.F.days.length; S.play(true); };
    $('#f-dn').onclick = () => { S.day = (S.day + 1) % S.F.days.length; S.play(true); };
    S.load(d);
  };
  S.load = d => { S.F = d.future; S.meta = d.meta; if (S.F) S.day = Math.min(S.day, S.F.days.length - 1); S.k = 0; S.ready = false; draw(); };

  const pl = (arr, off) => arr.map((v, i) => `${X(i + off).toFixed(1)},${S.Y(v).toFixed(1)}`).join(' ');
  function series() {
    const D = S.F.days[S.day], m = S.mode;
    return { D, tr: m === 'rec' ? D.rec_trained : D.one_trained, un: m === 'rec' ? D.rec_untrained : D.one_untrained, pe: m === 'rec' ? D.rec_persistence : D.one_persistence };
  }
  function draw() {
    if (!S.F) { $('.msg').textContent = 'Train the network first (chapter 02 → retrain live), then return to the future.'; $('.ctrls').classList.add('hide'); return; }
    $('.msg').textContent = ''; $('.ctrls').classList.remove('hide');
    const { D, tr, un, pe } = series();
    const all = D.history_mw.concat(D.actual_mw, tr, S.show.untrained ? un : [], S.show.persistence ? pe : []);
    const lo = Math.min(...all), hi = Math.max(...all);
    S.Y = v => 640 - 400 * (v - lo) / (hi - lo + 1e-9);
    let g = '';
    for (let j = 0; j <= 4; j++) { const v = lo + (hi - lo) * j / 4, y = S.Y(v); g += `<line x1="${X(0) - 20}" x2="${X(47) + 20}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.045)"/><text x="${X(0) - 28}" y="${y + 4}" text-anchor="end" fill="rgba(243,241,234,.35)" font-size="11">${v.toFixed(0)}</text>`; }
    g += `<text x="${X(0) - 28}" y="${S.Y(hi) - 22}" text-anchor="end" fill="rgba(243,241,234,.35)" font-size="10" letter-spacing="3">MW · SIMULATED</text>`;
    $('#f-grid').innerHTML = g;
    const k = S.k, last = D.history_mw[23];
    $('#f-hist').setAttribute('points', S.histShown === false ? '' : pl(D.history_mw, 0));
    $('#f-tr').setAttribute('points', k ? `${X(23)},${S.Y(last)} ` + pl(tr.slice(0, k), 24) : '');
    $('#f-un').setAttribute('points', `${X(23)},${S.Y(last)} ` + pl(un.slice(0, Math.max(k, S.ready ? 24 : 0)), 24));
    $('#f-un').setAttribute('opacity', S.show.untrained && S.ready ? 1 : 0);
    $('#f-pers').setAttribute('points', `${X(23)},${S.Y(last)} ` + pl(pe, 24));
    $('#f-pers').setAttribute('opacity', S.show.persistence && S.ready ? .85 : 0);
    $('#f-act').setAttribute('points', `${X(23)},${S.Y(last)} ` + pl(D.actual_mw, 24));
    const head = $('#f-head');
    if (k > 0 && k <= 24 && !S.ready) { head.setAttribute('cx', X(23 + k)); head.setAttribute('cy', S.Y(tr[k - 1])); head.setAttribute('opacity', 1); } else head.setAttribute('opacity', 0);
    $('#f-thr').innerHTML = S.ready ? tr.map((v, i) => `<line x1="${X(24 + i)}" x2="${X(24 + i)}" y1="${S.Y(v)}" y2="${S.Y(D.actual_mw[i])}" stroke="rgba(255,177,92,.28)"/>`).join('') : '';
    // per-day annotation (computed from the real arrays)
    const err = arr => { const e = arr.map((v, i) => v - D.actual_mw[i]); return { mae: C.mean(e.map(Math.abs)), rmse: Math.sqrt(C.mean(e.map(v => v * v))) }; };
    const a = err(tr), b = err(un), p = err(pe), ax = X(47) + 16, ay = S.Y(tr[23]);
    $('#f-ann').innerHTML = `<text x="${ax}" y="${ay - 6}" fill="#ffb15c" font-size="13" letter-spacing="2">TRAINED · MAE ${a.mae.toFixed(1)}</text>
      <text x="${ax}" y="${ay + 12}" fill="rgba(255,177,92,.7)" font-size="11" letter-spacing="2">RMSE ${a.rmse.toFixed(1)} MW · this day</text>
      ${S.show.untrained ? `<text x="${ax}" y="${S.Y(un[23]) + 4}" fill="rgba(200,205,220,.75)" font-size="11" letter-spacing="2">UNTRAINED · MAE ${b.mae.toFixed(1)}</text>` : ''}
      ${S.show.persistence ? `<text x="${ax}" y="${S.Y(pe[23]) + 18}" fill="rgba(180,156,255,.85)" font-size="11" letter-spacing="2">PERSISTENCE · MAE ${p.mae.toFixed(1)}</text>` : ''}`;
    $('#f-ann').setAttribute('opacity', S.ready ? 1 : 0);
    $('#f-rec').classList.toggle('on', S.mode === 'rec'); $('#f-one').classList.toggle('on', S.mode === 'one');
    $('#f-un-t').classList.toggle('on', S.show.untrained); $('#f-pe-t').classList.toggle('on', S.show.persistence);
    $('#f-dl').textContent = `day ${S.day + 1}/${S.F.days.length}`;
    // overall held-out metrics (from Python)
    const O = S.F.overall;
    $('.metrics').innerHTML = `<div class="h">ALL ${O.n_test} HELD-OUT HOURS · ONE-STEP · MEASURED</div>
      <div><b style="color:#ffb15c">TRAINED LSTM</b> &nbsp; MAE ${O.trained.MAE.toFixed(1)} · RMSE ${O.trained.RMSE.toFixed(1)} MW</div>
      <div><b style="color:#b49cff">PERSISTENCE</b> &nbsp; MAE ${O.persistence.MAE.toFixed(1)} · RMSE ${O.persistence.RMSE.toFixed(1)} MW</div>
      <div><b style="color:rgba(200,205,220,.85)">UNTRAINED LSTM</b> &nbsp; MAE ${O.untrained.MAE.toFixed(1)} · RMSE ${O.untrained.RMSE.toFixed(1)} MW</div>`;
    const better = O.trained.MAE < O.persistence.MAE && O.trained.MAE < O.untrained.MAE;
    $('.end .con').innerHTML = better
      ? `Across ${O.n_test} unseen hours, the trained LSTM's error is <b>${Math.round(100 * (1 - O.trained.MAE / O.persistence.MAE))}%</b> lower than persistence and <b>${Math.round(100 * (1 - O.trained.MAE / O.untrained.MAE))}%</b> lower than its untrained self.<br>
         The remaining error sits near the injected noise (σ = ${S.meta.noise_std} MW).`
      : `On this run the trained LSTM did <b>not</b> beat every baseline (MAE ${O.trained.MAE.toFixed(1)} vs persistence ${O.persistence.MAE.toFixed(1)} MW). Possible causes: too few epochs, an unsuitable learning rate, or a model trained on a different dataset. This is the real outcome.`;
  }

  function applyCam() { const c = S.cam, w = 1600 / c.z, h = 900 / c.z; $('svg').setAttribute('viewBox', `${c.x - w / 2} ${c.y - h / 2} ${w} ${h}`); }
  let camId = 0;
  const camTo = (x, y, z, ms) => { const a = { ...S.cam }, id = ++camId; return C.tween(ms, e => { if (id !== camId) return; S.cam = { x: C.lerp(a.x, x, e), y: C.lerp(a.y, y, e), z: C.lerp(a.z, z, e) }; applyCam(); }); };
  function endHide() { $('.end .big').classList.remove('in'); $('.end .con').classList.remove('in'); $('.end .qq').classList.remove('in'); $('.metrics').classList.remove('in'); }

  S.play = async (quick = false) => {
    if (!S.F) { draw(); return; }
    const tok = ++S.tok, step = async ms => { await C.wait(ms); if (tok !== S.tok) throw 0; };
    S.ready = false; S.k = 0; S.paused = false; endHide();
    const act = $('#f-act'); act.style.transition = 'none'; act.setAttribute('opacity', 0);
    try {
      if (!quick) {
        S.histShown = false; draw();
        const D = S.F.days[S.day], hd = $('#f-hdots');
        hd.innerHTML = D.history_mw.map(() => `<circle r="3.2" fill="#bfefff" filter="url(#f-glow)"/>`).join('');
        const dots = [...hd.children];
        S.cam = { x: 760, y: 430, z: .94 }; applyCam();
        C.say('The last <b>24 hours</b>: the memory the model reads, travelling toward the present.', 4200);
        await C.tween(2200, e => dots.forEach((c, i) => {
          const u = C.ease.out(C.clamp(e * 1.8 - i / 24 * .8)); c.setAttribute('cx', C.lerp(-120, X(i), u)); c.setAttribute('cy', C.lerp(S.Y(D.history_mw[i]) - 40, S.Y(D.history_mw[i]), u)); c.setAttribute('opacity', u);
        }), C.ease.lin);
        if (tok !== S.tok) throw 0;
        S.histShown = true; draw();
        camTo(800, 420, 1.05, 2600); K.to({ dawn: 1 }, 1800);
        await step(1400);
        C.say('<b>The present.</b> Everything to the right has never been seen by the model.', 3600);
        await step(2200);
        C.say(S.mode === 'rec' ? 'The trained LSTM forecasts the next 24 hours, feeding each prediction back in as input.' : 'One-step mode: every hour the model sees the true past 24 hours.', 4000);
      } else { S.histShown = true; $('#f-hdots').innerHTML = ''; draw(); }
      for (let i = 1; i <= 24; i++) {
        while (S.paused) { await C.wait(120); if (tok !== S.tok) throw 0; }
        S.k = i; draw(); await step(quick ? 45 : 150);
      }
      await step(quick ? 150 : 700);
      if (!quick) C.say('Then reality arrives: the <b>held-out</b> actual demand.', 2400);
      act.style.transition = 'opacity 1.4s'; act.setAttribute('opacity', 1);
      S.ready = true; draw();
      await step(quick ? 300 : 2600);
      $('.metrics').classList.add('in');
      if (!quick) {
        camTo(800, 440, 1, 3000);
        await step(1500); C.hush();
        $('.end .big').classList.add('in'); await step(2000);
        $('.end .con').classList.add('in'); await step(1600); $('.end .qq').classList.add('in');
      } else { $('.end .big').classList.add('in'); $('.end .con').classList.add('in'); $('.end .qq').classList.add('in'); }
    } catch (e) { }
  };
  S.enter = () => { applyCam(); S.play(false); };
  S.exit = () => { S.tok++; C.hush(); };
  S.toggle = () => { if (S.ready) S.play(true); else S.paused = !S.paused; };
  S.update = d => { S.load(d); if (S.el.classList.contains('live')) S.play(true); };
})();
