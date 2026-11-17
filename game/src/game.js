// NEON COAST — the simulation: one state object and the fixed step that advances it. The
// player walks and drives, crimes feed the wanted level, the wanted level fields the police,
// the police can bust or stop the player, missions hand out objectives and cash, and the
// Neon Spray garage sells a clean record. Rendering and sound live elsewhere; this file only
// decides what is true, and reports sounds it wants through state.sounds.
import { ECONOMY, PLAYER, POLICE, SAVE_KEY, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createWorld, pointInRect } from './world.js';
import {
  createBullet, createCar, createOfficer, createPed, scarePeds, spawnFlash, spawnParkedCar,
  spawnPickupGlow, spawnPoliceCar, spawnTrafficCar, stepBullets, stepCarPhysics, stepCars,
  stepOfficers, stepParticles, stepPeds,
} from './entities.js';
import { buildMissions, STORY_INTRO } from './missions.js';

/** Heat each crime adds when a witness sees it (police victims always count as witnessed). */
const CRIME_HEAT = {
  shoot: 14, carjack: 60, hitCar: 22, hitPed: 55, killPed: 95,
  hitOfficer: 90, killOfficer: 170, hitPolice: 85,
};
const POLICE_INVOLVED = new Set(['hitOfficer', 'killOfficer', 'hitPolice']);

export function createGame(seed, save = null) {
  const rng = createRandom(seed);
  const world = createWorld(rng);
  const state = {
    time: 0,
    rng,
    world,
    missions: buildMissions(world),
    player: {
      x: world.places.start.x, y: world.places.start.y, angle: -Math.PI / 2,
      hp: PLAYER.maxHealth, cash: 250, car: null,
      ammo: PLAYER.magazine, reloading: 0, fireCd: 0, hurtT: 0, hurtFlash: 0,
      speedMag: 0,
    },
    cars: [], peds: [], officers: [], bullets: [], particles: [],
    events: [], sounds: [],
    wanted: { heat: 0, stars: 0, lastSeenT: -100, spawnT: 0 },
    bustedMeter: 0,
    dialog: null, // {lines, index, t}
    banner: null, // {title, sub, t, max}
    mission: { index: 0, stage: 0, phase: 'idle', timer: null, betweenT: 0 },
    markedCar: null,
    gameOver: null, // 'flatlined' | 'busted'
    overT: 0,
    overInfo: '',
    freeRoam: false,
    storyDone: false,
    saveT: 0,
    sprayCd: 0,
    started: false,
  };

  // Opening traffic and parked cars: a lived-in city from the first frame.
  for (let i = 0; i < 26; i += 1) spawnTrafficCar(state);
  const lot = world.lot;
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (rng() < 0.3) continue;
      spawnParkedCar(state, lot.x + 52 + c * 78, lot.y + 62 + r * 120, Math.PI / 2);
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const spot = world.randomRoadPoint(rng);
    const x = spot.vertical ? spot.x + (rng() < 0.5 ? -46 : 46) : spot.x;
    const y = spot.vertical ? spot.y : spot.y + (rng() < 0.5 ? -46 : 46);
    if (!world.isSolid(x, y)) spawnParkedCar(state, x, y, spot.vertical ? Math.PI / 2 : 0);
  }
  for (let i = 0; i < 34; i += 1) {
    const p = world.randomSidewalkPoint(rng);
    state.peds.push(createPed(rng, p.x, p.y));
  }

  if (save) applySave(state, save);
  return state;
}

function applySave(state, save) {
  state.player.cash = save.cash ?? state.player.cash;
  if (Number.isFinite(save.px) && Number.isFinite(save.py) && !state.world.isSolid(save.px, save.py)) {
    state.player.x = save.px;
    state.player.y = save.py;
  }
  const idx = Math.max(0, Math.min(state.missions.length, save.missionIndex ?? 0));
  state.mission.index = idx;
  if (idx >= state.missions.length) {
    state.freeRoam = true;
    state.storyDone = true;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      missionIndex: state.freeRoam ? state.missions.length : state.mission.index,
      px: Math.round(state.player.x),
      py: Math.round(state.player.y),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* nothing to clear */ }
}

function showDialog(state, lines) {
  state.dialog = { lines, index: 0, t: 0 };
}

function showBanner(state, title, sub, seconds = 3.2) {
  state.banner = { title, sub, t: 0, max: seconds };
}

/** Begin a mission: its phone intro first, then the first stage goes live. */
export function startMission(state, index) {
  const m = state.missions[index];
  if (!m) {
    state.freeRoam = true;
    state.storyDone = true;
    return;
  }
  state.mission.index = index;
  state.mission.stage = 0;
  state.mission.phase = 'intro';
  state.mission.timer = null;
  showDialog(state, m.intro);
  if (m.startHeat) state.wanted.heat = Math.max(state.wanted.heat, m.startHeat);
  if (m.id === 'hot-wheels' && !state.markedCar) {
    const spot = state.world.places.markedCarSpot;
    state.markedCar = spawnParkedCar(state, spot.x, spot.y, -Math.PI / 2, { model: 'sport', color: '#ff7a59', marked: true });
  }
}

/** Start (or restart) the run of missions from the current index. */
export function beginStory(state) {
  state.started = true;
  if (state.freeRoam) return;
  if (state.mission.index === 0 && !state.storyIntroShown) {
    state.storyIntroShown = true;
    showDialog(state, [...STORY_INTRO, ...state.missions[0].intro]);
    state.mission.phase = 'intro';
    state.mission.stage = 0;
    return;
  }
  startMission(state, state.mission.index);
}

function failMission(state, why) {
  const m = state.missions[state.mission.index];
  state.mission.phase = 'between';
  state.mission.betweenT = 2.6;
  state.mission.timer = null;
  state.retrying = true;
  if (m) showDialog(state, [{ who: m.from, text: why }]);
}

function completeMission(state) {
  const m = state.missions[state.mission.index];
  state.player.cash += m.reward;
  showBanner(state, 'MISSION COMPLETE', `${m.name} · +$${m.reward}`);
  state.sounds.push('complete');
  showDialog(state, m.done);
  state.mission.phase = 'between';
  state.mission.betweenT = 5;
  state.mission.timer = null;
  state.mission.index += 1;
  saveGame(state);
}

function currentStage(state) {
  const m = state.missions[state.mission.index];
  if (!m || state.mission.phase !== 'active') return null;
  return m.stages[state.mission.stage] ?? null;
}

/** The point the HUD marker and minimap blip point at, or null when there is no objective. */
export function objectivePoint(state) {
  const stage = currentStage(state);
  if (!stage) return null;
  if (stage.kind === 'steal') return state.markedCar ? { x: state.markedCar.x, y: state.markedCar.y } : null;
  return { x: stage.x, y: stage.y };
}

function stepMission(state, dt) {
  const ms = state.mission;
  if (state.dialog) {
    state.dialog.t += dt;
    if (state.dialog.t > 4.2) {
      state.dialog.index += 1;
      state.dialog.t = 0;
      if (state.dialog.index >= state.dialog.lines.length) {
        state.dialog = null;
        if (ms.phase === 'intro') {
          ms.phase = 'active';
          armStage(state);
        }
      }
    }
  }
  if (ms.phase === 'between') {
    ms.betweenT -= dt;
    if (ms.betweenT <= 0) {
      if (state.retrying) {
        state.retrying = false;
        const m = state.missions[ms.index];
        ms.phase = 'active';
        ms.stage = 0;
        armStage(state);
        if (m && m.id === 'hot-wheels' && (!state.markedCar || state.markedCar.wreck)) {
          const spot = state.world.places.markedCarSpot;
          state.markedCar = spawnParkedCar(state, spot.x, spot.y, -Math.PI / 2, { model: 'sport', color: '#ff7a59', marked: true });
        }
        if (m && m.startHeat) state.wanted.heat = Math.max(state.wanted.heat, m.startHeat);
      } else if (ms.index < state.missions.length) {
        startMission(state, ms.index);
      } else {
        state.freeRoam = true;
        state.storyDone = true;
        showBanner(state, 'STORY COMPLETE', 'Neon Coast is yours. Free roam — the city stays open.');
      }
    }
    return;
  }
  const stage = currentStage(state);
  if (!stage) return;
  if (stage.timer !== undefined && ms.timer !== null) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      failMission(state, 'Too slow — the tide does not wait. Run it again.');
      return;
    }
  }
  const p = state.player;
  const d = (x, y) => Math.hypot(p.x - x, p.y - y);
  let done = false;
  if (stage.kind === 'pickup' && !p.car && d(stage.x, stage.y) < 36) done = true;
  else if (stage.kind === 'deliver') {
    if (stage.needsMarkedCar) done = p.car === state.markedCar && d(stage.x, stage.y) < 86;
    else done = d(stage.x, stage.y) < 66;
  } else if (stage.kind === 'steal' && p.car === state.markedCar) done = true;
  else if (stage.kind === 'reach' && d(stage.x, stage.y) < 58) done = true;
  if (!done) return;
  if (stage.setsHeat) state.wanted.heat = Math.max(state.wanted.heat, stage.setsHeat);
  state.sounds.push('pickup');
  spawnPickupGlow(state, p.x, p.y);
  ms.stage += 1;
  const m = state.missions[ms.index];
  if (ms.stage >= m.stages.length) completeMission(state);
  else {
    showBanner(state, 'OBJECTIVE UPDATED', m.stages[ms.stage].label, 2.4);
    armStage(state);
  }
}

function armStage(state) {
  const stage = currentStage(state);
  state.mission.timer = stage && stage.timer !== undefined ? stage.timer : null;
}

/** Was this crime seen? Police victims always count; otherwise a bystander or unit must be near. */
function witnessed(state, ev) {
  if (ev.always || POLICE_INVOLVED.has(ev.kind)) return true;
  for (const ped of state.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - ev.x, ped.y - ev.y) < WANTED.witnessRadius) return true;
  }
  for (const car of state.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - ev.x, car.y - ev.y) < WANTED.witnessRadius + 160) return true;
  }
  for (const off of state.officers) {
    if (off.state !== 'down' && Math.hypot(off.x - ev.x, off.y - ev.y) < WANTED.witnessRadius + 160) return true;
  }
  return false;
}

function processEvents(state) {
  for (const ev of state.events) {
    if (ev.type === 'sound') {
      state.sounds.push(ev.name);
    } else if (ev.type === 'playerHurt') {
      state.player.hurtFlash = 0.3;
    } else if (ev.type === 'carWrecked') {
      // The player's car died around them: climb out, shaken.
      const p = state.player;
      if (p.car) {
        p.car.driver = null;
        p.car.parked = true;
        p.x = p.car.x + 30;
        p.y = p.car.y + 10;
        state.world.collideCircle(p, 13);
        p.car = null;
        p.hp -= 12;
        showBanner(state, 'TOTALLED', 'Your ride is done. Find another.', 2.2);
      }
    } else if (ev.type === 'crime') {
      if (ev.kind === 'shoot') {
        scarePeds(state, ev.x, ev.y);
        // Heard across a few blocks even with no eyes on it.
        const heard = state.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - ev.x, c.y - ev.y) < 720);
        if (heard) state.wanted.heat += 5;
      }
      if (ev.byPlayer === false && !ev.always) continue;
      if (!CRIME_HEAT[ev.kind]) continue;
      if (witnessed(state, ev)) {
        state.wanted.heat = Math.min(WANTED.maxHeat, state.wanted.heat + CRIME_HEAT[ev.kind]);
        state.wanted.lastSeenT = state.time;
      }
    }
  }
  state.events.length = 0;
}

function stepWanted(state, dt) {
  const w = state.wanted;
  w.stars = WANTED.starHeat.filter((t) => w.heat >= t).length;
  const p = state.player;
  // Police eyes on the player hold the heat where it is.
  let seen = false;
  for (const car of state.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 430) seen = true;
  }
  for (const off of state.officers) {
    if (off.state !== 'down' && Math.hypot(off.x - p.x, off.y - p.y) < 380) seen = true;
  }
  if (seen) w.lastSeenT = state.time;
  else if (state.time - w.lastSeenT > WANTED.seenGrace && w.heat > 0) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt);
    w.stars = WANTED.starHeat.filter((t) => w.heat >= t).length;
  }
  // Reinforcements roll in while the stars are up.
  w.spawnT -= dt;
  const policeCars = state.cars.filter((c) => c.driver === 'police' && !c.wreck);
  if (w.stars > 0 && w.spawnT <= 0) {
    w.spawnT = POLICE.spawnInterval;
    if (policeCars.length < POLICE.carsPerStar[w.stars]) spawnPoliceCar(state);
    const wantOfficers = POLICE.officersPerStar[w.stars];
    if (state.officers.filter((o) => o.state !== 'down').length < wantOfficers && policeCars.length > 0) {
      const near = policeCars.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 640);
      if (near) state.officers.push(createOfficer(state.rng, near.x + 24, near.y + 8));
    }
  }
  if (w.stars === 0) {
    // The heat is gone: patrol cars give up and merge back into traffic, and the officers on
    // foot clock off — they simply become pedestrians again and stroll away.
    for (const car of state.cars) {
      if (car.driver === 'police') {
        car.driver = 'traffic';
        car.parked = false;
        const snap = state.world.nearestRoadPoint(car.x, car.y);
        let vertical;
        if (snap.x !== car.x) vertical = true;
        else if (snap.y !== car.y) vertical = false;
        else vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
        car.dir = vertical ? (Math.sin(car.angle) > 0 ? 1 : 3) : Math.cos(car.angle) > 0 ? 0 : 2;
        car.roadC = vertical ? snap.x : snap.y;
        car.decidedAt = null;
      }
    }
    for (const off of state.officers) {
      if (off.state !== 'down') state.peds.push(createPed(state.rng, off.x, off.y));
    }
    state.officers = [];
  }
  // The bust meter: an officer (or a patrol car) close in on a slow player is bad news.
  const pSpeed = p.car ? Math.abs(p.car.speed) : p.speedMag;
  let pressure = false;
  if (w.stars > 0 && pSpeed < 34) {
    for (const off of state.officers) {
      if (off.state !== 'down' && Math.hypot(off.x - p.x, off.y - p.y) < 54) pressure = true;
    }
    for (const car of policeCars) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 62 && Math.abs(car.speed) < 60) pressure = true;
    }
  }
  state.bustedMeter = Math.max(0, Math.min(1, state.bustedMeter + (pressure ? dt / POLICE.bustSeconds : -dt * 1.3)));
  if (state.bustedMeter >= 1) doBusted(state);
}

function doBusted(state) {
  const p = state.player;
  const fine = ECONOMY.bustBase + ECONOMY.bustPerStar * state.wanted.stars;
  p.cash = Math.max(0, p.cash - fine);
  state.gameOver = 'busted';
  state.overInfo = `Fine $${fine}`;
  state.overT = 2.8;
  state.bustedMeter = 0;
  state.wanted.heat = 0;
  state.wanted.stars = 0;
}

function doFlatlined(state) {
  const p = state.player;
  p.cash = Math.max(0, p.cash - ECONOMY.hospitalFee);
  state.gameOver = 'flatlined';
  state.overInfo = `Hospital bill $${ECONOMY.hospitalFee}`;
  state.overT = 2.8;
  state.wanted.heat = Math.floor(state.wanted.heat * 0.35);
}

function respawn(state) {
  const p = state.player;
  const spot = state.gameOver === 'busted' ? state.world.places.stationDoor : state.world.places.hospitalDoor;
  if (p.car) {
    p.car.driver = null;
    p.car.parked = true;
    p.car = null;
  }
  p.x = spot.x;
  p.y = spot.y;
  p.hp = PLAYER.maxHealth;
  p.ammo = PLAYER.magazine;
  p.reloading = 0;
  state.officers = [];
  state.bullets = [];
  state.gameOver = null;
  if (state.mission.phase === 'active' || state.mission.phase === 'intro') {
    failMission(state, state.lastOver === 'busted' ? 'Busted. The job waits — run it again, cleaner.' : 'That one nearly ended you. The job is still on — run it again.');
  }
}

function tryEnterExitCar(state) {
  const p = state.player;
  if (p.car) {
    const car = p.car;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.car = null;
    p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    state.world.collideCircle(p, PLAYER.radius);
    state.sounds.push('door');
    return;
  }
  let best = null;
  let bestD = 58;
  for (const car of state.cars) {
    if (car.wreck) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // Yank the driver out: they land on the street as a very unhappy pedestrian.
    const ped = createPed(state.rng, best.x + 26, best.y + 14);
    ped.state = 'flee';
    ped.fleeFrom = { x: p.x, y: p.y };
    ped.fleeT = 3;
    state.peds.push(ped);
    state.events.push({ type: 'crime', kind: 'carjack', x: best.x, y: best.y, byPlayer: true });
  } else if (best.driver === 'police') {
    state.events.push({ type: 'crime', kind: 'carjack', x: best.x, y: best.y, byPlayer: true, always: true });
  } else if (best.parked) {
    state.events.push({ type: 'crime', kind: 'carjack', x: best.x, y: best.y, byPlayer: true });
  }
  best.driver = 'player';
  best.parked = false;
  p.car = best;
  state.sounds.push('door');
}

function stepPlayer(state, input, dt) {
  const p = state.player;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) p.ammo = PLAYER.magazine;
  }
  if (input.interact) tryEnterExitCar(state);
  if (input.reload && p.reloading <= 0 && p.ammo < PLAYER.magazine) p.reloading = PLAYER.reloadTime;

  if (p.car) {
    const car = p.car;
    stepCarPhysics(state, car, { throttle: -input.my, steer: input.mx }, dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speedMag = Math.abs(car.speed);
    // The Neon Spray: roll in wanted or dented, roll out clean — for a price.
    state.sprayCd = Math.max(0, state.sprayCd - dt);
    const zone = state.world.places.sprayZone;
    if (state.sprayCd <= 0 && Math.abs(car.speed) < 42 && pointInRect(car.x, car.y, zone)
      && (state.wanted.heat > 0 || car.hp < CAR_HEALTH_FULL) && p.cash >= ECONOMY.sprayCost) {
      p.cash -= ECONOMY.sprayCost;
      state.wanted.heat = 0;
      car.hp = 100;
      state.sprayCd = 4;
      state.sounds.push('spray');
      showBanner(state, 'NEON SPRAY', `Fresh paint, clean record · −$${ECONOMY.sprayCost}`, 2.2);
    }
    return;
  }

  const mag = Math.hypot(input.mx, input.my);
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (mag > 0.01) {
    const vx = (input.mx / Math.max(1, mag)) * speed;
    const vy = (input.my / Math.max(1, mag)) * speed;
    p.x += vx * dt;
    p.y += vy * dt;
    p.speedMag = speed;
    if (!input.fire) p.angle = Math.atan2(vy, vx);
  } else {
    p.speedMag = 0;
  }
  if (input.fire) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  state.world.collideCircle(p, PLAYER.radius);

  if (input.fire && p.fireCd <= 0 && p.reloading <= 0) {
    if (p.ammo <= 0) {
      p.reloading = PLAYER.reloadTime;
      state.sounds.push('click');
    } else {
      p.ammo -= 1;
      p.fireCd = PLAYER.fireInterval;
      const a = Math.atan2(input.aimY - p.y, input.aimX - p.x);
      state.bullets.push(createBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a, 'player', PLAYER.bulletDamage));
      spawnFlash(state, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18);
      state.sounds.push('shot');
      state.events.push({ type: 'crime', kind: 'shoot', x: p.x, y: p.y, byPlayer: true });
      if (p.ammo === 0) p.reloading = PLAYER.reloadTime;
    }
  }
}

const CAR_HEALTH_FULL = 100;

/** Keep the streets alive: top up traffic and pedestrians, retire whatever is far away. */
function stepSpawner(state, dt) {
  state.spawnT = (state.spawnT ?? 0) - dt;
  const p = state.player;
  if (state.spawnT <= 0) {
    state.spawnT = 0.8;
    const traffic = state.cars.filter((c) => c.driver === 'traffic').length;
    if (traffic < 15) spawnTrafficCar(state);
    if (state.peds.filter((x) => x.state !== 'down').length < 30) {
      const spot = state.world.randomSidewalkPoint(state.rng);
      if (Math.hypot(spot.x - p.x, spot.y - p.y) > 420) state.peds.push(createPed(state.rng, spot.x, spot.y));
    }
  }
  // Traffic that wandered to the far side of the city is quietly removed.
  state.cars = state.cars.filter((c) => {
    if (c.driver !== 'traffic') return true;
    return Math.hypot(c.x - p.x, c.y - p.y) < 1750;
  });
}

/**
 * Advance the whole city one fixed step. `input` is
 * {mx, my, run, aimX, aimY, fire, interact, reload} in world terms.
 */
export function stepGame(state, input, dt) {
  state.time += dt;
  if (state.banner) {
    state.banner.t += dt;
    if (state.banner.t > state.banner.max) state.banner = null;
  }
  if (state.gameOver) {
    state.overT -= dt;
    stepParticles(state, dt);
    if (state.overT <= 0) {
      state.lastOver = state.gameOver;
      respawn(state);
    }
    state.events.length = 0;
    return;
  }
  stepPlayer(state, input, dt);
  stepCars(state, dt);
  stepPeds(state, dt);
  stepOfficers(state, dt);
  stepBullets(state, dt);
  stepParticles(state, dt);
  processEvents(state);
  stepWanted(state, dt);
  stepMission(state, dt);
  stepSpawner(state, dt);
  if (state.player.hp <= 0 && !state.gameOver) doFlatlined(state);
  state.saveT += dt;
  if (state.saveT > 6) {
    state.saveT = 0;
    saveGame(state);
  }
}

/** Debug hooks the screenshot scenes use to arrange a moment (they still run the real step). */
export function debugGiveCar(state, modelKey = 'sport') {
  const p = state.player;
  const spot = state.world.nearestRoadPoint(p.x, p.y);
  const car = createCar(state.rng, { x: spot.x, y: spot.y, model: modelKey, angle: 0 });
  state.cars.push(car);
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  return car;
}

export function debugSetHeat(state, heat) {
  state.wanted.heat = heat;
  state.wanted.lastSeenT = state.time;
}
