# Cascade

A compact 2D browser roguelite about discovering elemental combinations and watching chain reactions.
You choose the elements and upgrades, and then one shot sets off the whole reaction.

**Play:** https://johngurley80.github.io/cascade/

Hold the red line across **15 waves in three acts**, each ending with a boss. Pick your starting element,
collect up to four of the seven, and find all **24 reactions** for the codex. Wet a crowd with **Water**, then
flash it into **Steam** with **Fire**, freeze it with **Frost** and **Shatter** it, or pull it into a **Void**
singularity and arc **Lightning** through everything inside. After your first win, **Endless** mode opens up.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Aim | Move the mouse | Drag |
| Fire | Hold the mouse button (or Space) | Hold your finger down |
| Switch element | `1`–`4`, mouse wheel, `Q` / `E`, or the element buttons | Tap the element buttons |
| Pick a card | Click, or `1`–`7`; `R` rerolls once per run | Tap |
| Pause | `P` / `Esc`, or the pause button | Pause button |
| Restart (results screen) | `R` | Play again |
| Mute | `M`, or Sound in the title or pause menu | Sound in the title or pause menu |

The game pauses during choices and whenever the tab or window loses focus; you resume it explicitly. Progress is
saved between waves, so **Continue** on the title screen picks up where you left off.

## Elements

| Element | Role | Effect |
| --- | --- | --- |
| Fire | Damage | Direct damage plus a short burn |
| Water | Setup | Lower damage; wets the target, and the splash wets nearby enemies |
| Lightning | Chains | Direct damage; on a wet enemy it chains to up to 4 more wet enemies, each hit once |
| Frost | Control | Chills (slows) enemies; wet enemies freeze solid |
| Wind | Control | A gust pulls nearby enemies together and pushes the group back |
| Toxin | Amplify | Poison deals damage over time, makes enemies take +30% damage and eats shields |
| Void | Control | Opens a singularity that drags enemies in, then collapses |

You start by picking any one element. After waves 1, 4 and 8 you choose another from three offers, and at least
one of those always reacts with an element you already carry. A run holds at most four elements.

## Reactions

All combinations are rows in one lookup table (`INTERACTIONS` in `src/logic/reactions.ts`), keyed by the incoming
element and the target's status:

- **Steam:** Fire on a wet enemy. A burst damages everything nearby (it never applies wet) and leaves a cloud
  that conducts lightning (**Conductive Steam**).
- **Chain Lightning:** Lightning on a wet enemy. **Overload:** Lightning on a burning enemy.
- **Freeze:** Frost on a wet enemy. **Shatter:** any non-fire hit on a frozen enemy. **Thaw:** Fire on a frozen
  enemy, which leaves it wet. **Thermal Shock:** Frost on a burning enemy.
- **Firestorm** and **Squall:** Wind spreads burn or wet. **Steam Front:** Wind widens a steam cloud.
- **Gas Ignition:** Fire on a poisoned enemy. **Brittle Freeze:** Frost on a poisoned enemy (the next shatter
  does double). **Toxic Splash:** Water on a poisoned enemy.
- **Arc Storm:** Lightning arcs to everything caught in a singularity.
- Upgrade-gated reactions: Flashover, Storm Relay, Superheated Steam, Permafrost, Toxic Storm, Plasma Arc,
  Gravity Well and Acid Rain.
- Enemy mechanic: **Detonation**, when a Volatile enemy is defeated.

The first time you trigger a reaction, it's added to the **Codex** on the title screen.

## Upgrades

Upgrades come in three rarities:

- **Common:** Ricochet, Split Shot, Rapid Fire, Piercing, Overcharge and Repair.
- **Rare:** Catalyst, plus upgrades for specific elements: Flashover, Storm Relay, Wider Splash, Long Chain,
  Pressure Cooker, Deep Freeze, Gale Force, Virulence and Event Horizon.
- **Combo:** upgrades that need two specific elements.

Upgrades for an element are only offered once you carry it. Taken or maxed upgrades are never offered again.

## Enemies and bosses

- **Basic**, **Fast** and **Tank** enemies.
- **Splitters** split into two when defeated.
- **Volatiles** explode when defeated.
- Trait variants:
  - **Shielded** enemies block direct hits until a reaction or poison breaks the shield, or it wears out.
  - **Insulated** enemies stop lightning chains.
  - **Fireproof** enemies can't burn.
  - **Elites** are bigger and tougher, and worth three times the score.

Bosses:

- **The Hive** ends Act I. It sheds splitlings as it takes damage.
- **The Aegis** ends Act II. Direct hits glance off it, so use reactions.
- **The Monolith** ends Act III. It speeds up when wounded.

Clearing an act restores one health. In Endless mode, waves keep scaling and the bosses return stronger.

## Scoring

Each defeat scores more the more enemies its cascade has already hit (up to ×6), and clearing a wave adds a bonus.
The **Records** screen keeps your top 10 runs. Big cascades trigger a brief slow-motion hit-stop. The results
screen replays your biggest cascade as an animated diagram, coloured by reaction generation.

## Development

Requires Node.js 20+ (CI uses Node 22).

```bash
npm install          # install dependencies (use `npm ci` for a clean install from the lockfile)
npm run dev          # dev server at http://localhost:5173/
npm test             # Vitest unit tests (reaction table, statuses, upgrades, waves, saves)
npm run build        # type-check and production build into dist/
npm run preview      # serve the production build at http://localhost:4173/
npm run test:e2e     # Playwright smoke test against the production build (run `npm run build` first)
```

The end-to-end test needs a Chromium for Playwright; install one with `npx playwright install chromium` if you don't
already have one.

`scripts/simulate.ts` plays full runs headlessly with a simple bot, once for each starting element. It prints win
rate, run length, leaks and cascade sizes: `npx tsx scripts/simulate.ts [runsPerElement] [skill]`.

### URL parameters (testing)

| Parameter | Effect |
| --- | --- |
| `?wave=N` | Start at wave N (1–15), with the elements a normal run would have by then |
| `unlock=all` | Grant all seven elements and every upgrade at max level |
| `seed=X` | Fix the random seed for wave layouts and upgrade offers (a number or any text) |
| `daily=1` | Jump straight into today's Daily Run |
| `speed=N` | Simulation speed multiplier, 1–4 (for automated tests) |

Example: `http://localhost:5173/?wave=6&unlock=all&seed=42`. Runs started with `wave`, `unlock` or `speed` are not
saved to records.

**Daily Run** seeds the wave layouts and upgrade offers from the current UTC date, so everyone plays the same run that day.

## Architecture

```
src/
  config.ts              all tuning values (damage, health, radii, caps, fire rates, spawn spacing, music)
  logic/                 pure TypeScript, no Phaser imports
    world.ts             fixed-step simulation: firing, projectiles, enemies, waves, bosses, upgrades, saves
    reactions.ts         the reaction table, element effects, fields (steam clouds, singularities), cascades
    status.ts            wet / burn / poison / chill / freeze statuses
    damage.ts            damage application and one-time defeat rewards
    upgrades.ts          upgrade definitions, rarities, offers, element picks
    waves.ts             15 authored waves, endless generator, seeded spawn schedule, completion tracking
    codex.ts             reaction descriptions and element partners
    records.ts params.ts summary.ts rng.ts
  render/                Phaser drawing: arena, enemies, fields, projectiles, particle/bolt/ripple effects
  ui/                    HUD, upgrade cards, menus, cascade replay, buttons, icons, theme
  audio/Sfx.ts           Web Audio sound effects (no audio files)
  audio/Music.ts         procedural synthwave soundtrack with intensity layers and a boss mode
  platform/              settings, best results, codex, leaderboard and saved run (works without localStorage)
  scenes/                Title and Game scenes: render, play audio, route input
tests/                   Vitest unit tests (one test per codex reaction, plus rules, depth limits, waves, saves)
e2e/                     Playwright smoke test
```

Gameplay runs in a fixed 720×1280 coordinate space. Phaser scales the canvas to fit and centres it, so resizing
never affects the run. Collisions use simple circle overlap; Arcade physics isn't used.

### Bounded propagation

Every projectile impact starts a *cascade* with its own ID. Each blast is one generation deeper than whatever
triggered it, and nothing beyond generation 4 is created (Catalyst raises the limit to 5). This applies to steam,
flashover, ignition, shatter, overload, detonation, singularity collapse and storm relay. Burns and poisons
remember the generation that applied them, so a defeat by damage over time stays within the same budget. Each
reaction keeps a visited set, so it damages an enemy at most once. Enemies are marked dead on the hit that kills
them, and the defeat is rewarded once. Live projectiles, particles, pending reactions, steam clouds and
singularities are all capped.

## Deployment

`.github/workflows/deploy.yml` runs the tests, builds the game and deploys `dist/` to GitHub Pages on every push to
`main`. In the repository settings, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
Vite's `base` is relative (`./`), so the same build works on GitHub Pages (`/cascade/`), on Vercel or any
other host at the domain root. Set `BASE_PATH` to force an absolute base.

On **Vercel**, import the repository with the Vite preset (build command `npm run build`, output directory `dist`).

All visuals are drawn from code, and all sounds and music are synthesised at runtime, so the game uses no external
art, audio or paid APIs.
