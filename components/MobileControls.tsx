"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { InputManager, TouchSteerScheme } from "@/lib/input/InputManager";
import { engineAudio } from "@/lib/audio/EngineSound";

interface MobileControlsProps {
  inputManager: InputManager;
  steerScheme: TouchSteerScheme;
  isRotatedPortrait: boolean;
  drsAvailable: boolean;
  drsActive: boolean;
  disabled?: boolean;
}

export function MobileControls({
  inputManager,
  steerScheme,
  isRotatedPortrait,
  drsAvailable,
  drsActive,
  disabled = false,
}: MobileControlsProps) {
  const [leftPressed, setLeftPressed] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);
  const [brakePressed, setBrakePressed] = useState(false);
  const [gasPressed, setGasPressed] = useState(false);
  const [drsLatched, setDrsLatched] = useState(false);
  const [sliderActive, setSliderActive] = useState(false);

  const leftPointersRef = useRef<Set<number>>(new Set());
  const rightPointersRef = useRef<Set<number>>(new Set());
  const brakePointersRef = useRef<Set<number>>(new Set());
  const gasPointersRef = useRef<Set<number>>(new Set());
  const sliderPointerRef = useRef<number | null>(null);
  const sliderThumbRef = useRef<HTMLDivElement>(null);
  const tiltNeedleRef = useRef<HTMLDivElement>(null);
  const audioUnlockedRef = useRef(false);

  const unlockAudio = useCallback(() => {
    if (!audioUnlockedRef.current) {
      audioUnlockedRef.current = true;
      engineAudio.resume();
    }
  }, []);

  const clearAllInputs = useCallback(() => {
    leftPointersRef.current.clear();
    rightPointersRef.current.clear();
    brakePointersRef.current.clear();
    gasPointersRef.current.clear();
    sliderPointerRef.current = null;
    setLeftPressed(false);
    setRightPressed(false);
    setBrakePressed(false);
    setGasPressed(false);
    setDrsLatched(false);
    setSliderActive(false);
    if (sliderThumbRef.current) {
      sliderThumbRef.current.style.transform = "translate(-50%, -50%)";
    }
    inputManager.setTouchSteer(0);
    inputManager.setTouchThrottle(0);
    inputManager.setTouchBrake(0);
    inputManager.setTouchDRS(false);
  }, [inputManager]);

  useEffect(() => {
    if (disabled) {
      clearAllInputs();
    }
  }, [disabled, clearAllInputs]);

  useEffect(() => {
    clearAllInputs();
  }, [steerScheme, clearAllInputs]);

  // Auto-release latched DRS when braking or leaving DRS zone
  useEffect(() => {
    if (drsLatched && (!drsAvailable || brakePressed)) {
      setDrsLatched(false);
      inputManager.setTouchDRS(false);
    }
  }, [drsAvailable, brakePressed, drsLatched, inputManager]);

  // Animate tilt needle without triggering React re-renders
  useEffect(() => {
    if (steerScheme !== "tilt" || disabled) return;
    let rafId = 0;
    const updateNeedle = () => {
      if (tiltNeedleRef.current) {
        const clamped = Math.max(-1, Math.min(1, inputManager.gyroSteer));
        tiltNeedleRef.current.style.transform = `translate(${clamped * 56}px, -50%)`;
      }
      rafId = window.requestAnimationFrame(updateNeedle);
    };
    rafId = window.requestAnimationFrame(updateNeedle);
    return () => window.cancelAnimationFrame(rafId);
  }, [steerScheme, disabled, inputManager]);

  const syncButtonSteer = useCallback(() => {
    const l = leftPointersRef.current.size > 0;
    const r = rightPointersRef.current.size > 0;
    setLeftPressed(l);
    setRightPressed(r);
    inputManager.setTouchSteer((r ? 1 : 0) - (l ? 1 : 0));
  }, [inputManager]);

  const handleLeftDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    leftPointersRef.current.add(e.pointerId);
    syncButtonSteer();
  };

  const handleLeftUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    leftPointersRef.current.delete(e.pointerId);
    syncButtonSteer();
  };

  const handleRightDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    rightPointersRef.current.add(e.pointerId);
    syncButtonSteer();
  };

  const handleRightUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    rightPointersRef.current.delete(e.pointerId);
    syncButtonSteer();
  };

  const updateSliderFromPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // When CSS-rotated 90deg clockwise, local X runs along screen +Y
      const span = isRotatedPortrait ? rect.height : rect.width;
      const pos = isRotatedPortrait ? e.clientY - rect.top : e.clientX - rect.left;
      if (span <= 0) return;
      const ratio = Math.max(0, Math.min(1, pos / span));
      const steer = Math.max(-1, Math.min(1, (ratio - 0.5) * 2));
      inputManager.setTouchSteer(steer);
      if (sliderThumbRef.current) {
        const pxOffset = steer * (170 / 2 - 22);
        sliderThumbRef.current.style.transform = `translate(calc(-50% + ${pxOffset.toFixed(1)}px), -50%)`;
      }
    },
    [inputManager, isRotatedPortrait]
  );

  const handleSliderDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    sliderPointerRef.current = e.pointerId;
    setSliderActive(true);
    updateSliderFromPointer(e);
  };

  const handleSliderMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || sliderPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updateSliderFromPointer(e);
  };

  const handleSliderUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sliderPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    sliderPointerRef.current = null;
    setSliderActive(false);
    inputManager.setTouchSteer(0);
    if (sliderThumbRef.current) {
      sliderThumbRef.current.style.transform = "translate(-50%, -50%)";
    }
  };

  const handleBrakeDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    brakePointersRef.current.add(e.pointerId);
    setBrakePressed(true);
    inputManager.setTouchBrake(1);
  };

  const handleBrakeUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    brakePointersRef.current.delete(e.pointerId);
    const active = brakePointersRef.current.size > 0;
    setBrakePressed(active);
    inputManager.setTouchBrake(active ? 1 : 0);
  };

  const handleGasDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    gasPointersRef.current.add(e.pointerId);
    setGasPressed(true);
    inputManager.setTouchThrottle(1);
  };

  const handleGasUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    gasPointersRef.current.delete(e.pointerId);
    const active = gasPointersRef.current.size > 0;
    setGasPressed(active);
    inputManager.setTouchThrottle(active ? 1 : 0);
  };

  const handleDrsTap = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    unlockAudio();
    const next = !drsLatched;
    setDrsLatched(next);
    inputManager.setTouchDRS(next);
  };

  if (disabled) return null;

  return (
    <div className="mobile-controls-layer" aria-label="Touch driving controls">
      {/* Left Zone: Steering Controls */}
      <div className="touch-zone touch-zone-left">
        {steerScheme === "buttons" && (
          <div className="steer-buttons-cluster">
            <button
              type="button"
              className={`touch-btn steer-btn ${leftPressed ? "active" : ""}`}
              aria-label="Steer Left"
              onPointerDown={handleLeftDown}
              onPointerUp={handleLeftUp}
              onPointerCancel={handleLeftUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg className="touch-btn-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 5.5 9 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="touch-btn-lbl">LEFT</span>
            </button>
            <button
              type="button"
              className={`touch-btn steer-btn ${rightPressed ? "active" : ""}`}
              aria-label="Steer Right"
              onPointerDown={handleRightDown}
              onPointerUp={handleRightUp}
              onPointerCancel={handleRightUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg className="touch-btn-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.5 15 12l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="touch-btn-lbl">RIGHT</span>
            </button>
          </div>
        )}

        {steerScheme === "slider" && (
          <div
            className={`steer-slider-track ${sliderActive ? "active" : ""}`}
            role="slider"
            aria-label="Analog Steering Slider"
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-valuenow={Math.round(inputManager.touchSteer * 100)}
            onPointerDown={handleSliderDown}
            onPointerMove={handleSliderMove}
            onPointerUp={handleSliderUp}
            onPointerCancel={handleSliderUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="steer-slider-center-mark" />
            <span className="steer-slider-hint left">◀</span>
            <span className="steer-slider-hint right">▶</span>
            <div ref={sliderThumbRef} className="steer-slider-thumb" />
          </div>
        )}

        {steerScheme === "tilt" && (
          <div className="tilt-steer-panel">
            <div className="tilt-meter-track">
              <div className="tilt-meter-center" />
              <div ref={tiltNeedleRef} className="tilt-meter-needle" />
            </div>
            <button
              type="button"
              className="tilt-recenter-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                unlockAudio();
                inputManager.recenterGyro();
              }}
            >
              RE-CENTER TILT
            </button>
          </div>
        )}
      </div>

      {/* Right Zone: DRS + Pedals */}
      <div className="touch-zone touch-zone-right">
        <button
          type="button"
          className={`touch-btn drs-touch-btn ${drsActive || drsLatched ? "active" : drsAvailable ? "available" : ""}`}
          aria-label="Toggle DRS"
          onPointerDown={handleDrsTap}
          onContextMenu={(e) => e.preventDefault()}
        >
          DRS
        </button>

        <div className="pedals-cluster">
          <button
            type="button"
            className={`touch-btn pedal-btn brake-pedal ${brakePressed ? "active" : ""}`}
            aria-label="Brake or Reverse"
            onPointerDown={handleBrakeDown}
            onPointerUp={handleBrakeUp}
            onPointerCancel={handleBrakeUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg className="touch-btn-svg" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="7" width="12" height="10" rx="2" fill="currentColor" />
            </svg>
            <span className="touch-btn-lbl">BRAKE</span>
          </button>
          <button
            type="button"
            className={`touch-btn pedal-btn gas-pedal ${gasPressed ? "active" : ""}`}
            aria-label="Accelerate"
            onPointerDown={handleGasDown}
            onPointerUp={handleGasUp}
            onPointerCancel={handleGasUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg className="touch-btn-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5.5 15 12 8.5 18.5 15" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="touch-btn-lbl">GAS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
