// ---------------------------------------------------------------------------
// Speech — Web Speech API read-aloud. Opt-in via settings.readAloud. Speaks
// short snippets used in dialog boxes, toasts, and journal blurbs. Cancels
// on any new utterance so it doesn't pile up.
// ---------------------------------------------------------------------------

window.Speech = (function () {
  let game = null;
  function setGame(g) { game = g; }

  const supported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

  function enabled() {
    return supported && game && game.save && game.save.settings && game.save.settings.readAloud;
  }

  function say(text) {
    if (!enabled() || !text) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(stripHtml(String(text)));
      u.rate = 0.95;
      u.pitch = 1.05;
      u.volume = 0.9;
      // Prefer a friendly voice if available
      const voices = synth.getVoices();
      const preferred = voices.find(v => /samantha|kate|moira|fiona|sara|female/i.test(v.name + ' ' + (v.lang || '')))
                     || voices.find(v => v.lang && v.lang.startsWith('en'))
                     || voices[0];
      if (preferred) u.voice = preferred;
      synth.speak(u);
    } catch (e) {}
  }

  function stop() {
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  function stripHtml(s) {
    return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  return { setGame, say, stop, enabled, supported };
})();
