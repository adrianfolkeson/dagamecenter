// ---------------------------------------------------------------------------
// Tutorial — a tiny "coach" hint card that walks new players through the
// first few actions. Each step has a check; once true, the step is marked
// complete and the next step appears. State is persisted in save.flags.tutor
// so we never repeat once finished.
// ---------------------------------------------------------------------------

window.Tutorial = (function () {
  let game = null;
  let card = null;
  let lastStep = null;

  const STEPS = [
    {
      id: 'move',
      text: 'Walk around. Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys.',
      check: (g) => g.player && g.player.totalDistance > 80,
    },
    {
      id: 'bubble',
      text: 'See a glow? Get close, then tap <kbd>Space</kbd> to blow a bubble.',
      check: (g) => Object.keys(g.save.caught).length >= 1,
    },
    {
      id: 'journal',
      text: 'Nice catch! Press <kbd>J</kbd> to read about your new friend in the journal.',
      check: () => !!document.querySelector('#modal-journal.show') ||
                   document.querySelector('#modal-journal[data-opened="true"]'),
      onShow() {
        // mark when journal is first opened, since we can't detect easily
        const m = document.getElementById('modal-journal');
        const obs = new MutationObserver(() => {
          if (m.classList.contains('show')) {
            m.setAttribute('data-opened', 'true');
            obs.disconnect();
          }
        });
        obs.observe(m, { attributes: true, attributeFilter: ['class'] });
      },
    },
    {
      id: 'pippa',
      text: 'Find Pippa near the path. Press <kbd>E</kbd> to say hello.',
      check: (g) => !!(g.save.flags && g.save.flags.metPippa),
    },
    {
      id: 'door',
      text: 'When you’re ready, return to your treehouse. Press <kbd>H</kbd> any time.',
      check: (g) => g.save.lastScene === 'treehouse' ||
                    (g.save.flags && g.save.flags.tutorComplete),
    },
  ];

  function setGame(g) { game = g; }

  function start() {
    if (!game) return;
    if (!game.save.flags) game.save.flags = {};
    if (game.save.flags.tutorComplete) return;
    if (!game.save.flags.tutor) game.save.flags.tutor = {};
    ensureCard();
    render();
  }

  function ensureCard() {
    if (card) return;
    card = document.createElement('div');
    card.id = 'tutor-card';
    card.className = 'tutor-card';
    document.getElementById('frame').appendChild(card);
  }

  function render() {
    if (!card) return;
    // pick next un-finished step
    const next = STEPS.find(s => !game.save.flags.tutor[s.id]);
    if (!next) {
      hide();
      game.save.flags.tutorComplete = true;
      Save.save(game.save);
      return;
    }
    if (lastStep !== next.id) {
      card.innerHTML = `<div class="tutor-text">${next.text}</div>
                       <button class="tutor-x" aria-label="Dismiss">✕</button>`;
      card.querySelector('.tutor-x').addEventListener('click', () => {
        // dismiss all remaining tutorial steps
        for (const s of STEPS) game.save.flags.tutor[s.id] = true;
        game.save.flags.tutorComplete = true;
        Save.save(game.save);
        hide();
      });
      card.classList.add('show');
      lastStep = next.id;
      if (typeof next.onShow === 'function') next.onShow();
    }
  }

  function hide() {
    if (!card) return;
    card.classList.remove('show');
  }

  // Called every frame from game.js update — cheap.
  function tick() {
    if (!game) return;
    if (!game.save.flags || game.save.flags.tutorComplete) {
      hide();
      return;
    }
    for (const s of STEPS) {
      if (game.save.flags.tutor[s.id]) continue;
      try {
        if (s.check(game)) {
          game.save.flags.tutor[s.id] = true;
          Save.save(game.save);
          render();
          return;
        }
      } catch (e) {}
    }
    // make sure card is showing
    if (!card || !card.classList.contains('show')) render();
  }

  return { setGame, start, tick, hide };
})();
