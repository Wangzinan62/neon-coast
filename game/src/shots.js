// NEON COAST — the screenshot scenes behind ?shot=title|drive|chase|end. Each one builds the
// real world from the seed, arranges a moment worth judging, then runs the real simulation
// forward a fixed number of fixed steps with a simple autopilot at the wheel, so the frame is
// what the game truly looks like in motion and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createCar, createPed } from './entities.js';
import { debugGiveCar, debugSetHeat, startMission, stepGame } from './game.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { mx: 0, my: 0, run: false, aimX: 0, aimY: 0, fire: false, interact: false, reload: false };

function stepSeconds(state, seconds, inputFor) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepGame(state, inputFor ? inputFor(i) : IDLE, STEP);
  }
}

/** Put the first mission live without its phone intro, so the HUD carries an objective. */
function armFirstMission(state) {
  startMission(state, 0);
  state.dialog = null;
  state.mission.phase = 'active';
}

/** Extra traffic on the central avenues and pedestrians on their sidewalks. */
function crowdDowntown(state) {
  const rng = state.rng;
  const spots = [
    { x: 1766, y: 1180, dir: 1, roadC: 1792 }, { x: 1818, y: 1560, dir: 3, roadC: 1792 },
    { x: 1254, y: 1560, dir: 1, roadC: 1280 }, { x: 700, y: 1254, dir: 0, roadC: 1280 },
    { x: 1500, y: 1330, dir: 2, roadC: 1280 }, { x: 2330, y: 1050, dir: 3, roadC: 2304 },
  ];
  for (const s of spots) {
    const car = createCar(rng, { x: s.x, y: s.y, angle: s.dir === 0 ? 0 : s.dir === 1 ? Math.PI / 2 : s.dir === 2 ? Math.PI : -Math.PI / 2, driver: 'traffic', dir: s.dir, roadC: s.roadC });
    car.speed = car.model.cruise * 0.85;
    state.cars.push(car);
  }
  for (let i = 0; i < 16; i += 1) {
    const avenue = [1280, 1792, 2304][i % 3];
    const side = i % 2 === 0 ? -1 : 1;
    state.peds.push(createPed(rng, avenue + side * (64 + rng() * 9), 760 + rng() * 1250));
  }
}

/** A simple driver: steer at a target point, full throttle, no fear. */
function driveInput(state, tx, ty) {
  const car = state.player.car;
  if (!car) return IDLE;
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { ...IDLE, mx: Math.max(-1, Math.min(1, diff * 2.4)), my: -1 };
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Any name but drive, chase or end is the title.
 */
export function stageShot(name, state) {
  if (name === 'drive') {
    armFirstMission(state);
    crowdDowntown(state);
    const car = debugGiveCar(state, 'sport');
    car.x = 1766; // the southbound lane of Solano Avenue
    car.y = 300;
    car.angle = Math.PI / 2;
    state.player.x = car.x;
    state.player.y = car.y;
    // Four seconds southbound down the avenue, through two lit intersections, still rolling.
    stepSeconds(state, 4.2, () => driveInput(state, 1766, 4000));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    armFirstMission(state);
    crowdDowntown(state);
    const car = debugGiveCar(state, 'muscle');
    car.x = 1306; // the northbound lane of Coral Avenue
    car.y = 1750;
    car.angle = -Math.PI / 2;
    state.player.x = car.x;
    state.player.y = car.y;
    debugSetHeat(state, 560); // four stars: the whole precinct is awake
    // Two interceptors start on the player's tail; more roll in as the steps run.
    for (const [x, y] of [[1306, 1985], [1254, 2110]]) {
      const cop = createCar(state.rng, { x, y, model: 'police', driver: 'police', angle: -Math.PI / 2 });
      state.cars.push(cop);
    }
    const waypoints = [
      { x: 1306, y: 830 },
      { x: 860, y: 742 },
      { x: 430, y: 742 },
    ];
    let wp = 0;
    stepSeconds(state, 9, () => {
      const target = waypoints[Math.min(wp, waypoints.length - 1)];
      if (Math.hypot(car.x - target.x, car.y - target.y) < 110 && wp < waypoints.length - 1) wp += 1;
      return driveInput(state, target.x, target.y);
    });
    // If the law actually caught the driver mid-scene, keep the surrounded moment itself as
    // the frame — stars restored, no BUSTED overlay — rather than the respawn that follows.
    if (state.gameOver === 'busted') {
      state.gameOver = null;
      state.wanted.heat = 560;
      state.wanted.stars = 4;
    } else if (state.gameOver) {
      state.gameOver = null;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    // The last few metres of First Run: walk the package into the diner and take the banner.
    startMission(state, 0);
    state.dialog = null;
    state.mission.phase = 'active';
    state.mission.stage = 1; // the pickup is done; the delivery is the shot
    const p = state.player;
    p.x = 2886;
    p.y = 1330;
    stepSeconds(state, 2.6, () => (state.mission.phase === 'active'
      ? { ...IDLE, mx: 1, aimX: p.x + 100, aimY: p.y }
      : IDLE));
    return { screen: SCREEN_PLAY };
  }
  // Title: the city idles behind the logo for a few seconds of traffic and strolling.
  crowdDowntown(state);
  stepSeconds(state, 5, null);
  return { screen: SCREEN_TITLE };
}
