// ---------------------------------------------------------------------------
// Mini-game — constellation tracer. Triggered by talking to Astra at her
// telescope on Starpetal Peaks. Touch the stars in order; the line snaps in
// as you go. No fail state — wrong stars just refuse to light up.
// ---------------------------------------------------------------------------

window.Constellation = (function () {
  let game = null;

  function setGame(g) { game = g; }

  // Each constellation is a polyline through points in 0..1 normalised
  // space. Order matters — the player must click them in sequence.
  // Extra "decoy" stars are sprinkled around to make the puzzle a puzzle.
  const PATTERNS = [
    {
      id: 'owl',
      name: 'The Watchful Owl',
      flavour: 'Astra says the Owl keeps an eye on every lantern in the valley.',
      reward: 25,
      points: [
        { x: 0.30, y: 0.30 },
        { x: 0.42, y: 0.22 },
        { x: 0.55, y: 0.28 },
        { x: 0.60, y: 0.45 },
        { x: 0.50, y: 0.62 },
        { x: 0.36, y: 0.62 },
        { x: 0.28, y: 0.46 },
        { x: 0.30, y: 0.30 },
      ],
    },
    {
      id: 'lantern',
      name: 'The Keeper’s Lantern',
      flavour: 'A small lantern in the sky — a reminder that you carry one too.',
      reward: 25,
      points: [
        { x: 0.40, y: 0.20 },
        { x: 0.60, y: 0.20 },
        { x: 0.66, y: 0.36 },
        { x: 0.66, y: 0.60 },
        { x: 0.34, y: 0.60 },
        { x: 0.34, y: 0.36 },
        { x: 0.40, y: 0.20 },
      ],
    },
    {
      id: 'boat',
      name: 'The Tidesong Boat',
      flavour: 'Marlowe says fisherfolk used to steer by this one on quiet nights.',
      reward: 30,
      points: [
        { x: 0.22, y: 0.55 },
        { x: 0.78, y: 0.55 },
        { x: 0.70, y: 0.72 },
        { x: 0.30, y: 0.72 },
        { x: 0.22, y: 0.55 },
        { x: 0.50, y: 0.55 },
        { x: 0.50, y: 0.28 },
      ],
    },
  ];

  // Pick the next un-traced constellation, or rotate if all done.
  function nextPattern() {
    if (!game.save.flags.constellationsTraced) {
      game.save.flags.constellationsTraced = {};
    }
    const traced = game.save.flags.constellationsTraced;
    for (const p of PATTERNS) {
      if (!traced[p.id]) return p;
    }
    return PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  }

  let active = null;       // current pattern
  let progress = 0;        // index of next point expected
  let decoys = [];         // {x, y} extra stars
  let firstTry = true;

  function open() {
    active = nextPattern();
    progress = 0;
    firstTry = !game.save.flags.constellationsTraced[active.id];

    // sprinkle 10 decoy stars (deterministic-ish per pattern)
    decoys = [];
    let seed = active.id.charCodeAt(0) * 1103;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 10; i++) {
      decoys.push({ x: 0.1 + rand() * 0.8, y: 0.12 + rand() * 0.72 });
    }

    render();
    document.getElementById('modal-constellation').classList.add('show');
    Input.clear();
  }

  function close() {
    document.getElementById('modal-constellation').classList.remove('show');
    active = null;
  }

  function render() {
    const body = document.getElementById('constellation-body');
    const W = 640, H = 380;
    const realPts = active.points;

    // build SVG by hand — keeps everything self-contained
    const lines = [];
    for (let i = 0; i < progress - 1 && i < realPts.length - 1; i++) {
      const a = realPts[i];
      const b = realPts[i + 1];
      lines.push(
        `<line x1="${a.x * W}" y1="${a.y * H}" x2="${b.x * W}" y2="${b.y * H}" `
        + `stroke="#fdf3c4" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`
      );
    }
    const decoyDots = decoys.map(d =>
      `<circle cx="${d.x * W}" cy="${d.y * H}" r="1.6" fill="rgba(255,250,220,0.55)"/>`
    ).join('');
    const realDots = realPts.map((p, i) => {
      const lit = i < progress;
      const next = i === progress;
      const fill = lit ? '#fdf3c4' : (next ? '#fff5e8' : 'rgba(255,250,220,0.35)');
      const stroke = next ? '#ffe6a8' : 'none';
      const r = lit ? 5 : (next ? 6 : 3.5);
      return `<circle class="cstar" data-idx="${i}" cx="${p.x * W}" cy="${p.y * H}" r="${r}" `
        + `fill="${fill}" stroke="${stroke}" stroke-width="2" style="cursor:pointer;"/>`;
    }).join('');

    const done = progress >= realPts.length;
    const headline = done
      ? `<div class="constellation-done">${active.name} — traced!</div>`
      : `<div class="constellation-hint">Tap the brightest star, then follow Astra’s pointer.</div>`;

    body.innerHTML = `
      <div class="constellation-wrap">
        <div class="constellation-name">${active.name}</div>
        <div class="constellation-flavour">${active.flavour}</div>
        <div class="constellation-sky">
          <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"
               style="display:block; border-radius:12px; background:
                 radial-gradient(circle at 70% 28%, #4a4080 0%, #1f1c3a 70%, #15102a 100%);">
            ${decoyDots}
            ${lines}
            ${realDots}
          </svg>
        </div>
        ${headline}
        <div class="constellation-actions">
          ${done
            ? `<button class="btn-primary" id="cgame-next">${
                PATTERNS.every(p => game.save.flags.constellationsTraced[p.id])
                  ? 'Goodnight'
                  : 'Trace another'
              }</button>`
            : `<button class="btn-ghost" id="cgame-give">Ask Astra for another night</button>`}
        </div>
      </div>
    `;

    body.querySelectorAll('.cstar').forEach(el => {
      el.addEventListener('click', () => onStarClick(parseInt(el.dataset.idx, 10)));
    });
    const next = body.querySelector('#cgame-next');
    if (next) next.addEventListener('click', () => {
      if (PATTERNS.every(p => game.save.flags.constellationsTraced[p.id])) {
        close();
      } else {
        open();   // start the next un-traced one
      }
    });
    const give = body.querySelector('#cgame-give');
    if (give) give.addEventListener('click', close);
  }

  function onStarClick(idx) {
    if (idx === progress) {
      progress++;
      if (window.Sound) Sound.play('chime');
      if (progress >= active.points.length) {
        // completed
        if (!game.save.flags.constellationsTraced[active.id]) {
          game.save.flags.constellationsTraced[active.id] = Date.now();
          if (firstTry) {
            game.save.dust += active.reward;
            UI.toast(`+${active.reward} sparkledust — ${active.name} traced!`, '#fdf3c4');
          }
          Save.save(game.save);
          UI.updateHUD();
          if (window.Sound) Sound.play('festival');
        }
      }
      render();
    } else {
      // wrong star — gentle wobble, no penalty
      if (window.Sound) Sound.play('pet');
    }
  }

  function allDone() {
    if (!game || !game.save.flags.constellationsTraced) return false;
    return PATTERNS.every(p => game.save.flags.constellationsTraced[p.id]);
  }

  return { setGame, open, close, allDone };
})();
