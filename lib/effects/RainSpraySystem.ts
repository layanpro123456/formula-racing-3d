// Formula Racing 3D — Wet-Track Tire Wake & Rooster-Tail Rain Spray Particle System
import {
  GPUParticleSystem,
  ParticleSystem,
  DynamicTexture,
  Vector3,
  Color4,
  Scene,
  AbstractMesh
} from "@babylonjs/core";

export class RainSpraySystem {
  private systems: (GPUParticleSystem | ParticleSystem)[] = [];
  private tex: DynamicTexture;
  private readonly density: number;

  constructor(scene: Scene, rearWheels: AbstractMesh[], density = 1.0) {
    this.density = Math.max(0.3, Math.min(1.5, density));

    this.tex = new DynamicTexture("rainSprayTex", { width: 64, height: 64 }, scene);
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0.0, "rgba(215, 228, 240, 0.45)");
      grad.addColorStop(0.45, "rgba(195, 212, 230, 0.22)");
      grad.addColorStop(1.0, "rgba(180, 200, 220, 0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.tex.update();
    }

    for (const wheel of rearWheels) {
      const ps = GPUParticleSystem.IsSupported
        ? new GPUParticleSystem(`rainSpray_${wheel.name}`, { capacity: Math.round(900 * this.density) }, scene)
        : new ParticleSystem(`rainSpray_${wheel.name}`, Math.round(280 * this.density), scene);

      ps.particleTexture = this.tex;
      ps.emitter = wheel;
      ps.minEmitBox = new Vector3(-0.18, -0.25, -0.35);
      ps.maxEmitBox = new Vector3(0.18, 0.05, -0.15);
      ps.minLifeTime = 0.22;
      ps.maxLifeTime = 0.62;
      ps.minSize = 0.35;
      ps.maxSize = 1.45;
      ps.emitRate = 0;
      ps.gravity = new Vector3(0, -1.8, 0);
      ps.direction1 = new Vector3(-0.35, 0.35, -1.0);
      ps.direction2 = new Vector3(0.35, 0.95, -1.0);
      ps.minEmitPower = 2.0;
      ps.maxEmitPower = 6.5;
      ps.color1 = new Color4(0.84, 0.90, 0.96, 0.38);
      ps.color2 = new Color4(0.74, 0.82, 0.90, 0.22);
      ps.colorDead = new Color4(0.68, 0.76, 0.85, 0.0);

      ps.start();
      this.systems.push(ps);
    }
  }

  public update(speedMs: number, wetness: number): void {
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;
    const safeWet = Number.isFinite(wetness) ? Math.max(0, Math.min(1, wetness)) : 0;

    let rate = 0;
    if (safeWet > 0.3 && safeSpeed > 12) {
      const speedNorm = Math.min(1, (safeSpeed - 12) / 68);
      rate = Math.floor(speedNorm * speedNorm * 220 * safeWet * this.density);
    }

    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i].emitRate = rate;
    }
  }

  public dispose(): void {
    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i].dispose();
    }
    this.systems = [];
    this.tex.dispose();
  }
}
