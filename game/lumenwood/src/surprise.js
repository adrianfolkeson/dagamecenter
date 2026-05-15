// ---------------------------------------------------------------------------
// Surprise events — low-probability moments that fire on scene entry.
// Cooled-down so they feel rare. Always positive: a rare Glim wandering by,
// a gift left at the door, a gentle weather flourish. Never punishing.
// ---------------------------------------------------------------------------

window.Surprise = (function () {
  let game = null;
  const COOLDOWN_MS = 4 * 60 * 1000;   // 4 real-world minutes between events
  const CHANCE     = 0.30;             // probability per qualified scene-entry

  function setGame(g) { game = g; }

  function onSceneEnter(sceneId) {
    if (!game) return;
    const now = Date.now();
    const last = (game.save.flags && game.save.flags.lastSurprise) || 0;
    if (now - last < COOLDOWN_MS) return;
    if (Math.random() > CHANCE) return;

    const ev = pickEvent(sceneId);
    if (!ev) return;
    ev();
    game.save.flags.lastSurprise = now;
    Save.save(game.save);
  }

  function pickEvent(sceneId) {
    const pool = [];
    if (sceneId !== 'treehouse') pool.push(rareWanderer);
    if (sceneId === 'treehouse') pool.push(giftAtDoor);
    pool.push(weatherFlourish);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Spawn one extra rare Glim into the active scene's roster
  function rareWanderer() {
    const candidates = (window.GLIMS || []).filter(g =>
      g.biome.includes(game.sceneId) &&
      !game.save.caught[g.id] &&
      g.rarity === 'rare'
    );
    if (candidates.length === 0) return;
    const def = candidates[Math.floor(Math.random() * candidates.length)];
    // ask game.js to add this Glim to the active scene
    if (!window.Game || typeof window.Game.spawnExtraGlim !== 'function') return;
    window.Game.spawnExtraGlim(def);
    UI.toast(`Something rare drifts past… (${def.element} Glim spotted)`, def.glow);
    if (window.Sound) Sound.play('chime');
  }

  function giftAtDoor() {
    const gifts = [
      { kind: 'food', id: 'honeycake', n: 1, by: 'Wren' },
      { kind: 'food', id: 'pearlfruit', n: 1, by: 'Marlowe' },
      { kind: 'food', id: 'moonberry', n: 1, by: 'Astra' },
      { kind: 'food', id: 'mintleaf',  n: 2, by: 'Cobble' },
      { kind: 'dust', n: 15, by: 'Pippa' },
    ];
    const g = gifts[Math.floor(Math.random() * gifts.length)];
    if (g.kind === 'food') {
      game.save.inventory = game.save.inventory || {};
      game.save.inventory[g.id] = (game.save.inventory[g.id] || 0) + g.n;
      const food = window.foodById(g.id);
      UI.showDialog(`A gift from ${g.by}`,
        `Someone left ${g.n} ${food ? food.name : 'something nice'} just inside the door.`,
        5500);
    } else {
      game.save.dust += g.n;
      UI.showDialog(`A gift from ${g.by}`,
        `A small bundle of sparkledust was tucked under the welcome mat — ${g.n} in all.`,
        5500);
    }
    UI.updateHUD();
    if (window.Sound) Sound.play('chime');
  }

  function weatherFlourish() {
    // simply trigger a brief weather state — Weather module handles rendering
    if (!window.Weather) return;
    const kinds = {
      mossroot:  ['rain'],
      honeydrop: ['petals'],
      tidepools: ['rain', 'mist'],
      starpetal: ['mist'],
      winter:    ['snow'],
    };
    const list = kinds[game.sceneId];
    if (!list) return;
    const k = list[Math.floor(Math.random() * list.length)];
    window.Weather.start(k, 18000);     // ~18 seconds
    UI.toast(
      k === 'rain'   ? 'A soft rain begins.' :
      k === 'mist'   ? 'A gentle mist drifts in.' :
      k === 'petals' ? 'Petals start to fall.' :
      k === 'snow'   ? 'Snowflakes drift down.' : '',
      '#dde4f0');
  }

  return { setGame, onSceneEnter };
})();
