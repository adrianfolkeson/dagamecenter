// ---------------------------------------------------------------------------
// Touch — on-screen joystick + action buttons for phones / tablets. Shown
// only when the platform has a coarse pointer (touchscreen). Keyboard input
// continues to work in parallel — touch is additive.
// ---------------------------------------------------------------------------

window.Touch = (function () {
  let active = false;

  function isTouchDevice() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
           ('ontouchstart' in window);
  }

  function mount() {
    if (active) return;
    if (!isTouchDevice()) return;
    active = true;
    const frame = document.getElementById('frame');

    // joystick base + knob
    const base = document.createElement('div');
    base.className = 'tch-joy-base';
    const knob = document.createElement('div');
    knob.className = 'tch-joy-knob';
    base.appendChild(knob);
    frame.appendChild(base);

    // action cluster
    const cluster = document.createElement('div');
    cluster.className = 'tch-cluster';
    cluster.innerHTML = `
      <button class="tch-btn tch-action" data-act="action" aria-label="Bubble">○</button>
      <div class="tch-row">
        <button class="tch-btn small" data-act="interact" aria-label="Interact">E</button>
        <button class="tch-btn small" data-act="journal"  aria-label="Journal">J</button>
        <button class="tch-btn small" data-act="snapshot" aria-label="Snapshot">P</button>
      </div>
    `;
    frame.appendChild(cluster);

    // -- Joystick: track centre + radius
    const RADIUS = 56;
    const DEADZONE = 0.18;
    let dragging = false;
    let centre = { x: 0, y: 0 };

    function setStickFromTouch(t) {
      const dx = t.clientX - centre.x;
      const dy = t.clientY - centre.y;
      const d = Math.hypot(dx, dy);
      const clamped = Math.min(RADIUS, d);
      const nx = d > 0 ? dx / d * clamped : 0;
      const ny = d > 0 ? dy / d * clamped : 0;
      knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
      // convert to held axes via deadzone
      const ax = nx / RADIUS;
      const ay = ny / RADIUS;
      Input.virtualSetHeld('left',  ax < -DEADZONE);
      Input.virtualSetHeld('right', ax >  DEADZONE);
      Input.virtualSetHeld('up',    ay < -DEADZONE);
      Input.virtualSetHeld('down',  ay >  DEADZONE);
    }

    function clearStick() {
      knob.style.transform = 'translate(-50%, -50%)';
      Input.virtualSetHeld('left',  false);
      Input.virtualSetHeld('right', false);
      Input.virtualSetHeld('up',    false);
      Input.virtualSetHeld('down',  false);
    }

    base.addEventListener('touchstart', (e) => {
      const rect = base.getBoundingClientRect();
      centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      dragging = true;
      setStickFromTouch(e.touches[0]);
      e.preventDefault();
    });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      // find a touch near the base
      for (const t of e.touches) {
        const rect = base.getBoundingClientRect();
        if (Math.abs(t.clientX - (rect.left + rect.width/2)) < 200) {
          setStickFromTouch(t);
          break;
        }
      }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      dragging = false;
      clearStick();
    });

    // -- Buttons: synthesize key presses
    cluster.querySelectorAll('button[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      btn.addEventListener('touchstart', (e) => {
        Input.virtualSetHeld(act, true);
        Input.virtualPress(act);
        btn.classList.add('on');
        e.preventDefault();
      });
      btn.addEventListener('touchend', () => {
        Input.virtualSetHeld(act, false);
        btn.classList.remove('on');
      });
      // also support mouse for development
      btn.addEventListener('mousedown', () => {
        Input.virtualSetHeld(act, true);
        Input.virtualPress(act);
      });
      btn.addEventListener('mouseup', () => {
        Input.virtualSetHeld(act, false);
      });
    });
  }

  return { mount };
})();
