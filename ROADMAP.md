# Formula Racing 3D — Development Roadmap

This roadmap outlines the planned evolution of the Formula Racing 3D simulator into a full browser motorsport game.

---

## Phase 1: Prototype Foundation (Completed)
- [x] Next.js 14 App Router + Babylon.js engine foundation
- [x] Spline-based track ribbon mesh extrusion from 3D points (`data/tracks.ts`)
- [x] Procedural Formula vehicle geometry with steerable wheels and active DRS flap
- [x] Deterministic driving physics (acceleration, deceleration, aero downforce, tire slip)
- [x] Responsive CSS HUD overlay (timing tower, shift lights, speed, gear, timer, G-forces)
- [x] Circuit selection menu (Bahrain, Monaco, Silverstone, Spa, Monza, Suzuka)
- [x] Multi-camera perspective switching (Chase, Cockpit, Nose)

---

## Phase 2: Core Gameplay & Timing Mechanics (Completed)
- [x] Accurate Sector Splits: Sector 1, 2, and 3 tracking
- [x] Starting Grid & Lights: 5-red-lights countdown sequence before releasing vehicle controls
- [x] Track Barriers & Collisions: Elastic-plastic collision response with Armco barriers
- [x] 5 Selectable Team Liveries (Scuderia, Silver Arrow, Papaya, Bull Speed, Verdant)
- [x] Procedural Web Audio Engine: V6 turbo-hybrid synthesizer with gear pops and tire squeal

---

## Phase 3: Physics & AI Advancement (Completed)
- [x] Babylon.js Havok Physics WASM integration
- [x] 4-wheel dynamic load transfer and Pacejka lateral slip model
- [x] Brake disc thermal dissipation model with glowing carbon ceramic effects
- [x] Autonomous AI Grid Competitors with curvature profiling and collision avoidance

---

## Phase 4: Future Enhancements (Planned)
- [ ] GLTF / GLB Car Models: Import high-poly Draco-compressed Formula models
- [ ] Tire Smoke & Skidmarks: Particle effects during heavy braking or sliding
- [ ] Dynamic Weather & Day/Night Cycles: Wet track surface reflections and rain spray
- [ ] Multiplayer Time Trials: Ghost car recording and asynchronous multiplayer comparison
