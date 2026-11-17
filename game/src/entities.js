// NEON COAST — the living things: cars (parked, traffic and police), pedestrians, officers on
// foot, bullets and particles, and the brains that drive them. Traffic follows the road grid
// on the correct side and brakes for whatever is ahead; police hunt the player across the same
// grid; pedestrians stroll the sidewalks and run from trouble. Nothing here touches the
// screen or the speakers: steps push events ({type:'crime'…} and {type:'sound'…}) onto
// state.events and the game layer decides what they mean.
import { CAR, PLAYER, WORLD } from './config.js';
import { chance, pick, randInt, randRange } from './random.js';
import { ROAD_HALF } from './world.js';

/** Compass directions as indices: 0 east, 1 south, 2 west, 3 north. */
export const DIRS = [
  { x: 1, y: 0, angle: 0 },
  { x: 0, y: 1, angle: Math.PI / 2 },
  { x: -1, y: 0, angle: Math.PI },
  { x: 0, y: -1, angle: -Math.PI / 2 },
];

/** The lane offset for a direction of travel: right-hand traffic, so the lane sits to the right. */
function laneOffset(dir) {
  // Facing east the right side is south (+y); facing south it is west (-x), and so on.
  return 26;
}

export const CAR_MODELS = {
  compact: { name: 'Pico', topSpeed: 305, accel: 265, turn: 2.5, length: 42, cruise: 235 },
  sedan: { name: 'Meridian', topSpeed: 345, accel: 285, turn: 2.25, length: 46, cruise: 255 },
  taxi: { name: 'City Cab', topSpeed: 340, accel: 280, turn: 2.25, length: 46, cruise: 250 },
  sport: { name: 'Vantara GT', topSpeed: 465, accel: 385, turn: 2.65, length: 46, cruise: 285 },
  muscle: { name: 'Bruto', topSpeed: 425, accel: 345, turn: 2.0, length: 48, cruise: 265 },
  truck: { name: 'Hauler', topSpeed: 265, accel: 205, turn: 1.7, length: 60, cruise: 205 },
  police: { name: 'Interceptor', topSpeed: 435, accel: 365, turn: 2.55, length: 47, cruise: 300 },
};
const CAR_COLORS = ['#c94f4f', '#4f7dc9', '#e0a83c', '#5dbb63', '#b8bcc4', '#7a4fc9', '#c94f9e', '#3fbfae', '#e8e4da', '#31435c'];
const PED_COLORS = ['#e8e4da', '#d9a05f', '#8a5a3b', '#f2c9a0', '#6e452a'];
const SHIRT_COLORS = ['#ff5da2', '#22d3ee', '#facc15', '#a78bfa', '#34d399', '#fb7185', '#38bdf8', '#f4f1ea', '#e5534b'];

let nextId = 1;

export function createCar(rng, opts) {
  const modelKey = opts.model ?? pick(rng, ['compact', 'sedan', 'sedan', 'compact', 'sport', 'muscle', 'truck', 'taxi']);
  const model = CAR_MODELS[modelKey];
  return {
    id: nextId++,
    kind: 'car',
    modelKey,
    model,
    color: opts.color ?? (modelKey === 'taxi' ? '#f5b942' : modelKey === 'police' ? '#e8eaf2' : pick(rng, CAR_COLORS)),
    x: opts.x, y: opts.y, angle: opts.angle ?? 0,
    speed: 0, steer: 0,
    hp: CAR.maxHealth,
    driver: opts.driver ?? null, // 'traffic' | 'police' | 'player' | null
    parked: opts.parked ?? false,
    marked: opts.marked ?? false,
    dir: opts.dir ?? 0,
    roadC: opts.roadC ?? 0,
    decidedAt: null, // the intersection this traffic car last chose a turn at
    honkT: 0,
    wreck: false,
  };
}

export function createPed(rng, x, y) {
  return {
    id: nextId++, kind: 'ped',
    x, y, angle: randRange(rng, 0, Math.PI * 2),
    hp: 60, state: 'stroll', target: null, fleeFrom: null, fleeT: 0, downT: 0,
    skin: pick(rng, PED_COLORS), shirt: pick(rng, SHIRT_COLORS),
    speedBase: randRange(rng, 58, 84), phase: randRange(rng, 0, Math.PI * 2),
  };
}

export function createOfficer(rng, x, y) {
  return {
    id: nextId++, kind: 'officer',
    x, y, angle: 0, hp: 80, state: 'chase', shootCd: randRange(rng, 0.4, 1),
    downT: 0, phase: randRange(rng, 0, Math.PI * 2),
  };
}

export function createBullet(x, y, angle, from, damage) {
  const speed = 920;
  return { id: nextId++, kind: 'bullet', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.55, from, damage };
}

function spawnParticle(state, p) {
  if (state.particles.length < 420) state.particles.push(p);
}

export function spawnSmoke(state, x, y, big = false) {
  spawnParticle(state, {
    x: x + randRange(state.rng, -5, 5), y: y + randRange(state.rng, -5, 5),
    vx: randRange(state.rng, -8, 8), vy: randRange(state.rng, -34, -18),
    life: 0, maxLife: randRange(state.rng, 0.7, 1.3), size: big ? randRange(state.rng, 7, 12) : randRange(state.rng, 4, 8),
    color: 'rgba(40,38,48,', grow: 14,
  });
}

export function spawnSparks(state, x, y, n = 6) {
  for (let i = 0; i < n; i += 1) {
    const a = randRange(state.rng, 0, Math.PI * 2);
    const s = randRange(state.rng, 60, 260);
    spawnParticle(state, {
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0, maxLife: randRange(state.rng, 0.15, 0.4), size: randRange(state.rng, 1.5, 3),
      color: 'rgba(255,190,80,', grow: -2,
    });
  }
}

export function spawnFlash(state, x, y) {
  spawnParticle(state, { x, y, vx: 0, vy: 0, life: 0, maxLife: 0.07, size: 15, color: 'rgba(255,230,160,', grow: -60 });
}

export function spawnPickupGlow(state, x, y) {
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    spawnParticle(state, {
      x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26 - 22,
      life: 0, maxLife: 0.6, size: 3, color: 'rgba(123,227,130,', grow: 0,
    });
  }
}

export function stepParticles(state, dt) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size = Math.max(0.5, p.size + (p.grow ?? 0) * dt);
  }
}

/** Turn `angle` toward `target` by at most `maxStep`, returning the new angle. */
export function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

/** The signed smallest difference from one angle to another, in [-PI, PI]. */
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The physics every car shares: throttle and steering in, motion and collisions out.
 * `control` is {throttle: -1..1, steer: -1..1}. Returns the impact speed of any crash this step.
 */
export function stepCarPhysics(state, car, control, dt) {
  const model = car.model;
  if (car.wreck) { car.speed = 0; return 0; }
  const prevSpeed = car.speed;
  if (control.throttle > 0) car.speed += model.accel * control.throttle * dt;
  else if (control.throttle < 0) {
    // Negative throttle brakes a moving car and reverses a stopped one.
    if (car.speed > 4) car.speed = Math.max(0, car.speed - model.accel * 1.3 * dt);
    else car.speed = Math.max(-model.topSpeed * 0.32, car.speed - model.accel * 0.55 * dt);
  }
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 2 && control.throttle === 0) car.speed = 0;
  car.speed = Math.max(-model.topSpeed * 0.35, Math.min(model.topSpeed, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120) * (car.speed < 0 ? -1 : 1);
  car.angle += control.steer * model.turn * steerAuthority * dt * Math.min(1, Math.abs(car.speed) / model.topSpeed + 0.25);
  // Keep the heading wrapped: steering maths everywhere assumes [-PI, PI].
  while (car.angle > Math.PI) car.angle -= Math.PI * 2;
  while (car.angle < -Math.PI) car.angle += Math.PI * 2;
  car.steer = control.steer;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  const hit = state.world.collideCircle(car, 20);
  let impact = 0;
  if (hit) {
    impact = Math.abs(prevSpeed);
    if (impact > 110) {
      car.hp -= (impact - 100) * 0.055;
      spawnSparks(state, car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20, 8);
      state.events.push({ type: 'sound', name: 'crash' });
      if (car.hp <= 0 && !car.wreck) {
        car.wreck = true;
        car.hp = 0;
        state.events.push({ type: 'sound', name: 'wreck' });
      }
    }
    car.speed = impact > 60 ? -prevSpeed * 0.22 : 0;
  }
  if (car.hp < 35 && car.hp > 0 && chance(state.rng, dt * 6)) {
    spawnSmoke(state, car.x + Math.cos(car.angle) * 14, car.y + Math.sin(car.angle) * 14);
  }
  return impact;
}

/** Car against car: overlap pushes both apart and dents both, harder the faster they met. */
function collideCarPair(state, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const min = 37;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  if (!a.parked) { a.x -= ux * push; a.y -= uy * push; }
  if (!b.parked) { b.x += ux * push; b.y += uy * push; }
  const rel = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;
  if (rel > 70) {
    const dmg = (rel - 60) * 0.05;
    a.hp -= dmg;
    b.hp -= dmg;
    spawnSparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2, 7);
    state.events.push({ type: 'sound', name: 'crash' });
    if (a.driver === 'player' || b.driver === 'player') {
      const other = a.driver === 'player' ? b : a;
      if (other.driver === 'police') state.events.push({ type: 'crime', kind: 'hitPolice', x: other.x, y: other.y, always: true });
      else state.events.push({ type: 'crime', kind: 'hitCar', x: other.x, y: other.y });
    }
    a.speed *= 0.45;
    b.speed *= 0.45;
    for (const c of [a, b]) {
      if (c.hp <= 0 && !c.wreck) { c.wreck = true; c.hp = 0; }
    }
  }
}

/** A moving car meeting a person: the person goes down, and the game hears about it. */
function collideCarPerson(state, car, person) {
  if (person.state === 'down') return;
  const d = Math.hypot(person.x - car.x, person.y - car.y);
  if (d > 26 || Math.abs(car.speed) < 55) return;
  person.state = 'down';
  person.downT = 0;
  person.hp = 0;
  const byPlayer = car.driver === 'player';
  if (person.kind === 'officer') {
    state.events.push({ type: 'crime', kind: 'killOfficer', x: person.x, y: person.y, always: byPlayer, byPlayer });
  } else {
    state.events.push({ type: 'crime', kind: 'killPed', x: person.x, y: person.y, byPlayer });
  }
  state.events.push({ type: 'sound', name: 'thud' });
  car.speed *= 0.82;
}

/** Where a traffic car is heading: a point down its lane, or around the corner it has chosen. */
function trafficTarget(state, car) {
  const d = DIRS[car.dir];
  const ahead = { x: car.x + d.x * 150, y: car.y + d.y * 150 };
  // Keep to the lane: pull the target onto the lane line of the road being driven.
  if (d.x !== 0) ahead.y = car.roadC + (d.x > 0 ? laneOffset(car.dir) : -laneOffset(car.dir));
  else ahead.x = car.roadC + (d.y > 0 ? -laneOffset(car.dir) : laneOffset(car.dir));
  return ahead;
}

/** At an intersection, choose the next leg: mostly straight on, sometimes a turn, never a U-turn. */
function trafficChooseTurn(state, car, crossRoad) {
  const roll = state.rng();
  const d = car.dir;
  let next = d;
  if (roll < 0.24) next = (d + 1) % 4;
  else if (roll < 0.48) next = (d + 3) % 4;
  if (next !== d) {
    car.dir = next;
    car.roadC = crossRoad;
  }
  car.decidedAt = { x: car.x, y: car.y };
}

/** Is something solid or alive in the stretch of road this car is about to cover? */
function roadBlockedAhead(state, car, lookAhead) {
  const d = DIRS[car.dir];
  const px = car.x + d.x * lookAhead;
  const py = car.y + d.y * lookAhead;
  for (const other of state.cars) {
    if (other === car) continue;
    const rel = (other.x - car.x) * d.x + (other.y - car.y) * d.y;
    if (rel < 6 || rel > lookAhead + 26) continue;
    const lat = Math.abs((other.x - car.x) * d.y - (other.y - car.y) * d.x);
    // Parked cars hug the kerb: only a near-centred one blocks the lane.
    if (lat < (other.parked ? 15 : 24)) return true;
  }
  const p = state.player;
  const targets = p.car ? [p.car] : [p];
  for (const t of targets) {
    const rel = (t.x - car.x) * d.x + (t.y - car.y) * d.y;
    if (rel < 4 || rel > lookAhead + 20) continue;
    const lat = Math.abs((t.x - car.x) * d.y - (t.y - car.y) * d.x);
    if (lat < 22) return true;
  }
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const rel = (ped.x - car.x) * d.x + (ped.y - car.y) * d.y;
    if (rel < 2 || rel > lookAhead) continue;
    const lat = Math.abs((ped.x - car.x) * d.y - (ped.y - car.y) * d.x);
    if (lat < 18) return true;
  }
  return false;
}

export function stepTrafficCar(state, car, dt) {
  if (car.parked || car.wreck || car.driver !== 'traffic') return;
  const d = DIRS[car.dir];
  // Intersection handling: near the middle of a crossing road, and not the one just decided at?
  const crossRoads = d.x !== 0 ? state.world.avenues : state.world.streets;
  const along = d.x !== 0 ? car.x : car.y;
  const nearDecided = car.decidedAt && Math.hypot(car.x - car.decidedAt.x, car.y - car.decidedAt.y) < 95;
  if (!nearDecided) {
    for (const c of crossRoads) {
      if (Math.abs(along - c) < 24) {
        trafficChooseTurn(state, car, c);
        break;
      }
    }
  }
  const target = trafficTarget(state, car);
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const steer = Math.max(-1, Math.min(1, angleDiff(car.angle, desired) * 2.4));
  const lookAhead = 56 + Math.abs(car.speed) * 0.55;
  const blocked = roadBlockedAhead(state, car, lookAhead);
  const throttle = blocked ? (car.speed > 10 ? -0.7 : 0) : car.speed < car.model.cruise ? 0.75 : 0;
  stepCarPhysics(state, car, { throttle, steer }, dt);
  // A traffic car that somehow left the road network recovers onto the nearest road.
  if (!state.world.isSolid(car.x, car.y) && Math.abs(car.speed) < 4 && blocked) {
    car.honkT -= dt;
    if (car.honkT <= 0) { state.events.push({ type: 'sound', name: 'honk' }); car.honkT = randRange(state.rng, 1.4, 3.2); }
  }
}

/** Police driving: hunt the player, using the roads when far and charging in when close. */
export function stepPoliceCar(state, car, dt) {
  if (car.wreck || car.driver !== 'police') return;
  const p = state.player;
  const target = p.car ?? p;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const distance = Math.hypot(dx, dy);
  let aimX = target.x;
  let aimY = target.y;
  if (distance > 380) {
    const snap = state.world.nearestRoadPoint(target.x, target.y);
    aimX = snap.x + (target.x - snap.x) * 0.25;
    aimY = snap.y + (target.y - snap.y) * 0.25;
  }
  // If the way ahead is a wall, bend the aim toward the nearest open road point.
  const probeX = car.x + Math.cos(car.angle) * 84;
  const probeY = car.y + Math.sin(car.angle) * 84;
  if (state.world.isSolid(probeX, probeY)) {
    const snap = state.world.nearestRoadPoint(car.x, car.y);
    aimX = snap.x + Math.cos(car.angle) * 40;
    aimY = snap.y + Math.sin(car.angle) * 40;
  }
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  const steer = Math.max(-1, Math.min(1, angleDiff(car.angle, desired) * 2.6));
  let throttle = 1;
  if (distance < 54 && Math.abs(target.speed ?? 0) < 26) throttle = car.speed > 8 ? -0.6 : 0; // sit on a stopped player
  else if (distance < 30) throttle = 0.2;
  stepCarPhysics(state, car, { throttle, steer }, dt);
  car.sirenPhase = (car.sirenPhase ?? 0) + dt * 7;
}

/** All cars: AI drivers, then collisions between cars and between cars and people. */
export function stepCars(state, dt) {
  for (const car of state.cars) {
    if (car.driver === 'traffic') stepTrafficCar(state, car, dt);
    else if (car.driver === 'police') stepPoliceCar(state, car, dt);
  }
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) collideCarPair(state, cars[i], cars[j]);
  }
  for (const car of cars) {
    if (Math.abs(car.speed) < 40) continue;
    for (const ped of state.peds) collideCarPerson(state, car, ped);
    for (const off of state.officers) collideCarPerson(state, car, off);
    if (!state.player.car && state.player.hurtT <= 0) {
      const p = state.player;
      if (Math.hypot(p.x - car.x, p.y - car.y) < 25 && car.driver !== 'player') {
        p.hp -= Math.min(38, Math.abs(car.speed) * 0.11);
        p.hurtT = 0.9;
        p.x += Math.cos(car.angle) * 22;
        p.y += Math.sin(car.angle) * 22;
        state.world.collideCircle(p, PLAYER.radius);
        state.events.push({ type: 'sound', name: 'thud' });
        state.events.push({ type: 'playerHurt' });
      }
    }
  }
}

export function stepPeds(state, dt) {
  const world = state.world;
  for (const ped of state.peds) {
    if (ped.state === 'down') { ped.downT += dt; continue; }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      ped.x += Math.cos(ped.angle) * 208 * dt;
      ped.y += Math.sin(ped.angle) * 208 * dt;
      world.collideCircle(ped, 10);
      if (ped.fleeT <= 0) { ped.state = 'stroll'; ped.target = null; }
      continue;
    }
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
      ped.target = world.randomSidewalkPoint(state.rng);
    }
    const desired = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = turnToward(ped.angle, desired, 4 * dt);
    ped.x += Math.cos(ped.angle) * ped.speedBase * dt;
    ped.y += Math.sin(ped.angle) * ped.speedBase * dt;
    world.collideCircle(ped, 10);
    // A fast car close by is worth stepping back for.
    for (const car of state.cars) {
      if (Math.abs(car.speed) > 190 && Math.hypot(car.x - ped.x, car.y - ped.y) < 74) {
        ped.state = 'flee';
        ped.fleeFrom = { x: car.x, y: car.y };
        ped.fleeT = 1.6;
        break;
      }
    }
  }
  // The fallen fade; the city quietly replaces them elsewhere (handled by the game's spawner).
  state.peds = state.peds.filter((ped) => ped.state !== 'down' || ped.downT < 4);
}

export function stepOfficers(state, dt) {
  const p = state.player;
  const target = p.car ?? p;
  for (const off of state.officers) {
    if (off.state === 'down') { off.downT += dt; continue; }
    const d = Math.hypot(target.x - off.x, target.y - off.y);
    const desired = Math.atan2(target.y - off.y, target.x - off.x);
    off.angle = turnToward(off.angle, desired, 5 * dt);
    const canShoot = state.wanted.stars >= 3 && !p.car;
    if (d > 250 || p.car) {
      off.state = 'chase';
      off.x += Math.cos(off.angle) * 196 * dt;
      off.y += Math.sin(off.angle) * 196 * dt;
      state.world.collideCircle(off, 11);
    } else if (canShoot) {
      off.state = 'shoot';
      off.shootCd -= dt;
      if (off.shootCd <= 0 && d < 300) {
        off.shootCd = randRange(state.rng, 0.8, 1.25);
        const err = randRange(state.rng, -0.085, 0.085);
        state.bullets.push(createBullet(off.x + Math.cos(off.angle) * 14, off.y + Math.sin(off.angle) * 14, off.angle + err, 'police', 7));
        spawnFlash(state, off.x + Math.cos(off.angle) * 16, off.y + Math.sin(off.angle) * 16);
        state.events.push({ type: 'sound', name: 'shot' });
      }
    } else {
      off.state = 'chase';
      off.x += Math.cos(off.angle) * 196 * dt;
      off.y += Math.sin(off.angle) * 196 * dt;
      state.world.collideCircle(off, 11);
    }
  }
  state.officers = state.officers.filter((o) => o.state !== 'down' || o.downT < 4);
}

export function stepBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    let dead = false;
    for (let sub = 0; sub < 3 && !dead; sub += 1) {
      b.x += (b.vx * dt) / 3;
      b.y += (b.vy * dt) / 3;
      if (state.world.isSolid(b.x, b.y)) {
        spawnSparks(state, b.x, b.y, 3);
        dead = true;
        break;
      }
      if (b.from === 'player') {
        for (const off of state.officers) {
          if (off.state !== 'down' && Math.hypot(off.x - b.x, off.y - b.y) < 13) {
            off.hp -= b.damage;
            spawnSparks(state, b.x, b.y, 4);
            if (off.hp <= 0) {
              off.state = 'down';
              off.downT = 0;
              state.events.push({ type: 'crime', kind: 'killOfficer', x: off.x, y: off.y, always: true, byPlayer: true });
            } else state.events.push({ type: 'crime', kind: 'hitOfficer', x: off.x, y: off.y, byPlayer: true });
            dead = true;
            break;
          }
        }
        if (dead) break;
        for (const ped of state.peds) {
          if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
            ped.hp -= b.damage;
            spawnSparks(state, b.x, b.y, 3);
            if (ped.hp <= 0) {
              ped.state = 'down';
              ped.downT = 0;
              state.events.push({ type: 'crime', kind: 'killPed', x: ped.x, y: ped.y, byPlayer: true });
            } else {
              ped.state = 'flee';
              ped.fleeFrom = { x: p.x, y: p.y };
              ped.fleeT = 2.6;
              state.events.push({ type: 'crime', kind: 'hitPed', x: ped.x, y: ped.y, byPlayer: true });
            }
            dead = true;
            break;
          }
        }
        if (dead) break;
        for (const car of state.cars) {
          if (car !== p.car && Math.hypot(car.x - b.x, car.y - b.y) < 22) {
            car.hp -= 9;
            spawnSparks(state, b.x, b.y, 4);
            if (car.driver === 'police') state.events.push({ type: 'crime', kind: 'hitPolice', x: car.x, y: car.y, byPlayer: true });
            if (car.hp <= 0 && !car.wreck) car.wreck = true;
            dead = true;
            break;
          }
        }
      } else {
        // Police fire: it can only hurt the player (or the car the player sits in).
        const t = p.car ?? p;
        const r = p.car ? 23 : 13;
        if (Math.hypot(t.x - b.x, t.y - b.y) < r) {
          if (p.car) {
            p.car.hp -= 5;
            spawnSparks(state, b.x, b.y, 3);
            if (p.car.hp <= 0 && !p.car.wreck) {
              p.car.wreck = true;
              state.events.push({ type: 'carWrecked' });
            }
          } else {
            p.hp -= b.damage;
            state.events.push({ type: 'playerHurt' });
            state.events.push({ type: 'sound', name: 'hurt' });
          }
          dead = true;
        }
      }
    }
    b.life -= dt;
    if (dead || b.life <= 0) state.bullets.splice(i, 1);
  }
}

/** Frighten every pedestrian within earshot of a point (a gunshot, a crash, a shout). */
export function scarePeds(state, x, y, radius = 260) {
  for (const ped of state.peds) {
    if (ped.state === 'stroll' && Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeFrom = { x, y };
      ped.fleeT = randRange(state.rng, 1.8, 3.2);
    }
  }
}

/** Spawn helpers the game layer uses to keep the city populated. */
export function spawnTrafficCar(state) {
  const world = state.world;
  const spot = world.randomRoadPoint(state.rng);
  const vertical = spot.vertical;
  const dir = vertical ? (state.rng() < 0.5 ? 1 : 3) : state.rng() < 0.5 ? 0 : 2;
  const d = DIRS[dir];
  const off = laneOffset(dir);
  const x = vertical ? spot.x + (d.y > 0 ? -off : off) : spot.x;
  const y = vertical ? spot.y : spot.y + (d.x > 0 ? off : -off);
  if (world.isSolid(x, y)) return null;
  if (Math.hypot(x - state.player.x, y - state.player.y) < 340) return null;
  const car = createCar(state.rng, { x, y, angle: d.angle, driver: 'traffic', dir, roadC: vertical ? spot.x : spot.y });
  car.speed = car.model.cruise * 0.8;
  state.cars.push(car);
  return car;
}

export function spawnParkedCar(state, x, y, angle, opts = {}) {
  const car = createCar(state.rng, { x, y, angle, parked: true, ...opts });
  state.cars.push(car);
  return car;
}

export function spawnPoliceCar(state) {
  const world = state.world;
  const p = state.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const a = randRange(state.rng, 0, Math.PI * 2);
    const r = randRange(state.rng, 640, 860);
    const x = Math.max(60, Math.min(world.width - 60, p.x + Math.cos(a) * r));
    const y = Math.max(60, Math.min(world.height - 60, p.y + Math.sin(a) * r));
    const snap = world.nearestRoadPoint(x, y);
    if (world.isSolid(snap.x, snap.y)) continue;
    const car = createCar(state.rng, { x: snap.x, y: snap.y, model: 'police', driver: 'police', angle: Math.atan2(p.y - snap.y, p.x - snap.x) });
    state.cars.push(car);
    state.events.push({ type: 'sound', name: 'siren' });
    return car;
  }
  return null;
}

export { dist as distance };
