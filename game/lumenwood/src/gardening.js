// ---------------------------------------------------------------------------
// Gardening — plot rendering + plant / harvest interactions.
//
// Plots live on each outdoor scene as `gardenPlots: [{x, y, id}, ...]`.
// Per-plot state is persisted in save.garden = { plotId: { seedId, plantedAt }}.
// Growth is real-time but only progresses while there's a save.lastPlayed
// stamp — i.e. offline time counts too. Plants never die, just keep waiting.
// ---------------------------------------------------------------------------

window.Gardening = (function () {

  let game;
  function setGame(g) { game = g; }

  function ensureSlot() {
    if (!game.save.garden) game.save.garden = {};
  }

  function plotState(plotId) {
    ensureSlot();
    return game.save.garden[plotId] || null;
  }

  // returns 0..1 (capped at 1)
  function growth(plotState) {
    if (!plotState || !plotState.seedId) return 0;
    const seed = window.seedById(plotState.seedId);
    if (!seed) return 0;
    const elapsed = Date.now() - plotState.plantedAt;
    return Math.min(1, elapsed / seed.growMs);
  }

  // Find a plot near the player (within 50px)
  function nearestPlot(scene, player) {
    if (!scene.gardenPlots) return null;
    let best = null, bestD = 50;
    for (const p of scene.gardenPlots) {
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // Build prompt text + which interaction is available
  function plotInteraction(plot) {
    const st = plotState(plot.id);
    if (!st) {
      const haveSeed = window.SEEDS.find(s => (game.save.inventory[s.id] || 0) > 0);
      if (!haveSeed) return { prompt: 'No seeds yet \u2014 see Pippa', action: 'none' };
      return { prompt: 'Plant a seed', action: 'plant' };
    }
    const g = growth(st);
    if (g >= 1) return { prompt: 'Harvest!', action: 'harvest' };
    const pct = Math.round(g * 100);
    return { prompt: `Growing\u2026 ${pct}%`, action: 'watch' };
  }

  // Trigger by game when player presses E on a plot
  function trigger(plot) {
    const inter = plotInteraction(plot);
    if (inter.action === 'plant') {
      openPlantPicker(plot);
    } else if (inter.action === 'harvest') {
      doHarvest(plot);
    }
    // 'watch' and 'none' do nothing
  }

  function openPlantPicker(plot) {
    const m = document.getElementById('modal-plant');
    const body = document.getElementById('plant-body');
    body.innerHTML = '';
    const owned = window.SEEDS.filter(s => (game.save.inventory[s.id] || 0) > 0);
    if (!owned.length) {
      body.innerHTML = '<div class="picker-header">No seeds yet. Buy some from Pippa.</div>';
    } else {
      const head = document.createElement('div');
      head.className = 'picker-header';
      head.textContent = 'What would you like to plant?';
      body.appendChild(head);

      const row = document.createElement('div');
      row.className = 'picker-row';
      for (const s of owned) {
        const f = window.foodById(s.food);
        const b = document.createElement('button');
        b.className = 'food-chip';
        b.innerHTML = `
          <span class="swatch" style="background:${s.color};box-shadow:0 0 10px ${s.accent};"></span>
          <span class="name">${s.name}</span>
          <span class="qty">x${game.save.inventory[s.id]}</span>`;
        b.addEventListener('click', () => {
          game.save.inventory[s.id] -= 1;
          ensureSlot();
          game.save.garden[plot.id] = { seedId: s.id, plantedAt: Date.now() };
          window.Save.save(game.save);
          window.UI.updateHUD();
          window.UI.toast(`Planted ${s.name}`, s.accent);
          m.classList.remove('show');
        });
        row.appendChild(b);
      }
      body.appendChild(row);
    }
    m.classList.add('show');
    window.Input.clear();
  }

  function doHarvest(plot) {
    const st = plotState(plot.id);
    if (!st) return;
    const seed = window.seedById(st.seedId);
    if (!seed) return;
    const count = seed.yieldMin + Math.floor(Math.random() * (seed.yieldMax - seed.yieldMin + 1));
    game.save.inventory[seed.food] = (game.save.inventory[seed.food] || 0) + count;
    delete game.save.garden[plot.id];
    game.save.flags = game.save.flags || {};
    game.save.flags.harvestedAny = true;
    window.Save.save(game.save);
    window.UI.updateHUD();
    if (window.Stickers) Stickers.scan();
    const f = window.foodById(seed.food);
    window.UI.toast(`Harvested ${count} \u00d7 ${f.name}`, f.accent || '#9bbf8e');
  }

  // Drawing — called from world.drawForeground for each plot
  function drawPlot(ctx, plot, camera, time, gameRef) {
    const sx = plot.x - camera.x;
    const sy = plot.y - camera.y;

    ctx.save();
    // soil bed
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.ellipse(sx - 5, sy - 2, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // furrow lines
    ctx.strokeStyle = '#2a1808';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy - 2); ctx.lineTo(sx + 18, sy - 2);
    ctx.moveTo(sx - 16, sy + 2); ctx.lineTo(sx + 16, sy + 2);
    ctx.stroke();

    const st = gameRef.save.garden ? gameRef.save.garden[plot.id] : null;
    if (st) {
      const seed = window.seedById(st.seedId);
      const g = growth(st);
      drawPlant(ctx, sx, sy, g, seed, time);
    }
    ctx.restore();
  }

  function drawPlant(ctx, x, y, g, seed, time) {
    if (!seed) return;
    // stem grows from y up to (y - 36 * g)
    const h = 8 + g * 30;
    const sway = Math.sin(time * 0.001 + x * 0.01) * 2 * g;
    ctx.strokeStyle = '#6e9b62';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway, y - h / 2, x + sway, y - h);
    ctx.stroke();
    // leaves
    if (g > 0.3) {
      ctx.fillStyle = '#8ab86a';
      ctx.beginPath();
      ctx.ellipse(x - 8, y - h * 0.5, 7, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (g > 0.6) {
      ctx.fillStyle = '#8ab86a';
      ctx.beginPath();
      ctx.ellipse(x + 8, y - h * 0.7, 7, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // fruit when ripe (g === 1)
    if (g >= 1) {
      ctx.fillStyle = seed.color;
      ctx.shadowColor = seed.accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x + sway, y - h - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // a smaller secondary fruit
      ctx.fillStyle = seed.color;
      ctx.beginPath();
      ctx.arc(x + sway - 9, y - h + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      // sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x + sway + 3, y - h - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return {
    setGame, plotState, growth,
    nearestPlot, plotInteraction, trigger, drawPlot,
  };
})();
