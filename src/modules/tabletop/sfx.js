/**
 * 🔊 Masa sesleri — dosya yok, WebAudio ile anlık üretilir (kısa gürültü patlamaları + filtre).
 * AudioContext ilk kullanıcı etkileşiminde açılır; masa kapanınca close() ile bırakılır.
 */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noise = null;
    this.last = {};
  }

  _ensure() {
    if (this.muted) return false;
    if (!this.ctx) {
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch (e) {
        return false;
      }
      // 0.5 sn beyaz gürültü, tek sefer üretilir
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return true;
  }

  /** Aynı sesten çok sık çalmasın (zarlar yuvarlanırken) */
  _gate(key, ms) {
    const now = performance.now();
    if (now - (this.last[key] || 0) < ms) return false;
    this.last[key] = now;
    return true;
  }

  _burst({ freq, q = 1, dur = 0.08, gain = 0.3, type = "lowpass", attack = 0.002, tone = 0, toneFreq = 180 }) {
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.3, dur + 0.05);
    if (tone) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.frequency.setValueAtTime(toneFreq * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(toneFreq, t + dur);
      og.gain.setValueAtTime(tone, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(og).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  /** Nesne alındı */
  pick() {
    if (!this._ensure() || !this._gate("pick", 60)) return;
    this._burst({ freq: 2400, type: "bandpass", q: 2, dur: 0.05, gain: 0.12 });
  }

  /** Masaya çarpma. v = çarpma şiddeti (0..1), kind: die | card | piece */
  hit(v, kind = "piece") {
    if (!this._ensure() || !this._gate(`hit-${kind}`, 45)) return;
    const k = Math.min(1, Math.max(0.15, v));
    if (kind === "ball") this._burst({ freq: 3600 + Math.random() * 600, type: "bandpass", q: 1.6, dur: 0.05, gain: 0.4 * k, tone: 0.12 * k, toneFreq: 520 });
    else if (kind === "pin") this._burst({ freq: 900 + Math.random() * 300, type: "bandpass", q: 0.9, dur: 0.11, gain: 0.42 * k, tone: 0.16 * k, toneFreq: 190 });
    else if (kind === "puck") this._burst({ freq: 2100 + Math.random() * 400, type: "bandpass", q: 1.1, dur: 0.06, gain: 0.34 * k, tone: 0.1 * k, toneFreq: 320 });
    else if (kind === "die") this._burst({ freq: 1400 + Math.random() * 500, type: "bandpass", q: 1.5, dur: 0.07, gain: 0.35 * k, tone: 0.08 * k, toneFreq: 260 });
    else if (kind === "card") this._burst({ freq: 3200, type: "highpass", q: 0.7, dur: 0.045, gain: 0.16 * k });
    else this._burst({ freq: 700, dur: 0.08, gain: 0.3 * k, tone: 0.12 * k, toneFreq: 140 });
  }

  /** Kart / taş çevirme */
  flip() {
    if (!this._ensure() || !this._gate("flip", 80)) return;
    this._burst({ freq: 4500, type: "bandpass", q: 0.8, dur: 0.11, gain: 0.14, attack: 0.02 });
  }

  /** Deste karıştırma */
  shuffle() {
    if (!this._ensure() || !this._gate("shuffle", 300)) return;
    for (let i = 0; i < 7; i++) setTimeout(() => this.ctx && this._burst({ freq: 3600 + Math.random() * 1500, type: "bandpass", q: 0.9, dur: 0.05, gain: 0.1 }), i * 55);
  }

  /** El / dağıtım */
  deal() {
    if (!this._ensure() || !this._gate("deal", 70)) return;
    this._burst({ freq: 3000, type: "bandpass", q: 1.2, dur: 0.06, gain: 0.13 });
  }

  /** Vuruş / atış (istaka, bowling topu) */
  shot() {
    if (!this._ensure() || !this._gate("shot", 120)) return;
    this._burst({ freq: 1800, type: "bandpass", q: 1.2, dur: 0.07, gain: 0.34, tone: 0.18, toneFreq: 240 });
  }

  /** Kısa melodi: [frekans, başlangıç sn, süre] listesi */
  _melody(notes, gain = 0.16) {
    const c = this.ctx;
    const t0 = c.currentTime;
    for (const [f, at, dur] of notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(c.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.05);
    }
  }

  /** Gol */
  goal() {
    if (!this._ensure() || !this._gate("goal", 600)) return;
    this._melody([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.3]]);
  }

  /** Maç bitti */
  win() {
    if (!this._ensure() || !this._gate("win", 1500)) return;
    this._melody([[523, 0, 0.16], [659, 0.15, 0.16], [784, 0.3, 0.16], [1047, 0.45, 0.5]], 0.2);
  }

  close() {
    try {
      this.ctx?.close();
    } catch (e) {}
    this.ctx = null;
  }
}
