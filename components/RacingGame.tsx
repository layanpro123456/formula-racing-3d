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

  if (state === "racing") {
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
