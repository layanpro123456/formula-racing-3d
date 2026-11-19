// Formula Racing 3D — Autonomous 3D Catmull-Rom Spline Engine
// Pure mathematical arc-length parameterized 3D spline built for Babylon.js with zero Three.js dependencies.

import { Vector3 } from "@babylonjs/core";

export class Spline3D {
  public points: Vector3[];
  public totalLength: number = 0;
  private arcLengths: number[] = [];
  private n: number;

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

    // Numerical arc length integration with 800 sub-segments
    const samples = 800;
    this.arcLengths = [0];
    let prev = this._evaluateUniform(0);
    let totalLen = 0;

    for (let i = 1; i <= samples; i++) {
      const curr = this._evaluateUniform(i / samples);
      totalLen += Vector3.Distance(prev, curr);
      this.arcLengths.push(totalLen);
      prev = curr;
    }

    this.totalLength = totalLen;
  }

  // Uniform Catmull-Rom polynomial evaluation: P(u)
  private _evaluateUniform(t: number): Vector3 {
    const rawIdx = t * this.n;
    const i = Math.floor(rawIdx);
    const u = rawIdx - i;
    const p0 = this.points[(i - 1 + this.n) % this.n];
    const p1 = this.points[i % this.n];
    const p2 = this.points[(i + 1) % this.n];
    const p3 = this.points[(i + 2) % this.n];

    const u2 = u * u;
    const u3 = u2 * u;

    const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
    const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
    const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);

    return new Vector3(x, y, z);
  }

  // Analytical derivative for exact tangent: P'(u)
  private _evaluateTangent(t: number): Vector3 {
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

    const tan = new Vector3(tx, ty, tz);
    if (tan.lengthSquared() > 0.0001) {
      tan.normalize();
    } else {
      tan.set(0, 0, 1);
    }
    return tan;
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
    const safeU = Math.max(0, Math.min(0.999999, ((u % 1) + 1) % 1));
    const paramT = this.getUfromDistance(safeU * this.totalLength);
    return this._evaluateUniform(paramT);
  }

  public getTangentAt(u: number): Vector3 {
    const safeU = Math.max(0, Math.min(0.999999, ((u % 1) + 1) % 1));
    const paramT = this.getUfromDistance(safeU * this.totalLength);
    return this._evaluateTangent(paramT);
  }

  public getLength(): number {
    return this.totalLength;
  }
}

export function build3DCurve(points: [number, number, number][], scale = 4.8): Spline3D {
  return new Spline3D(points, scale);
}
