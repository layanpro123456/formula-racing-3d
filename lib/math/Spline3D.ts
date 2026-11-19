// Formula Racing 3D — Autonomous 3D Catmull-Rom Spline Engine
// Pure mathematical arc-length parameterized 3D spline built for Babylon.js with zero Three.js dependencies.
// Provides zero-allocation continuous queries and precomputed dense samples.

import { Vector3 } from "@babylonjs/core";

export interface SplineSample {
  u: number;
  distance: number;
  point: Vector3;
  tangent: Vector3;
  normal: Vector3;
}

const UP = new Vector3(0, 1, 0);

export class Spline3D {
  public points: Vector3[];
  public totalLength: number = 0;
  public samples: SplineSample[] = [];
  private arcLengths: number[] = [];
  private n: number;
  private readonly sampleCount = 1500;

  constructor(points: [number, number, number][], scale = 4.8) {
    // Strip duplicate closure point if provided
    const pts = points.map(([x, y, z]) => new Vector3(x * scale, y * scale * 0.8, z * scale));
    if (pts.length > 1) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first.x === last.x && first.y === last.y && first.z === last.z) {
        pts.pop();
      }
    }
    this.points = pts;
    this.n = this.points.length;

    // Numerical arc length integration with 1000 sub-segments
    const integrationSteps = 1000;
    this.arcLengths = [0];
    let prev = this._evaluateUniform(0);
    let totalLen = 0;

    for (let i = 1; i <= integrationSteps; i++) {
      const curr = this._evaluateUniform(i / integrationSteps);
      totalLen += Vector3.Distance(prev, curr);
      this.arcLengths.push(totalLen);
      prev = curr;
    }

    this.totalLength = totalLen;

    // Precompute dense equidistant samples for allocation-free queries
    for (let i = 0; i < this.sampleCount; i++) {
      const u = i / this.sampleCount;
      const dist = u * this.totalLength;
      const pt = this.getPointAt(u);
      const tan = this.getTangentAt(u);
      const norm = Vector3.Cross(tan, UP).normalize();

      this.samples.push({
        u,
        distance: dist,
        point: pt,
        tangent: tan,
        normal: norm
      });
    }
  }

  // Uniform Catmull-Rom polynomial evaluation: P(u)
  private _evaluateUniform(t: number): Vector3 {
    const res = new Vector3();
    this._evaluateUniformToRef(t, res);
    return res;
  }

  private _evaluateUniformToRef(t: number, result: Vector3): Vector3 {
    const rawIdx = t * this.n;
    const i = Math.floor(rawIdx);
    const u = rawIdx - i;
    const p0 = this.points[(i - 1 + this.n) % this.n];
    const p1 = this.points[i % this.n];
    const p2 = this.points[(i + 1) % this.n];
    const p3 = this.points[(i + 2) % this.n];

    const u2 = u * u;
    const u3 = u2 * u;

    result.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
    result.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
    result.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);

    return result;
  }

  // Analytical derivative for exact tangent: P'(u)
  private _evaluateTangent(t: number): Vector3 {
    const res = new Vector3();
    this._evaluateTangentToRef(t, res);
    return res;
  }

  private _evaluateTangentToRef(t: number, result: Vector3): Vector3 {
    const rawIdx = t * this.n;
    const i = Math.floor(rawIdx);
    const u = rawIdx - i;
    const p0 = this.points[(i - 1 + this.n) % this.n];
    const p1 = this.points[i % this.n];
    const p2 = this.points[(i + 1) % this.n];
    const p3 = this.points[(i + 2) % this.n];

    const u2 = u * u;

    const tx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u2);
    const ty = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u2);
    const tz = 0.5 * ((-p0.z + p2.z) + 2 * (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u + 3 * (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u2);

    result.set(tx, ty, tz);
    if (result.lengthSquared() > 0.0001) {
      result.normalize();
    } else {
      result.set(0, 0, 1);
    }
    return result;
  }

  // Binary search arc length table to convert normalized distance u [0, 1] into uniform parameter t
  private getUfromDistance(distance: number): number {
    if (this.totalLength <= 0) return 0;
    const target = ((distance % this.totalLength) + this.totalLength) % this.totalLength;

    let low = 0;
    let high = this.arcLengths.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.arcLengths[mid] < target) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(0, Math.min(this.arcLengths.length - 2, high));
    const nextIdx = idx + 1;
    const segLen = this.arcLengths[nextIdx] - this.arcLengths[idx];
    const frac = segLen > 0 ? (target - this.arcLengths[idx]) / segLen : 0;

    return (idx + frac) / (this.arcLengths.length - 1);
  }

  public getPointAt(u: number): Vector3 {
    const res = new Vector3();
    return this.getPointAtToRef(u, res);
  }

  public getPointAtToRef(u: number, result: Vector3): Vector3 {
    const safeU = Math.max(0, Math.min(0.999999, ((u % 1) + 1) % 1));
    const paramT = this.getUfromDistance(safeU * this.totalLength);
    return this._evaluateUniformToRef(paramT, result);
  }

  public getTangentAt(u: number): Vector3 {
    const res = new Vector3();
    return this.getTangentAtToRef(u, res);
  }

  public getTangentAtToRef(u: number, result: Vector3): Vector3 {
    const safeU = Math.max(0, Math.min(0.999999, ((u % 1) + 1) % 1));
    const paramT = this.getUfromDistance(safeU * this.totalLength);
    return this._evaluateTangentToRef(paramT, result);
  }

  public getNormalAtToRef(u: number, result: Vector3): Vector3 {
    this.getTangentAtToRef(u, result);
    Vector3.CrossToRef(result, UP, result);
    result.normalize();
    return result;
  }

  // Allocation-free closest point query using precomputed dense samples and segment projection
  public queryClosest(
    pos: Vector3,
    hintU: number,
    outPoint: Vector3,
    outTangent: Vector3,
    outNormal: Vector3
  ): { u: number; lateralDistance: number; signedLateralDistance: number } {
    const M = this.sampleCount;
    let bestIdx = 0;
    let minDistSq = Infinity;

    if (Number.isFinite(hintU) && hintU >= 0 && hintU < 1) {
      // Localized search window around previous position
      const centerIdx = Math.floor(hintU * M);
      const searchRadius = 40;
      for (let offset = -searchRadius; offset <= searchRadius; offset++) {
        const idx = ((centerIdx + offset) % M + M) % M;
        const s = this.samples[idx];
        const dx = pos.x - s.point.x;
        const dy = pos.y - s.point.y;
        const dz = pos.z - s.point.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestIdx = idx;
        }
      }
    } else {
      // Full array search on initialization or fallback
      for (let i = 0; i < M; i++) {
        const s = this.samples[i];
        const dx = pos.x - s.point.x;
        const dy = pos.y - s.point.y;
        const dz = pos.z - s.point.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestIdx = i;
        }
      }
    }

    // Segment projection between bestIdx and neighboring sample
    const nextIdx = (bestIdx + 1) % M;
    const pA = this.samples[bestIdx].point;
    const pB = this.samples[nextIdx].point;

    const vx = pB.x - pA.x;
    const vy = pB.y - pA.y;
    const vz = pB.z - pA.z;
    const vLenSq = vx * vx + vy * vy + vz * vz;

    const wx = pos.x - pA.x;
    const wy = pos.y - pA.y;
    const wz = pos.z - pA.z;

    const dot = wx * vx + wy * vy + wz * vz;
    const alpha = vLenSq > 0.00001 ? Math.max(0, Math.min(1, dot / vLenSq)) : 0;

    outPoint.x = pA.x + alpha * vx;
    outPoint.y = pA.y + alpha * vy;
    outPoint.z = pA.z + alpha * vz;

    // Interpolate tangent and normal
    const sA = this.samples[bestIdx];
    const sB = this.samples[nextIdx];
    outTangent.x = sA.tangent.x + alpha * (sB.tangent.x - sA.tangent.x);
    outTangent.y = sA.tangent.y + alpha * (sB.tangent.y - sA.tangent.y);
    outTangent.z = sA.tangent.z + alpha * (sB.tangent.z - sA.tangent.z);
    outTangent.normalize();

    Vector3.CrossToRef(outTangent, UP, outNormal);
    outNormal.normalize();

    // Signed lateral distance: dot(pos - outPoint, outNormal)
    const diffX = pos.x - outPoint.x;
    const diffZ = pos.z - outPoint.z;
    const signedLateral = diffX * outNormal.x + diffZ * outNormal.z;
    const lateralDist = Math.abs(signedLateral);

    const u = ((bestIdx + alpha) / M) % 1;

    return {
      u: u < 0 ? u + 1 : u,
      lateralDistance: lateralDist,
      signedLateralDistance: signedLateral
    };
  }

  public getLength(): number {
    return this.totalLength;
  }
}

export function build3DCurve(points: [number, number, number][], scale = 4.8): Spline3D {
  return new Spline3D(points, scale);
}
