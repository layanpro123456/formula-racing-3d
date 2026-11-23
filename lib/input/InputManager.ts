// Formula Racing 3D — Unified Cross-Platform Input Manager
// Seamlessly merges Keyboard (WASD, Arrows) and Gamepad (Xbox, PlayStation) with analog triggers and deadzone filtering.

import { VehicleInputs } from "@/lib/physics/VehiclePhysics";

export class InputManager {
  public deadzone: number = 0.08;
  private keys: Record<string, boolean> = {};
  private activeGamepadIndex: number | null = null;
  private smoothedSteer: number = 0;
  private mouseSteer: number = 0;
  public enableMouseSteer: boolean = false;

  // Rising-edge button state tracking for single-fire actions
  private lastCameraPressed: boolean = false;
  private lastPausePressed: boolean = false;
  private lastMutePressed: boolean = false;

  public onToggleCamera?: () => void;
  public onTogglePause?: () => void;
  public onToggleMute?: () => void;

  public triggerHaptic(durationMs: number = 120, weakMagnitude: number = 0.5, strongMagnitude: number = 0.5): void {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    try {
      const gamepads = navigator.getGamepads();
      if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
        const pad = gamepads[this.activeGamepadIndex];
        const actuator = (pad as any)?.vibrationActuator;
        if (actuator && typeof actuator.playEffect === "function") {
          actuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: Math.min(1.0, weakMagnitude),
            strongMagnitude: Math.min(1.0, strongMagnitude)
          }).catch(() => {});
        }
      }
    } catch {
      // Haptics not supported or permitted on this device
    }
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "e", "E"].includes(e.key)) {
      e.preventDefault();
    }
    this.keys[e.key.toLowerCase()] = true;

    // Direct key triggers with rising-edge protection
    if (e.key.toLowerCase() === "c" && !e.repeat) {
      this.onToggleCamera?.();
    } else if (e.key === "Escape" && !e.repeat) {
      this.onTogglePause?.();
    } else if (e.key.toLowerCase() === "m" && !e.repeat) {
      this.onToggleMute?.();
    }
  };

  private _onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private _onBlur = () => {
    this.reset();
  };

  private _onVisibilityChange = () => {
    if (document.hidden) {
      this.reset();
    }
  };

  private _onGamepadConnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = e.gamepad.index;
    }
  };

  private _onGamepadDisconnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === e.gamepad.index) {
      this.activeGamepadIndex = null;
      this.reset();
    }
  };

  public init() {
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    window.addEventListener("gamepadconnected", this._onGamepadConnected);
    window.addEventListener("gamepaddisconnected", this._onGamepadDisconnected);
  }

  public reset() {
    this.keys = {};
    this.smoothedSteer = 0;
    this.lastCameraPressed = false;
    this.lastPausePressed = false;
    this.lastMutePressed = false;
  }

  public dispose() {
    if (typeof window === "undefined") return;

    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    window.removeEventListener("gamepadconnected", this._onGamepadConnected);
    window.removeEventListener("gamepaddisconnected", this._onGamepadDisconnected);
    this.reset();
  }

  public getInputs(dt: number, isRaceActive: boolean): VehicleInputs {
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;

    if (!isRaceActive) {
      return {
        throttle: 0,
        brake: 0,
        steer: 0,
        drs: false,
        accelerate: false,
        steerLeft: false,
        steerRight: false
      };
    }

    // 1. Digital Keyboard Inputs
    const kAccelerate = !!(this.keys["w"] || this.keys["arrowup"]);
    const kBrake = !!(this.keys["s"] || this.keys["arrowdown"]);
    const kLeft = !!(this.keys["a"] || this.keys["arrowleft"]);
    const kRight = !!(this.keys["d"] || this.keys["arrowright"]);
    const kDRS = !!(this.keys["e"] || this.keys[" "]);

    let keySteer = 0;
    if (kLeft) keySteer -= 1.0;
    if (kRight) keySteer += 1.0;

    const keyThrottle = kAccelerate ? 1.0 : 0.0;
    const keyBrake = kBrake ? 1.0 : 0.0;

    // 2. Analog Gamepad Inputs
    let padSteer = 0;
    let padThrottle = 0;
    let padBrake = 0;
    let padDRS = false;
    let padCamera = false;
    let padPause = false;

    if (typeof navigator !== "undefined" && typeof navigator.getGamepads === "function") {
      const gamepads = navigator.getGamepads();
      let pad: Gamepad | null = null;

      if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
        pad = gamepads[this.activeGamepadIndex];
      } else {
        // Find first available connected gamepad
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i] && gamepads[i]!.connected) {
            pad = gamepads[i];
            this.activeGamepadIndex = i;
            break;
          }
        }
      }

      if (pad && pad.connected) {
        // Left Analog Stick X-Axis (Axis 0): -1.0 (Left) to +1.0 (Right)
        const rawAxis0 = pad.axes?.[0] ?? 0;
        if (Math.abs(rawAxis0) > this.deadzone) {
          const sign = rawAxis0 < 0 ? -1 : 1;
          const normalized = (Math.abs(rawAxis0) - this.deadzone) / (1.0 - this.deadzone);
          // Progressive cubic curve for sensitive control near center
          padSteer = sign * Math.pow(Math.min(1.0, normalized), 1.25);
        }

        // Throttle: Right Trigger (Button 7 on standard layout, or fallback axis)
        const btn7 = pad.buttons?.[7];
        if (btn7) {
          padThrottle = typeof btn7.value === "number" ? btn7.value : btn7.pressed ? 1.0 : 0.0;
        }

        // Brake: Left Trigger (Button 6 on standard layout)
        const btn6 = pad.buttons?.[6];
        if (btn6) {
          padBrake = typeof btn6.value === "number" ? btn6.value : btn6.pressed ? 1.0 : 0.0;
        }

        // DRS: A (0) or Y (3) or R1 / RB (5)
        padDRS = !!(pad.buttons?.[0]?.pressed || pad.buttons?.[3]?.pressed || pad.buttons?.[5]?.pressed);

        // Camera: B (1) or D-Pad Up (12)
        padCamera = !!(pad.buttons?.[1]?.pressed || pad.buttons?.[12]?.pressed);

        // Pause: Start / Options (9)
        padPause = !!(pad.buttons?.[9]?.pressed);
      }
    }

    // Single-fire Gamepad actions (rising-edge trigger)
    if (padCamera && !this.lastCameraPressed) {
      this.onToggleCamera?.();
    }
    this.lastCameraPressed = padCamera;

    if (padPause && !this.lastPausePressed) {
      this.onTogglePause?.();
    }
    this.lastPausePressed = padPause;

    // 3. Blend Keyboard and Analog Inputs
    const isPadSteering = Math.abs(padSteer) > 0.001;
    const finalThrottle = Math.max(keyThrottle, padThrottle);
    const finalBrake = Math.max(keyBrake, padBrake);
    const finalDRS = kDRS || padDRS;

    if (isPadSteering) {
      // Gamepad analog stick: direct 1:1 mapped analog precision
      this.smoothedSteer = padSteer;
    } else {
      // Keyboard digital inputs: crisp attack (24 rad/s) and fast spring centering (36 rad/s)
      const targetSteer = keySteer;
      const steerSpeed = Math.abs(targetSteer) > 0 ? 24 : 36;
      this.smoothedSteer += (targetSteer - this.smoothedSteer) * Math.min(1.0, safeDt * steerSpeed);
    }

    if (Math.abs(this.smoothedSteer) < 0.0001) this.smoothedSteer = 0;

    return {
      throttle: finalThrottle,
      brake: finalBrake,
      steer: this.smoothedSteer,
      drs: finalDRS,
      accelerate: finalThrottle > 0.05,
      steerLeft: this.smoothedSteer < -0.05,
      steerRight: this.smoothedSteer > 0.05
    };
  }
}
