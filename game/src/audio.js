// All of Ashwing's sound is synthesised in WebAudio: no audio files.
// Short oscillator-and-noise effects for shots, hits and explosions, and
// a small procedural music loop — a driving bass line with a sparse arp
// on top, in A minor — scheduled a step ahead of the beat so it holds
// time without a timer thread of its own.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this.nextNoteAt = 0;
    this.step = 0;
  }

  /** Create the context on the first user gesture (browser policy). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freqA, freqB, dur, type = 'square', vol = 0.2, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.3, cutoff = 1200, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  shoot() { this.tone(880, 320, 0.08, 'square', 0.07); }
  missile() { this.noise(0.18, 0.06, 2400); }
  enemyHit() { this.tone(220, 180, 0.04, 'sawtooth', 0.05); }
  boom(size = 1) {
    this.noise(0.28 * size, 0.22, 900);
    this.tone(140, 40, 0.3 * size, 'triangle', 0.25);
  }
  playerDown() {
    this.noise(0.7, 0.35, 700);
    this.tone(320, 30, 0.8, 'sawtooth', 0.3);
  }
  pickup() { this.tone(660, 660, 0.07, 'sine', 0.18); this.tone(990, 990, 0.1, 'sine', 0.18, 0.07); }
  powerup() {
    this.tone(523, 523, 0.07, 'square', 0.14);
    this.tone(659, 659, 0.07, 'square', 0.14, 0.07);
    this.tone(784, 784, 0.12, 'square', 0.14, 0.14);
  }
  bomb() {
    this.noise(1.0, 0.4, 500);
    this.tone(90, 24, 1.0, 'sine', 0.4);
  }
  alarm() {
    this.tone(392, 392, 0.16, 'square', 0.16);
    this.tone(311, 311, 0.16, 'square', 0.16, 0.18);
    this.tone(392, 392, 0.16, 'square', 0.16, 0.36);
    this.tone(311, 311, 0.3, 'square', 0.16, 0.54);
  }
  shieldPop() { this.tone(1200, 300, 0.15, 'sine', 0.2); }

  // --- music: 8th-note steps at 116 BPM, bass on every step, arp sparse ---

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteAt = this.ctx.currentTime + 0.06;
  }

  stopMusic() { this.musicOn = false; }

  /** Called every frame; schedules the steps that fall in the next 150 ms. */
  pumpMusic() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const stepDur = 60 / 116 / 2;
    while (this.nextNoteAt < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextNoteAt - this.ctx.currentTime);
      this.nextNoteAt += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, when) {
    // A-minor drive: Am Am F G over four bars of 16 steps.
    const roots = [55, 55, 43.65, 49]; // A1, A1, F1, G1
    const bar = Math.floor(step / 16);
    const root = roots[bar];
    if (step % 2 === 0) this.tone(root * 2, root * 2, 0.16, 'sawtooth', 0.10, when);
    if (step % 8 === 4) this.tone(root, root, 0.3, 'triangle', 0.16, when);
    const arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63];
    if (step % 4 === 2) {
      const n = arpNotes[Math.floor(step / 4) % arpNotes.length] * (bar === 2 ? 0.89 : bar === 3 ? 0.99 : 1);
      this.tone(n, n, 0.12, 'square', 0.045, when);
    }
    if (step % 16 === 0) this.noise(0.05, 0.05, 6000, when);
    if (step % 16 === 8) this.noise(0.09, 0.09, 3000, when);
  }
}
