// ---------------------------------------------------------------------------
// Food definitions. Each food has a name, colour, price (in sparkledust),
// where it's sold, and a free-form 'tasteNote' shown when a Glim eats it
// that isn't its favourite. The relationship between Glim and favourite food
// lives on the Glim definition (def.food) — we match by food.name.
// ---------------------------------------------------------------------------

window.FOODS = [
  // Mossroot favourites
  { id: 'moonberry',  name: 'Moonberry',   color: '#8b7aa8', accent: '#dfe4f2', price: 8,
    seller: 'pippa', tasteNote: 'It glows faintly. They liked it.' },
  { id: 'cloverpuff', name: 'Clover-puff', color: '#b6dc8a', accent: '#6e9b62', price: 5,
    seller: 'pippa', tasteNote: 'Crunchy and fresh.' },
  { id: 'honeycake',  name: 'Honeycake',   color: '#ffd97a', accent: '#e8a86a', price: 10,
    seller: 'pippa', tasteNote: 'Warm and a little sticky.' },
  { id: 'pearlfruit', name: 'Pearlfruit',  color: '#a8d6d2', accent: '#88c4c0', price: 7,
    seller: 'pippa', tasteNote: 'Cool, like a sip of stream.' },
  { id: 'spicebread', name: 'Spicebread',  color: '#f5a986', accent: '#e07654', price: 8,
    seller: 'pippa', tasteNote: 'Toasty and cinnamon-soft.' },
  { id: 'mintleaf',   name: 'Mintleaf',    color: '#c8ecdf', accent: '#88c4c0', price: 6,
    seller: 'pippa', tasteNote: 'A nice green nibble.' },
  { id: 'iceberry',   name: 'Iceberry',    color: '#c8ecdf', accent: '#a8d6d2', price: 9,
    seller: 'pippa', tasteNote: 'Refreshingly cold.' },
  { id: 'sugarbud',   name: 'Sugarbud',    color: '#f6c2cf', accent: '#e08aa2', price: 6,
    seller: 'pippa', tasteNote: 'Sweet and floral.' },
  // Honeydrop introductions
  { id: 'pollenpop',  name: 'Pollenpop',   color: '#ffd97a', accent: '#f2a85a', price: 8,
    seller: 'pippa', tasteNote: 'It puffs a little cloud of gold.' },
  { id: 'beebalm',    name: 'Beebalm',     color: '#f0d090', accent: '#c89270', price: 7,
    seller: 'pippa', tasteNote: 'A warm, herby flower.' },
];

window.foodById = function (id) {
  return window.FOODS.find(function (f) { return f.id === id; });
};

// Find the food whose name matches a Glim's favourite (def.food is a name string).
window.favouriteFoodFor = function (glimDef) {
  return window.FOODS.find(function (f) { return f.name === glimDef.food; });
};
