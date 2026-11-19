// Formula Racing 3D — Procedural GPU Barrier Friction Sparks System
import {
  GPUParticleSystem,
  ParticleSystem,
  DynamicTexture,
  Vector3,
  Color4,
  Scene,
  AbstractMesh
} from "@babylonjs/core";

export class BarrierSparkSystem {
  private ps: GPUParticleSystem | ParticleSystem;

  constructor(scene: Scene, emitter: AbstractMesh) {
    const sparkTex = new DynamicTexture("sparkTex", { width: 16, height: 16 }, scene);
    const ctx = sparkTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 220, 1.0)");
      grad.addColorStop(0.35, "rgba(255, 180, 50, 0.85)");
      grad.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      sparkTex.update();
    }

    if (GPUParticleSystem.IsSupported) {
      this.ps = new GPUParticleSystem("barrierSparks", { capacity: 400 }, scene);
    } else {
      this.ps = new ParticleSystem("barrierSparks", 150, scene);
    }

    this.ps.particleTexture = sparkTex;
    this.ps.emitter = emitter;
    this.ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    this.ps.minLifeTime = 0.1;
    this.ps.maxLifeTime = 0.35;
    this.ps.minSize = 0.04;
    this.ps.maxSize = 0.14;
    this.ps.emitRate = 0;
    this.ps.gravity = new Vector3(0, -9.81, 0);
    this.ps.color1 = new Color4(1.0, 0.95, 0.6, 1.0);
    this.ps.color2 = new Color4(1.0, 0.55, 0.1, 0.85);
    this.ps.colorDead = new Color4(0.4, 0.1, 0.0, 0.0);
    this.ps.minEmitPower = 4.0;
    this.ps.maxEmitPower = 12.0;

    this.ps.start();
  }

  public update(isBarrierCollision: boolean, speedMs: number): void {
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;
    this.ps.emitRate = isBarrierCollision && safeSpeed > 4 ? 240 : 0;
  }

  public dispose(): void {
    this.ps.dispose();
  }
}
