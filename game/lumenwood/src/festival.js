// ---------------------------------------------------------------------------
// Festival — the Lantern Festival event.
//
// Triggers automatically when the player enters Mossroot with 5+ befriended
// Glims and hasn't yet celebrated. Once active, Mossroot shifts to a soft
// dusk palette, paper lanterns appear in the trees, and a Festival Stage
// near the treehouse offers a "release your lantern" interaction.
//
// Reward for releasing: a one-off Festival Cake (and the recipe is unlocked
// for cooking from now on). After that, the flag stays set forever — your
// Mossroot has been touched by festival magic.
// ---------------------------------------------------------------------------

window.Festival = (function () {

  let game;
  function setGame(g) { game = g; }

  // Called whenever the player arrives at Mossroot.
  function checkTrigger() {
    const caughtCount = Object.keys(game.save.caught).length;
    if (caughtCount < 5) return;
    if (game.save.flags.festivalActive) return;
    // first trigger of THIS save
    game.save.flags.festivalActive = true;
    window.Save.save(game.save);
    setTimeout(() => {
      window.UI.showDialog('The forest is preparing\u2026',
        'Paper lanterns hang in the trees. Look near your treehouse \u2014 a festival stage has appeared.',
        6000);
    }, 1200);
  }

  // Per-biome festivals \u2014 gentle one-off events that fire on entry once a
  // threshold of biome-specific Glims have been befriended.
  const BIOME_FESTIVALS = [
    {
      id: 'bloomDay', biome: 'honeydrop', flag: 'celebratedBloomDay',
      minBiomeCaught: 4,
      title: 'Bloom Day',
      line: 'Petals are drifting on every breeze. The meadow celebrates the first bright bloom.',
      gift: { food: 'beebalm', n: 2, dust: 20, token: 1 },
      weather: 'petals',
    },
    {
      id: 'tidesong', biome: 'tidepools', flag: 'celebratedTidesong',
      minBiomeCaught: 4,
      title: 'Tidesong',
      line: 'The whole pool hums in time with the surf. Marlowe says the sea sings only once a season.',
      gift: { food: 'pearlfruit', n: 2, dust: 25, token: 1 },
      weather: 'mist',
    },
    {
      id: 'starCount', biome: 'starpetal', flag: 'celebratedStarCount',
      minBiomeCaught: 4,
      title: 'Star-Counting Night',
      line: 'Astra has set out the telescope. Every star has a name tonight \u2014 and so do you.',
      gift: { food: 'moonberry', n: 2, dust: 30, token: 2 },
      weather: null,
    },
  ];

  function checkBiomeFestival(sceneId) {
    for (const f of BIOME_FESTIVALS) {
      if (f.biome !== sceneId) continue;
      if (game.save.flags[f.flag]) continue;
      const caughtHere = (window.GLIMS || []).filter(g =>
        g.biome.includes(f.biome) && game.save.caught[g.id]).length;
      if (caughtHere < f.minBiomeCaught) continue;
      game.save.flags[f.flag] = Date.now();
      // gift
      const inv = (game.save.inventory = game.save.inventory || {});
      if (f.gift.food) inv[f.gift.food] = (inv[f.gift.food] || 0) + (f.gift.n || 1);
      if (f.gift.dust) game.save.dust += f.gift.dust;
      if (f.gift.token) game.save.flags.decorTokens =
        (game.save.flags.decorTokens || 0) + f.gift.token;
      window.Save.save(game.save);
      window.UI.updateHUD();
      // visuals
      if (f.weather && window.Weather) Weather.start(f.weather, 12000);
      setTimeout(() => {
        window.UI.showDialog(f.title, f.line, 6500);
        const food = window.foodById(f.gift.food);
        const parts = [];
        if (f.gift.food) parts.push(`+${f.gift.n} ${food ? food.name : f.gift.food}`);
        if (f.gift.dust) parts.push(`+${f.gift.dust} sparkledust`);
        if (f.gift.token) parts.push(`+${f.gift.token} decor token`);
        window.UI.toast(`${f.title} \u2014 ${parts.join(', ')}`, '#fdf3c4');
        if (window.Sound) Sound.play('festival');
      }, 600);
      return;
    }
  }

  // Released lantern animation state
  let releasedLanterns = [];   // each: { x, y, vy, life }

  function release(player) {
    if (game.save.flags.festivalCelebrated) {
      // already celebrated — still let them release a lantern for fun, but no reward
      releasedLanterns.push(makeLantern(player.x, player.y - 20));
      window.UI.toast('Your lantern drifts upward.', '#ffd97a');
      return;
    }
    game.save.flags.festivalCelebrated = true;
    // grant a Festival Cake outright (a one-off treat)
    game.save.inventory['festival_cake'] = (game.save.inventory['festival_cake'] || 0) + 1;
    window.Save.save(game.save);
    window.UI.updateHUD();
    releasedLanterns.push(makeLantern(player.x, player.y - 20));
    window.UI.toast('Your lantern joined the sky. (+ Festival Cake)', '#f6d0d8');
    setTimeout(() => {
      window.UI.showDialog('Your wish',
        'The forest twinkles back at you. A slice of Festival Cake found its way into your basket.',
        5000);
    }, 1200);
  }

  function makeLantern(x, y) {
    return {
      x, y,
      vy: -22 - Math.random() * 8,
      vx: (Math.random() - 0.5) * 6,
      life: 8,
      age: 0,
      bobPhase: Math.random() * Math.PI * 2,
    };
  }

  function update(dt) {
    if (!releasedLanterns.length) return;
    for (let i = releasedLanterns.length - 1; i >= 0; i--) {
      const l = releasedLanterns[i];
      l.age += dt;
      l.y += l.vy * dt;
      l.x += l.vx * dt + Math.sin(game.time * 0.001 + l.bobPhase) * 0.3;
      if (l.age > l.life) releasedLanterns.splice(i, 1);
    }
  }

  // Hanging lanterns in trees — picked deterministically per tree
  function drawAmbientLanterns(ctx, cam, time, trees) {
    if (!game.save.flags.festivalActive) return;
    const colors = ['#ffd97a', '#f5a986', '#f6c2cf', '#d4c4e4'];
    for (let i = 0; i < trees.length; i += 2) {     // every other tree
      const t = trees[i];
      const color = colors[i % colors.length];
      const sx = t.x - cam.x + Math.cos(i) * 30;
      const sy = t.y - cam.y - t.size * 0.6 + Math.sin(i) * 10;
      if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) continue;
      drawPaperLantern(ctx, sx, sy, color, time + i * 99);
    }
  }

  function drawPaperLantern(ctx, x, y, color, time) {
    const bob = Math.sin(time * 0.001) * 1.5;
    ctx.save();
    ctx.translate(x, y + bob);
    // string up to canopy
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(0, -10);
    ctx.stroke();
    // glow
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    g.addColorStop(0, color);
    g.addColorStop(1, color + '00');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // rims
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(-9, -10, 18, 2);
    ctx.fillRect(-8,  10, 16, 2);
    // tassel
    ctx.beginPath();
    ctx.moveTo(0, 12); ctx.lineTo(0, 18);
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Festival stage drawing — wooden platform near the treehouse base
  function drawStage(ctx, cam, time, pos) {
    if (!game.save.flags.festivalActive) return;
    const sx = pos.x - cam.x;
    const sy = pos.y - cam.y;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8, 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // platform
    ctx.fillStyle = '#8b6a4a';
    ctx.beginPath();
    ctx.roundRect(sx - 42, sy - 4, 84, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#a07050';
    ctx.beginPath();
    ctx.roundRect(sx - 42, sy - 4, 84, 6, 4);
    ctx.fill();
    // plank lines
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * 20, sy - 4);
      ctx.lineTo(sx + i * 20, sy + 10);
      ctx.stroke();
    }
    // two posts with paper lanterns
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(sx - 32, sy - 40, 3, 40);
    ctx.fillRect(sx + 29, sy - 40, 3, 40);
    // string between
    ctx.strokeStyle = '#3a2818';
    ctx.beginPath();
    ctx.moveTo(sx - 32, sy - 38);
    ctx.quadraticCurveTo(sx, sy - 26, sx + 32, sy - 38);
    ctx.stroke();
    // mini lanterns along the string
    const colors = ['#ffd97a', '#f6c2cf', '#d4c4e4'];
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const lx = sx - 32 + t * 64;
      const ly = sy - 38 + (1 - Math.abs(t - 0.5) * 2) * 12;
      drawPaperLantern(ctx, lx, ly + 8, colors[i], time + i * 80);
    }
    ctx.restore();
  }

  function drawReleasedLanterns(ctx, cam, time) {
    for (const l of releasedLanterns) {
      const sx = l.x - cam.x;
      const sy = l.y - cam.y;
      const fade = Math.max(0, 1 - l.age / l.life);
      ctx.globalAlpha = fade;
      drawPaperLantern(ctx, sx, sy, '#ffd97a', time);
      ctx.globalAlpha = 1;
    }
  }

  // Dusk wash over the world canvas
  function drawDuskOverlay(ctx, w, h) {
    if (!game.save.flags.festivalActive) return;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(91, 74, 122, 0.32)');
    g.addColorStop(0.6, 'rgba(217, 144, 144, 0.16)');
    g.addColorStop(1,   'rgba(255, 217, 122, 0.10)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // a sprinkle of star-like specks at the top edge
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 245, 220, 0.6)';
    for (let i = 0; i < 18; i++) {
      const x = (i * 73 + Math.sin(i * 1.3) * 80 + (game.time * 0.01)) % w;
      const y = 20 + (i * 19) % 120;
      const r = 1 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function nearStage(scene, player) {
    if (!game.save.flags.festivalActive) return false;
    if (!scene.festivalStage) return false;
    const p = scene.festivalStage;
    return Math.hypot(p.x - player.x, p.y - player.y) < 60;
  }

  return {
    setGame, checkTrigger, release, update,
    drawAmbientLanterns, drawStage, drawReleasedLanterns, drawDuskOverlay,
    nearStage, checkBiomeFestival,
  };
})();
