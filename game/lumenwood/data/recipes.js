// ---------------------------------------------------------------------------
// Recipes — cooking combinations. Each recipe takes 2 ingredient food ids and
// produces a "made food" — a new food id that boosts happiness extra. Made
// foods are inserted into FOODS at boot so the rest of the food system (feed
// picker, swatches, etc.) works without changes.
//
//  Reading note: when a kid tries an unknown combo we fall back to a fun
//  "Cloud Soup" — never gross, never punishing. The kid still gets a food.
// ---------------------------------------------------------------------------

window.RECIPES = [
  { a: 'honeycake',  b: 'moonberry',  out: 'moonlit_cake',
    name: 'Moonlit Cake',   color: '#dcd0e8', accent: '#8b7aa8',
    blurb: 'Sweet and silver. Mira and Sundrop both adore it.',
    lovedBy: ['mira', 'sundrop'] },

  { a: 'pollenpop',  b: 'beebalm',    out: 'honey_bomb',
    name: 'Honey Bomb',     color: '#ffd97a', accent: '#e8a86a',
    blurb: 'Pops a tiny cloud of gold when bitten.',
    lovedBy: ['buzz', 'honeysop'] },

  { a: 'mintleaf',   b: 'pearlfruit', out: 'stream_tea',
    name: 'Stream Tea',     color: '#bce0d4', accent: '#88c4c0',
    blurb: 'Cool and quiet, like the bend in the river.',
    lovedBy: ['tully', 'hush'] },

  { a: 'cloverpuff', b: 'iceberry',   out: 'frost_salad',
    name: 'Frost Salad',    color: '#d4e8b4', accent: '#a8c068',
    blurb: 'Crisp greens with a chilly little crunch.',
    lovedBy: ['pip', 'frostie'] },

  { a: 'spicebread', b: 'sugarbud',   out: 'heart_tart',
    name: 'Warm-Heart Tart', color: '#f5b89a', accent: '#e07654',
    blurb: 'Cinnamon and rose. Best shared.',
    lovedBy: ['cinder', 'petal'] },

  // Festival exclusive — set 'festival' so the kitchen reveals it only when
  // the festival flag is active.
  { a: 'moonberry', b: 'honeycake', alt: ['iceberry', 'sugarbud', 'pollenpop'],
    out: 'festival_cake',
    festival: true,
    name: 'Festival Cake',  color: '#f6d0d8', accent: '#d96a6a',
    blurb: 'Glows softly. Smells like the whole forest at dusk.',
    lovedBy: ['mira', 'sundrop', 'petal', 'meadowlark'] },
];

// Look up a recipe by its two ingredient ids (order-independent).
window.findRecipe = function (idA, idB) {
  for (const r of window.RECIPES) {
    if ((r.a === idA && r.b === idB) || (r.a === idB && r.b === idA)) return r;
  }
  return null;
};

// "Cloud Soup" — universal fallback. Mildly liked by all, sweet and silly.
window.CLOUD_SOUP = {
  id: 'cloud_soup',
  name: 'Cloud Soup',
  color: '#e8e4f2',
  accent: '#b8b4d0',
  blurb: 'Fluffy, slightly perplexed. Glims sip it politely.',
  price: 0,
  seller: 'kitchen',
  tasteNote: 'A friendly puff of warmth.',
  lovedBy: [],
};

// Register recipe outputs as feedable foods (so they appear in the picker).
// This runs once on script load.
(function registerMadeFoods() {
  function asFood(r) {
    return {
      id: r.out,
      name: r.name,
      color: r.color,
      accent: r.accent,
      price: 0,             // not bought, only crafted
      seller: 'kitchen',
      tasteNote: r.blurb,
      lovedBy: r.lovedBy,
      crafted: true,
    };
  }
  for (const r of window.RECIPES) {
    if (!window.FOODS.find(f => f.id === r.out)) {
      window.FOODS.push(asFood(r));
    }
  }
  if (!window.FOODS.find(f => f.id === 'cloud_soup')) {
    window.FOODS.push(window.CLOUD_SOUP);
  }
})();
