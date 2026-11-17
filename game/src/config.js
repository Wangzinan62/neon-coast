// NEON COAST — every tuning number and colour in one place.
//
// The view is a fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. The world is a pixel map much larger than the view: a grid
// city of avenues and streets on the west, a beach and the sea on the east.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Logical view size the camera shows at once. */
export const VIEW = { width: 1280, height: 720 };

/** The whole map, in pixels. */
export const WORLD = { width: 3840, height: 2560 };

/** Where the sea starts: east of this x is water (the pier deck is the one way over it). */
export const WATER_X = 3340;

/** The seed the live game always builds its city from, so a saved game keeps its streets. */
export const WORLD_SEED = 20261;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  runSpeed: 292,
  maxHealth: 100,
  /** Pistol: shots a second while the trigger is held, rounds in a magazine, reload seconds. */
  fireInterval: 0.21,
  magazine: 12,
  reloadTime: 1.1,
  bulletDamage: 34,
};

export const CAR = {
  length: 46,
  width: 22,
  /** Health a fresh car starts with; crashes and bullets eat it, smoke starts under 35. */
  maxHealth: 100,
};

export const WANTED = {
  /** Heat needed for each star, first to fifth. */
  starHeat: [1, 120, 300, 540, 820],
  maxHeat: 1000,
  /** Heat a second lost once no police unit has seen the player for `seenGrace` seconds. */
  decayPerSecond: 11,
  seenGrace: 6,
  /** How close a crime must be to a witness (a pedestrian, an officer, a police car) to count. */
  witnessRadius: 300,
};

export const POLICE = {
  /** Police cars the force fields at each star count, one star to five. */
  carsPerStar: [0, 2, 3, 4, 5, 6],
  /** Officers on foot at each star count; they only take the street at three stars and up. */
  officersPerStar: [0, 0, 0, 2, 3, 4],
  spawnInterval: 2.2,
  /** Seconds of standing close and slow before the busted meter fills. */
  bustSeconds: 1.7,
};

export const ECONOMY = {
  sprayCost: 150,
  hospitalFee: 200,
  /** The fine on being busted: a base plus this much per star held at the time. */
  bustBase: 100,
  bustPerStar: 120,
};

/** Dusk over Neon Coast: deep violet shade, hot orange horizon light, neon signs on top. */
export const PALETTE = {
  sky: '#171126',
  asphalt: '#262430',
  asphaltEdge: '#3d3a4d',
  sidewalk: '#45424f',
  blockBase: '#322f3d',
  grass: '#2c5a38',
  grassDark: '#245031',
  sand: '#d9a05f',
  sandWet: '#c78f4e',
  water: '#14486b',
  waterLight: '#1d6a94',
  foam: '#bfe6ef',
  lane: '#e8e4da',
  laneCentre: '#f5b942',
  crosswalk: '#cfd4dc',
  player: '#19d3c5',
  police: '#2b4bd8',
  marker: '#ffc62e',
  text: '#f4f1ea',
  muted: '#a49ec2',
  danger: '#ff5470',
  cash: '#7be382',
  panel: 'rgba(16, 12, 30, 0.78)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-coast.save.v1';
