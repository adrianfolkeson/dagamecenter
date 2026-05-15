// ---------------------------------------------------------------------------
// Fishing — a tiny "cast at the right moment" mini-game opened at Marlowe's
// pool. A cloud-fish silhouette drifts left-right; a bright catch-band sits
// in the middle of the line. Click or press Space when the fish overlaps
// the band. No fail state — every cast yields *something* (Pearlfruit if
// hit, a friendly puff of dust if not).
// ---------------------------------------------------------------------------

window.Fishing = (function () {
  let game = null;
  let raf = null;
  let state = null;
  let canvas = null;

  function setGame(g) { game = g; }

  // Reward tables — first cast each session leans generous, later casts
  // average to a small Pearlfruit-or-dust outcome.
  const REWARDS = {
    perfect: [
      { kind: 'food', id: 'pearlfruit', count: 2, label: '+2 Pearlfruit' },
      { kind: 'food', id: 'iceberry',   count: 1, label: '+1 Iceberry' },
      { kind: 'dust', count: 18, label: '+18 sparkledust' },
    ],
    good: [
      { kind: 'food', id: 'pearlfruit', count: 1, label: '+1 Pearlfruit' },
      { kind: 'dust', count: 10, label: '+10 sparkledust' },
    ],
    splash: [
      { kind: 'dust', count: 4, label: '+4 sparkledust — a sparkle of foam' },
      { kind: 'dust', count: 6, label: '+6 sparkledust — the wind helped' },
    ],
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function open() {
    const body = document.getElementById('fishing-body');
    body.innerHTML = `
      <div class="fishing-wrap">
        <canvas id="fishing-canvas" width="600" height="220"
                style="display:block; border-radius:14px;
                       background: linear-gradient(180deg, #d4ecf2 0%, #a8c8d8 60%, #7aa8b8 100%);
                       box-shadow: inset 0 2px 10px rgba(0,0,0,.18), 0 4px 0 var(--paper-shade);"></canvas>
        <div class="fishing-hint" id="fishing-hint">Press <kbd>Space</kbd> or tap the water when the cloud-fish is in the band.</div>
        <div class="fishing-actions">
          <button class="btn-primary" id="fishing-cast">Cast</button>
          <button class="btn-ghost"  id="fishing-leave">Pack up</button>
        </div>
      </div>
    `;

    canvas = document.getElementById('fishing-canvas');
    state = {
      t: 0,
      fishX: 60,
      dir: 1,
      speed: 130,           // px/sec
      bandX: 300,
      bandW: 70,
      casting: false,
      result: null,
      lastT: performance.now(),
    };

    document.getElementById('modal-fishing').classList.add('show');
    Input.clear();

    document.getElementById('fishing-cast').addEventListener('click', cast);
    document.getElementById('fishing-leave').addEventListener('click', close);
    canvas.addEventListener('click', cast);

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    window.addEventListener('keydown', onKey);
  }

  function close() {
    document.getElementById('modal-fishing').classList.remove('show');
    cancelAnimationFrame(raf);
    raf = null;
    state = null;
    window.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      cast();
    } else if (e.key === 'Escape') {
      close();
    }
  }

  function cast() {
    if (!state || state.casting) return;
    state.casting = true;

    const dist = Math.abs(state.fishX - state.bandX);
    let tier;
    if (dist < 14) tier = 'perfect';
    else if (dist < state.bandW / 2) tier = 'good';
    else tier = 'splash';

    const reward = pick(REWARDS[tier]);
    state.result = { tier, reward };

    applyReward(reward);
    if (tier !== 'splash') {
      game.save.flags = game.save.flags || {};
      game.save.flags.caughtCloudfish = true;
      Save.save(game.save);
      if (window.Stickers) Stickers.scan();
    }
    if (window.Sound) Sound.play(tier === 'splash' ? 'pet' : 'catch');

    const hint = document.getElementById('fishing-hint');
    hint.innerHTML = `
      <b>${tier === 'perfect' ? 'A clean catch!'
          : tier === 'good'    ? 'Got one!'
          : 'Just a splash of foam.'}</b> ${reward.label}
    `;
    document.getElementById('fishing-cast').textContent = 'Cast again';

    // brief pause then reset for another cast
    setTimeout(() => {
      if (!state) return;
      state.casting = false;
    }, 700);
  }

  function applyReward(reward) {
    if (reward.kind === 'food') {
      game.save.inventory = game.save.inventory || {};
      game.save.inventory[reward.id] = (game.save.inventory[reward.id] || 0) + reward.count;
    } else if (reward.kind === 'dust') {
      game.save.dust += reward.count;
    }
    Save.save(game.save);
    UI.updateHUD();
  }

  function loop(now) {
    if (!state) return;
    // self-close if global Esc dropped the modal
    if (!document.getElementById('modal-fishing').classList.contains('show')) {
      close();
      return;
    }
    const dt = Math.min(0.05, (now - state.lastT) / 1000);
    state.lastT = now;

    // bounce fish
    state.fishX += state.dir * state.speed * dt;
    if (state.fishX < 40)   { state.fishX = 40;   state.dir = 1;  }
    if (state.fishX > 560)  { state.fishX = 560;  state.dir = -1; }

    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);

    // soft ripples
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const yy = 80 + i * 30 + Math.sin(performance.now() * 0.001 + i) * 3;
      c.beginPath();
      c.moveTo(0, yy);
      for (let x = 0; x <= W; x += 30) {
        c.lineTo(x, yy + Math.sin(x * 0.04 + i) * 3);
      }
      c.stroke();
    }

    // catch-band
    const by = 110;
    const bx = state.bandX - state.bandW / 2;
    const grad = c.createLinearGradient(bx, by - 40, bx + state.bandW, by + 40);
    grad.addColorStop(0, 'rgba(255,245,200,0)');
    grad.addColorStop(0.5, 'rgba(255,245,200,0.9)');
    grad.addColorStop(1, 'rgba(255,245,200,0)');
    c.fillStyle = grad;
    c.fillRect(bx, by - 50, state.bandW, 100);
    // band centre marker
    c.strokeStyle = '#fdf3c4';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(state.bandX, by - 50);
    c.lineTo(state.bandX, by + 50);
    c.stroke();

    // cloud-fish — fluffy oval with a tail
    const fx = state.fishX;
    const fy = by;
    c.save();
    c.translate(fx, fy);
    if (state.dir < 0) c.scale(-1, 1);
    // body
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
    c.fill();
    // wisps
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(-10, -6, 10, 7, 0, 0, Math.PI * 2);
    c.ellipse(10,  -4, 9,  6, 0, 0, Math.PI * 2);
    c.fill();
    // tail
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    c.moveTo(-22, 0);
    c.lineTo(-36, -8);
    c.lineTo(-36, 8);
    c.closePath();
    c.fill();
    // eye
    c.fillStyle = '#3a4a6a';
    c.beginPath();
    c.arc(14, -2, 1.6, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // bobber on a line (above water)
    c.strokeStyle = '#5a4030';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(state.bandX, 0);
    c.lineTo(state.bandX, by - 56);
    c.stroke();
    c.fillStyle = '#d96a6a';
    c.beginPath();
    c.arc(state.bandX, by - 56, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff5dc';
    c.beginPath();
    c.arc(state.bandX, by - 56, 5, Math.PI, Math.PI * 2);
    c.fill();
  }

  return { setGame, open, close };
})();
