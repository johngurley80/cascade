/**
 * Headless balance check: plays full runs with a simple bot and prints
 * per-wave timings, leaks and cascade sizes. Run: npx tsx scripts/simulate.ts [runs]
 */
import { ELEMENTS, WORLD } from '../src/config';
import { Rng } from '../src/logic/rng';
import { World } from '../src/logic/world';
import type { Enemy } from '../src/logic/types';

const DT = 1 / 60;

function neighbours(world: World, e: Enemy, r: number, pred: (o: Enemy) => boolean = () => true): number {
  return world.enemies.filter((o) => o !== e && o.alive && Math.hypot(o.x - e.x, o.y - e.y) < r && pred(o)).length;
}

function botStep(world: World, rng: Rng, skill: number): void {
  const visible = world.enemies.filter((e) => e.alive && e.y > WORLD.arenaTop);
  if (visible.length === 0) {
    world.firing = false;
    return;
  }
  // Threat: closest to the line, favouring clusters.
  let target = visible[0];
  let best = -Infinity;
  for (const e of visible) {
    const score = e.y + neighbours(world, e, 110) * 25 + (e.kind === 'boss' ? 150 : 0);
    if (score > best) {
      best = score;
      target = e;
    }
  }
  const has = world.loadout.elements;
  const crowd = neighbours(world, target, 110);
  let element: 'fire' | 'water' | 'lightning' = 'fire';
  if (has.has('water') && target.wet <= 0.4 && crowd >= 2) element = 'water';
  else if (target.wet > 0 && has.has('lightning') && neighbours(world, target, ELEMENTS.lightning.chainRange, (o) => o.wet > 0) >= 2)
    element = rng.next() < 0.5 ? 'lightning' : 'fire';
  else element = 'fire';
  world.selectElement(element);
  const jitter = (1 - skill) * 60;
  const lead = (target.speed * Math.hypot(target.x - WORLD.launcherX, target.y - WORLD.launcherY)) / 1000;
  world.aimAt(target.x + rng.range(-jitter, jitter), target.y + lead);
  world.firing = true;
}

function run(seed: number, skill: number, verbose: boolean) {
  const world = new World({ seed });
  const rng = new Rng(seed * 7 + 1);
  const waveLog: string[] = [];
  let waveStart = 0;
  let big = 0;
  let firstBigWave = 0;
  let guard = 0;
  while ((world.phase === 'playing' || world.phase === 'upgrade') && guard++ < 60 * 60 * 20) {
    if (world.phase === 'upgrade') {
      const t = world.stats.time;
      waveLog.push(`w${world.wave}:${(t - waveStart).toFixed(0)}s L${world.stats.leaks} C${world.largestCascade}`);
      waveStart = t;
      world.chooseUpgrade(Math.floor(rng.next() * world.offer.length));
      continue;
    }
    botStep(world, rng, skill);
    world.step(DT);
    for (const ev of world.drainEvents()) {
      if (ev.type === 'cascade' && ev.size >= 5) {
        big++;
        if (!firstBigWave) firstBigWave = world.wave;
      }
    }
  }
  const t = world.stats.time;
  waveLog.push(`w${world.wave}:${(t - waveStart).toFixed(0)}s L${world.stats.leaks} C${world.largestCascade}`);
  if (verbose) console.log(waveLog.join(' | '));
  return {
    result: world.phase,
    wave: world.wave,
    time: t,
    largest: world.largestCascade,
    firstBigWave,
    big,
    loadout: [...world.loadout.elements].join('+'),
    depthLimited: world.reactions.stats.depthLimited,
  };
}

const runs = Number(process.argv[2] ?? 12);
for (const skill of [0.9, 0.6]) {
  console.log(`\n=== skill ${skill}`);
  let wins = 0;
  for (let s = 1; s <= runs; s++) {
    const r = run(s, skill, s <= 3);
    if (r.result === 'victory') wins++;
    console.log(
      `seed ${s}: ${r.result} wave ${r.wave} in ${(r.time / 60).toFixed(1)}m, largest ${r.largest}, first5+ wave ${r.firstBigWave}, depthLimited ${r.depthLimited}`,
    );
  }
  console.log(`wins ${wins}/${runs}`);
}
