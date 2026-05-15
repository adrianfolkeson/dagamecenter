// ---------------------------------------------------------------------------
// Interactions — Pass 2 systems
//
//  * Shop  : Pippa sells foods for sparkledust. Modal with item cards.
//  * Care  : tap on a lantern in the treehouse to feed / pet a Glim, see
//            their happiness, and collect any thank-you gift waiting for you.
//  * Happiness math: very slow real-time decay; feeding favourite gives a big
//            boost; petting gives a small boost; happy Glims produce a single
//            sparkledust "gift" once per session that you collect manually.
// ---------------------------------------------------------------------------

window.Interactions = (function () {

  let game;
  function setGame(g) { game = g; }

  // -------------------- Happiness helpers --------------------------------
  const HAPPINESS_DECAY_PER_HOUR = 0.05;   // gentle: takes 10h to go from 1 to 0.5
  const MIN_HAPPINESS = 0.15;              // never below this; no sad Glims
  const GIFT_COOLDOWN_MS = 1000 * 60 * 8;  // 8 min real-time between gifts
  const GIFT_HAPPINESS_THRESHOLD = 0.75;

  // Run on game boot: apply offline decay since last play, never below the floor.
  function applyOfflineDecay(save) {
    const now = Date.now();
    if (save.lastPlayed && save.lastPlayed > 0) {
      const hours = (now - save.lastPlayed) / (1000 * 60 * 60);
      const drop = Math.min(0.5, hours * HAPPINESS_DECAY_PER_HOUR);
      for (const id in save.caught) {
        const c = save.caught[id];
        c.happiness = Math.max(MIN_HAPPINESS, (c.happiness || 0.7) - drop);
      }
    }
    save.lastPlayed = now;
  }

  // Per-frame happiness tick — only used for live decay during long sessions.
  let _decayAccum = 0;
  function tickHappiness(dt, save) {
    _decayAccum += dt;
    if (_decayAccum < 30) return;        // every ~30s
    _decayAccum = 0;
    const drop = (30 / 3600) * HAPPINESS_DECAY_PER_HOUR;
    for (const id in save.caught) {
      const c = save.caught[id];
      c.happiness = Math.max(MIN_HAPPINESS, (c.happiness || 0.7) - drop);
    }
    save.lastPlayed = Date.now();
    window.Save.save(save);
  }

  // Check whether a Glim has a thank-you gift ready.
  function hasGiftReady(caughtRec) {
    if (!caughtRec) return false;
    if (caughtRec.happiness < GIFT_HAPPINESS_THRESHOLD) return false;
    if (caughtRec.lastGift && (Date.now() - caughtRec.lastGift) < GIFT_COOLDOWN_MS) return false;
    return true;
  }

  // -------------------- Feeding / petting --------------------------------
  function feed(glimDef, foodId) {
    const save = game.save;
    const c = save.caught[glimDef.id];
    if (!c) return null;
    const have = save.inventory[foodId] || 0;
    if (have <= 0) return null;
    save.inventory[foodId] = have - 1;
    const food = window.foodById(foodId);
    // A Glim "loves" a food if its name matches def.food (the personality
    // favourite) OR the food's lovedBy list explicitly includes the Glim
    // (which is how crafted recipes opt-in multiple fans).
    const isFav = !!food && (
      food.name === glimDef.food ||
      (Array.isArray(food.lovedBy) && food.lovedBy.includes(glimDef.id))
    );
    const boost = isFav ? 0.35 : 0.08;
    c.happiness = Math.min(1, (c.happiness || 0.7) + boost);
    window.Save.save(save);
    window.UI.updateHUD();
    return {
      food,
      isFav,
      reaction: isFav
        ? `${glimDef.name} LOVES ${food.name}! Their light glows brighter.`
        : `${glimDef.name} nibbled the ${food.name}. ${food.tasteNote}`,
    };
  }

  function pet(glimDef) {
    const save = game.save;
    const c = save.caught[glimDef.id];
    if (!c) return null;
    const now = Date.now();
    if (c.lastPet && (now - c.lastPet) < 1000 * 20) {
      // too soon — don't decay, just no boost
      return { reaction: `${glimDef.name} is content. Maybe later.` };
    }
    c.lastPet = now;
    c.happiness = Math.min(1, (c.happiness || 0.7) + 0.05);
    window.Save.save(save);
    return { reaction: `${glimDef.name} bobs happily.` };
  }

  function collectGift(glimDef) {
    const save = game.save;
    const c = save.caught[glimDef.id];
    if (!hasGiftReady(c)) return null;
    const dust = 3 + Math.floor(Math.random() * 4);   // 3..6
    save.dust += dust;
    c.lastGift = Date.now();
    window.Save.save(save);
    window.UI.updateHUD();
    return dust;
  }

  // -------------------- Shop --------------------------------------------
  function openShop() {
    const m = document.getElementById('modal-shop');
    renderShop();
    m.classList.add('show');
    window.Input.clear();
    if (!game.save.flags.metPippa) {
      game.save.flags.metPippa = true;
      window.Save.save(game.save);
    }
  }
  function closeShop() {
    document.getElementById('modal-shop').classList.remove('show');
  }

  function renderShop() {
    const body = document.getElementById('shop-body');
    const dust = game.save.dust;
    body.innerHTML = '';

    // ---- Bubble Practice teaser ----
    if (window.Rhythm) {
      const head = document.createElement('div');
      head.className = 'shop-section-head';
      head.innerHTML = `
        <h3>Bubble Practice</h3>
        <div class="sub">A small song of bubbles — keep up with the beat for sparkledust.</div>
      `;
      body.appendChild(head);
      const btn = document.createElement('button');
      btn.className = 'btn-primary small';
      btn.textContent = 'Start practising';
      btn.style.marginBottom = '14px';
      btn.addEventListener('click', () => {
        closeShop();
        setTimeout(() => Rhythm.open(), 120);
      });
      body.appendChild(btn);
    }

    // ---- Foods section ----
    const foodHead = document.createElement('div');
    foodHead.className = 'shop-section-head';
    foodHead.innerHTML = '<h3>Foods</h3><div class="sub">Each Glim has a favourite.</div>';
    body.appendChild(foodHead);

    const items = window.FOODS.filter(f => f.seller === 'pippa');

    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    for (const food of items) {
      const card = document.createElement('div');
      card.className = 'shop-card';
      const canAfford = dust >= food.price;
      // who loves this food (helpful hint, only if discovered)
      const fan = window.GLIMS.find(g => g.food === food.name &&
                                         game.save.caught[g.id]);
      const fanLine = fan ? `<div class="fan">${fan.name}\u2019s favourite</div>` : '';

      card.innerHTML = `
        <div class="swatch" style="background:${food.color};box-shadow:0 0 18px ${food.accent};"></div>
        <div class="name">${food.name}</div>
        ${fanLine}
        <div class="price"><span class="dust-dot"></span>${food.price}</div>
      `;
      const btn = document.createElement('button');
      btn.className = 'buy-btn' + (canAfford ? '' : ' disabled');
      btn.textContent = canAfford ? 'Buy' : 'Not enough';
      btn.disabled = !canAfford;
      btn.addEventListener('click', () => {
        if (!canAfford) return;
        game.save.dust -= food.price;
        game.save.inventory[food.id] = (game.save.inventory[food.id] || 0) + 1;
        window.Save.save(game.save);
        window.UI.updateHUD();
        renderShop();
        window.UI.toast(`Bought ${food.name}`, food.accent);
      });
      card.appendChild(btn);
      grid.appendChild(card);
    }
    body.appendChild(grid);

    // ---- Seeds section ----
    if (window.SEEDS && window.SEEDS.length) {
      const seedHead = document.createElement('div');
      seedHead.className = 'shop-section-head';
      seedHead.innerHTML = '<h3>Seeds</h3><div class="sub">Plant in the garden behind your treehouse.</div>';
      body.appendChild(seedHead);

      const sgrid = document.createElement('div');
      sgrid.className = 'shop-grid';
      for (const seed of window.SEEDS) {
        const card = document.createElement('div');
        card.className = 'shop-card';
        const canAfford = dust >= seed.price;
        const food = window.foodById(seed.food);
        card.innerHTML = `
          <div class="swatch seed-swatch" style="background:${seed.color};box-shadow:0 0 14px ${seed.accent};">
            <span class="leaf-tip"></span>
          </div>
          <div class="name">${seed.name}</div>
          <div class="fan">Grows into ${food ? food.name : ''}</div>
          <div class="price"><span class="dust-dot"></span>${seed.price}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'buy-btn' + (canAfford ? '' : ' disabled');
        btn.textContent = canAfford ? 'Buy' : 'Not enough';
        btn.disabled = !canAfford;
        btn.addEventListener('click', () => {
          if (!canAfford) return;
          game.save.dust -= seed.price;
          game.save.inventory[seed.id] = (game.save.inventory[seed.id] || 0) + 1;
          window.Save.save(game.save);
          window.UI.updateHUD();
          renderShop();
          window.UI.toast(`Bought ${seed.name}`, seed.accent);
        });
        card.appendChild(btn);
        sgrid.appendChild(card);
      }
      body.appendChild(sgrid);
    }

    // ---- Decorations section ----
    if (window.DECOR && window.DECOR.length) {
      const decorHead = document.createElement('div');
      decorHead.className = 'shop-section-head';
      const tokens = (game.save.flags && game.save.flags.decorTokens) || 0;
      decorHead.innerHTML = `<h3>Decorations</h3>` +
        `<div class="sub">Hang them in your treehouse. ` +
        `You have <b>${tokens}</b> decor token${tokens === 1 ? '' : 's'} from your villagers.</div>`;
      body.appendChild(decorHead);

      const dgrid = document.createElement('div');
      dgrid.className = 'shop-grid';
      for (const item of window.DECOR) {
        const owned = !!(game.save.decor && game.save.decor[item.id]);
        const canAfford = dust >= item.price &&
          ((game.save.flags && (game.save.flags.decorTokens || 0)) >= (item.tokens || 0));
        const card = document.createElement('div');
        card.className = 'shop-card';
        const tokenLine = item.tokens
          ? `<div class="fan">+ ${item.tokens} decor token${item.tokens === 1 ? '' : 's'}</div>`
          : '';
        card.innerHTML = `
          <div class="swatch" style="background:${item.color};box-shadow:0 0 14px ${item.accent};"></div>
          <div class="name">${item.name}</div>
          <div class="fan">${item.desc}</div>
          ${tokenLine}
          <div class="price"><span class="dust-dot"></span>${item.price}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'buy-btn' + ((owned || !canAfford) ? ' disabled' : '');
        btn.textContent = owned ? 'Owned' : (canAfford ? 'Buy' : 'Not yet');
        btn.disabled = owned || !canAfford;
        btn.addEventListener('click', () => {
          if (owned || !canAfford) return;
          game.save.dust -= item.price;
          if (item.tokens) {
            game.save.flags.decorTokens = (game.save.flags.decorTokens || 0) - item.tokens;
          }
          game.save.decor = game.save.decor || {};
          game.save.decor[item.id] = true;
          window.Save.save(game.save);
          window.UI.updateHUD();
          renderShop();
          window.UI.toast(`Bought ${item.name}`, item.accent);
          if (window.Sound) Sound.play('chime');
        });
        card.appendChild(btn);
        dgrid.appendChild(card);
      }
      body.appendChild(dgrid);
    }
  }

  // -------------------- Lantern care --------------------------------------
  function openCare(glimDef) {
    const m = document.getElementById('modal-care');
    m.dataset.glimId = glimDef.id;
    renderCare(glimDef);
    m.classList.add('show');
    window.Input.clear();
  }
  function closeCare() {
    document.getElementById('modal-care').classList.remove('show');
  }

  function renderCare(glimDef) {
    const body = document.getElementById('care-body');
    const c = game.save.caught[glimDef.id];
    if (!c) return;
    body.innerHTML = '';

    // header — preview + name + happiness
    const head = document.createElement('div');
    head.className = 'care-head';
    const previewWrap = document.createElement('div');
    previewWrap.className = 'care-preview';
    const preview = document.createElement('canvas');
    preview.width = 120 * devicePixelRatio;
    preview.height = 120 * devicePixelRatio;
    preview.style.width = '120px';
    preview.style.height = '120px';
    const pctx = preview.getContext('2d');
    pctx.scale(devicePixelRatio, devicePixelRatio);
    window.Entities.drawGlimSprite(pctx, 60, 60, 24, glimDef,
                                   performance.now(),
                                   c.happiness > 0.5 ? 'happy' : null);
    previewWrap.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'care-info';
    const hPct = Math.round(c.happiness * 100);
    info.innerHTML = `
      <div class="care-name">${glimDef.name}</div>
      <div class="care-element">${glimDef.element} \u00b7 loves ${glimDef.food}</div>
      <div class="care-blurb">${glimDef.blurb}</div>
      <div class="care-happy">
        <div class="label">Happiness</div>
        <div class="bar"><div style="width:${hPct}%; background:${glimDef.glow};"></div></div>
        <div class="value">${hPct}%</div>
      </div>
    `;
    head.appendChild(previewWrap);
    head.appendChild(info);
    body.appendChild(head);

    // gift section if available
    if (hasGiftReady(c)) {
      const gift = document.createElement('div');
      gift.className = 'care-gift';
      gift.innerHTML = `
        <div class="gift-icon">\u2728</div>
        <div class="gift-text">
          <b>${glimDef.name} has a gift for you!</b>
          <div>A little pile of sparkledust, just for being kind.</div>
        </div>
        <button class="btn-primary small">Collect</button>
      `;
      gift.querySelector('button').addEventListener('click', () => {
        const dust = collectGift(glimDef);
        if (dust != null) {
          window.UI.toast(`+${dust} sparkledust from ${glimDef.name}`, glimDef.glow);
          renderCare(glimDef);
        }
      });
      body.appendChild(gift);
    }

    // action row: feed (opens food picker), pet, close
    const actions = document.createElement('div');
    actions.className = 'care-actions';
    actions.innerHTML = `
      <button class="action-btn feed">
        <div class="icon">\ud83c\udf52</div>
        <div class="label">Feed</div>
      </button>
      <button class="action-btn pet">
        <div class="icon">\u270b</div>
        <div class="label">Pet</div>
      </button>
    `;
    actions.querySelector('.feed').addEventListener('click', () => showFeedPicker(glimDef));
    actions.querySelector('.pet').addEventListener('click', () => {
      const out = pet(glimDef);
      if (out) window.UI.flashCareMessage(out.reaction);
      renderCare(glimDef);
    });
    body.appendChild(actions);

    // feed picker placeholder
    const picker = document.createElement('div');
    picker.id = 'feed-picker';
    body.appendChild(picker);

    // reaction text
    const reaction = document.createElement('div');
    reaction.id = 'care-reaction';
    reaction.className = 'care-reaction';
    body.appendChild(reaction);
  }

  function showFeedPicker(glimDef) {
    const picker = document.getElementById('feed-picker');
    const inv = game.save.inventory;
    const owned = window.FOODS.filter(f => (inv[f.id] || 0) > 0);
    picker.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'picker-header';
    header.textContent = owned.length
      ? 'Pick something tasty:'
      : 'No food yet. Visit Pippa\u2019s stand in Mossroot Hollow.';
    picker.appendChild(header);

    if (!owned.length) return;

    const row = document.createElement('div');
    row.className = 'picker-row';
    for (const food of owned) {
      const b = document.createElement('button');
      b.className = 'food-chip';
      b.innerHTML = `
        <span class="swatch" style="background:${food.color};box-shadow:0 0 10px ${food.accent};"></span>
        <span class="name">${food.name}</span>
        <span class="qty">x${inv[food.id]}</span>
      `;
      b.addEventListener('click', () => {
        const out = feed(glimDef, food.id);
        if (out) window.UI.flashCareMessage(out.reaction);
        renderCare(glimDef);
      });
      row.appendChild(b);
    }
    picker.appendChild(row);
  }

  // -------------------- Lantern proximity ---------------------------------
  // Given a treehouse scene + player position, return the nearest lantern
  // (and its associated Glim def, if caught) within an interaction radius.
  function nearestLantern(scene, player) {
    if (scene.id !== 'treehouse') return null;
    let best = null, bestD = 90;   // 90px reach
    const slots = scene.lanternSlots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const glim = window.GLIMS[i];
      if (!glim) continue;
      const caught = game.save.caught[glim.id];
      if (!caught) continue;
      // measure from the Glim float position (y + 60)
      const d = Math.hypot(s.x - player.x, (s.y + 60) - player.y);
      if (d < bestD) { bestD = d; best = { slot: s, glim, caught }; }
    }
    return best;
  }

  return {
    setGame, applyOfflineDecay, tickHappiness,
    hasGiftReady,
    openShop, closeShop,
    openCare, closeCare,
    nearestLantern,
    feed, pet, collectGift,
  };
})();
