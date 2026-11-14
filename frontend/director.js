/* CHRONOS 2.0 — director: CameraTransition + chapter flow + boot */
(() => {
  const C = window.CHRONOS, K = C.cosmos, E = C.ease;
  const ENV = [
    { hx: .5, hy: .25, hs: .6, ha: 1, planet: 0, dawn: 0, light: .12, stars: 1, nebula: .8 },
    { hx: .86, hy: .15, hs: .24, ha: .32, planet: 0, dawn: 0, light: 0, stars: .75, nebula: .45 },
    { hx: .5, hy: .5, hs: .18, ha: 0, planet: 0, dawn: 0, light: 0, stars: .9, nebula: .6 },
    { hx: .85, hy: .1, hs: .12, ha: 0, planet: 1, dawn: .55, light: 0, stars: .85, nebula: .45 },
  ];
  const sc = i => C.scenes[i];
  const show = i => sc(i).el.classList.add('live');
  const hide = i => { const e = sc(i).el; e.classList.remove('live'); e.style.opacity = 0; };
  const pose = (i, { o = 1, s = 1, x = 0, y = 0 }) => { const e = sc(i).el; e.style.opacity = o; e.style.transform = `translate(${x}%, ${y}%) scale(${s})`; };

  // Transition 1: the timeline becomes a luminous passage into the memory chamber
  async function t01() {
    K.to({ ha: 0, light: 0, nebula: .25 }, 2000);
    K.to({ tunnel: 1 }, 1500, E.out);
    K.to({ warp: 1 }, 1900, E.in);
    await sc(0).launch();
    C.tween(500, e => pose(0, { o: 1 - e }));
    await C.wait(1100);
    hide(0); show(1); pose(1, { o: 0, s: .3 });
    K.to({ warp: 0 }, 1700, E.out);
    K.to({ tunnel: 0 }, 2100, E.inOut);
    K.to(Object.assign({}, ENV[1]), 2600);
    await C.tween(1800, e => pose(1, { o: C.clamp(e * 1.6), s: C.lerp(.3, 1, e) }), E.out);
  }
  // Transition 2: the gates fire, the signal leaves the cell, the camera pulls back:
  // the single cell becomes the first of 24 unrolled time steps
  async function t12() {
    await sc(1).igniteSeq();
    show(2); pose(2, { o: 0, x: 22 });
    K.to({ pan: 1.1 }, 700); K.to(Object.assign({}, ENV[2]), 2400);
    await C.tween(1900, e => {
      pose(1, { o: 1 - C.clamp((e - .55) / .45), s: C.lerp(1, .022, E.inOut(e)), x: C.lerp(0, -40.6, E.inOut(e)), y: C.lerp(0, -1.1, E.inOut(e)) });
      pose(2, { o: C.clamp((e - .3) / .6), x: C.lerp(22, 0, E.out(e)) });
    }, E.lin);
    hide(1); K.to({ pan: 0 }, 1400);
  }
  // Transition 3: the last backward sweep and update; a forecast leaves the present and the camera follows it
  async function t23() {
    await sc(2).finale();
    show(3); pose(3, { o: 0, x: 35 });
    K.to({ pan: 1.3 }, 600); K.to(Object.assign({}, ENV[3]), 2600, E.out);
    await C.tween(1700, e => { pose(2, { o: 1 - e, x: -35 * e }); pose(3, { o: C.clamp(e * 1.3), x: 35 * (1 - E.out(e)) }); }, E.inOut);
    hide(2); K.to({ pan: 0 }, 1500);
  }
  // Other moves (backwards, jumps): a short warp through space
  async function travel(from, to) {
    const fwd = to > from;
    show(to); pose(to, { o: 0, s: fwd ? .8 : 1.25 });
    K.to({ warp: fwd ? .7 : 0, drift: fwd ? 1 : -14 }, 500, E.in);
    K.to(Object.assign({ tunnel: 0 }, ENV[to]), 1700);
    await C.tween(1300, e => { pose(from, { o: 1 - e, s: fwd ? C.lerp(1, 1.4, e) : C.lerp(1, .72, e) }); pose(to, { o: e, s: fwd ? C.lerp(.8, 1, e) : C.lerp(1.25, 1, e) }); }, E.inOut);
    hide(from); K.to({ warp: 0, drift: 1 }, 900, E.out);
  }
  const T = { 0: t01, 1: t12, 2: t23 };

  C.go = async to => {
    if (C.busy || !C.data || to === C.chapter || to < 0 || to >= C.scenes.length) return;
    C.busy = true; const from = C.chapter;
    C.toggleMap(false); C.hush();
    try { sc(from).exit && sc(from).exit(); } catch (e) { console.error(e); }
    try { if (to === from + 1 && !C.settings.reduced) await T[from](); else await travel(from, to); }
    catch (e) { console.error(e); hide(from); show(to); pose(to, {}); }
    C.chapter = to; C.setIndicator(to); C.busy = false;
    try { sc(to).enter(from); } catch (e) { console.error(e); }
  };
  C.next = () => { if (C.chapter === 0 && !sc(0).introDone) { sc(0).finish(); return; } C.go(C.chapter + 1); };
  C.prev = () => C.go(C.chapter - 1);

  let trainTimer;
  C.requestTrain = (cfg = {}) => {
    const d = C.data || {}, p = Object.assign({ epochs: d.learning ? d.learning.epochs : 20, hidden: d.meta ? d.meta.hidden : 32, lr: .003 }, cfg);
    if (!C.bridge.send('train', p)) return;
    C.toggleMap(false); sc(2).setTraining(true); C.toast(`training · ${p.epochs} epochs · ${p.hidden} hidden units`);
    clearTimeout(trainTimer);
    trainTimer = setTimeout(() => { if (sc(2).training) { sc(2).setTraining(false); C.toast('training did not report back · check the terminal', 5000); } }, 120000);
    if (C.chapter !== 2) C.go(2);
  };

  C.onData = p => {
    if (!p || p.version === C.version) return;
    const first = C.version === -1;
    C.version = p.version; C.data = p;
    if (first) {
      C.scenes.forEach(s => s.build(p));
      show(0); pose(0, {}); C.setIndicator(0); C.chapter = 0;
      sc(0).enter(null);
    } else {
      C.scenes.forEach(s => { try { s.update(p); } catch (e) { console.error(e); } });
      clearTimeout(trainTimer);
      if (p.meta.error) C.toast(p.meta.error, 7000);
      else if (p.event === 'reset') C.toast('model reset · random weights');
      else if (p.event === 'dataset') C.toast('new simulated dataset · retrain for a fair test', 4000);
    }
    C.renderMap();
  };

  // Outside Streamlit (e.g. opening index.html through a static server) fall back to a saved payload
  setTimeout(() => {
    if (C.version !== -1) return;
    fetch('dev_payload.json').then(r => r.json()).then(C.onData).catch(() => C.toast('waiting for model data…', 8000));
  }, 1500);
  try { window.focus(); } catch (e) {}
})();
