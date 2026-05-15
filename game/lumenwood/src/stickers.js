// ---------------------------------------------------------------------------
// Stickers — passive achievement scanner. Call Stickers.scan() after any
// state change (catch, cook, harvest, quest turn-in, festival, etc.). New
// stickers since the last scan trigger a toast + are persisted to
// save.stickers[id] = timestamp.
// ---------------------------------------------------------------------------

window.Stickers = (function () {
  let game = null;
  function setGame(g) { game = g; }

  function scan() {
    if (!game || !window.STICKERS) return;
    game.save.stickers = game.save.stickers || {};
    let any = false;
    for (const s of window.STICKERS) {
      if (game.save.stickers[s.id]) continue;
      try {
        if (s.check(game)) {
          game.save.stickers[s.id] = Date.now();
          any = true;
          UI.toast(`✦ New sticker: ${s.name}`, s.color);
          if (window.Sound) Sound.play('chime');
        }
      } catch (e) {}
    }
    if (any) Save.save(game.save);
  }

  function open() {
    const body = document.getElementById('stickers-body');
    const total = (window.STICKERS || []).length;
    const earned = (window.STICKERS || []).filter(s =>
      game.save.stickers && game.save.stickers[s.id]).length;
    const pct = total ? Math.round(earned / total * 100) : 0;
    body.innerHTML = `
      <div class="sticker-progress">
        <div class="count">${earned}/${total}</div>
        <div class="bar"><div style="width:${pct}%"></div></div>
        <div class="count">${pct}%</div>
      </div>
      <div class="sticker-grid">
        ${(window.STICKERS || []).map(renderCard).join('')}
      </div>
    `;
    document.getElementById('modal-stickers').classList.add('show');
    Input.clear();
  }
  function close() {
    document.getElementById('modal-stickers').classList.remove('show');
  }

  function renderCard(s) {
    const got = !!(game.save.stickers && game.save.stickers[s.id]);
    return `
      <div class="sticker-card ${got ? 'got' : 'locked'}">
        <div class="sticker-medal" style="${got ? `background:${s.color};` : ''}">
          <span class="sticker-icon">${got ? s.icon : '·'}</span>
        </div>
        <div class="sticker-name">${got ? s.name : '???'}</div>
        <div class="sticker-desc">${got ? s.desc : 'Not yet earned.'}</div>
      </div>
    `;
  }

  return { setGame, scan, open, close };
})();
