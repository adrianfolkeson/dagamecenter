# Lumenwood

A web-based fantasy game for ages 6–11. You're a **Lantern Keeper** in a hidden forest village where every living thing — plants, animals, even weather — is powered by tiny floating sparks called **Glims**. No fighting, no losing, no fail states. Just discovery, friendship, and gentle care.

> *"You're a new Lantern Keeper. The forest is waiting."*

Passes **1–6** complete: six biomes, **sixty** Glims, eight villagers with three-step quest chains, three mini-games, cooking & gardening, four festivals, snapshot system, treehouse decoration shop, character customization, seasons, weather, ambient audio, surprise events, a soft tutorial, **sticker book**, **touch controls** for tablets/phones, **read-aloud** for pre-readers, and **three save slots** with export/import.

---

## How to run

Open `index.html` in any modern browser. No build, no install, no server.

```bash
open lumenwood/index.html         # macOS
xdg-open lumenwood/index.html     # Linux
start lumenwood/index.html        # Windows
```

Or drag the file onto a Chrome / Firefox / Safari window. Tested on Chrome 120+, Firefox 121+, Safari 17+.

The game works fully offline after the first font load (only the Fredoka webfont needs the network on first run).

## Controls

| Action | Keys |
|---|---|
| Move | `WASD` or arrow keys |
| Blow a bubble | `Space` |
| Interact (doors, NPCs, stove, bed, lanterns) | `E` |
| Open journal | `J` |
| Open quests | `Q` |
| Take a snapshot | `P` |
| Quick-warp home / outside | `H` |
| Close any menu | `Esc` |

Every menu is keyboard-navigable. Sound is **off by default** — toggle in Settings.

## The Glims

Twenty Glims live in Lumenwood. Each has an element (sun, moon, leaf, tide, ember, whisper, frost, bloom), a favourite food, a favourite spot, and a small personality blurb that fills in the journal once you've met them.

**Mossroot Hollow (8):** Mira, Pip, Sundrop, Tully, Cinder, Hush, Frostie, Petal.
**Honeydrop Meadow (4):** Buzz, Daffy, Honeysop, Lark.
**Whispering Tidepools (4):** Ripple, Kelpie, Pearl, Shimmer.
**Starpetal Peaks (4):** Nova, Lullaby, Comet, Echo.

Glims are catalogued by **shape as well as colour** — sun has rays, moon a crescent, leaf is a teardrop, tide a droplet, ember a flame, whisper a puff, frost a hex, bloom a flower-cluster — so they read for colourblind players too.

## The villagers

Five NPCs live in the woods and the wider world. Walk up and press `E`.

| NPC | Where | First gift | What they do |
|---|---|---|---|
| **Pippa the Forager** | Mossroot, on the path | — | Sells 10 foods + 3 seeds for sparkledust |
| **Cobble the Stone-tender** | Mossroot, south clearing | 12 sparkledust | Hints about Frostie |
| **Wren the Bee-keeper** | Honeydrop, by the beehive | 3 Honeycake | Bee-keeping wisdom |
| **Marlowe the Tidewatcher** | Tidepools | 10 sparkledust | Talk again to go **cloud-fishing** |
| **Astra the Stargazer** | Starpetal, at the telescope | 15 sparkledust | Talk again to **trace constellations** |

## The biomes

Each biome unlocks naturally as you befriend more Glims; nothing is gated behind grinding.

1. **Mossroot Hollow** — your starter forest. A winding stream, a clearing, mossy stones, the great old tree. Pippa's stand and your treehouse live here. Tones: sage and cream.
2. **The Treehouse** — your hub. Lantern Grove that lights up as you befriend Glims; kitchen stove for cooking; soil plots behind the building for gardening.
3. **Honeydrop Meadow** — sunny, buttery yellow with wildflowers, a beehive tree, a picnic blanket. Unlocks at **3 caught Glims**.
4. **Whispering Tidepools** — coastal: damp sand, rippling tidepools, sea-grass, distant surf. Unlocks at **5 caught Glims**.
5. **Starpetal Peaks** — night biome: twilight sky, a fat moon, distant misty peaks, cairns along a winding path, a telescope at the lookout. Unlocks at **8 caught Glims**.

## What you can do

- **Catch Glims** with soap bubbles. Walk close, press Space, watch them drift gently into the bubble.
- **Care for them** at home — feed them their favourite food, pet them, collect thank-you sparkledust gifts.
- **Spend sparkledust** at Pippa's stand on foods (different Glims love different things) and seeds.
- **Cook** at the kitchen stove. Five named recipes (Moonlit Cake, Honey Bomb, Stream Tea, Frost Salad, Warm-Heart Tart) plus a sixth festival-only recipe. A circular timing spinner gives 2× yield on a perfect stir. Mystery combos always produce a kind-hearted Cloud Soup — no fail state.
- **Garden.** Plant a seed in one of three plots behind the treehouse; come back in a few minutes of play; harvest a stack of the matching food.
- **Attend the Lantern Festival** — once you've befriended 5 Glims, Mossroot tips into a soft dusk. Paper lanterns hang in the trees, a wooden stage appears beside the treehouse. Walk to it and release your lantern into the sky; a slice of Festival Cake lands in your basket as a keepsake. The dusk overlay stays for the rest of your save.
- **Cloud-fish** at the Tidepools with Marlowe. A cloud-fish drifts left and right; cast (`Space`) when it overlaps the bright catch-band. Rewards scale with timing — Pearlfruit, Iceberry, or sparkledust.
- **Trace constellations** with Astra. Three patterns (Watchful Owl, Keeper's Lantern, Tidesong Boat). Click stars in the order Astra points them out; wrong stars never punish you. First trace of each rewards 25–30 sparkledust.
- **Fill the journal** — auto-fills as you discover Glims. Unseen entries are `???`; seen-but-not-caught show a faint silhouette; caught entries reveal element, favourite food, spot, and a little blurb.

## Save / load

`localStorage` only. No accounts, no network calls, no telemetry. Everything lives under the key `lumenwood.save.v1`.

Saves are forward-compatible: when new flags or settings are introduced, old saves absorb the new defaults on load without wiping your progress. To start fresh, use **Settings → Reset save**.

## Accessibility

- Keyboard-playable end-to-end. No mouse required.
- **Reduced motion** toggle — calms bobbing, drifting, and dust motes.
- **Big text** toggle — scales journal and menu text by 1.15×.
- **Sound** toggle (off by default) — gentle synthesised chimes only; no strobing audio.
- **Element-shape silhouettes** so Glims read for colourblind players.
- High-contrast warm palette throughout; no neon, no flashing.
- All copy is short and reading-light: most UI uses icons + short words.

## Visual & audio direction

- **Watercolour feel** — soft radial gradients layered with low alpha, canopies as clusters of overlapping blobs, subtle paper texture.
- **Warm palette only** — cream paper, sage moss, sunset orange, twilight purple. Never neon, never harsh.
- **Glims are firefly-sized**, glowing, expressive with two dot eyes.
- **Animations gentle** — bobbing, slow drifts. Nothing strobes.
- **Type** — Fredoka (rounded, friendly).
- **Sound** — Web Audio chimes generated on the fly; no audio assets ship. Events: catch, scene transition, NPC chime, festival fanfare, cook, pet, portal.

## Project structure

```
lumenwood/
├── index.html            # shell — HUD, modals, canvas, script tags
├── styles.css            # design tokens, HUD, modals, minigame styles
├── README.md
├── data/
│   ├── glims.js          # Glim roster — 20 entries, biome-tagged
│   ├── foods.js          # Food roster — prices, colours, taste notes
│   ├── recipes.js        # Cooking combinations (registers crafted foods)
│   └── seeds.js          # Garden seeds + growth timings
└── src/
    ├── input.js          # keyboard state machine
    ├── save.js           # localStorage load/save/wipe, forward-compatible merge
    ├── entities.js       # player, Glim, bubble, NPC sprites (5 kinds), dust motes
    ├── world.js          # procedural biomes — Mossroot, Treehouse, Honeydrop, Tidepools, Starpetal
    ├── interactions.js   # shop, care, happiness math
    ├── cooking.js        # kitchen modal + stirring minigame
    ├── gardening.js      # plot rendering + planting / harvesting
    ├── festival.js       # Lantern Festival trigger + dusk overlay
    ├── sound.js          # Web Audio chime synth + settings toggle
    ├── minigame.js       # constellation tracer (Astra)
    ├── fishing.js        # cloud-fishing timing game (Marlowe)
    ├── ui.js             # HUD, journal, settings, intro, toast, dialog
    └── game.js           # main loop, scene transitions, catching logic, NPC dispatch
```

The world canvas is **1280×800**, scaled with a CSS transform to fit any viewport, letterboxed against a dark backdrop.

Scenery is rendered **once** to an offscreen canvas at scene-build time, then drawn each frame as a single `drawImage`. Only entities (player, Glims, bubbles, dust motes, NPCs) and tree canopies in front of the player redraw per frame, so framerate stays steady on Chromebooks.

## Architecture notes

- **No framework, no bundler.** Vanilla HTML/CSS/JS + Canvas 2D. Each module is a single IIFE that hangs a namespace off `window` (e.g. `window.UI`, `window.Sound`).
- **Script order matters.** Data files load first, then engine modules, then `game.js` boots last. See the `<script>` tags at the bottom of `index.html`.
- **State lives on `game`** (the closure in `game.js`). UI and systems get a reference via `setGame()` at boot.
- **Save shape evolves additively.** `save.load()` merges stored data onto fresh defaults so adding new flags never breaks old saves.
- **Scenes are lazy.** `World.getScenes()` builds the offscreen canvases on first call; biomes are cheap to add — write `buildX()` and register it in `getScenes()`.
- **NPCs are data.** Each scene exports an `npcs: [{id, x, y, kind}]` array; sprites and dialog branches live in `entities.js` and `game.js`.

## Adding content

### Adding a new Glim

Open `data/glims.js`, copy an existing entry, change the values. Tag the `biome` array with the scenes they should appear in. Restart the game (or use **Settings → Reset save**). The new Glim shows up in the journal as `???` and will spawn next time their biome loads.

### Adding a new biome

In `src/world.js`, write `buildMyBiome()` following the `buildHoneydrop()` / `buildTidepools()` pattern. Register it in `getScenes()`. Add a portal from a neighbouring biome and a back-portal here. Tag any relevant Glims with the new biome key.

### Adding a new NPC

1. Add an entry to the host biome's `npcs:` array in `world.js`.
2. Add a `kind === 'myNpc'` branch in `entities.js` (`drawNPC` + `promptText`).
3. Add an interaction branch in `game.js` (the `nearestNPC && nearestNPC.kind === 'myNpc'` block).
4. Add a `met<MyNpc>` flag in `save.js` defaults if first-meet has special handling.

### Adding a new recipe

Open `data/recipes.js`, add `{ a, b, result, name, ... }`. The Workshop modal picks it up automatically. Mystery combinations always produce Cloud Soup, so failure is friendly.

## Design constraints (kept, not negotiated)

- **No violence, no death, no scary monsters, no romantic content.**
- **No third-party tracking, ads, network calls, or accounts.** The only network call is the Google Fonts request for Fredoka on first load.
- **No fail states.** Bubbles never hurt anything. Glims you don't catch stay in the world.
- **Daily rhythms, not daily punishments.** Things grow and nothing dies whether or not the kid logs in.
- **Discovery over grind.** New Glims/recipes/areas appear naturally from exploration, not from repetition.

## Pass 5 highlights

- **60 Glims** across six biomes (Mossroot, Honeydrop, Tidepools, Starpetal, Winter Grove, and your Treehouse hub).
- **Winter Grove** biome — snowy pines, frozen pond, 14 frost/moon/whisper Glims, accessed from Starpetal Peaks at 14 caught.
- **NPC quests** — each of the five villagers has a small favour to ask. Reward: sparkledust + decor tokens spent at the cart.
- **Treehouse decoration shop** (in Pippa's stand) — rugs, wallpaper, plushies, wind chimes. They render in the treehouse interior.
- **Snapshots** (`P`) — photograph any biome; hang the picture on your treehouse wall; browse them in the Gallery icon up top.
- **Character customization** — skin, hair colour & style, outfit & hat. Picked on first run; revisitable from Settings.
- **Seasons** — gentle per-biome palette shifts that follow the real-world month.
- **Weather** — soft rain, mist, drifting petals, falling snow. Triggered by surprise events and biome festivals.
- **Three new festivals** — Bloom Day (Honeydrop, 4 caught), Tidesong (Tidepools, 4 caught), Star-Counting Night (Starpetal, 4 caught). Each is a one-off reward + dialog.
- **Surprise events** — rare Glim wanderers, gifts at your door, weather flourishes. Low probability + cooldown so they feel scarce.
- **Bubble Practice** mini-game — a tiny rhythm minigame at Pippa's stand. Sparkledust scales with how well you keep up.
- **Ambient audio loops** — per-biome drones synthesised on the fly; cross-fade on scene change.
- **Soft tutorial** — a small coach card walks new players through movement, bubbling, the journal, Pippa, and the treehouse. Skippable at any time.
- **Bed corner** in the treehouse — interact with the bed to sleep; restores Glim happiness across the board.

## Pass 6 highlights

- **Sticker book** — 25 collectible badges for milestones (catching, biomes, festivals, recipes, snapshots, quests). New stickers toast in as they're earned. Browse via the star icon in the HUD.
- **Quest chains** — every villager now offers a three-step chain (15 quests total across five returning NPCs).
- **Three new NPCs** — Theo the Wandering Merchant (Mossroot, south clearing), Juno the Baker (Treehouse, after you've cooked once), Vela the Cloudwatcher (Winter Grove). Each has a three-step quest chain.
- **Touch / tablet controls** — virtual joystick + action buttons appear automatically on coarse-pointer devices.
- **Read-aloud mode** — Web Speech API speaks dialog and toast text. Toggle in Settings. Helpful for ages 4-6.
- **Three save slots** — independent Lumenwoods. Switch via Settings.
- **Export / import** — copy a base64 save code to the clipboard; paste to move your save to another browser or device.
- **8 villagers + 24 quests** total now.

## Roadmap (post-pass-6)

Possible future passes — not yet scoped:

- **More biomes** — a winter grove, a sky-island, an undertree library.
- **More mini-games** — bubble-catching rhythm, pie-baking variation, telescope alignment.
- **Snapshots** — photograph Glims in the world and hang the pictures in the treehouse.
- **Seasons** — the in-game calendar tipping the biomes through spring/summer/autumn/winter palettes.
- **Real art pass** — drop hand-drawn SVG/PNG over the procedural scaffolding.

## Credits

Designed in Claude Design as a handoff prototype. Implementation by Claude Code in vanilla JS for portability.

Fonts: [Fredoka](https://fonts.google.com/specimen/Fredoka) by Milena Brandão et al., via Google Fonts.

## License

This is a private personal project. Adapt freely for your own children, classroom, or learning. No warranty.
