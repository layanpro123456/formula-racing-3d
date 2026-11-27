// Formula Racing 3D — Procedural GPU Titanium Skid & Barrier Friction Sparks System
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
  private collisionPs: ParticleSystem;
  private collisionEmitterPos: Vector3 = new Vector3(0, -100, 0);

  constructor(scene: Scene, emitter: AbstractMesh) {
    const sparkTex = new DynamicTexture("sparkTex", { width: 16, height: 16 }, scene);
    const ctx = sparkTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 230, 1.0)");
      grad.addColorStop(0.3, "rgba(255, 190, 60, 0.9)");
      grad.addColorStop(0.7, "rgba(255, 90, 10, 0.4)");
      grad.addColorStop(1, "rgba(255, 50, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      sparkTex.update();
    }

    if (GPUParticleSystem.IsSupported) {
      this.ps = new GPUParticleSystem("titaniumSparks", { capacity: 500 }, scene);
    } else {
      this.ps = new ParticleSystem("titaniumSparks", 200, scene);
    }

    this.ps.particleTexture = sparkTex;
    this.ps.emitter = emitter;
    this.ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    this.ps.minLifeTime = 0.08;
    this.ps.maxLifeTime = 0.22;
    this.ps.minSize = 0.03;
    this.ps.maxSize = 0.08;
    this.ps.emitRate = 0;

    // Direct sparks rearward along the tarmac surface
    this.ps.minEmitBox = new Vector3(-0.45, -0.15, -1.1);
    this.ps.maxEmitBox = new Vector3(0.45, -0.05, -1.3);
    this.ps.direction1 = new Vector3(-0.35, 0.15, -1.0).normalize();
    this.ps.direction2 = new Vector3(0.35, 0.35, -1.0).normalize();
    this.ps.gravity = new Vector3(0, -9.81, 0);

    this.ps.color1 = new Color4(1.0, 0.95, 0.7, 1.0);
    this.ps.color2 = new Color4(1.0, 0.55, 0.12, 0.9);
    this.ps.colorDead = new Color4(0.3, 0.05, 0.0, 0.0);
    this.ps.minEmitPower = 10.0;
    this.ps.maxEmitPower = 20.0;

    this.ps.start();

    // Dedicated burst emitter for car-to-car contact sparks (zero per-frame allocations)
    this.collisionPs = new ParticleSystem("collisionSparks", 160, scene);
    this.collisionPs.particleTexture = sparkTex;
    this.collisionPs.emitter = this.collisionEmitterPos;
    this.collisionPs.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    this.collisionPs.minLifeTime = 0.14;
    this.collisionPs.maxLifeTime = 0.38;
    this.collisionPs.minSize = 0.05;
    this.collisionPs.maxSize = 0.14;
    this.collisionPs.emitRate = 0;
    this.collisionPs.minEmitBox = new Vector3(-0.25, -0.1, -0.25);
    this.collisionPs.maxEmitBox = new Vector3(0.25, 0.2, 0.25);
    this.collisionPs.direction1 = new Vector3(-1.0, 0.4, -1.0);
    this.collisionPs.direction2 = new Vector3(1.0, 1.2, 1.0);
    this.collisionPs.gravity = new Vector3(0, -11.0, 0);
    this.collisionPs.color1 = new Color4(1.0, 0.96, 0.75, 1.0);
    this.collisionPs.color2 = new Color4(1.0, 0.42, 0.08, 0.95);
    this.collisionPs.colorDead = new Color4(0.25, 0.02, 0.0, 0.0);
    this.collisionPs.minEmitPower = 6.0;
    this.collisionPs.maxEmitPower = 16.0;
    this.collisionPs.start();
  }

  public triggerCollisionBurst(worldPos: Vector3, severity: number): void {
    const safeSev = Number.isFinite(severity) ? Math.max(0.15, Math.min(1.0, severity)) : 0.5;
    this.collisionEmitterPos.copyFrom(worldPos);
    this.collisionPs.manualEmitCount = Math.round(25 + safeSev * 55);
  }

  public update(isBarrierContact: boolean, isSkidPlank: boolean, speedMs: number): void {
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;
    if (safeSpeed < 8) {
      this.ps.emitRate = 0;
      return;
    }

    if (isBarrierContact) {
      this.ps.emitRate = Math.min(300, Math.floor(safeSpeed * 4.5));
    } else if (isSkidPlank && safeSpeed > 55) {
      // High speed bottoming out sparks under floor
      this.ps.emitRate = Math.min(160, Math.floor((safeSpeed - 55) * 4.0));
    } else {
      this.ps.emitRate = 0;
    }
  }

  public dispose(): void {
    this.ps.dispose();
    this.collisionPs.dispose();
  }
}
