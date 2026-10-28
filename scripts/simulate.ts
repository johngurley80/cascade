/**
 * Headless balance check: plays full runs with a simple bot for each starting
 * element and prints run length, win rate, leaks and cascade sizes.
 * Run: npx tsx scripts/simulate.ts [runsPerElement] [skill]
 */
import { ELEMENTS, WORLD } from '../src/config';
import { INTERACTIONS } from '../src/logic/reactions';
import { Rng } from '../src/logic/rng';
import { ALL_ELEMENTS, type Element, type Enemy } from '../src/logic/types';
import { World } from '../src/logic/world';

const DT = 1 / 60;

function crowd(world: World, e: Enemy, r: number): number {
  let n = 0;
  for (const o of world.enemies) if (o !== e && o.alive && Math.hypot(o.x - e.x, o.y - e.y) < r) n++;
  return n;
}

/** Value of hitting `target` with `element`: reactions it would trigger, plus setup value. */
function elementValue(world: World, element: Element, target: Enemy): number {
  const s = world.reactions.snapshot(target);
  let v = ELEMENTS[element].damage;
  for (const rule of INTERACTIONS[element]) {
    if (rule.requires && world.loadout.levels[rule.requires] <= 0) continue;
    if (rule.when(s)) v += 30;
  }
  const has = (e: Element) => world.loadout.elements.includes(e);
  const n = crowd(world, target, 110);
  if (target.traits.shield && element !== 'toxin') v -= 8;
  if (element === 'water' && !s.wet && n >= 2 && (has('fire') || has('lightning') || has('frost'))) v += 25;
  if (element === 'toxin' && !s.poisoned && (has('fire') || has('frost') || target.traits.shield)) v += 20;
  if (element === 'void' && !s.singularity && n >= 3) v += has('lightning') ? 25 : 10;
  if (element === 'wind' && n >= 2) v += 8;
  if (element === 'frost' && !s.wet && !s.frozen) v += 4;
  return v;
}

function botStep(world: World, rng: Rng, skill: number): void {
  const visible = world.enemies.filter((e) => e.alive && e.y > WORLD.arenaTop);
  if (visible.length === 0) {
    world.firing = false;
    return;
  }
  let target = visible[0];
  let best = -Infinity;
  for (const e of visible) {
    const score = e.y + crowd(world, e, 110) * 25 + (e.radius > 60 ? 60 : 0);
    if (score > best) {
      best = score;
      target = e;
    }
  }
  let pick = world.loadout.elements[0];
  let pv = -Infinity;
  for (const el of world.loadout.elements) {
    const v = elementValue(world, el, target) + rng.next() * 3;
    if (v > pv) {
      pv = v;
      pick = el;
    }
  }
  world.selectElement(pick);
  const jitter = (1 - skill) * 60;
  const lead = (target.speed * Math.hypot(target.x - WORLD.launcherX, target.y - WORLD.launcherY)) / 1000;
  world.aimAt(target.x + rng.range(-jitter, jitter), target.y + lead);
  world.firing = true;
}

interface Result {
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
  const leaks: string[] = [];
  while ((world.phase === 'playing' || world.phase === 'upgrade') && guard++ < 60 * 60 * 40) {
    if (world.phase === 'upgrade') {
      world.chooseUpgrade(Math.floor(rng.next() * world.offer.length));
      continue;
    }
    botStep(world, rng, skill);
    world.step(DT);
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
    `${start.padEnd(9)} wins ${wins}/${runs}  avg wave ${avg((r) => r.wave)}  time ${avg((r) => r.minutes)}m  largest ${avg((r) => r.largest)}  first5+ w${avg((r) => r.firstBig)}  leaks ${avg((r) => r.leaks)}  score ${avg((r) => r.score)}`,
  );
  for (const r of rs) if (r.result !== 'victory') console.log(`   lost on wave ${r.wave} with ${r.elements}`);
}
console.log(`total wins ${totalWins}/${total}`);
