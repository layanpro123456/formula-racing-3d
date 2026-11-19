"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  TargetCamera
} from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { build3DCurve, Spline3D } from "@/lib/math/Spline3D";
import { createBabylonTrack } from "./BabylonTrackGenerator";
import { BabylonVehicle } from "./BabylonVehicle";
import { getHavokPlugin } from "@/lib/babylon/havokLoader";
import { VehiclePhysics, TelemetryData, VehicleInputs } from "@/lib/physics/VehiclePhysics";
import { AISimulator, AICarState } from "@/lib/ai/AIDriver";
import { engineAudio } from "@/lib/audio/EngineSound";
import { RacingHUD } from "@/components/RacingHUD";

type CameraMode = "chase" | "cockpit" | "nose";

interface BabylonRacingGameProps {
  track: Track;
  sessionMode: "grandprix" | "practice" | "qualifying";
  liveryIndex: number;
  onExitToMenu: () => void;
}

const defaultTelemetry: TelemetryData = {
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

export default function BabylonRacingGame({
  track,
  sessionMode,
  liveryIndex,
  onExitToMenu
}: BabylonRacingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>(defaultTelemetry);
  const [playerLap, setPlayerLap] = useState(1);
  const [totalLaps, setTotalLaps] = useState(sessionMode === "qualifying" ? 1 : track.lapsDefault);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(sessionMode === "grandprix" ? 3 : null);
  const countdownRef = useRef<number | null>(sessionMode === "grandprix" ? 3 : null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const physicsRef = useRef(new VehiclePhysics());
  const aiSim = useMemo(() => new AISimulator(), []);
  const [aiCars, setAiCars] = useState<AICarState[]>([]);

  const spline = useMemo(() => build3DCurve(track.points), [track]);

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

  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: Engine;
    let scene: Scene;
    let vehicle: BabylonVehicle;
    const aiVehicles: BabylonVehicle[] = [];
    let isDisposed = false;

    const keys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "e", "E"].includes(e.key)) {
        e.preventDefault();
      }
      keys[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    async function initBabylon() {
      if (!canvasRef.current || isDisposed) return;

      // 1. Initialize Babylon.js Engine & Scene
      engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
      scene = new Scene(engine);
      scene.clearColor = Color4.FromHexString(`${track.skyColor}FF`);

      // 2. Initialize Havok Physics WASM Plugin
      try {
        const havokPlugin = await getHavokPlugin();
        scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
      } catch (e) {
        console.warn("Havok Physics fallback to deterministic kinematics:", e);
      }

      // 3. Lighting & Shadows
      const ambient = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
      ambient.intensity = 0.65;
      ambient.groundColor = new Color3(0.2, 0.2, 0.2);

      const sun = new DirectionalLight("sunLight", new Vector3(-1, -2, -1), scene);
      sun.position = new Vector3(50, 70, 30);
      sun.intensity = 1.8;

      // 4. Generate Procedural 3D Banked Track
      createBabylonTrack(track, track.points, scene);

      // 5. Build Formula Car Model for Player
      vehicle = new BabylonVehicle("playerF1", liveryIndex, scene);

      // Camera
      const camera = new TargetCamera("mainCam", new Vector3(0, 5, -10), scene);
      camera.fov = 1.1;

      // Start position from spline
      const startPt = spline.getPointAt(0);
      const startTan = spline.getTangentAt(0).normalize();
      const startHeading = Math.atan2(startTan.x, startTan.z);

      physicsRef.current.reset(
        startPt,
        startHeading
      );

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
        });
      }

      // Initialize Sound
      engineAudio.init();

      // Pre-allocated scratch vectors for zero-allocation render loop
      const camDesired = new Vector3();
      const camTarget = new Vector3();
      let prevT = 0;

      // Render & Simulation Loop
      engine.runRenderLoop(() => {
        if (!scene || isDisposed) return;

        const rawDt = engine.getDeltaTime() / 1000;
        const dt = Number.isFinite(rawDt) && rawDt > 0 ? Math.min(rawDt, 0.04) : 0.016;

        if (!isPaused && !isFinished) {
          const isRaceActive = countdownRef.current === null || countdownRef.current === 0;

          const inputs: VehicleInputs = {
            accelerate: isRaceActive && !!(keys["w"] || keys["arrowup"]),
            brake: isRaceActive && !!(keys["s"] || keys["arrowdown"]),
            steerLeft: !!(keys["a"] || keys["arrowleft"]),
            steerRight: !!(keys["d"] || keys["arrowright"]),
            drs: isRaceActive && !!(keys["e"] || keys[" "])
          };

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
            inputs.brake,
            tData.brakeTemp,
            tData.drsActive
          );

          // Update Camera Position & Target
          if (cameraMode === "chase") {
            const camX = px - Math.sin(heading) * 8.5;
            const camY = py + 4.2;
            const camZ = pz - Math.cos(heading) * 8.5;
            camDesired.set(camX, camY, camZ);
            camTarget.set(px, py + 1.2, pz);
            Vector3.LerpToRef(camera.position, camDesired, 1 - Math.exp(-6 * dt), camera.position);
            camera.setTarget(camTarget);
            const safeSpeedMs = Number.isFinite(tData.speedMs) ? tData.speedMs : 0;
            camera.fov = 1.05 + (safeSpeedMs / 95) * 0.25;
          } else if (cameraMode === "cockpit") {
            camera.position.set(px, py + 0.76, pz);
            camTarget.set(px + Math.sin(heading) * 15, py + 0.76, pz + Math.cos(heading) * 15);
            camera.setTarget(camTarget);
            camera.fov = 1.25;
          } else {
            camera.position.set(px, py + 0.45, pz);
            camTarget.set(px + Math.sin(heading) * 18, py + 0.35, pz + Math.cos(heading) * 18);
            camera.setTarget(camTarget);
            camera.fov = 1.4;
          }

          // Engine Audio
          engineAudio.update(
            tData.rpmRatio,
            tData.speedMs,
            inputs.brake,
            Math.abs(physicsRef.current.steerAngle) > 0.35
          );

          // Lap detection
          if (prevT > 0.85 && physicsRef.current.currentT < 0.15) {
            setPlayerLap((curr) => {
              if (curr >= totalLaps) {
                setIsFinished(true);
                engineAudio.stop();
                return curr;
              }
              return curr + 1;
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

          setTelemetry(tData);
        }

        scene.render();
      });

      const onResize = () => engine && engine.resize();
      window.addEventListener("resize", onResize);
    }

    initBabylon();

    return () => {
      isDisposed = true;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      engineAudio.stop();
      if (engine) {
        engine.stopRenderLoop();
        engine.dispose();
      }
    };
  }, [track, spline, sessionMode, liveryIndex, totalLaps, cameraMode, isPaused, isFinished, aiSim]);

  // Synchronize AI positions periodically for HUD
  useEffect(() => {
    if (sessionMode !== "grandprix") return;
    const interval = setInterval(() => {
      setAiCars([...aiSim.cars]);
    }, 120);
    return () => clearInterval(interval);
  }, [aiSim, sessionMode]);

  // Key shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") {
        setCameraMode((prev) => (prev === "chase" ? "cockpit" : prev === "cockpit" ? "nose" : "chase"));
      } else if (e.key.toLowerCase() === "m") {
        const muted = engineAudio.toggleMute();
        setIsAudioMuted(muted);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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
        cameraMode={cameraMode}
        onToggleCamera={() =>
          setCameraMode((prev) => (prev === "chase" ? "cockpit" : prev === "cockpit" ? "nose" : "chase"))
        }
        onPause={() => setIsPaused((prev) => !prev)}
        isAudioMuted={isAudioMuted}
        onToggleAudio={() => {
          const m = engineAudio.toggleMute();
          setIsAudioMuted(m);
        }}
        countdown={countdown}
      />

      {/* Paused Modal */}
      {isPaused && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="eyebrow">BABYLON.JS HAVOK ENGINE</p>
            <h2>SESSION PAUSED</h2>
            <button className="primary-btn" onClick={() => setIsPaused(false)}>
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
