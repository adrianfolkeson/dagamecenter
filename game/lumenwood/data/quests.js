// ---------------------------------------------------------------------------
// Quest definitions. Each is a small favour from a villager. Quests are
// auto-offered once the player has met the NPC (and the previous chain quest
// is turned in, if any). No timer, no failure — they stay open until
// completed and turned in via the Quests panel.
//
// Fields:
//   id          — unique key
//   asker       — display name of the villager
//   requires    — save.flags key that must be true (e.g. metPippa)
//   prereqQuest — optional id of a quest that must be 'turned_in' first
//   type        — 'catch' | 'gather' | 'flag'
//   ask         — short text shown in the panel
//   reward      — { dust, token }
// ---------------------------------------------------------------------------

window.QUESTS = [
  // ---------------- Pippa (Mossroot) — 3-quest chain ----------------
  { id: 'pippa1', asker: 'Pippa', requires: 'metPippa', type: 'gather',
    food: 'honeycake', count: 3,
    ask: 'Could you bring me three Honeycakes? Buzz is wild for them.',
    reward: { dust: 20, token: 1 } },
  { id: 'pippa2', asker: 'Pippa', requires: 'metPippa', prereqQuest: 'pippa1',
    type: 'catch', glim: 'sundrop',
    ask: 'My delivery basket keeps tipping. If you spot Sundrop, ask them to help warm the path.',
    reward: { dust: 25, token: 1 } },
  { id: 'pippa3', asker: 'Pippa', requires: 'metPippa', prereqQuest: 'pippa2',
    type: 'gather', food: 'beebalm', count: 4,
    ask: 'Four Beebalm for my pickling crock. Honeydrop way, usually.',
    reward: { dust: 40, token: 2 } },

  // ---------------- Wren (Honeydrop) — 3-quest chain ----------------
  { id: 'wren1', asker: 'Wren', requires: 'metWren', type: 'catch',
    glim: 'honeysop',
    ask: 'Have you seen Honeysop in the meadow? Find them and let me know.',
    reward: { dust: 18, token: 1 } },
  { id: 'wren2', asker: 'Wren', requires: 'metWren', prereqQuest: 'wren1',
    type: 'gather', food: 'pollenpop', count: 2,
    ask: 'My bees are restless — bring two Pollenpop and we’ll settle them.',
    reward: { dust: 22, token: 1 } },
  { id: 'wren3', asker: 'Wren', requires: 'metWren', prereqQuest: 'wren2',
    type: 'catch', glim: 'goldfin',
    ask: 'Goldfin sometimes naps on the picnic blanket. Catch them gently.',
    reward: { dust: 35, token: 2 } },

  // ---------------- Cobble (Mossroot) — 3-quest chain ----------------
  { id: 'cobble1', asker: 'Cobble', requires: 'metCobble', type: 'catch',
    glim: 'frostie',
    ask: 'Frostie was the first Glim I ever met. If you find them, do tell.',
    reward: { dust: 22, token: 1 } },
  { id: 'cobble2', asker: 'Cobble', requires: 'metCobble', prereqQuest: 'cobble1',
    type: 'catch', glim: 'mossy',
    ask: 'Mossy and I are old friends. Bring them to me for a chat.',
    reward: { dust: 22, token: 1 } },
  { id: 'cobble3', asker: 'Cobble', requires: 'metCobble', prereqQuest: 'cobble2',
    type: 'gather', food: 'mintleaf', count: 3,
    ask: 'Three Mintleaf for the morning tea. I’ll save you a cup.',
    reward: { dust: 36, token: 2 } },

  // ---------------- Marlowe (Tidepools) — 3-quest chain ----------------
  { id: 'marlowe1', asker: 'Marlowe', requires: 'metMarlowe', type: 'gather',
    food: 'pearlfruit', count: 2,
    ask: 'Two Pearlfruit would make a fine evening soup.',
    reward: { dust: 24, token: 1 } },
  { id: 'marlowe2', asker: 'Marlowe', requires: 'metMarlowe', prereqQuest: 'marlowe1',
    type: 'catch', glim: 'foam',
    ask: 'Foam keeps slipping past my net. Befriend them for me?',
    reward: { dust: 28, token: 1 } },
  { id: 'marlowe3', asker: 'Marlowe', requires: 'metMarlowe', prereqQuest: 'marlowe2',
    type: 'flag', flag: 'caughtCloudfish',
    ask: 'Try the cloud-fishing once on your own — the pool only sings to you.',
    reward: { dust: 40, token: 2 } },

  // ---------------- Astra (Starpetal) — 3-quest chain ----------------
  { id: 'astra1', asker: 'Astra', requires: 'metAstra', type: 'catch',
    glim: 'lullaby',
    ask: 'Lullaby names the stars. Befriend them, and the constellations get easier to trace.',
    reward: { dust: 30, token: 2 } },
  { id: 'astra2', asker: 'Astra', requires: 'metAstra', prereqQuest: 'astra1',
    type: 'catch', glim: 'aurora',
    ask: 'Aurora paints the sky when no one is watching. Be quiet and patient.',
    reward: { dust: 40, token: 2 } },
  { id: 'astra3', asker: 'Astra', requires: 'metAstra', prereqQuest: 'astra2',
    type: 'flag', flag: 'allConstellationsTraced',
    ask: 'Trace all three constellations and the sky will sing for you.',
    reward: { dust: 60, token: 3 } },

  // ---------------- Theo the Merchant (new, Mossroot south) ----------------
  { id: 'theo1', asker: 'Theo', requires: 'metTheo', type: 'gather',
    food: 'iceberry', count: 1,
    ask: 'A single Iceberry for the road, friend. Anywhere cold enough will do.',
    reward: { dust: 18, token: 1 } },
  { id: 'theo2', asker: 'Theo', requires: 'metTheo', prereqQuest: 'theo1',
    type: 'catch', glim: 'comet',
    ask: 'I once raced a Comet Glim through the peaks. Help me catch up to one.',
    reward: { dust: 28, token: 1 } },
  { id: 'theo3', asker: 'Theo', requires: 'metTheo', prereqQuest: 'theo2',
    type: 'gather', food: 'spicebread', count: 5,
    ask: 'Five Spicebread for the long road north. I’ll repay you handsomely.',
    reward: { dust: 50, token: 2 } },

  // ---------------- Juno the Baker (new, Treehouse, post cookedAny) ----------------
  { id: 'juno1', asker: 'Juno', requires: 'metJuno', type: 'gather',
    food: 'sugarbud', count: 2,
    ask: 'Two Sugarbud and I’ll teach you my Warm-Heart Tart trick.',
    reward: { dust: 22, token: 1 } },
  { id: 'juno2', asker: 'Juno', requires: 'metJuno', prereqQuest: 'juno1',
    type: 'flag', flag: 'cookedAny',
    ask: 'Cook me anything from your own stove — I want to taste what you’ve learned.',
    reward: { dust: 30, token: 1 } },
  { id: 'juno3', asker: 'Juno', requires: 'metJuno', prereqQuest: 'juno2',
    type: 'catch', glim: 'honeysop',
    ask: 'Honeysop is my best taster. Bring them to my kitchen, please.',
    reward: { dust: 42, token: 2 } },

  // ---------------- Vela the Cloudwatcher (new, Winter Grove) ----------------
  { id: 'vela1', asker: 'Vela', requires: 'metVela', type: 'catch',
    glim: 'crystal',
    ask: 'Crystal sings when the dawn light hits them. Befriend them and tell me what you hear.',
    reward: { dust: 28, token: 1 } },
  { id: 'vela2', asker: 'Vela', requires: 'metVela', prereqQuest: 'vela1',
    type: 'gather', food: 'iceberry', count: 3,
    ask: 'Three Iceberries for the long watch. I’ll trade you a story for each.',
    reward: { dust: 36, token: 2 } },
  { id: 'vela3', asker: 'Vela', requires: 'metVela', prereqQuest: 'vela2',
    type: 'catch', glim: 'moonlace',
    ask: 'Moonlace weaves something only winter eyes can see. Find them at the frozen pond.',
    reward: { dust: 60, token: 3 } },
];
