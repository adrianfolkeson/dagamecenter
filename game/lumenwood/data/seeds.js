// ---------------------------------------------------------------------------
// Seeds — the things Pippa sells (besides foods) that you plant in your
// garden plot. Each seed grows over real-time play into a plant that yields
// a stack of foods when harvested.
// ---------------------------------------------------------------------------

window.SEEDS = [
  { id: 'berryseed',  name: 'Berryseed',  food: 'moonberry',  color: '#8b7aa8', accent: '#dfe4f2',
    price: 12, growMs: 3 * 60 * 1000, yieldMin: 2, yieldMax: 3,
    plantBlurb: 'A purple sprout that hums a tiny tune at dusk.' },

  { id: 'cloverseed', name: 'Cloverseed', food: 'cloverpuff', color: '#b6dc8a', accent: '#6e9b62',
    price: 10, growMs: 2 * 60 * 1000, yieldMin: 2, yieldMax: 4,
    plantBlurb: 'Bouncy green clovers that tickle when you walk past.' },

  { id: 'mintseed',   name: 'Mintseed',   food: 'mintleaf',   color: '#c8ecdf', accent: '#88c4c0',
    price: 11, growMs: 2.5 * 60 * 1000, yieldMin: 2, yieldMax: 3,
    plantBlurb: 'Smells like a cool stream and freshly cut grass.' },
];

window.seedById = function (id) {
  return window.SEEDS.find(function (s) { return s.id === id; });
};
