/* CHRONOS 2.0 — core: utilities, Streamlit bridge, captions, settings, navigation UI */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const C = window.CHRONOS = {
    NS, data: null, chapter: 0, busy: false, scenes: [], version: -1,
    settings: { pm: false, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches },
    CH: [
      { n: '00', t: 'THE ARRIVAL OF TIME', d: 'A timeline of simulated demand. Past, present, future.' },
      { n: '01', t: 'THE MEMORY CHAMBER', d: 'Inside one LSTM cell: four gates, two states, real activations.' },
      { n: '02', t: 'THE LEARNING SEQUENCE', d: 'Replay of the real training run: forward, error, backward, update.' },
      { n: '03', t: 'THE FUTURE', d: 'Held-out hours. Memory turns into prediction.' },
    ],
  };
  try { Object.assign(C.settings, JSON.parse(localStorage.getItem('chronos.settings') || '{}')); } catch (e) {}

  // ---------- helpers ----------
  C.$ = (s, r = document) => r.querySelector(s);
  C.svg = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  C.div = (cls, parent, html = '') => { const e = document.createElement('div'); if (cls) e.className = cls; e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  C.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  C.lerp = (a, b, u) => a + (b - a) * u;
  C.mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  C.absmean = a => a.reduce((s, v) => s + Math.abs(v), 0) / a.length;
  C.ease = {
    inOut: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
    out: u => 1 - Math.pow(1 - u, 3), in: u => u * u * u, lin: u => u,
    expoIn: u => u === 0 ? 0 : Math.pow(2, 10 * u - 10),
  };
  C.tween = (ms, fn, ease = C.ease.inOut) => new Promise(res => {
    if (C.settings.reduced) ms = Math.min(ms, 350);
    const t0 = performance.now();
    const f = now => { const u = Math.min(1, (now - t0) / Math.max(1, ms)); fn(ease(u), u); if (u < 1) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  C.wait = ms => new Promise(r => setTimeout(r, C.settings.reduced ? Math.min(ms, 200) : ms));
  C.fmt = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  C.sub = s => s.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>').replace(/_(\w)/g, '<sub>$1</sub>');

  // ---------- Streamlit bridge (components v1 protocol) ----------
  let evtId = 0;
  C.bridge = {
    inStreamlit: false,
    post(type, extra) { try { window.parent.postMessage(Object.assign({ isStreamlitMessage: true, type }, extra), '*'); } catch (e) {} },
    send(action, params = {}) {
      if (!C.bridge.inStreamlit) { C.toast('Live actions need the Streamlit app (streamlit run app.py)'); return false; }
      C.bridge.post('streamlit:setComponentValue', { value: Object.assign({ action, id: `${Date.now()}-${++evtId}` }, params), dataType: 'json' });
      return true;
    },
  };
  window.addEventListener('message', e => {
    const m = e.data;
    if (m && m.type === 'streamlit:render') {
      C.bridge.inStreamlit = true;
      C.bridge.post('streamlit:setFrameHeight', { height: Math.max(400, window.innerHeight) });
      if (m.args && m.args.payload) C.onData && C.onData(m.args.payload);
    }
  });
  C.bridge.post('streamlit:componentReady', { apiVersion: 1 });

  // ---------- captions ----------
  let capToken = 0, capTimer = null;
  C.say = (html, ms = 0) => {
    const cap = C.$('#caption'), tok = ++capToken;
    clearTimeout(capTimer);
    cap.classList.remove('on');
    setTimeout(() => {
      if (tok !== capToken) return;
      cap.innerHTML = html; cap.classList.add('on');
      if (ms) capTimer = setTimeout(() => { if (tok === capToken) cap.classList.remove('on'); }, ms);
    }, cap.innerHTML ? 450 : 0);
  };
  C.hush = () => { capToken++; C.$('#caption').classList.remove('on'); };
  let toastT;
  C.toast = (txt, ms = 2600) => { const t = C.$('#toast'); t.textContent = txt; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); };

  // ---------- settings ----------
  C.applySettings = () => {
    document.body.classList.toggle('pm', !!C.settings.pm);
    document.body.classList.toggle('reduced', !!C.settings.reduced);
    try { localStorage.setItem('chronos.settings', JSON.stringify(C.settings)); } catch (e) {}
    C.renderMap && C.renderMap();
  };
  C.fullscreen = () => {
    try {
      const d = window.parent.document;
      if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen();
    } catch (e) {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => C.toast('Press F11 for full screen'));
    }
  };

  // ---------- film grain tile ----------
  (() => {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'), img = x.createImageData(160, 160);
    for (let k = 0; k < img.data.length; k += 4) { const v = Math.random() * 255; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
    x.putImageData(img, 0, 0);
    C.$('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  // ---------- indicator ----------
  C.setIndicator = i => {
    C.$('#indicator .segs').innerHTML = C.CH.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
    C.$('#indicator .name').textContent = `${C.CH[i].n} — ${C.CH[i].t}`;
  };

  // ---------- idle detection (controls appear when needed) ----------
  let idleT;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 2800); };
  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, wake, { passive: true }));
  wake();

  // ---------- chapter map + console (Esc) ----------
  C.mapOpen = false;
  C.toggleMap = (on = !C.mapOpen) => { C.mapOpen = on; C.renderMap(); C.$('#map').classList.toggle('on', on); };
  C.renderMap = () => {
    const m = C.$('#map'), d = C.data, meta = d ? d.meta : {};
    const L = d && d.learning;
    m.innerHTML = `
      <div class="row">${C.CH.map((c, k) => `<div class="ch ${k === C.chapter ? 'on' : ''}" data-k="${k}">
        <div class="n">CHAPTER ${c.n}</div><div class="t">${c.t.replace('THE ', 'THE<br>')}</div><div class="d">${c.d}</div></div>`).join('')}</div>
      <div class="foot">
        <button class="ctl ${C.settings.pm ? 'on' : ''}" data-a="pm">presentation mode · P</button>
        <button class="ctl ${C.settings.reduced ? 'on' : ''}" data-a="reduced">reduced effects</button>
        <button class="ctl" data-a="fs">full screen · F</button>
        <button class="ctl" data-a="close">return · Esc</button>
      </div>
      <div class="console dev">
        <span style="letter-spacing:.4em;color:var(--amber)">ENGINEERING</span>
        <label>epochs <input id="cf-ep" type="number" min="1" max="60" value="${L ? L.epochs : 20}"></label>
        <label>hidden <select id="cf-h"><option ${meta.hidden == 16 ? 'selected' : ''}>16</option><option ${meta.hidden != 16 ? 'selected' : ''}>32</option></select></label>
        <label>lr <input id="cf-lr" type="text" value="0.003"></label>
        <button class="ctl" data-a="train">retrain</button>
        <button class="ctl" data-a="reset">reset model</button>
        <label>seed <input id="cf-seed" type="number" value="${meta.data_cfg ? meta.data_cfg[0] : 7}"></label>
        <label>noise <input id="cf-noise" type="number" step="1" value="${meta.data_cfg ? meta.data_cfg[1] : 12}"></label>
        <button class="ctl" data-a="dataset">generate dataset</button>
      </div>
      <div class="status">${d ? `${meta.trained ? 'TRAINED MODEL' : 'UNTRAINED MODEL'} · ${meta.run_source || 'no training run'} · LSTM(1→${meta.hidden}) · ${meta.device}
        ${L ? ` · ${L.epochs} epochs in ${L.compute_seconds.toFixed(2)} s` : ''} · data: simulated (seed ${meta.data_cfg[0]}, noise σ ${meta.data_cfg[1]} MW)
        ${meta.mismatch ? '<br><span style="color:var(--amber)">model was trained on a different simulated dataset — retrain for a fair test</span>' : ''}
        ${meta.error ? `<br><span style="color:var(--ember)">${meta.error}</span>` : ''}` : 'awaiting model data…'}</div>
      <div class="keys">← → chapters · SPACE play / pause · ESC chapters · P presentation · F full screen</div>`;
    m.querySelectorAll('.ch').forEach(e => e.onclick = () => { C.toggleMap(false); C.go(+e.dataset.k); });
    m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'pm') { C.settings.pm = !C.settings.pm; C.applySettings(); }
      if (a === 'reduced') { C.settings.reduced = !C.settings.reduced; C.applySettings(); }
      if (a === 'fs') C.fullscreen();
      if (a === 'close') C.toggleMap(false);
      if (a === 'train') C.requestTrain({ epochs: +C.$('#cf-ep').value, hidden: +C.$('#cf-h').value, lr: parseFloat(C.$('#cf-lr').value) || 0.003 });
      if (a === 'reset' && C.bridge.send('reset')) { C.toggleMap(false); C.toast('resetting model to random weights'); }
      if (a === 'dataset' && C.bridge.send('dataset', { seed: +C.$('#cf-seed').value, noise: +C.$('#cf-noise').value })) { C.toggleMap(false); C.toast('generating new simulated dataset'); }
    });
  };

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); C.next && C.next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); C.prev && C.prev(); }
    else if (k === ' ' || k === 'Spacebar') { e.preventDefault(); const s = C.scenes[C.chapter]; s && s.toggle && s.toggle(); }
    else if (k === 'Escape') { const s = C.scenes[C.chapter]; if (!C.mapOpen && s && s.onEscape && s.onEscape()) return; C.toggleMap(); }
    else if (k === 'p' || k === 'P') { C.settings.pm = !C.settings.pm; C.applySettings(); C.toast(C.settings.pm ? 'presentation mode' : 'presentation mode off'); }
    else if (k === 'f' || k === 'F') C.fullscreen();
    else { const s = C.scenes[C.chapter]; s && s.onKey && s.onKey(k); }
  });
  C.$('#nav-prev').onclick = () => C.prev();
  C.$('#nav-next').onclick = () => C.next();
  C.$('#nav-map').onclick = () => C.toggleMap();
  C.applySettings();
})();
