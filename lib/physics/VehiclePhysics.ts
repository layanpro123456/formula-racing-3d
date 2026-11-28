// Formula Racing 3D — Real-World Motorsport Vehicle Physics Engine
// 4-wheel dynamic load transfer, Pacejka slip friction, brake thermal model, and non-radial barrier collision.
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
  currentT: number;
  isReverse: boolean;
  isShifting: boolean;
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
  penaltySeconds: number;
  warnings: number;
  drsLocked: boolean;
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
  public steeringSensitivity: number = 1.0;
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

  // Road surface orientation at vehicle position (pitch/roll aligned to hills & banking)
  public surfaceForward: Vector3 = new Vector3(0, 0, 1);
  public surfaceNormal: Vector3 = new Vector3(0, 1, 0);

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
  private _centerSurface: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };
  private _frontSurface: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };
  private _rearSurface: RoadSurfaceSample = {
    roadY: 0.03,
    normal: new Vector3(0, 1, 0),
    tangent: new Vector3(0, 0, 1),
    bankedSide: new Vector3(-1, 0, 0)
  };
  private _targetSurfForward = new Vector3(0, 0, 1);

  // Automatic Transmission state
  public shiftCooldown: number = 0;
  public shiftCutTimer: number = 0;
  public isShifting: boolean = false;
  public lateralVelocity: number = 0; // m/s

  // Race Control Penalties & Incident State
  public penaltySeconds: number = 0;
  public warnings: number = 0;
  public drsLockedTimer: number = 0;
  public totalRaceTime: number = 0;

  public onBarrierImpact?: (impactSpeed: number) => void;
  public onGearShift?: (newGear: number, oldGear: number) => void;

  // Reusable telemetry output object (zero allocations)
  private _telemetryData: TelemetryData = {
    speedKmh: 0,
    speedMs: 0,
    gear: 1,
    rpm: 4000,
    rpmRatio: 0,
    currentT: 0,
    isReverse: false,
    isShifting: false,
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
    suspensionOffsets: [0, 0, 0, 0],
    penaltySeconds: 0,
    warnings: 0,
    drsLocked: false
  };

  // F1 Vehicle Physical Constants
  private readonly mass = 798;          // kg (FIA minimum weight)
  private readonly hCog = 0.32;         // Center of gravity height (m)
  private readonly wheelbase = 3.6;     // Wheelbase length (m)
  private readonly trackWidth = 1.6;    // Axle track width (m)
  private readonly g = 9.81;

  // Calibrated gear max speeds (m/s) at ~12,200 RPM
  private readonly gearMaxSpeeds = [0, 27, 38, 49, 61, 73, 83, 92, 102];
  // Calibrated base acceleration per gear (m/s²)
  private readonly gearBaseAccel = [0, 18.2, 14.8, 12.5, 10.5, 8.8, 7.4, 6.2, 5.2];

  public reset(startPos: Vector3, startHeading: number, track?: Track, spline?: Spline3D) {
    this.position.copyFrom(startPos);
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y) || !Number.isFinite(this.position.z)) {
      this.position.set(0, 0, 0);
    }
    this.velocity.set(0, 0, 0);
    this.heading = Number.isFinite(startHeading) ? startHeading : 0;
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    this.surfaceForward.copyFrom(this.forward);
    this.surfaceNormal.set(0, 1, 0);
    if (track && spline) {
      spline.sampleRoadSurface(0, 0, track.width, this._centerSurface);
      this.position.y = this._centerSurface.roadY;
      this.surfaceNormal.copyFrom(this._centerSurface.normal);
    } else {
      this.position.y += 0.03;
    }
    this.speed = 0;
    this.lateralVelocity = 0;
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = 4000;
    this.shiftCooldown = 0;
    this.shiftCutTimer = 0;
    this.isShifting = false;
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
    this.penaltySeconds = 0;
    this.warnings = 0;
    this.drsLockedTimer = 0;
    this.totalRaceTime = 0;
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
    // Fast response at low-medium speed, progressive downforce damping at high speed
    const sensFactor = Math.max(0.5, Math.min(1.6, Number.isFinite(this.steeringSensitivity) ? this.steeringSensitivity : 1.0));
    const maxSteer = (0.56 * (0.8 + 0.2 * sensFactor)) / (1.0 + Math.abs(this.speed) * 0.024);
    const steerTarget = steerInput * maxSteer;
    const steerSpeed = (Math.abs(steerTarget) < Math.abs(this.steerAngle) ? 26 : 22) * sensFactor;
    this.steerAngle = lerp(this.steerAngle, steerTarget, safeDt * steerSpeed);

    // 3. DRS evaluation
    if (this.drsLockedTimer > 0) {
      this.drsLockedTimer = Math.max(0, this.drsLockedTimer - safeDt);
    }
    this.evaluateDRS(track, !!inputs.drs);

    // 4. Surface Friction & Aerodynamics
    let frictionMu = 1.0;
    if (this.onKerb) frictionMu = 0.88;
    else if (this.offTrack) frictionMu = 0.42;

    const dragCoeff = this.drsActive ? 0.28 : 0.44;
    const downforceCoeff = this.drsActive ? 0.62 : 1.28;
    const dragForce = 0.5 * 1.225 * dragCoeff * (this.speed * this.speed);
    const dragDecel = dragForce / this.mass;
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
        if (this.shiftCutTimer > 0) {
          // Ignition cut during upshift
          accelForce = 0;
        } else {
          const gIndex = Math.max(1, Math.min(8, this.gear));
          const baseAccel = this.gearBaseAccel[gIndex];
          // Realistic internal combustion torque plateau across 4000 to 12200 RPM
          const rpmNorm = clamp((this.rpm - 4000) / (12200 - 4000), 0, 1);
          const torqueFactor = 0.82 + 0.18 * Math.sin(rpmNorm * Math.PI);
          accelForce = baseAccel * torqueFactor * frictionMu * throttle;
        }
      }
    }

    if (brake > 0.01) {
      if (this.speed > 0.5) {
        // High downforce allows massive 5G braking at top speed
        const maxBrakingDecel = (32 + (downforce / this.mass)) * frictionMu;
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
    const rollingResist = 0.8 + (Math.max(0, this.speed) * 0.008);
    let netLongitudinalAccel = 0;
    if (this.speed > 0.05) {
      const resistance = brakeForce + dragDecel + rollingResist;
      netLongitudinalAccel = accelForce - resistance;
    } else if (this.speed < -0.05) {
      const resistance = brakeForce + dragDecel + rollingResist;
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

    // 8. Lateral Dynamics & Handling (Bicycle model with dynamic lateral slip)
    const turnRate = (this.speed / this.wheelbase) * Math.sin(this.steerAngle);
    if (Math.abs(this.speed) > 1.2) {
      this.heading += turnRate * safeDt;
      // Centripetal acceleration
      const idealLatAccel = this.speed * turnRate;
      const maxLatG = (2.2 + (downforce / (this.mass * this.g)) * 1.5) * frictionMu;
      const maxLatAccel = maxLatG * this.g;

      // If centripetal demand exceeds tire grip limit, slip sideways
      if (Math.abs(idealLatAccel) > maxLatAccel) {
        const excessAccel = (Math.abs(idealLatAccel) - maxLatAccel) * Math.sign(idealLatAccel);
        this.lateralVelocity += excessAccel * safeDt * 0.65;
      }
      // Progressive grip damping on lateral slide
      this.lateralVelocity = lerp(this.lateralVelocity, 0, safeDt * (8.5 * frictionMu));
    } else {
      // High-authority low speed / stationary turnaround
      this.lateralVelocity = 0;
      if (throttle > 0.01 || brake > 0.01 || Math.abs(steerInput) > 0.05) {
        const steerDir = this.speed < -0.1 ? -1 : 1;
        this.heading += steerInput * 3.4 * safeDt * steerDir;
      }
    }

    this.gForceLat = ((this.speed * Math.sin(this.steerAngle) * 3.8) + (this.lateralVelocity * 2.5)) / this.g;

    // Tire slip intensity for audio, sparks, smoke and telemetry
    const slipRatio = Math.abs(this.lateralVelocity) / (Math.abs(this.speed) + 2.0);
    const steerSlip = Math.abs(this.steerAngle) * (Math.abs(this.speed) / 45);
    this.tireSlip = clamp(this.isLockup ? 1.0 : (slipRatio * 1.6 + steerSlip * 0.4), 0, 1);

    // Forward and Right unit vectors
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    // 9. Integrate Vehicle Position with forward and lateral velocity
    this._scratchVec.copyFrom(this.forward).scaleInPlace(this.speed * safeDt);
    this._scratchSide.copyFrom(this.right).scaleInPlace(this.lateralVelocity * safeDt);
    this.position.addInPlace(this._scratchVec).addInPlace(this._scratchSide);

    // 10. Track Query & Surface Classification (Executed AFTER position integration)
    this.queryTrackPosition(spline, track);

    // Exact 2-axle road surface height & normal sampling (eliminates drowning tires on slopes & banking)
    const trackLen = spline.totalLength > 0 ? spline.totalLength : 3500;
    const fwdDotTan = this.forward.x * this._splineTangent.x + this.forward.z * this._splineTangent.z;
    const fwdDotSide = this.forward.x * this._splineNormal.x + this.forward.z * this._splineNormal.z;
    const frontU = this.currentT + (1.45 * fwdDotTan) / trackLen;
    const rearU = this.currentT - (1.15 * fwdDotTan) / trackLen;
    const frontLat = this.signedLateralDistance + 1.45 * fwdDotSide;
    const rearLat = this.signedLateralDistance - 1.15 * fwdDotSide;

    spline.sampleRoadSurface(this.currentT, this.signedLateralDistance, track.width, this._centerSurface);
    spline.sampleRoadSurface(frontU, frontLat, track.width, this._frontSurface);
    spline.sampleRoadSurface(rearU, rearLat, track.width, this._rearSurface);

    const axleInterpY = this._rearSurface.roadY + (this._frontSurface.roadY - this._rearSurface.roadY) * (1.15 / 2.60);
    const targetRoadY = Math.max(this._centerSurface.roadY, axleInterpY);

    if (Number.isFinite(targetRoadY)) {
      this.position.y = lerp(this.position.y, targetRoadY, Math.min(1, safeDt * 22));
    }

    // Orient surfaceForward along actual front-to-rear axle road slope, orthogonalized against surfaceNormal
    const slopeY = this._frontSurface.roadY - this._rearSurface.roadY;
    this._targetSurfForward.set(this.forward.x * 2.60, slopeY, this.forward.z * 2.60).normalize();
    Vector3.LerpToRef(this.surfaceForward, this._targetSurfForward, Math.min(1, safeDt * 18), this.surfaceForward);
    if (this.surfaceForward.lengthSquared() > 1e-6) {
      this.surfaceForward.normalize();
    } else {
      this.surfaceForward.copyFrom(this.forward);
    }
    Vector3.LerpToRef(this.surfaceNormal, this._centerSurface.normal, Math.min(1, safeDt * 18), this.surfaceNormal);
    if (this.surfaceNormal.lengthSquared() > 1e-6) {
      this.surfaceNormal.normalize();
    } else {
      this.surfaceNormal.set(0, 1, 0);
    }

    // 11. Non-Radial Barrier Collision Resolution
    this.resolveBarrierCollisions(track, safeDt);

    // 12. Gear & RPM Calculation (Automatic Transmission with stateful shift logic)
    this.updateGearsAndRPM(safeDt, throttle, brake);

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
    this.totalRaceTime += safeDt;

    // 15. Publish Telemetry Data (Reusing output object without heap allocations)
    const safeSpeedVal = Number.isFinite(this.speed) ? this.speed : 0;
    const safeRpmVal = Number.isFinite(this.rpm) ? this.rpm : 4000;

    this._telemetryData.speedKmh = Math.round(safeSpeedVal * 3.6);
    this._telemetryData.speedMs = safeSpeedVal;
    this._telemetryData.gear = Number.isFinite(this.gear) ? this.gear : 1;
    this._telemetryData.rpm = Math.round(safeRpmVal);
    this._telemetryData.rpmRatio = clamp((safeRpmVal - 4000) / (12500 - 4000), 0, 1);
    this._telemetryData.currentT = Number.isFinite(this.currentT) ? this.currentT : 0;
    this._telemetryData.isReverse = this.gear === -1 || safeSpeedVal < -0.2;
    this._telemetryData.isShifting = this.isShifting;
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
    this._telemetryData.penaltySeconds = this.penaltySeconds;
    this._telemetryData.warnings = this.warnings;
    this._telemetryData.drsLocked = this.drsLockedTimer > 0;

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
    if (this.drsLockedTimer > 0) {
      this.drsActive = false;
      return;
    }
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

  /**
   * Re-synchronizes spline coordinates and clamps vehicle inside Armco barriers
   * after external car-to-car collision separation.
   */
  public enforceBarrierBounds(track: Track, spline: Spline3D, dt: number): void {
    this.queryTrackPosition(spline, track);
    spline.sampleRoadSurface(this.currentT, this.signedLateralDistance, track.width, this._centerSurface);
    if (Number.isFinite(this._centerSurface.roadY)) {
      this.position.y = lerp(this.position.y, this._centerSurface.roadY, Math.min(1, dt * 20));
    }
    this.resolveBarrierCollisions(track, dt);
    this._telemetryData.currentT = Number.isFinite(this.currentT) ? this.currentT : 0;
    this._telemetryData.onKerb = this.onKerb;
    this._telemetryData.offTrack = this.offTrack;
    this._telemetryData.penaltySeconds = this.penaltySeconds;
    this._telemetryData.warnings = this.warnings;
    this._telemetryData.drsLocked = this.drsLockedTimer > 0;
  }

  private resolveBarrierCollisions(track: Track, dt: number) {
    const safeTrackW = Number.isFinite(track.width) && track.width > 0 ? track.width : 6.8;
    const halfW = safeTrackW * 0.5;
    const kerbW = 0.95;
    const runoffW = 3.0;
    const barrierOffset = halfW + kerbW + runoffW; // Exact match with 3D Armco tube position
    const carHalfWidth = 0.88; // Physical car body half-width

    const effectiveLimit = barrierOffset - carHalfWidth;

    // Non-radial barrier collision: deflect purely in the lateral normal direction
    if (this.lateralDistance > effectiveLimit) {
      const sign = this.signedLateralDistance >= 0 ? 1 : -1;
      const penetration = this.lateralDistance - effectiveLimit;

      // 1. Immediately push vehicle inside barrier with a small safety margin
      this.position.x -= sign * (penetration + 0.06) * this._splineNormal.x;
      this.position.z -= sign * (penetration + 0.06) * this._splineNormal.z;

      // Update stored lateral distance
      this.lateralDistance = effectiveLimit - 0.06;
      this.signedLateralDistance = sign * this.lateralDistance;

      // 2. Elastic bounce impulse: reverse and dampen lateral velocity
      const impactSpeed = Math.abs(this.speed);
      if (Math.abs(this.lateralVelocity) > 0.2) {
        this.lateralVelocity = -this.lateralVelocity * 0.35;
      }

      // 3. Wall friction: decelerate tangentially without freezing the car
      if (impactSpeed > 1.5) {
        this.speed = Math.max(0, this.speed - Math.min(this.speed * 0.5, 26 * dt));
        this.onBarrierImpact?.(impactSpeed);
      }

      // 4. Glancing deflection away from barrier if heading is pointed into it:
      const forwardDotOutward = this.forward.x * (sign * this._splineNormal.x) + this.forward.z * (sign * this._splineNormal.z);
      if (forwardDotOutward > 0.05) {
        const bounceSign = sign > 0 ? -1 : 1;
        this.heading += bounceSign * 1.8 * dt;
      }
    }
  }

  private updateGearsAndRPM(dt: number, throttle: number, brake: number) {
    if (this.shiftCooldown > 0) {
      this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    }
    if (this.shiftCutTimer > 0) {
      this.shiftCutTimer = Math.max(0, this.shiftCutTimer - dt);
    }
    this.isShifting = this.shiftCutTimer > 0;

    const safeSpeed = this.speed;

    // 1. Reverse gear detection
    if (safeSpeed < -0.2) {
      this.gear = -1;
      const revRatio = clamp(Math.abs(safeSpeed) / 14, 0, 1);
      this.rpm = 4000 + revRatio * 5200;
      return;
    }

    // 2. Stationary / Standstill (clutch disengaged at idle RPM)
    if (Math.abs(safeSpeed) < 0.4) {
      this.gear = 1;
      this.rpm = 4000 + throttle * 2800;
      return;
    }

    // 3. Compute continuous RPM for current gear
    const currentMax = this.gearMaxSpeeds[this.gear] || 27;
    const speedRatioInGear = safeSpeed / currentMax;

    if (this.gear === 1) {
      // Gear 1 has launch clutch slip up to ~7 m/s
      const launchSlip = clamp(safeSpeed / 7, 0, 1);
      const targetRpm = 4000 + (throttle > 0.1 ? 2000 : 0) + (12200 - 6000) * launchSlip * (safeSpeed / 27);
      this.rpm = clamp(targetRpm, 4000, 12500);
    } else {
      // Gears 2-8: RPM is directly proportional to road speed
      const nominalRpm = speedRatioInGear * 12200;
      this.rpm = clamp(nominalRpm, 3800, 12500);
    }

    // Hold RPM if currently in shift cut
    if (this.shiftCutTimer > 0) {
      return;
    }

    // 4. Automatic Upshift Decision
    // Upshift when RPM exceeds threshold or speed approaches gear ceiling under throttle
    if (this.shiftCooldown <= 0 && this.gear >= 1 && this.gear < 8) {
      const upshiftThresholdRpm = 11800;
      const speedThreshold = this.gearMaxSpeeds[this.gear] * 0.94;

      if ((this.rpm >= upshiftThresholdRpm || safeSpeed >= speedThreshold) && throttle > 0.15) {
        const oldGear = this.gear;
        this.gear++;
        this.shiftCooldown = 0.28;
        this.shiftCutTimer = 0.08;
        this.isShifting = true;

        // Calculate natural RPM drop in the higher gear
        const newMax = this.gearMaxSpeeds[this.gear];
        this.rpm = clamp((safeSpeed / newMax) * 12200, 4200, 11400);

        if (this.onGearShift) {
          this.onGearShift(this.gear, oldGear);
        }
        return;
      }
    }

    // 5. Automatic Downshift Decision
    // Downshift when RPM drops too low or during braking to maintain engine responsiveness
    if (this.shiftCooldown <= 0 && this.gear > 1) {
      const lowerGear = this.gear - 1;
      const lowerMax = this.gearMaxSpeeds[lowerGear];
      const predictedLowerRpm = (safeSpeed / lowerMax) * 12200;

      // Redline protection: NEVER downshift if the lower gear would over-rev past 11,400 RPM
      if (predictedLowerRpm < 11400) {
        let shouldDownshift = false;

        if (brake > 0.1) {
          // Aggressive downshift under braking for corner entry
          if (this.rpm < 8200 || safeSpeed < lowerMax * 0.90) {
            shouldDownshift = true;
          }
        } else {
          // Normal cruising / coasting downshift (downshift when RPM drops below 5,200 RPM)
          if (this.rpm < 5200 || safeSpeed < lowerMax * 0.74) {
            shouldDownshift = true;
          }
        }

        if (shouldDownshift) {
          const oldGear = this.gear;
          this.gear--;
          this.shiftCooldown = 0.22;
          // Rev-match blip on downshift
          this.rpm = clamp(predictedLowerRpm, 4200, 11200);

          if (this.onGearShift) {
            this.onGearShift(this.gear, oldGear);
          }
        }
      }
    }
  }
}
