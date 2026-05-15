// ---------------------------------------------------------------------------
// Cooking — the kitchen station in the treehouse.
//
// Flow:
//   1. Player opens the kitchen modal.
//   2. Pick two ingredients from their inventory (visual chip select).
//   3. Click "Start Cooking" — a circular timing spinner appears with a green
//      "sweet spot" arc. Player presses Space (or the big Stir button) when
//      the marker is in the green zone.
//   4. Accuracy decides outcome quality (perfect / good / okay). All outcomes
//      add a food to inventory — there is no fail state.
//   5. If the two ingredients match a known recipe, you get the recipe's
//      named food; otherwise you get "Cloud Soup". Either way, fun.
// ---------------------------------------------------------------------------

window.Cooking = (function () {

  let game;
  let modal, body;
  let picked = [];           // array of food ids the player chose
  let raf = 0;               // animation handle for the spinner
  let spinner = null;        // active spinner state

  function setGame(g) { game = g; }

  function open() {
    modal = document.getElementById('modal-cooking');
    body  = document.getElementById('cooking-body');
    picked = [];
    spinner = null;
    cancelAnimationFrame(raf);
    renderPicker();
    modal.classList.add('show');
    window.Input.clear();
  }

  function close() {
    cancelAnimationFrame(raf);
    spinner = null;
    if (modal) modal.classList.remove('show');
  }

  // ---------------------- Ingredient picker ------------------------------
  function renderPicker() {
    const inv = game.save.inventory || {};
    const owned = window.FOODS.filter(f =>
      // only ingredients you can cook with: not crafted outputs, in inventory
      !f.crafted && f.id !== 'cloud_soup' && (inv[f.id] || 0) > 0);
    body.innerHTML = '';

    // header
    const head = document.createElement('div');
    head.className = 'cook-head';
    head.innerHTML = `
      <div class="cook-instr">
        <h3>Pick two ingredients</h3>
        <div class="hint">Mix favourites or experiment \u2014 every combination cooks <i>something</i>.</div>
      </div>
      <div class="slots">
        <div class="slot ${picked[0] ? 'filled' : ''}" data-slot="0">${slotInner(picked[0])}</div>
        <div class="plus">+</div>
        <div class="slot ${picked[1] ? 'filled' : ''}" data-slot="1">${slotInner(picked[1])}</div>
      </div>`;
    body.appendChild(head);

    // clicking a slot clears it
    head.querySelectorAll('.slot').forEach(el => {
      el.addEventListener('click', () => {
        const i = +el.dataset.slot;
        if (picked[i]) {
          picked[i] = undefined;
          renderPicker();
        }
      });
    });

    // recipe hint if both slots filled
    if (picked[0] && picked[1]) {
      const r = window.findRecipe(picked[0], picked[1]);
      if (r && (!r.festival || game.save.flags.festivalActive)) {
        const hint = document.createElement('div');
        hint.className = 'recipe-hint';
        hint.innerHTML = `
          <div class="swatch" style="background:${r.color};box-shadow:0 0 12px ${r.accent};"></div>
          <div><b>${r.name}</b><div class="b">${r.blurb}</div></div>`;
        body.appendChild(hint);
      } else {
        const hint = document.createElement('div');
        hint.className = 'recipe-hint mystery';
        hint.innerHTML = `<div class="swatch unknown">?</div><div><b>Mystery combo</b><div class="b">Let\u2019s see what happens \u2014 nothing bad ever does.</div></div>`;
        body.appendChild(hint);
      }
      const startWrap = document.createElement('div');
      startWrap.style.textAlign = 'center';
      startWrap.style.marginTop = '14px';
      startWrap.innerHTML = `<button class="btn-primary" id="cook-start">Start Cooking</button>`;
      body.appendChild(startWrap);
      startWrap.querySelector('#cook-start').addEventListener('click', startSpinner);
    }

    // ingredient grid
    const gridHead = document.createElement('div');
    gridHead.className = 'grid-head';
    gridHead.textContent = owned.length ? 'In your basket' : 'Your basket is empty — pop by Pippa\u2019s stand first.';
    body.appendChild(gridHead);

    const grid = document.createElement('div');
    grid.className = 'ingredient-grid';
    for (const food of owned) {
      const count = inv[food.id];
      const usedHere = picked.filter(p => p === food.id).length;
      const remaining = count - usedHere;
      const card = document.createElement('button');
      card.className = 'ingredient-card' + (remaining <= 0 ? ' empty' : '');
      card.disabled = remaining <= 0;
      card.innerHTML = `
        <span class="swatch" style="background:${food.color};box-shadow:0 0 10px ${food.accent};"></span>
        <span class="name">${food.name}</span>
        <span class="qty">x${remaining}</span>`;
      card.addEventListener('click', () => {
        if (remaining <= 0) return;
        const slot = picked[0] == null ? 0 : (picked[1] == null ? 1 : null);
        if (slot == null) return;
        picked[slot] = food.id;
        renderPicker();
      });
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  function slotInner(foodId) {
    if (!foodId) return '<div class="slot-empty">empty</div>';
    const f = window.foodById(foodId);
    if (!f) return '';
    return `<span class="swatch" style="background:${f.color};box-shadow:0 0 14px ${f.accent};"></span><span class="name">${f.name}</span>`;
  }

  // ---------------------- Timing spinner ---------------------------------
  function startSpinner() {
    spinner = {
      angle: 0,
      speed: Math.PI * 1.4,       // rad/sec — about 1.4 turns/sec
      sweet: -Math.PI / 6,        // start angle of the sweet arc
      sweetWidth: Math.PI / 5,    // ~36 deg wide
      ticks: 0,                   // how many full revolutions
      done: false,
      result: null,
    };
    renderSpinner();
    raf = requestAnimationFrame(spinTick);
  }

  function renderSpinner() {
    body.innerHTML = `
      <div class="cook-stage">
        <div class="pot-row">
          <div class="ing-mini left">${slotInner(picked[0])}</div>
          <div class="pot-wrap">
            <canvas id="cook-spin" width="280" height="280"></canvas>
            <button class="stir-btn" id="cook-stir">Stir</button>
          </div>
          <div class="ing-mini right">${slotInner(picked[1])}</div>
        </div>
        <div class="cook-instr center">
          <h3>Stir when the marker hits the warm zone</h3>
          <div class="hint">Press <kbd>Space</kbd> or tap <b>Stir</b>. You get up to three chances.</div>
        </div>
        <div class="result-line" id="cook-result"></div>
      </div>`;
    spinner.attempts = 0;
    spinner.maxAttempts = 3;
    spinner.bestAcc = 0;

    document.getElementById('cook-stir').addEventListener('click', attemptStir);
    // listen for spacebar
    document.addEventListener('keydown', spinnerKey);
  }

  function spinnerKey(e) {
    if (!spinner || spinner.done) return;
    if (e.code === 'Space') {
      e.preventDefault();
      attemptStir();
    }
  }

  function spinTick(now) {
    if (!spinner || spinner.done) return;
    if (!spinner.lastT) spinner.lastT = now;
    const dt = (now - spinner.lastT) / 1000;
    spinner.lastT = now;
    spinner.angle += spinner.speed * dt;
    if (spinner.angle > Math.PI * 2) {
      spinner.angle -= Math.PI * 2;
      spinner.ticks++;
    }
    drawSpinner();
    raf = requestAnimationFrame(spinTick);
  }

  function drawSpinner() {
    const c = document.getElementById('cook-spin');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, r = 110;

    // pot shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 80, 80, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // outer ring
    ctx.fillStyle = '#f5ecd2';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // sweet arc
    ctx.strokeStyle = '#9bbf8e';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, spinner.sweet, spinner.sweet + spinner.sweetWidth);
    ctx.stroke();

    // edges
    ctx.strokeStyle = '#d8c79a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // pot inside
    const pot = ctx.createRadialGradient(cx, cy + 10, 30, cx, cy, 90);
    pot.addColorStop(0, '#e07654');
    pot.addColorStop(1, '#8b3a2a');
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.arc(cx, cy, 85, 0, Math.PI * 2);
    ctx.fill();

    // gentle steam
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 3; i++) {
      const t = performance.now() * 0.001 + i;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(t) * 20, cy - 70 - (t * 8 % 30), 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // marker
    const mx = cx + Math.cos(spinner.angle) * r;
    const my = cy + Math.sin(spinner.angle) * r;
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function attemptStir() {
    if (!spinner || spinner.done) return;
    spinner.attempts++;
    // accuracy: 1.0 at centre of sweet arc, 0 at edges, negative outside.
    const centre = spinner.sweet + spinner.sweetWidth / 2;
    // measure shortest angular distance
    let diff = ((spinner.angle - centre + Math.PI) % (Math.PI * 2)) - Math.PI;
    diff = Math.abs(diff);
    const half = spinner.sweetWidth / 2;
    const acc = Math.max(0, 1 - diff / half);
    if (acc > spinner.bestAcc) spinner.bestAcc = acc;

    const line = document.getElementById('cook-result');
    if (acc >= 0.7) {
      finish('perfect');
    } else if (acc >= 0.35) {
      finish('good');
      line.textContent = 'Nice stir!';
    } else {
      line.textContent = `Missed the warm zone (${spinner.attempts}/${spinner.maxAttempts})`;
      if (spinner.attempts >= spinner.maxAttempts) {
        finish(spinner.bestAcc >= 0.35 ? 'good' : 'okay');
      }
    }
  }

  function finish(quality) {
    spinner.done = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', spinnerKey);

    // resolve recipe
    const recipe = window.findRecipe(picked[0], picked[1]);
    const useFestivalCake = recipe && recipe.festival && !game.save.flags.festivalActive;
    let outputId = (recipe && !useFestivalCake) ? recipe.out : 'cloud_soup';

    // consume ingredients
    const inv = game.save.inventory;
    inv[picked[0]] = Math.max(0, (inv[picked[0]] || 1) - 1);
    inv[picked[1]] = Math.max(0, (inv[picked[1]] || 1) - 1);

    // perfect stir = 2 of the output; good = 1; okay = 1 but lower quality
    const yieldCount = (quality === 'perfect') ? 2 : 1;
    inv[outputId] = (inv[outputId] || 0) + yieldCount;

    game.save.flags = game.save.flags || {};
    game.save.flags.cookedAny = true;
    window.Save.save(game.save);
    window.UI.updateHUD();
    if (window.Stickers) Stickers.scan();

    const out = window.foodById(outputId);
    window.UI.toast(
      `${out.name} \u00d7 ${yieldCount} \u2014 ${quality === 'perfect' ? 'perfect stir!' : (quality === 'good' ? 'a fine batch' : 'turned out alright')}`,
      out.accent);

    // result card
    body.innerHTML = `
      <div class="cook-result-card">
        <div class="swatch-lg" style="background:${out.color};box-shadow:0 0 26px ${out.accent};"></div>
        <div class="result-text">
          <h3>${out.name} \u00d7 ${yieldCount}</h3>
          <div class="quality ${quality}">${quality}</div>
          <div class="b">${out.tasteNote || out.blurb || ''}</div>
        </div>
        <div class="result-actions">
          <button class="btn-primary small" id="cook-again">Cook another</button>
          <button class="btn-ghost" id="cook-done">Done for now</button>
        </div>
      </div>`;
    document.getElementById('cook-again').addEventListener('click', () => {
      picked = []; spinner = null; renderPicker();
    });
    document.getElementById('cook-done').addEventListener('click', close);
  }

  return { setGame, open, close };
})();
