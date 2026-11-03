/**
 * @file Sound: everything synthesised with Web Audio, nothing sampled
 * (reference §6, ART-DIRECTION §11). The mix is quiet on purpose: this is a
 * game to play at night with headphones. The lighting instrument comes from
 * the theme; everything else is shared.
 *
 * The three volume sliders (Kolam) set `master`, `ambienceBus` (the drone
 * and the wind) and `notesBus` (lighting chimes, unchimes, bells and the
 * finale's chord). Both buses feed `dry`, so everything keeps the hall
 * reverb, and at the default levels the mix is exactly the reference's.
 */

class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.instrument = null;
    // Remembered until start() creates the real gain nodes, so main.js can
    // call setVolumes() at boot before the first user gesture starts audio.
    this.volumes = { master: 0.8, ambience: 0.6, notes: 0.8 };
  }

  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 6.0;
    limiter.ratio.value = 12.0;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    this.master.connect(limiter);
    limiter.connect(ctx.destination);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    }

    // A long, soft hall. Generated noise impulse, no files.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.4, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.34;
    this.reverb.connect(this.wet).connect(this.master);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.8;
    this.dry.connect(this.master);
    this.dry.connect(this.reverb);

    // The two level buses feed `dry`, so the chimes and the drone keep the hall.
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.dry);
    this.notesBus = ctx.createGain();
    this.notesBus.connect(this.dry);

    this.noise = this.noiseBuffer(2);
    this._applyVolumes(false);
    this.ambience();
  }

  /** The default master volume (0.8) keeps the reference mix: gain 0.9. */
  masterLevel() {
    return (0.9 * this.volumes.master) / 0.8;
  }

  /** Writes `this.volumes` onto the three bus gains, ramped or set directly. */
  _applyVolumes(ramp) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const masterTarget = this.enabled ? this.masterLevel() : 0;
    const ambienceTarget = this.volumes.ambience / 0.6;
    const notesTarget = this.volumes.notes / 0.8;
    if (ramp) {
      this.master.gain.setTargetAtTime(masterTarget, t, 0.15);
      this.ambienceBus.gain.setTargetAtTime(ambienceTarget, t, 0.15);
      this.notesBus.gain.setTargetAtTime(notesTarget, t, 0.15);
    } else {
      this.master.gain.value = masterTarget;
      this.ambienceBus.gain.value = ambienceTarget;
      this.notesBus.gain.value = notesTarget;
    }
  }

  /**
   * Settings volume sliders, applied immediately with a 0.15 s ramp; before
   * `start()` they are only remembered, and `start()` applies them.
   * @param {{ master?: number, ambience?: number, notes?: number }} volumes
   */
  setVolumes(volumes) {
    this.volumes = { ...this.volumes, ...volumes };
    this._applyVolumes(true);
  }

  /** The theme brings its own instrument for lighting (ARCHITECTURE §7.2). */
  setTheme(theme) {
    this.instrument = theme?.instrument ?? null;
    this.currentThemeId = theme?.id ?? null;
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = rate * seconds;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; // brown-ish
      d[i] = last * 3.2;
    }
    return buf;
  }

  /** `M`: mutes instantly everywhere. Returns whether sound is now on. */
  toggle() {
    this.enabled = !this.enabled;
    if (this.ctx) {
      const target = this.enabled ? this.masterLevel() : 0;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setValueAtTime(target, this.ctx.currentTime);
    }
    return this.enabled;
  }

  get ready() {
    return this.ctx && this.enabled;
  }

  // A low drone and a breath of wind. Very quiet on purpose.
  ambience() {
    const ctx = this.ctx;
    const pad = ctx.createGain();
    pad.gain.value = 0;
    pad.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 6);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 160;
    lfo.connect(lfoDepth).connect(filter.frequency);
    for (const [f, type, g] of [[73.42, 'sine', 1], [110, 'triangle', 0.5], [146.83, 'sine', 0.3], [73.9, 'sine', 0.6]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(filter);
      o.start();
    }
    filter.connect(pad).connect(this.ambienceBus);
    lfo.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.018;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.09;
    const wld = ctx.createGain();
    wld.gain.value = 0.012;
    wl.connect(wld).connect(wg.gain);
    wind.connect(band).connect(wg).connect(this.ambienceBus);
    wind.start();
    wl.start();
  }

  static GAINS = {
    lentera: 1.0,
    batu: 2.04,
    bintang: 1.633,
    candi: 1.547,
    'mata-air': 0.958,
  };

  /** A target lights: the theme's instrument plays its note, on the notes bus. */
  chime(freq, when = 0, level = 0.16) {
    if (!this.ready || !this.instrument) return;
    const gain = Sound.GAINS[this.currentThemeId] ?? 1.0;
    this.instrument.play({ ctx: this.ctx, dry: this.notesBus }, freq, when, level * gain);
  }

  /** The same note, muffled and short: an object leaving its target. */
  unchime(freq) {
    if (!this.ready || !this.instrument) return;
    this.instrument.mute({ ctx: this.ctx, dry: this.notesBus }, freq);
  }

  burst({ freq = 900, q = 0.8, type = 'lowpass', dur = 0.05, level = 0.05, rate = 1 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.dry);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  step() {
    this.burst({ freq: 1100 + Math.random() * 300, dur: 0.07, level: 0.07, rate: 1.6 });
  }

  scrape() {
    this.burst({ type: 'bandpass', freq: 360, q: 1.8, dur: 0.38, level: 0.16, rate: 0.7 });
    this.thump(64, 0.07, 0.3);
  }

  thump(freq = 90, level = 0.12, when = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + 0.25);
  }

  // Elevator settle: quiet stone knock (ART-DIRECTION §13.4).
  stoneKnock() {
    this.burst({ type: 'bandpass', freq: 180, q: 3, dur: 0.2, level: 0.06 });
    this.thump(70, 0.02);
  }

  // The little "hmph" when the wanderer complains to the player.
  hmph(when = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    [[430, 300, 0], [340, 240, 0.16]].forEach(([a, b, off]) => {
      const t = ctx.currentTime + when + off;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(a, t);
      o.frequency.exponentialRampToValueAtTime(b, t + 0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(lp).connect(g).connect(this.dry);
      o.start(t);
      o.stop(t + 0.16);
    });
  }

  // A single water drop into the stone basin.
  drip() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + 0.14);
  }

  // Old wood turning on its hinge.
  creak() {
    this.burst({ type: 'bandpass', freq: 520, q: 6, dur: 0.45, level: 0.05, rate: 0.5 });
  }

  // Wings beating as a crow takes off.
  flutter() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 2;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1700;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 17;
    const depth = ctx.createGain();
    depth.gain.value = 0.025;
    lfo.connect(depth).connect(g.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(f).connect(g).connect(env).connect(this.dry);
    src.start(t, Math.random());
    lfo.start(t);
    src.stop(t + 0.75);
    lfo.stop(t + 0.75);
  }

  rewind() {
    this.burst({ type: 'highpass', freq: 2200, q: 0.5, dur: 0.18, level: 0.03, rate: 2.4 });
  }

  /** Temple-bell partials alone (no rolled chord), on the notes bus — the
   * elevator's arrival (quiet, D3) and a floor's ring lighting (deep, D2). */
  bell(freq = 146.83, level = 0.07) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [ratio, amp] of [[1, 1], [2.42, 0.4], [3.9, 0.22], [5.4, 0.12], [0.5, 0.5]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5 / Math.sqrt(Math.max(ratio, 1)));
      o.connect(g).connect(this.notesBus);
      o.start(t);
      o.stop(t + 7);
    }
  }

  // Deep temple bell plus every lit note, rolled like a harp.
  finale(freqs) {
    if (!this.ready) return;
    this.bell(146.83, 0.14);
    [...freqs].sort((a, b) => a - b).forEach((f, i) => this.chime(f, 0.35 + i * 0.09, 0.1));
  }
}

/** The one shared audio engine. */
export const sound = new Sound();
