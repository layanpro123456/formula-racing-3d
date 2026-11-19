// Formula Racing 3D — Real-World Motorsport Vehicle Physics Engine
// 4-wheel dynamic load transfer, Pacejka slip friction, brake thermal model, and barrier impulse deflection.
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
    this.lapTime = 0;
    this.currentSector = 1;
    this.brakeTemp = 100;
    this.isLockup = false;
    this.tireSlip = 0;
    this.suspensionOffsets = [0, 0, 0, 0];
  }

  public update(
    dt: number,
    inputs: VehicleInputs,
    track: Track,
    spline: Spline3D
  ): TelemetryData {
    // 0. Defensive runtime guard on time-delta and all internal states
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;
    if (!Number.isFinite(this.speed)) this.speed = 0;
    if (!Number.isFinite(this.steerAngle)) this.steerAngle = 0;
    if (!Number.isFinite(this.heading)) this.heading = 0;
    if (!Number.isFinite(this.rpm)) this.rpm = 4000;
    if (!Number.isFinite(this.brakeTemp)) this.brakeTemp = 100;
    if (!Number.isFinite(this.pitch)) this.pitch = 0;
    if (!Number.isFinite(this.roll)) this.roll = 0;
    if (!Number.isFinite(this.lapTime)) this.lapTime = 0;
    if (!Number.isFinite(this.currentT)) this.currentT = 0;

    // 1. Steering dynamics with speed-sensitive progressive dampening
    const steerTarget = (inputs.steerLeft ? 1 : 0) - (inputs.steerRight ? 1 : 0);
    // At 300+ km/h, aero stability restricts high steering angles to avoid snap spins
    const maxSteer = 0.52 / (1.0 + Math.abs(this.speed) * 0.038);
    this.steerAngle = lerp(this.steerAngle, steerTarget * maxSteer, safeDt * 11);

    // 2. Query Track Spline Position & Surface Contact
    this.queryTrackPosition(spline, track);

    // 3. DRS evaluation
    this.evaluateDRS(track, inputs.drs);

    // 4. Aerodynamic forces & surface friction coefficients
    let frictionMu = 1.0;
    if (this.onKerb) frictionMu = 0.86;
    else if (this.offTrack) frictionMu = 0.38;

    // Aerodynamic Downforce & Drag scale with v^2
    const dragCoeff = this.drsActive ? 0.28 : 0.44;
    const downforceCoeff = this.drsActive ? 0.62 : 1.28;

    const dragForce = 0.5 * 1.225 * dragCoeff * (this.speed * this.speed);
    const downforce = 0.5 * 1.225 * downforceCoeff * (this.speed * this.speed);

    // 5. Four-Wheel Weight & Dynamic Load Transfer Model
    // Base static load per tire plus total aerodynamic downforce
    const totalVerticalLoad = this.mass * this.g + downforce;
    const baseLoad = totalVerticalLoad / 4;

    // Longitudinal load transfer: deltaFz = (m * ax * h) / L
    const ax = this.gForceLong * this.g;
    const deltaFzLong = (this.mass * ax * this.hCog) / this.wheelbase;

    // Lateral load transfer: deltaFz = (m * ay * h) / W
    const ay = this.gForceLat * this.g;
    const deltaFzLat = (this.mass * ay * this.hCog) / this.trackWidth;

    // Individual 4-wheel normal loads
    const fzFL = Math.max(200, (Number.isFinite(baseLoad) ? baseLoad : 2000) - (Number.isFinite(deltaFzLong) ? deltaFzLong : 0) * 0.5 + (Number.isFinite(deltaFzLat) ? deltaFzLat : 0) * 0.5);
    const fzFR = Math.max(200, (Number.isFinite(baseLoad) ? baseLoad : 2000) - (Number.isFinite(deltaFzLong) ? deltaFzLong : 0) * 0.5 - (Number.isFinite(deltaFzLat) ? deltaFzLat : 0) * 0.5);
    const fzRL = Math.max(200, (Number.isFinite(baseLoad) ? baseLoad : 2000) + (Number.isFinite(deltaFzLong) ? deltaFzLong : 0) * 0.5 + (Number.isFinite(deltaFzLat) ? deltaFzLat : 0) * 0.5);
    const fzRR = Math.max(200, (Number.isFinite(baseLoad) ? baseLoad : 2000) + (Number.isFinite(deltaFzLong) ? deltaFzLong : 0) * 0.5 - (Number.isFinite(deltaFzLat) ? deltaFzLat : 0) * 0.5);

    // Inside front tire becomes unweighted in tight corners under trail-braking!
    const insideFrontLoad = this.steerAngle > 0 ? fzFR : fzFL;

    // 6. Engine Propulsion & Braking Dynamics
    let accelForce = 0;
    let brakeForce = 0;
    this.isLockup = false;

    if (inputs.accelerate) {
      if (this.speed < -0.2) {
        // Oppose reverse motion with braking to bring car to rest
        brakeForce = 25 * frictionMu;
      } else {
        const gearMax = this.gearMaxSpeeds[this.gear] || 95;
        const safeSpeedRatio = Math.max(0, Math.min(1, Math.max(0, this.speed) / gearMax));
        const powerCurve = Math.max(0, 1.0 - Math.pow(safeSpeedRatio, 1.35));
        accelForce = (33 - this.gear * 2.1) * powerCurve * frictionMu;
      }
    }

    if (inputs.brake) {
      if (this.speed > 0.5) {
        // High downforce allows massive 5G braking at top speed
        const maxBrakingDecel = (44 + downforce * 0.038) * frictionMu;
        brakeForce = maxBrakingDecel;

        // Lockup detection: as speed bleeds off, inside front tire locks if braking at 100%
        if (this.speed < 40 && insideFrontLoad < baseLoad * 0.75 && Math.abs(this.steerAngle) > 0.15) {
          this.isLockup = true;
          // Grip degradation during flat-spot lockup
          brakeForce *= 0.88;
        }

        // Brake disc thermal absorption: energy dissipated into heat
        const heatGen = (Math.max(0, this.speed) * 12.0) * safeDt;
        this.brakeTemp = Math.min(950, this.brakeTemp + heatGen);
      } else if (this.speed > 0.05) {
        // Coming to a complete stop
        this.speed = 0;
        brakeForce = 35;
      } else {
        // Reverse gear from standstill
        accelForce = -9 * frictionMu;
      }
    }

    // Cooling of brake discs via ram-air ducts (exponential decay towards 100 C)
    const coolingRate = 1.6 + (Math.max(0, this.speed) / 24);
    this.brakeTemp = Math.max(100, lerp(this.brakeTemp, 100, safeDt * coolingRate));
    if (!Number.isFinite(this.brakeTemp)) this.brakeTemp = 100;

    // Rolling resistance & Net longitudinal acceleration
    let netLongitudinalAccel = 0;
    if (this.speed > 0.05) {
      // Forward motion: drag, brakes and rolling resistance oppose forward motion
      const resistance = brakeForce + dragForce * 0.018 + 5.8;
      netLongitudinalAccel = accelForce - resistance;
    } else if (this.speed < -0.05) {
      // Reverse motion: drag, brakes and rolling resistance oppose reverse motion
      const resistance = brakeForce + dragForce * 0.018 + 5.8;
      netLongitudinalAccel = accelForce + resistance;
    } else {
      // Stationary: only accelerate if throttle or reverse input is active
      if (inputs.accelerate || inputs.brake) {
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
    if (!inputs.accelerate && !inputs.brake) {
      if ((prevSpeed > 0 && this.speed < 0) || (prevSpeed < 0 && this.speed > 0) || Math.abs(this.speed) < 0.05) {
        this.speed = 0;
      }
    }

    this.speed = clamp(this.speed, -15, 101); // Top speed ~364 km/h
    if (!Number.isFinite(this.speed)) this.speed = 0;

    this.gForceLong = safeDt > 0.0001 ? (this.speed - prevSpeed) / (safeDt * this.g) : 0;
    if (!Number.isFinite(this.gForceLong)) this.gForceLong = 0;

    // 8. Lateral Dynamics & Pacejka-Inspired Cornering
    const turnRate = this.steerAngle * (1.35 + Math.abs(this.speed) * 0.024);
    if (Math.abs(this.speed) > 0.1) {
      this.heading += turnRate * safeDt * (this.speed >= 0 ? 1 : -1);
    } else if (inputs.accelerate || inputs.brake || Math.abs(this.steerAngle) > 0.05) {
      // Low-speed breakaway steering to recover from barrier contact or hairpin spin
      this.heading += this.steerAngle * 2.4 * safeDt * (inputs.brake ? -1 : 1);
    }
    if (!Number.isFinite(this.heading)) this.heading = 0;

    this.gForceLat = (this.speed * this.steerAngle * 4.6) / this.g;
    if (!Number.isFinite(this.gForceLat)) this.gForceLat = 0;

    // Tire slip intensity for audio and smoke effects
    const latSlip = Math.abs(this.steerAngle) * (Math.abs(this.speed) / 50);
    this.tireSlip = clamp(this.isLockup ? 1.0 : latSlip, 0, 1);

    // Forward and Right vectors
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    // 9. Integrate Position
    this._scratchVec.copyFrom(this.forward).scaleInPlace(this.speed * safeDt);
    this.position.addInPlace(this._scratchVec);

    // Advance approximate curve progress based on forward motion
    if (Math.abs(this.speed) > 0.01) {
      const approxTrackLen = spline.getLength() || 3500;
      this.currentT = ((this.currentT + (this.speed * safeDt) / approxTrackLen) % 1 + 1) % 1;
    }

    // Ground elevation clamping along track
    if (Number.isFinite(this._splinePt.y)) {
      this.position.y = lerp(this.position.y, this._splinePt.y, safeDt * 9);
    }

    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y) || !Number.isFinite(this.position.z)) {
      this.position.copyFrom(this._splinePt);
    }

    // 10. Elastic-Plastic Barrier Collision Response
    this.resolveBarrierCollisions(track, safeDt);

    // Defensive check after barrier collision
    if (!Number.isFinite(this.heading)) this.heading = 0;
    if (!Number.isFinite(this.speed)) this.speed = 0;
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y) || !Number.isFinite(this.position.z)) {
      this.position.copyFrom(this._splinePt);
    }

    // 11. Gear & RPM Calculation
    this.updateGearsAndRPM();

    // 12. Visual Suspension Roll, Pitch & 4-Wheel Deflections
    this.pitch = lerp(this.pitch, -this.gForceLong * 0.038, safeDt * 10);
    this.roll = lerp(this.roll, this.gForceLat * 0.032, safeDt * 10);
    if (!Number.isFinite(this.pitch)) this.pitch = 0;
    if (!Number.isFinite(this.roll)) this.roll = 0;

    // High frequency kerb vibration
    const kerbVibe = this.onKerb && Number.isFinite(this.lapTime) ? Math.sin(this.lapTime * 65) * 0.025 : 0;

    // 4-Wheel vertical hub travel offsets (m)
    const rawOffsets = [
      -this.pitch * 0.4 + this.roll * 0.3 + kerbVibe,
      -this.pitch * 0.4 - this.roll * 0.3 + kerbVibe,
      this.pitch * 0.4 + this.roll * 0.3,
      this.pitch * 0.4 - this.roll * 0.3
    ];
    this.suspensionOffsets = [
      clamp(Number.isFinite(rawOffsets[0]) ? rawOffsets[0] : 0, -0.06, 0.06),
      clamp(Number.isFinite(rawOffsets[1]) ? rawOffsets[1] : 0, -0.06, 0.06),
      clamp(Number.isFinite(rawOffsets[2]) ? rawOffsets[2] : 0, -0.06, 0.06),
      clamp(Number.isFinite(rawOffsets[3]) ? rawOffsets[3] : 0, -0.06, 0.06)
    ];

    // 13. Lap Timer & Sector Detection
    this.lapTime += safeDt;
    if (!Number.isFinite(this.lapTime)) this.lapTime = 0;

    const safeSpeedVal = Number.isFinite(this.speed) ? this.speed : 0;
    const safeRpmVal = Number.isFinite(this.rpm) ? this.rpm : 4000;
    const safeBrakeTempVal = Number.isFinite(this.brakeTemp) ? this.brakeTemp : 100;
    const safeLatGVal = Number.isFinite(this.gForceLat) ? this.gForceLat : 0;
    const safeLongGVal = Number.isFinite(this.gForceLong) ? this.gForceLong : 0;
    const safeSlipVal = Number.isFinite(this.tireSlip) ? this.tireSlip : 0;

    return {
      speedKmh: Math.round(safeSpeedVal * 3.6),
      speedMs: safeSpeedVal,
      gear: Number.isFinite(this.gear) ? this.gear : 1,
      rpm: Math.round(safeRpmVal),
      rpmRatio: clamp((safeRpmVal - 4000) / (12500 - 4000), 0, 1),
      lapTime: Number.isFinite(this.lapTime) ? this.lapTime : 0,
      currentSector: (this.currentSector === 1 || this.currentSector === 2 || this.currentSector === 3) ? this.currentSector : 1,
      lastSectorTime: Number.isFinite(this.lastSectorTime) ? this.lastSectorTime : 0,
      drsActive: !!this.drsActive,
      drsAvailable: !!this.drsAvailable,
      onKerb: !!this.onKerb,
      offTrack: !!this.offTrack,
      gForceLat: parseFloat(safeLatGVal.toFixed(2)),
      gForceLong: parseFloat(safeLongGVal.toFixed(2)),
      brakeTemp: Math.round(safeBrakeTempVal),
      isLockup: !!this.isLockup,
      tireSlip: parseFloat(safeSlipVal.toFixed(2)),
      suspensionOffsets: this.suspensionOffsets
    };
  }

  private queryTrackPosition(spline: Spline3D, track: Track) {
    const centerT = Number.isFinite(this.currentT) ? this.currentT : 0;
    let bestT = centerT;
    let minDistSq = Infinity;
    const searchRangeT = 0.02;
    const samples = 24;

    for (let i = 0; i <= samples; i++) {
      const rawT = centerT - searchRangeT / 2 + (i / samples) * searchRangeT;
      const t = Math.max(0, Math.min(0.999999, ((rawT % 1) + 1) % 1));
      
      const pt = spline.getPointAt(t);
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.z)) continue;

      const dSq = Vector3.DistanceSquared(pt, this.position);
      if (Number.isFinite(dSq) && dSq < minDistSq) {
        minDistSq = dSq;
        bestT = t;
      }
    }

    // Binary refinement for millimeter precision tracking (<0.05m error)
    let step = (searchRangeT / samples) * 0.5;
    for (let iter = 0; iter < 4; iter++) {
      const tMinus = Math.max(0, Math.min(0.999999, (((bestT - step) % 1) + 1) % 1));
      const tPlus = Math.max(0, Math.min(0.999999, (((bestT + step) % 1) + 1) % 1));
      const ptMinus = spline.getPointAt(tMinus);
      const ptPlus = spline.getPointAt(tPlus);
      if (ptMinus && ptPlus) {
        const dMinus = Vector3.DistanceSquared(ptMinus, this.position);
        const dPlus = Vector3.DistanceSquared(ptPlus, this.position);
        if (dMinus < minDistSq) {
          minDistSq = dMinus;
          bestT = tMinus;
        } else if (dPlus < minDistSq) {
          minDistSq = dPlus;
          bestT = tPlus;
        }
      }
      step *= 0.5;
    }

    this.currentT = Math.max(0, Math.min(0.999999, ((bestT % 1) + 1) % 1));
    const pt = spline.getPointAt(this.currentT);
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) && Number.isFinite(pt.z)) {
      this._splinePt.copyFrom(pt);
    }
    const rawTan = spline.getTangentAt(this.currentT);
    if (rawTan && Number.isFinite(rawTan.x) && Number.isFinite(rawTan.z) && rawTan.lengthSquared() > 0.0001) {
      this._splineTangent.copyFrom(rawTan).normalize();
    }

    // Distance to spline center
    const lateralDist = Math.sqrt(
      Math.pow(this.position.x - this._splinePt.x, 2) + Math.pow(this.position.z - this._splinePt.z, 2)
    );

    const safeHalfW = Number.isFinite(track.width) && track.width > 0 ? track.width * 0.5 : 3.4;
    this.onKerb = lateralDist > safeHalfW && lateralDist <= safeHalfW + 0.95;
    this.offTrack = lateralDist > safeHalfW + 0.95;

    // Check sector boundaries
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
    const maxOffset = safeTrackW * 0.5 + 3.8;
    this._scratchSide.copyFrom(this.position).subtractInPlace(this._splinePt);
    this._scratchSide.y = 0;
    const distFromCenter = this._scratchSide.length();

    if (distFromCenter > maxOffset && distFromCenter > 0.001) {
      this._scratchSide.normalize();
      
      // Deflect car back inside track boundary with 0.15m safety clearance
      this.position.x = this._splinePt.x + this._scratchSide.x * (maxOffset - 0.15);
      this.position.z = this._splinePt.z + this._scratchSide.z * (maxOffset - 0.15);

      // Realistic wall friction deceleration only at speed (does not trap stopped car)
      if (Math.abs(this.speed) > 2.0) {
        this.speed = Math.max(0, this.speed - 28 * dt);
      }

      // Deflect heading slightly along tangent to slide smoothly along barrier
      const tanHeading = Math.atan2(this._splineTangent.x, this._splineTangent.z);
      if (Number.isFinite(tanHeading)) {
        this.heading = lerp(this.heading, tanHeading, dt * 8);
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
        const safeRatio = Math.max(0, Math.min(1, speedInGear));
        this.rpm = 4500 + safeRatio * 7800;
        break;
      }
    }

    if (!Number.isFinite(this.rpm)) {
      this.rpm = 4000;
    }
  }
}
