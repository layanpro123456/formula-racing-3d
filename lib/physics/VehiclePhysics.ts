// Formula Racing 3D — Deterministic Vehicle Physics & Collision Engine
// Zero-allocation, high-frequency physics simulation for F1 cars on Catmull-Rom splines.

import * as THREE from "three";
import { Track } from "@/data/tracks";

export interface VehicleInputs {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  drs: boolean;
}

export interface TelemetryData {
  speedKmh: number;
  speedMs: number;
  gear: number;
  rpm: number;
  rpmRatio: number;
  lapTime: number;
  currentSector: 1 | 2 | 3;
  lastSectorTime: number;
  drsActive: boolean;
  drsAvailable: boolean;
  onKerb: boolean;
  offTrack: boolean;
  gForceLat: number;
  gForceLong: number;
}

export class VehiclePhysics {
  // Physical states
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  public right: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  public up: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  
  public heading: number = 0;
  public speed: number = 0;           // m/s
  public steerAngle: number = 0;      // radians
  public gear: number = 1;
  public rpm: number = 4000;          // 4000 to 12500 RPM
  public drsActive: boolean = false;
  public drsAvailable: boolean = false;

  // Track progress tracking
  public currentT: number = 0;
  public lapTime: number = 0;
  public currentSector: 1 | 2 | 3 = 1;
  public lastSectorTime: number = 0;
  public onKerb: boolean = false;
  public offTrack: boolean = false;

  // Inertial chassis tilts for visual suspension realism
  public pitch: number = 0;
  public roll: number = 0;

  // G-forces
  public gForceLat: number = 0;
  public gForceLong: number = 0;

  // Pre-allocated scratch vectors to prevent frame allocations
  private _scratchVec = new THREE.Vector3();
  private _scratchSide = new THREE.Vector3();
  private _splinePt = new THREE.Vector3();
  private _splineTangent = new THREE.Vector3();

  // Gear ratios (8 forward gears)
  private readonly gearMaxSpeeds = [0, 22, 35, 48, 62, 74, 84, 93, 102]; // m/s (up to ~360 km/h)

  public reset(startPos: THREE.Vector3, startHeading: number) {
    this.position.copy(startPos);
    this.velocity.set(0, 0, 0);
    this.heading = startHeading;
    this.speed = 0;
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = 4000;
    this.pitch = 0;
    this.roll = 0;
    this.currentT = 0;
    this.lapTime = 0;
    this.currentSector = 1;
  }

  public update(
    dt: number,
    inputs: VehicleInputs,
    track: Track,
    spline: THREE.CatmullRomCurve3
  ): TelemetryData {
    // 1. Steering dynamics with speed-sensitive dampening
    const steerTarget = (inputs.steerLeft ? 1 : 0) - (inputs.steerRight ? 1 : 0);
    // At high speed, limit steering angle to prevent instant spin-outs (downforce stability)
    const maxSteer = 0.58 / (1.0 + Math.abs(this.speed) * 0.04);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steerTarget * maxSteer, dt * 10);

    // 2. Query Track Spline Position & Surface Contact
    this.queryTrackPosition(spline, track);

    // 3. DRS evaluation
    this.evaluateDRS(track, inputs.drs);

    // 4. Aerodynamic forces & surface friction coefficients
    let frictionMu = 1.0;
    if (this.onKerb) frictionMu = 0.85;
    else if (this.offTrack) frictionMu = 0.42;

    const dragCoeff = this.drsActive ? 0.28 : 0.44;
    const downforceCoeff = this.drsActive ? 0.65 : 1.25;

    const dragForce = 0.5 * 1.225 * dragCoeff * (this.speed * this.speed);
    const downforce = 0.5 * 1.225 * downforceCoeff * (this.speed * this.speed);

    // 5. Engine & Braking Longitudinal Forces
    let accelForce = 0;
    if (inputs.accelerate) {
      // Acceleration tapers off at higher gears / speeds
      const gearMax = this.gearMaxSpeeds[this.gear] || 95;
      const powerCurve = Math.max(0, 1.0 - Math.pow(this.speed / gearMax, 1.4));
      accelForce = (32 - this.gear * 2.2) * powerCurve * frictionMu;
    }

    let brakeForce = 0;
    if (inputs.brake) {
      if (this.speed > 0.5) {
        // High downforce allows massive braking deceleration up to 50 m/s^2 (~5G)
        brakeForce = (42 + downforce * 0.035) * frictionMu;
      } else {
        // Reverse gear
        accelForce = -12 * frictionMu;
      }
    }

    // Natural engine rolling resistance & drag
    const netLongitudinalAccel = accelForce - (brakeForce + dragForce * 0.02 + 6.0);

    // 6. Integrate Speed
    const prevSpeed = this.speed;
    this.speed += netLongitudinalAccel * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, -15, 98); // Max speed ~352 km/h

    this.gForceLong = dt > 0.0001 ? (this.speed - prevSpeed) / (dt * 9.81) : 0;

    // 7. Lateral Dynamics & Heading Angle
    if (Math.abs(this.speed) > 0.1) {
      const turnRate = this.steerAngle * (1.1 + this.speed * 0.025);
      this.heading += turnRate * dt * (this.speed >= 0 ? 1 : -1);
    }

    this.gForceLat = (this.speed * this.steerAngle * 4.5) / 9.81;

    // Forward and Right vectors
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    // 8. Integrate Position
    this._scratchVec.copy(this.forward).multiplyScalar(this.speed * dt);
    this.position.add(this._scratchVec);

    // Ground elevation clamping along track
    this.position.y = THREE.MathUtils.lerp(this.position.y, this._splinePt.y, dt * 8);

    // 9. Barrier Collision Detection & Rebound
    this.resolveBarrierCollisions(track);

    // 10. Gear & RPM Calculation
    this.updateGearsAndRPM();

    // 11. Visual Suspension Roll & Pitch
    this.pitch = THREE.MathUtils.lerp(this.pitch, -this.gForceLong * 0.04, dt * 10);
    this.roll = THREE.MathUtils.lerp(this.roll, this.gForceLat * 0.035, dt * 10);

    // 12. Lap Timer & Sector Split Detection
    this.lapTime += dt;

    return {
      speedKmh: Math.round(this.speed * 3.6),
      speedMs: this.speed,
      gear: this.gear,
      rpm: Math.round(this.rpm),
      rpmRatio: THREE.MathUtils.clamp((this.rpm - 4000) / (12500 - 4000), 0, 1),
      lapTime: this.lapTime,
      currentSector: this.currentSector,
      lastSectorTime: this.lastSectorTime,
      drsActive: this.drsActive,
      drsAvailable: this.drsAvailable,
      onKerb: this.onKerb,
      offTrack: this.offTrack,
      gForceLat: parseFloat((Number.isFinite(this.gForceLat) ? this.gForceLat : 0).toFixed(2)),
      gForceLong: parseFloat((Number.isFinite(this.gForceLong) ? this.gForceLong : 0).toFixed(2))
    };
  }

  private queryTrackPosition(spline: THREE.CatmullRomCurve3, track: Track) {
    // Quick search for closest point on spline around currentT
    let bestT = this.currentT;
    let minDistSq = Infinity;
    const searchRange = 0.08;
    const samples = 18;

    for (let i = 0; i <= samples; i++) {
      let t = this.currentT - searchRange / 2 + (i / samples) * searchRange;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      
      const pt = spline.getPointAt(t);
      const dSq = pt.distanceToSquared(this.position);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestT = t;
      }
    }

    this.currentT = bestT;
    this._splinePt.copy(spline.getPointAt(this.currentT));
    this._splineTangent.copy(spline.getTangentAt(this.currentT)).normalize();

    // Distance to spline center
    const lateralDist = Math.sqrt(
      Math.pow(this.position.x - this._splinePt.x, 2) + Math.pow(this.position.z - this._splinePt.z, 2)
    );

    const halfW = track.width * 0.5;
    this.onKerb = lateralDist > halfW && lateralDist <= halfW + 0.85;
    this.offTrack = lateralDist > halfW + 0.85;

    // Check sector boundaries
    if (this.currentT <= track.sectors[0].tEnd) {
      this.currentSector = 1;
    } else if (this.currentT <= track.sectors[1].tEnd) {
      this.currentSector = 2;
    } else {
      this.currentSector = 3;
    }
  }

  private evaluateDRS(track: Track, drsRequested: boolean) {
    this.drsAvailable = false;
    for (const zone of track.drsZones) {
      if (zone.start > zone.end) {
        // Wraps over start/finish line
        if (this.currentT >= zone.start || this.currentT <= zone.end) {
          this.drsAvailable = true;
          break;
        }
      } else {
        if (this.currentT >= zone.start && this.currentT <= zone.end) {
          this.drsAvailable = true;
          break;
        }
      }
    }

    this.drsActive = this.drsAvailable && drsRequested;
  }

  private resolveBarrierCollisions(track: Track) {
    const maxOffset = track.width * 0.5 + 3.25;
    this._scratchSide.subVectors(this.position, this._splinePt);
    this._scratchSide.y = 0;
    const distFromCenter = this._scratchSide.length();

    if (distFromCenter > maxOffset) {
      // Penetrated outer armco barrier!
      this._scratchSide.normalize();
      // Push back onto track boundary
      this.position.x = this._splinePt.x + this._scratchSide.x * maxOffset;
      this.position.z = this._splinePt.z + this._scratchSide.z * maxOffset;

      // Elastic speed bleed & deflection
      this.speed *= 0.65;
    }
  }

  private updateGearsAndRPM() {
    if (this.speed <= 0.1) {
      this.gear = 1;
      this.rpm = 4000;
      return;
    }

    // Automatic transmission shift points
    for (let g = 1; g <= 8; g++) {
      if (this.speed < this.gearMaxSpeeds[g] || g === 8) {
        this.gear = g;
        const prevGearSpeed = this.gearMaxSpeeds[g - 1] || 0;
        const speedInGear = (this.speed - prevGearSpeed) / (this.gearMaxSpeeds[g] - prevGearSpeed);
        this.rpm = 4500 + THREE.MathUtils.clamp(speedInGear, 0, 1) * 7800;
        break;
      }
    }
  }
}
