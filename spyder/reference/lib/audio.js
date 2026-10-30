/*
 * Spyder — procedural audio.
 *
 * No sound files: everything is synthesised with Web Audio, so the game
 * stays tiny and every effect can vary a little each time (repeated
 * identical samples are what make games sound cheap).
 *
 * The browser only allows audio after a user gesture, so `start()` is
 * called from the "Enter the room" button.
 */
(function () {
  'use strict';

  const S = window.Spyder;

  class Audio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.volume = { master: 0.8, sfx: 0.9, ambience: 0.55 };
    }

    start() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume.master;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.volume.sfx;
      this.sfxBus.connect(this.master);

      this.ambBus = this.ctx.createGain();
      this.ambBus.gain.value = this.volume.ambience;
      this.ambBus.connect(this.master);

      this.noiseBuffer = this.makeNoise(2);
      this.startAmbience();
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume.master, this.ctx.currentTime, 0.05);
      return this.muted;
    }

    makeNoise(seconds) {
      const length = this.ctx.sampleRate * seconds;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }

    noise({ duration, filter = 'bandpass', freq = 1000, q = 1, gain = 0.5, freqEnd = null, attack = 0.005, bus = this.sfxBus }) {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = this.ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.setValueAtTime(freq, t);
      if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(f).connect(g).connect(bus);
      src.start(t, Math.random() * 1.5);
      src.stop(t + duration + 0.05);
    }

    tone({ type = 'sine', freq, freqEnd = null, duration, gain = 0.3, attack = 0.005, delay = 0, bus = this.sfxBus }) {
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    }

    // One entry point for gameplay code: play('pop'), play('squish', 0.5) …
    play(name, amount = 1) {
      if (!this.ctx || this.muted) return;
      const v = S.clamp(amount, 0, 1.5);
      const jitter = () => 0.92 + Math.random() * 0.16;
      switch (name) {
        case 'pop': // vacuum blaster: compressed-air pop
          this.noise({ duration: 0.09, filter: 'highpass', freq: 1800, gain: 0.35 * v });
          this.tone({ type: 'sine', freq: 220 * jitter(), freqEnd: 90, duration: 0.08, gain: 0.35 * v });
          break;
        case 'squish': // spider hit: crunchy, wet
          this.noise({ duration: 0.18, filter: 'bandpass', freq: 900 * jitter(), freqEnd: 260, q: 2, gain: 0.55 * v });
          this.noise({ duration: 0.05, filter: 'highpass', freq: 4000, gain: 0.25 * v });
          this.tone({ type: 'triangle', freq: 140, freqEnd: 60, duration: 0.14, gain: 0.3 * v });
          break;
        case 'rip': // web tearing like old fabric
          for (let i = 0; i < 5; i++) {
            setTimeout(() => this.noise({ duration: 0.04, filter: 'bandpass', freq: 2500 + Math.random() * 2500, q: 3, gain: 0.18 * v }), i * 18);
          }
          break;
        case 'snip': // silk cut above a spider
          this.tone({ type: 'triangle', freq: 1900 * jitter(), freqEnd: 900, duration: 0.12, gain: 0.18 * v });
          break;
        case 'plop':
          this.tone({ type: 'sine', freq: 300, freqEnd: 120, duration: 0.12, gain: 0.25 * v });
          break;
        case 'hatch': // sticky crackle
          for (let i = 0; i < 7; i++) {
            setTimeout(() => this.noise({ duration: 0.03, filter: 'bandpass', freq: 1200 + Math.random() * 1500, q: 6, gain: 0.2 * v }), i * 35);
          }
          break;
        case 'creak': // old wood, pitched slowly
          this.tone({ type: 'sawtooth', freq: 70 * jitter(), freqEnd: 52, duration: 0.7, gain: 0.05 * v, attack: 0.2, bus: this.ambBus });
          break;
        case 'hiss':
          this.noise({ duration: 0.35, filter: 'highpass', freq: 3500, gain: 0.18 * v, attack: 0.05 });
          break;
        case 'hurt':
          this.tone({ type: 'square', freq: 330, freqEnd: 180, duration: 0.18, gain: 0.08 * v });
          break;
        case 'stomp':
          this.tone({ type: 'sine', freq: 160, freqEnd: 50, duration: 0.12, gain: 0.4 * v });
          this.noise({ duration: 0.08, filter: 'lowpass', freq: 600, gain: 0.3 * v });
          break;
        case 'stamp': // the work-order "CLEAN" stamp
          this.tone({ type: 'sine', freq: 120, freqEnd: 40, duration: 0.2, gain: 0.5 * v });
          this.noise({ duration: 0.12, filter: 'lowpass', freq: 900, gain: 0.4 * v });
          break;
        case 'chime': { // a light switching on, warm bell tone
          const f = 440 * Math.pow(2, (amount * 12 | 0) / 12);
          this.tone({ type: 'sine', freq: f, duration: 1.6, gain: 0.12 });
          this.tone({ type: 'sine', freq: f * 2.01, duration: 1.0, gain: 0.04 });
          break;
        }
        case 'sweep': // the makeover wave of clean air
          this.noise({ duration: 1.3, filter: 'bandpass', freq: 400, freqEnd: 5000, q: 0.8, gain: 0.25, attack: 0.4 });
          break;
        case 'tick':
          this.noise({ duration: 0.02, filter: 'highpass', freq: 5000, gain: 0.1 * v, bus: this.ambBus });
          break;
      }
    }

    // ── Ambience ──────────────────────────────────────────────────────

    startAmbience() {
      const t = this.ctx.currentTime;
      // A low, slightly sour drone: two detuned tones through a dark filter.
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0;
      this.droneGain.gain.linearRampToValueAtTime(0.16, t + 3);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      this.droneOscs = [55, 82.4, 58.3].map((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 1 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(this.droneGain).connect(this.ambBus);

      // Wind through the window frame.
      const wind = this.ctx.createBufferSource();
      wind.buffer = this.makeNoise(4);
      wind.loop = true;
      const wf = this.ctx.createBiquadFilter();
      wf.type = 'bandpass';
      wf.frequency.value = 500;
      wf.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoAmount = this.ctx.createGain();
      lfoAmount.gain.value = 0.04;
      lfo.connect(lfoAmount).connect(this.windGain.gain);
      lfo.start();
      wind.connect(wf).connect(this.windGain).connect(this.ambBus);
      wind.start();

      this.padGain = null;
    }

    // Called once when the room is restored: drone fades, a warm chord
    // comes in, and birds start outside.
    resolve() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.droneGain.gain.setTargetAtTime(0, t, 1.2);
      this.windGain.gain.setTargetAtTime(0.015, t, 1.5);

      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0;
      this.padGain.gain.setTargetAtTime(0.06, t + 0.5, 1.2);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      // A major-seventh chord: open and warm, a bit wistful.
      [261.6, 329.6, 392, 493.9].forEach((f) => {
        for (const detune of [-4, 4]) {
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          o.detune.value = detune;
          o.connect(lp);
          o.start();
        }
      });
      lp.connect(this.padGain).connect(this.ambBus);

      const chirp = () => {
        if (!this.ctx || this.muted) return;
        const base = 2400 + Math.random() * 1200;
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'sine', freq: base, freqEnd: base * 1.3, duration: 0.08, gain: 0.04, delay: i * 0.11, bus: this.ambBus });
        }
        this.birdTimer = setTimeout(chirp, 2500 + Math.random() * 4000);
      };
      this.birdTimer = setTimeout(chirp, 2200);
    }
  }

  S.Audio = Audio;
})();
