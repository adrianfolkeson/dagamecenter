// ---------------------------------------------------------------------------
// Input — keyboard handling. Held keys + one-shot edge events.
// ---------------------------------------------------------------------------

window.Input = (function () {
  const held = new Set();
  const pressedThisFrame = new Set();

  // map physical keys to abstract actions so we accept WASD + arrows together
  const KEYMAP = {
    'KeyW': 'up',    'ArrowUp':    'up',
    'KeyS': 'down',  'ArrowDown':  'down',
    'KeyA': 'left',  'ArrowLeft':  'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'Space':         'action',
    'KeyE':          'interact',
    'KeyJ':          'journal',
    'KeyH':          'home',
    'KeyP':          'snapshot',
    'KeyQ':          'quests',
    'Escape':        'cancel',
  };

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (!held.has(a)) pressedThisFrame.add(a);
    held.add(a);
    // prevent page scroll on arrows / space
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) held.delete(a);
  });
  // safety: drop held state if focus is lost
  window.addEventListener('blur', () => held.clear());

  return {
    isDown(a)  { return held.has(a); },
    pressed(a) { return pressedThisFrame.has(a); },
    endFrame() { pressedThisFrame.clear(); },
    // give UI a way to clear input when modals open
    clear() { held.clear(); pressedThisFrame.clear(); },
    // virtual input hooks (touch joystick / buttons)
    virtualSetHeld(action, on) {
      if (on) { if (!held.has(action)) pressedThisFrame.add(action); held.add(action); }
      else    { held.delete(action); }
    },
    virtualPress(action) {
      pressedThisFrame.add(action);
    },
  };
})();
