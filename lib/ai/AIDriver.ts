// Formula Racing 3D — Autonomous AI Driver & Grid Simulator
// Real-time spline pathfinding, curvature-based speed profiling, TTC collision prevention, and multi-lane overtaking.
// Built natively for Babylon.js with zero Three.js dependencies and zero per-frame allocations.

import { Vector3 } from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { Spline3D, RoadSurfaceSample } from "@/lib/math/Spline3D";

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest signed angle difference from `from` to `to` in [-PI, PI]. */
function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
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
  lateralOffset: number; // Offset from centerline (-track.width/2 to +track.width/2)
  targetLateralOffset: number;
  targetSpeed: number;
  collisionRecoveryTimer: number;
  penaltySeconds: number;
  lastTangentX: number;
  lastTangentZ: number;
  lastNormalX: number;
  lastNormalZ: number;
  surfaceForward: Vector3;
  surfaceNormal: Vector3;
}

export const AI_ROSTER = [
  { name: "M. Verstappen", number: 1, liveryIndex: 3, skill: 0.98 },
  { name: "C. Leclerc", number: 16, liveryIndex: 0, skill: 0.96 },
  { name: "L. Hamilton", number: 44, liveryIndex: 1, skill: 0.96 },
  { name: "L. Norris", number: 4, liveryIndex: 2, skill: 0.95 },
  { name: "F. Alonso", number: 14, liveryIndex: 4, skill: 0.94 }
];

const CAR_SAFE_LAT_CLEARANCE = 2.55; // Minimum lateral clearance for side-by-side / passing
const CAR_LENGTH_BUFFER = 5.2;       // Longitudinal buffer for alongside checks (m)

export class AISimulator {
  public cars: AICarState[] = [];
  private _up = new Vector3(0, 1, 0);
  private _scratchPt = new Vector3();
  private _scratchTan = new Vector3();
  private _scratchLookaheadTan = new Vector3();
  private _scratchSide = new Vector3();
  private _scratchTarget = new Vector3();
  private _surfSample: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };
  private _surfFrontSample: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };
  private _surfRearSample: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };

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
      spline.sampleRoadSurface(tStart, lateral, track.width, this._surfSample);
      pos.y = this._surfSample.roadY;

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
        targetLateralOffset: lateral,
        targetSpeed: 0,
        collisionRecoveryTimer: 0,
        penaltySeconds: 0,
        lastTangentX: tangent.x,
        lastTangentZ: tangent.z,
        lastNormalX: side.x,
        lastNormalZ: side.z,
        surfaceForward: tangent.clone(),
        surfaceNormal: this._surfSample.normal.clone()
      };
    });
  }

  /** Signed wrap-around longitudinal distance from `fromT` to `toT` in meters. */
  private getSignedDeltaMeters(fromT: number, toT: number, trackLen: number): number {
    let deltaT = toT - fromT;
    if (deltaT > 0.5) deltaT -= 1.0;
    else if (deltaT < -0.5) deltaT += 1.0;
    return deltaT * trackLen;
  }

  /** Checks if a candidate lateral lane is clear of the player and all other AI cars. */
  private isLaneClear(
    selfIndex: number,
    candidateLat: number,
    maxLat: number,
    selfT: number,
    trackLen: number,
    playerT: number,
    playerLateral: number,
    hasPlayer: boolean
  ): boolean {
    if (Math.abs(candidateLat) > maxLat) return false;

    if (hasPlayer) {
      const longToPlayer = this.getSignedDeltaMeters(selfT, playerT, trackLen);
      if (longToPlayer > -6.5 && longToPlayer < 24.0) {
        if (Math.abs(candidateLat - playerLateral) < 2.35) {
          return false;
        }
      }
    }

    for (let j = 0; j < this.cars.length; j++) {
      if (j === selfIndex) continue;
      const other = this.cars[j];
      const longToOther = this.getSignedDeltaMeters(selfT, other.t, trackLen);
      if (longToOther > -6.0 && longToOther < 20.0) {
        if (Math.abs(candidateLat - other.lateralOffset) < 2.35) {
          return false;
        }
      }
    }

    return true;
  }

  public update(
    dt: number,
    track: Track,
    spline: Spline3D,
    playerPosition: Vector3,
    playerSpeed: number,
    playerT: number,
    playerLateralOffset: number,
    playerHeading: number,
    raceStarted: boolean
  ) {
    if (!raceStarted) return;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.04) : 0.016;
    const trackLen = spline.totalLength > 0 ? spline.totalLength : 4000;
    const safeTrackW = Number.isFinite(track.width) && track.width > 0 ? track.width : 6.8;
    const maxLat = Math.max(1.8, safeTrackW * 0.5 - 0.65); // Allow up to kerb edge for clean overtakes
    const hasPlayer = !!playerPosition && Number.isFinite(playerPosition.x) && Number.isFinite(playerT);
    const safePlayerSpeed = Number.isFinite(playerSpeed) ? playerSpeed : 0;
    const safePlayerLat = Number.isFinite(playerLateralOffset) ? playerLateralOffset : 0;

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const driverProfile = AI_ROSTER[i];

      // Defensive state sanitization
      if (!Number.isFinite(car.t)) car.t = 0;
      if (!Number.isFinite(car.speed)) car.speed = 0;
      if (!Number.isFinite(car.heading)) car.heading = 0;
      if (!Number.isFinite(car.steerAngle)) car.steerAngle = 0;
      if (!Number.isFinite(car.lateralOffset)) car.lateralOffset = 0;
      if (!Number.isFinite(car.targetLateralOffset)) car.targetLateralOffset = car.lateralOffset;

      if (car.collisionRecoveryTimer > 0) {
        car.collisionRecoveryTimer = Math.max(0, car.collisionRecoveryTimer - safeDt);
      }

      // 1. Sample spline geometry & curvature ahead
      const safeT = Math.max(0, Math.min(0.999999, ((car.t % 1) + 1) % 1));
      const lookaheadMeters = 30.0 + car.speed * 0.45;
      const lookaheadT = Math.max(0, Math.min(0.999999, (((safeT + lookaheadMeters / trackLen) % 1) + 1) % 1));

      spline.getPointAtToRef(safeT, this._scratchPt);
      spline.getTangentAtToRef(safeT, this._scratchTan);
      spline.getTangentAtToRef(lookaheadT, this._scratchLookaheadTan);

      Vector3.CrossToRef(this._scratchTan, this._up, this._scratchSide);
      this._scratchSide.normalize();

      car.lastTangentX = this._scratchTan.x;
      car.lastTangentZ = this._scratchTan.z;
      car.lastNormalX = this._scratchSide.x;
      car.lastNormalZ = this._scratchSide.z;

      // 2. Curvature detection for speed profiling (brake before tight turns)
      const dot = clamp(Vector3.Dot(this._scratchTan, this._scratchLookaheadTan), -1, 1);
      const curvature = 1.0 - dot; // 0 = straight, >0.1 = sharp turn
      const baseTopSpeed = 88 * driverProfile.skill; // ~316 km/h
      const cornerMaxSpeed = Math.max(26, baseTopSpeed - curvature * 340);

      car.targetSpeed = cornerMaxSpeed;

      // 3. Proactive Collision Prevention (TTC Braking, Lane Selection & Side-by-Side Room)
      let nearestAheadDist = Infinity;
      let nearestAheadSpeed = 0;
      let nearestAheadLat = 0;
      let sidePinPush = 0;
      let hasSideNeighbor = false;

      // Check player lateral trend (predictive swerve awareness)
      const playerLatRate = hasPlayer
        ? (Math.sin(playerHeading) * this._scratchSide.x + Math.cos(playerHeading) * this._scratchSide.z) * safePlayerSpeed
        : 0;
      const predictedPlayerLat = clamp(safePlayerLat + playerLatRate * 0.28, -maxLat - 1.5, maxLat + 1.5);

      // Evaluate Player hazard (only on same elevation tier)
      if (hasPlayer && Math.abs(car.position.y - playerPosition.y) < 1.8) {
        const longDist = this.getSignedDeltaMeters(safeT, playerT, trackLen);
        const latDiff = Math.abs(safePlayerLat - car.lateralOffset);
        const predLatDiff = Math.abs(predictedPlayerLat - car.lateralOffset);
        const effectiveLatDiff = Math.min(latDiff, predLatDiff);

        if (Math.abs(longDist) <= CAR_LENGTH_BUFFER) {
          // Side-by-side: enforce lateral racing room
          hasSideNeighbor = true;
          if (latDiff < CAR_SAFE_LAT_CLEARANCE) {
            const awayDir = car.lateralOffset >= safePlayerLat ? 1 : -1;
            sidePinPush += awayDir * (CAR_SAFE_LAT_CLEARANCE - latDiff + 0.35);
          }
        } else if (longDist > 0 && longDist < 48.0 && effectiveLatDiff < 2.45) {
          if (longDist < nearestAheadDist) {
            nearestAheadDist = longDist;
            nearestAheadSpeed = Math.max(0, safePlayerSpeed);
            nearestAheadLat = safePlayerLat;
          }
        } else if (longDist < -4.2 && longDist > -16.0 && safePlayerSpeed > car.speed + 8.0 && latDiff < 2.1) {
          // Player charging rapidly from directly behind: yield slightly if clear
          const yieldSign = car.lateralOffset >= safePlayerLat ? 1 : -1;
          sidePinPush += yieldSign * 0.9;
        }
      }

      // Evaluate other AI cars
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (Math.abs(car.position.y - other.position.y) >= 1.8) continue;

        const longDist = this.getSignedDeltaMeters(safeT, other.t, trackLen);
        const latDiff = Math.abs(other.lateralOffset - car.lateralOffset);

        if (Math.abs(longDist) <= CAR_LENGTH_BUFFER) {
          hasSideNeighbor = true;
          if (latDiff < CAR_SAFE_LAT_CLEARANCE) {
            const awayDir = car.lateralOffset >= other.lateralOffset ? 1 : -1;
            sidePinPush += awayDir * (CAR_SAFE_LAT_CLEARANCE - latDiff + 0.3);
          }
        } else if (longDist > 0 && longDist < 44.0 && latDiff < 2.4) {
          if (longDist < nearestAheadDist) {
            nearestAheadDist = longDist;
            nearestAheadSpeed = Math.max(0, other.speed);
            nearestAheadLat = other.lateralOffset;
          }
        }
      }

      // Dynamic Lane Selection & Side-by-Side Yielding
      const preferredHomeLat = ((i % 2 === 0 ? -1 : 1) * 0.45); // Subtle natural grid spread
      if (hasSideNeighbor && Math.abs(sidePinPush) > 0.05) {
        car.targetLateralOffset = clamp(car.lateralOffset + sidePinPush, -maxLat, maxLat);
      } else if (nearestAheadDist < 42.0 && !hasSideNeighbor) {
        // Attempt clean overtake to left or right lane
        const leftCand = clamp(nearestAheadLat - 2.65, -maxLat, maxLat);
        const rightCand = clamp(nearestAheadLat + 2.65, -maxLat, maxLat);
        const leftValid = Math.abs(leftCand - nearestAheadLat) >= 2.1 &&
          this.isLaneClear(i, leftCand, maxLat, safeT, trackLen, playerT, safePlayerLat, hasPlayer);
        const rightValid = Math.abs(rightCand - nearestAheadLat) >= 2.1 &&
          this.isLaneClear(i, rightCand, maxLat, safeT, trackLen, playerT, safePlayerLat, hasPlayer);

        if (leftValid && rightValid) {
          // Pick side closer to centerline / with more margin
          car.targetLateralOffset = Math.abs(leftCand) <= Math.abs(rightCand) ? leftCand : rightCand;
        } else if (leftValid) {
          car.targetLateralOffset = leftCand;
        } else if (rightValid) {
          car.targetLateralOffset = rightCand;
        } else {
          // No clear passing lane: stay slightly offset and brake safely
          car.targetLateralOffset = clamp(car.lateralOffset, -maxLat, maxLat);
        }
      } else if (!hasSideNeighbor && car.collisionRecoveryTimer <= 0) {
        // Gradually drift back toward racing line offset
        car.targetLateralOffset = lerp(car.targetLateralOffset, preferredHomeLat, safeDt * 0.8);
      }

      // TTC & Stopping-Distance Speed Control
      let emergencyBraking = false;
      if (nearestAheadDist < Infinity) {
        const closingSpeed = Math.max(0, car.speed - nearestAheadSpeed);
        const leadSq = nearestAheadSpeed * nearestAheadSpeed;
        const selfSq = car.speed * car.speed;
        const brakingDist = Math.max(0, selfSq - leadSq) / 56.0;
        const safeGap = 5.4 + brakingDist + closingSpeed * 0.42;

        if (nearestAheadDist < safeGap) {
          const gapSpan = Math.max(3.5, safeGap - 4.8);
          const gapRatio = clamp((nearestAheadDist - 4.8) / gapSpan, 0, 1);

          if (nearestAheadDist < 7.0) {
            // Imminent collision zone: allow braking all the way down to 0 m/s
            const hardCap = Math.max(0, nearestAheadSpeed * gapRatio - (7.0 - nearestAheadDist) * 2.5);
            car.targetSpeed = Math.min(car.targetSpeed, hardCap);
            emergencyBraking = true;
          } else {
            const matchCap = lerp(nearestAheadSpeed * 0.72, nearestAheadSpeed * 0.98, gapRatio);
            car.targetSpeed = Math.min(car.targetSpeed, Math.max(0, matchCap));
            if (closingSpeed > 10 && nearestAheadDist < 18) {
              emergencyBraking = true;
            }
          }
        }
      }

      // 4. Acceleration / Braking
      if (car.speed < car.targetSpeed) {
        car.speed += (24 * driverProfile.skill) * safeDt;
      } else {
        const brakeDecel = emergencyBraking ? 58 : 38;
        car.speed -= brakeDecel * safeDt;
      }
      car.speed = clamp(car.speed, 0, 95);

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

      // 6. Smooth Lateral Racing Line Positioning (rate-limited to prevent teleporting)
      const prevLat = car.lateralOffset;
      const desiredLatDelta = car.targetLateralOffset - car.lateralOffset;
      const maxLatStep = (car.collisionRecoveryTimer > 0 ? 1.8 : 4.2) * safeDt;
      car.lateralOffset = clamp(
        car.lateralOffset + clamp(desiredLatDelta, -maxLatStep, maxLatStep),
        -maxLat,
        maxLat
      );
      const latVelocity = (car.lateralOffset - prevLat) / safeDt;

      // Re-sample point at updated car.t so position advances cleanly
      spline.getPointAtToRef(car.t, this._scratchPt);
      spline.getTangentAtToRef(car.t, this._scratchTan);
      Vector3.CrossToRef(this._scratchTan, this._up, this._scratchSide);
      this._scratchSide.normalize();

      car.lastTangentX = this._scratchTan.x;
      car.lastTangentZ = this._scratchTan.z;
      car.lastNormalX = this._scratchSide.x;
      car.lastNormalZ = this._scratchSide.z;

      // Compute target 3D world position on spline with lateral offset
      this._scratchTarget.copyFrom(this._scratchPt).addInPlace(this._scratchSide.scale(car.lateralOffset));

      // Steer heading towards tangent + lateral lane-change angle
      const laneYawOffset = car.speed > 2.0 ? clamp(Math.atan2(latVelocity, car.speed), -0.35, 0.35) : 0;
      const targetHeading = Math.atan2(this._scratchTan.x, this._scratchTan.z) + laneYawOffset;
      if (Number.isFinite(targetHeading)) {
        const diff = shortestAngleDiff(car.heading, targetHeading);
        car.heading += diff * Math.min(1.0, safeDt * 10);
      }

      // Smooth position interpolation (yields gently during collision recovery)
      const posBlend = car.collisionRecoveryTimer > 0 ? Math.min(1.0, safeDt * 6) : Math.min(1.0, safeDt * 18);
      Vector3.LerpToRef(car.position, this._scratchTarget, posBlend, car.position);

      // Sample exact 2-axle road surface height & normal so AI tires stay planted on hills & banking
      spline.sampleRoadSurface(car.t, car.lateralOffset, track.width, this._surfSample);
      spline.sampleRoadSurface(car.t + 1.45 / trackLen, car.lateralOffset, track.width, this._surfFrontSample);
      spline.sampleRoadSurface(car.t - 1.15 / trackLen, car.lateralOffset, track.width, this._surfRearSample);
      const axleInterpY =
        this._surfRearSample.roadY +
        (this._surfFrontSample.roadY - this._surfRearSample.roadY) * (1.15 / 2.60);
      car.position.y = Math.max(this._surfSample.roadY, axleInterpY);
      car.surfaceNormal.copyFrom(this._surfSample.normal);
      const fwdX = Math.sin(car.heading);
      const fwdZ = Math.cos(car.heading);
      car.surfaceForward
        .set(fwdX * 2.60, this._surfFrontSample.roadY - this._surfRearSample.roadY, fwdZ * 2.60)
        .normalize();

      if (!Number.isFinite(car.position.x) || !Number.isFinite(car.position.y) || !Number.isFinite(car.position.z)) {
        car.position.copyFrom(this._scratchPt);
      }

      // Front wheel steer angle calculation
      const headingDelta = shortestAngleDiff(car.heading, targetHeading);
      car.steerAngle = clamp(headingDelta * 1.8, -0.5, 0.5);
    }
  }
}
