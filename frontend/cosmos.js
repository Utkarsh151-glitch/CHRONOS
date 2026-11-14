/* CHRONOS 2.0 — CinematicBackground: procedural stars, gravitational horizon, planet, corridor.
   Everything here is original procedural artwork (no film assets). */
(() => {
  const C = window.CHRONOS;
  const cv = document.getElementById('cosmos'), x = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const K = C.cosmos = {
    p: { hx: .5, hy: .38, hs: .5, ha: 0, planet: 0, dawn: 0, tunnel: 0, warp: 0, pan: 0, light: 0, stars: 0, nebula: 0, drift: 1 },
    series: [],
  };
  C.frame = [];  // per-frame hooks: fn(now, dt)

  // each key is owned by its most recent tween, so a newer camera move always wins
  const owner = {}; let seq = 0;
  K.set = o => { for (const k in o) owner[k] = ++seq; Object.assign(K.p, o); };
  K.to = (o, ms, ease) => {
    const id = ++seq, from = {};
    for (const k in o) { from[k] = K.p[k]; owner[k] = id; }
    return C.tween(ms, e => { for (const k in o) if (owner[k] === id) K.p[k] = C.lerp(from[k], o[k], e); }, ease);
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, C.settings.reduced ? 1 : 1.5);
    W = cv.width = Math.floor(innerWidth * dpr); H = cv.height = Math.floor(innerHeight * dpr);
  }
  addEventListener('resize', resize); resize();

  // ---------- seeded random ----------
  const rng = seed => { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };

  // ---------- gravitational horizon sprite (rendered once, 2 variants cross-faded) ----------
  function heat(t) {
    const S = [[0, [255, 248, 232]], [.16, [255, 218, 158]], [.42, [255, 156, 66]], [.72, [196, 74, 26]], [1, [70, 18, 8]]];
    for (let k = 1; k < S.length; k++) if (t <= S[k][0]) {
      const u = (t - S[k - 1][0]) / (S[k][0] - S[k - 1][0]);
      return S[k - 1][1].map((v, j) => Math.round(v + (S[k][1][j] - v) * u));
    }
    return S[S.length - 1][1];
  }
  function renderHorizon(seed) {
    const SW = 1500, SH = 960, c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const g = c.getContext('2d'), rnd = rng(seed), cx = SW / 2, cy = SH / 2, R = 104;
    g.globalCompositeOperation = 'lighter';
    const disk = back => {
      for (let r = 1.5 * R; r < 5.6 * R; r += 1.15) {
        const t = (r - 1.5 * R) / (4.1 * R), col = heat(t), base = .36 * Math.pow(1 - t, 1.45) + .012;
        const segs = 40, a0 = back ? Math.PI : 0;
        g.lineWidth = 1.6;
        for (let k = 0; k < segs; k++) {
          const th0 = a0 + k * Math.PI / segs, th1 = th0 + Math.PI / segs * 1.04, mid = (th0 + th1) / 2;
          const dop = .62 + .38 * (-Math.cos(mid));                    // approaching side brighter
          g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${base * dop * (.4 + rnd() * 1.2) * (back ? .75 : 1.7)})`;
          g.setLineDash([5 + rnd() * 70, 2 + rnd() * 26]); g.lineDashOffset = rnd() * 90;
          g.beginPath(); g.ellipse(cx, cy, r, r * .165, 0, th0, th1); g.stroke();
        }
      }
    };
    disk(true);
    // lensed image of the far side of the disk, bent over and under the shadow
    for (let r = 1.03 * R; r < 1.8 * R; r += .75) {
      const t = (r - 1.03 * R) / (.77 * R), col = heat(Math.min(1, .05 + t * .8)), base = .52 * Math.pow(1 - t, 2.1);
      const segs = 56;
      g.lineWidth = 1.5;
      for (let k = 0; k < segs; k++) {
        const th0 = k * 2 * Math.PI / segs, th1 = th0 + 2 * Math.PI / segs * 1.04, mid = (th0 + th1) / 2;
        const vert = .25 + .75 * Math.abs(Math.sin(mid)), top = Math.sin(mid) < 0 ? 1 : .55, dop = .65 + .35 * (-Math.cos(mid));
        g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${base * vert * top * dop * (.5 + rnd())})`;
        g.setLineDash([8 + rnd() * 50, 2 + rnd() * 12]); g.lineDashOffset = rnd() * 60;
        g.beginPath(); g.ellipse(cx, cy, r, r * .93, 0, th0, th1); g.stroke();
      }
    }
    g.setLineDash([]);
    // event-horizon shadow
    g.globalCompositeOperation = 'source-over';
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.06);
    sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(.93, 'rgba(0,0,0,1)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R * 1.06, 0, 7); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,238,210,.9)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, cy, R * 1.03, R * .985, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,200,140,.16)'; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy, R * 1.05, R * 1.0, 0, 0, 7); g.stroke();
    disk(false);
    // bloom
    const b = document.createElement('canvas'); b.width = SW; b.height = SH; const bg = b.getContext('2d');
    bg.filter = 'blur(12px)'; bg.drawImage(c, 0, 0); g.globalAlpha = .55; g.drawImage(b, 0, 0);
    bg.clearRect(0, 0, SW, SH); bg.filter = 'blur(46px)'; bg.drawImage(c, 0, 0); g.globalAlpha = .42; g.drawImage(b, 0, 0);
    g.globalAlpha = 1;
    return c;
  }
  const HZ = [renderHorizon(7), C.settings.reduced ? null : renderHorizon(1234)].filter(Boolean);

  // ---------- nebula ----------
  const NEB = (() => {
    const c = document.createElement('canvas'); c.width = 960; c.height = 600; const g = c.getContext('2d'), rnd = rng(99);
    const blobs = [[30, 50, 110, .22], [20, 40, 90, .2], [70, 40, 110, .09], [110, 60, 30, .07], [20, 60, 100, .16]];
    for (let k = 0; k < 14; k++) {
      const [r, gg, bb, a] = blobs[k % blobs.length], px = rnd() * 960, py = rnd() * 600, rad = 80 + rnd() * 260;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(${r},${gg},${bb},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 960, 600);
    }
    return c;
  })();

  // ---------- stars & dust ----------
  const rnd = rng(42);
  const NSTAR = C.settings.reduced ? 260 : 760;
  const stars = Array.from({ length: NSTAR }, () => ({ x: (rnd() - .5) * 3.4, y: (rnd() - .5) * 2.2, z: .05 + rnd() * .95, w: rnd(), tw: rnd() * 6.28 }));
  const dust = Array.from({ length: C.settings.reduced ? 0 : 46 }, () => ({ x: rnd(), y: rnd(), r: .6 + rnd() * 2.2, v: .2 + rnd(), a: .05 + rnd() * .12 }));
  let tunPhase = 0, panAcc = 0;

  function drawStars(dt, t) {
    const P = K.p, cx = W / 2, cy = H / 2, f = W * .36, speed = .010 * P.drift + P.warp * 1.35;
    x.lineCap = 'round';
    for (const s of stars) {
      s.z -= speed * dt;
      s.x -= P.pan * dt * .32;
      if (s.x < -1.8) s.x += 3.6; if (s.x > 1.8) s.x -= 3.6;
      if (s.z < .035) { s.z += 1; s.x = (rnd() - .5) * 3.4; s.y = (rnd() - .5) * 2.2; }
      else if (s.z > 1.04) { s.z -= 1; s.x = (rnd() - .5) * 3.4; s.y = (rnd() - .5) * 2.2; }
      const px = cx + s.x / s.z * f, py = cy + s.y / s.z * f;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const near = 1 - s.z, a = P.stars * Math.pow(near, 1.1) * (.55 + .45 * Math.sin(t * 1.3 + s.tw)) * (s.w > .93 ? 1.5 : 1);
      if (a < .02) continue;
      const warm = s.w > .86;
      const col = warm ? '255,214,170' : s.w < .2 ? '190,215,255' : '235,240,255';
      if (P.warp > .04 || Math.abs(P.pan) > .3) {
        const z2 = s.z + P.warp * .09, qx = cx + (s.x + P.pan * .02) / z2 * f, qy = cy + s.y / z2 * f;
        x.strokeStyle = `rgba(${col},${Math.min(1, a)})`; x.lineWidth = (.6 + near * 1.6) * dpr;
        x.beginPath(); x.moveTo(qx, qy); x.lineTo(px, py); x.stroke();
      } else {
        const sz = (.5 + near * 1.7) * dpr;
        x.fillStyle = `rgba(${col},${Math.min(1, a)})`; x.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
  }

  function drawHorizon(t) {
    const P = K.p; if (P.ha < .01) return;
    const size = P.hs * H * 1.05, sw = size * 1500 / 960;
    const R0 = size * 104 / 960;
    x.save(); x.translate(P.hx * W, P.hy * H); x.rotate(-.13);
    x.globalAlpha = P.ha; x.fillStyle = '#000'; x.beginPath(); x.ellipse(0, 0, R0 * 1.0, R0 * .97, 0, 0, 7); x.fill();
    x.restore(); x.globalAlpha = 1;
    x.save(); x.translate(P.hx * W, P.hy * H); x.rotate(-.13 + Math.sin(t * .05) * .01);
    const breathe = 1 + Math.sin(t * .4) * .006;
    x.scale(breathe, breathe);
    x.globalCompositeOperation = 'lighter';
    const ph = (Math.sin(t * .45) + 1) / 2;
    x.globalAlpha = P.ha * (HZ.length > 1 ? 1 - ph * .6 : 1); x.drawImage(HZ[0], -sw / 2, -size / 2, sw, size);
    if (HZ.length > 1) { x.globalAlpha = P.ha * ph * .6; x.drawImage(HZ[1], -sw / 2, -size / 2, sw, size); }
    x.restore(); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }

  function drawLight() {
    const P = K.p; if (P.light < .01) return;
    const px = W / 2, py = H * .38, r = H * .32;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,236,210,${.9 * P.light})`); g.addColorStop(.05, `rgba(255,200,150,${.35 * P.light})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r); x.globalCompositeOperation = 'source-over';
  }

  function drawPlanet(t) {
    const P = K.p; if (P.planet < .01) return;
    const Rp = W * 1.3, top = H * (.79 + (1 - P.planet) * .5), cx = W / 2, cy = top + Rp;
    x.save(); x.globalAlpha = Math.min(1, P.planet * 1.4);
    const body = x.createRadialGradient(cx, cy, Rp * .9, cx, cy, Rp);
    body.addColorStop(0, '#010207'); body.addColorStop(.97, '#060d1c'); body.addColorStop(.995, '#16294a'); body.addColorStop(1, '#3d5e8c');
    x.fillStyle = body; x.beginPath(); x.arc(cx, cy, Rp, 0, 7); x.fill();
    // faint surface bands
    x.globalCompositeOperation = 'lighter';
    for (let k = 1; k < 7; k++) { x.strokeStyle = `rgba(80,110,160,${.035 / k})`; x.lineWidth = 30 * dpr; x.beginPath(); x.arc(cx, cy, Rp - k * 26 * dpr, Math.PI * 1.25, Math.PI * 1.75); x.stroke(); }
    // atmosphere
    for (let k = 0; k < 16; k++) {
      x.strokeStyle = `rgba(150,200,255,${Math.pow(.2 * (1 - k / 16), 1.4)})`; x.lineWidth = 2.4 * dpr;
      x.beginPath(); x.arc(cx, cy, Rp + k * 2.4 * dpr, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    }
    // dawn at the present-time boundary (screen centre)
    const d = P.dawn;
    if (d > .01) {
      const sy = top - 1;
      let g = x.createRadialGradient(cx, sy, 0, cx, sy, H * .55);
      g.addColorStop(0, `rgba(255,236,205,${.85 * d})`); g.addColorStop(.04, `rgba(255,190,120,${.5 * d})`); g.addColorStop(.3, `rgba(255,140,60,${.12 * d})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - H * .55, sy - H * .55, H * 1.1, H * 1.1);
      g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(255,190,130,0)'); g.addColorStop(.5, `rgba(255,225,190,${.55 * d})`); g.addColorStop(1, 'rgba(255,190,130,0)');
      x.fillStyle = g; x.fillRect(0, sy - 1.2 * dpr, W, 2.4 * dpr);
      x.strokeStyle = `rgba(255,170,90,${.35 * d})`; x.lineWidth = 3 * dpr;
      x.beginPath(); x.arc(cx, cy, Rp + 1, Math.PI * 1.42, Math.PI * 1.58); x.stroke();
    }
    x.restore(); x.globalCompositeOperation = 'source-over';
  }

  function drawTunnel(dt, t) {
    const P = K.p; if (P.tunnel < .01) return;
    tunPhase += dt * (.18 + P.warp * 1.6);
    const cx = W / 2, cy = H * .5, N = 28, ser = K.series;
    x.globalCompositeOperation = 'lighter';
    const core = x.createRadialGradient(cx, cy, 0, cx, cy, H * .3);
    core.addColorStop(0, `rgba(255,230,200,${.5 * P.tunnel})`); core.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = core; x.fillRect(cx - H * .3, cy - H * .3, H * .6, H * .6);
    for (let k = 0; k < N; k++) {
      const z = ((k / N - tunPhase) % 1 + 1) % 1 + .03, r = H * .085 / z;
      if (r > W * 1.2) continue;
      const a = P.tunnel * Math.min(1, (1.03 - z) * 1.8) * Math.min(1, z * 5);
      const warm = k % 3 === 0;
      x.strokeStyle = warm ? `rgba(255,170,90,${.55 * a})` : `rgba(150,180,220,${.28 * a})`;
      x.lineWidth = Math.min(16, (.9 + .25 / z) * dpr);
      const circ = 2 * Math.PI * r; x.setLineDash([circ / 16 * .82, circ / 16 * .18]); x.lineDashOffset = k * 7;
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
      // sequential observations travelling along the corridor walls (real demand values)
      if (ser.length) for (let j = 0; j < 4; j++) {
        const v = ser[(k * 4 + j) * 3 % ser.length], th = -Math.PI / 2 + (j - 1.5) * .5 + Math.PI * (j > 1 ? 1 : 0);
        const px = cx + Math.cos(th) * r * .92, py = cy + Math.sin(th) * r * .92, rr = Math.min(40, (1.5 + v * 2.5) * dpr / z * .4);
        const g = x.createRadialGradient(px, py, 0, px, py, rr * 2.4);
        g.addColorStop(0, `rgba(${j < 2 ? '130,216,240' : '255,177,92'},${.9 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px - rr * 2.4, py - rr * 2.4, rr * 4.8, rr * 4.8);
      }
    }
    x.setLineDash([]); x.globalCompositeOperation = 'source-over';
  }

  function drawDust(dt) {
    const P = K.p; if (!dust.length || P.stars < .05) return;
    for (const d of dust) {
      d.x -= (.004 + P.pan * .08) * d.v * dt; d.y -= .002 * d.v * dt;
      if (P.warp > .05) { const dx = d.x - .5, dy = d.y - .5; d.x += dx * P.warp * dt * 2; d.y += dy * P.warp * dt * 2; }
      if (d.x < -.05 || d.x > 1.05 || d.y < -.05 || d.y > 1.05) { d.x = Math.random(); d.y = Math.random(); }
      x.fillStyle = `rgba(255,236,215,${d.a * P.stars})`; x.beginPath(); x.arc(d.x * W, d.y * H, d.r * dpr, 0, 7); x.fill();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000), t = now / 1000; last = now;
    const P = K.p;
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#010208'); bg.addColorStop(1, '#040915');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    panAcc += P.pan * dt * 20;
    if (P.nebula > .01) { x.globalAlpha = P.nebula; x.drawImage(NEB, -W * .1 - (panAcc % (W * .1)), -H * .05, W * 1.3, H * 1.1); x.globalAlpha = 1; }
    drawStars(dt, t);
    drawLight();
    drawHorizon(t);
    drawPlanet(t);
    drawTunnel(dt, t);
    drawDust(dt);
    for (const f of C.frame) { try { f(now, dt); } catch (e) { console.error(e); } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
