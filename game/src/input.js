// NEON COAST — keyboard and mouse input. Held keys and the pointer are read as a continuous
// state every frame; one-shot presses (confirm, pause, interact, reload, mute) are queued as
// bit flags and taken once by the loop, so a press between two frames is never lost and never
// counted twice. The mouse position is tracked in view coordinates; main.js turns it into a
// world aim point through the camera.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
    held.add(event.code);
    if (!event.repeat) pressed.add(event.code);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    actions |= ACTION_CONFIRM;
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** Steering and walking axes from the held keys: each in -1..1. */
    axes() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    firing() {
      return mouse.down;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Was this specific key (a KeyboardEvent code) pressed since the last clearPressed? */
    pressed(code) {
      return pressed.has(code);
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
