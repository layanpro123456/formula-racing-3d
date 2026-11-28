// Formula Racing 3D — 4-Wheel Procedural GPU Tire Smoke & Lockup Particle System
import {
  GPUParticleSystem,
  ParticleSystem,
  DynamicTexture,
  Vector3,
  Color4,
  Scene,
  AbstractMesh
} from "@babylonjs/core";

export class TireSmokeSystem {
  private systems: (GPUParticleSystem | ParticleSystem)[] = [];
  private smokeTex: DynamicTexture;
  private readonly density: number;

  // Expected wheel order: [FL, FR, RL, RR] (or [RL, RR] legacy)
  constructor(scene: Scene, wheelMeshes: AbstractMesh[], density = 1.0) {
    this.density = Math.max(0.3, Math.min(1.5, density));

    this.smokeTex = new DynamicTexture("smokeTex", { width: 64, height: 64 }, scene);
    const ctx = this.smokeTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(225, 228, 232, 0.72)");
      grad.addColorStop(0.5, "rgba(185, 190, 196, 0.36)");
      grad.addColorStop(1, "rgba(155, 160, 165, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.smokeTex.update();
    }

    for (const wheel of wheelMeshes) {
      const ps = GPUParticleSystem.IsSupported
        ? new GPUParticleSystem(`smoke_${wheel.name}`, { capacity: Math.round(800 * this.density) }, scene)
        : new ParticleSystem(`smoke_${wheel.name}`, Math.round(250 * this.density), scene);

      ps.particleTexture = this.smokeTex;
      ps.emitter = wheel;
      ps.minLifeTime = 0.38;
      ps.maxLifeTime = 0.95;
      ps.minSize = 0.24;
      ps.maxSize = 0.88;
      ps.emitRate = 0;
      ps.gravity = new Vector3(0, 0.45, 0);
      ps.color1 = new Color4(0.86, 0.87, 0.89, 0.52);
      ps.color2 = new Color4(0.72, 0.74, 0.78, 0.26);
      ps.colorDead = new Color4(0.55, 0.56, 0.58, 0.0);
      ps.minEmitPower = 0.4;
      ps.maxEmitPower = 1.5;

      ps.start();
      this.systems.push(ps);
    }
  }

  public update(
    tireSlip: number,
    isBraking: boolean,
    speedMs: number,
    isLockup = false,
    steerAngle = 0
  ): void {
    const safeSlip = Number.isFinite(tireSlip) ? tireSlip : 0;
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;

    if (this.systems.length === 4) {
      // Front wheels: smoke specifically on braking lockup (inside wheel smokes most)
      let flRate = 0;
      let frRate = 0;
      if (isLockup && safeSpeed > 8) {
        const lockRate = Math.round(135 * this.density);
        flRate = steerAngle <= 0.08 ? lockRate : Math.round(lockRate * 0.25);
        frRate = steerAngle >= -0.08 ? lockRate : Math.round(lockRate * 0.25);
      } else if (isBraking && safeSpeed > 18) {
        flRate = Math.round(14 * this.density);
        frRate = Math.round(14 * this.density);
      }

      // Rear wheels: smoke on lateral slip / wheelspin
      let rearRate = 0;
      if (safeSlip > 0.18 && safeSpeed > 5) {
        rearRate = Math.min(130, Math.floor(safeSlip * 210 * this.density));
      } else if (isBraking && safeSpeed > 14) {
        rearRate = Math.round(28 * this.density);
      }

      this.systems[0].emitRate = flRate;
      this.systems[1].emitRate = frRate;
      this.systems[2].emitRate = rearRate;
      this.systems[3].emitRate = rearRate;
      return;
    }

    let targetRate = 0;
    if (isBraking && safeSpeed > 10) {
      targetRate = Math.round(45 * this.density);
    } else if (safeSlip > 0.18 && safeSpeed > 5) {
      targetRate = Math.min(120, Math.floor(safeSlip * 200 * this.density));
    }

    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i].emitRate = targetRate;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i].dispose();
    }
    this.systems = [];
    this.smokeTex.dispose();
  }
}
