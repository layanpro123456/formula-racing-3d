"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

interface LandscapeStageContextValue {
  isTouchDevice: boolean;
  isRotatedPortrait: boolean;
  isFullscreen: boolean;
  viewportWidth: number;
  viewportHeight: number;
  tryEnterLandscapeFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
}

const LandscapeStageContext = createContext<LandscapeStageContextValue>({
  isTouchDevice: false,
  isRotatedPortrait: false,
  isFullscreen: false,
  viewportWidth: 0,
  viewportHeight: 0,
  tryEnterLandscapeFullscreen: async () => {},
  toggleFullscreen: async () => {},
});

export function useLandscapeStage(): LandscapeStageContextValue {
  return useContext(LandscapeStageContext);
}

interface LandscapeStageProps {
  children: React.ReactNode;
}

export function LandscapeStage({ children }: LandscapeStageProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detectTouch = () => {
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints > 0 : false;
      setIsTouchDevice(coarse || touchPoints);
    };

    const updateViewport = () => {
      detectTouch();
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setViewportWidth(Math.round(w));
      setViewportHeight(Math.round(h));
    };

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      updateViewport();
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const isRotatedPortrait =
    isTouchDevice &&
    viewportWidth > 0 &&
    viewportWidth <= 1024 &&
    viewportHeight > viewportWidth;

  // Notify Babylon Engine and layout observers whenever CSS rotation or dimensions change
  useEffect(() => {
    if (typeof window === "undefined" || viewportWidth === 0) return;
    const raf = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isRotatedPortrait, viewportWidth, viewportHeight]);

  const tryEnterLandscapeFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (typeof docEl.requestFullscreen === "function") {
          await docEl.requestFullscreen();
        } else if (typeof docEl.webkitRequestFullscreen === "function") {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may be blocked by browser policy (e.g., iOS Safari)
    }

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === "function") {
        await orientation.lock("landscape");
      }
    } catch {
      // Orientation lock unsupported or requires fullscreen; CSS rotation handles fallback
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore
      }
    } else {
      await tryEnterLandscapeFullscreen();
    }
  }, [tryEnterLandscapeFullscreen]);

  const stageStyle: React.CSSProperties = isRotatedPortrait
    ? {
        position: "absolute",
        top: 0,
        left: `${viewportWidth}px`,
        width: `${viewportHeight}px`,
        height: `${viewportWidth}px`,
        transform: "rotate(90deg)",
        transformOrigin: "top left",
      }
    : {
        position: "relative",
        width: "100%",
        height: "100%",
      };

  return (
    <LandscapeStageContext.Provider
      value={{
        isTouchDevice,
        isRotatedPortrait,
        isFullscreen,
        viewportWidth,
        viewportHeight,
        tryEnterLandscapeFullscreen,
        toggleFullscreen,
      }}
    >
      <div
        className={`landscape-stage ${isRotatedPortrait ? "is-rotated" : ""}`}
        data-rotated={isRotatedPortrait ? "true" : "false"}
        data-touch={isTouchDevice ? "true" : "false"}
        style={stageStyle}
      >
        {children}
      </div>
    </LandscapeStageContext.Provider>
  );
}
