// Procedural Web Audio API engine sound synthesizer for Formula Racing 3D
// Generates RPM pitch, exhaust distortion, gear shift pops, and tire screech without external audio files.

class EngineAudioSystem {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private screechGain: GainNode | null = null;
  private screechOsc: OscillatorNode | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;

  public init() {
    if (this.initialized || typeof window === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master engine gain
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.08;

      // Filter to shape high exhaust whine
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = "lowpass";
      this.filterNode.frequency.value = 850;

      // Distortion curve for raw turbo-hybrid V6 exhaust raspy tone
      this.distortionNode = this.ctx.createWaveShaper();
      this.distortionNode.curve = this.makeDistortionCurve(18);
      this.distortionNode.oversample = "2x";

      // Multi-harmonic oscillators for V6 F1 engine pitch
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc1.frequency.value = 80;

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "triangle";
      this.osc2.frequency.value = 160;

      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = "sawtooth";
      this.subOsc.frequency.value = 40;

      // Connect engine graph
      this.osc1.connect(this.distortionNode);
      this.osc2.connect(this.distortionNode);
      this.subOsc.connect(this.distortionNode);
      this.distortionNode.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.osc1.start();
      this.osc2.start();
      this.subOsc.start();

      // Tire screech generator (band-passed white noise/sawtooth)
      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;
      this.screechOsc = this.ctx.createOscillator();
      this.screechOsc.type = "sawtooth";
      this.screechOsc.frequency.value = 750;

      const screechFilter = this.ctx.createBiquadFilter();
      screechFilter.type = "bandpass";
      screechFilter.frequency.value = 1100;
      screechFilter.Q.value = 3.0;

      this.screechOsc.connect(screechFilter);
      screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.ctx.destination);
      this.screechOsc.start();

      this.initialized = true;
    } catch {
      // AudioContext not allowed or unsupported
    }
  }

  private makeDistortionCurve(amount: number) {
    const k = amount;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public update(rpmRatio: number, speed: number, isBraking: boolean, isSteeringHard: boolean) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    if (!Number.isFinite(now)) return;

    // Defensively clamp rpmRatio to [0, 1] to prevent Math.pow(negative, 1.3) -> NaN
    const safeRatio = Number.isFinite(rpmRatio) ? Math.max(0, Math.min(1, rpmRatio)) : 0;
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;

    // RPM pitch mapping (idle ~75Hz -> redline ~455Hz)
    const baseFreq = 75 + Math.pow(safeRatio, 1.3) * 380;
    const filterFreq = 700 + safeRatio * 3200;

    if (this.osc1 && this.osc2 && this.subOsc && this.filterNode && Number.isFinite(baseFreq)) {
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.osc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
      this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
      if (Number.isFinite(filterFreq)) {
        this.filterNode.frequency.setTargetAtTime(filterFreq, now, 0.05);
      }
    }

    // Engine volume based on throttle / speed
    if (this.gainNode) {
      const targetVolume = Math.max(0, Math.min(0.2, 0.04 + safeRatio * 0.09));
      if (Number.isFinite(targetVolume)) {
        this.gainNode.gain.setTargetAtTime(targetVolume, now, 0.04);
      }
    }

    // Tire squeal under hard braking at speed or high-G cornering
    if (this.screechGain) {
      const screech = (isBraking && safeSpeed > 25) || (isSteeringHard && safeSpeed > 40);
      const targetScreech = screech ? 0.045 : 0;
      if (Number.isFinite(targetScreech)) {
        this.screechGain.gain.setTargetAtTime(targetScreech, now, 0.08);
      }
    }
  }

  public playGearShift() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Brief pop / ignition cut
      if (this.gainNode) {
        this.gainNode.gain.setValueAtTime(0.01, now);
        this.gainNode.gain.setTargetAtTime(0.08, now + 0.04, 0.03);
      }
    } catch {
      // Ignore audio interruption
    }
  }

  public playBeep(high: boolean = false) {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const beepOsc = this.ctx.createOscillator();
      const beepGain = this.ctx.createGain();
      beepOsc.type = "sine";
      beepOsc.frequency.value = high ? 1200 : 700;
      beepGain.gain.setValueAtTime(0.09, now);
      beepGain.gain.exponentialRampToValueAtTime(0.001, now + (high ? 0.4 : 0.15));

      beepOsc.connect(beepGain);
      beepGain.connect(this.ctx.destination);
      beepOsc.start(now);
      beepOsc.stop(now + (high ? 0.42 : 0.17));
    } catch {
      // Ignore
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public resume() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public stop() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }
}

export const engineAudio = new EngineAudioSystem();
