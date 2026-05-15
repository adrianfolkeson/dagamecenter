// ---------------------------------------------------------------------------
// Sticker book — collectible flat badges earned on milestones. Each entry
// has a check(game) function that returns true once earned. Stickers are
// idempotent: once earned, they stay; the check just needs to be true once.
// ---------------------------------------------------------------------------

window.STICKERS = [
  // ---- catching milestones ----
  { id: 'first-friend',  name: 'First Friend',  color: '#ffd97a', icon: '✦',
    desc: 'You met your very first Glim.',
    check: g => Object.keys(g.save.caught).length >= 1 },
  { id: 'tenfold',       name: 'Ten Friends',   color: '#b6dc8a', icon: '✺',
    desc: 'Befriended ten Glims in total.',
    check: g => Object.keys(g.save.caught).length >= 10 },
  { id: 'thirty',        name: 'A Glowing Grove', color: '#f6c2cf', icon: '❀',
    desc: 'Thirty lanterns lit in your treehouse.',
    check: g => Object.keys(g.save.caught).length >= 30 },
  { id: 'sixty',         name: 'A Full Roster', color: '#dfe4f2', icon: '◉',
    desc: 'Befriended every Glim in Lumenwood.',
    check: g => Object.keys(g.save.caught).length >= (window.GLIMS ? window.GLIMS.length : 60) },

  // ---- biome explorers ----
  { id: 'biome-mossroot', name: 'Mossroot Walker',  color: '#9bbf8e', icon: '✿',
    desc: 'Caught a Glim in Mossroot Hollow.',
    check: g => biomeHasCaught(g, 'mossroot') },
  { id: 'biome-honeydrop', name: 'Honeydrop Wanderer', color: '#ffd97a', icon: '☼',
    desc: 'Caught a Glim in Honeydrop Meadow.',
    check: g => biomeHasCaught(g, 'honeydrop') },
  { id: 'biome-tidepools', name: 'Tidewatcher',      color: '#a8d6d2', icon: '~',
    desc: 'Caught a Glim in the Whispering Tidepools.',
    check: g => biomeHasCaught(g, 'tidepools') },
  { id: 'biome-starpetal', name: 'Starpath Climber', color: '#cdd6f0', icon: '★',
    desc: 'Caught a Glim in the Starpetal Peaks.',
    check: g => biomeHasCaught(g, 'starpetal') },
  { id: 'biome-winter',    name: 'Winter Walker',    color: '#dde4f0', icon: '❄',
    desc: 'Caught a Glim in the Winter Grove.',
    check: g => biomeHasCaught(g, 'winter') },

  // ---- elements ----
  { id: 'elem-all',       name: 'All Elements',     color: '#fdf3c4', icon: '◈',
    desc: 'Met a Glim of every element.',
    check: g => allElementsCaught(g) },

  // ---- villagers ----
  { id: 'met-pippa',      name: 'Pippa’s Pal',      color: '#d96a6a', icon: '♥',
    desc: 'Said hello to Pippa.',
    check: g => g.save.flags && g.save.flags.metPippa },
  { id: 'met-everyone',   name: 'Village Knit',     color: '#8b7aa8', icon: '✱',
    desc: 'Met every villager.',
    check: g => ['metPippa','metWren','metCobble','metMarlowe','metAstra']
                  .every(f => g.save.flags && g.save.flags[f]) },

  // ---- activities ----
  { id: 'cook-first',     name: 'First Recipe',     color: '#e8b87f', icon: '◐',
    desc: 'Cooked something at the workshop.',
    check: g => g.save.flags && g.save.flags.cookedAny },
  { id: 'garden-first',   name: 'First Harvest',    color: '#b6dc8a', icon: '✿',
    desc: 'Harvested something from your garden.',
    check: g => g.save.flags && g.save.flags.harvestedAny },
  { id: 'festival',       name: 'Lantern Released', color: '#f6c2cf', icon: '✦',
    desc: 'Released a paper lantern at the festival.',
    check: g => g.save.flags && g.save.flags.festivalCelebrated },
  { id: 'biome-festivals', name: 'Three Songs',     color: '#fdf3c4', icon: '✺',
    desc: 'Celebrated Bloom Day, Tidesong, and Star-Counting Night.',
    check: g => g.save.flags && g.save.flags.celebratedBloomDay
             && g.save.flags.celebratedTidesong
             && g.save.flags.celebratedStarCount },
  { id: 'fishing',        name: 'Cloud-fisher',     color: '#a8d6d2', icon: '~',
    desc: 'Caught a cloud-fish at the Tidepools.',
    check: g => g.save.flags && g.save.flags.caughtCloudfish },
  { id: 'rhythm',         name: 'Bubble Songbird',  color: '#d4c4e4', icon: '♪',
    desc: 'Finished a Bubble Practice round.',
    check: g => g.save.flags && g.save.flags.rhythmDone },
  { id: 'constellation',  name: 'Stargazer',        color: '#cdd6f0', icon: '★',
    desc: 'Traced a constellation with Astra.',
    check: g => g.save.flags && g.save.flags.constellationsTraced &&
                Object.keys(g.save.flags.constellationsTraced).length >= 1 },

  // ---- collection / care ----
  { id: 'snap-first',     name: 'First Snapshot',   color: '#fff5dc', icon: '◇',
    desc: 'Hung your first picture in the treehouse.',
    check: g => (g.save.snapshots || []).length >= 1 },
  { id: 'snap-five',      name: 'Picture-Keeper',   color: '#f6c2cf', icon: '◈',
    desc: 'Five snapshots hung in your treehouse.',
    check: g => (g.save.snapshots || []).length >= 5 },
  { id: 'decor-first',    name: 'Cosy Touch',       color: '#d96a6a', icon: '✿',
    desc: 'Bought your first decoration.',
    check: g => g.save.decor && Object.keys(g.save.decor).length >= 1 },
  { id: 'quest-first',    name: 'First Favour',     color: '#b6dc8a', icon: '♥',
    desc: 'Completed a villager favour.',
    check: g => g.save.quests && Object.values(g.save.quests)
                  .some(q => q.state === 'turned_in') },
  { id: 'slept',          name: 'Sweet Dreams',     color: '#dfe4f2', icon: '☾',
    desc: 'Slept in the treehouse bed.',
    check: g => g.save.flags && g.save.flags.slept },
];

function biomeHasCaught(g, biome) {
  return (window.GLIMS || []).some(def =>
    def.biome.includes(biome) && g.save.caught[def.id]);
}
function allElementsCaught(g) {
  const need = ['sun','moon','leaf','tide','ember','whisper','frost','bloom'];
  return need.every(e => (window.GLIMS || []).some(def =>
    def.element === e && g.save.caught[def.id]));
}
