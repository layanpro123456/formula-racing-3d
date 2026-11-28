"use client";

import React, { useMemo } from "react";
import { TelemetryData } from "@/lib/physics/VehiclePhysics";
import { AICarState } from "@/lib/ai/AIDriver";
import { Track } from "@/data/tracks";
import { Spline3D } from "@/lib/math/Spline3D";
import { CommentaryState } from "@/lib/commentary/RaceCommentary";
import { TrackNavigationMap } from "@/components/TrackNavigationMap";

export interface CollisionAlert {
  id: number;
  opponentName: string;
  opponentNumber: number;
  penaltyAdded: number;
  totalPenalty: number;
  warnings: number;
  warningIssued: boolean;
  playerAtFault: boolean;
  severity: number;
}

interface RacingHUDProps {
  telemetry: TelemetryData;
  playerLap: number;
  totalLaps: number;
  aiCars: AICarState[];
  track: Track;
  spline?: Spline3D;
  cameraMode: "chase" | "tcam" | "cockpit" | "nose";
  onToggleCamera: () => void;
  onPause: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  countdown: number | null; // 3, 2, 1, 0 (GO), or null
  commentaryState?: CommentaryState;
  isCommentaryMuted?: boolean;
  onToggleCommentary?: () => void;
  touchControlsActive?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  collisionAlert?: CollisionAlert | null;
  impactFlashSeq?: number;
}

export function RacingHUD({
  telemetry,
  playerLap,
  totalLaps,
  aiCars,
  track,
  spline,
  cameraMode,
  onToggleCamera,
  onPause,
  isAudioMuted,
  onToggleAudio,
  countdown,
  commentaryState,
  isCommentaryMuted,
  onToggleCommentary,
  touchControlsActive = false,
  isFullscreen = false,
  onToggleFullscreen,
  collisionAlert = null,
  impactFlashSeq = 0
}: RacingHUDProps) {
  const [visibleCommentary, setVisibleCommentary] = React.useState<CommentaryState["latestMessage"] | null>(null);
  const [showImpactFlash, setShowImpactFlash] = React.useState(false);
  const latestMsg = commentaryState?.latestMessage;

  React.useEffect(() => {
    if (!impactFlashSeq) return;
    setShowImpactFlash(true);
    const timer = setTimeout(() => setShowImpactFlash(false), 420);
    return () => clearTimeout(timer);
  }, [impactFlashSeq]);

  React.useEffect(() => {
    if (latestMsg) {
      setVisibleCommentary(latestMsg);
      const timer = setTimeout(() => {
        setVisibleCommentary(null);
      }, 4200);
      return () => clearTimeout(timer);
    }
  }, [latestMsg]);
  // Sort positions (P1, P2, P3...) based on actual track progress (lap + currentT)
  const leaderboard = useMemo(() => {
    const playerProgress = playerLap + (Number.isFinite(telemetry.currentT) ? telemetry.currentT : 0);

    const list = [
      {
        id: "player",
        name: "YOU",
        number: 1,
        lap: playerLap,
        progress: playerProgress,
        penaltySeconds: Number.isFinite(telemetry.penaltySeconds) ? telemetry.penaltySeconds : 0,
        isPlayer: true
      },
      ...aiCars.map((ai) => ({
        id: ai.id,
        name: ai.name,
        number: ai.number,
        lap: ai.lap,
        progress: ai.lap + ai.t,
        penaltySeconds: Number.isFinite(ai.penaltySeconds) ? ai.penaltySeconds : 0,
        isPlayer: false
      }))
    ];

    list.sort((a, b) => b.progress - a.progress);
    return list;
  }, [playerLap, telemetry.currentT, telemetry.penaltySeconds, aiCars]);

  const playerPos = leaderboard.findIndex((item) => item.isPlayer) + 1;
  const leaderProgress = leaderboard[0]?.progress ?? 0;

  // Defensively guarded display values
  const displaySpeed = Number.isFinite(telemetry.speedKmh) ? telemetry.speedKmh : 0;
  const displayRpm = Number.isFinite(telemetry.rpm) ? telemetry.rpm : 4000;
  const displayBrakeTemp = Number.isFinite(telemetry.brakeTemp) ? telemetry.brakeTemp : 100;
  const displayGear = telemetry.gear === -1 || telemetry.isReverse || telemetry.speedMs < -0.2
    ? "R"
    : (telemetry.gear || 1);
  const displayLatG = Number.isFinite(telemetry.gForceLat) ? telemetry.gForceLat : 0;
  const displayLongG = Number.isFinite(telemetry.gForceLong) ? telemetry.gForceLong : 0;

  // Format lap time MM:SS.mmm
  const formatTime = (seconds: number) => {
    const s = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toFixed(3);
    return `${mins.toString().padStart(2, "0")}:${secs.padStart(6, "0")}`;
  };

  // Shift light LEDs (15 LEDs: 5 green, 5 yellow, 5 red/purple)
  const rpmRatio = Number.isFinite(telemetry.rpmRatio) ? Math.max(0, Math.min(1, telemetry.rpmRatio)) : 0;
  const numActiveLEDs = Math.floor(rpmRatio * 15);

  return (
    <div className={`racing-hud-overlay ${touchControlsActive ? "has-touch-controls" : ""}`}>
      {/* Screen-Edge Red Collision Impact Pulse */}
      {showImpactFlash && <div className="collision-flash-overlay" />}

      {/* Race Control Collision & Penalty Incident Banner */}
      {collisionAlert && (
        <div
          className={`race-control-banner ${
            collisionAlert.penaltyAdded > 0
              ? "severity-penalty"
              : collisionAlert.warningIssued
                ? "severity-warning"
                : "severity-contact"
          }`}
        >
          <div className="rc-header">
            <span className="rc-badge">RACE CONTROL</span>
            <span className="rc-incident">
              COLLISION · #{collisionAlert.opponentNumber} {collisionAlert.opponentName.toUpperCase()}
            </span>
          </div>
          <div className="rc-verdict">
            {collisionAlert.penaltyAdded > 0
              ? `+${collisionAlert.penaltyAdded}s TIME PENALTY — CAUSING A COLLISION (TOTAL: +${collisionAlert.totalPenalty}s)`
              : collisionAlert.warningIssued
                ? `DRIVING STANDARDS WARNING (${collisionAlert.warnings}) — NEXT CONTACT +2s PENALTY`
                : collisionAlert.playerAtFault
                  ? "MINOR CONTACT — AVOIDABLE COLLISION RISK"
                  : "INCIDENT NOTED — NO FURTHER ACTION"}
          </div>
        </div>
      )}

      {/* 5-Red-Lights Countdown Sequence Overlay */}
      {countdown !== null && (
        <div className="countdown-backdrop">
          <div className="gantry-lights-box">
            <div className="gantry-header">FORMULA START PROCEDURE</div>
            <div className="gantry-lights">
              {[1, 2, 3, 4, 5].map((lightNum) => {
                const isActive = countdown > 0 && lightNum <= (4 - countdown);
                const isGreen = countdown === 0;
                return (
                  <div
                    key={lightNum}
                    className={`gantry-light ${isActive ? "active-red" : ""} ${isGreen ? "active-green" : ""}`}
                  />
                );
              })}
            </div>
            <div className="countdown-text">
              {countdown > 0 ? `START IN ${countdown}` : "LIGHTS OUT AND AWAY WE GO!"}
            </div>
          </div>
        </div>
      )}

      {/* Top Bar: Circuit Info & Race Status */}
      <header className="f1-topbar">
        <div className="f1-brand">
          <span className="f1-badge">F1</span>
          <div className="f1-track-label">
            <b>{track.name}</b> <span className="f1-track-loc">· {track.location}</span>
          </div>
          <span className="compact-pos-badge">P{playerPos}/{leaderboard.length}</span>
        </div>
        <div className="f1-status-flags">
          {telemetry.penaltySeconds > 0 && (
            <span className="flag penalty">PENALTY +{telemetry.penaltySeconds}S</span>
          )}
          {telemetry.drsLocked && <span className="flag drs-locked">DRS LOCKED</span>}
          {telemetry.isLockup && <span className="flag lockup">TYRE LOCKUP</span>}
          {telemetry.offTrack && <span className="flag off-track">OFF TRACK</span>}
          {telemetry.onKerb && <span className="flag kerb">KERB</span>}
          {telemetry.drsActive && <span className="flag drs-active">DRS OPEN</span>}
          {!telemetry.drsActive && telemetry.drsAvailable && (
            <span className="flag drs-ready">
              {touchControlsActive ? "DRS READY" : "DRS AVAILABLE (PRESS E / SPACE)"}
            </span>
          )}
        </div>
      </header>

      {/* Left Timing Tower (F1 Broadcast Style) */}
      <div className="timing-tower">
        <div className="tower-header">
          <span>POS</span>
          <span>DRIVER</span>
          <span>GAP</span>
        </div>
        {leaderboard.map((item, idx) => {
          const gapProgress = Math.max(0, leaderProgress - item.progress);
          const gapSecs = (gapProgress * 85.0).toFixed(3);
          return (
            <div
              key={item.id}
              className={`tower-row ${item.isPlayer ? "player-row" : ""}`}
            >
              <span className="pos">P{idx + 1}</span>
              <span className="driver-name">
                <span className="driver-num">#{item.number}</span> {item.name}
                {item.penaltySeconds > 0 && (
                  <span className="tower-penalty">+{item.penaltySeconds}s</span>
                )}
              </span>
              <span className="gap">
                {idx === 0 ? "LEADER" : `+${gapSecs}s`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Broadcast Team Radio / Commentary Banner */}
      {visibleCommentary && (
        <div className="commentary-banner">
          <div className="commentary-badge">
            <span className="dot" />
            <span>RADIO · {visibleCommentary.category}</span>
          </div>
          <div className="commentary-text">
            &ldquo;{visibleCommentary.text}&rdquo;
          </div>
        </div>
      )}

      {/* Center Dynamic Tachometer, RPM Bar, Speedometer & Gear */}
      <div className="tachometer-center">
        {/* Shift light LEDs */}
        <div className="shift-lights">
          {Array.from({ length: 15 }).map((_, i) => {
            const active = i < numActiveLEDs;
            let colorClass = "green";
            if (i >= 5 && i < 10) colorClass = "yellow";
            if (i >= 10) colorClass = "red";
            if (rpmRatio > 0.94) colorClass = "flash-blue";
            return (
              <div
                key={i}
                className={`led ${colorClass} ${active ? "on" : "off"}`}
              />
            );
          })}
        </div>

        <div className="speed-gear-cluster">
          <div className={`gear-display ${telemetry.isShifting ? "shifting" : ""}`}>
            <span className="label">GEAR</span>
            <span className="value">{displayGear}</span>
          </div>

          <div className="speed-display">
            <span className="value">{displaySpeed}</span>
            <span className="unit">KM/H</span>
          </div>

          <div className="drs-pod">
            <span className={`drs-indicator ${telemetry.drsActive ? "active" : telemetry.drsAvailable ? "available" : ""}`}>
              DRS
            </span>
            <span className={`rpm-text ${displayRpm > 11800 ? "rpm-redline" : ""}`}>
              {displayRpm} RPM
            </span>
          </div>
        </div>
      </div>

      {/* Right Telemetry & Track Navigation Block */}
      <div className="telemetry-right">
        {/* Top-Right Track Navigation Minimap */}
        <TrackNavigationMap
          track={track}
          spline={spline}
          playerT={telemetry.currentT}
          aiCars={aiCars}
          currentSector={telemetry.currentSector}
        />

        <div className="hud-card">
          <div className="card-row">
            <span className="lbl">LAP</span>
            <span className="val highlight">{playerLap} / {totalLaps}</span>
          </div>
          <div className="card-row">
            <span className="lbl">TIME</span>
            <span className="val mono">{formatTime(telemetry.lapTime)}</span>
          </div>
          <div className="card-row">
            <span className="lbl">SECTOR</span>
            <div className="sector-badges">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`s-badge ${telemetry.currentSector === s ? "active" : telemetry.currentSector > s ? "done" : ""}`}
                >
                  S{s}
                </span>
              ))}
            </div>
          </div>
          <div className="card-row">
            <span className="lbl">BRAKES</span>
            <span className={`val mono ${displayBrakeTemp > 700 ? "brake-hot" : displayBrakeTemp > 450 ? "brake-warm" : "brake-optimal"}`}>
              {displayBrakeTemp}°C
            </span>
          </div>
          <div className="card-row">
            <span className="lbl">PENALTY</span>
            <span className={`val mono ${telemetry.penaltySeconds > 0 ? "penalty-active" : telemetry.warnings > 0 ? "penalty-warn" : "penalty-clean"}`}>
              {telemetry.penaltySeconds > 0
                ? `+${telemetry.penaltySeconds.toFixed(1)}s`
                : telemetry.warnings > 0
                  ? `WARN ${telemetry.warnings}`
                  : "CLEAN"}
            </span>
          </div>
          <div className="card-row g-forces">
            <span>LAT: <b>{displayLatG}G</b></span>
            <span>LONG: <b>{displayLongG}G</b></span>
          </div>
        </div>

        {/* Action Buttons: Camera Switch, Engine Sound, Commentary, Fullscreen, Pause */}
        <div className="hud-actions">
          <button type="button" className="action-btn" onClick={onToggleCamera} title="Toggle Camera (C)">
            CAM: {cameraMode === "tcam" ? "T-CAM" : cameraMode.toUpperCase()}
          </button>
          <button type="button" className="action-btn" onClick={onToggleAudio} title="Mute/Unmute Engine Audio (M)">
            {isAudioMuted ? "ENG: OFF" : "ENG: ON"}
          </button>
          {onToggleCommentary && (
            <button
              type="button"
              className={`action-btn ${!isCommentaryMuted ? "comm-active" : ""}`}
              onClick={onToggleCommentary}
              title="Toggle English Race Commentary"
            >
              {isCommentaryMuted ? "COM: OFF" : "COM: ON"}
            </button>
          )}
          {onToggleFullscreen && touchControlsActive && (
            <button
              type="button"
              className="action-btn fs-btn"
              onClick={onToggleFullscreen}
              title="Toggle Fullscreen Landscape"
            >
              {isFullscreen ? "EXIT FS" : "FULL"}
            </button>
          )}
          <button type="button" className="action-btn pause-btn" onClick={onPause}>
            PAUSE
          </button>
        </div>
      </div>
    </div>
  );
}
