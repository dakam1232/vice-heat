// All sound is synthesised at runtime with WebAudio - no files, no network.
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineGain = null;
    this.engineOsc = [];
    this.sirenGain = null;
    this.noise = null;
    this.lastStep = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this._initEngine();
        this._initSiren();
      } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _initEngine() {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 760;
    g.connect(f).connect(this.master);
    for (const [type, detune] of [['sawtooth', 0], ['triangle', -8]]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = 70;
      o.detune.value = detune;
      o.connect(g);
      o.start();
      this.engineOsc.push(o);
    }
    this.engineGain = g;
  }

  _initSiren() {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 690;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.9;
    const depth = this.ctx.createGain();
    depth.gain.value = 180;
    lfo.connect(depth).connect(o.frequency);
    o.connect(g);
    o.start(); lfo.start();
    this.sirenGain = g;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  setEngine(speed, on) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.055 + Math.min(speed, 40) * 0.0022 : 0, t, 0.09);
    for (const o of this.engineOsc) o.frequency.setTargetAtTime(56 + Math.abs(speed) * 5.2, t, 0.08);
  }

  setSiren(on, nearby = 1) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.032 * nearby : 0, this.ctx.currentTime, 0.2);
  }

  _burst(dur, freq, q, vol, type = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(freq, dur, vol = 0.12, type = 'sine', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shot() { this._burst(0.16, 1500, 0.7, 0.28); this._tone(120, 0.14, 0.16, 'square'); }
  punch() { this._burst(0.1, 420, 1.1, 0.16, 'lowpass'); this._tone(95, 0.1, 0.1, 'triangle'); }
  crash() { this._burst(0.34, 260, 0.8, 0.34, 'lowpass'); this._tone(70, 0.26, 0.16, 'sawtooth'); }
  pickup() { this._tone(660, 0.1, 0.11); this._tone(990, 0.16, 0.11, 'sine', 0.09); }
  footstep() {
    const now = performance.now();
    if (now - this.lastStep < 240) return;
    this.lastStep = now;
    this._burst(0.06, 250, 1.4, 0.055, 'lowpass');
  }
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.24, 0.12, 'triangle', i * 0.11));
  }
  busted() { [330, 262, 196].forEach((f, i) => this._tone(f, 0.32, 0.15, 'sawtooth', i * 0.16)); }
  wasted() { [220, 165, 110].forEach((f, i) => this._tone(f, 0.42, 0.14, 'square', i * 0.18)); }
}
