// ---------------------------------------------------------------------------
// Quests — small NPC favours. Auto-offered when their requirement flag is
// true (e.g. after metPippa). Player checks the Quests panel to see open
// asks, hit *Turn in* once requirements are met. Rewards: sparkledust +
// decor tokens (spent at the decoration cart).
// ---------------------------------------------------------------------------

window.Quests = (function () {
  let game = null;

  function setGame(g) { game = g; }

  function stateFor(q) {
    const save = game.save.quests || {};
    return save[q.id] || { state: 'locked' };
  }

  // recompute state for every quest from current save flags / inventory / caught
  function refresh() {
    if (!game.save.quests) game.save.quests = {};
    for (const q of window.QUESTS) {
      const rec = game.save.quests[q.id] || (game.save.quests[q.id] = { state: 'locked' });
      if (rec.state === 'turned_in') continue;
      const npcMet = !!(game.save.flags && game.save.flags[q.requires]);
      const prereqOk = !q.prereqQuest
        || (game.save.quests[q.prereqQuest] && game.save.quests[q.prereqQuest].state === 'turned_in');
      if (!npcMet || !prereqOk) { rec.state = 'locked'; continue; }

      const ready = isReady(q);
      rec.state = ready ? 'complete' : 'open';
    }
    // derived flag: all constellations traced (for astra3)
    const tr = (game.save.flags && game.save.flags.constellationsTraced) || {};
    game.save.flags.allConstellationsTraced =
      tr.owl && tr.lantern && tr.boat ? true : false;
    Save.save(game.save);
  }

  function isReady(q) {
    if (q.type === 'catch') {
      return !!(game.save.caught && game.save.caught[q.glim]);
    }
    if (q.type === 'gather') {
      return (game.save.inventory && (game.save.inventory[q.food] || 0) >= q.count);
    }
    if (q.type === 'flag') {
      return !!(game.save.flags && game.save.flags[q.flag]);
    }
    return false;
  }

  function turnIn(q) {
    if (!isReady(q)) return;
    if (q.type === 'gather') {
      game.save.inventory[q.food] = (game.save.inventory[q.food] || 0) - q.count;
      if (game.save.inventory[q.food] <= 0) delete game.save.inventory[q.food];
    }
    const reward = q.reward || {};
    if (reward.dust)  game.save.dust += reward.dust;
    if (reward.token) {
      game.save.flags.decorTokens = (game.save.flags.decorTokens || 0) + reward.token;
    }
    game.save.quests[q.id] = { state: 'turned_in', at: Date.now() };
    Save.save(game.save);
    UI.updateHUD();
    UI.toast(`${q.asker} smiled — +${reward.dust || 0} sparkledust${reward.token ? `, +${reward.token} decor token` : ''}`,
             '#ffd97a');
    if (window.Sound) Sound.play('chime');
    if (window.Stickers) Stickers.scan();
    render();
  }

  function open() {
    refresh();
    render();
    document.getElementById('modal-quests').classList.add('show');
    Input.clear();
  }
  function close() {
    document.getElementById('modal-quests').classList.remove('show');
  }

  function render() {
    const body = document.getElementById('quests-body');
    const visible = window.QUESTS.filter(q => stateFor(q).state !== 'locked');
    if (visible.length === 0) {
      body.innerHTML = `
        <div class="quests-empty">
          No favours yet — meet the villagers around Lumenwood and they’ll tell you what they need.
        </div>`;
      return;
    }
    body.innerHTML = visible.map(q => renderCard(q)).join('');
    body.querySelectorAll('button[data-turnin]').forEach(b => {
      b.addEventListener('click', () => {
        const q = window.QUESTS.find(x => x.id === b.dataset.turnin);
        if (q) turnIn(q);
      });
    });
  }

  function renderCard(q) {
    const s = stateFor(q).state;
    const ask = q.ask;
    const rewardLine = `+${q.reward.dust || 0} sparkledust` +
      (q.reward.token ? `, +${q.reward.token} decor token` : '');
    let stateLabel, body;
    if (s === 'turned_in') {
      stateLabel = 'done';
      body = `<div class="quest-reward">Reward delivered — ${rewardLine}</div>`;
    } else if (s === 'complete') {
      stateLabel = 'ready';
      body = `
        <div class="quest-ask">${ask}</div>
        <div class="quest-reward">Reward: ${rewardLine}</div>
        <button class="btn-primary small" data-turnin="${q.id}">Turn in</button>
      `;
    } else {
      stateLabel = 'open';
      body = `
        <div class="quest-ask">${ask}</div>
        <div class="quest-reward">Reward: ${rewardLine}</div>
      `;
    }
    return `
      <div class="quest-card ${s === 'turned_in' ? 'complete' : ''}">
        <div class="quest-head">
          <div class="quest-asker">${q.asker}</div>
          <div class="quest-state">${stateLabel}</div>
        </div>
        ${body}
      </div>
    `;
  }

  return { setGame, open, close, refresh };
})();
