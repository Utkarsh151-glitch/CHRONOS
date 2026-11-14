/* CHRONOS 2.0 — Chapter 00 · TimelineScene: the arrival of time */
(() => {
  const C = window.CHRONOS, K = C.cosmos;
  const st = document.createElement('style');
  st.textContent = `
  #s0 .title{position:absolute;left:0;right:0;top:40.5cqh;text-align:center;pointer-events:none}
  #s0 .word{font-size:6.4cqw;font-weight:200;letter-spacing:.62em;margin-left:.62em;color:#fff;line-height:1;
    text-shadow:0 0 40px rgba(255,190,130,.25)}
  #s0 .word span{display:inline-block;opacity:0;filter:blur(14px);transform:translateY(.25em);transition:opacity 1.6s ease,filter 1.8s ease,transform 1.8s ease}
  #s0 .word span.in{opacity:1;filter:blur(0);transform:none}
  #s0 .sub{font-size:1.02cqw;letter-spacing:.85em;margin:2.2cqh 0 0 .85em;color:var(--ink);opacity:0;transition:opacity 1.6s}
  #s0 .q{font-size:1.45cqw;font-style:italic;font-weight:300;color:var(--dim);margin-top:3.2cqh;opacity:0;transition:opacity 1.8s}
  #s0 .in2{opacity:1!important}
  #s0 .start{position:absolute;left:50%;bottom:5cqh;transform:translateX(-50%);opacity:0;transition:opacity 1.2s;pointer-events:none;text-align:center}
  #s0 .start.in2{pointer-events:auto}
  #s0 .start .ctl{font-size:.9cqw;letter-spacing:.6em;color:#fff;padding:1cqw 1.6cqw}
  #s0 .start .ctl::before{content:"";position:absolute;left:50%;bottom:0;width:0;height:1px;background:var(--amber);transform:translateX(-50%);transition:width .5s}
  #s0 .start .ctl:hover::before{width:70%}
  #s0 .start .hint{font-size:.62cqw;letter-spacing:.4em;color:var(--faint);margin-top:.4cqw}
  #s0 .skip{position:absolute;right:1cqw;top:1.2cqh;font-size:.6cqw;opacity:.6}
  #s0 .datanote{position:absolute;left:0;right:0;bottom:1.8cqh;text-align:center}
  `;
  document.head.appendChild(st);

  const S = { el: document.getElementById('s0'), tok: 0, introDone: false };
  C.scenes[0] = S;

  S.build = d => {
    const el = S.el;
    el.innerHTML = `<svg class="world" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
        <defs><filter id="a-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="a-line" x1="0" x2="1"><stop offset="0" stop-color="#7fd8f0" stop-opacity="0"/><stop offset=".12" stop-color="#7fd8f0" stop-opacity=".7"/>
          <stop offset=".5" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".88" stop-color="#ffb15c" stop-opacity=".7"/><stop offset="1" stop-color="#ffb15c" stop-opacity="0"/></linearGradient></defs>
        <g id="a-tl"></g></svg>
      <div class="title"><div class="word">${'CHRONOS'.split('').map(c => `<span>${c}</span>`).join('')}</div>
        <div class="sub">INSIDE THE MEMORY OF AI</div>
        <div class="q">“Can a neural network remember the past to predict the future?”</div></div>
      <div class="start"><button class="ctl" id="a-start">START EXPEDITION</button><div class="hint">AN LSTM READS THE LAST 24 HOURS AND FORECASTS THE NEXT · → OR SPACE</div></div>
      <button class="ctl skip" id="a-skip">skip intro</button>`;
    S.drawTimeline(d);
    el.querySelector('#a-start').onclick = () => C.go(1);
    el.querySelector('#a-skip').onclick = () => S.finish();
  };

  S.drawTimeline = d => {
    const v = d.series.window_mw, n = v.length, ni = d.series.now_index;
    const lo = Math.min(...v), hi = Math.max(...v);
    const X = k => 100 + 1400 * k / (n - 1), Y = val => 690 - 70 * ((val - lo) / (hi - lo) - .5);
    K.series = v.map(val => (val - lo) / (hi - lo));
    const pts = v.map((val, k) => [X(k), Y(val)]);
    const dPath = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
    const nx = X(ni);
    S.nowX = nx; S.nowY = Y(v[ni]);
    let dots = '';
    for (let k = 0; k < n; k += 2) {
      const fut = k >= ni, a = .35 + .65 * Math.exp(-Math.abs(k - ni) / 70);
      dots += `<circle class="dot" cx="${pts[k][0]}" cy="${pts[k][1]}" r="${fut ? 2.4 : 2.1}" fill="${fut ? '#ffb15c' : '#7fd8f0'}" opacity="${a}"/>`;
    }
    const g = S.el.querySelector('#a-tl');
    g.innerHTML = `
      <path id="a-path" d="${dPath}" fill="none" stroke="url(#a-line)" stroke-width="1.6"/>
      <g id="a-dots" opacity="0">${dots}</g>
      <g id="a-now" opacity="0">
        <line x1="${nx}" x2="${nx}" y1="${S.nowY - 58}" y2="${S.nowY + 46}" stroke="#fff" stroke-width="1.4" filter="url(#a-glow)"/>
        <text x="${nx}" y="${S.nowY - 70}" text-anchor="middle" fill="#fff" font-size="15" letter-spacing="8">NOW</text>
        <text x="100" y="760" fill="#7fd8f0" font-size="14" letter-spacing="8">PAST</text>
        <text x="100" y="782" fill="rgba(243,241,234,.4)" font-size="11.5" letter-spacing="3">HOURS THE MODEL LEARNS FROM</text>
        <text x="1500" y="760" text-anchor="end" fill="#ffb15c" font-size="14" letter-spacing="8">FUTURE</text>
        <text x="1500" y="782" text-anchor="end" fill="rgba(243,241,234,.4)" font-size="11.5" letter-spacing="3">HELD-OUT HOURS IT HAS NEVER SEEN</text>
      </g>
      <g id="a-pulses"></g>`;
    const path = g.querySelector('#a-path'), L = path.getTotalLength();
    path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
    S.path = path; S.L = L;
    // pulses travel from past to future along the real series
    const pg = g.querySelector('#a-pulses');
    S.pulses = Array.from({ length: 16 }, (_, k) => {
      const c = C.svg('circle', { r: 3.2, fill: '#fff', filter: 'url(#a-glow)', opacity: 0 }, pg);
      return { c, u: k / 16, v: .028 + (k % 4) * .006 };
    });
  };

  S.pulseOn = false;
  C.frame.push((now, dt) => {
    if (!S.pulseOn || !S.path) return;
    for (const p of S.pulses) {
      p.u = (p.u + p.v * dt) % 1;
      const pt = S.path.getPointAtLength(p.u * S.L);
      p.c.setAttribute('cx', pt.x); p.c.setAttribute('cy', pt.y);
      p.c.setAttribute('fill', pt.x > S.nowX ? '#ffcf8a' : '#bfefff');
      p.c.setAttribute('opacity', Math.sin(Math.PI * p.u) * .9);
    }
  });

  const $ = s => S.el.querySelector(s);
  function titleIn(instant) {
    $('.word').querySelectorAll('span').forEach((s, k) => { s.style.transitionDelay = instant ? '0s' : `${k * .16}s`; s.classList.add('in'); });
  }
  function reset() {
    $('.word').querySelectorAll('span').forEach(s => { s.style.transitionDelay = '0s'; s.classList.remove('in'); });
    ['.sub', '.q', '.start'].forEach(s => $(s).classList.remove('in2'));
    $('#a-dots').setAttribute('opacity', 0); $('#a-now').setAttribute('opacity', 0);
    S.path.style.strokeDashoffset = S.L; S.pulseOn = false;
    $('#a-tl').setAttribute('transform', ''); $('#a-tl').style.opacity = 1;
    $('.title').style.opacity = 1; $('.title').style.transform = '';
  }

  S.finish = () => {
    S.tok++; S.introDone = true;
    document.body.classList.remove('intro');
    K.set({ stars: 1, nebula: .8, ha: 1, hs: .6, hx: .5, hy: .25, light: .12 });
    S.path.style.transition = 'none'; S.path.style.strokeDashoffset = 0;
    $('#a-dots').setAttribute('opacity', 1); $('#a-now').setAttribute('opacity', 1); S.pulseOn = true;
    titleIn(true); ['.sub', '.q', '.start'].forEach(s => $(s).classList.add('in2'));
    $('#a-skip').classList.add('hide');
    C.hush();
  };

  S.intro = async () => {
    const tok = ++S.tok; S.introDone = false;
    const step = async ms => { await C.wait(ms); if (tok !== S.tok) throw 0; };
    reset(); document.body.classList.add('intro'); $('#a-skip').classList.remove('hide');
    K.set({ stars: 0, nebula: 0, ha: 0, hs: .42, hx: .5, hy: .25, light: 0, planet: 0, dawn: 0, tunnel: 0, warp: 0, pan: 0, drift: 1 });
    try {
      K.to({ light: 1 }, 2400);
      await step(1300); K.to({ stars: 1, nebula: .8 }, 3800);
      await step(900); C.say('Time leaves a trace.', 3200);
      K.to({ ha: 1, hs: .6, light: .12 }, 6500, C.ease.out);
      await step(3400);
      S.path.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.6,0,.2,1)'; S.path.style.strokeDashoffset = 0;
      await step(1100); $('#a-dots').style.transition = 'opacity 1.6s'; $('#a-dots').setAttribute('opacity', 1); S.pulseOn = true;
      C.say('Every hour, a city’s electricity demand rises and falls: <b>daily</b> and <b>weekly</b> rhythms, a slow trend, noise. <span class="m">Simulated</span>, but full of memory.', 5200);
      await step(1300); $('#a-now').style.transition = 'opacity 1.4s'; $('#a-now').setAttribute('opacity', 1);
      await step(1600); titleIn(false); document.body.classList.remove('intro');
      await step(1700); $('.sub').classList.add('in2');
      await step(900); $('.q').classList.add('in2');
      await step(1600); $('.start').classList.add('in2'); $('#a-skip').classList.add('hide');
      C.hush(); S.introDone = true;
    } catch (e) { /* skipped */ }
  };

  S.enter = from => {
    if (from == null) return S.intro();
    S.finish();
  };
  S.toggle = () => { if (!S.introDone) S.finish(); else C.go(1); };
  S.onKey = () => {};

  // Transition 1, part A: the camera dives into the timeline at NOW
  S.launch = async () => {
    S.tok++; C.hush();
    const tl = $('#a-tl'), title = $('.title'), nx = S.nowX, ny = S.nowY;
    $('.start').classList.remove('in2');
    title.style.transition = 'opacity 1s, transform 1.4s'; title.style.opacity = 0; title.style.transform = 'translateY(-6cqh) scale(1.05)';
    const dots = [...tl.querySelectorAll('.dot')];
    await C.tween(1700, e => {
      const s = 1 + e * 7.5;
      tl.setAttribute('transform', `translate(${e * (800 - nx)} ${e * (450 - ny)}) translate(${nx} ${ny}) scale(${s}) translate(${-nx} ${-ny})`);
      dots.forEach(c => c.setAttribute('r', 2.2 * (1 + e * 1.5)));
      tl.style.opacity = 1 - Math.max(0, (e - .55) / .45);
    }, C.ease.expoIn);
  };
  S.exit = () => { S.pulseOn = false; C.hush(); };
  S.update = d => { if (S.path) { S.drawTimeline(d); if (S.introDone) S.finish(); } };
})();
