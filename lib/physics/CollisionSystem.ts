// Formula Racing 3D — Zero-Allocation Car-to-Car OBB Collision & FIA Penalty Solver
// Prevents ghost-car overlap via 2D Oriented Bounding Box SAT, elastic-plastic momentum transfer,
// barrier clamping, fault attribution, and Race Control time penalties.

import { Vector3 } from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { Spline3D } from "@/lib/math/Spline3D";
import { VehiclePhysics } from "@/lib/physics/VehiclePhysics";
import { AISimulator, AICarState } from "@/lib/ai/AIDriver";

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

// Physical car footprint calibrated to BabylonVehicle.ts dimensions (meters)
const CAR_HALF_WIDTH = 0.98;
const CAR_HALF_LENGTH = 2.15;
const CAR_CENTER_FWD_OFFSET = 0.38;
const ELEVATION_TOLERANCE = 1.8; // Skip bridge/underpass vertical crossings (e.g., Suzuka)

// Fault & Penalty Thresholds
const SCRAPE_THRESHOLD_MS = 3.5;      // < 12.6 km/h closing speed = physical rub, no penalty
const SEVERE_IMPACT_MS = 7.5;         // >= 27 km/h closing speed = immediate +5s penalty
const MINOR_PENALTY_SEC = 2;
const MAJOR_PENALTY_SEC = 5;
const PAIR_EVENT_COOLDOWN = 0.65;     // Seconds before another alert/penalty for the same pair

export interface CollisionFrameResult {
  hasImpact: boolean;
  severity: number; // 0.0 to 1.0
  closingSpeed: number;
  contactPoint: Vector3;
  opponentId: string;
  opponentName: string;
  opponentNumber: number;
  playerAtFault: boolean;
  penaltySecondsAdded: number;
  warningIssued: boolean;
}

export class CollisionSystem {
  private pairCooldowns: Map<string, number> = new Map();
  private raceElapsed: number = 0;

  // Pre-allocated scratch storage (zero per-frame allocations)
  private _contactPoint = new Vector3();
  private _satNormalX = 0;
  private _satNormalZ = 0;
  private _satDepth = 0;
  private _satContactX = 0;
  private _satContactY = 0;
  private _satContactZ = 0;

  private _result: CollisionFrameResult = {
    hasImpact: false,
    severity: 0,
    closingSpeed: 0,
    contactPoint: this._contactPoint,
    opponentId: "",
    opponentName: "",
    opponentNumber: 0,
    playerAtFault: false,
    penaltySecondsAdded: 0,
    warningIssued: false
  };

  public reset(): void {
    this.pairCooldowns.clear();
    this.raceElapsed = 0;
    this._result.hasImpact = false;
  }

  /**
   * 2D Oriented Bounding Box SAT test in XZ plane with Y-elevation gate.
   * Normal always points from B toward A (push direction for A).
   */
  private testOBBOverlap(
    ax: number,
    ay: number,
    az: number,
    headingA: number,
    bx: number,
    by: number,
    bz: number,
    headingB: number
  ): boolean {
    if (Math.abs(ay - by) > ELEVATION_TOLERANCE) {
      return false;
    }

    const fxA = Math.sin(headingA);
    const fzA = Math.cos(headingA);
    const rxA = fzA;
    const rzA = -fxA;

    const fxB = Math.sin(headingB);
    const fzB = Math.cos(headingB);
    const rxB = fzB;
    const rzB = -fxB;

    const cxA = ax + fxA * CAR_CENTER_FWD_OFFSET;
    const czA = az + fzA * CAR_CENTER_FWD_OFFSET;
    const cxB = bx + fxB * CAR_CENTER_FWD_OFFSET;
    const czB = bz + fzB * CAR_CENTER_FWD_OFFSET;

    const dx = cxA - cxB;
    const dz = czA - czB;

    // Quick bounding circle rejection before 4-axis SAT
    const maxRadiusSum = 4.9;
    if (dx * dx + dz * dz > maxRadiusSum * maxRadiusSum) {
      return false;
    }

    let minOverlap = Infinity;
    let bestNx = 0;
    let bestNz = 1;

    // Test 4 separating axes: A forward, A right, B forward, B right
    for (let axisIdx = 0; axisIdx < 4; axisIdx++) {
      let axisX = 0;
      let axisZ = 0;
      if (axisIdx === 0) {
        axisX = fxA;
        axisZ = fzA;
      } else if (axisIdx === 1) {
        axisX = rxA;
        axisZ = rzA;
      } else if (axisIdx === 2) {
        axisX = fxB;
        axisZ = fzB;
      } else {
        axisX = rxB;
        axisZ = rzB;
      }

      const centerDist = Math.abs(dx * axisX + dz * axisZ);
      const projA =
        CAR_HALF_LENGTH * Math.abs(fxA * axisX + fzA * axisZ) +
        CAR_HALF_WIDTH * Math.abs(rxA * axisX + rzA * axisZ);
      const projB =
        CAR_HALF_LENGTH * Math.abs(fxB * axisX + fzB * axisZ) +
        CAR_HALF_WIDTH * Math.abs(rxB * axisX + rzB * axisZ);

      const overlap = projA + projB - centerDist;
      if (overlap <= 0) {
        return false;
      }

      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = axisX;
        bestNz = axisZ;
      }
    }

    // Orient normal from B toward A
    if (dx * bestNx + dz * bestNz < 0) {
      bestNx = -bestNx;
      bestNz = -bestNz;
    }

    this._satNormalX = bestNx;
    this._satNormalZ = bestNz;
    this._satDepth = minOverlap;
    this._satContactX = 0.5 * (cxA + cxB);
    this._satContactY = 0.5 * (ay + by) + 0.35;
    this._satContactZ = 0.5 * (czA + czB);
    return true;
  }

  /**
   * Resolves all Player ↔ AI and AI ↔ AI collisions for the current frame.
   * Returns a reused result object (zero heap allocation).
   */
  public resolveAll(
    dt: number,
    player: VehiclePhysics,
    aiSim: AISimulator,
    track: Track,
    spline: Spline3D,
    raceActive: boolean
  ): CollisionFrameResult {
    const res = this._result;
    res.hasImpact = false;
    res.severity = 0;
    res.closingSpeed = 0;
    res.opponentId = "";
    res.opponentName = "";
    res.opponentNumber = 0;
    res.playerAtFault = false;
    res.penaltySecondsAdded = 0;
    res.warningIssued = false;

    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.04) : 0.016;
    this.raceElapsed += safeDt;

    if (!raceActive || aiSim.cars.length === 0) {
      return res;
    }

    const trackLen = spline.totalLength > 0 ? spline.totalLength : 4000;
    const safeTrackW = Number.isFinite(track.width) && track.width > 0 ? track.width : 6.8;
    const barrierMargin = safeTrackW * 0.5 + 0.95 + 3.0 - 0.95; // Armco inner limit

    // 1. Player ↔ AI Collision Detection & Resolution
    let playerMoved = false;
    for (let i = 0; i < aiSim.cars.length; i++) {
      const ai = aiSim.cars[i];
      if (
        !this.testOBBOverlap(
          player.position.x,
          player.position.y,
          player.position.z,
          player.heading,
          ai.position.x,
          ai.position.y,
          ai.position.z,
          ai.heading
        )
      ) {
        continue;
      }

      const nx = this._satNormalX;
      const nz = this._satNormalZ;
      const depth = this._satDepth;

      // Positional separation every frame (eliminates ghosting completely)
      const sepPad = depth + 0.04;
      const pShare = 0.55;
      const aShare = 0.45;

      player.position.x += nx * sepPad * pShare;
      player.position.z += nz * sepPad * pShare;
      playerMoved = true;

      const aiSepX = -nx * sepPad * aShare;
      const aiSepZ = -nz * sepPad * aShare;
      this.applyAISeparation(ai, aiSepX, aiSepZ, trackLen, barrierMargin);

      // Compute relative impact velocity
      const vPx = player.forward.x * player.speed + player.right.x * player.lateralVelocity;
      const vPz = player.forward.z * player.speed + player.right.z * player.lateralVelocity;
      const fxA = Math.sin(ai.heading);
      const fzA = Math.cos(ai.heading);
      const vAx = fxA * ai.speed;
      const vAz = fzA * ai.speed;

      const relVx = vPx - vAx;
      const relVz = vPz - vAz;
      const relVn = relVx * nx + relVz * nz; // Negative when closing in

      if (relVn < 0) {
        const closingSpeed = -relVn;
        const restitution = 0.28;
        const impulse = -(1 + restitution) * relVn;

        // Apply impulse to Player
        const dVPx = 0.52 * impulse * nx;
        const dVPz = 0.52 * impulse * nz;
        player.speed = clamp(
          player.speed + dVPx * player.forward.x + dVPz * player.forward.z,
          -15,
          101
        );
        player.lateralVelocity = clamp(
          player.lateralVelocity + dVPx * player.right.x + dVPz * player.right.z,
          -18,
          18
        );

        // Mild tangential scrub on heavy hits
        if (closingSpeed > 4.0) {
          player.speed *= 1 - clamp(closingSpeed * 0.008, 0, 0.22);
        }

        // Off-center yaw perturbation
        const cxP = player.position.x + player.forward.x * CAR_CENTER_FWD_OFFSET;
        const czP = player.position.z + player.forward.z * CAR_CENTER_FWD_OFFSET;
        const leverX = this._satContactX - cxP;
        const leverZ = this._satContactZ - czP;
        const torque = leverX * nz - leverZ * nx;
        player.heading += clamp(torque * closingSpeed * 0.0042, -0.14, 0.14);

        // Apply impulse to AI
        const dVAx = -0.48 * impulse * nx;
        const dVAz = -0.48 * impulse * nz;
        ai.speed = clamp(ai.speed + (dVAx * fxA + dVAz * fzA), 0, 95);
        const latBump = dVAx * ai.lastNormalX + dVAz * ai.lastNormalZ;
        ai.targetLateralOffset = clamp(ai.lateralOffset + latBump * 0.16, -barrierMargin, barrierMargin);
        ai.collisionRecoveryTimer = 0.45;

        // Fault & Penalty Evaluation (debounced per opponent pair)
        const lastEventTime = this.pairCooldowns.get(ai.id) ?? -99;
        if (closingSpeed >= 1.6 && this.raceElapsed - lastEventTime >= PAIR_EVENT_COOLDOWN) {
          this.pairCooldowns.set(ai.id, this.raceElapsed);

          const severity = clamp(closingSpeed / 22.0, 0.15, 1.0);
          res.hasImpact = true;
          res.severity = Math.max(res.severity, severity);
          res.closingSpeed = Math.max(res.closingSpeed, closingSpeed);
          res.contactPoint.set(this._satContactX, this._satContactY, this._satContactZ);
          res.opponentId = ai.id;
          res.opponentName = ai.name;
          res.opponentNumber = ai.number;

          if (closingSpeed >= SCRAPE_THRESHOLD_MS) {
            // Determine fault: did Player strike AI from behind/side or rejoin off-track?
            const toAIx = ai.position.x - player.position.x;
            const toAIz = ai.position.z - player.position.z;
            const distLen = Math.hypot(toAIx, toAIz) || 1;
            const forwardDotToAI = (player.forward.x * toAIx + player.forward.z * toAIz) / distLen;
            const playerFaster = player.speed >= ai.speed - 2.0;

            const playerAtFault =
              player.offTrack || (forwardDotToAI > 0.25 && playerFaster) || (forwardDotToAI > -0.15 && closingSpeed >= SEVERE_IMPACT_MS);

            res.playerAtFault = playerAtFault;

            if (playerAtFault) {
              player.drsLockedTimer = 1.5;

              if (closingSpeed >= SEVERE_IMPACT_MS) {
                player.penaltySeconds += MAJOR_PENALTY_SEC;
                res.penaltySecondsAdded = MAJOR_PENALTY_SEC;
              } else if (player.warnings === 0) {
                player.warnings += 1;
                res.warningIssued = true;
              } else {
                player.penaltySeconds += MINOR_PENALTY_SEC;
                res.penaltySecondsAdded = MINOR_PENALTY_SEC;
              }
            } else {
              // Rare unavoidable AI-on-player strike
              ai.penaltySeconds += MINOR_PENALTY_SEC;
            }
          }
        }
      }
    }

    if (playerMoved) {
      player.enforceBarrierBounds(track, spline, safeDt);
    }

    // 2. AI ↔ AI Collision Detection & Separation
    for (let i = 0; i < aiSim.cars.length; i++) {
      for (let j = i + 1; j < aiSim.cars.length; j++) {
        const carA = aiSim.cars[i];
        const carB = aiSim.cars[j];

        if (
          !this.testOBBOverlap(
            carA.position.x,
            carA.position.y,
            carA.position.z,
            carA.heading,
            carB.position.x,
            carB.position.y,
            carB.position.z,
            carB.heading
          )
        ) {
          continue;
        }

        const nx = this._satNormalX;
        const nz = this._satNormalZ;
        const halfSep = (this._satDepth + 0.03) * 0.5;

        this.applyAISeparation(carA, nx * halfSep, nz * halfSep, trackLen, barrierMargin);
        this.applyAISeparation(carB, -nx * halfSep, -nz * halfSep, trackLen, barrierMargin);

        const fxA = Math.sin(carA.heading);
        const fzA = Math.cos(carA.heading);
        const fxB = Math.sin(carB.heading);
        const fzB = Math.cos(carB.heading);

        const relVn = (fxA * carA.speed - fxB * carB.speed) * nx + (fzA * carA.speed - fzB * carB.speed) * nz;
        if (relVn < 0) {
          const avgSpeed = 0.5 * (carA.speed + carB.speed);
          const dV = -(1 + 0.2) * relVn * 0.5;
          carA.speed = clamp(carA.speed + dV * (nx * fxA + nz * fzA), 0, 95);
          carB.speed = clamp(carB.speed - dV * (nx * fxB + nz * fzB), 0, 95);
          // Prevent deadlocks if both are pinned nose-to-tail
          if (Math.abs(carA.speed - carB.speed) < 0.5 && avgSpeed > 2) {
            carA.collisionRecoveryTimer = 0.3;
            carB.collisionRecoveryTimer = 0.3;
          }
        }
      }
    }

    return res;
  }

  private applyAISeparation(
    ai: AICarState,
    sepX: number,
    sepZ: number,
    trackLen: number,
    barrierMargin: number
  ): void {
    ai.position.x += sepX;
    ai.position.z += sepZ;

    const deltaLong = sepX * ai.lastTangentX + sepZ * ai.lastTangentZ;
    const deltaLat = sepX * ai.lastNormalX + sepZ * ai.lastNormalZ;

    ai.t = ((ai.t + deltaLong / trackLen) % 1 + 1) % 1;
    ai.lateralOffset = clamp(ai.lateralOffset + deltaLat, -barrierMargin, barrierMargin);
    ai.targetLateralOffset = clamp(ai.targetLateralOffset + deltaLat * 0.5, -barrierMargin, barrierMargin);
    ai.collisionRecoveryTimer = Math.max(ai.collisionRecoveryTimer, 0.25);
  }
}
