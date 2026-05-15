// ---------------------------------------------------------------------------
// UI — HUD, journal, settings, intro modal, dialog box, toast.
// Most UI is plain HTML overlaid on the canvas; we just bind events here.
// ---------------------------------------------------------------------------

window.UI = (function () {

  let game;   // injected by setGame() so we can read/write state

  function setGame(g) { game = g; }

  // =========================================================================
  // Toasts — fleeting "you caught a Glim!" style messages.
  // =========================================================================
  function toast(text, color) {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="swatch" style="background:${color || '#ffd97a'};color:${color || '#ffd97a'};"></span>${text}`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3300);
    if (window.Speech) Speech.say(text);
  }

  // =========================================================================
  // Action prompt — appears at bottom of frame near portals / interactables.
  // =========================================================================
  function setPrompt(text, key) {
    const el = document.getElementById('prompt');
    if (!text) { el.classList.remove('show'); return; }
    el.innerHTML = `${text} <kbd>${key || 'E'}</kbd>`;
    el.classList.add('show');
  }

  // =========================================================================
  // HUD updates — sparkledust counter + scene name.
  // =========================================================================
  function updateHUD() {
    document.getElementById('dust-count').textContent = game.save.dust;
    document.getElementById('caught-count').textContent =
      Object.keys(game.save.caught).length + '/' + window.GLIMS.length;
    document.getElementById('scene-name').textContent = game.scene.name;
    // inventory chip: show top 3 distinct items + total
    const inv = game.save.inventory || {};
    const owned = Object.keys(inv).filter(k => inv[k] > 0);
    const invChip = document.getElementById('hud-inventory');
    if (invChip) {
      if (owned.length === 0) {
        invChip.style.display = 'none';
      } else {
        invChip.style.display = 'inline-flex';
        const total = owned.reduce((s, k) => s + inv[k], 0);
        const swatches = owned.slice(0, 4).map(id => {
          // could be a food or a seed
          const f = window.foodById(id) || (window.seedById ? window.seedById(id) : null);
          if (!f) return '';
          return `<span class="swatch-dot" title="${f.name} \u00d7 ${inv[id]}" style="background:${f.color};box-shadow:0 0 8px ${f.accent};"></span>`;
        }).join('');
        invChip.querySelector('.swatches').innerHTML = swatches;
        invChip.querySelector('.total').textContent = total + ' in basket';
      }
    }
  }

  // Flash a small message inside the care modal (used by Interactions).
  function flashCareMessage(text) {
    const el = document.getElementById('care-reaction');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // =========================================================================
  // Intro modal
  // =========================================================================
  function openIntro() {
    const m = document.getElementById('modal-intro');
    m.classList.add('show');
    Input.clear();
  }
  function closeIntro() {
    document.getElementById('modal-intro').classList.remove('show');
    game.save.firstRun = false;
    Save.save(game.save);
    // first-time customization
    if (!game.save.appearance) openCustomize();
  }

  // =========================================================================
  // Character customization
  // =========================================================================
  const SKIN_TONES   = ['#f6dcc0', '#f0c8a0', '#e0a878', '#b88454', '#8a5a36', '#5a3820'];
  const HAIR_COLORS  = ['#2a1a0e', '#5a3820', '#8b5a2a', '#d4a85a', '#e0d4a8', '#a8a4a0', '#c87a64', '#5a4a82'];
  const HAIR_STYLES  = ['short', 'long', 'curly', 'bald'];
  const OUTFIT_COLORS = ['#6b9166', '#7088a8', '#d96a6a', '#d4a85a', '#8b7aa8', '#3a5a4a', '#c89270', '#a07050'];
  const HAT_COLORS    = ['#d96a6a', '#3a5a78', '#6b9166', '#d4a85a', '#5a4a82', '#a07050', '#fff5dc'];

  function openCustomize() {
    const cur = Object.assign(
      { skin: SKIN_TONES[1], hair: HAIR_COLORS[1], hairStyle: 'short',
        outfit: OUTFIT_COLORS[0], hat: HAT_COLORS[0] },
      game.save.appearance || {}
    );
    renderCustomize(cur);
    document.getElementById('modal-customize').classList.add('show');
    Input.clear();
  }
  function closeCustomize() {
    document.getElementById('modal-customize').classList.remove('show');
  }
  function renderCustomize(cur) {
    const body = document.getElementById('customize-body');
    const swatch = (color, key, options) => options.map(o =>
      `<button class="cust-swatch ${cur[key] === o ? 'on' : ''}"
              style="background:${o};" data-cust="${key}" data-val="${o}"></button>`
    ).join('');
    const styleBtn = (label, val) =>
      `<button class="cust-style ${cur.hairStyle === val ? 'on' : ''}"
               data-cust="hairStyle" data-val="${val}">${label}</button>`;
    body.innerHTML = `
      <div class="cust-row"><div class="cust-label">Skin</div><div class="cust-swatches">${swatch(cur.skin, 'skin', SKIN_TONES)}</div></div>
      <div class="cust-row"><div class="cust-label">Hair colour</div><div class="cust-swatches">${swatch(cur.hair, 'hair', HAIR_COLORS)}</div></div>
      <div class="cust-row"><div class="cust-label">Hair style</div><div class="cust-swatches">
        ${HAIR_STYLES.map(s => styleBtn(s, s)).join('')}
      </div></div>
      <div class="cust-row"><div class="cust-label">Outfit</div><div class="cust-swatches">${swatch(cur.outfit, 'outfit', OUTFIT_COLORS)}</div></div>
      <div class="cust-row"><div class="cust-label">Hat</div><div class="cust-swatches">${swatch(cur.hat, 'hat', HAT_COLORS)}</div></div>
      <div class="cust-preview-wrap"><canvas id="cust-preview" width="120" height="160"></canvas></div>
      <div class="cust-actions">
        <button class="btn-primary" id="cust-save">Looking good</button>
      </div>
    `;
    body.querySelectorAll('button[data-cust]').forEach(b => {
      b.addEventListener('click', () => {
        cur[b.dataset.cust] = b.dataset.val;
        renderCustomize(cur);
      });
    });
    document.getElementById('cust-save').addEventListener('click', () => {
      game.save.appearance = cur;
      Save.save(game.save);
      closeCustomize();
    });
    drawCustomizePreview(cur);
  }
  function drawCustomizePreview(cur) {
    const can = document.getElementById('cust-preview');
    if (!can) return;
    const ctx = can.getContext('2d');
    ctx.clearRect(0, 0, can.width, can.height);
    const prev = game.save.appearance;
    game.save.appearance = cur;
    // fake player object so we can reuse drawPlayer
    const fakePlayer = { x: 60, y: 110, moving: false, bobPhase: 0, facing: 'right' };
    const fakeCam = { x: 0, y: 0, w: can.width, h: can.height };
    Entities.drawPlayer(ctx, fakePlayer, fakeCam, performance.now());
    game.save.appearance = prev;
  }

  // =========================================================================
  // Journal — auto-populates from the GLIMS list.
  // =========================================================================
  function openJournal() {
    const m = document.getElementById('modal-journal');
    const body = document.getElementById('journal-body');
    body.innerHTML = '';

    const total = window.GLIMS.length;
    const found = Object.keys(game.save.caught).length;
    const pct = Math.round(found / total * 100);

    // progress bar
    const prog = document.createElement('div');
    prog.className = 'journal-progress';
    prog.innerHTML = `
      <div class="count">${found}/${total}</div>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <div class="count">${pct}%</div>
    `;
    body.appendChild(prog);

    // grid
    const grid = document.createElement('div');
    grid.className = 'journal-grid';
    for (const def of window.GLIMS) {
      const caught = game.save.caught[def.id];
      const seen = game.save.seen[def.id];
      const card = document.createElement('div');
      card.className = 'journal-card ' + (caught ? 'found' : 'locked');

      const preview = document.createElement('canvas');
      preview.width  = 96 * window.devicePixelRatio;
      preview.height = 76 * window.devicePixelRatio;
      preview.style.width = '96px';
      preview.style.height = '76px';
      const pctx = preview.getContext('2d');
      pctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      if (caught) {
        Entities.drawGlimSprite(pctx, 48, 38, 18, def, performance.now(), 'happy');
      } else if (seen) {
        // half-revealed silhouette tinted in the glim color
        pctx.globalAlpha = 0.45;
        Entities.drawGlimSprite(pctx, 48, 38, 18, def, performance.now(), null);
      } else {
        pctx.fillStyle = '#3a2818';
        pctx.globalAlpha = 0.25;
        pctx.font = 'bold 36px Fredoka, system-ui';
        pctx.textAlign = 'center';
        pctx.textBaseline = 'middle';
        pctx.fillText('?', 48, 40);
      }

      const previewWrap = document.createElement('div');
      previewWrap.className = 'preview';
      previewWrap.appendChild(preview);
      card.appendChild(previewWrap);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = caught ? def.name : (seen ? def.name : '???');
      card.appendChild(name);

      const el = document.createElement('div');
      el.className = 'element';
      el.textContent = caught || seen ? def.element : '— — —';
      card.appendChild(el);

      const blurb = document.createElement('div');
      blurb.className = 'blurb';
      blurb.textContent = caught
        ? def.blurb
        : seen
          ? 'Spotted, but they slipped away. Try a bubble next time.'
          : 'Not yet discovered.';
      card.appendChild(blurb);

      if (caught) {
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.innerHTML = `<span><b>Loves</b> ${def.food}</span><span><b>Spot</b> ${def.spot}</span>`;
        card.appendChild(meta);
      }

      grid.appendChild(card);
    }
    body.appendChild(grid);

    m.classList.add('show');
    Input.clear();
  }
  function closeJournal() {
    document.getElementById('modal-journal').classList.remove('show');
  }

  // =========================================================================
  // Settings
  // =========================================================================
  function openSettings() {
    const m = document.getElementById('modal-settings');
    renderSettings();
    m.classList.add('show');
    Input.clear();
  }
  function closeSettings() {
    document.getElementById('modal-settings').classList.remove('show');
  }
  function renderSettings() {
    const body = document.getElementById('settings-body');
    const s = game.save.settings;
    body.innerHTML = `
      <div class="settings-list">
        <div class="settings-row">
          <div>
            <div class="label">Sound</div>
            <div class="desc">Wooden chimes and gentle ambience. Off by default.</div>
          </div>
          <button class="toggle ${s.sound ? 'on' : ''}" data-setting="sound" aria-label="Toggle sound"></button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Reduced motion</div>
            <div class="desc">Calms bobbing, drifting, and dust motes for sensitive viewers.</div>
          </div>
          <button class="toggle ${s.reducedMotion ? 'on' : ''}" data-setting="reducedMotion" aria-label="Toggle reduced motion"></button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Bigger text</div>
            <div class="desc">Makes journal and menu text larger.</div>
          </div>
          <button class="toggle ${s.bigText ? 'on' : ''}" data-setting="bigText" aria-label="Toggle big text"></button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Read aloud</div>
            <div class="desc">Speaks dialog and toasts. For pre-readers.</div>
          </div>
          <button class="toggle ${s.readAloud ? 'on' : ''}" data-setting="readAloud" aria-label="Toggle read aloud"></button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Change appearance</div>
            <div class="desc">Pick a new skin tone, hair, outfit, hat.</div>
          </div>
          <button class="btn-ghost" id="open-cust">Customize</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Start over</div>
            <div class="desc">Erase your save and begin a new Lumenwood. (Cannot be undone.)</div>
          </div>
          <button class="btn-ghost" id="wipe-save">Reset save</button>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Save slots</div>
            <div class="desc">Three independent Lumenwoods. Pick one to switch.</div>
          </div>
          <div class="slot-list">${renderSlots()}</div>
        </div>
        <div class="settings-row">
          <div>
            <div class="label">Export / import</div>
            <div class="desc">Copy or paste a save code to move it between devices.</div>
          </div>
          <div class="exim-actions">
            <button class="btn-ghost" id="exim-export">Copy save code</button>
            <button class="btn-ghost" id="exim-import">Paste save code</button>
          </div>
        </div>
      </div>
    `;
    body.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.setting;
        s[key] = !s[key];
        Save.save(game.save);
        applySettings();
        renderSettings();
      });
    });
    body.querySelector('#wipe-save').addEventListener('click', () => {
      Save.wipe();
      location.reload();
    });
    body.querySelectorAll('button[data-slot]').forEach(b => {
      b.addEventListener('click', () => {
        const i = parseInt(b.dataset.slot, 10);
        if (i === Save.activeSlot()) return;
        Save.switchSlot(i);
        location.reload();
      });
    });
    const exBtn = body.querySelector('#exim-export');
    if (exBtn) exBtn.addEventListener('click', async () => {
      const code = Save.exportActive();
      try {
        await navigator.clipboard.writeText(code);
        toast('Save code copied to clipboard.', '#b6dc8a');
      } catch (e) {
        prompt('Copy this save code:', code);
      }
    });
    const imBtn = body.querySelector('#exim-import');
    if (imBtn) imBtn.addEventListener('click', async () => {
      let code = '';
      try { code = await navigator.clipboard.readText(); }
      catch (e) { code = prompt('Paste your save code:') || ''; }
      if (!code) return;
      if (Save.importToActive(code.trim())) {
        toast('Save imported. Reloading…', '#ffd97a');
        setTimeout(() => location.reload(), 500);
      } else {
        toast('That code didn’t look right.', '#d96a6a');
      }
    });
    const openCust = body.querySelector('#open-cust');
    if (openCust) openCust.addEventListener('click', () => {
      closeSettings();
      openCustomize();
    });
  }
  function renderSlots() {
    const slots = Save.listSlots();
    const cur = Save.activeSlot();
    return slots.map(s => {
      const label = s.empty
        ? '<i>empty</i>'
        : `${s.caught}/${(window.GLIMS || []).length}, ${s.dust}✦`;
      const cls = (s.slot === cur ? 'on ' : '') + (s.empty ? 'empty ' : '');
      return `
        <button class="slot-btn ${cls}" data-slot="${s.slot}">
          <div class="slot-num">Slot ${s.slot + 1}</div>
          <div class="slot-meta">${label}</div>
        </button>`;
    }).join('');
  }

  function applySettings() {
    const s = game.save.settings;
    document.documentElement.style.setProperty('--ui-scale', s.bigText ? '1.15' : '1');
    if (window.Sound) {
      if (s.sound) Sound.startAmbient(game.sceneId);
      else Sound.stopAmbient(0.4);
    }
  }

  // =========================================================================
  // Dialog box (used for signposts / sparse narrative)
  // =========================================================================
  let dialogTimer = null;
  function showDialog(speaker, line, durationMs) {
    const el = document.getElementById('dialog');
    el.querySelector('.speaker').textContent = speaker || '';
    el.querySelector('.line').textContent = line;
    el.classList.add('show');
    clearTimeout(dialogTimer);
    if (durationMs) dialogTimer = setTimeout(closeDialog, durationMs);
    if (window.Speech) {
      Speech.say((speaker ? speaker + '. ' : '') + line);
    }
  }
  function closeDialog() {
    document.getElementById('dialog').classList.remove('show');
  }

  // =========================================================================
  // Stage scaling — keep the 1280x800 frame centred and scaled.
  // =========================================================================
  function fitStage() {
    const frame = document.getElementById('frame');
    const W = 1280, H = 800;
    // Use visualViewport when available (more accurate inside iframes / on
    // mobile where the URL bar dynamically resizes the viewport).
    const vv = window.visualViewport;
    const vw = vv ? vv.width  : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const sx = vw / W;
    const sy = vh / H;
    // Small / phone-sized viewports: cover-fill (Math.max) so the game uses
    // the whole screen. Frame anchors to the top so the HUD stays visible.
    const isSmall = vw < 1100 || vh < 700;
    const s = isSmall ? Math.max(sx, sy) : Math.min(sx, sy);
    frame.style.transform = `scale(${s})`;
    frame.style.transformOrigin = isSmall ? 'center top' : 'center center';
    document.getElementById('stage').style.placeItems = isSmall ? 'start center' : 'center';
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 80));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitStage);
  }
  // Re-fit a few times after load — iframes sometimes report stale sizes
  // until the parent has settled their layout.
  window.addEventListener('load', () => {
    [100, 300, 700, 1500].forEach(d => setTimeout(fitStage, d));
  });

  // =========================================================================
  // Wiring (called once at boot)
  // =========================================================================
  function wire() {
    document.getElementById('btn-journal').addEventListener('click', openJournal);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    const btnGal = document.getElementById('btn-gallery');
    if (btnGal) btnGal.addEventListener('click',
      () => window.Snapshot && Snapshot.openGallery());
    const btnQ = document.getElementById('btn-quests');
    if (btnQ) btnQ.addEventListener('click',
      () => window.Quests && Quests.open());
    const btnSt = document.getElementById('btn-stickers');
    if (btnSt) btnSt.addEventListener('click',
      () => window.Stickers && Stickers.open());
    document.getElementById('close-journal').addEventListener('click', closeJournal);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    document.getElementById('start-game').addEventListener('click', closeIntro);
    const closeShop = document.getElementById('close-shop');
    if (closeShop) closeShop.addEventListener('click', () => Interactions.closeShop());
    const closeCare = document.getElementById('close-care');
    if (closeCare) closeCare.addEventListener('click', () => Interactions.closeCare());
    const closeCooking = document.getElementById('close-cooking');
    if (closeCooking) closeCooking.addEventListener('click', () => window.Cooking && Cooking.close());
    const closePlant = document.getElementById('close-plant');
    if (closePlant) closePlant.addEventListener('click', () => {
      document.getElementById('modal-plant').classList.remove('show');
    });
    const closeConst = document.getElementById('close-constellation');
    if (closeConst) closeConst.addEventListener('click',
      () => window.Constellation && Constellation.close());
    const closeFish = document.getElementById('close-fishing');
    if (closeFish) closeFish.addEventListener('click',
      () => window.Fishing && Fishing.close());
    const closeSnap = document.getElementById('close-snapshot');
    if (closeSnap) closeSnap.addEventListener('click', () => {
      document.getElementById('modal-snapshot').classList.remove('show');
    });
    const closeGal = document.getElementById('close-gallery');
    if (closeGal) closeGal.addEventListener('click',
      () => window.Snapshot && Snapshot.closeGallery());
    const closeQuests = document.getElementById('close-quests');
    if (closeQuests) closeQuests.addEventListener('click',
      () => window.Quests && Quests.close());
    const closeCust = document.getElementById('close-customize');
    if (closeCust) closeCust.addEventListener('click', closeCustomize);
    const closeRhythm = document.getElementById('close-rhythm');
    if (closeRhythm) closeRhythm.addEventListener('click',
      () => window.Rhythm && Rhythm.close());
    const closeStick = document.getElementById('close-stickers');
    if (closeStick) closeStick.addEventListener('click',
      () => window.Stickers && Stickers.close());
    fitStage();
  }

  return {
    setGame, wire, fitStage,
    toast, setPrompt, updateHUD,
    openIntro, closeIntro,
    openJournal, closeJournal,
    openSettings, closeSettings, applySettings,
    openCustomize, closeCustomize,
    showDialog, closeDialog,
    flashCareMessage,
  };
})();
