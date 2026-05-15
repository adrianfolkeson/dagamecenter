// ---------------------------------------------------------------------------
// World — procedural scenery, baked to an offscreen canvas for cheap redraw.
// Two scenes live here: 'mossroot' (the starter forest biome) and 'treehouse'
// (the player's interior hub). Each scene exports:
//   - bounds: world rectangle the player can walk in
//   - spawn: where the player appears when entering this scene
//   - portals: list of {rect, target, spawn} for scene-to-scene transitions
//   - hotspots: named POIs Glims like to drift toward (favorite-spot AI)
//   - draw(ctx, camera, t): renders the scene
//   - drawForeground(ctx, camera, t): renders any layers ABOVE entities
// ---------------------------------------------------------------------------

window.World = (function () {

  // --- seeded pseudo-random ----------------------------------------------
  // Mulberry32 — small, deterministic, good enough for layout.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------
  //   Watercolour primitives
  // ------------------------------------------------------------------
  // A "watercolour blob" is a soft, slightly irregular splotch — a few
  // overlapping radial gradients with a touch of bumpy edge.

  function paintBlob(ctx, x, y, r, color, alpha) {
    alpha = alpha == null ? .9 : alpha;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0,   color);
    g.addColorStop(0.7, color);
    g.addColorStop(1,   color + '00');     // fade to transparent
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A leafy canopy: cluster of small overlapping blobs.
  function paintCanopy(ctx, cx, cy, size, baseColor, shadowColor, rand) {
    // outer shadow layer first
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = size * (0.2 + rand() * 0.3);
      paintBlob(ctx,
        cx + Math.cos(a) * d, cy + Math.sin(a) * d + size * 0.15,
        size * (0.55 + rand() * 0.25), shadowColor, 0.85);
    }
    // main canopy layer
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const d = size * (rand() * 0.35);
      paintBlob(ctx,
        cx + Math.cos(a) * d, cy + Math.sin(a) * d,
        size * (0.55 + rand() * 0.3), baseColor, 0.95);
    }
    // lighter top highlight
    paintBlob(ctx, cx - size * 0.12, cy - size * 0.2,
              size * 0.45, '#d4e8b4', 0.55);
  }

  // ------------------------------------------------------------------
  //   Mossroot Hollow
  // ------------------------------------------------------------------

  function buildMossroot() {
    const W = 2400, H = 1600;

    // bake background to offscreen canvas
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const r = rng(7);

    // base meadow wash
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,    '#e8d8a6');
    base.addColorStop(0.4,  '#d8cf9a');
    base.addColorStop(1,    '#c8c690');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // big sage blobs of moss
    for (let i = 0; i < 24; i++) {
      paintBlob(g, r() * W, r() * H, 180 + r() * 220, '#8bb084', 0.35);
    }
    for (let i = 0; i < 36; i++) {
      paintBlob(g, r() * W, r() * H, 70 + r() * 120, '#9bc093', 0.4);
    }
    // darker undergrowth pockets
    for (let i = 0; i < 14; i++) {
      paintBlob(g, r() * W, r() * H, 110 + r() * 140, '#5a7e54', 0.25);
    }

    // a winding stream from upper-right to lower-left
    const streamPts = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = W * (1 - t * 0.95) - 80;
      const y = H * (0.18 + t * 0.7) + Math.sin(t * 7) * 60;
      streamPts.push({ x, y });
    }
    // banks (slightly darker)
    drawSmoothPath(g, streamPts, '#7b9a6a', 70, 0.5);
    drawSmoothPath(g, streamPts, '#a8c8d8', 46, 1);
    drawSmoothPath(g, streamPts, '#c8e0e8', 18, 0.7);
    // sparkle highlights
    for (let i = 0; i < streamPts.length - 1; i++) {
      const p = streamPts[i];
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(p.x + (r() - .5) * 30, p.y + (r() - .5) * 30,
                3 + r() * 4, 1.5, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }

    // dirt path winding from treehouse area to center
    const pathPts = [
      { x: 280, y: 460 }, { x: 420, y: 580 }, { x: 580, y: 700 },
      { x: 760, y: 820 }, { x: 980, y: 880 }, { x: 1200, y: 860 },
      { x: 1400, y: 940 },
    ];
    drawSmoothPath(g, pathPts, '#b89a72', 56, 0.7);
    drawSmoothPath(g, pathPts, '#d4b890', 38, 0.9);

    // Trees — clusters around the edges, a few inside (NOT on the path/stream).
    const trees = [];
    const noTreeZones = [
      // path corridor
      ...pathPts.map(p => ({ x: p.x, y: p.y, r: 90 })),
      // stream corridor
      ...streamPts.map(p => ({ x: p.x, y: p.y, r: 80 })),
      // around the treehouse door
      { x: 220, y: 380, r: 200 },
      // open clearing in the middle for spawning Glims
      { x: 1100, y: 800, r: 220 },
    ];
    function inForbidden(x, y) {
      for (const z of noTreeZones) {
        if (Math.hypot(x - z.x, y - z.y) < z.r) return true;
      }
      return false;
    }
    let attempts = 0;
    while (trees.length < 64 && attempts < 600) {
      attempts++;
      const x = 60 + r() * (W - 120);
      const y = 120 + r() * (H - 200);
      if (inForbidden(x, y)) continue;
      // reject if too close to existing tree
      let ok = true;
      for (const t of trees) {
        if (Math.hypot(t.x - x, t.y - y) < 120) { ok = false; break; }
      }
      if (!ok) continue;
      trees.push({
        x, y,
        size: 80 + r() * 70,
        kind: r() < 0.25 ? 'birch' : 'oak',
        seed: Math.floor(r() * 1000),
      });
    }
    // sort by y for proper layering
    trees.sort((a, b) => a.y - b.y);

    // draw trees onto the bake — trunks then canopies
    for (const t of trees) {
      drawTreeTrunk(g, t);
    }
    for (const t of trees) {
      drawTreeCanopy(g, t);
    }

    // little decorations: mushrooms + flower clumps + stones
    const decor = [];
    for (let i = 0; i < 60; i++) {
      const x = 60 + r() * (W - 120);
      const y = 200 + r() * (H - 260);
      // keep decor off path centrelines
      let onPath = false;
      for (const p of pathPts) if (Math.hypot(p.x - x, p.y - y) < 25) onPath = true;
      if (onPath) continue;
      // keep off stream
      for (const p of streamPts) if (Math.hypot(p.x - x, p.y - y) < 35) onPath = true;
      if (onPath) continue;
      const t = r();
      decor.push({
        x, y,
        kind: t < .35 ? 'mushroom' : (t < .75 ? 'flower' : 'stone'),
        seed: Math.floor(r() * 1000),
      });
    }
    for (const d of decor) drawDecor(g, d);

    // Treehouse base — a chunky tree at the upper-left with a door.
    drawTreehouseBase(g, 180, 380);

    // Wooden signpost near spawn pointing at the path
    drawSignpost(g, 360, 540, 'Mossroot Hollow');

    // edge vignette (soft frame)
    const vig = g.createRadialGradient(W/2, H/2, Math.min(W, H) * 0.5,
                                       W/2, H/2, Math.max(W, H) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(74,58,44,0.25)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    // a second signpost pointing toward Honeydrop (south-east edge)
    drawSignpost(g, W - 220, H - 140, 'Honeydrop →');

    return {
      id: 'mossroot',
      name: 'Mossroot Hollow',
      bake: bg,
      bounds: { x: 0, y: 0, w: W, h: H },
      spawn: { x: 340, y: 540 },
      spawnPoints: {
        fromHoneydrop: { x: 2400 - 240, y: 1600 - 200 },
      },
      // NPC spawn points
      npcs: [
        { id: 'pippa', x: 460, y: 600, kind: 'pippa' },
        { id: 'cobble', x: 1500, y: 920, kind: 'cobble' },
        { id: 'theo', x: 1900, y: 1300, kind: 'theo' },
      ],
      gardenPlots: [
        { id: 'plot1', x: 250, y: 660 },
        { id: 'plot2', x: 300, y: 700 },
        { id: 'plot3', x: 350, y: 720 },
      ],
      festivalStage: { x: 540, y: 460 },
      portals: [
        { rect: { x: 130, y: 320, w: 110, h: 90 },
          target: 'treehouse', spawn: 'door', prompt: 'Enter Treehouse' },
        { rect: { x: W - 180, y: H - 200, w: 130, h: 110 },
          target: 'honeydrop', spawn: 'fromMossroot',
          prompt: 'Walk to Honeydrop Meadow',
          gated: { type: 'caught', min: 3,
                   lockedPrompt: 'Befriend 3 Glims to find the path here' } },
      ],
      hotspots: {
        // favorite-spot AI: Glims drift around their preferred biome feature
        stream: streamPts.slice(3, 11),
        path:   pathPts,
        oldtree: [{ x: trees[0] ? trees[0].x : 600, y: trees[0] ? trees[0].y : 700 }],
        clearing: [{ x: 1100, y: 800 }, { x: 1400, y: 700 }, { x: 1700, y: 900 }],
        logs:   decor.filter(d => d.kind === 'stone').slice(0, 5).map(d => ({ x: d.x, y: d.y })),
        rocks:  decor.filter(d => d.kind === 'stone').slice(5, 10).map(d => ({ x: d.x, y: d.y })),
        leaves: decor.filter(d => d.kind === 'flower').slice(0, 6).map(d => ({ x: d.x, y: d.y })),
        flowers:decor.filter(d => d.kind === 'flower').slice(6, 14).map(d => ({ x: d.x, y: d.y })),
      },
      // The trees are drawn into the bake at full opacity; we keep their data
      // so we can layer them again in the foreground when player walks behind
      // (simple: trees whose base y > player.y appear in front).
      trees, decor,
      draw(ctx, cam, time) {
        ctx.drawImage(bg,
          cam.x, cam.y, cam.w, cam.h,
          0,     0,     cam.w, cam.h);
      },
      drawForeground(ctx, cam, time, playerY, gameRef) {
        // garden plots — always visible, render before tree canopies
        if (this.gardenPlots && window.Gardening) {
          for (const plot of this.gardenPlots) {
            window.Gardening.drawPlot(ctx, plot, cam, time, gameRef);
          }
        }
        // festival stage + ambient hanging lanterns (only when festival active)
        if (window.Festival && gameRef) {
          window.Festival.drawStage(ctx, cam, time, this.festivalStage);
          window.Festival.drawAmbientLanterns(ctx, cam, time, trees);
          window.Festival.drawReleasedLanterns(ctx, cam, time);
        }
        // re-draw the canopies of trees that are "in front of" the player so
        // they overlap the player sprite — adds depth without a sorting list.
        for (const t of trees) {
          if (t.y - 20 > playerY) {
            const sx = t.x - cam.x;
            const sy = t.y - cam.y;
            if (sx < -200 || sy < -200 || sx > cam.w + 200 || sy > cam.h + 200) continue;
            drawTreeCanopy(ctx, { x: sx, y: sy, size: t.size, seed: t.seed, kind: t.kind });
          }
        }
      },
    };
  }

  // smooth bezier polyline through a list of points
  function drawSmoothPath(ctx, pts, color, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawTreeTrunk(ctx, t) {
    const r = rng(t.seed);
    const isB = t.kind === 'birch';
    // shadow on ground
    ctx.save();
    ctx.fillStyle = 'rgba(60,46,30,0.18)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 4, t.size * 0.65, t.size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const trunkW = t.size * 0.28;
    const trunkH = t.size * 0.7;
    const tx = t.x;
    const ty = t.y - trunkH;
    ctx.save();
    // base trunk
    const trunkColor = isB ? '#e8e0c8' : '#8b6a4a';
    const trunkDark  = isB ? '#a89a78' : '#5a4030';
    ctx.fillStyle = trunkColor;
    ctx.beginPath();
    ctx.moveTo(tx - trunkW * 0.55, t.y + 4);
    ctx.quadraticCurveTo(tx - trunkW * 0.65, ty + trunkH * 0.3, tx - trunkW * 0.45, ty);
    ctx.lineTo(tx + trunkW * 0.45, ty);
    ctx.quadraticCurveTo(tx + trunkW * 0.65, ty + trunkH * 0.3, tx + trunkW * 0.55, t.y + 4);
    ctx.closePath();
    ctx.fill();
    // shadow side
    ctx.fillStyle = trunkDark + (isB ? '' : '');
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(tx + trunkW * 0.05, ty);
    ctx.lineTo(tx + trunkW * 0.45, ty);
    ctx.quadraticCurveTo(tx + trunkW * 0.65, ty + trunkH * 0.3, tx + trunkW * 0.55, t.y + 4);
    ctx.lineTo(tx + trunkW * 0.15, t.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // birch marks
    if (isB) {
      ctx.fillStyle = '#3a3328';
      for (let i = 0; i < 4; i++) {
        const yy = ty + trunkH * (0.2 + i * 0.18);
        const xx = tx + (r() - 0.5) * trunkW * 0.7;
        ctx.beginPath();
        ctx.ellipse(xx, yy, trunkW * 0.18, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTreeCanopy(ctx, t) {
    const r = rng(t.seed + 13);
    const isB = t.kind === 'birch';
    const cx = t.x;
    const cy = t.y - t.size * 0.9;
    const colors = isB
      ? { main: '#c8d68a', shadow: '#88a060' }
      : { main: '#6e9b62', shadow: '#3f6a4a' };
    paintCanopy(ctx, cx, cy, t.size, colors.main, colors.shadow, r);
  }

  function drawDecor(ctx, d) {
    const r = rng(d.seed);
    if (d.kind === 'mushroom') {
      const sz = 10 + r() * 6;
      ctx.save();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 2, sz * 0.9, sz * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // stem
      ctx.fillStyle = '#f5ecd2';
      ctx.fillRect(d.x - sz * 0.18, d.y - sz * 0.6, sz * 0.36, sz * 0.6);
      // cap
      ctx.fillStyle = r() > .5 ? '#d96a6a' : '#e8a86a';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y - sz * 0.5, sz, sz * 0.55, 0, Math.PI, 0);
      ctx.fill();
      // spots
      ctx.fillStyle = '#fffaea';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(d.x + (r() - .5) * sz, d.y - sz * 0.5 - r() * sz * 0.3,
                sz * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (d.kind === 'flower') {
      const sz = 7 + r() * 4;
      const petalCol = ['#f6c2cf', '#ffd97a', '#d4c4e4', '#f5a986'][Math.floor(r() * 4)];
      ctx.save();
      // stem
      ctx.strokeStyle = '#6e9b62';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y - sz * 1.5);
      ctx.stroke();
      // petals
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.fillStyle = petalCol;
        ctx.beginPath();
        ctx.ellipse(d.x + Math.cos(a) * sz * 0.4,
                    d.y - sz * 1.5 + Math.sin(a) * sz * 0.4,
                    sz * 0.4, sz * 0.6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // centre
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(d.x, d.y - sz * 1.5, sz * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (d.kind === 'stone') {
      const sz = 12 + r() * 8;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 2, sz, sz * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a89a82';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y - sz * 0.2, sz, sz * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8baa0';
      ctx.beginPath();
      ctx.ellipse(d.x - sz * 0.2, d.y - sz * 0.4, sz * 0.6, sz * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTreehouseBase(ctx, x, y) {
    // A big oak with a wooden door carved into it.
    const seed = 99;
    const t = { x, y: y + 200, size: 220, kind: 'oak', seed };
    drawTreeTrunk(ctx, t);
    drawTreeCanopy(ctx, { ...t, x: t.x - 10, y: t.y - 20 });
    drawTreeCanopy(ctx, { ...t, x: t.x + 120, y: t.y - 60, size: 180, seed: seed + 1 });
    drawTreeCanopy(ctx, { ...t, x: t.x - 90,  y: t.y - 40, size: 170, seed: seed + 2 });

    // Door — arched plank door at base of trunk
    ctx.save();
    const dx = x;
    const dy = y;
    // doorway recess
    ctx.fillStyle = '#3a2818';
    roundedArchPath(ctx, dx - 38, dy - 70, 76, 90);
    ctx.fill();
    // door
    ctx.fillStyle = '#a07050';
    roundedArchPath(ctx, dx - 32, dy - 64, 64, 80);
    ctx.fill();
    // planks
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(dx - 32 + (64 / 4) * i, dy - 50);
      ctx.lineTo(dx - 32 + (64 / 4) * i, dy - 0 + 10);
      ctx.stroke();
    }
    // knob
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(dx + 16, dy - 22, 3, 0, Math.PI * 2);
    ctx.fill();
    // little hanging lantern beside door
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(dx + 40, dy - 90, 2, 18);
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(dx + 41, dy - 66, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.arc(dx + 41, dy - 66, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundedArchPath(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function drawSignpost(ctx, x, y, label) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 28, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // post
    ctx.fillStyle = '#8b6a4a';
    ctx.fillRect(x - 3, y - 56, 6, 56);
    // plank
    ctx.fillStyle = '#a07050';
    ctx.beginPath();
    ctx.roundRect(x - 50, y - 56, 100, 26, 5);
    ctx.fill();
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // label
    ctx.fillStyle = '#3a2818';
    ctx.font = '600 13px Fredoka, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 43);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  //   Treehouse interior
  // ------------------------------------------------------------------
  function buildTreehouse() {
    const W = 1280, H = 800;
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');

    // floor + back wall
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0,    '#c89270');
    wall.addColorStop(0.55, '#b07a58');
    wall.addColorStop(0.56, '#8b6a4a');   // floor line
    wall.addColorStop(1,    '#a07a5a');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);

    // plank lines on wall
    g.strokeStyle = 'rgba(74,40,24,0.3)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(0, i * 38 + 10);
      g.lineTo(W, i * 38 + 10);
      g.stroke();
    }
    // floor boards
    g.strokeStyle = 'rgba(74,40,24,0.45)';
    for (let i = 1; i < 7; i++) {
      g.beginPath();
      g.moveTo(0, H * 0.56 + i * 50);
      g.lineTo(W, H * 0.56 + i * 50);
      g.stroke();
    }

    // round window (left), showing forest outside
    const wx = 160, wy = 180, wr = 70;
    g.save();
    g.beginPath();
    g.arc(wx, wy, wr, 0, Math.PI * 2);
    g.clip();
    const sky = g.createLinearGradient(wx, wy - wr, wx, wy + wr);
    sky.addColorStop(0, '#dfe4f2');
    sky.addColorStop(1, '#a8c8d8');
    g.fillStyle = sky;
    g.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    // distant trees
    g.fillStyle = '#6e9b62';
    g.beginPath();
    g.ellipse(wx - 35, wy + 30, 30, 20, 0, 0, Math.PI * 2);
    g.ellipse(wx + 5, wy + 35, 35, 22, 0, 0, Math.PI * 2);
    g.ellipse(wx + 45, wy + 28, 28, 18, 0, 0, Math.PI * 2);
    g.fill();
    // sun
    g.fillStyle = '#ffd97a';
    g.beginPath();
    g.arc(wx + 30, wy - 25, 14, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // window frame
    g.strokeStyle = '#5a3820';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(wx, wy, wr, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(wx - wr, wy); g.lineTo(wx + wr, wy);
    g.moveTo(wx, wy - wr); g.lineTo(wx, wy + wr);
    g.stroke();

    // big rug under the grove
    g.save();
    g.fillStyle = '#e8a86a';
    g.beginPath();
    g.ellipse(W / 2, H * 0.78, 380, 80, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d96a6a';
    g.beginPath();
    g.ellipse(W / 2, H * 0.78, 320, 65, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8a86a';
    g.beginPath();
    g.ellipse(W / 2, H * 0.78, 250, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // a small bed on the right
    drawBed(g, W - 220, 460);
    // a table on the left
    drawTable(g, 220, 480);
    // kitchen station — a little wood-burning stove
    drawKitchen(g, 480, 480);
    // picture frames on wall
    drawFrame(g, 380, 160, 'silhouette');
    drawFrame(g, 460, 130, 'flowers');
    drawFrame(g, 540, 170, 'silhouette');

    // door at bottom-centre leading back outside
    drawInteriorDoor(g, W / 2, H - 30);

    // hanging beams + lantern positions (drawn dynamically per Glim, but bake
    // the beams + empty lantern hooks here)
    g.strokeStyle = '#5a3820';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(180, 70);
    g.lineTo(W - 180, 70);
    g.stroke();

    return {
      id: 'treehouse',
      name: 'Your Treehouse',
      bake: bg,
      bounds: { x: 60, y: 480, w: W - 120, h: 270 },     // walkable strip on the floor
      // spawn for "fresh enter from outside"
      spawn: { x: W / 2, y: 700 },
      portals: [
        // bottom door back to mossroot
        { rect: { x: W / 2 - 50, y: H - 80, w: 100, h: 80 },
          target: 'mossroot', spawn: 'door', prompt: 'Step Outside' },
      ],
      npcs: [
        { id: 'juno', x: 720, y: 600, kind: 'juno' },
      ],
      hotspots: {},
      // interaction position for the kitchen station (matches the stove bake)
      kitchen: { x: 480, y: 540 },
      // a cosy bed in the corner — sleep to restore Glim happiness
      bed: { x: 980, y: 580 },
      // we draw lantern positions (and caught Glims floating near them) at runtime
      lanternSlots: computeLanternSlots(W, window.GLIMS.length),
      draw(ctx, cam, time) {
        ctx.drawImage(bg, 0, 0);
      },
      drawForeground(ctx, cam, time, playerY, gameState) {
        // bed corner — quick sprite drawn from the scene's bed point
        if (this.bed) {
          drawBed(ctx, this.bed.x - cam.x, this.bed.y - cam.y);
        }
        // decor: wallpaper tints (drawn first, behind everything else)
        const decor = (gameState && gameState.save && gameState.save.decor) || {};
        if (decor['wallpaper-mint']) {
          ctx.save();
          ctx.fillStyle = 'rgba(200,236,223,0.28)';
          ctx.fillRect(0, 0, cam.w, 460);
          ctx.restore();
        }
        if (decor['wallpaper-twilight']) {
          ctx.save();
          ctx.fillStyle = 'rgba(139,122,168,0.30)';
          ctx.fillRect(0, 0, cam.w, 460);
          ctx.restore();
        }
        // decor: rugs on floor
        if (decor['rug-circle']) {
          drawRugCircle(ctx, 480 - cam.x, 660 - cam.y);
        }
        if (decor['rug-runner']) {
          drawRugRunner(ctx, 800 - cam.x, 700 - cam.y);
        }
        // decor: wind chime in window
        if (decor['chime-windowsill']) {
          drawWindowChime(ctx, 1150 - cam.x, 180 - cam.y, time);
        }
        // decor: plushies on the bench
        if (decor['plushie-cinder']) {
          drawPlushie(ctx, 220 - cam.x, 600 - cam.y, '#f5a986', '#e07654');
        }
        if (decor['plushie-tully']) {
          drawPlushie(ctx, 280 - cam.x, 600 - cam.y, '#a8d6d2', '#88c4c0');
        }
        // hung snapshot picture frames on the wall
        if (window.Snapshot) window.Snapshot.drawHungFrames(ctx, cam);
        // hanging lanterns
        const slots = this.lanternSlots;
        for (let i = 0; i < slots.length; i++) {
          const glim = window.GLIMS[i];
          if (!glim) continue;
          const caught = gameState.save.caught[glim.id];
          drawHangingLantern(ctx, slots[i].x, slots[i].y, time + i, caught ? glim : null,
                             caught ? caught.happiness : 0);
        }
      },
    };
  }

  function computeLanternSlots(W, count) {
    const slots = [];
    count = count || 8;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = 180 + t * (W - 360);
      const y = 70 + Math.sin(t * Math.PI) * -8;
      slots.push({ x, y: y + 70, glimIndex: i });
    }
    return slots;
  }

  function drawHangingLantern(ctx, x, y, time, glim, happiness) {
    ctx.save();
    // string
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    // lantern body
    ctx.fillStyle = glim ? glim.glow : '#a89a82';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 18);
    ctx.lineTo(x + 16, y - 18);
    ctx.lineTo(x + 18, y + 14);
    ctx.lineTo(x - 18, y + 14);
    ctx.closePath();
    ctx.fill();
    // top + bottom rims
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(x - 20, y - 22, 40, 6);
    ctx.fillRect(x - 22, y + 12, 44, 6);
    // glow inside if Glim caught
    if (glim) {
      const happy = happiness == null ? 0.7 : happiness;
      const glowSize = 22 + happy * 12;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, glowSize);
      grad.addColorStop(0, glim.color);
      grad.addColorStop(1, glim.glow + '00');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // a tiny Glim sprite floating just below the lantern, bobbing
      const bob = Math.sin(time * 0.001 + x * 0.01) * 4;
      window.Entities.drawGlimSprite(ctx, x, y + 60 + bob, 14, glim, time,
                                     (happiness == null || happiness > 0.5) ? 'happy' : null);
    } else {
      // dim — unknown silhouette below
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(x, y + 60, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBed(ctx, x, y) {
    ctx.save();
    // mattress shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 80, 110, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // bed frame
    ctx.fillStyle = '#5a3820';
    ctx.beginPath();
    ctx.roundRect(x - 100, y, 200, 70, 8);
    ctx.fill();
    // mattress
    ctx.fillStyle = '#f6ecd2';
    ctx.beginPath();
    ctx.roundRect(x - 95, y - 12, 190, 36, 10);
    ctx.fill();
    // blanket
    ctx.fillStyle = '#a8c8d8';
    ctx.beginPath();
    ctx.roundRect(x - 40, y - 14, 130, 38, 8);
    ctx.fill();
    // pillow
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.roundRect(x - 90, y - 16, 50, 26, 8);
    ctx.fill();
    ctx.restore();
  }

  function drawTable(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 60, 80, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b6a4a';
    ctx.beginPath();
    ctx.roundRect(x - 60, y, 120, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(x - 50, y + 12, 8, 50);
    ctx.fillRect(x + 42, y + 12, 8, 50);
    // a tea kettle
    ctx.fillStyle = '#d96a6a';
    ctx.beginPath();
    ctx.ellipse(x + 25, y - 8, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 22, y - 24, 6, 8);
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(x + 25, y - 24, 4, 0, Math.PI * 2);
    ctx.fill();
    // a book
    ctx.fillStyle = '#5a7a8a';
    ctx.fillRect(x - 40, y - 6, 30, 8);
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(x - 40, y - 6, 30, 2);
    ctx.restore();
  }

  function drawFrame(ctx, x, y, content) {
    ctx.save();
    ctx.fillStyle = '#5a3820';
    ctx.beginPath();
    ctx.roundRect(x - 28, y - 20, 56, 40, 4);
    ctx.fill();
    ctx.fillStyle = '#f6ecd2';
    ctx.fillRect(x - 24, y - 16, 48, 32);
    if (content === 'silhouette') {
      ctx.fillStyle = '#8b7aa8';
      ctx.beginPath();
      ctx.arc(x, y + 4, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (content === 'flowers') {
      ctx.fillStyle = '#f6c2cf';
      ctx.beginPath();
      ctx.arc(x - 6, y, 5, 0, Math.PI * 2);
      ctx.arc(x + 6, y, 5, 0, Math.PI * 2);
      ctx.arc(x, y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawKitchen(ctx, x, y) {
    // a cozy wood-burning stove with a kettle on top + a counter beside it
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 64, 92, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // counter (right of the stove)
    ctx.fillStyle = '#8b6a4a';
    ctx.beginPath();
    ctx.roundRect(x + 30, y + 4, 100, 56, 4);
    ctx.fill();
    ctx.fillStyle = '#a07050';
    ctx.beginPath();
    ctx.roundRect(x + 30, y + 4, 100, 8, 4);
    ctx.fill();
    // a jar of moonberries on the counter
    ctx.fillStyle = '#5a7a8a';
    ctx.beginPath();
    ctx.roundRect(x + 50, y - 16, 16, 22, 3);
    ctx.fill();
    ctx.fillStyle = '#8b7aa8';
    ctx.beginPath();
    ctx.arc(x + 54, y - 6, 2, 0, Math.PI * 2);
    ctx.arc(x + 60, y - 2, 2, 0, Math.PI * 2);
    ctx.arc(x + 56, y + 2, 2, 0, Math.PI * 2);
    ctx.fill();
    // a tiny bowl with sugarbuds
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.ellipse(x + 100, y - 2, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6c2cf';
    ctx.beginPath();
    ctx.arc(x + 95, y - 5, 2, 0, Math.PI * 2);
    ctx.arc(x + 100, y - 6, 2, 0, Math.PI * 2);
    ctx.arc(x + 105, y - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // stove body
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.roundRect(x - 36, y - 8, 70, 64, 8);
    ctx.fill();
    // stove front plate
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.roundRect(x - 32, y - 4, 62, 50, 6);
    ctx.fill();
    // fire hole
    const fire = ctx.createRadialGradient(x, y + 24, 2, x, y + 24, 16);
    fire.addColorStop(0, '#ffd97a');
    fire.addColorStop(0.5, '#f2a07b');
    fire.addColorStop(1, '#5a2010');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.ellipse(x, y + 24, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // grate lines
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 5, y + 18);
      ctx.lineTo(x + i * 5, y + 30);
      ctx.stroke();
    }
    // top plate
    ctx.fillStyle = '#2a1808';
    ctx.beginPath();
    ctx.roundRect(x - 40, y - 12, 78, 10, 4);
    ctx.fill();
    // chimney up the wall
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x - 6, y - 80, 12, 70);
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x - 10, y - 86, 20, 8);

    // kettle on top
    ctx.fillStyle = '#d96a6a';
    ctx.beginPath();
    ctx.ellipse(x + 14, y - 18, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a83a3a';
    ctx.beginPath();
    ctx.ellipse(x + 14, y - 22, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // kettle handle
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 14, y - 26, 8, Math.PI, 0);
    ctx.stroke();
    // spout
    ctx.fillStyle = '#d96a6a';
    ctx.beginPath();
    ctx.moveTo(x + 26, y - 18);
    ctx.lineTo(x + 36, y - 22);
    ctx.lineTo(x + 36, y - 18);
    ctx.lineTo(x + 26, y - 14);
    ctx.closePath();
    ctx.fill();
    // a little steam puff
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(x + 38, y - 30, 4, 0, Math.PI * 2);
    ctx.arc(x + 42, y - 36, 5, 0, Math.PI * 2);
    ctx.arc(x + 47, y - 44, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawInteriorDoor(ctx, x, baseY) {
    ctx.save();
    const w = 90, h = 110;
    // frame
    ctx.fillStyle = '#5a3820';
    roundedArchPath(ctx, x - w / 2 - 4, baseY - h - 4, w + 8, h + 4);
    ctx.fill();
    // door
    ctx.fillStyle = '#a07050';
    roundedArchPath(ctx, x - w / 2, baseY - h, w, h);
    ctx.fill();
    // planks
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + (w / 4) * i, baseY - h + 12);
      ctx.lineTo(x - w / 2 + (w / 4) * i, baseY);
      ctx.stroke();
    }
    // knob
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(x + w / 2 - 12, baseY - h / 2 + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------
  //   Honeydrop Meadow — sunny, bee-buzzing, open biome
  // ------------------------------------------------------------------
  function buildHoneydrop() {
    const W = 2200, H = 1500;

    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const r = rng(23);

    // warm meadow base — buttery yellow with green undertones
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,    '#f6e6a8');
    base.addColorStop(0.5,  '#e8d488');
    base.addColorStop(1,    '#c8c060');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // soft grass-clump blobs
    for (let i = 0; i < 40; i++) {
      paintBlob(g, r() * W, r() * H, 120 + r() * 200, '#c8d878', 0.35);
    }
    for (let i = 0; i < 60; i++) {
      paintBlob(g, r() * W, r() * H, 50 + r() * 90, '#b0c068', 0.4);
    }
    // sun-warm patches
    for (let i = 0; i < 18; i++) {
      paintBlob(g, r() * W, r() * H, 180 + r() * 220, '#ffe8a0', 0.3);
    }

    // a winding meadow path
    const pathPts = [
      { x: 60, y: H * 0.42 },   // entrance from Mossroot (left side)
      { x: 260, y: H * 0.48 },
      { x: 460, y: H * 0.55 },
      { x: 700, y: H * 0.58 },
      { x: 980, y: H * 0.6 },
      { x: 1240, y: H * 0.58 },
      { x: 1480, y: H * 0.62 },
      { x: 1700, y: H * 0.68 },
      { x: 1900, y: H * 0.74 },
    ];
    drawSmoothPath(g, pathPts, '#b89a72', 48, 0.6);
    drawSmoothPath(g, pathPts, '#d4b890', 32, 0.85);

    // scattered tall-grass tufts
    for (let i = 0; i < 280; i++) {
      const x = r() * W;
      const y = 100 + r() * (H - 200);
      drawGrassTuft(g, x, y, r);
    }

    // wildflower patches — bigger, brighter than Mossroot
    const flowerColors = ['#f6c2cf', '#ffd97a', '#d4c4e4', '#f5a986', '#fff0aa', '#e8a8c0'];
    for (let i = 0; i < 220; i++) {
      const x = r() * W;
      const y = 120 + r() * (H - 220);
      const col = flowerColors[Math.floor(r() * flowerColors.length)];
      drawMeadowFlower(g, x, y, 5 + r() * 4, col, r);
    }

    // a beehive on a tree (right-of-centre)
    drawBeehiveTree(g, 1300, 700);

    // a picnic blanket in a clearing
    drawPicnicBlanket(g, 800, 900);

    // a couple of sun-leaning trees (sparse)
    const trees = [
      { x: 360,  y: 880, size: 130, kind: 'birch', seed: 11 },
      { x: 1600, y: 1100, size: 150, kind: 'oak',  seed: 22 },
      { x: 1900, y: 480,  size: 120, kind: 'birch', seed: 33 },
      { x: 120,  y: 1100, size: 110, kind: 'birch', seed: 44 },
    ];
    for (const t of trees) drawTreeTrunk(g, t);
    for (const t of trees) drawTreeCanopy(g, t);

    // entrance signpost just inside Honeydrop
    drawSignpost(g, 140, 480, 'Honeydrop Meadow');
    // signpost back toward Mossroot
    drawSignpost(g, 80,  H * 0.42 - 20, '\u2190 Mossroot');

    // gentle vignette
    const vig = g.createRadialGradient(W/2, H/2, Math.min(W, H) * 0.45,
                                       W/2, H/2, Math.max(W, H) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(74,58,44,0.22)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    // hotspots Glims like to drift toward
    const flowerSpots = [];
    for (let i = 0; i < 14; i++) {
      flowerSpots.push({ x: 200 + r() * (W - 400), y: 200 + r() * (H - 400) });
    }

    return {
      id: 'honeydrop',
      name: 'Honeydrop Meadow',
      bake: bg,
      bounds: { x: 0, y: 0, w: W, h: H },
      spawn: { x: 240, y: 600 },
      spawnPoints: {
        fromMossroot: { x: 200, y: 700 },
        fromTidepools: { x: 2200 - 140, y: 1500 * 0.74 },
      },
      npcs: [
        { id: 'wren', x: 1340, y: 800, kind: 'wren' },
      ],
      portals: [
        // back to mossroot from the left edge
        { rect: { x: 0, y: H * 0.42 - 50, w: 90, h: 140 },
          target: 'mossroot', spawn: 'fromHoneydrop',
          prompt: 'Return to Mossroot Hollow' },
        // east to tidepools — gated by 5 caught Glims
        { rect: { x: W - 90, y: H * 0.74 - 50, w: 90, h: 140 },
          target: 'tidepools', spawn: 'fromHoneydrop',
          prompt: 'Follow the sound of waves',
          gated: { type: 'caught', min: 5,
                   lockedPrompt: 'Befriend 5 Glims to hear the tide' } },
      ],
      hotspots: {
        flowers: flowerSpots,
        path: pathPts,
        beehive: [{ x: 1300, y: 760 }, { x: 1240, y: 720 }],
        picnic: [{ x: 800, y: 920 }, { x: 760, y: 880 }, { x: 840, y: 940 }],
        trees: trees.map(t => ({ x: t.x, y: t.y })),
      },
      trees,
      draw(ctx, cam, time) {
        ctx.drawImage(bg,
          cam.x, cam.y, cam.w, cam.h,
          0,     0,     cam.w, cam.h);
      },
      drawForeground(ctx, cam, time, playerY) {
        for (const t of trees) {
          if (t.y - 20 > playerY) {
            const sx = t.x - cam.x;
            const sy = t.y - cam.y;
            if (sx < -200 || sy < -200 || sx > cam.w + 200 || sy > cam.h + 200) continue;
            drawTreeCanopy(ctx, { x: sx, y: sy, size: t.size, seed: t.seed, kind: t.kind });
          }
        }
        // floating bees near the beehive (animated)
        drawBees(ctx, 1300 - cam.x, 760 - cam.y, time);
      },
    };
  }

  function drawGrassTuft(ctx, x, y, r) {
    ctx.save();
    ctx.strokeStyle = r() < 0.5 ? '#9bbf6a' : '#b8d088';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
      const dx = (r() - 0.5) * 8;
      const h = 6 + r() * 8;
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.quadraticCurveTo(x + dx + (r() - 0.5) * 4, y - h * 0.6,
                            x + dx + (r() - 0.5) * 4, y - h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMeadowFlower(ctx, x, y, sz, color, r) {
    ctx.save();
    // stem
    ctx.strokeStyle = '#6e9b62';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 4, y - sz, x, y - sz * 2);
    ctx.stroke();
    // petals
    const n = 5 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * sz * 0.5,
                  y - sz * 2 + Math.sin(a) * sz * 0.5,
                  sz * 0.4, sz * 0.65, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // centre
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(x, y - sz * 2, sz * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBeehiveTree(ctx, x, y) {
    // a thicker tree with a hexagonal honeycomb hive on the side
    const t = { x, y: y + 60, size: 200, kind: 'oak', seed: 77 };
    drawTreeTrunk(ctx, t);
    drawTreeCanopy(ctx, t);
    ctx.save();
    // hive — rounded teardrop on the side of the trunk
    const hx = x + 30;
    const hy = y;
    ctx.fillStyle = '#d49a4a';
    ctx.beginPath();
    ctx.moveTo(hx, hy - 36);
    ctx.bezierCurveTo(hx + 36, hy - 30, hx + 36, hy + 30, hx, hy + 36);
    ctx.bezierCurveTo(hx - 36, hy + 30, hx - 36, hy - 30, hx, hy - 36);
    ctx.fill();
    // stripes
    ctx.strokeStyle = '#8b6a3a';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hx - 30, hy + i * 12);
      ctx.quadraticCurveTo(hx, hy + i * 12 + (i === 0 ? 2 : 0), hx + 30, hy + i * 12);
      ctx.stroke();
    }
    // entrance hole
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.ellipse(hx, hy + 10, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPicnicBlanket(ctx, x, y) {
    ctx.save();
    // checkered red/cream blanket
    ctx.translate(x, y);
    ctx.rotate(-0.08);
    const w = 220, h = 150;
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 6);
    ctx.fill();
    const cells = 8;
    const cw = w / cells, ch = h / cells;
    ctx.fillStyle = '#d96a6a';
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        if ((i + j) % 2 === 0) continue;
        ctx.fillRect(-w/2 + i * cw, -h/2 + j * ch, cw, ch);
      }
    }
    ctx.strokeStyle = '#8b3a3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 6);
    ctx.stroke();
    // a basket on the blanket
    ctx.fillStyle = '#8b6a4a';
    ctx.beginPath();
    ctx.ellipse(20, -10, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a07050';
    ctx.beginPath();
    ctx.ellipse(20, -14, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // basket handle
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(20, -16, 22, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawBees(ctx, x, y, time) {
    // three little bees orbiting the hive — purely cosmetic, foreground only
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const t = time * 0.001 + i * 2;
      const rx = 50 + i * 8;
      const ry = 24 + i * 4;
      const bx = x + Math.cos(t + i) * rx;
      const by = y + Math.sin(t * 1.3 + i) * ry;
      // body
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.ellipse(bx, by, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(bx - 2, by - 1.5, 4, 1.5);
      // wings
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(bx - 1, by - 3, 3, 1.5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(bx + 1, by - 3, 3, 1.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  //   Whispering Tidepools — coastal biome, calm pools + soft surf
  // ------------------------------------------------------------------
  function buildTidepools() {
    const W = 2200, H = 1400;
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const r = rng(57);

    // sand-to-sea gradient
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,    '#f4e4c0');
    base.addColorStop(0.45, '#e8d6a8');
    base.addColorStop(0.65, '#a8c8c8');
    base.addColorStop(1,    '#6aa0b0');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // damp sand blobs
    for (let i = 0; i < 50; i++) {
      paintBlob(g, r() * W, 100 + r() * (H * 0.5), 100 + r() * 180, '#d4c090', 0.3);
    }
    // foam blobs along surf line
    for (let i = 0; i < 80; i++) {
      paintBlob(g, r() * W, H * 0.6 + r() * (H * 0.3), 30 + r() * 80, '#fff5e8', 0.45);
    }

    // tidepools — small oval pools dotted across the upper sand
    const pools = [];
    for (let i = 0; i < 9; i++) {
      const px = 200 + r() * (W - 400);
      const py = 220 + r() * (H * 0.4);
      const pw = 90 + r() * 80;
      const ph = pw * (0.55 + r() * 0.2);
      pools.push({ x: px, y: py, w: pw, h: ph });
      // outer wet rim
      g.save();
      g.fillStyle = '#7aa8a8';
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(px, py, pw / 2 + 8, ph / 2 + 6, 0, 0, Math.PI * 2);
      g.fill();
      // water
      const pg = g.createRadialGradient(px, py, 4, px, py, pw / 2);
      pg.addColorStop(0, '#bfe8e8');
      pg.addColorStop(1, '#7ab4c0');
      g.fillStyle = pg;
      g.globalAlpha = 0.95;
      g.beginPath();
      g.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
      g.fill();
      // highlight
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.ellipse(px - pw * 0.18, py - ph * 0.22, pw * 0.18, ph * 0.08, -0.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // scattered shells + pebbles
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      const y = 140 + r() * (H * 0.55);
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      const c = ['#f4d4c0', '#e8b8a8', '#fff0d8', '#d8a890'][Math.floor(r() * 4)];
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(0, 0, 6 + r() * 4, 4 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(60,40,30,0.3)';
      g.lineWidth = 0.6;
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.arc(0, 0, 2 + j, -0.5, 0.5);
        g.stroke();
      }
      g.restore();
    }

    // sea-grass tufts along pool edges
    for (let i = 0; i < 140; i++) {
      drawGrassTuft(g, r() * W, 200 + r() * (H * 0.55), r);
    }

    // soft surf lines
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2 + r() * 2;
      g.beginPath();
      const sy = H * 0.65 + i * 30 + r() * 20;
      g.moveTo(0, sy);
      for (let x = 0; x <= W; x += 60) {
        g.lineTo(x, sy + Math.sin(x * 0.013 + i) * 6);
      }
      g.stroke();
    }

    // signposts
    drawSignpost(g, 80, H * 0.74 - 20, '← Honeydrop');
    drawSignpost(g, W - 220, 220, 'Starpetal Path ↑');

    // vignette
    const vig = g.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.45,
                                       W/2, H/2, Math.max(W,H) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(40,60,80,0.28)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    return {
      id: 'tidepools',
      name: 'Whispering Tidepools',
      bake: bg,
      bounds: { x: 0, y: 0, w: W, h: H },
      spawn: { x: 200, y: H * 0.74 },
      spawnPoints: {
        fromHoneydrop: { x: 160, y: H * 0.74 },
        fromStarpetal: { x: W - 240, y: 280 },
      },
      npcs: [
        { id: 'marlowe', x: 800, y: H * 0.7, kind: 'marlowe' },
      ],
      portals: [
        // back to honeydrop, left edge
        { rect: { x: 0, y: H * 0.74 - 70, w: 90, h: 140 },
          target: 'honeydrop', spawn: 'fromTidepools',
          prompt: 'Back to Honeydrop Meadow' },
        // up to starpetal, top-right
        { rect: { x: W - 200, y: 100, w: 140, h: 100 },
          target: 'starpetal', spawn: 'fromTidepools',
          prompt: 'Climb the Starpetal Path',
          gated: { type: 'caught', min: 8,
                   lockedPrompt: 'Befriend 8 Glims to climb safely' } },
      ],
      hotspots: {
        pools: pools.map(p => ({ x: p.x, y: p.y })),
        shells: [{ x: 400, y: 380 }, { x: 1200, y: 320 }, { x: 1700, y: 460 }],
        surf:  [{ x: 600, y: H * 0.78 }, { x: 1400, y: H * 0.82 }, { x: 1900, y: H * 0.75 }],
      },
      draw(ctx, cam) {
        ctx.drawImage(bg, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
      },
      drawForeground(ctx, cam, time) {
        // animated water ripples in pools
        ctx.save();
        for (const p of pools) {
          const sx = p.x - cam.x;
          const sy = p.y - cam.y;
          if (sx < -200 || sx > cam.w + 200) continue;
          const t = (time * 0.0008) % 1;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - t)) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(sx, sy, (p.w / 2) * (0.3 + t * 0.7),
                              (p.h / 2) * (0.3 + t * 0.7), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  }

  // ------------------------------------------------------------------
  //   Starpetal Peaks — night biome, cairns, telescope, constellations
  // ------------------------------------------------------------------
  function buildStarpetal() {
    const W = 2000, H = 1400;
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const r = rng(91);

    // deep twilight gradient
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    '#1f1c3a');
    sky.addColorStop(0.5,  '#3b3270');
    sky.addColorStop(1,    '#5a4a82');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // distant misty peaks
    g.fillStyle = 'rgba(90,80,140,0.6)';
    g.beginPath();
    g.moveTo(0, H * 0.5);
    for (let x = 0; x <= W; x += 80) {
      const h = 90 + Math.sin(x * 0.005) * 50 + (r() - 0.5) * 30;
      g.lineTo(x, H * 0.5 - h);
    }
    g.lineTo(W, H); g.lineTo(0, H);
    g.fill();
    g.fillStyle = 'rgba(60,55,110,0.7)';
    g.beginPath();
    g.moveTo(0, H * 0.62);
    for (let x = 0; x <= W; x += 100) {
      const h = 130 + Math.cos(x * 0.004 + 1) * 70 + (r() - 0.5) * 40;
      g.lineTo(x, H * 0.62 - h);
    }
    g.lineTo(W, H); g.lineTo(0, H);
    g.fill();

    // ground tone
    const ground = g.createLinearGradient(0, H * 0.7, 0, H);
    ground.addColorStop(0, '#2a2348');
    ground.addColorStop(1, '#1a1632');
    g.fillStyle = ground;
    g.fillRect(0, H * 0.7, W, H * 0.3);

    // stars
    const stars = [];
    for (let i = 0; i < 220; i++) {
      const x = r() * W;
      const y = r() * (H * 0.6);
      const s = 0.5 + r() * 1.6;
      g.fillStyle = 'rgba(255,250,220,' + (0.4 + r() * 0.6) + ')';
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
      if (s > 1.3) stars.push({ x, y });
    }
    // a fat moon
    g.save();
    g.fillStyle = '#fdf3c4';
    g.shadowColor = 'rgba(253,243,196,0.7)';
    g.shadowBlur = 40;
    g.beginPath();
    g.arc(W * 0.78, 200, 56, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // a winding mountain path
    const pathPts = [
      { x: 60,  y: 280 },
      { x: 280, y: 380 },
      { x: 540, y: 520 },
      { x: 820, y: 680 },
      { x: 1100,y: 820 },
      { x: 1400,y: 940 },
      { x: 1700,y: 1080 },
      { x: 1940,y: 1180 },
    ];
    drawSmoothPath(g, pathPts, '#3a345e', 60, 0.7);
    drawSmoothPath(g, pathPts, '#5a548a', 40, 0.85);

    // cairns (stacked stones) along the path
    const cairns = [];
    for (let i = 0; i < 8; i++) {
      const p = pathPts[1 + i % (pathPts.length - 1)];
      const cx = p.x + (r() - 0.5) * 140;
      const cy = p.y + 40 + r() * 40;
      cairns.push({ x: cx, y: cy });
      g.save();
      for (let k = 0; k < 4; k++) {
        const sw = 28 - k * 5;
        g.fillStyle = '#3e3a5e';
        g.beginPath();
        g.ellipse(cx, cy - k * 11, sw, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.15)';
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(cx - 4, cy - k * 11 - 2, sw * 0.6, 3, -0.2, 0, Math.PI);
        g.stroke();
      }
      g.restore();
    }

    // a telescope on the highest cairn-clearing
    drawTelescope(g, 1500, 760);

    // signposts
    drawSignpost(g, 100, 240, '← Tidepools');
    drawSignpost(g, W - 240, 1180, 'Observatory ↑');

    // soft starlight wash
    const vig = g.createRadialGradient(W * 0.78, 200, 100,
                                       W * 0.78, 200, Math.max(W, H));
    vig.addColorStop(0, 'rgba(253,243,196,0.18)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    return {
      id: 'starpetal',
      name: 'Starpetal Peaks',
      bake: bg,
      bounds: { x: 0, y: 0, w: W, h: H },
      spawn: { x: 160, y: 320 },
      spawnPoints: {
        fromTidepools: { x: 160, y: 320 },
        fromWinter:    { x: 2000 - 180, y: 1100 },
      },
      npcs: [
        { id: 'astra', x: 1500, y: 740, kind: 'astra' },
      ],
      portals: [
        // back to tidepools, top-left edge
        { rect: { x: 0, y: 220, w: 90, h: 140 },
          target: 'tidepools', spawn: 'fromStarpetal',
          prompt: 'Down to the Tidepools' },
        // up to winter grove, far end of the path
        { rect: { x: W - 220, y: 1080, w: 180, h: 120 },
          target: 'winter', spawn: 'fromStarpetal',
          prompt: 'Follow the snowy path',
          gated: { type: 'caught', min: 14,
                   lockedPrompt: 'Befriend 14 Glims to find the snowy path' } },
      ],
      hotspots: {
        cairns,
        path: pathPts,
        telescope: [{ x: 1500, y: 760 }],
        peaks: [{ x: 400, y: 360 }, { x: 1000, y: 540 }, { x: 1700, y: 960 }],
      },
      stars,
      draw(ctx, cam) {
        ctx.drawImage(bg, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
      },
      drawForeground(ctx, cam, time) {
        // gentle star twinkle — pick a few stars and pulse alpha
        ctx.save();
        for (let i = 0; i < 30; i++) {
          const s = stars[(i * 7) % stars.length];
          if (!s) continue;
          const sx = s.x - cam.x;
          const sy = s.y - cam.y;
          if (sx < 0 || sy < 0 || sx > cam.w || sy > cam.h) continue;
          const a = 0.3 + Math.abs(Math.sin(time * 0.001 + i)) * 0.7;
          ctx.fillStyle = 'rgba(255,250,220,' + a + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  }

  // ------------------------------------------------------------------
  //   Winter Grove — snow-dusted forest, frozen pond, crystalline trees
  // ------------------------------------------------------------------
  function buildWinter() {
    const W = 2200, H = 1500;
    const bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const r = rng(143);

    // cool blue-violet snow gradient
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0,   '#cdd6e8');
    base.addColorStop(0.5, '#dde4f0');
    base.addColorStop(1,   '#e8edf6');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // soft drift blobs
    for (let i = 0; i < 60; i++) {
      paintBlob(g, r() * W, r() * H, 120 + r() * 220, '#ffffff', 0.3);
    }
    for (let i = 0; i < 90; i++) {
      paintBlob(g, r() * W, r() * H, 40 + r() * 80, '#f4f6fa', 0.45);
    }

    // a winding snow path
    const pathPts = [
      { x: 60,  y: 120 },
      { x: 300, y: 240 },
      { x: 540, y: 360 },
      { x: 820, y: 520 },
      { x: 1100,y: 620 },
      { x: 1420,y: 700 },
      { x: 1700,y: 880 },
      { x: 1980,y: 1080 },
    ];
    drawSmoothPath(g, pathPts, '#c0c8d8', 52, 0.6);
    drawSmoothPath(g, pathPts, '#e0e6f0', 34, 0.85);

    // frozen pond
    g.save();
    g.fillStyle = '#a8c4d8';
    g.beginPath();
    g.ellipse(1500, 420, 240, 140, 0.05, 0, Math.PI * 2);
    g.fill();
    const pondG = g.createRadialGradient(1500, 400, 20, 1500, 420, 260);
    pondG.addColorStop(0, '#dfeaf2');
    pondG.addColorStop(1, '#88a8c4');
    g.fillStyle = pondG;
    g.beginPath();
    g.ellipse(1500, 420, 230, 132, 0.05, 0, Math.PI * 2);
    g.fill();
    // crack lines
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(1500 + (r() - 0.5) * 200, 420 + (r() - 0.5) * 100);
      g.lineTo(1500 + (r() - 0.5) * 200, 420 + (r() - 0.5) * 100);
      g.stroke();
    }
    g.restore();

    // crystalline pine trees — triangular with frost dust
    const trees = [];
    for (let i = 0; i < 30; i++) {
      const x = 80 + r() * (W - 160);
      const y = 200 + r() * (H - 320);
      const size = 80 + r() * 70;
      trees.push({ x, y, size, kind: 'pine', seed: Math.floor(r() * 999) });
    }
    for (const t of trees) drawPineTree(g, t);

    // scattered snowy tufts + tiny pinecones
    for (let i = 0; i < 200; i++) {
      drawSnowTuft(g, r() * W, r() * H, r);
    }

    // signposts
    drawSignpost(g, 100, 100, '← Starpetal');
    drawSignpost(g, 1400, 380, 'Frozen Pond');

    // gentle cool vignette
    const vig = g.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.45,
                                       W/2, H/2, Math.max(W,H) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(60,80,120,0.25)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    return {
      id: 'winter',
      name: 'Winter Grove',
      bake: bg,
      bounds: { x: 0, y: 0, w: W, h: H },
      spawn: { x: 150, y: 200 },
      spawnPoints: {
        fromStarpetal: { x: 150, y: 200 },
      },
      npcs: [
        { id: 'vela', x: 1500, y: 480, kind: 'vela' },
      ],
      portals: [
        { rect: { x: 0, y: 100, w: 90, h: 160 },
          target: 'starpetal', spawn: 'fromWinter',
          prompt: 'Back to Starpetal' },
      ],
      hotspots: {
        path: pathPts,
        pond: [{ x: 1500, y: 420 }, { x: 1420, y: 460 }, { x: 1580, y: 380 }],
        trees: trees.map(t => ({ x: t.x, y: t.y })),
      },
      trees,
      draw(ctx, cam) {
        ctx.drawImage(bg, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
      },
      drawForeground(ctx, cam, time, playerY) {
        // foreground trees in front of player
        for (const t of trees) {
          if (t.y > playerY) {
            const sx = t.x - cam.x;
            const sy = t.y - cam.y;
            if (sx < -200 || sy < -200 || sx > cam.w + 200 || sy > cam.h + 200) continue;
            drawPineTree(ctx, { x: sx, y: sy, size: t.size, seed: t.seed });
          }
        }
        // gentle drifting snowflakes
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 40; i++) {
          const t = (time * 0.0001 + i * 0.31) % 1;
          const x = (i * 173) % cam.w + Math.sin(time * 0.001 + i) * 14;
          const y = (t * (cam.h + 40)) - 20;
          ctx.beginPath();
          ctx.arc(x, y, 1.4 + (i % 3) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    };
  }

  function drawPineTree(ctx, t) {
    const { x, y, size } = t;
    ctx.save();
    // trunk
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x - 4, y - size * 0.18, 8, size * 0.18);
    // three triangle tiers (large to small)
    const tiers = [
      { w: size * 0.85, h: size * 0.45, yo: -size * 0.18 },
      { w: size * 0.65, h: size * 0.40, yo: -size * 0.45 },
      { w: size * 0.45, h: size * 0.35, yo: -size * 0.72 },
    ];
    for (const tier of tiers) {
      ctx.fillStyle = '#3a5a4a';
      ctx.beginPath();
      ctx.moveTo(x - tier.w / 2, y + tier.yo);
      ctx.lineTo(x + tier.w / 2, y + tier.yo);
      ctx.lineTo(x, y + tier.yo - tier.h);
      ctx.closePath();
      ctx.fill();
      // snow cap
      ctx.fillStyle = '#f6f9ff';
      ctx.beginPath();
      ctx.moveTo(x - tier.w / 2, y + tier.yo);
      ctx.quadraticCurveTo(x, y + tier.yo - tier.h * 0.2, x + tier.w / 2, y + tier.yo);
      ctx.lineTo(x + tier.w * 0.4, y + tier.yo + 2);
      ctx.lineTo(x - tier.w * 0.4, y + tier.yo + 2);
      ctx.closePath();
      ctx.fill();
    }
    // tiny star/crystal at the top
    ctx.fillStyle = '#dceaff';
    ctx.beginPath();
    ctx.arc(x, y + tiers[2].yo - tiers[2].h - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSnowTuft(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * 6, y + (r() - 0.5) * 4,
              1 + r() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBed(ctx, x, y) {
    ctx.save();
    // frame
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x - 70, y - 24, 140, 48);
    // mattress
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.roundRect(x - 64, y - 28, 128, 36, 6);
    ctx.fill();
    // quilt — patchwork of three colours
    ctx.fillStyle = '#f6c2cf';
    ctx.fillRect(x - 64, y - 12, 42, 20);
    ctx.fillStyle = '#b6dc8a';
    ctx.fillRect(x - 22, y - 12, 44, 20);
    ctx.fillStyle = '#a8d6d2';
    ctx.fillRect(x + 22, y - 12, 42, 20);
    // pillow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x - 60, y - 26, 36, 18, 4);
    ctx.fill();
    // headboard
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x - 70, y - 36, 8, 12);
    ctx.fillRect(x + 62, y - 36, 8, 12);
    ctx.restore();
  }

  function drawRugCircle(ctx, x, y) {
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 6, x, y, 80);
    grad.addColorStop(0, '#d96a6a');
    grad.addColorStop(1, '#8a3838');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, 80, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // cream centre ring
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.ellipse(x, y, 38, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // fringe
    ctx.strokeStyle = '#5a3030';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x1 = x + Math.cos(a) * 80;
      const y1 = y + Math.sin(a) * 30;
      const x2 = x + Math.cos(a) * 88;
      const y2 = y + Math.sin(a) * 34;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRugRunner(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#7088a8';
    ctx.beginPath();
    ctx.roundRect(x - 160, y - 22, 320, 44, 6);
    ctx.fill();
    // cream stripes
    ctx.fillStyle = '#fff5dc';
    for (let i = -150; i < 150; i += 40) {
      ctx.fillRect(x + i, y - 18, 16, 36);
    }
    // border
    ctx.strokeStyle = '#3a4a64';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - 160, y - 22, 320, 44, 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawWindowChime(ctx, x, y, time) {
    ctx.save();
    // mount
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(x - 14, y - 4, 28, 4);
    // strings
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const sway = Math.sin(time * 0.001 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + i * 6, y);
      ctx.lineTo(x + i * 6 + sway, y + 30 + Math.abs(i) * 4);
      ctx.stroke();
    }
    // chimes
    ctx.fillStyle = '#d4a85a';
    for (let i = -2; i <= 2; i++) {
      const sway = Math.sin(time * 0.001 + i) * 1.5;
      ctx.beginPath();
      ctx.roundRect(x + i * 6 + sway - 2, y + 30 + Math.abs(i) * 4, 4, 14, 1.5);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlushie(ctx, x, y, body, accent) {
    ctx.save();
    // little stuffed Glim — round body + dot eyes
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    // halo
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // stitched eyes
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // a tiny stitched smile
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y + 1, 3, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawTelescope(ctx, x, y) {
    ctx.save();
    // tripod
    ctx.strokeStyle = '#a08858';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 28); ctx.lineTo(x, y);
    ctx.moveTo(x + 14, y + 28); ctx.lineTo(x, y);
    ctx.moveTo(x,      y + 32); ctx.lineTo(x, y);
    ctx.stroke();
    // tube
    ctx.fillStyle = '#5a4a82';
    ctx.save();
    ctx.translate(x, y - 6);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.roundRect(-6, -28, 12, 36, 5);
    ctx.fill();
    // gold ring
    ctx.fillStyle = '#d4a85a';
    ctx.fillRect(-6, -6, 12, 3);
    // lens
    ctx.fillStyle = '#fdf3c4';
    ctx.beginPath();
    ctx.arc(0, -28, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ------------------------------------------------------------------
  //   Public API
  // ------------------------------------------------------------------
  let _scenes = null;
  return {
    getScenes() {
      if (!_scenes) _scenes = {
        mossroot:  buildMossroot(),
        treehouse: buildTreehouse(),
        honeydrop: buildHoneydrop(),
        tidepools: buildTidepools(),
        starpetal: buildStarpetal(),
        winter:    buildWinter(),
      };
      return _scenes;
    },
  };
})();
