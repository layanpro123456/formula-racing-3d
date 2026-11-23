"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  TargetCamera,
  ShadowGenerator,
  GlowLayer
} from "@babylonjs/core";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { MotionBlurPostProcess } from "@babylonjs/core/PostProcesses/motionBlurPostProcess";
import { Track } from "@/data/tracks";
import { build3DCurve, Spline3D } from "@/lib/math/Spline3D";
import { createBabylonTrack, createProceduralSkybox } from "./BabylonTrackGenerator";
import { BabylonVehicle } from "./BabylonVehicle";
import { getHavokPlugin } from "@/lib/babylon/havokLoader";
import { VehiclePhysics, TelemetryData } from "@/lib/physics/VehiclePhysics";
import { AISimulator, AICarState } from "@/lib/ai/AIDriver";
import { engineAudio } from "@/lib/audio/EngineSound";
import { RacingHUD } from "@/components/RacingHUD";
import { InputManager } from "@/lib/input/InputManager";
import { TireSmokeSystem } from "@/lib/effects/TireSmokeSystem";
import { BarrierSparkSystem } from "@/lib/effects/BarrierSparkSystem";
import { raceCommentary, CommentaryState } from "@/lib/commentary/RaceCommentary";

type CameraMode = "chase" | "cockpit" | "nose";

interface BabylonRacingGameProps {
  track: Track;
  sessionMode: "grandprix" | "practice" | "qualifying";
  liveryIndex: number;
  initialSteeringSensitivity?: number;
  onExitToMenu: () => void;
}

const defaultTelemetry: TelemetryData = {
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
  suspensionOffsets: [0, 0, 0, 0]
};

export default function BabylonRacingGame({
  track,
  sessionMode,
  liveryIndex,
  initialSteeringSensitivity = 1.0,
  onExitToMenu
}: BabylonRacingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>(defaultTelemetry);
  const [playerLap, setPlayerLap] = useState(1);
  const [totalLaps, setTotalLaps] = useState(sessionMode === "qualifying" ? 1 : track.lapsDefault);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [commentaryState, setCommentaryState] = useState<CommentaryState>(raceCommentary.getState());
  const [isCommentaryMuted, setIsCommentaryMuted] = useState(!raceCommentary.getIsEnabled());
  const [countdown, setCountdown] = useState<number | null>(sessionMode === "grandprix" ? 3 : null);
  const countdownRef = useRef<number | null>(sessionMode === "grandprix" ? 3 : null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("f1_steering_sensitivity");
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 1.5) {
            return parsed;
          }
        }
      } catch {}
    }
    return initialSteeringSensitivity;
  });

  // Mutable refs decoupled from React rendering
  const cameraModeRef = useRef<CameraMode>("chase");
  const isPausedRef = useRef<boolean>(false);
  const isFinishedRef = useRef<boolean>(false);
  const lastTelemetryTimeRef = useRef<number>(0);
  const playerLapRef = useRef<number>(1);
  const steeringSensitivityRef = useRef<number>(steeringSensitivity);

  const physicsRef = useRef(new VehiclePhysics());
  const aiSim = useMemo(() => new AISimulator(), []);
  const [aiCars, setAiCars] = useState<AICarState[]>([]);
  const inputManager = useMemo(() => new InputManager(), []);

  const spline = useMemo(() => build3DCurve(track.points), [track]);

  // Actions for camera, pause, mute, and commentary
  const handleToggleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraMode = prev === "chase" ? "cockpit" : prev === "cockpit" ? "nose" : "chase";
      cameraModeRef.current = next;
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      if (next) {
        raceCommentary.pause();
      } else {
        raceCommentary.resume();
      }
      return next;
    });
  }, []);

  const handleToggleAudio = useCallback(() => {
    const m = engineAudio.toggleMute();
    setIsAudioMuted(m);
  }, []);

  const handleToggleCommentary = useCallback(() => {
    const enabled = raceCommentary.toggleMute();
    setIsCommentaryMuted(!enabled);
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setSteeringSensitivity(val);
    steeringSensitivityRef.current = val;
    inputManager.steeringSensitivity = val;
    if (physicsRef.current) {
      physicsRef.current.steeringSensitivity = val;
    }
    try {
      localStorage.setItem("f1_steering_sensitivity", val.toString());
    } catch {}
  }, [inputManager]);

  // Synchronize steering sensitivity to active input & physics subsystems
  useEffect(() => {
    steeringSensitivityRef.current = steeringSensitivity;
    inputManager.steeringSensitivity = steeringSensitivity;
    if (physicsRef.current) {
      physicsRef.current.steeringSensitivity = steeringSensitivity;
    }
  }, [inputManager, steeringSensitivity]);

  // Connect Commentary listener
  useEffect(() => {
    raceCommentary.onUpdate = (state) => {
      setCommentaryState({ ...state });
      setIsCommentaryMuted(!state.isEnabled);
    };
    return () => {
      raceCommentary.dispose();
    };
  }, []);

  // Connect InputManager callbacks
  useEffect(() => {
    inputManager.onToggleCamera = handleToggleCamera;
    inputManager.onTogglePause = handleTogglePause;
    inputManager.onToggleMute = handleToggleAudio;
    inputManager.init();

    return () => {
      inputManager.dispose();
    };
  }, [inputManager, handleToggleCamera, handleTogglePause, handleToggleAudio]);

  // Grand Prix 5-red-lights countdown start sequence
  useEffect(() => {
    if (sessionMode === "grandprix") {
      setCountdown(3);
      countdownRef.current = 3;
      engineAudio.playBeep(false);

      let step = 3;
      const timer = setInterval(() => {
        step -= 1;
        if (step > 0) {
          setCountdown(step);
          countdownRef.current = step;
          engineAudio.playBeep(false);
        } else if (step === 0) {
          setCountdown(0);
          countdownRef.current = 0;
          engineAudio.playBeep(true);
        } else {
          clearInterval(timer);
          setCountdown(null);
          countdownRef.current = null;
        }
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdown(null);
      countdownRef.current = null;
    }
  }, [sessionMode]);

  // Babylon Engine & Scene Lifecycle (Decoupled from camera toggle and pause state)
  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: Engine;
    let scene: Scene;
    let vehicle: BabylonVehicle;
    const aiVehicles: BabylonVehicle[] = [];
    let shadowGen: ShadowGenerator | null = null;
    let glowLayer: GlowLayer | null = null;
    let pipeline: DefaultRenderingPipeline | null = null;
    let motionBlur: MotionBlurPostProcess | null = null;
    let tireSmokeSystem: TireSmokeSystem | null = null;
    let barrierSparkSystem: BarrierSparkSystem | null = null;
    let isDisposed = false;
    let onResize: (() => void) | null = null;

    async function initBabylon() {
      if (!canvasRef.current || isDisposed) return;

      // 1. Initialize Babylon.js Engine with optimized settings (no unnecessary buffer preservation)
      engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: "high-performance"
      });
      scene = new Scene(engine);
      scene.clearColor = Color4.FromHexString(`${track.skyColor}FF`);

      // 2. Initialize Havok Physics WASM Plugin
      try {
        const havokPlugin = await getHavokPlugin();
        scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
      } catch (e) {
        console.warn("Havok Physics fallback to deterministic kinematics:", e);
      }

      // 3. Lighting & Environment
      const ambient = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
      ambient.intensity = 0.55;
      ambient.groundColor = new Color3(0.2, 0.22, 0.2);

      const sun = new DirectionalLight("sunLight", new Vector3(-1, -2, -1).normalize(), scene);
      sun.position = new Vector3(80, 100, 50);
      sun.intensity = 2.0;

      // Cascaded Shadow Map for crisp vehicle shadows
      shadowGen = new ShadowGenerator(1024, sun);
      shadowGen.usePoissonSampling = true;

      // Atmospheric Fog
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = Color3.FromHexString(track.skyColor);
      scene.fogDensity = 0.0016;

      // Procedural Atmospheric Skybox
      createProceduralSkybox(scene, track.skyColor);

      // 4. Generate Procedural 3D Banked Track using identical Spline3D
      createBabylonTrack(track, spline, scene);

      // 5. Build Formula Car Model for Player
      vehicle = new BabylonVehicle("playerF1", liveryIndex, scene);
      shadowGen.addShadowCaster(vehicle.chassis, true);
      shadowGen.addShadowCaster(vehicle.wheelFL, false);
      shadowGen.addShadowCaster(vehicle.wheelFR, false);
      shadowGen.addShadowCaster(vehicle.wheelRL, false);
      shadowGen.addShadowCaster(vehicle.wheelRR, false);

      // Camera
      const camera = new TargetCamera("mainCam", new Vector3(0, 5, -10), scene);
      camera.fov = 1.1;

      // GlowLayer for emissive brake discs
      glowLayer = new GlowLayer("brakeGlow", scene, {
        mainTextureFixedSize: 256,
        blurKernelSize: 32
      });
      glowLayer.intensity = 0.85;
      for (const disc of vehicle.brakeDiscs) {
        glowLayer.addIncludedOnlyMesh(disc);
      }

      // Default Rendering Pipeline (FXAA Antialiasing + Bloom + ACES Tonemapping + Cinematic Vignette)
      pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.samples = 4;
      pipeline.bloomEnabled = true;
      pipeline.bloomWeight = 0.28;
      pipeline.bloomThreshold = 0.78;
      pipeline.bloomKernel = 48;
      pipeline.bloomScale = 0.5;

      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = 1; // ACES Photographic Tonemapping
      pipeline.imageProcessing.contrast = 1.12;
      pipeline.imageProcessing.exposure = 1.08;
      pipeline.imageProcessing.vignetteEnabled = true;
      pipeline.imageProcessing.vignetteWeight = 1.2;

      // Velocity-dependent Motion Blur
      try {
        motionBlur = new MotionBlurPostProcess("motionBlur", scene, 1.0, camera);
        motionBlur.motionStrength = 0;
        motionBlur.isObjectBased = false;
      } catch (e) {
        console.warn("MotionBlur fallback:", e);
      }

      // Particle Systems (Tire Smoke & Barrier Sparks)
      tireSmokeSystem = new TireSmokeSystem(scene, [vehicle.wheelRL, vehicle.wheelRR]);
      barrierSparkSystem = new BarrierSparkSystem(scene, vehicle.chassis);

      // Start position from spline
      const startPt = spline.getPointAt(0);
      const startTan = spline.getTangentAt(0);
      const startHeading = Math.atan2(startTan.x, startTan.z);

      physicsRef.current.steeringSensitivity = steeringSensitivityRef.current;
      physicsRef.current.reset(
        startPt,
        startHeading
      );

      // Connect physical automatic gearbox shift transitions to engine shift cut sound
      physicsRef.current.onGearShift = () => {
        engineAudio.playGearShift();
      };

      // Connect physical barrier collision to controller haptic feedback
      physicsRef.current.onBarrierImpact = (impactSpeed: number) => {
        const intensity = Math.min(1.0, impactSpeed / 25);
        inputManager.triggerHaptic(180, intensity * 0.6, intensity);
      };

      // Initialize AI Grid
      if (sessionMode === "grandprix") {
        aiSim.initializeGrid(track, spline);
        setAiCars([...aiSim.cars]);

        // Create 3D Babylon vehicle meshes for each AI opponent
        aiSim.cars.forEach((aiCar) => {
          const aiVeh = new BabylonVehicle(aiCar.id, aiCar.liveryIndex, scene);
          aiVeh.root.position.copyFrom(aiCar.position);
          aiVeh.root.rotation.y = aiCar.heading;
          aiVehicles.push(aiVeh);
          if (shadowGen) {
            shadowGen.addShadowCaster(aiVeh.chassis, true);
          }
        });
      }

      // Initialize Sound
      engineAudio.init();

      // Pre-allocated scratch vectors for zero-allocation render loop
      const camDesired = new Vector3();
      const camTarget = new Vector3();
      const camTargetCurrent = new Vector3(startPt.x, startPt.y + 1.2, startPt.z);
      let prevT = 0;

      // Render & Simulation Loop
      engine.runRenderLoop(() => {
        if (!scene || isDisposed) return;

        const rawDt = engine.getDeltaTime() / 1000;
        const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.04) : 0.016;

        if (!isPausedRef.current && !isFinishedRef.current) {
          const isRaceActive = countdownRef.current === null || countdownRef.current === 0;

          // Unified Input Manager (Keyboard + Gamepad analog triggers and stick)
          const inputs = inputManager.getInputs(dt, isRaceActive);

          // Step Physics Engine
          const tData = physicsRef.current.update(dt, inputs, track, spline);

          // Update Babylon Vehicle Position & Rotation
          const p = physicsRef.current.position;
          const px = Number.isFinite(p.x) ? p.x : startPt.x;
          const py = Number.isFinite(p.y) ? p.y : startPt.y;
          const pz = Number.isFinite(p.z) ? p.z : startPt.z;
          const heading = Number.isFinite(physicsRef.current.heading) ? physicsRef.current.heading : 0;
          const pitch = Number.isFinite(physicsRef.current.pitch) ? physicsRef.current.pitch : 0;
          const roll = Number.isFinite(physicsRef.current.roll) ? physicsRef.current.roll : 0;

          vehicle.root.position.set(px, py, pz);
          vehicle.root.rotation.y = heading;
          vehicle.root.rotation.x = pitch;
          vehicle.root.rotation.z = roll;

          // Update Wheels, Steering & Brake Glow
          vehicle.update(
            Number.isFinite(physicsRef.current.speed) ? physicsRef.current.speed : 0,
            Number.isFinite(physicsRef.current.steerAngle) ? physicsRef.current.steerAngle : 0,
            dt,
            (inputs.brake ?? 0) > 0.1,
            tData.brakeTemp,
            tData.drsActive
          );

          // Update Particle Effects (Smoke & Sparks)
          if (tireSmokeSystem) {
            tireSmokeSystem.update(tData.tireSlip, (inputs.brake ?? 0) > 0.1, tData.speedMs);
          }
          if (barrierSparkSystem) {
            const isNearBarrier = physicsRef.current.lateralDistance > (track.width * 0.5 + 2.7);
            const isSkidPlank = tData.onKerb || tData.speedMs > 62;
            barrierSparkSystem.update(isNearBarrier, isSkidPlank, tData.speedMs);
          }

          // Update Motion Blur strength based on velocity
          if (motionBlur) {
            const speedRatio = Math.min(1, Math.max(0, (tData.speedMs || 0) / 85));
            motionBlur.motionStrength = speedRatio * 0.35;
          }

          // Update Camera Position & Target based on mutable cameraModeRef
          const currentCamMode = cameraModeRef.current;
          const safeSpeedMs = Number.isFinite(tData.speedMs) ? tData.speedMs : 0;

          if (currentCamMode === "chase") {
            // Low, dynamic chase camera (5.2m back, 1.85m high)
            const camDist = 5.2;
            const camHeight = 1.85;
            // High-speed chassis shake / road texture vibration
            const speedShake = safeSpeedMs > 55 ? (Math.sin(performance.now() * 0.05) * 0.015 * ((safeSpeedMs - 55) / 35)) : 0;
            const camX = px - Math.sin(heading) * camDist;
            const camY = py + camHeight + speedShake;
            const camZ = pz - Math.cos(heading) * camDist;

            camDesired.set(camX, camY, camZ);
            camTarget.set(px + Math.sin(heading) * 1.5, py + 0.95, pz + Math.cos(heading) * 1.5);

            Vector3.LerpToRef(camera.position, camDesired, 1 - Math.exp(-9 * dt), camera.position);
            Vector3.LerpToRef(camTargetCurrent, camTarget, 1 - Math.exp(-14 * dt), camTargetCurrent);
            camera.setTarget(camTargetCurrent);

            // Speed FOV expansion (62 deg to 78 deg)
            camera.fov = 1.08 + (safeSpeedMs / 95) * 0.28;
          } else if (currentCamMode === "cockpit") {
            // Cockpit / Halo view over steering wheel
            camDesired.set(px, py + 0.68, pz + Math.cos(heading) * 0.2);
            camTarget.set(px + Math.sin(heading) * 16, py + 0.68, pz + Math.cos(heading) * 16);
            camera.position.copyFrom(camDesired);
            camera.setTarget(camTarget);
            camera.fov = 1.25;
          } else {
            // Front wing / Nose cone bumper view
            camDesired.set(px + Math.sin(heading) * 2.1, py + 0.38, pz + Math.cos(heading) * 2.1);
            camTarget.set(px + Math.sin(heading) * 20, py + 0.32, pz + Math.cos(heading) * 20);
            camera.position.copyFrom(camDesired);
            camera.setTarget(camTarget);
            camera.fov = 1.38;
          }

          // Engine Audio
          engineAudio.update(
            tData.rpmRatio,
            tData.speedMs,
            (inputs.brake ?? 0) > 0.1,
            Math.abs(physicsRef.current.steerAngle) > 0.35
          );

          // Lap detection
          if (prevT > 0.85 && physicsRef.current.currentT < 0.15) {
            setPlayerLap((curr) => {
              if (curr >= totalLaps) {
                setIsFinished(true);
                isFinishedRef.current = true;
                engineAudio.stop();
                raceCommentary.clearQueue();
                return curr;
              }
              const nextLap = curr + 1;
              playerLapRef.current = nextLap;
              return nextLap;
            });
            physicsRef.current.lapTime = 0;
          }
          prevT = physicsRef.current.currentT;

          // AI Simulation & 3D Mesh update
          if (sessionMode === "grandprix") {
            aiSim.update(dt, track, spline, physicsRef.current.position, isRaceActive);
            for (let i = 0; i < aiSim.cars.length; i++) {
              const aiCar = aiSim.cars[i];
              const aiMesh = aiVehicles[i];
              if (aiMesh && aiCar) {
                aiMesh.root.position.copyFrom(aiCar.position);
                aiMesh.root.rotation.y = aiCar.heading;
                aiMesh.update(aiCar.speed, aiCar.steerAngle, dt, false, 150, false);
              }
            }
          }

          // Calculate verified player position against AI fleet
          let playerPos = 1;
          const playerProgress = playerLapRef.current + (Number.isFinite(tData.currentT) ? tData.currentT : 0);
          for (let i = 0; i < aiSim.cars.length; i++) {
            const aiCar = aiSim.cars[i];
            if (aiCar && (aiCar.lap + aiCar.t) > playerProgress) {
              playerPos++;
            }
          }

          // English Race Commentary Evaluation
          raceCommentary.update(
            countdownRef.current,
            playerLapRef.current,
            totalLaps,
            tData.currentSector,
            playerPos,
            tData.offTrack,
            tData.isLockup,
            tData.drsAvailable,
            tData.drsActive,
            tData.lapTime,
            isFinishedRef.current,
            tData.speedMs
          );

          // Throttled HUD Telemetry (Publish at ~13 Hz instead of 60 Hz)
          const now = performance.now();
          if (now - lastTelemetryTimeRef.current >= 75) {
            lastTelemetryTimeRef.current = now;
            setTelemetry({ ...tData });
          }
        }

        scene.render();
      });

      onResize = () => engine && engine.resize();
      window.addEventListener("resize", onResize);
    }

    initBabylon();

    return () => {
      isDisposed = true;
      if (onResize) {
        window.removeEventListener("resize", onResize);
      }
      engineAudio.stop();
      if (tireSmokeSystem) {
        tireSmokeSystem.dispose();
      }
      if (barrierSparkSystem) {
        barrierSparkSystem.dispose();
      }
      if (motionBlur) {
        motionBlur.dispose();
      }
      if (pipeline) {
        pipeline.dispose();
      }
      if (glowLayer) {
        glowLayer.dispose();
      }
      if (shadowGen) {
        shadowGen.dispose();
      }
      if (engine) {
        engine.stopRenderLoop();
      }
      if (scene) {
        scene.dispose();
      }
      if (engine) {
        engine.dispose();
      }
    };
  }, [track, spline, sessionMode, liveryIndex, totalLaps, aiSim, inputManager]);

  // Synchronize AI positions periodically for HUD
  useEffect(() => {
    if (sessionMode !== "grandprix") return;
    const interval = setInterval(() => {
      setAiCars([...aiSim.cars]);
    }, 150);
    return () => clearInterval(interval);
  }, [aiSim, sessionMode]);

  return (
    <div className="game" style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Babylon.js WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0, outline: "none" }}
      />

      {/* Broadcast F1 Telemetry HUD */}
      <RacingHUD
        telemetry={telemetry}
        playerLap={playerLap}
        totalLaps={totalLaps}
        aiCars={aiCars}
        track={track}
        spline={spline}
        cameraMode={cameraMode}
        onToggleCamera={handleToggleCamera}
        onPause={handleTogglePause}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        countdown={countdown}
        commentaryState={commentaryState}
        isCommentaryMuted={isCommentaryMuted}
        onToggleCommentary={handleToggleCommentary}
      />

      {/* Paused Modal */}
      {isPaused && (
        <div className="modal-backdrop">
          <div className="modal pause-menu-modal">
            <p className="eyebrow">BABYLON.JS HAVOK ENGINE</p>
            <h2>SESSION PAUSED</h2>

            {/* Steering Sensitivity Live Control */}
            <div className="pause-sensitivity-section">
              <div className="form-header-row">
                <label>STEERING SENSITIVITY</label>
                <span className="sensitivity-badge">
                  {Math.round(steeringSensitivity * 100)}%
                  {steeringSensitivity <= 0.75 ? " (SMOOTH)" : steeringSensitivity >= 1.25 ? " (SHARP)" : " (BALANCED)"}
                </span>
              </div>
              <div className="slider-container">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={steeringSensitivity}
                  onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                  className="f1-range-slider"
                />
              </div>
              <div className="pills-group" style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  className={`pill-btn ${Math.abs(steeringSensitivity - 0.7) < 0.04 ? "active" : ""}`}
                  onClick={() => handleSensitivityChange(0.7)}
                >
                  SMOOTH (70%)
                </button>
                <button
                  type="button"
                  className={`pill-btn ${Math.abs(steeringSensitivity - 1.0) < 0.04 ? "active" : ""}`}
                  onClick={() => handleSensitivityChange(1.0)}
                >
                  STANDARD (100%)
                </button>
                <button
                  type="button"
                  className={`pill-btn ${Math.abs(steeringSensitivity - 1.3) < 0.04 ? "active" : ""}`}
                  onClick={() => handleSensitivityChange(1.3)}
                >
                  SHARP (130%)
                </button>
              </div>
            </div>

            <button className="primary-btn" onClick={handleTogglePause}>
              RESUME <span>→</span>
            </button>
            <button className="secondary-btn" onClick={onExitToMenu}>
              EXIT TO PADDOCK
            </button>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {isFinished && (
        <div className="modal-backdrop">
          <div className="victory-modal">
            <p className="eyebrow">BABYLON.JS RACE CONTROL</p>
            <h2>CHECKERED FLAG</h2>
            <div className="victory-pos">
              FINISH TIME: {Math.floor((Number.isFinite(telemetry.lapTime) ? telemetry.lapTime : 0) / 60)}:
              {((Number.isFinite(telemetry.lapTime) ? telemetry.lapTime : 0) % 60).toFixed(2).padStart(5, "0")}
            </div>
            <button className="primary-btn" onClick={onExitToMenu}>
              RETURN TO PADDOCK <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
