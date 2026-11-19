// Formula Racing 3D — Real-World Motorsport Vehicle Physics Engine
// 4-wheel dynamic load transfer, Pacejka slip friction, brake thermal model, and non-radial barrier collision.
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

export interface VehicleInputs {
  throttle?: number;     // 0.0 to 1.0 (analog)
  brake?: number;        // 0.0 to 1.0 (analog)
  steer?: number;        // -1.0 (left) to +1.0 (right) (analog)
  drs?: boolean;
  accelerate?: boolean;
  steerLeft?: boolean;
  steerRight?: boolean;
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
  brakeTemp: number;     // 100 to 950 deg C
  isLockup: boolean;      // Inside front wheel locked
  tireSlip: number;      // 0 to 1 slip intensity
  suspensionOffsets: [number, number, number, number]; // FL, FR, RL, RR vertical deflection in meters
}

export class VehiclePhysics {
  // Physical states
  public position: Vector3 = new Vector3();
  public velocity: Vector3 = new Vector3();
  public forward: Vector3 = new Vector3(0, 0, 1);
  public right: Vector3 = new Vector3(1, 0, 0);
  public up: Vector3 = new Vector3(0, 1, 0);
  
  public heading: number = 0;
  public speed: number = 0;           // m/s
  public steerAngle: number = 0;      // radians
  public gear: number = 1;
  public rpm: number = 4000;          // 4000 to 12500 RPM
  public drsActive: boolean = false;
  public drsAvailable: boolean = false;

  // Track progress tracking
  public currentT: number = 0;
  public signedLateralDistance: number = 0;
  public lateralDistance: number = 0;
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

  // Brake disc thermal model (deg C)
  public brakeTemp: number = 100;
  public isLockup: boolean = false;
  public tireSlip: number = 0;

  // 4-wheel independent vertical suspension deflections (FL, FR, RL, RR)
  public suspensionOffsets: [number, number, number, number] = [0, 0, 0, 0];

  // Pre-allocated scratch vectors to prevent frame allocations
  private _scratchVec = new Vector3();
  private _scratchSide = new Vector3();
  private _splinePt = new Vector3();
  private _splineTangent = new Vector3(0, 0, 1);
  private _splineNormal = new Vector3(1, 0, 0);

  // Reusable telemetry output object (zero allocations)
  private _telemetryData: TelemetryData = {
    speedKmh: 0,
    speedMs: 0,
    gear: 1,
    rpm: 4000,
    rpmRatio: 0,
    lapTime: 0,
    currentSector: 1,
    lastSectorTime: 0,
    drsActive: false,
    drsAvailable: false,
    onKerb: false,
    offTrack: false,
    gForceLat: 0,
    gForceLong: 0,
    brakeTemp: 100,
    isLockup: false,
    tireSlip: 0,
    suspensionOffsets: [0, 0, 0, 0]
  };

  // F1 Vehicle Physical Constants
  private readonly mass = 798;          // kg (FIA minimum weight)
  private readonly hCog = 0.32;         // Center of gravity height (m)
  private readonly wheelbase = 3.6;     // Wheelbase length (m)
  private readonly trackWidth = 1.6;    // Axle track width (m)
  private readonly g = 9.81;

  // Gear ratios (8 forward gears)
  private readonly gearMaxSpeeds = [0, 22, 35, 48, 62, 74, 84, 93, 102]; // m/s (up to ~365 km/h)

  public reset(startPos: Vector3, startHeading: number) {
    this.position.copyFrom(startPos);
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y) || !Number.isFinite(this.position.z)) {
      this.position.set(0, 0, 0);
    }
    this.velocity.set(0, 0, 0);
    this.heading = Number.isFinite(startHeading) ? startHeading : 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = 4000;
    this.pitch = 0;
    this.roll = 0;
    this.gForceLat = 0;
    this.gForceLong = 0;
    this.currentT = 0;
    this.signedLateralDistance = 0;
    this.lateralDistance = 0;
    this.lapTime = 0;
    this.currentSector = 1;
    this.lastSectorTime = 0;
    this.brakeTemp = 100;
    this.isLockup = false;
    this.tireSlip = 0;
    this.suspensionOffsets[0] = 0;
    this.suspensionOffsets[1] = 0;
    this.suspensionOffsets[2] = 0;
    this.suspensionOffsets[3] = 0;
  }

  public update(
    dt: number,
    inputs: VehicleInputs,
    track: Track,
    spline: Spline3D
  ): TelemetryData {
    // 0. Defensive runtime guard on time-delta and all internal states
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.04) : 0.016;
    if (!Number.isFinite(this.speed)) this.speed = 0;
    if (!Number.isFinite(this.heading)) this.heading = 0;
    if (!Number.isFinite(this.steerAngle)) this.steerAngle = 0;
    if (!Number.isFinite(this.pitch)) this.pitch = 0;
    if (!Number.isFinite(this.roll)) this.roll = 0;
    if (!Number.isFinite(this.lapTime)) this.lapTime = 0;
    if (!Number.isFinite(this.currentT)) this.currentT = 0;

    // 1. Normalized Analog Inputs
    const throttle = typeof inputs.throttle === "number" && Number.isFinite(inputs.throttle)
      ? clamp(inputs.throttle, 0, 1)
      : (inputs.accelerate ? 1.0 : 0.0);

    const brake = typeof inputs.brake === "number" && Number.isFinite(inputs.brake)
      ? clamp(inputs.brake, 0, 1)
      : 0.0;

    let steerInput = 0;
    if (typeof inputs.steer === "number" && Number.isFinite(inputs.steer)) {
      steerInput = clamp(inputs.steer, -1.0, 1.0);
    } else {
      if (inputs.steerLeft) steerInput -= 1.0;
      if (inputs.steerRight) steerInput += 1.0;
    }

    // 2. Speed-Sensitive Steering Dynamics
    // High speeds require progressive aerodynamic steering damping to prevent snap spins
    const maxSteer = 0.52 / (1.0 + Math.abs(this.speed) * 0.034);
    const steerTarget = steerInput * maxSteer;
    this.steerAngle = lerp(this.steerAngle, steerTarget, safeDt * 14);

    // 3. DRS evaluation
    this.evaluateDRS(track, !!inputs.drs);

    // 4. Surface Friction & Aerodynamics
    let frictionMu = 1.0;
    if (this.onKerb) frictionMu = 0.88;
    else if (this.offTrack) frictionMu = 0.42;

    const dragCoeff = this.drsActive ? 0.28 : 0.44;
    const downforceCoeff = this.drsActive ? 0.62 : 1.28;
    const dragForce = 0.5 * 1.225 * dragCoeff * (this.speed * this.speed);
    const downforce = 0.5 * 1.225 * downforceCoeff * (this.speed * this.speed);

    // 5. Dynamic Weight Load Transfer
    const totalVerticalLoad = this.mass * this.g + downforce;
    const baseLoad = totalVerticalLoad / 4;
    const ax = this.gForceLong * this.g;
    const deltaFzLong = (this.mass * ax * this.hCog) / this.wheelbase;
    const ay = this.gForceLat * this.g;
    const deltaFzLat = (this.mass * ay * this.hCog) / this.trackWidth;

    const fzFL = Math.max(200, baseLoad - deltaFzLong * 0.5 - deltaFzLat * 0.5);
    const fzFR = Math.max(200, baseLoad - deltaFzLong * 0.5 + deltaFzLat * 0.5);
    const insideFrontLoad = this.steerAngle > 0 ? fzFR : fzFL;

    // 6. Engine Propulsion & Braking Dynamics
    let accelForce = 0;
    let brakeForce = 0;
    this.isLockup = false;

    if (throttle > 0.01) {
      if (this.speed < -0.2) {
        // Oppose reverse motion with braking to bring car to rest
        brakeForce = 25 * frictionMu;
      } else {
        const gearMax = this.gearMaxSpeeds[this.gear] || 95;
        const safeSpeedRatio = Math.max(0, Math.min(1, Math.max(0, this.speed) / gearMax));
        const powerCurve = Math.max(0, 1.0 - Math.pow(safeSpeedRatio, 1.35));
        accelForce = (33 - this.gear * 2.1) * powerCurve * frictionMu * throttle;
      }
    }

    if (brake > 0.01) {
      if (this.speed > 0.5) {
        // High downforce allows massive 5G braking at top speed
        const maxBrakingDecel = (46 + downforce * 0.038) * frictionMu;
        brakeForce = maxBrakingDecel * brake;

        // Inside front lockup detection under heavy trail braking
        if (this.speed < 40 && insideFrontLoad < baseLoad * 0.75 && Math.abs(this.steerAngle) > 0.15) {
          this.isLockup = true;
          brakeForce *= 0.88;
        }

        const heatGen = (Math.max(0, this.speed) * 12.0) * safeDt * brake;
        this.brakeTemp = Math.min(950, this.brakeTemp + heatGen);
      } else if (this.speed > 0.05) {
        // Coming to a complete stop
        this.speed = 0;
        brakeForce = 35;
      } else {
        // Reverse gear from standstill
        accelForce = -9 * frictionMu * brake;
      }
    }

    // Cooling of brake discs via ram-air ducts
    const coolingRate = 1.6 + (Math.max(0, this.speed) / 24);
    this.brakeTemp = Math.max(100, lerp(this.brakeTemp, 100, safeDt * coolingRate));

    // Rolling resistance & Net longitudinal acceleration
    let netLongitudinalAccel = 0;
    if (this.speed > 0.05) {
      const resistance = brakeForce + dragForce * 0.018 + 5.8;
      netLongitudinalAccel = accelForce - resistance;
    } else if (this.speed < -0.05) {
      const resistance = brakeForce + dragForce * 0.018 + 5.8;
      netLongitudinalAccel = accelForce + resistance;
    } else {
      if (throttle > 0.01 || brake > 0.01) {
        netLongitudinalAccel = accelForce;
      } else {
        netLongitudinalAccel = 0;
        this.speed = 0;
      }
    }

    // 7. Integrate Speed & Long G-Force
    const prevSpeed = this.speed;
    this.speed += netLongitudinalAccel * safeDt;

    // Prevent overshoot into reverse/forward when coasting to a stop
    if (throttle <= 0.01 && brake <= 0.01) {
      if ((prevSpeed > 0 && this.speed < 0) || (prevSpeed < 0 && this.speed > 0) || Math.abs(this.speed) < 0.05) {
        this.speed = 0;
      }
    }

    this.speed = clamp(this.speed, -15, 101); // Top speed ~364 km/h
    this.gForceLong = safeDt > 0.0001 ? (this.speed - prevSpeed) / (safeDt * this.g) : 0;

    // 8. Lateral Dynamics & Handling
    // Pacejka lateral grip with progressive high-speed cornering stability
    const turnRate = (this.speed / this.wheelbase) * Math.sin(this.steerAngle);
    if (Math.abs(this.speed) > 0.1) {
      this.heading += turnRate * safeDt;
    } else if (throttle > 0.01 || brake > 0.01 || Math.abs(this.steerAngle) > 0.05) {
      // Low-speed breakaway steering to recover from barrier contact or hairpin spin
      this.heading += this.steerAngle * 2.2 * safeDt * (this.speed < -0.1 ? -1 : 1);
    }

    this.gForceLat = (this.speed * Math.sin(this.steerAngle) * 4.6) / this.g;

    // Tire slip intensity for audio and smoke effects
    const latSlip = Math.abs(this.steerAngle) * (Math.abs(this.speed) / 50);
    this.tireSlip = clamp(this.isLockup ? 1.0 : latSlip, 0, 1);

    // Forward and Right unit vectors
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    // 9. Integrate Vehicle Position
    this._scratchVec.copyFrom(this.forward).scaleInPlace(this.speed * safeDt);
    this.position.addInPlace(this._scratchVec);

    // 10. Track Query & Surface Classification (Executed AFTER position integration)
    this.queryTrackPosition(spline, track);

    // Ground elevation clamping along track
    if (Number.isFinite(this._splinePt.y)) {
      this.position.y = lerp(this.position.y, this._splinePt.y, safeDt * 12);
    }

    // 11. Non-Radial Barrier Collision Resolution
    this.resolveBarrierCollisions(track, safeDt);

    // 12. Gear & RPM Calculation
    this.updateGearsAndRPM();

    // 13. Visual Suspension Roll, Pitch & 4-Wheel Deflections
    this.pitch = lerp(this.pitch, -this.gForceLong * 0.038, safeDt * 10);
    this.roll = lerp(this.roll, this.gForceLat * 0.032, safeDt * 10);

    const kerbVibe = this.onKerb && Number.isFinite(this.lapTime) ? Math.sin(this.lapTime * 65) * 0.025 : 0;
    this.suspensionOffsets[0] = clamp(-this.pitch * 0.4 + this.roll * 0.3 + kerbVibe, -0.06, 0.06);
    this.suspensionOffsets[1] = clamp(-this.pitch * 0.4 - this.roll * 0.3 + kerbVibe, -0.06, 0.06);
    this.suspensionOffsets[2] = clamp(this.pitch * 0.4 + this.roll * 0.3, -0.06, 0.06);
    this.suspensionOffsets[3] = clamp(this.pitch * 0.4 - this.roll * 0.3, -0.06, 0.06);

    // 14. Lap Timer & Sector Detection
    this.lapTime += safeDt;

    // 15. Publish Telemetry Data (Reusing output object without heap allocations)
    const safeSpeedVal = Number.isFinite(this.speed) ? this.speed : 0;
    const safeRpmVal = Number.isFinite(this.rpm) ? this.rpm : 4000;

    this._telemetryData.speedKmh = Math.round(safeSpeedVal * 3.6);
    this._telemetryData.speedMs = safeSpeedVal;
    this._telemetryData.gear = Number.isFinite(this.gear) ? this.gear : 1;
    this._telemetryData.rpm = Math.round(safeRpmVal);
    this._telemetryData.rpmRatio = clamp((safeRpmVal - 4000) / (12500 - 4000), 0, 1);
    this._telemetryData.lapTime = Number.isFinite(this.lapTime) ? this.lapTime : 0;
    this._telemetryData.currentSector = this.currentSector;
    this._telemetryData.lastSectorTime = this.lastSectorTime;
    this._telemetryData.drsActive = this.drsActive;
    this._telemetryData.drsAvailable = this.drsAvailable;
    this._telemetryData.onKerb = this.onKerb;
    this._telemetryData.offTrack = this.offTrack;
    this._telemetryData.gForceLat = parseFloat((Number.isFinite(this.gForceLat) ? this.gForceLat : 0).toFixed(2));
    this._telemetryData.gForceLong = parseFloat((Number.isFinite(this.gForceLong) ? this.gForceLong : 0).toFixed(2));
    this._telemetryData.brakeTemp = Math.round(this.brakeTemp);
    this._telemetryData.isLockup = this.isLockup;
    this._telemetryData.tireSlip = parseFloat((Number.isFinite(this.tireSlip) ? this.tireSlip : 0).toFixed(2));

    return this._telemetryData;
  }

  private queryTrackPosition(spline: Spline3D, track: Track) {
    // Allocation-free query against identical Catmull-Rom spline
    const query = spline.queryClosest(
      this.position,
      this.currentT,
      this._splinePt,
      this._splineTangent,
      this._splineNormal
    );

    this.currentT = query.u;
    this.lateralDistance = query.lateralDistance;
    this.signedLateralDistance = query.signedLateralDistance;

    // Track width parameters matching BabylonTrackGenerator:
    // Road: [-halfW, +halfW]
    // Kerb: [halfW, halfW + kerbW]
    // Runoff: [halfW + kerbW, barrierOffset]
    const safeTrackW = Number.isFinite(track.width) && track.width > 0 ? track.width : 6.8;
    const halfW = safeTrackW * 0.5;
    const kerbW = 0.95;

    this.onKerb = this.lateralDistance > halfW && this.lateralDistance <= (halfW + kerbW);
    this.offTrack = this.lateralDistance > (halfW + kerbW);

    // Sector evaluation
    const s1End = track.sectors?.[0]?.tEnd ?? 0.33;
    const s2End = track.sectors?.[1]?.tEnd ?? 0.67;
    if (this.currentT <= s1End) {
      this.currentSector = 1;
    } else if (this.currentT <= s2End) {
      this.currentSector = 2;
    } else {
      this.currentSector = 3;
    }
  }

  private evaluateDRS(track: Track, drsRequested: boolean) {
    this.drsAvailable = false;
    if (Array.isArray(track.drsZones)) {
      for (const zone of track.drsZones) {
        if (zone.start > zone.end) {
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
    }

    this.drsActive = this.drsAvailable && !!drsRequested;
  }

  private resolveBarrierCollisions(track: Track, dt: number) {
    const safeTrackW = Number.isFinite(track.width) && track.width > 0 ? track.width : 6.8;
    const halfW = safeTrackW * 0.5;
    const kerbW = 0.95;
    const runoffW = 3.0;
    const barrierOffset = halfW + kerbW + runoffW; // Exact match with 3D Armco tube position

    // Non-radial barrier collision: deflect purely in the lateral normal direction
    if (this.lateralDistance > barrierOffset) {
      const sign = this.signedLateralDistance >= 0 ? 1 : -1;
      const excess = this.lateralDistance - (barrierOffset - 0.08);

      // Correct position strictly perpendicular to centerline without longitudinal shift
      this.position.x -= sign * excess * this._splineNormal.x;
      this.position.z -= sign * excess * this._splineNormal.z;

      // Update stored lateral distance
      this.lateralDistance = barrierOffset - 0.08;
      this.signedLateralDistance = sign * this.lateralDistance;

      // Realistic wall friction deceleration only at speed
      if (Math.abs(this.speed) > 2.0) {
        this.speed = Math.max(0, this.speed - 24 * dt);
      }

      // Deflect heading slightly along tangent to slide smoothly along barrier
      const tanHeading = Math.atan2(this._splineTangent.x, this._splineTangent.z);
      if (Number.isFinite(tanHeading)) {
        this.heading = lerp(this.heading, tanHeading, dt * 7);
      }
    }
  }

  private updateGearsAndRPM() {
    if (!Number.isFinite(this.speed) || this.speed <= 0.1) {
      this.gear = 1;
      this.rpm = 4000;
      return;
    }

    const safeSpeed = Math.max(0, this.speed);
    this.gear = 1;
    for (let g = 1; g <= 8; g++) {
      if (safeSpeed < this.gearMaxSpeeds[g] || g === 8) {
        this.gear = g;
        const prevGearSpeed = this.gearMaxSpeeds[g - 1] || 0;
        const gearSpan = Math.max(1, this.gearMaxSpeeds[g] - prevGearSpeed);
        const speedInGear = (safeSpeed - prevGearSpeed) / gearSpan;
        this.rpm = Math.min(12500, Math.max(4000, 4200 + speedInGear * (12000 - 4200)));
        break;
      }
    }
  }
}
