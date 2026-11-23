"use client";

import React, { useState } from "react";
import { TRACKS, Track } from "@/data/tracks";
import { LIVERIES } from "@/data/liveries";
import BabylonRacingGame from "@/components/babylon/BabylonRacingGame";

type GameState = "menu" | "racing";
type SessionMode = "grandprix" | "practice" | "qualifying";

export default function RacingGame() {
  const [state, setState] = useState<GameState>("menu");
  const [track, setTrack] = useState<Track>(TRACKS[3]); // Default: Circuit de Spa-Francorchamps
  const [sessionMode, setSessionMode] = useState<SessionMode>("grandprix");
  const [liveryIndex, setLiveryIndex] = useState(0);
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(1.0);

  // Load saved steering sensitivity from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("f1_steering_sensitivity");
      if (saved) {
        const val = parseFloat(saved);
        if (Number.isFinite(val) && val >= 0.5 && val <= 1.5) {
          setSteeringSensitivity(val);
        }
      }
    } catch {}
  }, []);

  const handleSensitivityChange = (newVal: number) => {
    setSteeringSensitivity(newVal);
    try {
      localStorage.setItem("f1_steering_sensitivity", newVal.toString());
    } catch {}
  };

  if (state === "racing") {
    return (
      <BabylonRacingGame
        track={track}
        sessionMode={sessionMode}
        liveryIndex={liveryIndex}
        initialSteeringSensitivity={steeringSensitivity}
        onExitToMenu={() => setState("menu")}
      />
    );
  }

  return (
    <div className="game" style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Main Menu Panel */}
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
          <div className="pills-group" style={{ marginTop: "8px" }}>
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

        {/* Circuit Stats */}
        <div className="circuit-info-card">
          <span>TURNS: <b>{track.turns}</b></span>
          <span>LENGTH: <b>{track.length}</b></span>
          <span>LAPS: <b>{sessionMode === "qualifying" ? 1 : track.lapsDefault}</b></span>
        </div>

        <button className="f1-primary-btn" onClick={() => setState("racing")}>
          LAUNCH RACE <span>→</span>
        </button>

        <p className="controls-legend">
          WASD / ARROWS: DRIVE · E / SPACE: DRS · C: CAMERA · M: SOUND
        </p>
      </section>
    </div>
  );
}
