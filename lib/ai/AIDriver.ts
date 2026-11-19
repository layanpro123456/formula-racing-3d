// Formula Racing 3D — Autonomous AI Driver & Grid Simulator
// Real-time spline pathfinding, curvature-based speed profiling, and local avoidance.
// Built natively for Babylon.js with zero Three.js dependencies.

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
  private _scratchVec = new Vector3();
  private _scratchTan = new Vector3();
  private _scratchSide = new Vector3();
  private _scratchTarget = new Vector3();

  public initializeGrid(track: Track, spline: Spline3D) {
    this.cars = AI_ROSTER.map((driver, index) => {
      // Staggered grid starting positions behind the start line (negative t offset)
      // Row 1 (P2), Row 2 (P3, P4), Row 3 (P5, P6)
      const gridSlot = index + 1; // Player is P1
      const rawT = 1.0 - (gridSlot * 0.012);
      const tStart = Math.max(0, Math.min(0.999999, ((rawT % 1) + 1) % 1));
      const startPt = spline.getPointAt(tStart);
      const rawTan = spline.getTangentAt(tStart);
      const tangent = (rawTan && rawTan.lengthSquared() > 0.0001) ? rawTan.normalize() : new Vector3(0, 0, 1);
      const heading = Math.atan2(tangent.x, tangent.z);

      // Stagger left and right on grid boxes
      const isLeft = gridSlot % 2 === 1;
      const lateral = (isLeft ? -1.8 : 1.8);

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
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;
    const trackWidth = Number.isFinite(track?.width) && track.width > 0 ? track.width : 6.8;

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
      const lookaheadT = Math.max(0, Math.min(0.999999, (((safeT + 0.02) % 1) + 1) % 1));
      
      const currentPt = spline.getPointAt(safeT);
      
      const rawCurrentTan = spline.getTangentAt(safeT);
      const currentTan = (rawCurrentTan && rawCurrentTan.lengthSquared() > 0.0001)
        ? this._scratchTan.copyFrom(rawCurrentTan).normalize()
        : this._scratchTan.set(0, 0, 1);

      const rawLookaheadTan = spline.getTangentAt(lookaheadT);
      const lookaheadTan = (rawLookaheadTan && rawLookaheadTan.lengthSquared() > 0.0001)
        ? rawLookaheadTan.normalize()
        : currentTan;

      // 2. Curvature detection for speed profiling (brake before tight turns)
      const dot = clamp(Vector3.Dot(currentTan, lookaheadTan), -1, 1);
      const curvature = 1.0 - dot; // 0 = straight, >0.1 = sharp turn
      const baseTopSpeed = 86 * driverProfile.skill; // ~310 km/h
      const cornerMaxSpeed = Math.max(28, baseTopSpeed - curvature * 320);

      car.targetSpeed = cornerMaxSpeed;

      // 3. Acceleration / Braking
      if (car.speed < car.targetSpeed) {
        car.speed += (22 * driverProfile.skill) * safeDt;
      } else {
        car.speed -= 35 * safeDt;
      }
      car.speed = Math.max(0, car.speed);

      // 4. Update curve progress
      const prevT = car.t;
      // Approximate spline arc length advancement
      const deltaT = (car.speed * safeDt) / (trackWidth * 80);
      car.t = Math.max(0, Math.min(0.999999, (((car.t + deltaT) % 1) + 1) % 1));

      // Lap completion
      if (prevT > 0.85 && car.t < 0.15) {
        car.lap += 1;
        car.lastLapTime = car.lapTime;
        car.lapTime = 0;
      } else {
        car.lapTime += safeDt;
      }

      // 5. Lateral Racing Line & Local Avoidance
      // Side vector perpendicular to track
      Vector3.CrossToRef(currentTan, this._up, this._scratchSide);
      this._scratchSide.normalize();

      // Avoid player car if close ahead
      const distToPlayer = (playerPosition && Number.isFinite(playerPosition.x))
        ? Vector3.Distance(car.position, playerPosition)
        : 999;
      if (distToPlayer < 7.0) {
        // Player is nearby! Swerve slightly or brake to avoid reckless ramming
        car.speed *= 0.96;
      }

      // Compute target 3D world position on spline with lateral offset (zero allocations)
      this._scratchTarget.copyFrom(currentPt).addInPlace(this._scratchSide.scale(car.lateralOffset));

      // Steer heading towards target
      this._scratchVec.copyFrom(this._scratchTarget).subtractInPlace(car.position);
      const targetHeading = Math.atan2(currentTan.x, currentTan.z);
      
      if (Number.isFinite(targetHeading)) {
        car.heading = lerp(car.heading, targetHeading, safeDt * 6);
      }
      Vector3.LerpToRef(car.position, this._scratchTarget, safeDt * 10, car.position);
      car.position.y = currentPt.y;

      // Sanitization on position
      if (!Number.isFinite(car.position.x) || !Number.isFinite(car.position.y) || !Number.isFinite(car.position.z)) {
        car.position.copyFrom(currentPt);
      }

      // Steering angle
      car.steerAngle = (targetHeading - car.heading) * 2.0;
      if (!Number.isFinite(car.steerAngle)) car.steerAngle = 0;
    }
  }
}
