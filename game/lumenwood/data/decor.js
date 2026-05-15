// ---------------------------------------------------------------------------
// Treehouse decorations sold at Pippa's stand. Each item costs sparkledust
// plus, in some cases, a "decor token" (earned from quest turn-ins).
// Bought items live in save.decor[id] = true and are drawn by the treehouse
// scene's foreground pass.
// ---------------------------------------------------------------------------

window.DECOR = [
  { id: 'rug-circle',         name: 'Round Rug',        price: 40,  tokens: 0,
    color: '#d96a6a', accent: '#fff5dc',
    desc: 'A warm circular rug under the stove.' },
  { id: 'rug-runner',         name: 'Runner Rug',       price: 60,  tokens: 0,
    color: '#7088a8', accent: '#fff5dc',
    desc: 'A long striped runner down the centre of the room.' },
  { id: 'plushie-cinder',     name: 'Cinder Plushie',   price: 30,  tokens: 1,
    color: '#f5a986', accent: '#e07654',
    desc: 'A stuffed ember-Glim. Sits on the bench by the window.' },
  { id: 'plushie-tully',      name: 'Tully Plushie',    price: 30,  tokens: 1,
    color: '#a8d6d2', accent: '#88c4c0',
    desc: 'A stuffed tide-Glim, with a tiny shell sewn on.' },
  { id: 'chime-windowsill',   name: 'Wind Chime',       price: 50,  tokens: 0,
    color: '#c8a878', accent: '#fff5dc',
    desc: 'Wooden chimes that hang in the window.' },
  { id: 'wallpaper-mint',     name: 'Mint Wallpaper',   price: 90,  tokens: 1,
    color: '#c8ecdf', accent: '#88c4c0',
    desc: 'A soft mint wash for the treehouse walls.' },
  { id: 'wallpaper-twilight', name: 'Twilight Wallpaper', price: 120, tokens: 2,
    color: '#8b7aa8', accent: '#5d4a7a',
    desc: 'A deep twilight palette for evening visitors.' },
];

window.decorById = function (id) {
  return window.DECOR.find(d => d.id === id);
};
