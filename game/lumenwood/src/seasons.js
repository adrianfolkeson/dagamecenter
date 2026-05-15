// ---------------------------------------------------------------------------
// Seasons — gentle palette shifts driven by the real-world month. Each biome
// reacts differently: Mossroot greens deepen in summer and warm to amber in
// autumn; Honeydrop frosts in winter; Tidepools cool slightly in winter;
// Starpetal and Winter Grove are season-agnostic.
//
// Pure overlay — never affects gameplay, just colour. The overlay strength
// is low (alpha < 0.2) so the watercolour feel is preserved.
// ---------------------------------------------------------------------------

window.Seasons = (function () {
  // Northern-hemisphere defaults; kids in Sweden / North America / EU read it
  // intuitively. (Project repo lives in Stockholm.)
  function current() {
    const m = new Date().getMonth();   // 0 = Jan
    if (m === 11 || m <= 1) return 'winter';
    if (m <= 4) return 'spring';
    if (m <= 7) return 'summer';
    return 'autumn';
  }

  // Per-biome × per-season tint. null = no overlay.
  const TINTS = {
    mossroot: {
      spring: { color: '180, 220, 160', alpha: 0.10 },
      summer: { color: '120, 180, 100', alpha: 0.08 },
      autumn: { color: '230, 150, 80',  alpha: 0.18 },
      winter: { color: '210, 220, 235', alpha: 0.20 },
    },
    honeydrop: {
      spring: { color: '230, 200, 230', alpha: 0.12 },
      summer: { color: '255, 220, 130', alpha: 0.08 },
      autumn: { color: '220, 150, 80',  alpha: 0.16 },
      winter: { color: '200, 215, 230', alpha: 0.22 },
    },
    tidepools: {
      spring: { color: '180, 220, 220', alpha: 0.08 },
      summer: { color: '255, 230, 160', alpha: 0.06 },
      autumn: { color: '210, 170, 130', alpha: 0.10 },
      winter: { color: '180, 200, 220', alpha: 0.14 },
    },
    starpetal: null,
    winter:    null,
    treehouse: null,
  };

  function draw(ctx, FRAME_W, FRAME_H, sceneId) {
    const map = TINTS[sceneId];
    if (!map) return;
    const tint = map[current()];
    if (!tint) return;
    ctx.save();
    ctx.fillStyle = `rgba(${tint.color},${tint.alpha})`;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    ctx.restore();
  }

  return { current, draw };
})();
