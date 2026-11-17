// NEON COAST — sound from nothing: a tiny WebAudio synth, no audio files. Short shaped noise
// and oscillator blips stand in for gunshots, crashes, pickups and sirens. The context is only
// created after the player's first key press or click (browsers refuse it sooner), everything
// is wrapped so a silent machine simply plays a silent game, and M mutes the master gain.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A burst of filtered noise: gunshots, crashes, thuds — `freq` and `gain` set the size. */
  function noise({ seconds = 0.15, freq = 1200, gain = 0.5, type = 'lowpass', slideTo = null }) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + seconds);
  }

  /** One oscillator note with a quick envelope: blips, jingles, the spray booth's chime. */
  function tone({ freq = 440, seconds = 0.12, gain = 0.25, type = 'sine', at = 0, slideTo = null }) {
    if (!ensure()) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  const sounds = {
    shot() { noise({ seconds: 0.13, freq: 2600, gain: 0.5, type: 'bandpass', slideTo: 300 }); },
    click() { tone({ freq: 1400, seconds: 0.05, gain: 0.12, type: 'square' }); },
    hurt() { tone({ freq: 160, seconds: 0.16, gain: 0.3, type: 'sawtooth', slideTo: 70 }); },
    thud() { noise({ seconds: 0.12, freq: 300, gain: 0.5 }); },
    crash() { noise({ seconds: 0.3, freq: 900, gain: 0.55, slideTo: 120 }); },
    wreck() { noise({ seconds: 0.6, freq: 700, gain: 0.6, slideTo: 60 }); tone({ freq: 90, seconds: 0.5, gain: 0.3, type: 'sawtooth', slideTo: 40 }); },
    honk() { tone({ freq: 370, seconds: 0.16, gain: 0.16, type: 'square' }); tone({ freq: 370, seconds: 0.16, gain: 0.16, type: 'square', at: 0.22 }); },
    door() { noise({ seconds: 0.08, freq: 500, gain: 0.25 }); tone({ freq: 220, seconds: 0.07, gain: 0.12, type: 'triangle', at: 0.05 }); },
    pickup() { tone({ freq: 660, seconds: 0.09, gain: 0.22 }); tone({ freq: 990, seconds: 0.14, gain: 0.22, at: 0.08 }); },
    complete() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, seconds: 0.16, gain: 0.2, type: 'triangle', at: i * 0.09 })); },
    siren() { tone({ freq: 660, seconds: 0.34, gain: 0.1, type: 'triangle', slideTo: 990 }); tone({ freq: 990, seconds: 0.34, gain: 0.1, type: 'triangle', at: 0.34, slideTo: 660 }); },
    spray() { noise({ seconds: 0.5, freq: 4000, gain: 0.12, type: 'highpass' }); tone({ freq: 880, seconds: 0.2, gain: 0.15, type: 'triangle', at: 0.4 }); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, seconds: 0.22, gain: 0.2, type: 'square', at: i * 0.16 })); },
    flatline() { tone({ freq: 880, seconds: 0.9, gain: 0.18, type: 'sine' }); },
  };

  return {
    /** Play a named sound the game asked for; unknown names are ignored. */
    play(name) {
      // While the context is suspended (no gesture yet) sounds are dropped, never queued:
      // a queue would fire all at once the moment the player first clicks.
      if (ctx && ctx.state !== 'running') return;
      const fn = sounds[name];
      if (fn) fn();
    },
    /** Called on the first user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
