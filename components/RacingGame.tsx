"use client";

import React, { useState } from "react";
import { TRACKS, Track } from "@/data/tracks";
import { LIVERIES } from "@/data/liveries";
import BabylonRacingGame from "@/components/babylon/BabylonRacingGame";
import { LandscapeStage, useLandscapeStage } from "@/components/LandscapeStage";
import { TouchSteerScheme } from "@/lib/input/InputManager";
import { engineAudio } from "@/lib/audio/EngineSound";

type GameState = "menu" | "racing";
type SessionMode = "grandprix" | "practice" | "qualifying";
export type TouchControlMode = "auto" | "on" | "off";

function RacingGameShell() {
  const { isTouchDevice, isRotatedPortrait, tryEnterLandscapeFullscreen } = useLandscapeStage();
  const [state, setState] = useState<GameState>("menu");
  const [track, setTrack] = useState<Track>(TRACKS[3]); // Default: Circuit de Spa-Francorchamps
  const [sessionMode, setSessionMode] = useState<SessionMode>("grandprix");
  const [liveryIndex, setLiveryIndex] = useState(0);
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(1.0);
  const [touchControlMode, setTouchControlMode] = useState<TouchControlMode>("auto");
  const [steerScheme, setSteerScheme] = useState<TouchSteerScheme>("buttons");

  // Load saved preferences from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("f1_steering_sensitivity");
      if (saved) {
        const val = parseFloat(saved);
        if (Number.isFinite(val) && val >= 0.5 && val <= 1.5) {
          setSteeringSensitivity(val);
        }
      }
      const savedTouchMode = localStorage.getItem("f1_touch_mode");
      if (savedTouchMode === "auto" || savedTouchMode === "on" || savedTouchMode === "off") {
        setTouchControlMode(savedTouchMode);
      }
      const savedSteerScheme = localStorage.getItem("f1_steer_scheme");
      if (savedSteerScheme === "buttons" || savedSteerScheme === "slider" || savedSteerScheme === "tilt") {
        setSteerScheme(savedSteerScheme);
      }
    } catch {}
  }, []);

  const handleSensitivityChange = (newVal: number) => {
    setSteeringSensitivity(newVal);
    try {
      localStorage.setItem("f1_steering_sensitivity", newVal.toString());
    } catch {}
  };

  const handleTouchModeChange = (mode: TouchControlMode) => {
    setTouchControlMode(mode);
    try {
      localStorage.setItem("f1_touch_mode", mode);
    } catch {}
  };

  const handleSteerSchemeChange = async (scheme: TouchSteerScheme) => {
    if (scheme === "tilt" && typeof window !== "undefined") {
      try {
        const DevOrient = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
        if (DevOrient && typeof DevOrient.requestPermission === "function") {
          const perm = await DevOrient.requestPermission();
          if (perm !== "granted") {
            return;
          }
        }
      } catch {}
    }
    setSteerScheme(scheme);
    try {
      localStorage.setItem("f1_steer_scheme", scheme);
    } catch {}
  };

  const handleLaunchRace = () => {
    engineAudio.resume();
    if (isTouchDevice) {
      void tryEnterLandscapeFullscreen();
    }
    setState("racing");
  };

  if (state === "racing") {
    return (
      <BabylonRacingGame
        track={track}
        sessionMode={sessionMode}
        liveryIndex={liveryIndex}
        initialSteeringSensitivity={steeringSensitivity}
        touchControlMode={touchControlMode}
        steerScheme={steerScheme}
        onTouchControlModeChange={handleTouchModeChange}
        onSteerSchemeChange={handleSteerSchemeChange}
        onExitToMenu={() => setState("menu")}
      />
    );
  }

  const showTouchLegend = touchControlMode === "on" || (touchControlMode === "auto" && isTouchDevice);

  return (
    <div className="game">
      {/* Main Menu Panel */}
      <section className="f1-menu-panel">
        <div className="menu-title-row">
          <div>
            <p className="eyebrow">FIA FORMULA MOTORSPORT SIMULATION</p>
            <h1>
              GRAND PRIX <span>CHAMPIONSHIP.</span>
            </h1>
          </div>
          {isTouchDevice && (
            <span className="orientation-chip">
              {isRotatedPortrait ? "AUTO-LANDSCAPE" : "LANDSCAPE READY"}
            </span>
          )}
        </div>

        <div className="menu-grid">
          <div className="menu-col">
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

            {/* Session Mode Selector */}
            <div className="form-group">
              <label>SESSION FORMAT</label>
              <div className="pills-group">
                <button
                  type="button"
                  className={`pill-btn ${sessionMode === "grandprix" ? "active" : ""}`}
                  onClick={() => setSessionMode("grandprix")}
                >
                  GRAND PRIX
                </button>
                <button
                  type="button"
                  className={`pill-btn ${sessionMode === "qualifying" ? "active" : ""}`}
                  onClick={() => setSessionMode("qualifying")}
                >
                  QUALIFYING
                </button>
                <button
                  type="button"
                  className={`pill-btn ${sessionMode === "practice" ? "active" : ""}`}
                  onClick={() => setSessionMode("practice")}
                >
                  PRACTICE
                </button>
              </div>
            </div>

            {/* Team Livery Selector */}
            <div className="form-group">
              <label htmlFor="livery-select">TEAM LIVERY</label>
              <select
                id="livery-select"
                className="f1-select"
                value={liveryIndex}
                onChange={(e) => setLiveryIndex(parseInt(e.target.value, 10))}
              >
                {LIVERIES.map((liv, idx) => (
                  <option key={idx} value={idx}>
                    {liv.name} ({liv.team})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="menu-col">
            {/* Steering Sensitivity Selector */}
            <div className="form-group">
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
              <div className="pills-group" style={{ marginTop: "6px" }}>
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
            </div>

            {/* Mobile & Tablet Touch Controls Settings */}
            <div className="form-group">
              <label>TOUCH CONTROLS</label>
              <div className="pills-group">
                <button
                  type="button"
                  className={`pill-btn ${touchControlMode === "auto" ? "active" : ""}`}
                  onClick={() => handleTouchModeChange("auto")}
                >
                  AUTO
                </button>
                <button
                  type="button"
                  className={`pill-btn ${touchControlMode === "on" ? "active" : ""}`}
                  onClick={() => handleTouchModeChange("on")}
                >
                  ON
                </button>
                <button
                  type="button"
                  className={`pill-btn ${touchControlMode === "off" ? "active" : ""}`}
                  onClick={() => handleTouchModeChange("off")}
                >
                  OFF
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>MOBILE STEER MODE</label>
              <div className="pills-group">
                <button
                  type="button"
                  className={`pill-btn ${steerScheme === "buttons" ? "active" : ""}`}
                  onClick={() => void handleSteerSchemeChange("buttons")}
                >
                  BUTTONS
                </button>
                <button
                  type="button"
                  className={`pill-btn ${steerScheme === "slider" ? "active" : ""}`}
                  onClick={() => void handleSteerSchemeChange("slider")}
                >
                  SLIDER
                </button>
                <button
                  type="button"
                  className={`pill-btn ${steerScheme === "tilt" ? "active" : ""}`}
                  onClick={() => void handleSteerSchemeChange("tilt")}
                >
                  TILT
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Circuit Stats & Launch */}
        <div className="menu-footer-bar">
          <div className="circuit-info-card">
            <span>TURNS: <b>{track.turns}</b></span>
            <span>LENGTH: <b>{track.length}</b></span>
            <span>LAPS: <b>{sessionMode === "qualifying" ? 1 : track.lapsDefault}</b></span>
          </div>

          <button type="button" className="f1-primary-btn" onClick={handleLaunchRace}>
            LAUNCH RACE <span>→</span>
          </button>
        </div>

        <p className="controls-legend">
          {showTouchLegend
            ? "LEFT: STEER (BUTTONS / SLIDER / TILT) · RIGHT: BRAKE, GAS & DRS"
            : "WASD / ARROWS: DRIVE · E / SPACE: DRS · C: CAMERA · M: SOUND"}
        </p>
      </section>
    </div>
  );
}

export default function RacingGame() {
  return (
    <LandscapeStage>
      <RacingGameShell />
    </LandscapeStage>
  );
}
