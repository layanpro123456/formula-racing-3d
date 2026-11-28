// Formula Racing 3D — Zero-Allocation Ring-Buffer Tire Skidmark System
import {
  Scene,
  Mesh,
  VertexData,
  VertexBuffer,
  StandardMaterial,
  Color3,
  DynamicTexture
} from "@babylonjs/core";

export class SkidmarkSystem {
  private mesh: Mesh;
  private mat: StandardMaterial;
  private tex: DynamicTexture;
  private readonly maxQuads = 420;
  private positions: Float32Array;
  private headQuad = 0;
  private dirty = false;

  // Last wheel contact positions for continuous strip stamping (FL, FR, RL, RR)
  private lastX = new Float64Array(4);
  private lastY = new Float64Array(4);
  private lastZ = new Float64Array(4);
  private hasLast = new Uint8Array(4);

  // Wheel offsets in car local space (X, Z)
  private readonly wheelOffsetsX = [-0.94, 0.94, -0.98, 0.98];
  private readonly wheelOffsetsZ = [1.45, 1.45, -1.15, -1.15];
  private readonly halfWidths = [0.16, 0.16, 0.21, 0.21];

  constructor(scene: Scene) {
    const vertCount = this.maxQuads * 4;
    this.positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = new Uint32Array(this.maxQuads * 6);

    for (let q = 0; q < this.maxQuads; q++) {
      const vBase = q * 4;
      const pBase = vBase * 3;
      for (let v = 0; v < 4; v++) {
        this.positions[pBase + v * 3 + 1] = -500; // Parked below world initially
        normals[pBase + v * 3 + 1] = 1;
      }

      const uBase = vBase * 2;
      uvs[uBase + 0] = 0; uvs[uBase + 1] = 0;
      uvs[uBase + 2] = 1; uvs[uBase + 3] = 0;
      uvs[uBase + 4] = 1; uvs[uBase + 5] = 1;
      uvs[uBase + 6] = 0; uvs[uBase + 7] = 1;

      const iBase = q * 6;
      indices[iBase + 0] = vBase + 0;
      indices[iBase + 1] = vBase + 1;
      indices[iBase + 2] = vBase + 2;
      indices[iBase + 3] = vBase + 0;
      indices[iBase + 4] = vBase + 2;
      indices[iBase + 5] = vBase + 3;
    }

    this.mesh = new Mesh("tireSkidmarks", scene);
    const vData = new VertexData();
    vData.positions = this.positions;
    vData.normals = normals;
    vData.uvs = uvs;
    vData.indices = indices;
    vData.applyToMesh(this.mesh, true);
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.isPickable = false;

    this.tex = new DynamicTexture("skidmarkTex", { width: 64, height: 64 }, scene, false);
    this.tex.hasAlpha = true;
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0.0, "rgba(10, 11, 13, 0.0)");
      grad.addColorStop(0.18, "rgba(10, 11, 13, 0.65)");
      grad.addColorStop(0.50, "rgba(8, 9, 11, 0.78)");
      grad.addColorStop(0.82, "rgba(10, 11, 13, 0.65)");
      grad.addColorStop(1.0, "rgba(10, 11, 13, 0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.tex.update();
    }

    this.mat = new StandardMaterial("skidmarkMat", scene);
    this.mat.diffuseTexture = this.tex;
    this.mat.useAlphaFromDiffuseTexture = true;
    this.mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    this.mat.backFaceCulling = false;
    this.mat.disableDepthWrite = true;
    this.mat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.mat.zOffset = -3;
    this.mat.zOffsetUnits = -3;
    this.mesh.material = this.mat;
  }

  public update(
    posX: number,
    posY: number,
    posZ: number,
    heading: number,
    speedMs: number,
    isLockup: boolean,
    tireSlip: number,
    steerAngle: number,
    isBraking = false,
    slopeFwdY = 0,
    slopeRightY = 0
  ): void {
    const safeSpeed = Number.isFinite(speedMs) ? speedMs : 0;
    const isSliding = Number.isFinite(tireSlip) && tireSlip > 0.16;
    const isHardCorner = Math.abs(steerAngle) > 0.14 && safeSpeed > 24;
    const isHardBrake = isBraking && safeSpeed > 20;
    const active = safeSpeed > 8 && (isLockup || isSliding || isHardCorner || isHardBrake);

    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const rightX = cosH;
    const rightZ = -sinH;

    for (let w = 0; w < 4; w++) {
      // Front wheels mark on lockup or aggressive turn-in; rear wheels mark on slip, cornering, or hard braking
      const isFront = w < 2;
      let wheelActive = false;
      if (active) {
        if (isFront && (isLockup || isHardCorner)) {
          // Inside wheel locks/scrubs harder when turning
          wheelActive = Math.abs(steerAngle) < 0.08 || (steerAngle < 0 && w === 0) || (steerAngle > 0 && w === 1);
        } else if (!isFront && (isSliding || isHardCorner || isHardBrake)) {
          wheelActive = true;
        }
      }

      if (!wheelActive) {
        this.hasLast[w] = 0;
        continue;
      }

      const lx = this.wheelOffsetsX[w];
      const lz = this.wheelOffsetsZ[w];
      const wx = posX + rightX * lx + sinH * lz;
      const wy = posY + 0.008 + slopeRightY * lx + slopeFwdY * lz;
      const wz = posZ + rightZ * lx + cosH * lz;

      if (this.hasLast[w] === 0) {
        this.lastX[w] = wx;
        this.lastY[w] = wy;
        this.lastZ[w] = wz;
        this.hasLast[w] = 1;
        continue;
      }

      const dx = wx - this.lastX[w];
      const dz = wz - this.lastZ[w];
      const distSq = dx * dx + dz * dz;
      if (distSq < 0.16) {
        continue; // Wait until car moves >= 0.4m for clean quad spacing
      }
      if (distSq > 25.0) {
        // Teleported or large gap; reset anchor
        this.lastX[w] = wx;
        this.lastY[w] = wy;
        this.lastZ[w] = wz;
        continue;
      }

      const invDist = 1 / Math.sqrt(distSq);
      const sx = -dz * invDist * this.halfWidths[w];
      const sz = dx * invDist * this.halfWidths[w];

      const base = this.headQuad * 12;
      const ox = this.lastX[w];
      const oy = this.lastY[w];
      const oz = this.lastZ[w];

      // Quad vertices: (prev - side), (prev + side), (curr + side), (curr - side)
      this.positions[base + 0] = ox - sx;
      this.positions[base + 1] = oy;
      this.positions[base + 2] = oz - sz;

      this.positions[base + 3] = ox + sx;
      this.positions[base + 4] = oy;
      this.positions[base + 5] = oz + sz;

      this.positions[base + 6] = wx + sx;
      this.positions[base + 7] = wy;
      this.positions[base + 8] = wz + sz;

      this.positions[base + 9] = wx - sx;
      this.positions[base + 10] = wy;
      this.positions[base + 11] = wz - sz;

      this.headQuad = (this.headQuad + 1) % this.maxQuads;
      this.dirty = true;

      this.lastX[w] = wx;
      this.lastY[w] = wy;
      this.lastZ[w] = wz;
    }

    if (this.dirty) {
      this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false);
      this.dirty = false;
    }
  }

  public dispose(): void {
    this.mesh.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
