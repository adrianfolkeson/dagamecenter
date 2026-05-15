// ---------------------------------------------------------------------------
// Game — the main loop. Owns the world state, runs update/draw, handles
// scene transitions, spawns Glims, mediates between input and entities.
// ---------------------------------------------------------------------------

(function () {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const FRAME_W = 1280, FRAME_H = 800;

  // backing-store scale for crisp pixels on high-DPI screens
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = FRAME_W * dpr;
    canvas.height = FRAME_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // -------------------- Game state ----------------------------------------
  const save = Save.load();
  const scenes = World.getScenes();

  const game = {
    save,
    scene: scenes[save.lastScene] || scenes.mossroot,
    sceneId: save.lastScene || 'mossroot',
    player: null,
    bubbles: [],
    glimsByScene: {},   // sceneId -> Glim[]
    npcsByScene: {},    // sceneId -> NPC[]
    dust: null,         // dust motes
    camera: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
    time: 0,
    paused: false,
    interactable: null, // { type:'portal', portal:..., prompt:..., key:'E' }
  };

  // wire UI to this game
  UI.setGame(game);
  UI.wire();
  UI.applySettings();
  Interactions.setGame(game);
  Interactions.applyOfflineDecay(game.save);
  if (window.Cooking)   Cooking.setGame(game);
  if (window.Gardening) Gardening.setGame(game);
  if (window.Festival)  Festival.setGame(game);
  if (window.Sound)     Sound.setGame(game);
  if (window.Constellation) Constellation.setGame(game);
  if (window.Fishing)       Fishing.setGame(game);
  if (window.Snapshot)      Snapshot.setGame(game);
  if (window.Quests)        Quests.setGame(game);
  if (window.Surprise)      Surprise.setGame(game);
  if (window.Rhythm)        Rhythm.setGame(game);
  if (window.Tutorial)      Tutorial.setGame(game);
  if (window.Stickers)      Stickers.setGame(game);
  if (window.Speech)        Speech.setGame(game);
  window.SAVE_GAME = game;  // exposed read-only for entities.js appearance lookup

  // -------------------- World prep ----------------------------------------
  // Spawn one Glim per definition, scattered across their preferred biome.
  function spawnGlimsForScene(scene) {
    if (game.glimsByScene[scene.id]) return game.glimsByScene[scene.id];
    if (scene.id === 'treehouse') {
      game.glimsByScene[scene.id] = []; return [];
    }
    const list = [];
    for (const def of window.GLIMS) {
      if (!def.biome.includes(scene.id)) continue;
      // skip if already caught
      if (game.save.caught[def.id]) continue;
      // initial position near a favored hotspot if possible
      const hot = scene.hotspots || {};
      const keys = Object.keys(hot);
      let p;
      if (keys.length) {
        const arr = hot[keys[Math.floor(Math.random() * keys.length)]];
        if (arr && arr.length) p = arr[Math.floor(Math.random() * arr.length)];
      }
      if (!p) {
        const b = scene.bounds;
        p = { x: b.x + 200 + Math.random() * (b.w - 400),
              y: b.y + 200 + Math.random() * (b.h - 400) };
      }
      list.push(Entities.Glim(def, p.x + (Math.random()-0.5)*80,
                                   p.y + (Math.random()-0.5)*60, scene));
    }
    game.glimsByScene[scene.id] = list;
    return list;
  }
  spawnGlimsForScene(scenes.mossroot);

  // NPCs — once per scene
  function spawnNPCsForScene(scene) {
    if (game.npcsByScene[scene.id]) return game.npcsByScene[scene.id];
    const list = (scene.npcs || []).map(n => Entities.NPC(n.id, n.x, n.y, n.kind));
    game.npcsByScene[scene.id] = list;
    return list;
  }
  spawnNPCsForScene(scenes.mossroot);

  // dust motes — small persistent decorative layer
  game.dust = Entities.makeDustField(40, FRAME_W, FRAME_H);

  // place player at scene spawn (or last save position if same scene)
  game.player = Entities.Player(game.scene.spawn.x, game.scene.spawn.y);
  // camera follow
  centerCamera();

  // -------------------- Scene transitions ---------------------------------
  function switchScene(targetId, spawnHint) {
    const next = scenes[targetId];
    if (!next) return;
    game.scene = next;
    game.sceneId = targetId;
    game.bubbles = [];
    spawnGlimsForScene(next);
    spawnNPCsForScene(next);
    // pick spawn position
    let spawn = next.spawn;
    if (spawnHint && next.spawnPoints && next.spawnPoints[spawnHint]) {
      spawn = next.spawnPoints[spawnHint];
    } else if (spawnHint === 'door') {
      // place near the first portal back to wherever we came from
      const portal = next.portals.find(p => p.target);
      if (portal) {
        spawn = {
          x: portal.rect.x + portal.rect.w / 2,
          y: portal.rect.y + portal.rect.h + 40,
        };
      }
    }
    game.player.x = spawn.x;
    game.player.y = spawn.y;
    game.save.lastScene = targetId;
    Save.save(game.save);
    centerCamera();
    UI.updateHUD();
    if (window.Sound) {
      Sound.play('portal');
      Sound.startAmbient(targetId);
    }
    // festival trigger on entering Mossroot
    if (targetId === 'mossroot' && window.Festival) {
      Festival.checkTrigger();
    }
    // biome festivals (Bloom Day, Tidesong, Star-Counting Night)
    if (window.Festival) Festival.checkBiomeFestival(targetId);
    // surprise check (cooldown + small chance, no-op when conditions not met)
    if (window.Surprise) Surprise.onSceneEnter(targetId);
  }

  function sleep() {
    // restore Glim happiness, advance lastPlayed timestamp, brief overlay
    const caught = game.save.caught || {};
    for (const id of Object.keys(caught)) {
      caught[id].happiness = Math.min(1, (caught[id].happiness || 0.7) + 0.3);
    }
    game.save.lastPlayed = Date.now() + (8 * 60 * 60 * 1000); // skip 8h
    game.save.flags = game.save.flags || {};
    game.save.flags.slept = true;
    Save.save(game.save);
    if (window.Stickers) Stickers.scan();
    UI.toast('Everyone slept well. Happy lanterns all round.', '#ffd97a');
    if (window.Sound) Sound.play('chime');
    // brief fade overlay
    const fade = document.createElement('div');
    Object.assign(fade.style, {
      position: 'absolute', inset: '0', background: '#1a1530',
      opacity: '0', transition: 'opacity .6s ease', zIndex: '14',
      pointerEvents: 'none',
    });
    document.getElementById('frame').appendChild(fade);
    requestAnimationFrame(() => { fade.style.opacity = '1'; });
    setTimeout(() => {
      fade.style.opacity = '0';
      setTimeout(() => fade.remove(), 700);
    }, 900);
  }

  // expose targeted hooks for systems that need to mutate the active scene
  window.Game = {
    spawnExtraGlim(def) {
      const arr = game.glimsByScene[game.sceneId] = game.glimsByScene[game.sceneId] || [];
      const b = game.scene.bounds;
      const x = b.x + 300 + Math.random() * (b.w - 600);
      const y = b.y + 300 + Math.random() * (b.h - 600);
      arr.push(Entities.Glim(def, x, y, game.scene));
    },
  };

  function centerCamera() {
    const b = game.scene.bounds;
    game.camera.x = Math.max(b.x, Math.min(b.x + b.w - FRAME_W, game.player.x - FRAME_W / 2));
    game.camera.y = Math.max(b.y, Math.min(b.y + b.h - FRAME_H, game.player.y - FRAME_H / 2));
  }

  // -------------------- Catching logic ------------------------------------
  function onGlimCaught(glim) {
    const def = glim.def;
    // gentle little reward + journal entry
    game.save.caught[def.id] = {
      caughtAt: Date.now(),
      happiness: 0.7,
      lastGift: 0,
      lastPet: 0,
    };
    game.save.dust += 5;
    // Honeydrop unlock: 3 caught Glims opens the path
    const totalCaught = Object.keys(game.save.caught).length;
    if (totalCaught >= 3 && !game.save.flags.unlockedHoneydrop) {
      game.save.flags.unlockedHoneydrop = true;
      setTimeout(() => {
        UI.showDialog('A new path appears',
          'The grass to the south-east has parted. Honeydrop Meadow is open to you now.',
          6000);
      }, 2200);
    }
    Save.save(game.save);
    UI.updateHUD();
    UI.toast(`Met ${def.name} — a ${def.element} Glim`, def.glow);
    if (window.Sound) Sound.play('catch');
    if (window.Quests) Quests.refresh();
    if (window.Stickers) Stickers.scan();
    // remove from active scene after a small delay (catch animation handled by bubble)
    setTimeout(() => {
      const arr = game.glimsByScene[game.sceneId] || [];
      const i = arr.indexOf(glim);
      if (i >= 0) arr.splice(i, 1);
    }, 600);
  }

  // -------------------- Main loop -----------------------------------------
  let lastT = performance.now();
  function loop(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.1) dt = 0.1;  // clamp big tab-switch jumps
    if (game.save.settings.reducedMotion) dt *= 1;   // (kept simple; we slow only animations downstream)

    game.time = now;

    update(dt);
    draw();

    Input.endFrame();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (game.paused) return;

    // global menu shortcuts
    if (Input.pressed('journal')) {
      const open = document.querySelector('#modal-journal.show');
      if (open) UI.closeJournal(); else UI.openJournal();
    }
    if (Input.pressed('snapshot') && window.Snapshot) {
      Snapshot.capture(canvas);
    }
    if (Input.pressed('quests') && window.Quests) {
      const open = document.querySelector('#modal-quests.show');
      if (open) Quests.close(); else Quests.open();
    }
    if (Input.pressed('cancel')) {
      // close any open modal
      document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
      UI.closeDialog();
    }

    // if any modal is open, stop the world from updating
    if (document.querySelector('.modal.show')) return;

    // movement
    Entities.updatePlayer(game.player, dt, game.scene);
    if (window.Tutorial) Tutorial.tick();
    centerCamera();

    // glims
    const glims = game.glimsByScene[game.sceneId] || [];
    for (const g of glims) {
      Entities.updateGlim(g, dt, game.scene, game.player);
      if (g.seenByPlayer && !game.save.seen[g.def.id] && !game.save.caught[g.def.id]) {
        game.save.seen[g.def.id] = Date.now();
        Save.save(game.save);
      }
    }

    // slow happiness tick
    Interactions.tickHappiness(dt, game.save);

    // festival lantern animation tick
    if (window.Festival) Festival.update(dt);

    // bubbles
    for (let i = game.bubbles.length - 1; i >= 0; i--) {
      const b = game.bubbles[i];
      Entities.updateBubble(b, dt, glims, onGlimCaught);
      if (b.popped) game.bubbles.splice(i, 1);
    }

    // shooting
    if (Input.pressed('action') && game.player.bubbleCooldown <= 0) {
      const p = game.player;
      const offset = { up:[0,-10], down:[0,16], left:[-14,2], right:[14,2] }[p.facing];
      game.bubbles.push(Entities.Bubble(p.x + offset[0], p.y + offset[1] - 8, p.facing));
      p.bubbleCooldown = 0.35;
    }

    // ---------- Determine current interactable ----------------------------
    // Priority: lantern > kitchen > NPC > festival stage > garden plot > portal
    let nearestNPC = null, nearestNPCDist = 60;
    const npcs = game.npcsByScene[game.sceneId] || [];
    for (const n of npcs) {
      const d = Math.hypot(n.x - game.player.x, n.y - game.player.y);
      if (d < nearestNPCDist) { nearestNPCDist = d; nearestNPC = n; }
    }

    const nearestLantern = Interactions.nearestLantern(game.scene, game.player);

    // kitchen (treehouse only)
    let nearKitchen = false;
    if (game.scene.kitchen) {
      const k = game.scene.kitchen;
      nearKitchen = Math.hypot(k.x - game.player.x, k.y - game.player.y) < 60;
    }
    // bed (treehouse only)
    let nearBed = false;
    if (game.scene.bed) {
      const b = game.scene.bed;
      nearBed = Math.hypot(b.x - game.player.x, b.y - game.player.y) < 70;
    }

    // garden plot (mossroot only)
    const nearPlot = window.Gardening
      ? window.Gardening.nearestPlot(game.scene, game.player)
      : null;

    // festival stage (mossroot only, when active)
    const nearFestival = window.Festival
      ? window.Festival.nearStage(game.scene, game.player)
      : false;

    let nearestPortal = null;
    for (const portal of game.scene.portals) {
      const r = portal.rect;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      if (Math.hypot(game.player.x - cx, game.player.y - cy) < Math.max(r.w, r.h) * 0.75) {
        nearestPortal = portal; break;
      }
    }

    // Build the prompt and react to E
    if (nearestLantern) {
      const gift = Interactions.hasGiftReady(nearestLantern.caught);
      UI.setPrompt(gift
        ? `${nearestLantern.glim.name} has a gift!`
        : `Care for ${nearestLantern.glim.name}`, 'E');
      if (Input.pressed('interact')) {
        Interactions.openCare(nearestLantern.glim);
      }
    } else if (nearKitchen) {
      UI.setPrompt('Cook something', 'E');
      if (Input.pressed('interact') && window.Cooking) {
        Cooking.open();
      }
    } else if (nearBed) {
      UI.setPrompt('Sleep until morning', 'E');
      if (Input.pressed('interact')) sleep();
    } else if (nearestNPC && nearestNPC.kind === 'pippa') {
      UI.setPrompt('Visit Pippa’s stand', 'E');
      if (Input.pressed('interact')) {
        Interactions.openShop();
      }
    } else if (nearestNPC && nearestNPC.kind === 'wren') {
      UI.setPrompt('Talk to Wren', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metWren) {
          flags.metWren = true;
          // gift: 3 Honeycake straight into the basket
          game.save.inventory = game.save.inventory || {};
          game.save.inventory['honeycake'] = (game.save.inventory['honeycake'] || 0) + 3;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Wren the Bee-keeper',
            'My bees made too much honey again. Take three Honeycakes — Sundrop and Honeysop will adore you for it.',
            6200);
          UI.toast('+3 Honeycake from Wren', '#ffd97a');
          if (window.Sound) Sound.play('chime');
        } else {
          UI.showDialog('Wren',
            'If you ever lose a Glim, just sit still in the meadow. They always find their way back.',
            5000);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'cobble') {
      UI.setPrompt('Talk to Cobble', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metCobble) {
          flags.metCobble = true;
          game.save.dust += 12;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Cobble the Stone-tender',
            'I keep the old rocks warm. Frostie likes the cool ones on the far side — wait for the morning dew and you might spot them.',
            6200);
          UI.toast('+12 sparkledust from Cobble', '#9a8a72');
          if (window.Sound) Sound.play('chime');
        } else {
          UI.showDialog('Cobble',
            'The forest knows who you are now. Even the shy ones will come closer with time.',
            5000);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'theo') {
      UI.setPrompt('Talk to Theo', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metTheo) {
          flags.metTheo = true;
          game.save.dust += 8;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Theo the Wandering Merchant',
            'Hail, Keeper. I trade in stories and short walks. Carry an Iceberry up the path sometime — I’ll be in your debt.',
            6500);
          UI.toast('+8 sparkledust from Theo', '#d4a85a');
          if (window.Sound) Sound.play('chime');
          if (window.Quests) Quests.refresh();
          if (window.Stickers) Stickers.scan();
        } else {
          UI.showDialog('Theo',
            'Travel light, listen well. The road tells you what you need.',
            5000);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'juno') {
      UI.setPrompt('Talk to Juno', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metJuno) {
          if (!flags.cookedAny) {
            UI.showDialog('Juno',
              'You haven’t cooked anything yet, have you? Come back once you’ve tried the stove.',
              5500);
          } else {
            flags.metJuno = true;
            game.save.inventory = game.save.inventory || {};
            game.save.inventory['sugarbud'] = (game.save.inventory['sugarbud'] || 0) + 2;
            Save.save(game.save);
            UI.updateHUD();
            UI.showDialog('Juno the Baker',
              'A fellow stove-keeper! Here, take two Sugarbud — let’s see what you bake next.',
              6500);
            UI.toast('+2 Sugarbud from Juno', '#f6c2cf');
            if (window.Sound) Sound.play('chime');
            if (window.Quests) Quests.refresh();
            if (window.Stickers) Stickers.scan();
          }
        } else {
          UI.showDialog('Juno',
            'The oven hums when it’s happy. Yours sounds in tune today.',
            5000);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'vela') {
      UI.setPrompt('Talk to Vela', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metVela) {
          flags.metVela = true;
          game.save.dust += 20;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Vela the Cloudwatcher',
            'Welcome to the grove. Clouds sing different things in winter — listen for the dawn, Crystal will sing back.',
            7000);
          UI.toast('+20 sparkledust from Vela', '#cdd6f0');
          if (window.Sound) Sound.play('chime');
          if (window.Quests) Quests.refresh();
          if (window.Stickers) Stickers.scan();
        } else {
          UI.showDialog('Vela',
            'Look up. Even the smallest cloud is a story waiting to be told.',
            5000);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'marlowe') {
      UI.setPrompt('Talk to Marlowe', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metMarlowe) {
          flags.metMarlowe = true;
          game.save.dust += 10;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Marlowe the Tidewatcher',
            'Welcome to the pools, Keeper. Listen for shells in the foam — the shy Glims here trust quiet feet. Here, a few sparkles for the road.',
            6000);
          UI.toast('+10 sparkledust from Marlowe', '#9fd4e0');
          if (window.Sound) Sound.play('chime');
        } else if (window.Fishing) {
          Fishing.open();
        } else {
          UI.showDialog('Marlowe',
            'Pearl naps inside a clamshell when the tide goes out. Be patient and she’ll show you what she’s polished today.',
            5200);
        }
      }
    } else if (nearestNPC && nearestNPC.kind === 'astra') {
      UI.setPrompt('Stargaze with Astra', 'E');
      if (Input.pressed('interact')) {
        const flags = game.save.flags;
        if (!flags.metAstra) {
          flags.metAstra = true;
          game.save.dust += 15;
          Save.save(game.save);
          UI.updateHUD();
          UI.showDialog('Astra the Stargazer',
            'Up here the sky is closer. Look for Lullaby by my telescope, and Comet between the peaks. The cairns mark the safest paths.',
            6500);
          UI.toast('+15 sparkledust from Astra', '#cdd6f0');
          if (window.Sound) Sound.play('chime');
        } else if (window.Constellation && !Constellation.allDone()) {
          Constellation.open();
        } else {
          UI.showDialog('Astra',
            'Every star up here has a name. Echo can tell them back to you if you whisper one first.',
            5200);
        }
      }
    } else if (nearFestival) {
      UI.setPrompt(game.save.flags.festivalCelebrated
        ? 'Release another lantern'
        : 'Release your lantern', 'E');
      if (Input.pressed('interact')) {
        Festival.release(game.player);
      }
    } else if (nearPlot) {
      const inter = window.Gardening.plotInteraction(nearPlot);
      UI.setPrompt(inter.prompt, inter.action === 'watch' ? '·' : 'E');
      if (Input.pressed('interact') &&
          (inter.action === 'plant' || inter.action === 'harvest')) {
        Gardening.trigger(nearPlot);
      }
    } else if (nearestPortal) {
      // gated check
      const gate = nearestPortal.gated;
      const unlocked = !gate ||
        (gate.type === 'caught' && Object.keys(game.save.caught).length >= gate.min) ||
        game.save.flags.unlockedHoneydrop && nearestPortal.target === 'honeydrop';
      if (gate && !unlocked) {
        UI.setPrompt(gate.lockedPrompt || 'Locked', '—');
      } else {
        UI.setPrompt(nearestPortal.prompt, 'E');
        if (Input.pressed('interact')) {
          switchScene(nearestPortal.target, nearestPortal.spawn);
        }
      }
    } else {
      UI.setPrompt(null);
    }

    // Home shortcut
    if (Input.pressed('home') && game.sceneId !== 'treehouse') {
      // find portal that leads to treehouse, otherwise just switch
      switchScene('treehouse', 'door');
    } else if (Input.pressed('home') && game.sceneId === 'treehouse') {
      switchScene('mossroot', 'door');
    }
  }

  // -------------------- Render --------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);

    const cam = game.camera;
    // baked background
    game.scene.draw(ctx, cam, game.time);

    // dust motes (very subtle, skipped in reduced motion)
    if (!game.save.settings.reducedMotion) {
      Entities.drawDustMotes(ctx, game.dust, cam, game.time, FRAME_W, FRAME_H);
    }

    // entities — order by Y for fake depth
    const glims = game.glimsByScene[game.sceneId] || [];
    const npcs  = game.npcsByScene[game.sceneId] || [];
    const drawable = [
      { y: game.player.y, fn: () => Entities.drawPlayer(ctx, game.player, cam, game.time) },
      ...glims.map(g => ({ y: g.y, fn: () => Entities.drawGlim(ctx, g, cam, game.time) })),
      ...npcs.map(n => ({ y: n.y, fn: () => Entities.drawNPC(ctx, n, cam, game.time) })),
      ...game.bubbles.map(b => ({ y: b.y + 100, fn: () => Entities.drawBubble(ctx, b, cam, game.time) })),
    ];
    drawable.sort((a, b) => a.y - b.y);
    drawable.forEach(d => d.fn());

    // foreground (canopies in front of player, hanging lanterns, etc.)
    if (game.scene.drawForeground) {
      game.scene.drawForeground(ctx, cam, game.time, game.player.y, game);
    }

    // festival dusk wash (applied AFTER scene/entities, BEFORE the standard vignette)
    if (window.Festival) Festival.drawDuskOverlay(ctx, FRAME_W, FRAME_H);

    // season tint (per-biome, gentle)
    if (window.Seasons) Seasons.draw(ctx, FRAME_W, FRAME_H, game.sceneId);

    // weather layer
    if (window.Weather) Weather.draw(ctx, FRAME_W, FRAME_H, game.time);

    // gentle vignette during day to feel like watercolor edges
    const vig = ctx.createRadialGradient(FRAME_W / 2, FRAME_H / 2, FRAME_W * 0.4,
                                         FRAME_W / 2, FRAME_H / 2, FRAME_W * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(74,58,44,0.18)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
  }

  // -------------------- Boot ----------------------------------------------
  UI.updateHUD();
  if (game.save.firstRun) {
    UI.openIntro();
  } else {
    UI.showDialog('Welcome back', 'Mossroot is just as you left it. Walk with the arrow keys, blow bubbles with Space.', 4200);
  }

  // if a returning player lands on Mossroot already, give the festival a
  // chance to trigger immediately
  if (game.sceneId === 'mossroot' && window.Festival) Festival.checkTrigger();
  // begin ambient loop for the starting scene (no-op if sound disabled)
  if (window.Sound) Sound.startAmbient(game.sceneId);
  // launch the soft tutorial coach (no-op once flagged complete)
  if (window.Tutorial) Tutorial.start();
  // mount touch controls if applicable
  if (window.Touch) Touch.mount();

  // hint on first Glim sight
  let hintedCatch = false;
  setInterval(() => {
    if (hintedCatch) return;
    if (game.save.firstRun) return;
    if (Object.keys(game.save.caught).length > 0) { hintedCatch = true; return; }
    const glims = game.glimsByScene[game.sceneId] || [];
    for (const g of glims) {
      if (g.seenByPlayer) {
        UI.showDialog(g.def.name + '?', 'A Glim! Press Space to blow a bubble. Get close and try to catch it gently.', 5000);
        hintedCatch = true;
        break;
      }
    }
  }, 1500);

  requestAnimationFrame(loop);
})();
