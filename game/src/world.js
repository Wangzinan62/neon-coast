// NEON COAST — the city itself: a grid of six avenues and five streets west of a beach, built
// once from a seed. Blocks between the roads hold buildings (some named, some signed in neon),
// a park, a parking lot, a hospital, a police precinct, the Neon Spray garage and a hideout.
// Everything the simulation needs to know about the map lives here: what is solid, where the
// roads run, where a pedestrian can stroll, and the named places the story visits.
import { WATER_X, WORLD } from './config.js';
import { chance, pick, randInt, randRange } from './random.js';

/** Half the asphalt width of a road, and half the width including its sidewalks. */
export const ROAD_HALF = 56;
export const WALK_HALF = 78;

/** Avenues run north-south (their x centres), streets east-west (their y centres). */
export const AVENUES = [256, 768, 1280, 1792, 2304, 2816];
export const STREETS = [256, 768, 1280, 1792, 2304];

/** The pier deck: the one piece of ground over the water, planks from the sand to the sea. */
export const PIER = { x: WATER_X, y: 1064, w: 340, h: 112 };

/** Shop and hotel names painted on the buildings, all invented for Neon Coast. */
const SIGN_NAMES = [
  'MARINA DELI', 'PALM COURT HOTEL', 'NEON NOODLE', 'CASA AZUL', 'VELVET LOUNGE',
  'KAIYO SUSHI', 'HOTEL SOLANA', 'TIDE GYM', 'ORBIT ARCADE', 'BANCO COSTA',
  'LUNA PHARMACY', 'PIER 9 DINER', 'SOLSTICE CLUB', 'MERCADO RUIZ', 'AZURE MOTORS',
  'COCO MART', 'BRISA BAKERY', 'THE GILDED EEL', 'HOTEL MAREA', 'VINYL PALMS',
];
const NEON_COLORS = ['#ff5da2', '#22d3ee', '#facc15', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'];
const BUILDING_COLORS = ['#5b4a68', '#6e5648', '#4a5a6e', '#715f7d', '#54655a', '#7d5f4a', '#4f4460', '#63506e', '#584a72', '#6b4a55'];
const ROOF_COLORS = ['#3a3348', '#443a36', '#36404e', '#403650', '#37453c', '#4a3a30'];

/** The block cells between road bands: [left, top, right, bottom] each, west to east, north to south. */
function blockCells() {
  const xEdges = [0];
  for (const a of AVENUES) xEdges.push(a - WALK_HALF, a + WALK_HALF);
  xEdges.push(3072);
  const yEdges = [0];
  for (const s of STREETS) yEdges.push(s - WALK_HALF, s + WALK_HALF);
  yEdges.push(WORLD.height);
  const cells = [];
  for (let cx = 0; cx + 1 < xEdges.length; cx += 2) {
    for (let cy = 0; cy + 1 < yEdges.length; cy += 2) {
      cells.push({ col: cx / 2, row: cy / 2, x: xEdges[cx], y: yEdges[cy], w: xEdges[cx + 1] - xEdges[cx], h: yEdges[cy + 1] - yEdges[cy] });
    }
  }
  return cells;
}

/** One building in a cell, shrunk by a margin, with its windows and maybe a neon sign. */
function makeBuilding(rng, x, y, w, h, signPool) {
  const floors = randInt(rng, 2, 9);
  const building = {
    x, y, w, h, floors,
    color: pick(rng, BUILDING_COLORS),
    roof: pick(rng, ROOF_COLORS),
    seed: Math.floor(rng() * 1e9),
    name: null,
    signColor: null,
  };
  if (signPool.length > 0 && chance(rng, 0.55)) {
    building.name = signPool.splice(randInt(rng, 0, signPool.length - 1), 1)[0];
    building.signColor = pick(rng, NEON_COLORS);
  }
  return building;
}

/** Fill one ordinary block cell with one, two or four buildings, leaving alleys between them. */
function fillCell(rng, cell, buildings, signPool) {
  const m = 16;
  const inner = { x: cell.x + m, y: cell.y + m, w: cell.w - 2 * m, h: cell.h - 2 * m };
  if (inner.w < 90 || inner.h < 90) return;
  const layout = pick(rng, ['one', 'two-x', 'two-y', 'four']);
  if (layout === 'one' || inner.w < 210 || inner.h < 210) {
    buildings.push(makeBuilding(rng, inner.x, inner.y, inner.w, inner.h, signPool));
    return;
  }
  const gap = 22;
  if (layout === 'two-x') {
    const w = (inner.w - gap) / 2;
    buildings.push(makeBuilding(rng, inner.x, inner.y, w, inner.h, signPool));
    buildings.push(makeBuilding(rng, inner.x + w + gap, inner.y, w, inner.h, signPool));
  } else if (layout === 'two-y') {
    const h = (inner.h - gap) / 2;
    buildings.push(makeBuilding(rng, inner.x, inner.y, inner.w, h, signPool));
    buildings.push(makeBuilding(rng, inner.x, inner.y + h + gap, inner.w, h, signPool));
  } else {
    const w = (inner.w - gap) / 2;
    const h = (inner.h - gap) / 2;
    buildings.push(makeBuilding(rng, inner.x, inner.y, w, h, signPool));
    buildings.push(makeBuilding(rng, inner.x + w + gap, inner.y, w, h, signPool));
    buildings.push(makeBuilding(rng, inner.x, inner.y + h + gap, w, h, signPool));
    buildings.push(makeBuilding(rng, inner.x + w + gap, inner.y + h + gap, w, h, signPool));
  }
}

export function createWorld(rng) {
  const cells = blockCells();
  const cellAt = (col, row) => cells.find((c) => c.col === col && c.row === row);
  const buildings = [];
  const signPool = [...SIGN_NAMES];

  // The special blocks first, so their buildings carry the right names.
  const park = cellAt(2, 2);
  const lot = cellAt(4, 3);
  const hospitalCell = cellAt(0, 4);
  const stationCell = cellAt(5, 0);
  const sprayCell = cellAt(3, 3);
  const hideoutCell = cellAt(0, 0);
  const special = new Set([park, lot, hospitalCell, stationCell, sprayCell, hideoutCell]);

  const named = (cell, name, signColor, wFrac = 0.82, hFrac = 0.82) => {
    const w = cell.w * wFrac;
    const h = cell.h * hFrac;
    const b = makeBuilding(rng, cell.x + (cell.w - w) / 2, cell.y + (cell.h - h) / 2, w, h, []);
    b.name = name;
    b.signColor = signColor;
    buildings.push(b);
    return b;
  };
  const hospital = named(hospitalCell, 'ST. LUCIA GENERAL', '#7be382');
  const station = named(stationCell, 'NCPD HARBOR PRECINCT', '#7aa2ff');
  const sprayShop = named(sprayCell, 'NEON SPRAY', '#ff5da2', 0.8, 0.52);
  const hideoutHouse = named(hideoutCell, null, null, 0.7, 0.7);

  for (const cell of cells) {
    if (!special.has(cell)) fillCell(rng, cell, buildings, signPool);
  }

  // Palms along the beach and promenade, in the park, and scattered on downtown sidewalks.
  const palms = [];
  for (let y = 60; y < WORLD.height - 40; y += randRange(rng, 90, 150)) {
    palms.push({ x: randRange(rng, 3110, 3300), y, s: randRange(rng, 0.85, 1.25) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: park.x + randRange(rng, 24, park.w - 24), y: park.y + randRange(rng, 24, park.h - 24), s: randRange(rng, 0.8, 1.15) });
  }
  for (let i = 0; i < 22; i += 1) {
    const a = pick(rng, AVENUES);
    const s = pick(rng, STREETS);
    palms.push({ x: a + pick(rng, [-1, 1]) * randRange(rng, 88, 120), y: s + randRange(rng, -260, 260), s: randRange(rng, 0.75, 1.05) });
  }

  // Street lamps on the sidewalk edges, close enough together to pool light at dusk.
  const lamps = [];
  for (const a of AVENUES) for (let y = 90; y < WORLD.height; y += 176) lamps.push({ x: a - WALK_HALF + 6, y }, { x: a + WALK_HALF - 6, y: y + 88 });
  for (const s of STREETS) for (let x = 90; x < 3072; x += 176) lamps.push({ x, y: s - WALK_HALF + 6 }, { x: x + 88, y: s + WALK_HALF - 6 });

  // Beach umbrellas, bright dots on the sand.
  const umbrellas = [];
  for (let i = 0; i < 30; i += 1) {
    umbrellas.push({ x: randRange(rng, 3100, 3310), y: randRange(rng, 40, WORLD.height - 40), color: pick(rng, NEON_COLORS), s: randRange(rng, 0.8, 1.2) });
  }

  const world = {
    width: WORLD.width,
    height: WORLD.height,
    avenues: AVENUES,
    streets: STREETS,
    buildings,
    palms,
    lamps,
    umbrellas,
    park: { x: park.x, y: park.y, w: park.w, h: park.h },
    lot: { x: lot.x, y: lot.y, w: lot.w, h: lot.h },
    pier: PIER,
    /** Named places the missions and the respawn rules use. */
    places: {
      hospitalDoor: { x: hospital.x + hospital.w + 26, y: hospital.y + hospital.h / 2 },
      stationDoor: { x: station.x + station.w / 2, y: station.y + station.h + 26 },
      sprayZone: { x: sprayCell.x + 40, y: sprayShop.y + sprayShop.h + 26, w: sprayCell.w - 80, h: sprayCell.h - sprayShop.h - 90 },
      hideout: { x: hideoutCell.x + hideoutCell.w + 22, y: hideoutCell.y + hideoutCell.h + 22 },
      packageA: { x: 2050, y: 706 },
      diner: { x: 2980, y: 1330 },
      markedCarSpot: { x: lot.x + lot.w / 2, y: lot.y + lot.h / 2 },
      pierPickup: { x: PIER.x + PIER.w - 60, y: PIER.y + PIER.h / 2 },
      warehouse: { x: 210, y: 2420 },
      start: { x: 1206, y: 1876 },
    },

    /** Is this point inside a building, in the sea (off the pier), or off the map? */
    isSolid(x, y) {
      if (x < 4 || y < 4 || x > WORLD.width - 4 || y > WORLD.height - 4) return true;
      if (x > WATER_X && !(x > PIER.x && x < PIER.x + PIER.w && y > PIER.y && y < PIER.y + PIER.h)) return true;
      for (const b of buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
      }
      return false;
    },

    /** Push a circle (an object with x, y) out of every solid it overlaps; true if it hit anything. */
    collideCircle(e, radius) {
      let hit = false;
      for (const b of buildings) {
        const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
        const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
        const dx = e.x - nx;
        const dy = e.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        hit = true;
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * radius;
          e.y = ny + (dy / d) * radius;
        } else {
          // Centre inside the box: leave by the shallowest side.
          const left = e.x - b.x;
          const right = b.x + b.w - e.x;
          const top = e.y - b.y;
          const bottom = b.y + b.h - e.y;
          const min = Math.min(left, right, top, bottom);
          if (min === left) e.x = b.x - radius;
          else if (min === right) e.x = b.x + b.w + radius;
          else if (min === top) e.y = b.y - radius;
          else e.y = b.y + b.h + radius;
        }
      }
      const onPier = e.y > PIER.y && e.y < PIER.y + PIER.h && e.x < PIER.x + PIER.w + radius;
      if (e.x > WATER_X - radius) {
        if (onPier) {
          // On the deck: its end and its sides over the water act as railings.
          if (e.x > PIER.x + PIER.w - radius) { e.x = PIER.x + PIER.w - radius; hit = true; }
          if (e.x > WATER_X) {
            if (e.y < PIER.y + 8) { e.y = PIER.y + 8; hit = true; }
            if (e.y > PIER.y + PIER.h - 8) { e.y = PIER.y + PIER.h - 8; hit = true; }
          }
        } else if (e.x < WATER_X + 60) {
          e.x = WATER_X - radius;
          hit = true;
        }
      }
      if (e.x < radius) { e.x = radius; hit = true; }
      if (e.y < radius) { e.y = radius; hit = true; }
      if (e.x > WORLD.width - radius) { e.x = WORLD.width - radius; hit = true; }
      if (e.y > WORLD.height - radius) { e.y = WORLD.height - radius; hit = true; }
      return hit;
    },

    /** The centre of the road (avenue or street) nearest a point — where lost drivers aim. */
    nearestRoadPoint(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const a of AVENUES) { const d = Math.abs(x - a); if (d < bestD) { bestD = d; best = { x: a, y }; } }
      for (const s of STREETS) { const d = Math.abs(y - s); if (d < bestD) { bestD = d; best = { x, y: s }; } }
      return best;
    },

    /** A random point on a random road, with the direction of travel along it. */
    randomRoadPoint(rngFn) {
      if (rngFn() < 0.55) {
        const x = pick(rngFn, AVENUES);
        return { x, y: randRange(rngFn, 60, WORLD.height - 60), vertical: true };
      }
      const y = pick(rngFn, STREETS);
      return { x: randRange(rngFn, 60, 3000), y, vertical: false };
    },

    /** A random strolling point on a sidewalk beside the given road network. */
    randomSidewalkPoint(rngFn) {
      if (rngFn() < 0.5) {
        const a = pick(rngFn, AVENUES);
        return { x: a + pick(rngFn, [-1, 1]) * randRange(rngFn, ROAD_HALF + 8, WALK_HALF - 6), y: randRange(rngFn, 40, WORLD.height - 40) };
      }
      const s = pick(rngFn, STREETS);
      return { x: randRange(rngFn, 40, 3030), y: s + pick(rngFn, [-1, 1]) * randRange(rngFn, ROAD_HALF + 8, WALK_HALF - 6) };
    },
  };
  return world;
}

/** Is (x, y) inside the rectangle {x, y, w, h}? */
export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
