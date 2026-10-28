# Cascade

A compact 2D browser roguelite about discovering elemental combinations and watching chain reactions.
You choose the upgrades, and then one shot sets off the whole reaction.

**Play:** https://johngurley80.github.io/cascade/

Defend the red line against eight waves of geometric invaders and a final boss. Wet a formation with
**Water**, then turn it into a **Steam** burst with **Fire** or chain **Lightning** through it.
Upgrades such as Flashover and Storm Relay let one reaction trigger the next.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Aim | Move the mouse | Drag |
| Fire | Hold the mouse button (or Space) | Hold your finger down |
| Switch element | `1` `2` `3`, mouse wheel, `Q` / `E`, or the element buttons | Tap the element buttons |
| Pause | `P` / `Esc`, or the pause button | Pause button |
| Restart (results screen) | `R` | Play again |
| Mute | `M`, or the setting in the title or pause menu | The setting in the title or pause menu |

The game pauses during upgrade choices and whenever the tab or window loses focus; you resume it explicitly.

## Rules

- **Fire**: direct damage plus a short burn. On a **wet** enemy it consumes wet and releases a **Steam** burst that damages nearby enemies. Steam doesn't apply wet.
- **Water**: lower damage. Wets the target, and the splash wets nearby enemies too. It doesn't put out burn.
- **Lightning**: direct damage. On a wet enemy it chains to up to 4 more nearby wet enemies, hitting each enemy at most once.
- You start with Fire. After wave 1 you pick Water or Lightning. After wave 2 the other element is guaranteed among the three choices, and after wave 3 it's granted automatically if you still don't have it.
- Modifiers: Ricochet, Split Shot, Flashover, Storm Relay (each once), Wider Splash (max level 2), Rapid Fire (max level 3).
- An enemy crossing the line costs one of your 3 health points. The boss crossing it costs all of them.

## Development

Requires Node.js 20+ (CI uses Node 22).

```bash
npm install          # install dependencies (use `npm ci` for a clean install from the lockfile)
npm run dev          # dev server at http://localhost:5173/
npm test             # Vitest unit tests (reaction, damage, upgrade and wave logic)
npm run build        # type-check and production build into dist/
npm run preview      # serve the production build at http://localhost:4173/
npm run test:e2e     # Playwright smoke test against the production build (run `npm run build` first)
```

The end-to-end test needs a Chromium for Playwright; install one with `npx playwright install chromium` if you don't
already have one.

`scripts/simulate.ts` plays full runs headlessly with a simple bot and prints per-wave timings, leaks and cascade
sizes. It's useful for balance tuning: `npx tsx scripts/simulate.ts 8`.

### URL parameters (testing)

| Parameter | Effect |
| --- | --- |
| `?wave=N` | Start at wave N (1–8), with the elements a normal run would have by then |
| `unlock=all` | Grant all elements and every upgrade at max level |
| `seed=X` | Fix the random seed for wave layouts and upgrade offers (a number or any text) |
| `daily=1` | Jump straight into today's Daily Run |
| `speed=N` | Simulation speed multiplier, 1–4 (for automated tests) |

Example: `http://localhost:5173/?wave=3&unlock=all&seed=42`. Runs started with `wave`, `unlock` or `speed`
are not saved to your best result.

**Daily Run** seeds the wave layouts and upgrade offers from the current UTC date, so everyone plays the same run that day.

## Architecture

```
src/
  config.ts              all tuning values (damage, health, radii, caps, fire rates, spawn spacing)
  logic/                 pure TypeScript, no Phaser imports
    world.ts             fixed-step simulation: firing, projectiles, enemies, waves, upgrades
    reactions.ts         elemental hits and bounded secondary reactions (steam, flashover, relay)
    status.ts            wet / burn status effects
    damage.ts            damage application and one-time defeat rewards
    upgrades.ts          upgrade definitions, offers and element unlock schedule
    waves.ts             wave formations, seeded spawn schedule, completion tracking
    rng.ts params.ts summary.ts
  render/                Phaser drawing: arena, enemies, projectiles, particle/bolt/ripple effects
  ui/                    HUD, upgrade cards, menus, buttons, icons, theme
  audio/Sfx.ts           Web Audio synthesiser (no audio files)
  platform/              settings and best-result storage (works without localStorage)
  scenes/                Title and Game scenes: render, play audio, route input
tests/                   Vitest unit tests
e2e/                     Playwright smoke test
```

Gameplay runs in a fixed 720×1280 coordinate space. Phaser scales the canvas to fit and centres it, so resizing
never affects the run. Collisions use simple circle overlap; Arcade physics isn't used.

### Bounded propagation

Every projectile impact starts a *cascade* with its own ID. Steam bursts, Flashover explosions and Storm Relay
chains are each one generation deeper than whatever triggered them, and nothing beyond generation 4 is created.
Each reaction keeps a visited set, so it damages an enemy at most once. Enemies are marked dead on the hit that
kills them, and the defeat is rewarded once. Live projectiles, particles and pending secondary reactions are all
capped. The counter shows how many distinct enemies one cascade hit, and the results screen shows your biggest
cascade.

## Deployment

`.github/workflows/deploy.yml` runs the tests, builds the game and deploys `dist/` to GitHub Pages on every push to
`main`. In the repository settings, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
Vite's `base` is relative (`./`), so the same build works on GitHub Pages (`/cascade/`), on Vercel or any
other host at the domain root. Set `BASE_PATH` to force an absolute base.

On **Vercel**, import the repository with the Vite preset (build command `npm run build`, output directory `dist`).

All visuals are drawn from code and all sounds are synthesised at runtime, so the game uses no external art,
audio or paid APIs.
