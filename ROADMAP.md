# Formula Racing 3D — Development Roadmap

This roadmap outlines the planned evolution of the Formula Racing 3D prototype from a tech demo into a full browser motorsport game.

---

## Phase 1: Prototype Foundation (Current)
- [x] Next.js 14 App Router + Three.js + React Three Fiber foundation
- [x] Spline-based track ribbon mesh extrusion from 2D points (`data/tracks.ts`)
- [x] Procedural placeholder Formula vehicle geometry
- [x] Basic arcade driving physics (acceleration, deceleration, steering clamp)
- [x] Responsive CSS HUD overlay (lap, speed, gear, timer)
- [x] Circuit selection menu (Monaco, Monza, Silverstone, Spa, Suzuka)
- [x] Smooth follow camera rig with exponential damping

---

## Phase 2: Core Gameplay & Timing Mechanics
- [ ] **Checkpoint Gates**: Add invisible bounding planes along the spline to prevent shortcutting.
- [ ] **Accurate Sector Splits**: Track Sector 1, 2, and 3 delta times against session bests.
- [ ] **Lap Time Recording & Leaderboards**: Store personal bests in `localStorage`.
- [ ] **Starting Grid & Lights**: 5-red-lights countdown sequence before releasing vehicle controls.
- [ ] **Track Barriers & Collisions**: Raycast / bounding-box collisions with outer armco barriers.

---

## Phase 3: Visual Polish & 3D Assets
- [ ] **GLTF / GLB Car Models**: Replace procedural geometry with optimized, Draco-compressed 3D models.
- [ ] **Custom Liveries**: Selectable racing liveries and color accents.
- [ ] **Tire Smoke & Skidmarks**: Dynamic particle effects during heavy braking or sliding.
- [ ] **Post-Processing**: Subtle bloom on brake lights, motion blur at top speeds (`@react-three/postprocessing`).
- [ ] **Track Environment**: Realistic kerbs, runoff gravel traps, sponsor banners, and grandstands.

---

## Phase 4: Audio & Immersion
- [ ] **Positional Web Audio Engine**: Multi-layer engine RPM sound pitch-shifted to throttle and gear.
- [ ] **Environmental Audio**: Wind rush at high speeds, tire screech on lockup, kerb rumbling.
- [ ] **Race Radio / Spotter**: Audio cues for best lap, final lap, and off-track warnings.

---

## Phase 5: Advanced Simulation & AI
- [ ] **Rigid Body Physics**: Integration of `@react-three/rapier` or `cannon-es` for authentic suspension and tire grip.
- [ ] **AI Competitors**: Spline-following opponent vehicles with basic avoidance and overtaking logic.
- [ ] **Weather & Day/Night Cycles**: Dynamic sky lighting and wet track surface reflections.
- [ ] **Multiplayer Time Trials**: Ghost car recording and asynchronous multiplayer comparison.
