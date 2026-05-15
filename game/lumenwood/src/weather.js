// ---------------------------------------------------------------------------
// Weather — brief, gentle effects layered over the active scene. Used by the
// Surprise module and by festivals. Self-times out. Visuals only — never
// affects gameplay.
// ---------------------------------------------------------------------------

window.Weather = (function () {
  let active = null;   // { kind, until, particles }

  function start(kind, durationMs) {
    const count = (kind === 'snow') ? 80 : (kind === 'rain') ? 100 : 40;
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * 1280,
        y: Math.random() * 800,
        vx: kind === 'rain' ? -2 : (Math.random() - 0.5) * 0.6,
        vy: kind === 'snow' ? 0.6 + Math.random() * 0.8
          : kind === 'rain' ? 6 + Math.random() * 3
          : kind === 'petals' ? 0.5 + Math.random() * 0.8
          : 0.15,
        size: kind === 'mist' ? 30 + Math.random() * 60
            : kind === 'snow' ? 1.4 + Math.random() * 1.2
            : kind === 'petals' ? 4 + Math.random() * 4
            : 1 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    active = { kind, until: Date.now() + durationMs, particles };
  }

  function stop() { active = null; }

  function draw(ctx, FRAME_W, FRAME_H, time) {
    if (!active) return;
    if (Date.now() > active.until) { active = null; return; }
    const a = active;
    ctx.save();
    if (a.kind === 'mist') {
      ctx.fillStyle = 'rgba(220,228,240,0.55)';
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      for (const p of a.particles) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += Math.sin(time * 0.0005 + p.phase) * 0.4;
      }
    } else if (a.kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of a.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx + Math.sin(time * 0.001 + p.phase) * 0.4;
        p.y += p.vy;
        if (p.y > FRAME_H) { p.y = -4; p.x = Math.random() * FRAME_W; }
        if (p.x < 0) p.x = FRAME_W;
        if (p.x > FRAME_W) p.x = 0;
      }
    } else if (a.kind === 'rain') {
      ctx.strokeStyle = 'rgba(180,200,220,0.65)';
      ctx.lineWidth = 1;
      for (const p of a.particles) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.vy);
        ctx.stroke();
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > FRAME_H) { p.y = -10; p.x = Math.random() * FRAME_W + 20; }
      }
    } else if (a.kind === 'petals') {
      for (const p of a.particles) {
        ctx.fillStyle = (Math.floor(p.phase * 3) % 2)
          ? 'rgba(246,194,207,0.85)' : 'rgba(255,217,122,0.85)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.55, p.phase, 0, Math.PI * 2);
        ctx.fill();
        p.x += Math.sin(time * 0.0008 + p.phase) * 0.8;
        p.y += p.vy;
        if (p.y > FRAME_H) { p.y = -6; p.x = Math.random() * FRAME_W; }
      }
    }
    ctx.restore();
  }

  function isActive() { return !!active; }
  function kind() { return active && active.kind; }

  return { start, stop, draw, isActive, kind };
})();
