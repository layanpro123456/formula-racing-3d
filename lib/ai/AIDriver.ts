// Formula Racing 3D — Autonomous AI Driver & Grid Simulator
// Real-time spline pathfinding, curvature-based speed profiling, and local avoidance.

import * as THREE from "three";
import { Track } from "@/data/tracks";

export interface AICarState {
  id: string;
  name: string;
  number: number;
  liveryIndex: number;
  position: THREE.Vector3;
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
  private _up = new THREE.Vector3(0, 1, 0);
  private _scratchVec = new THREE.Vector3();
  private _scratchTan = new THREE.Vector3();
  private _scratchSide = new THREE.Vector3();

  public initializeGrid(track: Track, spline: THREE.CatmullRomCurve3) {
    this.cars = AI_ROSTER.map((driver, index) => {
      // Staggered grid starting positions behind the start line (negative t offset)
      // Row 1 (P2), Row 2 (P3, P4), Row 3 (P5, P6)
      const gridSlot = index + 1; // Player is P1
      const tStart = 1.0 - (gridSlot * 0.012);
      const startPt = spline.getPointAt(tStart);
      const tangent = spline.getTangentAt(tStart).normalize();
      const heading = Math.atan2(tangent.x, tangent.z);

      // Stagger left and right on grid boxes
      const isLeft = gridSlot % 2 === 1;
      const lateral = (isLeft ? -1.8 : 1.8);

      const side = new THREE.Vector3().crossVectors(tangent, this._up).normalize();
      const pos = startPt.clone().addScaledVector(side, lateral);

      return {
        id: `ai-${driver.number}`,
        name: driver.name,
        number: driver.number,
        liveryIndex: driver.liveryIndex,
        position: pos,
        heading: heading,
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
    spline: THREE.CatmullRomCurve3,
    playerPosition: THREE.Vector3,
    raceStarted: boolean
  ) {
    if (!raceStarted) return;

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const driverProfile = AI_ROSTER[i];

      // 1. Advance along curve
      const lookaheadT = (car.t + 0.02) % 1.0;
      const currentPt = spline.getPointAt(car.t);
      const lookaheadPt = spline.getPointAt(lookaheadT);
      
      const currentTan = spline.getTangentAt(car.t).normalize();
      const lookaheadTan = spline.getTangentAt(lookaheadT).normalize();

      // 2. Curvature detection for speed profiling (brake before tight turns)
      const curvature = 1.0 - currentTan.dot(lookaheadTan); // 0 = straight, >0.1 = sharp turn
      const baseTopSpeed = 86 * driverProfile.skill; // ~310 km/h
      const cornerMaxSpeed = Math.max(28, baseTopSpeed - curvature * 320);

      car.targetSpeed = cornerMaxSpeed;

      // 3. Acceleration / Braking
      if (car.speed < car.targetSpeed) {
        car.speed += (22 * driverProfile.skill) * dt;
      } else {
        car.speed -= 35 * dt;
      }
      car.speed = Math.max(0, car.speed);

      // 4. Update curve progress
      const prevT = car.t;
      // Approximate spline arc length advancement
      const deltaT = (car.speed * dt) / (track.width * 80);
      car.t = (car.t + deltaT) % 1.0;

      // Lap completion
      if (prevT > 0.85 && car.t < 0.15) {
        car.lap += 1;
        car.lastLapTime = car.lapTime;
        car.lapTime = 0;
      } else {
        car.lapTime += dt;
      }

      // 5. Lateral Racing Line & Local Avoidance
      // Side vector perpendicular to track
      this._scratchSide.crossVectors(currentTan, this._up).normalize();

      // Avoid player car if close ahead
      const distToPlayer = car.position.distanceTo(playerPosition);
      if (distToPlayer < 7.0) {
        // Player is nearby! Swerve slightly or brake to avoid reckless ramming
        car.speed *= 0.96;
      }

      // Compute target 3D world position on spline with lateral offset
      const targetPos = currentPt.clone().addScaledVector(this._scratchSide, car.lateralOffset);

      // Steer heading towards target
      this._scratchVec.subVectors(targetPos, car.position);
      const targetHeading = Math.atan2(currentTan.x, currentTan.z);
      
      car.heading = THREE.MathUtils.lerp(car.heading, targetHeading, dt * 6);
      car.position.lerp(targetPos, dt * 10);
      car.position.y = currentPt.y;

      // Steering angle
      car.steerAngle = (targetHeading - car.heading) * 2.0;
    }
  }
}
