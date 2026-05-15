// ---------------------------------------------------------------------------
// Sound — gentle, optional Web Audio chimes. No samples, no network — all
// synthesised on the fly so the game stays offline-friendly. Off unless the
// user enables it in Settings (game.save.settings.sound).
// ---------------------------------------------------------------------------

window.Sound = (function () {
  let ctx = null;
  let game = null;
  let unlocked = false;

  function setGame(g) { game = g; }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  // Browsers require a user gesture before audio can play. Unlock on the
  // first click / key press, then leave it alone.
  function attachUnlock() {
    const unlock = () => {
      if (unlocked) return;
      const c = ensureCtx();
      if (c && c.state === 'suspended') c.resume();
      unlocked = true;
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  function enabled() {
    return !!(game && game.save && game.save.settings && game.save.settings.sound);
  }

  // A short pluck — sine wave with quick attack & exponential decay.
  function pluck(freq, when, duration, gain) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = when || c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain || 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (duration || 0.55));
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (duration || 0.55) + 0.05);
  }

  // Pre-canned events. Each is a tiny chord/sequence of plucks. Volumes are
  // intentionally low — these are gentle UI nudges, not stings.
  const events = {
    catch: [
      { f: 523.25, d: 0.35, g: 0.13 },   // C5
      { f: 659.25, d: 0.4,  g: 0.13, t: 0.08 },  // E5
      { f: 783.99, d: 0.55, g: 0.13, t: 0.18 },  // G5
    ],
    chime: [
      { f: 880,    d: 0.5,  g: 0.12 },   // A5
      { f: 1318.5, d: 0.7,  g: 0.10, t: 0.12 },  // E6
    ],
    pet: [
      { f: 392,    d: 0.35, g: 0.10 },   // G4
      { f: 587.33, d: 0.4,  g: 0.10, t: 0.06 },  // D5
    ],
    cook: [
      { f: 440,    d: 0.3,  g: 0.10 },   // A4
      { f: 554.37, d: 0.35, g: 0.10, t: 0.08 },  // C#5
      { f: 659.25, d: 0.45, g: 0.10, t: 0.16 },  // E5
    ],
    festival: [
      { f: 523.25, d: 0.4,  g: 0.13 },
      { f: 659.25, d: 0.45, g: 0.13, t: 0.1 },
      { f: 783.99, d: 0.5,  g: 0.13, t: 0.2 },
      { f: 1046.5, d: 0.7,  g: 0.13, t: 0.32 },  // C6
    ],
    portal: [
      { f: 698.46, d: 0.4,  g: 0.10 },   // F5
      { f: 880,    d: 0.5,  g: 0.10, t: 0.08 },
    ],
  };

  function play(name) {
    if (!enabled()) return;
    const seq = events[name];
    if (!seq) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const now = c.currentTime;
    for (const note of seq) {
      pluck(note.f, now + (note.t || 0), note.d, note.g);
    }
  }

  // ---- Ambient loops -----------------------------------------------------
  // Per-biome drones. Two detuned oscillators + a low-passed pulse for life.
  // Cross-fades on switch via gain ramps.
  const AMBIENT = {
    mossroot:  { base: 130.81, fifth: 196.00, type: 'triangle', tilt: 600 },
    treehouse: { base: 110.00, fifth: 164.81, type: 'sine',     tilt: 500 },
    honeydrop: { base: 174.61, fifth: 261.63, type: 'sine',     tilt: 900 },
    tidepools: { base: 98.00,  fifth: 146.83, type: 'triangle', tilt: 400 },
    starpetal: { base: 82.41,  fifth: 123.47, type: 'sine',     tilt: 350 },
    winter:    { base: 146.83, fifth: 220.00, type: 'sine',     tilt: 700 },
  };
  let ambientNodes = null;

  function startAmbient(biomeId) {
    if (!enabled()) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const cfg = AMBIENT[biomeId];
    if (!cfg) return;
    stopAmbient(0.6);

    const out = c.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.2);

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.tilt;

    const o1 = c.createOscillator();
    o1.type = cfg.type;
    o1.frequency.value = cfg.base;
    const o2 = c.createOscillator();
    o2.type = cfg.type;
    o2.frequency.value = cfg.fifth;
    o2.detune.value = 7;

    // a slow LFO modulates the filter for breathing
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = c.createGain();
    lfoG.gain.value = 90;

    lfo.connect(lfoG).connect(filter.frequency);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(out).connect(c.destination);

    o1.start(); o2.start(); lfo.start();
    ambientNodes = { o1, o2, lfo, out };
  }

  function stopAmbient(fadeSec) {
    if (!ambientNodes) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime + (fadeSec == null ? 0.8 : fadeSec);
    try {
      ambientNodes.out.gain.cancelScheduledValues(c.currentTime);
      ambientNodes.out.gain.setValueAtTime(ambientNodes.out.gain.value, c.currentTime);
      ambientNodes.out.gain.linearRampToValueAtTime(0, t);
    } catch (e) {}
    const nodes = ambientNodes;
    ambientNodes = null;
    setTimeout(() => {
      try { nodes.o1.stop(); nodes.o2.stop(); nodes.lfo.stop(); } catch (e) {}
    }, (fadeSec == null ? 900 : fadeSec * 1000 + 50));
  }

  attachUnlock();

  return { setGame, play, enabled, startAmbient, stopAmbient };
})();
