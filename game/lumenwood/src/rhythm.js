// ---------------------------------------------------------------------------
// Bubble-rhythm — a tiny note-tap minigame. Notes drift down four tracks; tap
// the matching key (A/S/D/F or click the lane) when each note crosses the
// catch-line. Score scales with hits; the player walks away with sparkledust
// proportional to performance. No fail state.
// ---------------------------------------------------------------------------

window.Rhythm = (function () {
  let game = null;
  let raf = null;
  let state = null;
  let canvas = null;

  const LANES = 4;
  const W = 480;
  const H = 360;
  const CATCH_Y = 300;
  const HIT_WINDOW = 32;          // pixels around catch-y considered a hit
  const NOTE_SPEED = 220;         // px/sec
  const LANE_KEYS = ['a', 's', 'd', 'f'];

  function setGame(g) { game = g; }

  function open() {
    state = {
      notes: [],
      score: 0,
      perfect: 0,
      hits: 0,
      misses: 0,
      total: 24,                  // number of notes in a round
      spawned: 0,
      lastSpawn: 0,
      lastT: performance.now(),
      doneAt: null,
      lanePulse: [0, 0, 0, 0],
      ended: false,
    };
    renderShell();
    document.getElementById('modal-rhythm').classList.add('show');
    Input.clear();
    window.addEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    document.getElementById('modal-rhythm').classList.remove('show');
    window.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    raf = null;
    state = null;
  }

  function renderShell() {
    const body = document.getElementById('rhythm-body');
    body.innerHTML = `
      <div class="rhythm-wrap">
        <canvas id="rhythm-canvas" width="${W}" height="${H}"
                style="display:block; border-radius:14px;
                       background: linear-gradient(180deg, #efe2c0 0%, #d8c79a 100%);
                       box-shadow: inset 0 2px 10px rgba(0,0,0,.15), 0 4px 0 var(--paper-shade);"></canvas>
        <div class="rhythm-hint">Tap <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> as the bubbles hit the line.</div>
        <div class="rhythm-actions">
          <button class="btn-ghost" id="rhythm-quit">Stop practising</button>
        </div>
      </div>
    `;
    canvas = document.getElementById('rhythm-canvas');
    canvas.addEventListener('click', (e) => {
      // map click x to lane
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const lane = Math.min(LANES - 1, Math.max(0, Math.floor(x / (W / LANES))));
      tryHit(lane);
    });
    document.getElementById('rhythm-quit').addEventListener('click', close);
  }

  function onKey(e) {
    if (!state) return;
    const k = e.key.toLowerCase();
    const lane = LANE_KEYS.indexOf(k);
    if (lane >= 0) { e.preventDefault(); tryHit(lane); }
    else if (e.key === 'Escape') close();
  }

  function tryHit(lane) {
    if (!state || state.ended) return;
    state.lanePulse[lane] = 1;
    // find the closest note in this lane near CATCH_Y
    let best = null;
    let bestDist = Infinity;
    for (const n of state.notes) {
      if (n.lane !== lane || n.dead) continue;
      const d = Math.abs(n.y - CATCH_Y);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    if (best && bestDist < HIT_WINDOW) {
      best.dead = true;
      state.hits++;
      if (bestDist < 10) { state.score += 12; state.perfect++; }
      else                 state.score += 6;
      if (window.Sound) Sound.play('chime');
    } else {
      // wrong tap — no penalty, just a soft thunk
      if (window.Sound) Sound.play('pet');
    }
  }

  function loop(now) {
    if (!state) return;
    if (!document.getElementById('modal-rhythm').classList.contains('show')) {
      close();
      return;
    }
    const dt = Math.min(0.05, (now - state.lastT) / 1000);
    state.lastT = now;

    // spawn notes at a steady cadence
    if (state.spawned < state.total) {
      state.lastSpawn += dt;
      if (state.lastSpawn > 0.55) {
        state.lastSpawn = 0;
        state.notes.push({
          lane: Math.floor(Math.random() * LANES),
          y: -20,
          dead: false,
        });
        state.spawned++;
      }
    }

    // move notes
    for (const n of state.notes) {
      if (n.dead) continue;
      n.y += NOTE_SPEED * dt;
      if (n.y > CATCH_Y + HIT_WINDOW) {
        n.dead = true;
        state.misses++;
      }
    }

    // lane pulse decay
    for (let i = 0; i < LANES; i++) state.lanePulse[i] *= 0.92;

    // end condition
    if (!state.ended && state.spawned >= state.total &&
        state.notes.every(n => n.dead)) {
      state.ended = true;
      finish();
    }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    const reward = Math.max(10, Math.round(state.score * 0.5));
    game.save.dust += reward;
    game.save.flags = game.save.flags || {};
    game.save.flags.rhythmDone = true;
    Save.save(game.save);
    UI.updateHUD();
    if (window.Stickers) Stickers.scan();
    UI.toast(`Practice over — +${reward} sparkledust (${state.hits} hits)`, '#a8d6d2');
    if (window.Sound) Sound.play('festival');
    // overlay summary banner
    setTimeout(() => close(), 1600);
  }

  function draw() {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, W, H);

    // lane dividers
    c.strokeStyle = 'rgba(120,90,60,0.25)';
    c.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      const x = i * (W / LANES);
      c.beginPath();
      c.moveTo(x, 0); c.lineTo(x, H);
      c.stroke();
    }

    // catch line
    c.strokeStyle = '#5a4030';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, CATCH_Y);
    c.lineTo(W, CATCH_Y);
    c.stroke();

    // lane key labels + pulse glow
    for (let i = 0; i < LANES; i++) {
      const cx = (i + 0.5) * (W / LANES);
      const pulse = state.lanePulse[i];
      c.save();
      c.fillStyle = `rgba(255,217,122,${0.18 + pulse * 0.6})`;
      c.fillRect(i * (W / LANES) + 2, CATCH_Y - 20, (W / LANES) - 4, 40);
      c.fillStyle = '#5a4030';
      c.font = 'bold 18px Fredoka, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(LANE_KEYS[i].toUpperCase(), cx, CATCH_Y + 38);
      c.restore();
    }

    // notes (bubbles)
    for (const n of state.notes) {
      if (n.dead) continue;
      const cx = (n.lane + 0.5) * (W / LANES);
      c.save();
      // outer bubble
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, n.y, 14, 0, Math.PI * 2);
      c.stroke();
      // fill
      const grad = c.createRadialGradient(cx - 4, n.y - 4, 1, cx, n.y, 14);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(168,216,224,0.45)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(cx, n.y, 13, 0, Math.PI * 2);
      c.fill();
      // highlight
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.arc(cx - 4, n.y - 4, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // score
    c.fillStyle = '#4a3a2c';
    c.font = 'bold 14px Fredoka, system-ui';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(`Score: ${state.score}`, 12, 10);
    c.fillText(`Hits: ${state.hits}  Misses: ${state.misses}`, 12, 30);
    const left = Math.max(0, state.total - state.spawned);
    c.textAlign = 'right';
    c.fillText(`${left} to go`, W - 12, 10);
  }

  return { setGame, open, close };
})();
