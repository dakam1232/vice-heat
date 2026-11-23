// Every sound is synthesized with WebAudio at runtime: no audio files, no network.
export class AudioKit {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.noise = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.34;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.ctx.currentTime, 0.02);
  }

  tone(freq, dur, type = 'sine', volume = 0.2, sweep = 0) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + sweep), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  burst(dur, volume = 0.2, filterFreq = 1200, type = 'lowpass') {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  engine(speed, inCar) {
    if (this.muted || !this.ensure()) return;
    if (!this.engineNodes) {
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      sub.type = 'square';
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      gain.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      sub.start();
      this.engineNodes = { osc, sub, gain, filter };
    }
    const now = this.ctx.currentTime;
    const active = inCar ? 1 : 0;
    const rpm = 55 + Math.abs(speed) * 4.1;
    this.engineNodes.osc.frequency.setTargetAtTime(rpm, now, 0.08);
    this.engineNodes.sub.frequency.setTargetAtTime(rpm * 0.5, now, 0.08);
    this.engineNodes.filter.frequency.setTargetAtTime(300 + Math.abs(speed) * 26, now, 0.1);
    this.engineNodes.gain.gain.setTargetAtTime(active * 0.085, now, 0.14);
  }

  policeSiren(active) {
    if (this.muted || !this.ensure()) return;
    if (!this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 620;
      lfo.frequency.value = 1.8;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(osc.frequency);
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, gain };
    }
    this.sirenNodes.gain.gain.setTargetAtTime(active ? 0.052 : 0, this.ctx.currentTime, 0.3);
  }

  gunshot() { this.burst(0.16, 0.34, 2600, 'highpass'); this.tone(110, 0.18, 'square', 0.18, -60); }
  punch() { this.burst(0.1, 0.16, 700); }
  pickup() { this.tone(660, 0.1, 'triangle', 0.2); setTimeout(() => this.tone(990, 0.2, 'triangle', 0.18), 90); }
  crash() { this.burst(0.42, 0.42, 480); this.tone(80, 0.3, 'sawtooth', 0.16, -40); }
  step() { this.burst(0.055, 0.055, 1500, 'bandpass'); }
  hurt() { this.tone(180, 0.22, 'sawtooth', 0.16, -90); }
  siren() { this.policeSiren(true); }
  complete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.26, 'triangle', 0.19), i * 120));
  }
  busted() { this.tone(240, 0.5, 'sawtooth', 0.2, -150); }
}
