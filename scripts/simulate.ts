/**
 * Headless balance check: plays full runs with a simple bot for each starting
 * element and prints run length, win rate, leaks and cascade sizes.
 * Run: npx tsx scripts/simulate.ts [runsPerElement] [skill]
 */
import { WORLD } from '../src/config';
import { partnersOf } from '../src/logic/codex';
import { Rng } from '../src/logic/rng';
import { ALL_ELEMENTS, type Element, type Enemy } from '../src/logic/types';
import { World } from '../src/logic/world';

const DT = 1 / 60;

function crowd(world: World, e: Enemy, r: number): number {
  let n = 0;
  for (const o of world.enemies) if (o !== e && o.alive && Math.hypot(o.x - e.x, o.y - e.y) < r) n++;
  return n;
}

/** Aim at the most threatening crowd: close to the line, and with many neighbours to chain through. */
function botStep(world: World, rng: Rng, skill: number): void {
  const visible = world.enemies.filter((e) => e.alive && e.y > WORLD.arenaTop);
  if (visible.length === 0) return;
  let target = visible[0];
  let best = -Infinity;
  for (const e of visible) {
    const score = e.y + crowd(world, e, 110) * 18 + (world.primedElement(e) ? 60 : 0) + (e.radius > 60 ? 60 : 0);
    if (score > best) {
      best = score;
      target = e;
    }
  }
  const jitter = (1 - skill) * 60;
  const lead = (target.speed * Math.hypot(target.x - WORLD.launcherX, target.y - WORLD.launcherY)) / 1000;
  world.aimAt(target.x + rng.range(-jitter, jitter), target.y + lead);
}

interface Result {
  peakEnemies: number;
  stepMs: number;
  result: string;
  wave: number;
  minutes: number;
  largest: number;
  firstBig: number;
  leaks: number;
  score: number;
  elements: string;
}

function run(seed: number, start: Element, skill: number): Result {
  const world = new World({ seed });
  const rng = new Rng(seed * 7 + 1);
  world.chooseUpgrade(world.offer.indexOf(start));
  let firstBig = 0;
  let guard = 0;
  let peak = 0;
  let steps = 0;
  const t0 = performance.now();
  const leaks: string[] = [];
  while ((world.phase === 'playing' || world.phase === 'upgrade') && guard++ < 60 * 60 * 40) {
    if (world.phase === 'upgrade') {
      // Like a player reading "reacts with your …" on the cards: prefer a partner element.
      const partner = world.offer.findIndex((id) => world.loadout.elements.some((own) => partnersOf(own).includes(id as Element)));
      world.chooseUpgrade(partner >= 0 ? partner : Math.floor(rng.next() * world.offer.length));
      continue;
    }
    botStep(world, rng, skill);
    world.step(DT);
    steps++;
    peak = Math.max(peak, world.enemies.length);
    for (const ev of world.drainEvents()) {
      if (ev.type === 'cascade' && ev.size >= 5 && !firstBig) firstBig = world.wave;
      if (ev.type === 'leak' && process.env.DIAG) leaks.push(`w${world.wave}:${ev.kind}@${world.stats.time.toFixed(0)}s`);
      if (ev.type === 'bossSpawn' && process.env.DIAG) leaks.push(`w${world.wave}:BOSS-SPAWN@${world.stats.time.toFixed(0)}s`);
    }
    if (world.phase !== 'playing' && world.phase !== 'upgrade' && process.env.DIAG) {
      const boss = world.enemies.find((e) => e.radius > 60);
      leaks.push(boss ? `boss hp ${Math.round(boss.hp)}/${boss.maxHp}` : 'no boss alive');
      console.log('   ', leaks.join(' '));
    }
  }
  return {
    peakEnemies: peak,
    stepMs: (performance.now() - t0) / Math.max(1, steps),
    result: world.phase,
    wave: world.wave,
    minutes: world.stats.time / 60,
    largest: world.largestCascade,
    firstBig,
    leaks: world.stats.leaks,
    score: world.stats.score,
    elements: world.loadout.elements.join('+'),
  };
}

const runs = Number(process.argv[2] ?? 4);
const skill = Number(process.argv[3] ?? 0.8);
let totalWins = 0;
let total = 0;
for (const start of ALL_ELEMENTS) {
  const rs: Result[] = [];
  for (let s = 1; s <= runs; s++) rs.push(run(s * 101 + start.length, start, skill));
  const wins = rs.filter((r) => r.result === 'victory').length;
  totalWins += wins;
  total += rs.length;
  const avg = (f: (r: Result) => number) => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
  console.log(
    `${start.padEnd(9)} wins ${wins}/${runs}  avg wave ${avg((r) => r.wave)}  time ${avg((r) => r.minutes)}m  largest ${avg((r) => r.largest)}  first5+ w${avg((r) => r.firstBig)}  leaks ${avg((r) => r.leaks)}  score ${avg((r) => r.score)}  peak ${avg((r) => r.peakEnemies)} enemies  ${avg((r) => r.stepMs * 1000)}µs/step`,
  );
  for (const r of rs) if (r.result !== 'victory') console.log(`   lost on wave ${r.wave} with ${r.elements}`);
}
console.log(`total wins ${totalWins}/${total}`);
