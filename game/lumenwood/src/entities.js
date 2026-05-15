// ---------------------------------------------------------------------------
// Entities — Player, Glim, Bubble. Each has update(dt, scene, game) and
// draw(ctx, camera, time). Game state owns the lists; entities own their
// own internal state.
// ---------------------------------------------------------------------------

window.Entities = (function () {

  // =========================================================================
  // PLAYER
  // =========================================================================
  function Player(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      facing: 'down',
      moving: false,
      bobPhase: 0,
      bubbleCooldown: 0,
      totalDistance: 0,
      // soft circle hitbox for portal detection
      radius: 14,
    };
  }

  function updatePlayer(p, dt, scene) {
    const speed = 220; // px/s
    let dx = 0, dy = 0;
    if (Input.isDown('up'))    dy -= 1;
    if (Input.isDown('down'))  dy += 1;
    if (Input.isDown('left'))  dx -= 1;
    if (Input.isDown('right')) dx += 1;
    if (dx || dy) {
      const m = Math.hypot(dx, dy);
      dx /= m; dy /= m;
      p.x += dx * speed * dt;
      p.y += dy * speed * dt;
      p.totalDistance += speed * dt;
      p.moving = true;
      p.bobPhase += dt * 9;
      // pick facing from primary axis
      if (Math.abs(dx) > Math.abs(dy)) p.facing = dx > 0 ? 'right' : 'left';
      else                              p.facing = dy > 0 ? 'down'  : 'up';
    } else {
      p.moving = false;
    }
    // clamp to scene walkable bounds
    const b = scene.bounds;
    p.x = Math.max(b.x + 20, Math.min(b.x + b.w - 20, p.x));
    p.y = Math.max(b.y + 30, Math.min(b.y + b.h - 10, p.y));

    if (p.bubbleCooldown > 0) p.bubbleCooldown -= dt;
  }

  // appearance lookup with fallback. window.SAVE_GAME is set by game.js
  // so the same draw function works across calls.
  function appearance() {
    const def = { skin: '#f0c8a0', hair: '#5a3820', hairStyle: 'short',
                  outfit: '#6b9166', hat: '#d96a6a' };
    const a = (window.SAVE_GAME && window.SAVE_GAME.save && window.SAVE_GAME.save.appearance);
    return a ? Object.assign(def, a) : def;
  }

  function drawPlayer(ctx, p, camera, time) {
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    const bob = p.moving ? Math.sin(p.bobPhase) * 2 : Math.sin(time * 0.003) * 1;
    const A = appearance();

    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // body translated up by bob
    ctx.translate(sx, sy - 18 + bob);

    // legs (only when moving, otherwise standing)
    const legSwing = p.moving ? Math.sin(p.bobPhase * 2) * 3 : 0;
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(-6, 10, 4, 8 - legSwing);
    ctx.fillRect( 2, 10, 4, 8 + legSwing);

    // tunic
    ctx.fillStyle = A.outfit;
    ctx.beginPath();
    ctx.roundRect(-10, -2, 20, 16, 4);
    ctx.fill();
    // tunic shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.roundRect(2, -2, 8, 16, 4);
    ctx.fill();
    // belt
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(-10, 8, 20, 2);

    // arms (one holds a tiny lantern, opposite side of facing)
    ctx.fillStyle = A.skin;
    ctx.fillRect(-12, 0, 4, 9);
    ctx.fillRect(  8, 0, 4, 9);

    // tiny lantern in the right hand (or opposite of facing)
    const lanternSide = (p.facing === 'left') ? -1 : 1;
    const lx = lanternSide * 13;
    const ly = 6;
    // string
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, 4); ctx.lineTo(lx, ly);
    ctx.stroke();
    // lantern body
    ctx.fillStyle = '#a07050';
    ctx.beginPath();
    ctx.roundRect(lx - 4, ly, 8, 8, 1.5);
    ctx.fill();
    // glow
    const lg = ctx.createRadialGradient(lx, ly + 4, 1, lx, ly + 4, 16);
    lg.addColorStop(0, 'rgba(255, 232, 130, .9)');
    lg.addColorStop(1, 'rgba(255, 232, 130, 0)');
    ctx.fillStyle = lg;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(lx, ly + 4, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // head
    ctx.fillStyle = A.skin;
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    // hair — style varies
    ctx.fillStyle = A.hair;
    if (A.hairStyle === 'long') {
      ctx.beginPath();
      ctx.arc(0, -14, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-11, -14, 4, 14);
      ctx.fillRect(7, -14, 4, 14);
    } else if (A.hairStyle === 'curly') {
      for (const off of [[-7,-18],[0,-22],[7,-18],[-10,-13],[10,-13]]) {
        ctx.beginPath();
        ctx.arc(off[0], off[1], 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (A.hairStyle === 'bald') {
      // intentionally nothing
    } else {
      // 'short' default
      ctx.beginPath();
      ctx.arc(0, -14, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-11, -14, 4, 6);
      ctx.fillRect(7, -14, 4, 6);
    }
    // hat — soft pointy
    ctx.fillStyle = A.hat;
    ctx.beginPath();
    ctx.moveTo(-10, -16);
    ctx.quadraticCurveTo(0, -32, 10, -16);
    ctx.closePath();
    ctx.fill();
    // hat tip
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.arc(8, -22, 3, 0, Math.PI * 2);
    ctx.fill();

    // eyes (look in facing direction)
    ctx.fillStyle = '#3a2818';
    const eyeOff =
      p.facing === 'left'  ? -1.5 :
      p.facing === 'right' ?  1.5 : 0;
    ctx.beginPath();
    ctx.arc(-3 + eyeOff, -9, 1.5, 0, Math.PI * 2);
    ctx.arc( 3 + eyeOff, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // tiny smile
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -6, 2, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // GLIM
  // =========================================================================
  // Each Glim instance is a procedural floaty creature. They wander toward
  // their favorite-spot hotspot (if available) with some randomness.
  //
  // States:
  //   'idle'    — gently bobbing, will start drifting after a moment
  //   'drift'   — moving toward a target point
  //   'startle' — bubble landed too close, dart away briefly
  //   'caught'  — being absorbed into a bubble (animation only)
  // =========================================================================

  function Glim(def, x, y, scene) {
    return {
      def,
      x, y,
      vx: 0, vy: 0,
      bobPhase: Math.random() * Math.PI * 2,
      state: 'idle',
      stateTime: 0,
      target: { x, y },
      // shy/rare Glims peek more cautiously
      caution: def.rarity === 'rare' ? 1.5 : def.rarity === 'shy' ? 1.2 : 1.0,
      facing: 'right',
      seenByPlayer: false,
      blinkPhase: Math.random() * 2,
      scene,
    };
  }

  function pickGlimTarget(g, scene) {
    // try favorite-spot hotspot; fall back to anywhere in scene
    const hotspots = scene.hotspots || {};
    const keys = Object.keys(hotspots);
    if (keys.length && Math.random() < 0.7) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      const arr = hotspots[k];
      if (arr && arr.length) {
        const p = arr[Math.floor(Math.random() * arr.length)];
        return {
          x: p.x + (Math.random() - 0.5) * 100,
          y: p.y + (Math.random() - 0.5) * 80,
        };
      }
    }
    const b = scene.bounds;
    return {
      x: b.x + 60 + Math.random() * (b.w - 120),
      y: b.y + 100 + Math.random() * (b.h - 200),
    };
  }

  function updateGlim(g, dt, scene, player) {
    g.stateTime += dt;
    g.bobPhase += dt * 2;
    g.blinkPhase += dt;

    // mark seen if close enough to player
    if (!g.seenByPlayer && Math.hypot(g.x - player.x, g.y - player.y) < 240) {
      g.seenByPlayer = true;
    }

    if (g.state === 'idle') {
      if (g.stateTime > 1.5 + Math.random() * 2) {
        g.target = pickGlimTarget(g, scene);
        g.state = 'drift';
        g.stateTime = 0;
      }
    } else if (g.state === 'drift') {
      const dx = g.target.x - g.x;
      const dy = g.target.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8 || g.stateTime > 5) {
        g.state = 'idle';
        g.stateTime = 0;
        g.vx = g.vy = 0;
      } else {
        const speed = 35;
        g.vx = (dx / dist) * speed;
        g.vy = (dy / dist) * speed;
        g.facing = g.vx > 0 ? 'right' : 'left';
      }
    } else if (g.state === 'startle') {
      g.vx *= 0.92;
      g.vy *= 0.92;
      if (g.stateTime > 0.7) {
        g.state = 'idle';
        g.stateTime = 0;
      }
    }

    g.x += g.vx * dt;
    g.y += g.vy * dt;

    // clamp to scene bounds (with some padding)
    const b = scene.bounds;
    g.x = Math.max(b.x + 20, Math.min(b.x + b.w - 20, g.x));
    g.y = Math.max(b.y + 30, Math.min(b.y + b.h - 20, g.y));
  }

  // Public draw used both for in-world Glims and lantern grove glims
  function drawGlimSprite(ctx, x, y, size, def, time, mood) {
    // bob — gentle vertical sine wave
    const bob = Math.sin(time * 0.003 + x * 0.01 + y * 0.01) * 2;
    const cx = x;
    const cy = y + bob;
    ctx.save();

    // outer halo
    const halo = ctx.createRadialGradient(cx, cy, size * 0.4, cx, cy, size * 2.4);
    halo.addColorStop(0, def.glow + 'cc');
    halo.addColorStop(0.5, def.glow + '40');
    halo.addColorStop(1, def.glow + '00');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // body — soft elemental shape
    drawElementShape(ctx, cx, cy, size, def);

    // eyes — two tiny dots
    const eyeY = cy - size * 0.05;
    const eyeOff = size * 0.28;
    ctx.fillStyle = '#3a2818';
    const blink = (Math.sin(time * 0.001 + def.name.length) > 0.97) ? 0.2 : 1;
    ctx.beginPath();
    ctx.ellipse(cx - eyeOff, eyeY, size * 0.12, size * 0.18 * blink, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeOff, eyeY, size * 0.12, size * 0.18 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    // sparkle highlight
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(cx - eyeOff + size * 0.05, eyeY - size * 0.05, size * 0.04, 0, Math.PI * 2);
    ctx.arc(cx + eyeOff + size * 0.05, eyeY - size * 0.05, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // mood markers
    if (mood === 'happy') {
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.25, size * 0.2, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Element-specific body shapes (subtle differentiation for the kids).
  function drawElementShape(ctx, cx, cy, size, def) {
    ctx.fillStyle = def.color;
    switch (def.element) {
      case 'sun': {
        // round body + soft rays
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        // little rays
        ctx.fillStyle = def.color + 'cc';
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          const r1 = size + 2, r2 = size + 7;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * (r1 + r2) / 2,
                      cy + Math.sin(a) * (r1 + r2) / 2,
                      3, 2, a, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'moon': {
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        // crescent mark
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath();
        ctx.arc(cx - size * 0.3, cy - size * 0.3, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'leaf': {
        // teardrop / leaf body
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 0.95, size * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6e9b62';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size * 0.8);
        ctx.stroke();
        break;
      }
      case 'tide': {
        // droplet
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.bezierCurveTo(cx + size, cy - size * 0.5, cx + size, cy + size, cx, cy + size);
        ctx.bezierCurveTo(cx - size, cy + size, cx - size, cy - size * 0.5, cx, cy - size);
        ctx.fill();
        // shimmer
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.3, cy - size * 0.2, size * 0.2, size * 0.4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ember': {
        // flame-shape
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.bezierCurveTo(cx + size, cy - size * 0.4, cx + size * 0.8, cy + size, cx, cy + size);
        ctx.bezierCurveTo(cx - size * 0.8, cy + size, cx - size, cy - size * 0.4, cx, cy - size);
        ctx.fill();
        ctx.fillStyle = '#ffd97a';
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.1, size * 0.45, size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'whisper': {
        // soft puff with tail
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = def.color + '88';
        ctx.beginPath();
        ctx.arc(cx - size * 1.1, cy - size * 0.2, size * 0.6, 0, Math.PI * 2);
        ctx.arc(cx + size * 1.1, cy - size * 0.2, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'frost': {
        // hex-ish body
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * size;
          const y = cy + Math.sin(a) * size;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'bloom':
      default: {
        // flower-ish: small petals around centre
        ctx.fillStyle = def.color + 'cc';
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * size * 0.6,
                  cy + Math.sin(a) * size * 0.6,
                  size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd97a';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  function drawGlim(ctx, g, camera, time) {
    if (g.state === 'caught') return;
    const sx = g.x - camera.x;
    const sy = g.y - camera.y;
    drawGlimSprite(ctx, sx, sy, 12 + (g.def.rarity === 'rare' ? 2 : 0),
                   g.def, time, null);
    // show name if seen+near player (handled by HUD layer ideally)
  }

  // =========================================================================
  // BUBBLE
  // =========================================================================
  // A bubble shoots from the player in their facing direction. It grows for
  // a moment, hovers briefly, then pops. If a Glim is inside the bubble
  // at any frame during its life, the Glim is "caught" (with a soft
  // animation). The bubble pops on catch.
  // =========================================================================

  function Bubble(x, y, facing) {
    const speed = 280;
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[facing];
    return {
      x, y,
      vx: dir[0] * speed,
      vy: dir[1] * speed,
      r: 6,
      maxR: 28,
      life: 1.6,
      age: 0,
      popped: false,
      catchTarget: null,    // a Glim reference being absorbed
    };
  }

  function updateBubble(b, dt, glims, onCatch) {
    b.age += dt;
    // glide and gently rise
    b.x += b.vx * dt;
    b.y += b.vy * dt - 4 * dt;
    // decelerate
    b.vx *= 0.96;
    b.vy *= 0.96;
    // grow then hold
    if (b.age < 0.4) b.r = 6 + (b.age / 0.4) * (b.maxR - 6);
    else             b.r = b.maxR;

    // check Glim overlap
    if (!b.catchTarget) {
      for (const g of glims) {
        if (g.state === 'caught') continue;
        if (Math.hypot(g.x - b.x, g.y - b.y) < b.r - 4) {
          b.catchTarget = g;
          g.state = 'caught';
          onCatch(g);
          break;
        }
      }
    } else {
      // attract Glim into bubble centre
      const g = b.catchTarget;
      g.x += (b.x - g.x) * 0.18;
      g.y += (b.y - g.y) * 0.18;
    }

    // lifespan / pop
    if (b.age > b.life) b.popped = true;
  }

  function drawBubble(ctx, b, camera, time) {
    const sx = b.x - camera.x;
    const sy = b.y - camera.y;
    ctx.save();
    // soap shell with rainbow shimmer
    const grad = ctx.createRadialGradient(sx - b.r * 0.3, sy - b.r * 0.3, b.r * 0.1,
                                          sx, sy, b.r);
    grad.addColorStop(0,   'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(200,228,240,0.45)');
    grad.addColorStop(0.7, 'rgba(220,200,240,0.35)');
    grad.addColorStop(1,   'rgba(255,200,220,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
    ctx.fill();
    // outline
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(sx - b.r * 0.35, sy - b.r * 0.35, b.r * 0.18, b.r * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // =========================================================================
  // DUST MOTES — purely decorative background overlay.
  // =========================================================================
  function makeDustField(count, w, h) {
    const motes = [];
    for (let i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 1.6,
        speed: 6 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        amp: 8 + Math.random() * 18,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
    return motes;
  }
  function drawDustMotes(ctx, motes, camera, time, w, h) {
    ctx.save();
    ctx.fillStyle = '#fff5dc';
    for (const m of motes) {
      const px = (m.x + time * 0.02 * m.speed) % (camera.w + 40) - 20;
      const py = m.y + Math.sin(time * 0.001 + m.phase) * m.amp;
      ctx.globalAlpha = m.alpha;
      ctx.beginPath();
      ctx.arc(px, py, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // NPC — a friendly idle character. Currently only one kind ('pippa') but the
  // signature accepts more so adding villagers is just a draw function away.
  // =========================================================================
  function NPC(id, x, y, kind) {
    return {
      id, x, y, kind,
      bobPhase: Math.random() * Math.PI * 2,
      radius: 22,
      // a soft prompt above their head when player approaches
      promptText: kind === 'pippa'   ? 'Talk to Pippa'
                : kind === 'marlowe' ? 'Talk to Marlowe'
                : kind === 'astra'   ? 'Stargaze with Astra'
                : kind === 'wren'    ? 'Talk to Wren'
                : kind === 'cobble'  ? 'Talk to Cobble'
                : kind === 'theo'    ? 'Talk to Theo'
                : kind === 'juno'    ? 'Talk to Juno'
                : kind === 'vela'    ? 'Talk to Vela'
                : 'Talk',
    };
  }

  function drawNPC(ctx, npc, camera, time) {
    const sx = npc.x - camera.x;
    const sy = npc.y - camera.y;
    const bob = Math.sin(time * 0.002 + npc.bobPhase) * 1.5;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 4, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx, sy - 22 + bob);

    if (npc.kind === 'pippa') {
      // legs
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(-7, 12, 5, 10);
      ctx.fillRect(2, 12, 5, 10);
      // skirt / apron
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
      ctx.lineTo(11, 14); ctx.lineTo(-11, 14);
      ctx.closePath();
      ctx.fill();
      // apron front
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.moveTo(-7, 2); ctx.lineTo(7, 2);
      ctx.lineTo(6, 14); ctx.lineTo(-6, 14);
      ctx.closePath();
      ctx.fill();
      // top
      ctx.fillStyle = '#d96a6a';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 12, 4);
      ctx.fill();
      // arms (one cradling a basket)
      ctx.fillStyle = '#f0c8a0';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9, -4, 5, 9);
      // basket on the left arm
      ctx.fillStyle = '#8b6a4a';
      ctx.beginPath();
      ctx.ellipse(-19, 4, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.ellipse(-19, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3820';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-19, -2, 10, Math.PI, 0);
      ctx.stroke();
      // fruits in basket
      const fruits = ['#ffd97a', '#d96a6a', '#8b7aa8'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = fruits[i];
        ctx.beginPath();
        ctx.arc(-22 + i * 3, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // head
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // hair — short curly auburn
      ctx.fillStyle = '#8b3a1a';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-12, -19, 4, 7);
      ctx.fillRect(8, -19, 4, 7);
      // headscarf
      ctx.fillStyle = '#f6c2cf';
      ctx.beginPath();
      ctx.moveTo(-12, -22);
      ctx.quadraticCurveTo(0, -32, 12, -22);
      ctx.lineTo(11, -16);
      ctx.lineTo(-11, -16);
      ctx.closePath();
      ctx.fill();
      // eyes + smile
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, 0, Math.PI);
      ctx.stroke();
      // cheek blush
      ctx.fillStyle = 'rgba(217, 106, 106, 0.4)';
      ctx.beginPath();
      ctx.arc(-6, -13, 2, 0, Math.PI * 2);
      ctx.arc(6,  -13, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (npc.kind === 'marlowe') {
      // boots
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // trousers — rolled-up coastal pants
      ctx.fillStyle = '#7088a8';
      ctx.fillRect(-8, 2, 16, 13);
      // shirt — striped sailor's tunic
      ctx.fillStyle = '#f4ecd8';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 12, 4);
      ctx.fill();
      ctx.fillStyle = '#5a8aa8';
      for (let i = -6; i <= 6; i += 4) {
        ctx.fillRect(-12, -8 + i + 6, 24, 1.5);
      }
      // arms
      ctx.fillStyle = '#d8b890';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // fishing rod on right shoulder
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(36, -28);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(36, -28);
      ctx.lineTo(34, 4);
      ctx.stroke();
      // head
      ctx.fillStyle = '#d8b890';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // hair — short dark, with a stripe of grey
      ctx.fillStyle = '#2a2230';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#a8a4b0';
      ctx.fillRect(-2, -28, 2, 6);
      // sou'wester-style hat
      ctx.fillStyle = '#3a5a78';
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.quadraticCurveTo(0, -34, 14, -22);
      ctx.lineTo(12, -18);
      ctx.lineTo(-12, -18);
      ctx.closePath();
      ctx.fill();
      // eyes + smile
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a1810';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, 0, Math.PI);
      ctx.stroke();
    } else if (npc.kind === 'wren') {
      // boots
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // overalls
      ctx.fillStyle = '#a06a3a';
      ctx.beginPath();
      ctx.moveTo(-13, 0); ctx.lineTo(13, 0);
      ctx.lineTo(11, 16); ctx.lineTo(-11, 16);
      ctx.closePath();
      ctx.fill();
      // straps
      ctx.fillStyle = '#7a4a20';
      ctx.fillRect(-7, -4, 3, 12);
      ctx.fillRect(4,  -4, 3, 12);
      // shirt — sunny yellow
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 12, 4);
      ctx.fill();
      // arms
      ctx.fillStyle = '#e8c098';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // head
      ctx.fillStyle = '#e8c098';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // hair — short blond
      ctx.fillStyle = '#d4a85a';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      // beekeeper veil-hat — wide brim w/ mesh
      ctx.fillStyle = '#d4b890';
      ctx.beginPath();
      ctx.ellipse(0, -25, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8a878';
      ctx.beginPath();
      ctx.roundRect(-9, -32, 18, 8, 3);
      ctx.fill();
      // little bee on shoulder
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.ellipse(-15, -8, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(-16, -8.5, 2, 1);
      // eyes + smile
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, 0, Math.PI);
      ctx.stroke();
    } else if (npc.kind === 'cobble') {
      // boots
      ctx.fillStyle = '#4a3828';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // long tunic — moss
      ctx.fillStyle = '#6b9166';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
      ctx.lineTo(12, 16); ctx.lineTo(-12, 16);
      ctx.closePath();
      ctx.fill();
      // sash
      ctx.fillStyle = '#c89270';
      ctx.fillRect(-12, 4, 24, 3);
      // shoulders
      ctx.fillStyle = '#3f6a4a';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 10, 4);
      ctx.fill();
      // arms
      ctx.fillStyle = '#d8b890';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // small stone cradled in hand
      ctx.fillStyle = '#9a8a72';
      ctx.beginPath();
      ctx.ellipse(-15, 4, 5, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.fillStyle = '#d8b890';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // bushy grey beard
      ctx.fillStyle = '#d8d4c8';
      ctx.beginPath();
      ctx.arc(0, -10, 8, 0, Math.PI);
      ctx.fill();
      // hair — short grey
      ctx.fillStyle = '#a8a4a0';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      // eyes (closed, kindly slits)
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-3, -16, 1.6, 0, Math.PI);
      ctx.arc(3,  -16, 1.6, 0, Math.PI);
      ctx.stroke();
    } else if (npc.kind === 'theo') {
      // travel-worn merchant — cloak, walking stick
      ctx.fillStyle = '#4a3828';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // long travel cloak
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      ctx.moveTo(-14, -2); ctx.lineTo(14, -2);
      ctx.lineTo(13, 18); ctx.lineTo(-13, 18);
      ctx.closePath();
      ctx.fill();
      // belt
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(-14, 6, 28, 3);
      // shirt
      ctx.fillStyle = '#d4a85a';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 10, 4);
      ctx.fill();
      // arms
      ctx.fillStyle = '#c89270';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // walking stick
      ctx.strokeStyle = '#5a3820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, -2); ctx.lineTo(20, 18);
      ctx.stroke();
      // head
      ctx.fillStyle = '#c89270';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // dark hair + beard
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#3a2010';
      ctx.beginPath();
      ctx.arc(0, -10, 7, 0, Math.PI);
      ctx.fill();
      // wide-brim hat
      ctx.fillStyle = '#4a3020';
      ctx.beginPath();
      ctx.ellipse(0, -24, 18, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, -32, 16, 8);
      // eyes
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (npc.kind === 'juno') {
      // floury baker
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // long apron
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.moveTo(-13, -2); ctx.lineTo(13, -2);
      ctx.lineTo(11, 16); ctx.lineTo(-11, 16);
      ctx.closePath();
      ctx.fill();
      // flour dust
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(-10 + i * 3, 4 + (i % 3) * 2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // shirt
      ctx.fillStyle = '#d96a6a';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 12, 4);
      ctx.fill();
      // arms holding tray
      ctx.fillStyle = '#e8c098';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // tray
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.roundRect(-18, 2, 36, 6, 2);
      ctx.fill();
      // a little loaf on tray
      ctx.fillStyle = '#e8b87f';
      ctx.beginPath();
      ctx.ellipse(0, 1, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.fillStyle = '#e8c098';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // hair tucked under chef cap
      ctx.fillStyle = '#a05a30';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, 0);
      ctx.fill();
      // chef cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -28, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, -24, 16, 5);
      // eyes + smile
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, 0, Math.PI);
      ctx.stroke();
    } else if (npc.kind === 'vela') {
      // winter cloudwatcher — heavy parka, scarf
      ctx.fillStyle = '#3a3050';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // parka body
      ctx.fillStyle = '#7088a8';
      ctx.beginPath();
      ctx.moveTo(-14, -4); ctx.lineTo(14, -4);
      ctx.lineTo(13, 18); ctx.lineTo(-13, 18);
      ctx.closePath();
      ctx.fill();
      // fur trim
      ctx.fillStyle = '#fff5dc';
      ctx.fillRect(-14, -4, 28, 3);
      // scarf
      ctx.fillStyle = '#d96a6a';
      ctx.fillRect(-12, -2, 24, 4);
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.lineTo(14, 12);
      ctx.lineTo(8, 12);
      ctx.closePath();
      ctx.fill();
      // arms
      ctx.fillStyle = '#5a708a';
      ctx.fillRect(-14, -2, 5, 11);
      ctx.fillRect(9,   -2, 5, 11);
      // a small clipboard / sketchbook
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.roundRect(-18, 2, 12, 14, 1.5);
      ctx.fill();
      // head
      ctx.fillStyle = '#d8b890';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // hat — pulled-down beanie
      ctx.fillStyle = '#5a4a82';
      ctx.beginPath();
      ctx.arc(0, -22, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-12, -22, 24, 8);
      // beanie pompom
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath();
      ctx.arc(0, -32, 3, 0, Math.PI * 2);
      ctx.fill();
      // eyes
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      // tiny rosy cheeks
      ctx.fillStyle = 'rgba(217, 106, 106, 0.45)';
      ctx.beginPath();
      ctx.arc(-6, -13, 2, 0, Math.PI * 2);
      ctx.arc(6,  -13, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (npc.kind === 'astra') {
      // boots
      ctx.fillStyle = '#1a1530';
      ctx.fillRect(-7, 14, 5, 8);
      ctx.fillRect(2,  14, 5, 8);
      // long robe — twilight purple with star embroidery
      ctx.fillStyle = '#3a2e6a';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
      ctx.lineTo(12, 16); ctx.lineTo(-12, 16);
      ctx.closePath();
      ctx.fill();
      // little embroidered stars
      ctx.fillStyle = '#fdf3c4';
      for (let i = 0; i < 5; i++) {
        const sx = (-10 + i * 5);
        const sy = 4 + (i % 2) * 6;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // top
      ctx.fillStyle = '#5a4a82';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 10, 4);
      ctx.fill();
      // arms
      ctx.fillStyle = '#c8a890';
      ctx.fillRect(-14, -4, 5, 9);
      ctx.fillRect(9,   -4, 5, 9);
      // head
      ctx.fillStyle = '#c8a890';
      ctx.beginPath();
      ctx.arc(0, -16, 11, 0, Math.PI * 2);
      ctx.fill();
      // long silver hair
      ctx.fillStyle = '#d8d4e8';
      ctx.beginPath();
      ctx.arc(0, -19, 13, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-13, -19, 4, 14);
      ctx.fillRect(9,   -19, 4, 14);
      // tiny star clip
      ctx.fillStyle = '#fdf3c4';
      ctx.beginPath();
      ctx.arc(-7, -24, 1.6, 0, Math.PI * 2);
      ctx.fill();
      // eyes + smile
      ctx.fillStyle = '#2a1830';
      ctx.beginPath();
      ctx.arc(-3, -16, 1.4, 0, Math.PI * 2);
      ctx.arc(3,  -16, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a1830';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    Player, updatePlayer, drawPlayer,
    Glim, updateGlim, drawGlim, drawGlimSprite,
    Bubble, updateBubble, drawBubble,
    makeDustField, drawDustMotes,
    NPC, drawNPC,
  };
})();
