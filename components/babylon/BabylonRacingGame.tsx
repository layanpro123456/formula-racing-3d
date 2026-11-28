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
  CascadedShadowGenerator,
  CubeTexture,
  GlowLayer
} from "@babylonjs/core";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { TAARenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/taaRenderingPipeline";
import { MotionBlurPostProcess } from "@babylonjs/core/PostProcesses/motionBlurPostProcess";
import { Track } from "@/data/tracks";
import { build3DCurve, Spline3D } from "@/lib/math/Spline3D";
import { createBabylonTrack } from "./BabylonTrackGenerator";
import {
  WeatherPreset,
  GraphicsTier,
  getWeatherLightingConfig,
  getGraphicsPresetConfig,
  createPhysicalSkyDome
} from "@/lib/babylon/EnvironmentPreset";
import { BabylonVehicle } from "./BabylonVehicle";
import { getHavokPlugin } from "@/lib/babylon/havokLoader";
import { VehiclePhysics, TelemetryData } from "@/lib/physics/VehiclePhysics";
import { AISimulator, AICarState } from "@/lib/ai/AIDriver";
import { CollisionSystem } from "@/lib/physics/CollisionSystem";
import { engineAudio } from "@/lib/audio/EngineSound";
import { RacingHUD, CollisionAlert } from "@/components/RacingHUD";
import { InputManager, TouchSteerScheme } from "@/lib/input/InputManager";
import { TireSmokeSystem } from "@/lib/effects/TireSmokeSystem";
import { BarrierSparkSystem } from "@/lib/effects/BarrierSparkSystem";
import { SkidmarkSystem } from "@/lib/effects/SkidmarkSystem";
import { RainSpraySystem } from "@/lib/effects/RainSpraySystem";
import { raceCommentary, CommentaryState } from "@/lib/commentary/RaceCommentary";
import { MobileControls } from "@/components/MobileControls";
import { useLandscapeStage } from "@/components/LandscapeStage";
import type { TouchControlMode } from "@/components/RacingGame";

type CameraMode = "chase" | "tcam" | "cockpit" | "nose";

interface BabylonRacingGameProps {
  track: Track;
  sessionMode: "grandprix" | "practice" | "qualifying";
  liveryIndex: number;
  initialSteeringSensitivity?: number;
  touchControlMode?: TouchControlMode;
  steerScheme?: TouchSteerScheme;
  onTouchControlModeChange?: (mode: TouchControlMode) => void;
  onSteerSchemeChange?: (scheme: TouchSteerScheme) => void;
  weatherPreset?: WeatherPreset;
  graphicsTier?: GraphicsTier;
  onWeatherPresetChange?: (preset: WeatherPreset) => void;
  onGraphicsTierChange?: (tier: GraphicsTier) => void;
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
  suspensionOffsets: [0, 0, 0, 0],
  penaltySeconds: 0,
  warnings: 0,
  drsLocked: false
};

export default function BabylonRacingGame({
  track,
  sessionMode,
  liveryIndex,
  initialSteeringSensitivity = 1.0,
  touchControlMode = "auto",
  steerScheme = "buttons",
  onTouchControlModeChange,
  onSteerSchemeChange,
  weatherPreset = "midday",
  graphicsTier = "high",
  onWeatherPresetChange,
  onGraphicsTierChange,
  onExitToMenu
}: BabylonRacingGameProps) {
  const { isTouchDevice, isRotatedPortrait, isFullscreen, toggleFullscreen } = useLandscapeStage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
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
  const [collisionAlert, setCollisionAlert] = useState<CollisionAlert | null>(null);
  const [impactFlashSeq, setImpactFlashSeq] = useState(0);
  const [finalRaceTime, setFinalRaceTime] = useState(0);
  const showTouchControls =
    touchControlMode === "on" || (touchControlMode === "auto" && isTouchDevice);
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
  const collisionSystem = useMemo(() => new CollisionSystem(), []);
  const [aiCars, setAiCars] = useState<AICarState[]>([]);
  const inputManager = useMemo(() => new InputManager(), []);
  const cameraJoltRef = useRef<number>(0);
  const collisionAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collisionAlertIdRef = useRef<number>(0);

  const spline = useMemo(() => build3DCurve(track.points), [track]);

  // Actions for camera, pause, mute, and commentary
  const handleToggleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraMode =
        prev === "chase"
          ? "tcam"
          : prev === "tcam"
            ? "cockpit"
            : prev === "cockpit"
              ? "nose"
              : "chase";
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

  // Synchronize steering sensitivity and touch control scheme to active subsystems
  useEffect(() => {
    steeringSensitivityRef.current = steeringSensitivity;
    inputManager.steeringSensitivity = steeringSensitivity;
    inputManager.controlScheme = steerScheme;
    if (steerScheme === "tilt") {
      void inputManager.requestGyroPermission();
    }
    if (physicsRef.current) {
      physicsRef.current.steeringSensitivity = steeringSensitivity;
    }
  }, [inputManager, steeringSensitivity, steerScheme]);

  // Resize Babylon WebGL canvas cleanly when CSS auto-rotation changes
  useEffect(() => {
    if (engineRef.current) {
      const raf = window.requestAnimationFrame(() => {
        engineRef.current?.resize();
      });
      return () => window.cancelAnimationFrame(raf);
    }
  }, [isRotatedPortrait]);

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
    let taaPipeline: TAARenderingPipeline | null = null;
    let ssrPipeline: SSRRenderingPipeline | null = null;
    let pipeline: DefaultRenderingPipeline | null = null;
    let ssaoPipeline: SSAO2RenderingPipeline | null = null;
    let motionBlur: MotionBlurPostProcess | null = null;
    let tireSmokeSystem: TireSmokeSystem | null = null;
    let barrierSparkSystem: BarrierSparkSystem | null = null;
    let skidmarkSystem: SkidmarkSystem | null = null;
    let rainSpraySystem: RainSpraySystem | null = null;
    let isDisposed = false;
    let onResize: (() => void) | null = null;

    async function initBabylon() {
      if (!canvasRef.current || isDisposed) return;

      // 1. Initialize Babylon.js Engine with calibrated GPU tier & DPR scaling
      const isMobileTier =
        typeof window !== "undefined" &&
        ((window.matchMedia?.("(pointer: coarse)")?.matches ?? false) ||
          (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
          Math.min(window.innerWidth, window.innerHeight) <= 900);

      const gfxConfig = getGraphicsPresetConfig(graphicsTier, isMobileTier);
      const weatherConfig = getWeatherLightingConfig(weatherPreset, track);

      engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: "high-performance"
      });
      const applyHardwareScaling = () => {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        engine.setHardwareScalingLevel(1 / Math.min(dpr, gfxConfig.maxDpr));
      };
      applyHardwareScaling();
      engineRef.current = engine;
      scene = new Scene(engine);

      // 2. Initialize Havok Physics WASM Plugin
      try {
        const havokPlugin = await getHavokPlugin();
        scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
      } catch (e) {
        console.warn("Havok Physics fallback to deterministic kinematics:", e);
      }

      // 3. IBL Environment Lighting & Preset-Driven Directional Sun
      try {
        const basePath = typeof window !== "undefined" && window.location.pathname.startsWith("/formula-racing-3d")
          ? "/formula-racing-3d"
          : "";
        const envTexture = CubeTexture.CreateFromPrefilteredData(
          `${basePath}/assets/environment/environmentSpecular.env`,
          scene
        );
        scene.environmentTexture = envTexture;
        scene.environmentIntensity = weatherConfig.environmentIntensity;
      } catch (err) {
        console.warn("Could not load local environment texture:", err);
      }

      const ambient = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
      ambient.intensity = weatherConfig.hemiIntensity;
      ambient.diffuse = weatherConfig.hemiDiffuse;
      ambient.groundColor = weatherConfig.hemiGround;

      const sun = new DirectionalLight("sunLight", weatherConfig.sunDirection, scene);
      sun.position = weatherConfig.sunPosition;
      sun.diffuse = weatherConfig.sunColor;
      sun.intensity = weatherConfig.sunIntensity;

      // Cascaded Shadow Map on High/Ultra desktop; single shadow generator on lower/mobile tiers
      if (gfxConfig.useCsm) {
        try {
          const csm = new CascadedShadowGenerator(gfxConfig.shadowMapSize, sun);
          csm.numCascades = gfxConfig.csmCascades;
          csm.lambda = 0.78;
          csm.shadowMaxZ = 220;
          csm.stabilizeCascades = true;
          csm.useContactHardeningShadow = true;
          csm.contactHardeningLightSizeUVRatio = 0.04;
          csm.bias = 0.0006;
          csm.normalBias = 0.004;
          shadowGen = csm;
        } catch {
          shadowGen = new ShadowGenerator(1024, sun);
          shadowGen.usePoissonSampling = true;
        }
      } else {
        shadowGen = new ShadowGenerator(gfxConfig.shadowMapSize, sun);
        shadowGen.usePoissonSampling = true;
        shadowGen.bias = 0.001;
      }

      // Atmospheric Fog & Physical Rayleigh/Mie Sky Dome
      scene.fogMode = Scene.FOGMODE_EXP2;
      scene.fogColor = weatherConfig.fogColor;
      scene.fogDensity = weatherConfig.fogDensity;

      createPhysicalSkyDome(scene, weatherConfig);

      // 4. Generate Multi-Layer Track, Beveled Kerbs, W-Beam Armco & Instanced Props
      const trackResult = createBabylonTrack(track, spline, scene, {
        wetness: weatherConfig.wetness,
        isNight: weatherConfig.isNight,
        propDensity: gfxConfig.propDensity
      });
      trackResult.props.updateStartLights(countdownRef.current);

      // 5. Build Sculpted Ground-Effect Formula Car Model for Player
      vehicle = new BabylonVehicle("playerF1", liveryIndex, scene, 1);
      for (const caster of vehicle.shadowCasters) {
        shadowGen.addShadowCaster(caster, false);
      }

      // Camera
      const camera = new TargetCamera("mainCam", new Vector3(0, 5, -10), scene);
      camera.fov = 1.1;

      // GlowLayer for brake discs, rain light, and night floodlights / gantry LEDs
      glowLayer = new GlowLayer("brakeGlow", scene, {
        mainTextureFixedSize: 256,
        blurKernelSize: 28
      });
      glowLayer.intensity = weatherConfig.isNight ? 0.95 : 0.75;
      for (const disc of vehicle.brakeDiscs) {
        glowLayer.addIncludedOnlyMesh(disc);
      }

      // TAA must precede other post-processing pipelines if enabled
      if (gfxConfig.enableTAA) {
        try {
          taaPipeline = new TAARenderingPipeline("taaPipeline", scene, [camera]);
          taaPipeline.reprojectHistory = true;
          taaPipeline.clampHistory = true;
          taaPipeline.disableOnCameraMove = false;
          taaPipeline.factor = 0.08;
        } catch (e) {
          console.warn("TAA fallback:", e);
        }
      }

      // Screen Space Reflections (Wet track puddles & Ultra-tier bodywork)
      if (gfxConfig.enableSSR || (weatherConfig.isWet && !isMobileTier)) {
        try {
          ssrPipeline = new SSRRenderingPipeline("ssrPipeline", scene, [camera], false);
          ssrPipeline.strength = weatherConfig.isWet ? 0.85 : 0.35;
          ssrPipeline.step = 2;
          ssrPipeline.maxDistance = 120;
          ssrPipeline.roughnessFactor = 0.25;
          ssrPipeline.blurDispersionStrength = 0.04;
          ssrPipeline.ssrDownsample = 1;
          ssrPipeline.reflectivityThreshold = 0.08;
          ssrPipeline.samples = gfxConfig.enableTAA ? 1 : gfxConfig.msaaSamples;
        } catch (e) {
          console.warn("SSR fallback:", e);
        }
      }

      // Calibrated HDR Default Rendering Pipeline (no white-kerb bloom blowout)
      pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
      pipeline.fxaaEnabled = !gfxConfig.enableTAA;
      pipeline.samples = gfxConfig.enableTAA ? 1 : gfxConfig.msaaSamples;
      pipeline.bloomEnabled = true;
      pipeline.bloomWeight = gfxConfig.bloomWeight;
      pipeline.bloomThreshold = 0.94;
      pipeline.bloomKernel = gfxConfig.bloomKernel;
      pipeline.bloomScale = 0.5;

      pipeline.sharpenEnabled = gfxConfig.enableSharpen;
      if (gfxConfig.enableSharpen && pipeline.sharpen) {
        pipeline.sharpen.edgeAmount = 0.24;
        pipeline.sharpen.colorAmount = 1.0;
      }

      pipeline.chromaticAberrationEnabled = gfxConfig.enableChromaticAberration;
      if (gfxConfig.enableChromaticAberration && pipeline.chromaticAberration) {
        pipeline.chromaticAberration.aberrationAmount = 0.55;
        pipeline.chromaticAberration.radialIntensity = 0.22;
      }

      pipeline.grainEnabled = !isMobileTier && gfxConfig.tier !== "low";
      if (pipeline.grainEnabled && pipeline.grain) {
        pipeline.grain.intensity = 1.2;
        pipeline.grain.animated = false;
      }

      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = 1; // ACES Photographic Tonemapping
      pipeline.imageProcessing.contrast = weatherConfig.contrast;
      pipeline.imageProcessing.exposure = weatherConfig.exposure;
      pipeline.imageProcessing.vignetteEnabled = true;
      pipeline.imageProcessing.vignetteWeight = 1.1;

      // Screen-Space Ambient Occlusion (SSAO2)
      if (gfxConfig.enableSSAO2) {
        try {
          ssaoPipeline = new SSAO2RenderingPipeline("ssao2", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera]);
          ssaoPipeline.radius = 1.6;
          ssaoPipeline.totalStrength = 1.05;
          ssaoPipeline.base = 0.14;
          ssaoPipeline.maxZ = 95;
        } catch (e) {
          console.warn("SSAO2 fallback:", e);
        }
      }

      // Velocity-dependent Motion Blur (object-based so player car stays sharp)
      if (gfxConfig.enableMotionBlur) {
        try {
          motionBlur = new MotionBlurPostProcess("motionBlur", scene, 1.0, camera);
          motionBlur.motionStrength = 0;
          motionBlur.isObjectBased = true;
          motionBlur.motionBlurSamples = 16;
        } catch (e) {
          console.warn("MotionBlur fallback:", e);
        }
      }

      // Dynamic VFX Systems (4-wheel Smoke, Skidmarks, Sparks, Wet Rain Spray)
      tireSmokeSystem = new TireSmokeSystem(
        scene,
        [vehicle.wheelFL, vehicle.wheelFR, vehicle.wheelRL, vehicle.wheelRR],
        gfxConfig.particleDensity
      );
      barrierSparkSystem = new BarrierSparkSystem(scene, vehicle.chassis);
      skidmarkSystem = new SkidmarkSystem(scene);
      if (weatherConfig.isWet) {
        rainSpraySystem = new RainSpraySystem(
          scene,
          [vehicle.wheelRL, vehicle.wheelRR],
          gfxConfig.particleDensity
        );
      }

      // Start position from spline
      const startPt = spline.getPointAt(0);
      const startTan = spline.getTangentAt(0);
      const startHeading = Math.atan2(startTan.x, startTan.z);

      // Initialize camera cleanly behind the car along -startTan on frame 1
      camera.position.set(
        startPt.x - Math.sin(startHeading) * 5.2,
        startPt.y + 1.85,
        startPt.z - Math.cos(startHeading) * 5.2
      );
      const camTargetInitX = startPt.x + Math.sin(startHeading) * 1.5;
      const camTargetInitY = startPt.y + 0.95;
      const camTargetInitZ = startPt.z + Math.cos(startHeading) * 1.5;
      camera.setTarget(new Vector3(camTargetInitX, camTargetInitY, camTargetInitZ));

      physicsRef.current.steeringSensitivity = steeringSensitivityRef.current;
      physicsRef.current.reset(
        startPt,
        startHeading
      );
      collisionSystem.reset();
      cameraJoltRef.current = 0;

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
          const aiVeh = new BabylonVehicle(aiCar.id, aiCar.liveryIndex, scene, aiCar.number);
          aiVeh.root.position.copyFrom(aiCar.position);
          aiVeh.root.rotation.y = aiCar.heading;
          aiVehicles.push(aiVeh);
          if (shadowGen) {
            for (const caster of aiVeh.shadowCasters) {
              shadowGen.addShadowCaster(caster, false);
            }
          }
        });
      }

      // Initialize Sound
      engineAudio.init();

      // Pre-allocated scratch vectors for zero-allocation render loop
      const camDesired = new Vector3();
      const camTarget = new Vector3();
      const camTargetCurrent = new Vector3(camTargetInitX, camTargetInitY, camTargetInitZ);
      let prevT = 0;
      let lastGantryCountdown: number | null | undefined = undefined;

      // Render & Simulation Loop
      engine.runRenderLoop(() => {
        if (!scene || isDisposed) return;

        if (lastGantryCountdown !== countdownRef.current) {
          lastGantryCountdown = countdownRef.current;
          trackResult.props.updateStartLights(lastGantryCountdown);
        }

        const rawDt = engine.getDeltaTime() / 1000;
        const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.04) : 0.016;

        if (!isPausedRef.current && !isFinishedRef.current) {
          const isRaceActive = countdownRef.current === null || countdownRef.current === 0;

          // Unified Input Manager (Keyboard + Gamepad analog triggers and stick)
          const inputs = inputManager.getInputs(dt, isRaceActive);

          // Step Physics Engine
          const tData = physicsRef.current.update(dt, inputs, track, spline);

          // Step AI Simulation & Physical Car-to-Car Collision Resolution (before mesh sync)
          if (sessionMode === "grandprix") {
            aiSim.update(
              dt,
              track,
              spline,
              physicsRef.current.position,
              physicsRef.current.speed,
              physicsRef.current.currentT,
              physicsRef.current.signedLateralDistance,
              physicsRef.current.heading,
              isRaceActive
            );

            const coll = collisionSystem.resolveAll(
              dt,
              physicsRef.current,
              aiSim,
              track,
              spline,
              isRaceActive
            );

            if (coll.hasImpact) {
              if (barrierSparkSystem) {
                barrierSparkSystem.triggerCollisionBurst(coll.contactPoint, coll.severity);
              }
              engineAudio.playCollisionImpact(coll.severity);
              inputManager.triggerHaptic(220, coll.severity * 0.75, coll.severity);
              cameraJoltRef.current = Math.max(cameraJoltRef.current, coll.severity * 0.28);
              raceCommentary.announceCollision(
                coll.opponentName,
                coll.penaltySecondsAdded,
                coll.warningIssued,
                coll.playerAtFault
              );

              collisionAlertIdRef.current += 1;
              setImpactFlashSeq((s) => s + 1);
              setCollisionAlert({
                id: collisionAlertIdRef.current,
                opponentName: coll.opponentName,
                opponentNumber: coll.opponentNumber,
                penaltyAdded: coll.penaltySecondsAdded,
                totalPenalty: physicsRef.current.penaltySeconds,
                warnings: physicsRef.current.warnings,
                warningIssued: coll.warningIssued,
                playerAtFault: coll.playerAtFault,
                severity: coll.severity
              });
              if (collisionAlertTimerRef.current) {
                clearTimeout(collisionAlertTimerRef.current);
              }
              collisionAlertTimerRef.current = setTimeout(() => {
                setCollisionAlert(null);
              }, 3600);
            }

            // Refresh HUD telemetry with post-collision speed/penalties
            tData.speedMs = Number.isFinite(physicsRef.current.speed) ? physicsRef.current.speed : 0;
            tData.speedKmh = Math.round(tData.speedMs * 3.6);
            tData.penaltySeconds = physicsRef.current.penaltySeconds;
            tData.warnings = physicsRef.current.warnings;
            tData.drsLocked = physicsRef.current.drsLockedTimer > 0;
          }

          // Update Babylon Vehicle Position & Rotation (post-collision separation)
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

          // Update Wheels, Steering, Suspension, LCD & Brake Glow
          const safeSpeedVal = Number.isFinite(physicsRef.current.speed) ? physicsRef.current.speed : 0;
          const safeSteerVal = Number.isFinite(physicsRef.current.steerAngle) ? physicsRef.current.steerAngle : 0;
          const isBrakingInput = (inputs.brake ?? 0) > 0.1;

          vehicle.update(
            safeSpeedVal,
            safeSteerVal,
            dt,
            isBrakingInput,
            tData.brakeTemp,
            tData.drsActive,
            tData.gear,
            tData.rpmRatio,
            tData.suspensionOffsets
          );

          // Update Dynamic VFX (4-Wheel Smoke, Skidmarks, Sparks, Wet Rain Spray)
          if (tireSmokeSystem) {
            tireSmokeSystem.update(tData.tireSlip, isBrakingInput, tData.speedMs, tData.isLockup, safeSteerVal);
          }
          if (skidmarkSystem) {
            skidmarkSystem.update(px, py, pz, heading, tData.speedMs, tData.isLockup, tData.tireSlip, safeSteerVal);
          }
          if (rainSpraySystem) {
            rainSpraySystem.update(tData.speedMs, weatherConfig.wetness);
          }
          if (barrierSparkSystem) {
            const isNearBarrier = physicsRef.current.lateralDistance > (track.width * 0.5 + 2.7);
            const isSkidPlank = tData.onKerb || tData.speedMs > 62;
            barrierSparkSystem.update(isNearBarrier, isSkidPlank, tData.speedMs);
          }

          // Update Motion Blur strength based on velocity (~0.3x of original 0.65 cap)
          if (motionBlur) {
            const speedMs = tData.speedMs || 0;
            const speedRatio = Math.min(1, Math.max(0, (speedMs - 20) / 65));
            motionBlur.motionStrength = speedRatio * 0.2;
          }

          // Update Camera Position & Target based on mutable cameraModeRef
          const currentCamMode = cameraModeRef.current;
          const safeSpeedMs = Number.isFinite(tData.speedMs) ? tData.speedMs : 0;
          if (cameraJoltRef.current > 0) {
            cameraJoltRef.current = Math.max(0, cameraJoltRef.current - dt * 1.35);
          }
          const joltAmt = cameraJoltRef.current;
          const joltX = joltAmt > 0.002 ? Math.sin(performance.now() * 0.14) * joltAmt : 0;
          const joltY = joltAmt > 0.002 ? Math.cos(performance.now() * 0.19) * joltAmt * 0.65 : 0;
          let targetFov = 1.1;

          if (currentCamMode === "chase") {
            // Low, dynamic chase camera (5.2m back, 1.85m high)
            const camDist = 5.2;
            const camHeight = 1.85;
            const speedShake = safeSpeedMs > 55 ? (Math.sin(performance.now() * 0.025) * 0.0045 * ((safeSpeedMs - 55) / 35)) : 0;
            const camX = px - Math.sin(heading) * camDist + joltX;
            const camY = py + camHeight + speedShake + joltY;
            const camZ = pz - Math.cos(heading) * camDist;

            camDesired.set(camX, camY, camZ);
            camTarget.set(px + Math.sin(heading) * 1.5, py + 0.95, pz + Math.cos(heading) * 1.5);

            Vector3.LerpToRef(camera.position, camDesired, 1 - Math.exp(-9 * dt), camera.position);
            Vector3.LerpToRef(camTargetCurrent, camTarget, 1 - Math.exp(-14 * dt), camTargetCurrent);
            camera.upVector.set(0, 1, 0);
            camera.setTarget(camTargetCurrent);

            // Speed FOV expansion (62 deg to 78 deg)
            targetFov = 1.08 + (safeSpeedMs / 95) * 0.28;
          } else if (currentCamMode === "tcam") {
            // Signature F1 Broadcast T-Cam (Roll-Hoop TV Pod looking over Halo & front wheels)
            const tCamDist = -0.14;
            const tCamHeight = 1.09;
            const camX = px + Math.sin(heading) * tCamDist + joltX * 0.4;
            const camY = py + tCamHeight + joltY * 0.4;
            const camZ = pz + Math.cos(heading) * tCamDist;

            camDesired.set(camX, camY, camZ);
            camTarget.set(
              px + Math.sin(heading) * 18,
              py + tCamHeight - 2.45,
              pz + Math.cos(heading) * 18
            );
            camera.position.copyFrom(camDesired);
            const camRollTilt = Math.max(-0.04, Math.min(0.04, -(tData.gForceLat || 0) * 0.012));
            camera.upVector.set(Math.cos(heading) * camRollTilt, 1, -Math.sin(heading) * camRollTilt);
            camera.setTarget(camTarget);
            targetFov = 1.24 + (safeSpeedMs / 110) * 0.12;
          } else if (currentCamMode === "cockpit") {
            // Driver Eye Cockpit view framing curved Halo pillar & rotating steering wheel LCD
            const eyeDist = 0.16;
            const eyeHeight = 0.74;
            camDesired.set(
              px + Math.sin(heading) * eyeDist + joltX * 0.45,
              py + eyeHeight + joltY * 0.45,
              pz + Math.cos(heading) * eyeDist
            );
            camTarget.set(
              px + Math.sin(heading) * 20,
              py + eyeHeight - 0.85,
              pz + Math.cos(heading) * 20
            );
            camera.position.copyFrom(camDesired);
            const cockpitTilt = Math.max(-0.035, Math.min(0.035, -(tData.gForceLat || 0) * 0.01));
            camera.upVector.set(Math.cos(heading) * cockpitTilt, 1, -Math.sin(heading) * cockpitTilt);
            camera.setTarget(camTarget);
            targetFov = 1.22;
          } else {
            // Front wing / Nose cone bumper view forward over tarmac
            const noseDist = 2.55;
            const noseHeight = 0.36;
            camDesired.set(
              px + Math.sin(heading) * noseDist + joltX * 0.4,
              py + noseHeight + joltY * 0.4,
              pz + Math.cos(heading) * noseDist
            );
            camTarget.set(
              px + Math.sin(heading) * 25,
              py + noseHeight - 0.12,
              pz + Math.cos(heading) * 25
            );
            camera.position.copyFrom(camDesired);
            camera.upVector.set(0, 1, 0);
            camera.setTarget(camTarget);
            targetFov = 1.34;
          }

          camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-8 * dt));

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
                setFinalRaceTime(physicsRef.current.totalRaceTime);
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

          // Sync AI 3D Meshes (post-collision separation)
          if (sessionMode === "grandprix") {
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

      onResize = () => {
        if (engine) {
          applyHardwareScaling();
          engine.resize();
        }
      };
      window.addEventListener("resize", onResize);
    }

    initBabylon();

    return () => {
      isDisposed = true;
      if (collisionAlertTimerRef.current) {
        clearTimeout(collisionAlertTimerRef.current);
      }
      if (onResize) {
        window.removeEventListener("resize", onResize);
      }
      engineAudio.stop();
      if (tireSmokeSystem) {
        tireSmokeSystem.dispose();
      }
      if (skidmarkSystem) {
        skidmarkSystem.dispose();
      }
      if (rainSpraySystem) {
        rainSpraySystem.dispose();
      }
      if (barrierSparkSystem) {
        barrierSparkSystem.dispose();
      }
      if (motionBlur) {
        motionBlur.dispose();
      }
      if (ssaoPipeline) {
        ssaoPipeline.dispose();
      }
      if (pipeline) {
        pipeline.dispose();
      }
      if (ssrPipeline) {
        ssrPipeline.dispose();
      }
      if (taaPipeline) {
        taaPipeline.dispose();
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
        engineRef.current = null;
      }
    };
  }, [track, spline, sessionMode, liveryIndex, totalLaps, aiSim, collisionSystem, inputManager, weatherPreset, graphicsTier]);

  // Synchronize AI positions periodically for HUD
  useEffect(() => {
    if (sessionMode !== "grandprix") return;
    const interval = setInterval(() => {
      setAiCars([...aiSim.cars]);
    }, 150);
    return () => clearInterval(interval);
  }, [aiSim, sessionMode]);

  return (
    <div className="game">
      {/* Babylon.js WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0, outline: "none", touchAction: "none" }}
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
        touchControlsActive={showTouchControls}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        collisionAlert={collisionAlert}
        impactFlashSeq={impactFlashSeq}
      />

      {/* Mobile & Tablet Touch / Tilt Controls */}
      {showTouchControls && (
        <MobileControls
          inputManager={inputManager}
          steerScheme={steerScheme}
          isRotatedPortrait={isRotatedPortrait}
          drsAvailable={telemetry.drsAvailable}
          drsActive={telemetry.drsActive}
          disabled={isPaused || isFinished}
        />
      )}

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
                  SMOOTH
                </button>
                <button
                  type="button"
                  className={`pill-btn ${Math.abs(steeringSensitivity - 1.0) < 0.04 ? "active" : ""}`}
                  onClick={() => handleSensitivityChange(1.0)}
                >
                  STANDARD
                </button>
                <button
                  type="button"
                  className={`pill-btn ${Math.abs(steeringSensitivity - 1.3) < 0.04 ? "active" : ""}`}
                  onClick={() => handleSensitivityChange(1.3)}
                >
                  SHARP
                </button>
              </div>

              {onTouchControlModeChange && (
                <div className="pause-touch-group">
                  <label>TOUCH CONTROLS</label>
                  <div className="pills-group">
                    <button
                      type="button"
                      className={`pill-btn ${touchControlMode === "auto" ? "active" : ""}`}
                      onClick={() => onTouchControlModeChange("auto")}
                    >
                      AUTO
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${touchControlMode === "on" ? "active" : ""}`}
                      onClick={() => onTouchControlModeChange("on")}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${touchControlMode === "off" ? "active" : ""}`}
                      onClick={() => onTouchControlModeChange("off")}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              )}

              {onSteerSchemeChange && showTouchControls && (
                <div className="pause-touch-group">
                  <label>STEER MODE</label>
                  <div className="pills-group">
                    <button
                      type="button"
                      className={`pill-btn ${steerScheme === "buttons" ? "active" : ""}`}
                      onClick={() => onSteerSchemeChange("buttons")}
                    >
                      BUTTONS
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${steerScheme === "slider" ? "active" : ""}`}
                      onClick={() => onSteerSchemeChange("slider")}
                    >
                      SLIDER
                    </button>
                    <button
                      type="button"
                      className={`pill-btn ${steerScheme === "tilt" ? "active" : ""}`}
                      onClick={() => onSteerSchemeChange("tilt")}
                    >
                      TILT
                    </button>
                  </div>
                </div>
              )}
              {onGraphicsTierChange && (
                <div className="pause-touch-group">
                  <label>GRAPHICS QUALITY</label>
                  <div className="pills-group" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {(["low", "medium", "high", "ultra"] as GraphicsTier[]).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        className={`pill-btn ${graphicsTier === tier ? "active" : ""}`}
                        onClick={() => onGraphicsTierChange(tier)}
                      >
                        {tier.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onWeatherPresetChange && (
                <div className="pause-touch-group">
                  <label>WEATHER &amp; LIGHTING</label>
                  <select
                    className="f1-select"
                    value={weatherPreset}
                    onChange={(e) => onWeatherPresetChange(e.target.value as WeatherPreset)}
                  >
                    <option value="midday">CLEAR DAYLIGHT</option>
                    <option value="golden">GOLDEN HOUR</option>
                    <option value="overcast">OVERCAST</option>
                    <option value="wet">WET TRACK (SSR)</option>
                    <option value="night">NIGHT FLOODLIT</option>
                  </select>
                </div>
              )}
            </div>

            <div className="modal-btn-row">
              <button type="button" className="primary-btn" onClick={handleTogglePause}>
                RESUME <span>→</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onExitToMenu}>
                EXIT TO PADDOCK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {isFinished && (() => {
        const trackSec = Number.isFinite(finalRaceTime) && finalRaceTime > 0 ? finalRaceTime : telemetry.lapTime;
        const penSec = Number.isFinite(telemetry.penaltySeconds) ? telemetry.penaltySeconds : 0;
        const totalSec = trackSec + penSec;
        const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
        return (
          <div className="modal-backdrop">
            <div className="victory-modal">
              <p className="eyebrow">BABYLON.JS RACE CONTROL</p>
              <h2>CHECKERED FLAG</h2>
              <div className="victory-pos">
                FINAL TIME: {fmt(totalSec)}
              </div>
              <div className="victory-breakdown">
                <div className="victory-row">
                  <span>TRACK TIME</span>
                  <span>{fmt(trackSec)}</span>
                </div>
                <div className={`victory-row ${penSec > 0 ? "has-penalty" : "clean"}`}>
                  <span>RACE PENALTIES</span>
                  <span>{penSec > 0 ? `+${penSec.toFixed(1)}s` : "CLEAN (0.0s)"}</span>
                </div>
              </div>
              <button className="primary-btn" onClick={onExitToMenu}>
                RETURN TO PADDOCK <span>→</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
