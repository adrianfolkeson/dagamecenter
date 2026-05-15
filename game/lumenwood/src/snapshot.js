// ---------------------------------------------------------------------------
// Snapshot — press P in any outdoor biome to photograph the current frame.
// Snapshots are downsampled to ~320x200 PNG data URLs and persisted in
// game.save.snapshots (cap 12). They render as hung pictures inside the
// treehouse and can be browsed from the journal.
// ---------------------------------------------------------------------------

window.Snapshot = (function () {
  let game = null;
  const MAX_SAVED = 12;
  const THUMB_W = 320;
  const THUMB_H = 200;

  function setGame(g) { game = g; }

  // capture is invoked from the main game loop with the live canvas ref
  function capture(srcCanvas) {
    if (!game) return;
    if (game.sceneId === 'treehouse') {
      UI.toast('Step outside to take a picture!', '#a8c8d8');
      return;
    }
    // scale down via offscreen canvas
    const oc = document.createElement('canvas');
    oc.width = THUMB_W;
    oc.height = THUMB_H;
    const c = oc.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'medium';
    c.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, THUMB_W, THUMB_H);
    // little paper border
    c.strokeStyle = 'rgba(60,40,30,0.4)';
    c.lineWidth = 2;
    c.strokeRect(0, 0, THUMB_W, THUMB_H);
    const dataUrl = oc.toDataURL('image/jpeg', 0.7);

    openPreview({
      id: 'snap-' + Date.now(),
      scene: game.sceneId,
      sceneName: game.scene.name,
      dataUrl,
      takenAt: Date.now(),
    });
    if (window.Sound) Sound.play('chime');
  }

  function openPreview(pending) {
    const body = document.getElementById('snapshot-body');
    body.innerHTML = `
      <div class="snap-preview">
        <img src="${pending.dataUrl}" alt="snapshot preview"/>
        <div class="snap-meta">Taken in <b>${pending.sceneName}</b>.</div>
        <label class="snap-label">Title
          <input type="text" id="snap-title" placeholder="A little moment in ${pending.sceneName}" maxlength="40"/>
        </label>
        <div class="snap-actions">
          <button class="btn-primary" id="snap-save">Hang it up</button>
          <button class="btn-ghost"  id="snap-discard">Discard</button>
        </div>
      </div>
    `;
    document.getElementById('modal-snapshot').classList.add('show');
    Input.clear();

    document.getElementById('snap-save').addEventListener('click', () => {
      const title = (document.getElementById('snap-title').value || '').trim()
        || `A moment in ${pending.sceneName}`;
      save({ ...pending, title });
      document.getElementById('modal-snapshot').classList.remove('show');
    });
    document.getElementById('snap-discard').addEventListener('click', () => {
      document.getElementById('modal-snapshot').classList.remove('show');
    });
  }

  function save(snap) {
    if (!Array.isArray(game.save.snapshots)) game.save.snapshots = [];
    game.save.snapshots.unshift(snap);
    if (game.save.snapshots.length > MAX_SAVED) {
      game.save.snapshots = game.save.snapshots.slice(0, MAX_SAVED);
    }
    try {
      Save.save(game.save);
      UI.toast('Snapshot hung in your treehouse', '#ffd97a');
      if (window.Stickers) Stickers.scan();
    } catch (e) {
      UI.toast('Storage full — try removing an old snapshot', '#d96a6a');
    }
  }

  function remove(id) {
    if (!Array.isArray(game.save.snapshots)) return;
    game.save.snapshots = game.save.snapshots.filter(s => s.id !== id);
    Save.save(game.save);
  }

  function openGallery() {
    const body = document.getElementById('gallery-body');
    const list = (game.save.snapshots || []);
    if (list.length === 0) {
      body.innerHTML = `
        <div class="gallery-empty">
          You haven’t taken any snapshots yet. Walk anywhere outside and press <kbd>P</kbd>
          to keep a memory of the moment.
        </div>`;
    } else {
      body.innerHTML = `
        <div class="gallery-grid">
          ${list.map(s => `
            <div class="gallery-card">
              <img src="${s.dataUrl}" alt="${s.title}"/>
              <div class="gallery-title">${escapeHtml(s.title)}</div>
              <div class="gallery-meta">${s.sceneName || 'Lumenwood'}</div>
              <button class="btn-ghost small" data-rm="${s.id}">Take it down</button>
            </div>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('button[data-rm]').forEach(b => {
        b.addEventListener('click', () => {
          remove(b.dataset.rm);
          openGallery();
        });
      });
    }
    document.getElementById('modal-gallery').classList.add('show');
    Input.clear();
  }

  function closeGallery() {
    document.getElementById('modal-gallery').classList.remove('show');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    })[c]);
  }

  // Draw hung snapshot frames inside the treehouse. Called from world.js
  // when the treehouse scene renders its foreground.
  const frameSlots = [
    { x: 240,  y: 200 },
    { x: 440,  y: 180 },
    { x: 640,  y: 200 },
    { x: 880,  y: 180 },
    { x: 1080, y: 200 },
  ];
  // cache decoded images so we don't decode each frame
  const imgCache = new Map();

  function getImage(snap) {
    if (imgCache.has(snap.id)) return imgCache.get(snap.id);
    const img = new Image();
    img.src = snap.dataUrl;
    imgCache.set(snap.id, img);
    return img;
  }

  function drawHungFrames(ctx, cam) {
    const list = (game.save.snapshots || []).slice(0, frameSlots.length);
    for (let i = 0; i < list.length; i++) {
      const snap = list[i];
      const slot = frameSlots[i];
      const sx = slot.x - cam.x;
      const sy = slot.y - cam.y;
      if (sx < -200 || sx > 1480) continue;
      // frame
      ctx.save();
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(sx - 56, sy - 38, 112, 76);
      // mat
      ctx.fillStyle = '#fff5dc';
      ctx.fillRect(sx - 52, sy - 34, 104, 68);
      // image
      const img = getImage(snap);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, sx - 48, sy - 30, 96, 60);
      } else {
        ctx.fillStyle = '#dcd0a8';
        ctx.fillRect(sx - 48, sy - 30, 96, 60);
      }
      // hanging nail
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(sx, sy - 42, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    setGame, capture, save, remove,
    openGallery, closeGallery,
    drawHungFrames,
  };
})();
