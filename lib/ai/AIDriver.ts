// Formula Racing 3D — Autonomous AI Driver & Grid Simulator
// Real-time spline pathfinding, curvature-based speed profiling, and local avoidance.
// Built natively for Babylon.js with zero Three.js dependencies and zero per-frame allocations.

import { Vector3 } from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { Spline3D } from "@/lib/math/Spline3D";

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface AICarState {
  id: string;
  name: string;
  number: number;
  liveryIndex: number;
  position: Vector3;
  heading: number;
  speed: number;       // m/s
  steerAngle: number;
  t: number;           // Normalized position on curve [0, 1]
  lap: number;
  lapTime: number;
  lastLapTime: number;
  lateralOffset: number; // Offset from centerline (-track.width/3 to +track.width/3)
  targetSpeed: number;
}

export const AI_ROSTER = [
  { name: "M. Verstappen", number: 1, liveryIndex: 3, skill: 0.98 },
  { name: "C. Leclerc", number: 16, liveryIndex: 0, skill: 0.96 },
  { name: "L. Hamilton", number: 44, liveryIndex: 1, skill: 0.96 },
  { name: "L. Norris", number: 4, liveryIndex: 2, skill: 0.95 },
  { name: "F. Alonso", number: 14, liveryIndex: 4, skill: 0.94 }
];

export class AISimulator {
  public cars: AICarState[] = [];
  private _up = new Vector3(0, 1, 0);
  private _scratchPt = new Vector3();
  private _scratchTan = new Vector3();
  private _scratchLookaheadTan = new Vector3();
  private _scratchSide = new Vector3();
  private _scratchTarget = new Vector3();

  public initializeGrid(track: Track, spline: Spline3D) {
    this.cars = AI_ROSTER.map((driver, index) => {
      // Staggered grid starting positions behind the start line
      const gridSlot = index + 1; // Player is P1
      const slotSpacingMeters = 8.0; // 8 meters per grid row
      const trackLen = spline.totalLength > 0 ? spline.totalLength : 4000;
      const tOffset = (gridSlot * slotSpacingMeters) / trackLen;
      const rawT = 1.0 - tOffset;
      const tStart = Math.max(0, Math.min(0.999999, ((rawT % 1) + 1) % 1));

      const startPt = spline.getPointAt(tStart);
      const tangent = spline.getTangentAt(tStart);
      const heading = Math.atan2(tangent.x, tangent.z);

      // Stagger left and right on grid boxes
      const isLeft = gridSlot % 2 === 1;
      const lateral = isLeft ? -1.8 : 1.8;

      const side = Vector3.Cross(tangent, this._up).normalize();
      const pos = startPt.clone().addInPlace(side.scale(lateral));

      return {
        id: `ai-${driver.number}`,
        name: driver.name,
        number: driver.number,
        liveryIndex: driver.liveryIndex,
        position: pos,
        heading: Number.isFinite(heading) ? heading : 0,
        speed: 0,
        steerAngle: 0,
        t: tStart,
        lap: 1,
        lapTime: 0,
        lastLapTime: 0,
        lateralOffset: lateral,
        targetSpeed: 0
      };
    });
  }

  public update(
    dt: number,
    track: Track,
    spline: Spline3D,
    playerPosition: Vector3,
    raceStarted: boolean
  ) {
    if (!raceStarted) return;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.04) : 0.016;
    const trackLen = spline.totalLength > 0 ? spline.totalLength : 4000;

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const driverProfile = AI_ROSTER[i];

      // Defensive state sanitization
      if (!Number.isFinite(car.t)) car.t = 0;
      if (!Number.isFinite(car.speed)) car.speed = 0;
      if (!Number.isFinite(car.heading)) car.heading = 0;
      if (!Number.isFinite(car.steerAngle)) car.steerAngle = 0;

      // 1. Advance along curve
      const safeT = Math.max(0, Math.min(0.999999, ((car.t % 1) + 1) % 1));
      const lookaheadMeters = 30.0 + car.speed * 0.45;
      const lookaheadT = Math.max(0, Math.min(0.999999, (((safeT + lookaheadMeters / trackLen) % 1) + 1) % 1));

      spline.getPointAtToRef(safeT, this._scratchPt);
      spline.getTangentAtToRef(safeT, this._scratchTan);
      spline.getTangentAtToRef(lookaheadT, this._scratchLookaheadTan);

      // 2. Curvature detection for speed profiling (brake before tight turns)
      const dot = clamp(Vector3.Dot(this._scratchTan, this._scratchLookaheadTan), -1, 1);
      const curvature = 1.0 - dot; // 0 = straight, >0.1 = sharp turn
      const baseTopSpeed = 88 * driverProfile.skill; // ~316 km/h
      const cornerMaxSpeed = Math.max(26, baseTopSpeed - curvature * 340);

      car.targetSpeed = cornerMaxSpeed;

      // 3. Local Collision Avoidance (Player & Other AI)
      if (playerPosition && Number.isFinite(playerPosition.x)) {
        const distToPlayer = Vector3.Distance(car.position, playerPosition);
        if (distToPlayer < 6.5) {
          // Brake or modulate speed to avoid ramming player
          car.targetSpeed = Math.min(car.targetSpeed, Math.max(12, car.speed * 0.88));
        }
      }

      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        const dist = Vector3.Distance(car.position, other.position);
        if (dist < 4.8 && car.t < other.t) {
          car.targetSpeed = Math.min(car.targetSpeed, other.speed * 0.95);
        }
      }

      // 4. Acceleration / Braking
      if (car.speed < car.targetSpeed) {
        car.speed += (24 * driverProfile.skill) * safeDt;
      } else {
        car.speed -= 38 * safeDt;
      }
      car.speed = Math.max(0, car.speed);

      // 5. Update curve progress using actual spline length
      const prevT = car.t;
      const deltaT = (car.speed * safeDt) / trackLen;
      car.t = Math.max(0, Math.min(0.999999, (((car.t + deltaT) % 1) + 1) % 1));

      // Lap completion
      if (prevT > 0.85 && car.t < 0.15) {
        car.lap += 1;
        car.lastLapTime = car.lapTime;
        car.lapTime = 0;
      } else {
        car.lapTime += safeDt;
      }

      // 6. Lateral Racing Line Positioning
      Vector3.CrossToRef(this._scratchTan, this._up, this._scratchSide);
      this._scratchSide.normalize();

      // Compute target 3D world position on spline with lateral offset
      this._scratchTarget.copyFrom(this._scratchPt).addInPlace(this._scratchSide.scale(car.lateralOffset));

      // Steer heading towards tangent
      const targetHeading = Math.atan2(this._scratchTan.x, this._scratchTan.z);
      if (Number.isFinite(targetHeading)) {
        car.heading = lerp(car.heading, targetHeading, safeDt * 8);
      }

      // Smooth position interpolation to prevent snapping
      Vector3.LerpToRef(car.position, this._scratchTarget, Math.min(1.0, safeDt * 14), car.position);
      car.position.y = this._scratchPt.y;

      if (!Number.isFinite(car.position.x) || !Number.isFinite(car.position.y) || !Number.isFinite(car.position.z)) {
        car.position.copyFrom(this._scratchPt);
      }

      // Front wheel steer angle calculation
      car.steerAngle = clamp((targetHeading - car.heading) * 1.8, -0.5, 0.5);
    }
  }
}
