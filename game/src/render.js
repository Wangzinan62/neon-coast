// NEON COAST — the renderer. The city that never moves (roads, sidewalks, buildings with
// their lit windows and neon signs, the park, the lot, the beach) is painted once into a
// full-map offscreen canvas; each frame then draws the animated sea, that static layer, lamp
// glow, the objective beacon, and every living thing, all through one camera that follows the
// player. Screen-space overlays (HUD, menus) are hud.js's job, drawn after this.
import { PALETTE, VIEW, WATER_X, WORLD } from './config.js';
import { createRandom } from './random.js';
import { ROAD_HALF, WALK_HALF } from './world.js';
import { objectivePoint } from './game.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The camera: a VIEW-sized window on the world, centred on the player, clamped to the map. */
export function cameraFor(state) {
  const p = state.player;
  const x = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
  const y = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
  return { x, y };
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Windows on a building's south face: rows of small lit panes, seeded so they never change. */
function drawWindows(ctx, b, lift) {
  const rng = createRandom(b.seed);
  const cols = Math.max(2, Math.floor(b.w / 24));
  const rows = b.floors;
  const cw = b.w / cols;
  const rh = lift / Math.max(1, rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng() < 0.52;
      ctx.fillStyle = lit ? 'rgba(255, 205, 110, 0.92)' : 'rgba(24, 22, 38, 0.85)';
      ctx.fillRect(b.x + c * cw + cw * 0.28, b.y + b.h - lift + r * rh + rh * 0.3, cw * 0.44, Math.max(2.5, rh * 0.42));
    }
  }
}

/** One building: a shadow, a south face with windows, a roof with clutter, a neon sign if named. */
function drawBuilding(ctx, b) {
  const lift = 7 + b.floors * 3.2;
  ctx.fillStyle = 'rgba(8, 6, 18, 0.4)';
  ctx.fillRect(b.x + 12, b.y + 16, b.w, b.h);
  // South face (the extruded side) in a darkened body colour, then the roof on top of it.
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(b.x, b.y + b.h - lift, b.w, lift);
  drawWindows(ctx, b, lift);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y - lift, b.w, b.h - lift + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 3, b.y - lift + 3, b.w - 6, b.h - lift - 4);
  // Roof clutter from the building's own seed: air-conditioning boxes, a water tank, vents.
  const rng = createRandom(b.seed ^ 0x9e3779b9);
  const units = 1 + Math.floor(rng() * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < units; i += 1) {
    const uw = 14 + rng() * 22;
    const uh = 10 + rng() * 16;
    ctx.fillRect(b.x + 10 + rng() * Math.max(4, b.w - uw - 20), b.y - lift + 8 + rng() * Math.max(4, b.h - lift - uh - 16), uw, uh);
  }
  if (b.name) {
    const label = b.name;
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 22;
    const sx = b.x + b.w / 2 - tw / 2;
    const sy = b.y + b.h - lift - 24;
    ctx.save();
    ctx.shadowColor = b.signColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(10, 8, 22, 0.88)';
    roundedRect(ctx, sx, sy, tw, 21, 5);
    ctx.fill();
    ctx.fillStyle = b.signColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, sy + 11);
    ctx.restore();
  }
}

/** Paint everything that never moves into one full-map canvas. Done once per world. */
function buildStaticLayer(state) {
  const world = state.world;
  const c = document.createElement('canvas');
  c.width = WORLD.width;
  c.height = WORLD.height;
  const ctx = c.getContext('2d');

  // Base ground: city blocks in a dark plum, then the sand, then the promenade strip.
  ctx.fillStyle = PALETTE.blockBase;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(3072, 0, WATER_X - 3072, WORLD.height);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(WATER_X - 26, 0, 26, WORLD.height);
  ctx.fillStyle = '#4a4658';
  ctx.fillRect(2894, 0, 3072 - 2894, WORLD.height);

  // The park: grass with mow stripes and a crossing path.
  const park = world.park;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(park.x, park.y, park.w, park.h);
  ctx.fillStyle = PALETTE.grassDark;
  for (let x = park.x; x < park.x + park.w; x += 44) ctx.fillRect(x, park.y, 22, park.h);
  ctx.fillStyle = '#8a7a5c';
  ctx.fillRect(park.x, park.y + park.h / 2 - 13, park.w, 26);
  ctx.fillRect(park.x + park.w / 2 - 13, park.y, 26, park.h);

  // The parking lot: paler asphalt and stall lines.
  const lot = world.lot;
  ctx.fillStyle = '#333140';
  ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  ctx.strokeStyle = 'rgba(232,228,218,0.4)';
  ctx.lineWidth = 2;
  for (let x = lot.x + 26; x < lot.x + lot.w - 20; x += 78) {
    ctx.beginPath();
    ctx.moveTo(x, lot.y + 22);
    ctx.lineTo(x, lot.y + 118);
    ctx.moveTo(x, lot.y + lot.h - 118);
    ctx.lineTo(x, lot.y + lot.h - 22);
    ctx.stroke();
  }

  // Sidewalks first (the wide pale band), then the asphalt on top of them.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const a of world.avenues) ctx.fillRect(a - WALK_HALF, 0, WALK_HALF * 2, WORLD.height);
  for (const s of world.streets) ctx.fillRect(0, s - WALK_HALF, 3072, WALK_HALF * 2);
  ctx.fillStyle = PALETTE.asphalt;
  for (const a of world.avenues) ctx.fillRect(a - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.height);
  for (const s of world.streets) ctx.fillRect(0, s - ROAD_HALF, 3072, ROAD_HALF * 2);

  // Lane markings: edge lines, dashed lane lines, a double yellow centre on avenues.
  ctx.strokeStyle = 'rgba(232,228,218,0.5)';
  ctx.lineWidth = 2.5;
  for (const a of world.avenues) {
    for (const side of [-ROAD_HALF + 4, ROAD_HALF - 4]) {
      ctx.beginPath(); ctx.moveTo(a + side, 0); ctx.lineTo(a + side, WORLD.height); ctx.stroke();
    }
  }
  for (const s of world.streets) {
    for (const side of [-ROAD_HALF + 4, ROAD_HALF - 4]) {
      ctx.beginPath(); ctx.moveTo(0, s + side); ctx.lineTo(3072, s + side); ctx.stroke();
    }
  }
  ctx.strokeStyle = PALETTE.laneCentre;
  ctx.lineWidth = 3;
  for (const a of world.avenues) {
    for (const off of [-4, 4]) {
      ctx.beginPath(); ctx.moveTo(a + off, 0); ctx.lineTo(a + off, WORLD.height); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(232,228,218,0.55)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([26, 30]);
  for (const a of world.avenues) {
    for (const off of [-27, 27]) {
      ctx.beginPath(); ctx.moveTo(a + off, 0); ctx.lineTo(a + off, WORLD.height); ctx.stroke();
    }
  }
  for (const s of world.streets) {
    for (const off of [-27, 27]) {
      ctx.beginPath(); ctx.moveTo(0, s + off); ctx.lineTo(3072, s + off); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(207,212,220,0.5)';
  for (const a of world.avenues) {
    for (const s of world.streets) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(a + i * 20 - 6, s - ROAD_HALF - 14, 12, 10);
        ctx.fillRect(a + i * 20 - 6, s + ROAD_HALF + 4, 12, 10);
        ctx.fillRect(a - ROAD_HALF - 14, s + i * 20 - 6, 10, 12);
        ctx.fillRect(a + ROAD_HALF + 4, s + i * 20 - 6, 10, 12);
      }
    }
  }

  // The pier: planks over the water, with posts.
  const pier = world.pier;
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let x = pier.x + 16; x < pier.x + pier.w; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, pier.y); ctx.lineTo(x, pier.y + pier.h); ctx.stroke();
  }
  ctx.fillStyle = '#5d4429';
  for (let x = pier.x + 10; x < pier.x + pier.w; x += 54) {
    ctx.fillRect(x, pier.y - 5, 9, 9);
    ctx.fillRect(x, pier.y + pier.h - 4, 9, 9);
  }

  // Beach umbrellas.
  for (const u of world.umbrellas) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(u.x + 3, u.y + 4, 13 * u.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, 13 * u.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(u.x, u.y, 4.5 * u.s, 0, Math.PI * 2); ctx.fill();
  }

  // The Neon Spray drive-in bay, painted on the ground in front of the garage.
  const zone = world.places.sprayZone;
  ctx.fillStyle = 'rgba(255, 93, 162, 0.14)';
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  ctx.strokeStyle = '#ff5da2';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  ctx.setLineDash([]);
  ctx.font = '700 19px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,93,162,0.75)';
  ctx.textAlign = 'center';
  ctx.fillText('NEON SPRAY · DRIVE IN', zone.x + zone.w / 2, zone.y + zone.h / 2 + 6);

  // Buildings last among the statics: they sit on top of everything.
  for (const b of world.buildings) drawBuilding(ctx, b);
  return c;
}

function drawPalm(ctx, palm, time) {
  const sway = Math.sin(time * 0.9 + palm.x * 0.05 + palm.y * 0.03) * 2.2;
  ctx.strokeStyle = '#6e4f30';
  ctx.lineWidth = 4.5 * palm.s;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.quadraticCurveTo(palm.x + 3, palm.y - 9 * palm.s, palm.x + sway, palm.y - 15 * palm.s);
  ctx.stroke();
  ctx.strokeStyle = '#2f9e57';
  ctx.lineWidth = 3 * palm.s;
  const topX = palm.x + sway;
  const topY = palm.y - 15 * palm.s;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + palm.x;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * 13 * palm.s, topY + Math.sin(a) * 9 * palm.s - 3,
      topX + Math.cos(a) * 21 * palm.s, topY + Math.sin(a) * 14 * palm.s + 4,
    );
    ctx.stroke();
  }
}

function drawCar(ctx, car, time) {
  const L = car.model.length;
  const W = 22;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(6,4,14,0.4)';
  roundedRect(ctx, -L / 2 + 3, -W / 2 + 5, L, W, 7);
  ctx.fill();
  const moving = Math.abs(car.speed) > 12 && !car.wreck;
  if (moving) {
    // Headlight cones in the dusk.
    const grad = ctx.createLinearGradient(L / 2, 0, L / 2 + 120, 0);
    grad.addColorStop(0, 'rgba(255,236,170,0.20)');
    grad.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(L / 2, -8);
    ctx.lineTo(L / 2 + 120, -30);
    ctx.lineTo(L / 2 + 120, 30);
    ctx.lineTo(L / 2, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = car.wreck ? '#3a3a42' : car.color;
  roundedRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin and glass.
  ctx.fillStyle = 'rgba(16,20,34,0.9)';
  roundedRect(ctx, -L * 0.16, -W / 2 + 3.5, L * 0.36, W - 7, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,190,230,0.75)';
  roundedRect(ctx, L * 0.13, -W / 2 + 4.5, L * 0.09, W - 9, 3);
  ctx.fill();
  if (car.modelKey === 'taxi') {
    ctx.fillStyle = '#17141f';
    roundedRect(ctx, -6, -5, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '700 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2.5);
  }
  if (car.modelKey === 'police') {
    ctx.fillStyle = '#171a26';
    roundedRect(ctx, -L / 2 + 2, -W / 2 + 1.5, 13, W - 3, 5);
    ctx.fill();
    roundedRect(ctx, L / 2 - 15, -W / 2 + 1.5, 13, W - 3, 5);
    ctx.fill();
    const phase = Math.floor(time * 4.5) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b4e' : '#5b2b33';
    roundedRect(ctx, -7, -W / 2 + 2, 6.5, W - 4, 2);
    ctx.fill();
    ctx.fillStyle = phase ? '#274b9e' : '#3fa9ff';
    roundedRect(ctx, 0.5, -W / 2 + 2, 6.5, W - 4, 2);
    ctx.fill();
  }
  // Lights: white at the nose, red at the tail.
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(L / 2 - 2.5, -W / 2 + 3, 2.5, 4.5);
  ctx.fillRect(L / 2 - 2.5, W / 2 - 7.5, 2.5, 4.5);
  ctx.fillStyle = '#ff4455';
  ctx.fillRect(-L / 2, -W / 2 + 3, 2.5, 4.5);
  ctx.fillRect(-L / 2, W / 2 - 7.5, 2.5, 4.5);
  ctx.restore();
  if (car.marked) {
    const bob = Math.sin(time * 4) * 4;
    ctx.save();
    ctx.shadowColor = '#ffc62e';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffc62e';
    ctx.beginPath();
    ctx.moveTo(car.x, car.y - 40 + bob);
    ctx.lineTo(car.x + 9, car.y - 28 + bob);
    ctx.lineTo(car.x, car.y - 16 + bob);
    ctx.lineTo(car.x - 9, car.y - 28 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPerson(ctx, x, y, angle, shirt, skin, opts = {}) {
  ctx.fillStyle = 'rgba(6,4,14,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (opts.down) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.fillStyle = shirt;
    roundedRect(ctx, -13, -6, 26, 12, 6);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(15, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(x, y, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, 5.2, 0, Math.PI * 2);
  ctx.fill();
  if (opts.gun) {
    ctx.strokeStyle = '#14161f';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 16, y + Math.sin(angle) * 16);
    ctx.stroke();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let staticLayer = null;
  let camera = { x: 0, y: 0 };

  function drawWorld(state) {
    if (!staticLayer) staticLayer = buildStaticLayer(state);
    camera = cameraFor(state);
    const time = state.time;

    // The sea first: deep blue with slow light bands and a foam edge at the shore.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const seaLeft = Math.max(0, WATER_X - camera.x);
    if (seaLeft < VIEW.width) {
      ctx.fillStyle = PALETTE.waterLight;
      for (let y = -40; y < VIEW.height + 40; y += 52) {
        const off = Math.sin(time * 0.6 + y * 0.05) * 14;
        ctx.globalAlpha = 0.16;
        ctx.fillRect(seaLeft + off, y, VIEW.width - seaLeft, 13);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.foam;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= VIEW.height; y += 16) {
        const wx = WATER_X - camera.x + Math.sin(time * 1.4 + (y + camera.y) * 0.045) * 5;
        if (y === 0) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }

    // The baked city.
    ctx.drawImage(staticLayer, camera.x, camera.y, VIEW.width, VIEW.height, 0, 0, VIEW.width, VIEW.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Lamp glow pooling on the streets.
    ctx.fillStyle = 'rgba(255, 196, 110, 0.10)';
    for (const lamp of state.world.lamps) {
      if (lamp.x < camera.x - 60 || lamp.x > camera.x + VIEW.width + 60 || lamp.y < camera.y - 60 || lamp.y > camera.y + VIEW.height + 60) continue;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of state.world.palms) {
      if (palm.x < camera.x - 40 || palm.x > camera.x + VIEW.width + 40 || palm.y < camera.y - 40 || palm.y > camera.y + VIEW.height + 40) continue;
      drawPalm(ctx, palm, time);
    }

    // The objective beacon: a column of gold light with a bobbing diamond.
    const target = objectivePoint(state);
    if (target) {
      const pulse = 0.5 + Math.sin(time * 3.2) * 0.5;
      const grad = ctx.createLinearGradient(0, target.y - 190, 0, target.y);
      grad.addColorStop(0, 'rgba(255,198,46,0)');
      grad.addColorStop(1, `rgba(255,198,46,${0.24 + pulse * 0.12})`);
      ctx.fillStyle = grad;
      ctx.fillRect(target.x - 13, target.y - 190, 26, 190);
      ctx.strokeStyle = `rgba(255,198,46,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 20 + pulse * 7, 0, Math.PI * 2);
      ctx.stroke();
      const bob = Math.sin(time * 3.2) * 5;
      ctx.save();
      ctx.shadowColor = '#ffc62e';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffc62e';
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 52 + bob);
      ctx.lineTo(target.x + 11, target.y - 38 + bob);
      ctx.lineTo(target.x, target.y - 24 + bob);
      ctx.lineTo(target.x - 11, target.y - 38 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Living things, in the order the eye expects: cars, people, bullets, sparks.
    for (const car of state.cars) {
      if (car.x < camera.x - 90 || car.x > camera.x + VIEW.width + 90 || car.y < camera.y - 90 || car.y > camera.y + VIEW.height + 90) continue;
      drawCar(ctx, car, time);
    }
    for (const ped of state.peds) {
      const alpha = ped.state === 'down' ? Math.max(0, 1 - Math.max(0, ped.downT - 2.6) / 1.4) : 1;
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, { down: ped.state === 'down', alpha });
    }
    for (const off of state.officers) {
      drawPerson(ctx, off.x, off.y, off.angle, '#232c52', '#d9a05f', { down: off.state === 'down', gun: off.state === 'shoot', alpha: off.state === 'down' ? Math.max(0, 1 - Math.max(0, off.downT - 2.6) / 1.4) : 1 });
      if (off.state !== 'down') {
        ctx.fillStyle = '#7aa2ff';
        ctx.beginPath();
        ctx.arc(off.x, off.y - 2, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const p = state.player;
    if (!p.car) {
      drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, '#f2c9a0', { gun: true });
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // A chevron over the player's own car, so it is never lost in traffic.
      const bob = Math.sin(time * 4.4) * 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 34 + bob);
      ctx.lineTo(p.x + 8, p.y - 44 + bob);
      ctx.lineTo(p.x - 8, p.y - 44 + bob);
      ctx.closePath();
      ctx.fill();
    }
    // Tracers.
    ctx.lineCap = 'round';
    for (const b of state.bullets) {
      ctx.strokeStyle = 'rgba(255, 226, 140, 0.9)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles: smoke, sparks and flashes share one shape, fading as they age.
    for (const pt of state.particles) {
      const a = Math.max(0, 1 - pt.life / pt.maxLife);
      ctx.fillStyle = `${pt.color}${(a * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Dusk itself: violet shade from the top, a breath of orange along the bottom.
    const shade = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    shade.addColorStop(0, 'rgba(38, 16, 78, 0.20)');
    shade.addColorStop(0.45, 'rgba(38, 16, 78, 0)');
    shade.addColorStop(1, 'rgba(255, 110, 50, 0.07)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  return {
    drawWorld,
    get camera() { return camera; },
  };
}
