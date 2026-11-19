# Formula Racing 3D — Agent Guidelines & Repository Invariants

Welcome to the **Formula Racing 3D** repository. This document establishes guidelines, operational invariants, and architectural conventions for AI agents and automated contributors working on this codebase.

---

## 1. Project Overview & Tech Stack

This project is a browser-based 3D motorsport racing simulator built with:
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **3D Graphics & Physics**: Babylon.js (`@babylonjs/core`, `@babylonjs/havok`, `@babylonjs/loaders`)
- **Language**: TypeScript 5.7+
- **Styling**: Vanilla CSS (`app/globals.css`) for high-performance HUD overlays

---

## 2. Repository Layout

```text
formula-racing-nextjs/
├── app/
│   ├── globals.css              # Global styling, racing HUD, menus, and typography
│   ├── layout.tsx               # Root layout, viewport metadata, and fonts
│   └── page.tsx                 # Main page entry mounting the RacingGame shell
├── components/
│   ├── RacingGame.tsx           # Paddock menu shell and Babylon game mounting
│   ├── RacingHUD.tsx            # Broadcast F1 telemetry HUD & shift lights
│   └── babylon/
│       ├── BabylonRacingGame.tsx    # Babylon.js engine, render loop, and camera
│       ├── BabylonTrackGenerator.ts # Procedural 3D banked ribbon, kerbs, barriers
│       └── BabylonVehicle.ts        # PBR car model with animated wheels and DRS
├── data/
│   ├── tracks.ts                # Track definitions, spline points, metadata
│   └── liveries.ts              # Team livery definitions
├── lib/
│   ├── ai/
│   │   └── AIDriver.ts          # AI grid simulator and spline pathfinding
│   ├── audio/
│   │   └── EngineSound.ts       # Synthesized Web Audio F1 engine audio
│   ├── babylon/
│   │   └── havokLoader.ts       # Havok WASM physics plugin loader
│   ├── math/
│   │   └── Spline3D.ts          # Arc-length parameterized Catmull-Rom spline
│   └── physics/
│       └── VehiclePhysics.ts    # 4-wheel load transfer, Pacejka slip, thermal model
├── ARCHITECTURE.md              # Detailed 3D graphics & simulation architecture
├── CONTRIBUTING.md              # Code standards & contribution workflows
├── ROADMAP.md                   # Milestones from prototype to full game
├── README.md                    # General user instructions & quick start
└── package.json                 # Dependencies and scripts
```

---

## 3. Mandatory Operational Invariants

Whenever you read, edit, or generate code in this repository, you **must adhere to these invariants**:

### A. WebGL & Babylon.js Performance Invariants
1. **Zero Allocations Inside Render Loops**:
   - Never instantiate objects (`new Vector3()`, `new Matrix()`, `new Quaternion()`, object literals, or array spreads) inside `runRenderLoop` or per-frame callbacks.
   - High-frequency allocations cause aggressive garbage collection pauses (GC frame drops) at 60/120 FPS.
   - Pre-allocate scratch vectors and reuse them in-place (`.copyFrom()`, `.addInPlace()`, `.subtractInPlace()`, `Vector3.LerpToRef()`).

2. **Decouple Game Physics from React Render Cycles**:
   - Do not trigger full React re-renders on every animation frame for simulation state (such as car position, wheel spin, or camera vectors). Keep simulation state in mutable `useRef` handles.
   - Only push telemetry (speed, gear, lap time) to React state when required for HUD display.

3. **Geometry & Material Reuse**:
   - Compute and cache geometries using standard Babylon mesh instances or ribbons. Never recreate track or barrier geometry across frame renders unless the underlying track definition changes.
   - Dispose of unmounted materials, textures, and meshes properly when switching tracks.

### B. Next.js & Client Boundary Invariants
1. **Explicit Client Directives**:
   - Any component that renders `<canvas>`, accesses `window`, uses Babylon.js APIs, or manages user input events must include `"use client";` at the very top of the file.
   - Keep page-level layouts (`app/layout.tsx`) as Server Components for optimal metadata rendering.

2. **Safe Browser APIs**:
   - Always guard browser APIs (`window`, `document`, WebGL context) inside `useEffect` or lifecycle hooks to prevent Next.js server-side rendering (SSR) hydration mismatch errors.

### C. Legal & Asset Licensing Invariants
1. **No Trademark Infringement**:
   - Do not introduce official Formula 1 (F1), FIA, or team logos, copyrighted liveries, or registered trademark names.
   - Track centerlines are hand-authored approximations for gameplay prototyping and must be documented as fan-made / non-survey approximations.
   - 3D models imported into the project must be original assets or under permissive open-source licenses (CC0, MIT, CC-BY with attribution).

---

## 4. Development Commands & Workflow

| Command | Purpose | Notes |
| :--- | :--- | :--- |
| `npm run dev` | Launch local development server | Serves at `http://localhost:3000` with Fast Refresh |
| `npm run build` | Next.js production build | Compiles TypeScript and builds optimized production bundles |
| `npm run start` | Run production server | Tests built application |
| `npm run lint` | Next.js ESLint verification | Ensures zero syntax or linting errors |

Before concluding code modifications, agents must verify that TypeScript types remain strictly typed and `npm run build` passes cleanly.

---

## 5. Coding Standards & Conventions

- **TypeScript**:
  - Maintain `strict: true` compatibility (`tsconfig.json`).
  - Do not use `any` unless interacting with untyped third-party WebGL extensions. Prefer explicit interfaces and types.
- **Imports**:
  - Use Next.js path alias `@/...` mapping to project root (e.g. `@/components/RacingGame`, `@/data/tracks`).
- **Mathematical Clamping**:
  - Always clamp physics velocities, delta time (`Math.min(delta, 0.05)`), and camera distances to prevent numerical explosions during frame spikes or browser tab backgrounding.
- **Sensible Units**:
  - World distances are represented in meters.
  - Telemetry speeds are simulated in meters/second and converted to km/h (`speed * 3.6`) for HUD presentation.

---

## 6. How Agents Should Implement New Features

When asked to extend this project, consult the following documentation:
- **System Architecture & Spline Maths**: Consult [ARCHITECTURE.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/ARCHITECTURE.md).
- **Feature Roadmap**: Consult [ROADMAP.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/ROADMAP.md).
