"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, PerspectiveCamera, Sky } from "@react-three/drei";
import * as THREE from "three";
import { TRACKS, Track } from "@/data/tracks";
import { TrackSceneGeometry, build3DCurve } from "@/components/TrackGenerator";
import { FormulaCarModel, LIVERIES } from "@/components/FormulaCarModel";
import { VehiclePhysics, TelemetryData, VehicleInputs } from "@/lib/physics/VehiclePhysics";
import { AISimulator, AICarState } from "@/lib/ai/AIDriver";
import { engineAudio } from "@/lib/audio/EngineSound";
import { RacingHUD } from "@/components/RacingHUD";
import BabylonRacingGame from "@/components/babylon/BabylonRacingGame";

type GameState = "menu" | "countdown" | "racing" | "paused" | "finished";
type SessionMode = "grandprix" | "practice" | "qualifying";
type CameraMode = "chase" | "cockpit" | "nose";
type EngineType = "three" | "babylon";

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

// -----------------------------------------------------------------------------
// Interactive 3D Driver Component
// Zero-allocation loop obeying AGENTS.md performance invariants
// -----------------------------------------------------------------------------
function Driver({
  track,
  spline,
  active,
  liveryIndex,
  cameraMode,
  onTelemetry,
  onLapComplete,
  aiSim
}: {
  track: Track;
  spline: THREE.CatmullRomCurve3;
  active: boolean;
  liveryIndex: number;
  cameraMode: CameraMode;
  onTelemetry: (t: TelemetryData) => void;
  onLapComplete: (lapTime: number) => void;
  aiSim: AISimulator;
}) {
  const carGroup = useRef<THREE.Group>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const physics = useRef(new VehiclePhysics());
  const keys = useRef<Record<string, boolean>>({});

  // Pre-allocated scratch objects for zero-allocation useFrame
  const vTarget = useRef(new THREE.Vector3());
  const vCamDesired = useRef(new THREE.Vector3());
  const vUp = useRef(new THREE.Vector3(0, 1, 0));
  const vCamOffset = useRef(new THREE.Vector3());

  const prevT = useRef(0);
  const isFirstFrame = useRef(true);
  const [carRenderProps, setCarRenderProps] = useState({
    steerAngle: 0,
    speed: 0,
    isBraking: false,
    drsActive: false,
    brakeTemp: 100,
    isLockup: false,
    tireSlip: 0,
    suspensionOffsets: [0, 0, 0, 0] as [number, number, number, number]
  });

  // Track start position
  const startPt = useMemo(() => spline.getPointAt(0), [spline]);
  const startTan = useMemo(() => spline.getTangentAt(0).normalize(), [spline]);
  const startHeading = useMemo(() => Math.atan2(startTan.x, startTan.z), [startTan]);

  // Reset physics on track change or initial mount
  useEffect(() => {
    physics.current.reset(startPt, startHeading);
    prevT.current = 0;
    isFirstFrame.current = true;
  }, [track, spline, startPt, startHeading]);

  // Input listeners
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "e", "E"].includes(e.key)) {
        e.preventDefault();
      }
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    if (!carGroup.current) return;
    const dt = Math.min(delta, 0.04);
    const k = keys.current;

    const inputs: VehicleInputs = {
      accelerate: active && (k["w"] || k["arrowup"]),
      brake: active && (k["s"] || k["arrowdown"]),
      steerLeft: active && (k["a"] || k["arrowleft"]),
      steerRight: active && (k["d"] || k["arrowright"]),
      drs: active && (k["e"] || k[" "])
    };

    // 1. Step vehicle physics simulation
    const telemetry = physics.current.update(dt, inputs, track, spline);

    // 2. Lap completion detection (crossing start line from t > 0.85 to t < 0.15)
    if (prevT.current > 0.85 && physics.current.currentT < 0.15) {
      onLapComplete(physics.current.lapTime);
      physics.current.lapTime = 0;
    }
    prevT.current = physics.current.currentT;

    // 3. Update Car 3D Transform
    const carPos = physics.current.position;
    if (!Number.isFinite(carPos.x) || !Number.isFinite(carPos.y) || !Number.isFinite(carPos.z)) {
      carPos.copy(startPt);
    }
    carGroup.current.position.copy(carPos);
    carGroup.current.rotation.y = Number.isFinite(physics.current.heading) ? physics.current.heading : 0;
    carGroup.current.rotation.x = Number.isFinite(physics.current.pitch) ? physics.current.pitch : 0;
    carGroup.current.rotation.z = Number.isFinite(physics.current.roll) ? physics.current.roll : 0;

    // Update car visual props
    setCarRenderProps({
      steerAngle: Number.isFinite(physics.current.steerAngle) ? physics.current.steerAngle : 0,
      speed: Number.isFinite(physics.current.speed) ? physics.current.speed : 0,
      isBraking: inputs.brake,
      drsActive: !!physics.current.drsActive,
      brakeTemp: telemetry.brakeTemp,
      isLockup: telemetry.isLockup,
      tireSlip: telemetry.tireSlip,
      suspensionOffsets: telemetry.suspensionOffsets
    });

    // 4. Update Engine Sound Audio
    if (active) {
      engineAudio.update(
        telemetry.rpmRatio,
        telemetry.speedMs,
        inputs.brake,
        Math.abs(physics.current.steerAngle) > 0.35
      );
    }

    // 5. Update Camera Rig
    if (cameraRef.current) {
      const heading = Number.isFinite(physics.current.heading) ? physics.current.heading : 0;
      const speed = Number.isFinite(physics.current.speed) ? physics.current.speed : 0;

      if (cameraMode === "chase") {
        // Third-person chase camera with dynamic distance & speed FOV
        vCamOffset.current.set(-Math.sin(heading) * 8.5, 4.2, -Math.cos(heading) * 8.5);
        vCamDesired.current.copy(carPos).add(vCamOffset.current);
        vTarget.current.copy(carPos).addScaledVector(vUp.current, 1.2);

        if (isFirstFrame.current) {
          cameraRef.current.position.copy(vCamDesired.current);
          cameraRef.current.lookAt(vTarget.current);
          isFirstFrame.current = false;
        } else {
          cameraRef.current.position.lerp(vCamDesired.current, 1 - Math.exp(-6 * dt));
          cameraRef.current.lookAt(vTarget.current);
        }

        // Speed-dependent dynamic FOV
        const targetFov = 62 + (speed / 95) * 16;
        const safeTargetFov = Number.isFinite(targetFov) ? THREE.MathUtils.clamp(targetFov, 45, 110) : 65;
        cameraRef.current.fov = THREE.MathUtils.lerp(cameraRef.current.fov, safeTargetFov, dt * 4);
        cameraRef.current.updateProjectionMatrix();
      } else if (cameraMode === "cockpit") {
        // Cockpit / Halo POV
        vCamOffset.current.set(0, 0.76, 0.25);
        vCamDesired.current.copy(carPos).add(vCamOffset.current);
        vTarget.current.set(
          vCamDesired.current.x + Math.sin(heading) * 15,
          vCamDesired.current.y,
          vCamDesired.current.z + Math.cos(heading) * 15
        );

        cameraRef.current.position.copy(vCamDesired.current);
        cameraRef.current.lookAt(vTarget.current);
        cameraRef.current.fov = 75;
        cameraRef.current.updateProjectionMatrix();
        isFirstFrame.current = false;
      } else if (cameraMode === "nose") {
        // Front nose wing POV
        vCamOffset.current.set(0, 0.45, 1.8);
        vCamDesired.current.copy(carPos).add(vCamOffset.current);
        vTarget.current.set(
          vCamDesired.current.x + Math.sin(heading) * 18,
          vCamDesired.current.y - 0.2,
          vCamDesired.current.z + Math.cos(heading) * 18
        );

        cameraRef.current.position.copy(vCamDesired.current);
        cameraRef.current.lookAt(vTarget.current);
        cameraRef.current.fov = 85;
        cameraRef.current.updateProjectionMatrix();
        isFirstFrame.current = false;
      }
    }

    // 6. Update AI Opponents
    aiSim.update(dt, track, spline, physics.current.position, active);

    // 7. Push Telemetry to HUD
    onTelemetry(telemetry);
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[startPt.x - 10, 6, startPt.z - 10]} fov={65} />
      <group ref={carGroup} position={[startPt.x, startPt.y, startPt.z]}>
        <FormulaCarModel
          liveryIndex={liveryIndex}
          steerAngle={carRenderProps.steerAngle}
          speed={carRenderProps.speed}
          isBraking={carRenderProps.isBraking}
          drsActive={carRenderProps.drsActive}
          brakeTemp={carRenderProps.brakeTemp}
          isLockup={carRenderProps.isLockup}
          tireSlip={carRenderProps.tireSlip}
          suspensionOffsets={carRenderProps.suspensionOffsets}
        />
      </group>
    </>
  );
}

// -----------------------------------------------------------------------------
// AI Opponent Mesh Renderers
// -----------------------------------------------------------------------------
function AICarMeshes({ aiCars }: { aiCars: AICarState[] }) {
  return (
    <group>
      {aiCars.map((ai) => {
        const px = Number.isFinite(ai.position?.x) ? ai.position.x : 0;
        const py = Number.isFinite(ai.position?.y) ? ai.position.y : 0;
        const pz = Number.isFinite(ai.position?.z) ? ai.position.z : 0;
        const heading = Number.isFinite(ai.heading) ? ai.heading : 0;
        const steer = Number.isFinite(ai.steerAngle) ? ai.steerAngle : 0;
        const speed = Number.isFinite(ai.speed) ? ai.speed : 0;
        return (
          <group
            key={ai.id}
            position={[px, py, pz]}
            rotation={[0, heading, 0]}
          >
            <FormulaCarModel
              liveryIndex={ai.liveryIndex}
              steerAngle={steer}
              speed={speed}
              isBraking={speed < ai.targetSpeed - 5}
              drsActive={speed > 75}
            />
          </group>
        );
      })}
    </group>
  );
}

// -----------------------------------------------------------------------------
// Main Racing Game Shell
// -----------------------------------------------------------------------------
export default function RacingGame() {
  const [track, setTrack] = useState<Track>(TRACKS[0]);
  const [state, setState] = useState<GameState>("menu");
  const [sessionMode, setSessionMode] = useState<SessionMode>("grandprix");
  const [engineType, setEngineType] = useState<EngineType>("three");
  const [liveryIndex, setLiveryIndex] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryData>(defaultTelemetry);
  const [playerLap, setPlayerLap] = useState(1);
  const [totalLaps, setTotalLaps] = useState(track.lapsDefault);
  const [countdown, setCountdown] = useState<number | null>(null);

  // AI Simulator
  const aiSim = useMemo(() => new AISimulator(), []);
  const [aiCars, setAiCars] = useState<AICarState[]>([]);

  // 3D Spline Curve for Track
  const spline = useMemo(() => build3DCurve(track.points), [track]);

  // Setup Grid and Opponents on track/session change
  useEffect(() => {
    if (sessionMode === "grandprix") {
      aiSim.initializeGrid(track, spline);
      setAiCars([...aiSim.cars]);
    } else {
      aiSim.cars = [];
      setAiCars([]);
    }
    setTotalLaps(sessionMode === "qualifying" ? 1 : track.lapsDefault);
  }, [track, spline, sessionMode, aiSim]);

  // Synchronize AI states for HUD periodically
  useEffect(() => {
    if (state !== "racing") return;
    const interval = setInterval(() => {
      setAiCars([...aiSim.cars]);
    }, 120);
    return () => clearInterval(interval);
  }, [state, aiSim]);

  // Keyboard shortcut for camera toggle ('C') and audio mute ('M')
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

  // Handle Race Start with 5-Red-Lights Sequence
  const startSession = useCallback(() => {
    engineAudio.init();
    setPlayerLap(1);
    setTelemetry(defaultTelemetry);

    if (sessionMode === "grandprix") {
      // 5-Red-Lights procedure
      setState("countdown");
      setCountdown(3);
      engineAudio.playBeep(false);

      let step = 3;
      const timer = setInterval(() => {
        step -= 1;
        if (step > 0) {
          setCountdown(step);
          engineAudio.playBeep(false);
        } else if (step === 0) {
          setCountdown(0); // Lights out!
          engineAudio.playBeep(true);
        } else {
          clearInterval(timer);
          setCountdown(null);
          setState("racing");
        }
      }, 1000);
    } else {
      setState("racing");
    }
  }, [sessionMode]);

  // Lap Completion Trigger
  const handleLapComplete = useCallback(
    (lapTime: number) => {
      setPlayerLap((curr) => {
        if (curr >= totalLaps) {
          setState("finished");
          engineAudio.stop();
          return curr;
        }
        return curr + 1;
      });
    },
    [totalLaps]
  );

  if (engineType === "babylon" && (state === "racing" || state === "countdown")) {
    return (
      <BabylonRacingGame
        track={track}
        sessionMode={sessionMode}
        liveryIndex={liveryIndex}
        onExitToMenu={() => setState("menu")}
      />
    );
  }

  return (
    <div className="game">
      {/* 3D WebGL Canvas with ACES Tone Mapping & Atmospheric Fog */}
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12
        }}
      >
        <color attach="background" args={[track.skyColor]} />
        <fogExp2 attach="fog" color={track.skyColor} density={0.0014} />
        <Sky sunPosition={[120, 45, 100]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[50, 70, 30]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={300}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />
        <Environment preset="city" />

        {/* 3D Circuit Geometry */}
        <TrackSceneGeometry track={track} curve={spline} />

        {/* AI Opponents */}
        <AICarMeshes aiCars={aiCars} />

        {/* Player Driver & Physics Loop */}
        <Driver
          track={track}
          spline={spline}
          active={state === "racing"}
          liveryIndex={liveryIndex}
          cameraMode={cameraMode}
          onTelemetry={setTelemetry}
          onLapComplete={handleLapComplete}
          aiSim={aiSim}
        />
      </Canvas>

      {/* Main Menu Panel */}
      {state === "menu" && (
        <section className="f1-menu-panel">
          <p className="eyebrow">FIA FORMULA MOTORSPORT SIMULATION</p>
          <h1>
            GRAND PRIX<br />
            <span>CHAMPIONSHIP.</span>
          </h1>

          {/* Circuit Selector */}
          <div className="form-group">
            <label htmlFor="track-select">SELECT CIRCUIT</label>
            <select
              id="track-select"
              className="f1-select"
              value={track.id}
              onChange={(e) => setTrack(TRACKS.find((t) => t.id === e.target.value) || TRACKS[0])}
            >
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.location} ({t.length})
                </option>
              ))}
            </select>
          </div>

          {/* 3D Engine Architecture Selector */}
          <div className="form-group">
            <label>3D SIMULATION ENGINE</label>
            <div className="pills-group" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button
                className={`pill-btn ${engineType === "three" ? "active" : ""}`}
                onClick={() => setEngineType("three")}
              >
                THREE.JS (R3F)
              </button>
              <button
                className={`pill-btn ${engineType === "babylon" ? "active" : ""}`}
                onClick={() => setEngineType("babylon")}
              >
                BABYLON.JS (HAVOK)
              </button>
            </div>
          </div>

          {/* Session Mode Selector */}
          <div className="form-group">
            <label>SESSION FORMAT</label>
            <div className="pills-group">
              <button
                className={`pill-btn ${sessionMode === "grandprix" ? "active" : ""}`}
                onClick={() => setSessionMode("grandprix")}
              >
                GRAND PRIX
              </button>
              <button
                className={`pill-btn ${sessionMode === "qualifying" ? "active" : ""}`}
                onClick={() => setSessionMode("qualifying")}
              >
                QUALIFYING
              </button>
              <button
                className={`pill-btn ${sessionMode === "practice" ? "active" : ""}`}
                onClick={() => setSessionMode("practice")}
              >
                PRACTICE
              </button>
            </div>
          </div>

          {/* Team Livery Selector */}
          <div className="form-group">
            <label>TEAM LIVERY</label>
            <select
              className="f1-select"
              value={liveryIndex}
              onChange={(e) => setLiveryIndex(parseInt(e.target.value))}
            >
              {LIVERIES.map((liv, idx) => (
                <option key={idx} value={idx}>
                  {liv.name} ({liv.team})
                </option>
              ))}
            </select>
          </div>

          {/* Circuit Stats */}
          <div className="circuit-info-card">
            <span>TURNS: <b>{track.turns}</b></span>
            <span>LENGTH: <b>{track.length}</b></span>
            <span>LAPS: <b>{sessionMode === "qualifying" ? 1 : track.lapsDefault}</b></span>
          </div>

          <button className="f1-primary-btn" onClick={startSession}>
            LAUNCH RACE <span>→</span>
          </button>

          <p className="controls-legend">
            WASD / ARROWS: DRIVE · E / SPACE: DRS · C: CAMERA · M: SOUND
          </p>
        </section>
      )}

      {/* Live Racing HUD */}
      {(state === "racing" || state === "countdown") && (
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
          onPause={() => setState("paused")}
          isAudioMuted={isAudioMuted}
          onToggleAudio={() => {
            const m = engineAudio.toggleMute();
            setIsAudioMuted(m);
          }}
          countdown={countdown}
        />
      )}

      {/* Paused Modal */}
      {state === "paused" && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="eyebrow">RACE CONTROL</p>
            <h2>SESSION PAUSED</h2>
            <button className="primary-btn" onClick={() => setState("racing")}>
              RESUME <span>→</span>
            </button>
            <button className="secondary-btn" onClick={() => setState("menu")}>
              EXIT TO PADDOCK
            </button>
          </div>
        </div>
      )}

      {/* Checkered Flag / Victory Modal */}
      {state === "finished" && (
        <div className="modal-backdrop">
          <div className="victory-modal">
            <p className="eyebrow">SESSION COMPLETED</p>
            <h2>CHECKERED FLAG</h2>
            <div className="victory-pos">
              GRAND PRIX FINISH · LAP TIME: {Math.floor((Number.isFinite(telemetry.lapTime) ? telemetry.lapTime : 0) / 60)}:
              {((Number.isFinite(telemetry.lapTime) ? telemetry.lapTime : 0) % 60).toFixed(2).padStart(5, "0")}
            </div>
            <button
              className="primary-btn"
              onClick={() => {
                setState("menu");
              }}
            >
              RETURN TO MENU <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
