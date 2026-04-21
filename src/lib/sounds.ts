export const soundEngine = {
  context: null as AudioContext | null,
  init() {
    if (!this.context) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) this.context = new Ctx();
    }
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  },
  playTone({ freq, type = 'sine', duration = 0.1, vol = 0.1, sweepFreq, sweepTime }: { freq: number, type?: OscillatorType, duration?: number, vol?: number, sweepFreq?: number, sweepTime?: number }) {
    if (!this.context) return;
    try {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = type;
      osc.connect(gain);
      gain.connect(this.context.destination);

      const now = this.context.currentTime;
      osc.frequency.setValueAtTime(freq, now);
      if (sweepFreq) {
        osc.frequency.exponentialRampToValueAtTime(sweepFreq, now + (sweepTime || duration));
      }

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio generation failed", e);
    }
  },
  select() {
    this.init();
    this.playTone({ freq: 800, duration: 0.08, vol: 0.04 });
  },
  deselect() {
    this.init();
    this.playTone({ freq: 400, duration: 0.08, vol: 0.04 });
  },
  move() {
    this.init();
    this.playTone({ freq: 600, duration: 0.15, vol: 0.06, sweepFreq: 300 });
  },
  tubeComplete() {
    this.init();
    this.playTone({ freq: 440, type: 'triangle', duration: 0.15, vol: 0.04 }); // A4
    setTimeout(() => this.playTone({ freq: 554.37, type: 'triangle', duration: 0.15, vol: 0.04 }), 100); // C#5
    setTimeout(() => this.playTone({ freq: 659.25, type: 'triangle', duration: 0.4, vol: 0.04 }), 200); // E5
  },
  win() {
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone({ freq, type: 'sine', duration: 0.5, vol: 0.08 }), i * 150);
    });
  },
  levelComplete() {
    this.init();
    // A distinct fanfare/success sound (C major chord then a higher C major chord)
    const chord1 = [261.63, 329.63, 392.00]; // C4, E4, G4
    const chord2 = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord1.forEach(freq => this.playTone({ freq, type: 'triangle', duration: 0.3, vol: 0.08 }));
    setTimeout(() => {
        chord2.forEach(freq => this.playTone({ freq, type: 'sine', duration: 0.8, vol: 0.1 }));
    }, 300);
  },
  error() {
    this.init();
    this.playTone({ freq: 150, type: 'square', duration: 0.2, vol: 0.02, sweepFreq: 100 });
  }
};
