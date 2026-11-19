# Formula Racing 3D — Agent Guidelines & Repository Invariants

Welcome to the **Formula Racing 3D** repository. This document establishes guidelines, operational invariants, and architectural conventions for AI agents and automated contributors working on this codebase.

---

## 1. Project Overview & Tech Stack

This project is a browser-based 3D arcade racing simulator built with:
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **3D Graphics**: Three.js (`three`) and React Three Fiber (`@react-three/fiber`)
- **3D Helpers**: `@react-three/drei` (PerspectiveCamera, Sky, Environment)
- **Language**: TypeScript 5.7+
- **Styling**: Vanilla CSS (`app/globals.css`) for high-performance HUD overlays

---

## 2. Repository Layout

```text
formula-racing-nextjs/
├── app/
│   ├── globals.css          # Global styling, racing HUD, menus, and typography
│   ├── layout.tsx           # Root layout, viewport metadata, and fonts
│   └── page.tsx             # Main page entry mounting the RacingGame shell
├── components/
│   └── RacingGame.tsx       # Core R3F Canvas, Driver loop, TrackScene, Car, & HUD
├── data/
│   └── tracks.ts            # Track definitions, spline points, metadata
├── skills/
│   └── racing-sim-gameplay/ # Project skill definitions
│       └── SKILL.md         # Procedural guide for R3F racing sim development
├── .agents/
│   └── skills/              # Agent skill discovery directory
│       └── racing-sim-gameplay/
│           └── SKILL.md
├── ARCHITECTURE.md          # Detailed 3D graphics & simulation architecture
├── CONTRIBUTING.md          # Code standards & contribution workflows
├── ROADMAP.md               # Milestones from prototype to full game
├── README.md                # General user instructions & quick start
└── package.json             # Dependencies and scripts
```

---

## 3. Mandatory Operational Invariants

Whenever you read, edit, or generate code in this repository, you **must adhere to these invariants**:

### A. WebGL & Three.js Performance Invariants
1. **Zero Allocations Inside `useFrame`**:
   - Never instantiate objects (`new THREE.Vector3()`, `new THREE.Matrix4()`, `new THREE.Quaternion()`, object literals, or array spreads) inside `useFrame` callbacks.
   - High-frequency allocations cause aggressive garbage collection pauses (GC frame drops) at 60/120 FPS.
   - Allocate scratch vectors, rays, or quaternions once using `useRef` or static module-level variables, and mutate them in-place (`.set()`, `.copy()`, `.addScaledVector()`).

2. **Decouple Game Physics from React Render Cycles**:
   - Do not trigger full React re-renders on every animation frame for simulation state (such as car position, wheel spin, or camera vectors). Keep simulation state in mutable `useRef` handles.
   - Only push telemetry (speed, gear, lap time) to React state when required for HUD display, or throttle HUD updates to 10–20 Hz if performance bottlenecks arise.

3. **Geometry & Material Reuse**:
   - Compute and cache geometries (`BufferGeometry`, `TubeGeometry`) using `useMemo`. Never recreate track or barrier geometry across frame renders unless the underlying track definition changes.
   - Dispose of unmounted materials and geometries properly if dynamic track switching is implemented.

### B. Next.js & Client Boundary Invariants
1. **Explicit Client Directives**:
   - Any component that renders `<Canvas>`, accesses `window`, uses Three.js hooks (`useFrame`, `useThree`), or manages user input events must include `"use client";` at the very top of the file.
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
  - World distances are represented in meters (Three.js world units).
  - Telemetry speeds are simulated in meters/second and converted to km/h (`speed * 3.6`) for HUD presentation.

---

## 6. How Agents Should Implement New Features

When asked to extend this project, consult the following documentation:
- **Game Mechanics & Step-by-Step Runbooks**: Consult [SKILL.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/skills/racing-sim-gameplay/SKILL.md).
- **System Architecture & Spline Maths**: Consult [ARCHITECTURE.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/ARCHITECTURE.md).
- **Feature Roadmap**: Consult [ROADMAP.md](file:///c:/Users/layan/Downloads/formula-racing-nextjs-starter/formula-racing-nextjs/ROADMAP.md).
