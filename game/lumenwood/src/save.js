// ---------------------------------------------------------------------------
// Save / load — localStorage only. The whole world's persistent state lives
// in a single JSON blob so it's easy to inspect / migrate.
// ---------------------------------------------------------------------------

window.Save = (function () {
  const KEY_BASE = 'lumenwood.save.v1';
  const SLOT_KEY = 'lumenwood.activeSlot';

  function slotKey(i) { return KEY_BASE + '.' + i; }
  function activeSlot() {
    const v = localStorage.getItem(SLOT_KEY);
    const n = v == null ? 0 : parseInt(v, 10);
    return (isNaN(n) || n < 0 || n > 2) ? 0 : n;
  }
  function setActiveSlot(i) {
    localStorage.setItem(SLOT_KEY, String(i));
  }

  // Migrate legacy single-slot save (KEY_BASE) into slot 0 if present.
  (function migrateLegacy() {
    try {
      const legacy = localStorage.getItem(KEY_BASE);
      if (legacy && !localStorage.getItem(slotKey(0))) {
        localStorage.setItem(slotKey(0), legacy);
      }
    } catch (e) {}
  })();

  const defaults = () => ({
    version: 2,
    firstRun: true,
    caught: {},                // id -> { caughtAt, happiness, lastGift, lastPet }
    seen:   {},                // id -> firstSeenAt (Glim spotted but not caught)
    dust:   0,                 // sparkledust currency
    inventory: {},             // foodId -> count
    flags: {                   // generic event/unlock bits
      metPippa: false,
      metMarlowe: false,
      metAstra: false,
      metWren: false,
      metCobble: false,
      metTheo: false,
      metJuno: false,
      metVela: false,
      unlockedHoneydrop: false,
    },
    settings: {
      sound: false,
      reducedMotion: false,
      bigText: false,
      readAloud: false,
    },
    lastScene: 'mossroot',
    playerName: 'Keeper',
    lastPlayed: 0,             // ms timestamp — used to compute happiness decay
    snapshots: [],             // [{ id, title, scene, dataUrl, takenAt }]
    quests: {},                // questId -> { state, progress, ... }
    appearance: null,          // { skin, hair, hairStyle, outfit } — set on first run
    decor: {},                 // treehouse decor purchases: itemId -> true
  });

  function load() {
    try {
      const raw = localStorage.getItem(slotKey(activeSlot()));
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      // shallow merge to absorb new default keys added later
      const d = defaults();
      return Object.assign(d, data, {
        flags:    Object.assign(d.flags,    data.flags    || {}),
        settings: Object.assign(d.settings, data.settings || {}),
      });
    } catch (e) {
      console.warn('Save load failed, starting fresh', e);
      return defaults();
    }
  }

  function save(state) {
    try { localStorage.setItem(slotKey(activeSlot()), JSON.stringify(state)); }
    catch (e) { console.warn('Save write failed', e); }
  }

  function wipe() {
    try { localStorage.removeItem(slotKey(activeSlot())); } catch (e) { /* noop */ }
  }

  // ---- Slot operations -----
  function listSlots() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const raw = localStorage.getItem(slotKey(i));
      if (!raw) { out.push({ slot: i, empty: true }); continue; }
      try {
        const data = JSON.parse(raw);
        out.push({
          slot: i,
          empty: false,
          caught: Object.keys(data.caught || {}).length,
          dust:   data.dust || 0,
          lastPlayed: data.lastPlayed || 0,
          playerName: data.playerName || 'Keeper',
        });
      } catch (e) {
        out.push({ slot: i, empty: true, corrupt: true });
      }
    }
    return out;
  }

  function switchSlot(i) {
    if (i < 0 || i > 2) return;
    setActiveSlot(i);
  }

  // Export current active slot as a base64-encoded JSON string (URL-safe).
  function exportActive() {
    const raw = localStorage.getItem(slotKey(activeSlot())) || JSON.stringify(defaults());
    try { return btoa(unescape(encodeURIComponent(raw))); }
    catch (e) { return ''; }
  }

  // Import a base64 string into the active slot. Returns true on success.
  function importToActive(b64) {
    try {
      const raw = decodeURIComponent(escape(atob(b64)));
      JSON.parse(raw);              // validate
      localStorage.setItem(slotKey(activeSlot()), raw);
      return true;
    } catch (e) { return false; }
  }

  return { load, save, wipe, defaults,
           listSlots, activeSlot, switchSlot,
           exportActive, importToActive };
})();
