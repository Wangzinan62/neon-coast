// NEON COAST — boot and the one loop. Input is read every frame, the city advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between three screens — title, play, paused — while busts and
// flatlines are the simulation's own overlays. Progress saves itself as you play.
//
// ?seed=N builds the city from that seed (the live game always uses the same city, so a saved
// game keeps its streets). ?shot=title|drive|chase|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP, VIEW, WORLD_SEED } from './config.js';
import { createAudio } from './audio.js';
import { beginStory, clearSave, createGame, loadSave, saveGame, stepGame } from './game.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawInterface } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD_SEED;

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const state = createGame(seed);
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.drawWorld(state);
    drawInterface(ctx, state, scene.screen, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let save = loadSave();
  let state = createGame(WORLD_SEED, null);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let fireGuard = 0;
  let prevGameOver = null;

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    clearSave();
    save = null;
    state = createGame(WORLD_SEED, null);
    beginStory(state);
    screen = SCREEN_PLAY;
    fireGuard = 0.35;
    announce('Neon Coast. A new story begins.');
  }

  function startContinue() {
    state = createGame(WORLD_SEED, save);
    beginStory(state);
    screen = SCREEN_PLAY;
    fireGuard = 0.35;
    announce('Neon Coast. Welcome back.');
  }

  function buildFrame(actions) {
    const axes = input.axes();
    const cam = renderer.camera;
    const dialogOpen = state.dialog !== null;
    return {
      mx: axes.x,
      my: axes.y,
      run: input.running(),
      aimX: input.mouse.x + cam.x,
      aimY: input.mouse.y + cam.y,
      // A click that is busy advancing a phone conversation never fires the pistol.
      fire: input.firing() && !dialogOpen && fireGuard <= 0,
      interact: (actions & ACTION_INTERACT) !== 0,
      reload: (actions & ACTION_RELOAD) !== 0,
    };
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (input.pressed('KeyC') && save) startContinue();
      else if (actions & ACTION_CONFIRM) startNewGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (state.dialog && (actions & ACTION_CONFIRM)) {
      state.dialog.t = 999; // the step below moves the conversation on at once
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    fireGuard = Math.max(0, fireGuard - dt);
    audio.unlock();
    const actions = input.takeActions();
    handleActions(actions);

    if (screen === SCREEN_TITLE) {
      // The city lives behind its own title screen; the star of it cannot be hurt there.
      accumulator += dt;
      while (accumulator >= STEP) {
        stepGame(state, { mx: 0, my: 0, run: false, aimX: 0, aimY: 0, fire: false, interact: false, reload: false }, STEP);
        accumulator -= STEP;
      }
      state.player.hp = 100;
      if (state.gameOver) state.gameOver = null;
    } else if (screen === SCREEN_PLAY) {
      accumulator += dt;
      let first = true;
      while (accumulator >= STEP) {
        const frameInput = buildFrame(first ? actions : 0);
        stepGame(state, frameInput, STEP);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    // Sounds the simulation asked for, and the two it saves for the big moments.
    if (state.sounds.length > 0) {
      for (const name of state.sounds) audio.play(name);
      state.sounds.length = 0;
    }
    if (state.gameOver !== prevGameOver) {
      if (state.gameOver === 'busted') audio.play('busted');
      if (state.gameOver === 'flatlined') audio.play('flatline');
      prevGameOver = state.gameOver;
    }

    renderer.drawWorld(state);
    drawInterface(ctx, state, screen, save !== null);
    input.clearPressed();
  }

  // Leaving the tab pauses a running game and saves where the player stands.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
      if (state.started) saveGame(state);
    }
  });

  announce('Neon Coast. Press Enter or click to start a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
