// Formula Racing 3D — Procedural GPU Tire Smoke Particle System
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

  constructor(scene: Scene, wheelMeshes: AbstractMesh[]) {
    // Generate soft circular puff texture procedurally
    const smokeTex = new DynamicTexture("smokeTex", { width: 64, height: 64 }, scene);
    const ctx = smokeTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(220, 220, 220, 0.7)");
      grad.addColorStop(0.5, "rgba(180, 180, 180, 0.35)");
      grad.addColorStop(1, "rgba(150, 150, 150, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      smokeTex.update();
    }

    for (const wheel of wheelMeshes) {
      let ps: GPUParticleSystem | ParticleSystem;
      if (GPUParticleSystem.IsSupported) {
        ps = new GPUParticleSystem(`smoke_${wheel.name}`, { capacity: 1000 }, scene);
      } else {
        ps = new ParticleSystem(`smoke_${wheel.name}`, 300, scene);
      }

      ps.particleTexture = smokeTex;
      ps.emitter = wheel;
      ps.minLifeTime = 0.4;
      ps.maxLifeTime = 1.0;
      ps.minSize = 0.25;
      ps.maxSize = 0.9;
      ps.emitRate = 0; // Dynamic rate controlled by slip / braking
      ps.gravity = new Vector3(0, 0.4, 0);
      ps.color1 = new Color4(0.85, 0.85, 0.85, 0.5);
      ps.color2 = new Color4(0.7, 0.7, 0.7, 0.25);
      ps.colorDead = new Color4(0.5, 0.5, 0.5, 0.0);
      ps.minEmitPower = 0.4;
      ps.maxEmitPower = 1.4;

      ps.start();
      this.systems.push(ps);
    }
  }

  public update(tireSlip: number, isBraking: boolean, speedMs: number): void {
    const safeSlip = Number.isFinite(tireSlip) ? tireSlip : 0;
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;

    let targetRate = 0;
    if (isBraking && safeSpeed > 10) {
      targetRate = 45;
    } else if (safeSlip > 0.18 && safeSpeed > 5) {
      targetRate = Math.min(120, Math.floor(safeSlip * 200));
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
  }
}
