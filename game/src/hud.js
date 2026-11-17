// NEON COAST — everything drawn on the glass: the HUD (cash, health, wanted stars, weapon,
// objective, busted meter), the live minimap, the phone that missions arrive on, centre
// banners, and the full screens — title, pause, FLATLINED and BUSTED. The world itself is
// render.js's work; this file only reads the state and talks to the player.
import { FONT, PALETTE, VIEW, WATER_X, WORLD } from './config.js';
import { objectivePoint } from './game.js';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  roundedRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Wrap a line of text to a width, returning at most `maxLines` lines. */
function wrap(ctx, text, width, maxLines = 3) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else line = next;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawStar(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffc62e';
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

const MAP = { x: 18, y: VIEW.height - 148, w: 196, h: 130 };

function drawMinimap(ctx, state) {
  const { x, y, w, h } = MAP;
  panel(ctx, x - 4, y - 4, w + 8, h + 8);
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  const px = (wx) => x + wx * sx;
  const py = (wy) => y + wy * sy;
  ctx.save();
  roundedRect(ctx, x, y, w, h, 7);
  ctx.clip();
  ctx.fillStyle = '#211d2e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(px(WATER_X), y, w - WATER_X * sx, h);
  ctx.fillStyle = PALETTE.grass;
  const park = state.world.park;
  ctx.fillRect(px(park.x), py(park.y), park.w * sx, park.h * sy);
  ctx.strokeStyle = 'rgba(210,205,225,0.5)';
  ctx.lineWidth = 1.6;
  for (const a of state.world.avenues) {
    ctx.beginPath(); ctx.moveTo(px(a), y); ctx.lineTo(px(a), y + h); ctx.stroke();
  }
  for (const s of state.world.streets) {
    ctx.beginPath(); ctx.moveTo(x, py(s)); ctx.lineTo(x + w, py(s)); ctx.stroke();
  }
  // The spray garage, the one pink dot worth knowing.
  const zone = state.world.places.sprayZone;
  ctx.fillStyle = '#ff5da2';
  ctx.fillRect(px(zone.x + zone.w / 2) - 2.5, py(zone.y + zone.h / 2) - 2.5, 5, 5);
  // Police, as blue dots.
  ctx.fillStyle = '#5b8cff';
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    ctx.beginPath(); ctx.arc(px(car.x), py(car.y), 2.6, 0, Math.PI * 2); ctx.fill();
  }
  for (const off of state.officers) {
    ctx.beginPath(); ctx.arc(px(off.x), py(off.y), 2.2, 0, Math.PI * 2); ctx.fill();
  }
  // The objective, a pulsing gold diamond.
  const target = objectivePoint(state);
  if (target) {
    const pulse = 3.4 + Math.sin(state.time * 4) * 1.1;
    ctx.fillStyle = PALETTE.marker;
    ctx.save();
    ctx.translate(px(target.x), py(target.y));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.43, pulse * 1.43);
    ctx.restore();
  }
  // The player: a white arrow that turns with them.
  const p = state.player;
  ctx.save();
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function stageLabel(state) {
  const ms = state.mission;
  const m = state.missions[ms.index];
  if (!m || state.freeRoam) return state.freeRoam ? 'Free roam — the city is yours' : '';
  if (ms.phase === 'intro') return `${m.name} — check your phone`;
  if (ms.phase !== 'active') return '';
  const stage = m.stages[ms.stage];
  return stage ? stage.label : '';
}

function drawHud(ctx, state) {
  const p = state.player;
  // Cash and health, top left.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 27px ${FONT}`;
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 20, 38);
  ctx.fillStyle = 'rgba(10,8,22,0.55)';
  roundedRect(ctx, 20, 48, 168, 13, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#7be382' : PALETTE.danger;
  if (p.hp > 0) {
    roundedRect(ctx, 20, 48, 168 * Math.max(0, p.hp) / 100, 13, 6);
    ctx.fill();
  }
  ctx.font = `600 11.5px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(p.car ? `${p.car.model.name} · ${Math.round(Math.abs(p.car.speed) * 0.24)} mph` : 'ON FOOT', 20, 76);

  // Wanted stars, top right — the active ones gold, the rest outlined.
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, VIEW.width - 34 - i * 37, 36, 15, i < state.wanted.stars);
  }
  if (state.wanted.stars > 0) {
    ctx.font = `600 11.5px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'right';
    ctx.fillText('NCPD HEAT', VIEW.width - 20, 66);
    ctx.textAlign = 'left';
  }

  // The objective, top centre, with the mission timer under it when one runs.
  const label = stageLabel(state);
  if (label) {
    ctx.font = `600 15.5px ${FONT}`;
    const w = Math.min(620, ctx.measureText(label).width + 36);
    panel(ctx, VIEW.width / 2 - w / 2, 16, w, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, 38);
    ctx.textAlign = 'left';
    if (state.mission.timer !== null && state.mission.phase === 'active') {
      const t = Math.max(0, state.mission.timer);
      const text = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      ctx.font = `800 21px ${FONT}`;
      ctx.fillStyle = t < 30 ? PALETTE.danger : PALETTE.marker;
      ctx.textAlign = 'center';
      ctx.fillText(text, VIEW.width / 2, 76);
      ctx.textAlign = 'left';
    }
  }

  // Weapon and vehicle state, bottom right.
  ctx.textAlign = 'right';
  if (p.car) {
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(p.car.model.name.toUpperCase(), VIEW.width - 20, VIEW.height - 44);
    ctx.fillStyle = 'rgba(10,8,22,0.55)';
    roundedRect(ctx, VIEW.width - 168, VIEW.height - 36, 148, 10, 5);
    ctx.fill();
    ctx.fillStyle = p.car.hp > 35 ? '#e8e4da' : PALETTE.danger;
    if (p.car.hp > 0) {
      roundedRect(ctx, VIEW.width - 168, VIEW.height - 36, 148 * p.car.hp / 100, 10, 5);
      ctx.fill();
    }
    ctx.font = `600 11.5px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('E — GET OUT', VIEW.width - 20, VIEW.height - 48 - 14);
  } else {
    ctx.font = `700 16px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`PISTOL · ${p.reloading > 0 ? 'RELOADING' : `${p.ammo} / 12`}`, VIEW.width - 20, VIEW.height - 24);
  }
  ctx.textAlign = 'left';

  drawMinimap(ctx, state);

  // The bust meter, centre bottom: the law's hand closing.
  if (state.bustedMeter > 0.02) {
    const w = 300;
    panel(ctx, VIEW.width / 2 - w / 2, VIEW.height - 128, w, 30);
    ctx.fillStyle = PALETTE.danger;
    roundedRect(ctx, VIEW.width / 2 - w / 2 + 5, VIEW.height - 123, (w - 10) * state.bustedMeter, 20, 5);
    ctx.fill();
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', VIEW.width / 2, VIEW.height - 109);
    ctx.textAlign = 'left';
  }

  // The phone: mission dialogues arrive here, one message at a time.
  if (state.dialog) {
    const line = state.dialog.lines[state.dialog.index];
    if (line) {
      const w = 600;
      const x = VIEW.width / 2 - w / 2;
      const y = VIEW.height - 118;
      panel(ctx, x, y, w, 96);
      ctx.fillStyle = '#101828';
      roundedRect(ctx, x + 12, y + 12, 40, 40, 20);
      ctx.fill();
      ctx.font = `800 19px ${FONT}`;
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'center';
      ctx.fillText(line.who.charAt(0), x + 32, y + 39);
      ctx.textAlign = 'left';
      ctx.font = `700 13.5px ${FONT}`;
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(line.who.toUpperCase(), x + 64, y + 26);
      ctx.font = `400 15px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      const lines = wrap(ctx, line.text, w - 84, 3);
      lines.forEach((ln, i) => ctx.fillText(ln, x + 64, y + 48 + i * 19));
    }
  }

  // Centre banners: mission complete, spray visits, warnings.
  if (state.banner) {
    const b = state.banner;
    const fade = Math.min(1, Math.min(b.t / 0.3, (b.max - b.t) / 0.5));
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.shadowColor = '#ffc62e';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(b.title, VIEW.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(b.sub, VIEW.width / 2, 198);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // A hint when the player stands at a car door.
  if (!p.car && !state.dialog) {
    for (const car of state.cars) {
      if (!car.wreck && Math.hypot(car.x - p.x, car.y - p.y) < 58) {
        ctx.font = `700 14.5px ${FONT}`;
        ctx.fillStyle = 'rgba(10,8,22,0.7)';
        const text = `E — TAKE THE ${car.model.name.toUpperCase()}`;
        const w = ctx.measureText(text).width + 24;
        roundedRect(ctx, VIEW.width / 2 - w / 2, VIEW.height - 170, w, 28, 8);
        ctx.fill();
        ctx.fillStyle = PALETTE.text;
        ctx.textAlign = 'center';
        ctx.fillText(text, VIEW.width / 2, VIEW.height - 151);
        ctx.textAlign = 'left';
        break;
      }
    }
  }

  // Hurt flash.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 60, ${(p.hurtFlash * 0.55).toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function drawTitle(ctx, state, hasSave) {
  const grad = ctx.createLinearGradient(0, 0, VIEW.width, 0);
  grad.addColorStop(0, 'rgba(10, 6, 24, 0.88)');
  grad.addColorStop(0.55, 'rgba(10, 6, 24, 0.55)');
  grad.addColorStop(1, 'rgba(10, 6, 24, 0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.textAlign = 'left';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = '#22d3ee';
  ctx.fillText('W E L C O M E   T O', 84, 148);
  ctx.font = `900 118px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NEON', 78, 258);
  const gradText = ctx.createLinearGradient(330, 0, 700, 0);
  gradText.addColorStop(0, '#ff5da2');
  gradText.addColorStop(1, '#22d3ee');
  ctx.fillStyle = gradText;
  ctx.save();
  ctx.shadowColor = '#ff5da2';
  ctx.shadowBlur = 34;
  ctx.fillText('COAST', 388, 258);
  ctx.restore();
  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('A pocket open-world crime story — one city, five stars, no permission asked.', 84, 302);

  ctx.font = `600 15.5px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  const controls = [
    'WASD / ARROWS — walk & drive      SHIFT — run',
    'MOUSE — aim        CLICK — shoot        R — reload',
    'E — steal / enter / exit cars        ESC — pause        M — mute',
    'Follow the gold beacon. Outrun the stars. Spend at Neon Spray.',
  ];
  controls.forEach((line, i) => ctx.fillText(line, 84, 356 + i * 27));

  const blink = Math.floor(state.time * 1.6) % 2 === 0;
  ctx.font = `800 23px ${FONT}`;
  ctx.fillStyle = blink ? '#ffc62e' : '#c79a26';
  ctx.fillText(hasSave ? 'ENTER — NEW GAME        C — CONTINUE' : 'PRESS ENTER OR CLICK TO START', 84, 512);
  if (hasSave) {
    ctx.font = `600 14.5px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Continue picks up your cash, your corner of the city and your next job.', 84, 542);
  }
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = 'rgba(164,158,194,0.75)';
  ctx.fillText('An original game in an original city — every name, car and corner invented for Neon Coast.', 84, VIEW.height - 26);
}

function drawCentredWord(ctx, word, color, sub) {
  ctx.fillStyle = 'rgba(8, 5, 18, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.font = `900 92px ${FONT}`;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = color;
  ctx.fillText(word, VIEW.width / 2, VIEW.height / 2 - 8);
  ctx.restore();
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 38);
  ctx.textAlign = 'left';
}

/** Draw every screen-space layer for the current screen ('title' | 'play' | 'paused' | 'over'). */
export function drawInterface(ctx, state, screen, hasSave) {
  if (screen === 'title') {
    drawTitle(ctx, state, hasSave);
    return;
  }
  drawHud(ctx, state);
  if (state.gameOver === 'flatlined') {
    drawCentredWord(ctx, 'FLATLINED', '#ff5470', `${state.overInfo} · St. Lucia General patched you up`);
  } else if (state.gameOver === 'busted') {
    drawCentredWord(ctx, 'BUSTED', '#7aa2ff', `${state.overInfo} · The Harbor Precinct thanks you for your donation`);
  } else if (screen === 'paused') {
    drawCentredWord(ctx, 'PAUSED', '#f4f1ea', 'ESC — back to the streets · your progress saves itself');
  }
}
