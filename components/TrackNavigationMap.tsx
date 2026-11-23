"use client";

import React, { useMemo } from "react";
import { Track } from "@/data/tracks";
import { Spline3D, build3DCurve } from "@/lib/math/Spline3D";
import { AICarState } from "@/lib/ai/AIDriver";
import { LIVERIES } from "@/data/liveries";

interface TrackNavigationMapProps {
  track: Track;
  spline?: Spline3D;
  playerT: number;
  aiCars: AICarState[];
  currentSector: 1 | 2 | 3;
}

export function TrackNavigationMap({
  track,
  spline: propSpline,
  playerT,
  aiCars,
  currentSector
}: TrackNavigationMapProps) {
  const spline = useMemo(() => {
    return propSpline || build3DCurve(track.points);
  }, [propSpline, track]);

  // Compute 2D projected map geometry from 3D spline
  const {
    basePathD,
    drsPaths,
    startFinishLine,
    sectorMarkers,
    project
  } = useMemo(() => {
    const steps = 140;
    const pts: { x: number; z: number; u: number }[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i <= steps; i++) {
      const u = (i % steps) / steps;
      const pt = spline.getPointAt(u);
      pts.push({ x: pt.x, z: pt.z, u });
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }

    const svgWidth = 220;
    const svgHeight = 145;
    const pad = 16;
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1;

    const scale = Math.min((svgWidth - pad * 2) / rangeX, (svgHeight - pad * 2) / rangeZ);
    const offsetX = (svgWidth - rangeX * scale) / 2 - minX * scale;
    const offsetZ = (svgHeight - rangeZ * scale) / 2 - minZ * scale;

    const project = (wx: number, wz: number) => ({
      x: wx * scale + offsetX,
      y: svgHeight - (wz * scale + offsetZ) // Invert Z so forward/north is UP
    });

    // Base circuit path
    const basePathD = pts.reduce((acc, p, idx) => {
      const proj = project(p.x, p.z);
      return idx === 0 ? `M ${proj.x.toFixed(1)} ${proj.y.toFixed(1)}` : `${acc} L ${proj.x.toFixed(1)} ${proj.y.toFixed(1)}`;
    }, "") + " Z";

    // DRS zone path overlays
    const drsPaths: string[] = [];
    if (Array.isArray(track.drsZones)) {
      for (const zone of track.drsZones) {
        const zonePts: { x: number; y: number }[] = [];
        const zoneSubSteps = 30;
        let u0 = zone.start;
        let u1 = zone.end;
        if (u0 > u1) {
          // Wrapped across start line (e.g. 0.94 to 0.06)
          for (let s = 0; s <= zoneSubSteps; s++) {
            const frac = s / zoneSubSteps;
            const span = (1.0 - u0) + u1;
            const u = (u0 + frac * span) % 1.0;
            const wpt = spline.getPointAt(u);
            zonePts.push(project(wpt.x, wpt.z));
          }
        } else {
          for (let s = 0; s <= zoneSubSteps; s++) {
            const frac = s / zoneSubSteps;
            const u = u0 + frac * (u1 - u0);
            const wpt = spline.getPointAt(u);
            zonePts.push(project(wpt.x, wpt.z));
          }
        }

        if (zonePts.length > 1) {
          const d = zonePts.reduce((acc, p, idx) => {
            return idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `${acc} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          }, "");
          drsPaths.push(d);
        }
      }
    }

    // Start / Finish Line perpendicular tick
    const sfPt = spline.getPointAt(0);
    const sfTan = spline.getTangentAt(0);
    const sfSideX = sfTan.z;
    const sfSideZ = -sfTan.x;
    const tickLen = 6.0;
    const sfP1 = project(sfPt.x + sfSideX * tickLen, sfPt.z + sfSideZ * tickLen);
    const sfP2 = project(sfPt.x - sfSideX * tickLen, sfPt.z - sfSideZ * tickLen);
    const startFinishLine = { x1: sfP1.x, y1: sfP1.y, x2: sfP2.x, y2: sfP2.y };

    // Sector split markers
    const s1EndU = track.sectors?.[0]?.tEnd ?? 0.33;
    const s2EndU = track.sectors?.[1]?.tEnd ?? 0.67;
    const s1Pt = project(spline.getPointAt(s1EndU).x, spline.getPointAt(s1EndU).z);
    const s2Pt = project(spline.getPointAt(s2EndU).x, spline.getPointAt(s2EndU).z);
    const sectorMarkers = [
      { label: "S1", ...s1Pt },
      { label: "S2", ...s2Pt }
    ];

    return { basePathD, drsPaths, startFinishLine, sectorMarkers, project };
  }, [spline, track]);

  // Project Player Position
  const safePlayerT = Number.isFinite(playerT) ? ((playerT % 1.0) + 1.0) % 1.0 : 0;
  const playerWorld = spline.getPointAt(safePlayerT);
  const playerPos = project(playerWorld.x, playerWorld.z);

  // Project AI Competitors Positions
  const aiPositions = useMemo(() => {
    return aiCars.map((ai) => {
      const safeT = Number.isFinite(ai.t) ? ((ai.t % 1.0) + 1.0) % 1.0 : 0;
      const world = spline.getPointAt(safeT);
      const pos = project(world.x, world.z);
      const livery = LIVERIES[ai.liveryIndex % LIVERIES.length];
      const color = livery?.primary || "#ef4444";
      return {
        id: ai.id,
        number: ai.number,
        name: ai.name,
        color,
        x: pos.x,
        y: pos.y
      };
    });
  }, [aiCars, spline, project]);

  return (
    <div className="track-minimap-card">
      <div className="minimap-header">
        <span className="minimap-title">TRACK NAVIGATION</span>
        <span className="minimap-track-name">{track.name}</span>
      </div>

      <div className="minimap-svg-container">
        <svg
          viewBox="0 0 220 145"
          className="minimap-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="minimap-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Circuit Road Bed (Wide dark backing) */}
          <path
            d={basePathD}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Circuit Racing Centerline */}
          <path
            d={basePathD}
            fill="none"
            stroke="#475569"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* DRS Zones (High-visibility neon green) */}
          {drsPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#10b981"
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#minimap-glow)"
            />
          ))}

          {/* Start / Finish Line */}
          <line
            x1={startFinishLine.x1}
            y1={startFinishLine.y1}
            x2={startFinishLine.x2}
            y2={startFinishLine.y2}
            stroke="#f8fafc"
            strokeWidth="3"
            strokeLinecap="square"
          />

          {/* Sector Splits */}
          {sectorMarkers.map((sm) => (
            <circle
              key={sm.label}
              cx={sm.x}
              cy={sm.y}
              r="2.5"
              fill="#38bdf8"
              opacity="0.8"
            />
          ))}

          {/* AI Competitor Dots */}
          {aiPositions.map((ai) => (
            <g key={ai.id} transform={`translate(${ai.x.toFixed(1)}, ${ai.y.toFixed(1)})`}>
              <circle
                r="3.8"
                fill={ai.color}
                stroke="#0f172a"
                strokeWidth="1.2"
              />
              <text
                x="0"
                y="-5"
                textAnchor="middle"
                fontSize="7"
                fontWeight="800"
                fill="#cbd5e1"
                fontFamily="Barlow Condensed, sans-serif"
              >
                #{ai.number}
              </text>
            </g>
          ))}

          {/* Player Live Marker (Yellow Beacon with Radar Pulsing Ring) */}
          <g transform={`translate(${playerPos.x.toFixed(1)}, ${playerPos.y.toFixed(1)})`}>
            {/* Pulsing beacon radar ring */}
            <circle
              r="7.5"
              fill="none"
              stroke="#facc15"
              strokeWidth="1.5"
              className="minimap-player-ring"
            />
            {/* Core player dot */}
            <circle
              r="4.5"
              fill="#facc15"
              stroke="#000000"
              strokeWidth="1.5"
              filter="url(#minimap-glow)"
            />
            {/* "YOU" Tag */}
            <rect
              x="-11"
              y="-15"
              width="22"
              height="8"
              rx="2"
              fill="#facc15"
            />
            <text
              x="0"
              y="-9"
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="900"
              fill="#000000"
              fontFamily="Barlow Condensed, sans-serif"
            >
              YOU
            </text>
          </g>
        </svg>
      </div>

      <div className="minimap-footer">
        <div className="minimap-legend">
          <span className="legend-item">
            <span className="legend-dot you" /> YOU
          </span>
          <span className="legend-item">
            <span className="legend-dot rival" /> RIVALS
          </span>
          <span className="legend-item">
            <span className="legend-dot drs" /> DRS
          </span>
        </div>
        <span className="minimap-sector-tag">SECTOR S{currentSector}</span>
      </div>
    </div>
  );
}
