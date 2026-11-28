<p align="center">
  <img src="public/logo.svg" alt="Formula Racing 3D Logo" width="100%" style="max-width: 880px; border-radius: 12px;"/>
</p>

<p align="center">
  <a href="https://layanpro123456.github.io/formula-racing-3d/"><img src="https://img.shields.io/badge/▶_PLAY_LIVE_SIMULATOR-layanpro123456.github.io%2Fformula--racing--3d-E10600?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Play Live Demo"/></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" alt="Next.js 14"/></a>
  <a href="https://www.babylonjs.com"><img src="https://img.shields.io/badge/Babylon.js-9.0-BB464B?style=for-the-badge&logo=babylon.js" alt="Babylon.js"/></a>
  <a href="https://www.havok.com"><img src="https://img.shields.io/badge/Havok-Physics_WASM-007ACC?style=for-the-badge" alt="Havok Physics WASM"/></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API"><img src="https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl" alt="WebGL 2.0"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License"/></a>
</p>

<p align="center">
  <strong>High-Performance Browser-Based 3D Open-Wheel Motorsport Simulator</strong><br>
  Engineered with Next.js 14, Babylon.js 9, Havok Physics WebAssembly, and Procedural Web Audio.<br><br>
  🏁 <strong><a href="https://layanpro123456.github.io/formula-racing-3d/">Play Instant In-Browser Demo (No Download Required) &rarr;</a></strong>
</p>

---

## 🌐 Live Interactive Demo

Experience the full 3D simulation running live at 60/120 FPS directly in your browser:

👉 **[https://layanpro123456.github.io/formula-racing-3d/](https://layanpro123456.github.io/formula-racing-3d/)**

- **Zero Install / Instant Play**: Compiled to a static client-side bundle and hosted globally on GitHub Pages.
- **Hardware-Accelerated Physics**: Powered by Havok Physics compiled to WebAssembly (WASM).
- **Plug & Play Controllers**: Native support for Xbox and PlayStation gamepads with dual-motor haptic rumble, plus zero-latency keyboard controls.
- **6 Championship Circuits**: Ardennes Forest, Riviera Street Circuit, Grand Prix Park, Royal Autodrome, Alpine Ring, and Coastal GP Raceway.

---

## 🏎️ Overview

**Formula Racing 3D** is a production-grade, web-based 3D motorsport racing simulator running at 60/120 FPS directly in the browser. Powered by **Babylon.js** and **Havok Physics WASM**, the game features procedural 3D banked circuits with true elevation changes, deterministic vehicle dynamics with Pacejka tire slip, elastic barrier deflections, autonomous AI competitors, real-time voice race commentary, live vector GPS track navigation, and user-configurable steering sensitivity.

---

## 📸 Visual Showcase

### 1-Minute Monaco Grand Prix Gameplay Video
*60-second in-engine gameplay capture at **Circuit de Monaco** (`1280×720`, 25 FPS) showcasing the 5-red-light Grand Prix start, wheel-to-wheel AI racing up Beau Rivage, camera cycling across Chase / T-Cam / Cockpit / Nose Cam past Monte Carlo's copper-domed Casino Square, and a 294 km/h 7th-gear sprint through the Louis II Tunnel with titanium skid sparks.*

- **1-Min Monaco Gameplay Demo (MP4)**: [public/videos/formula_racing_3d_demo.mp4](public/videos/formula_racing_3d_demo.mp4)
- **1-Min Monaco Raw Capture (VP9 WebM)**: [public/videos/raw_gameplay.webm](public/videos/raw_gameplay.webm)

---

### Official Simulator Promotional Poster (16:9 Landscape)
*1920×1080 landscape showcase pairing the twilight open-wheel scene with the Ardennes Forest Catmull-Rom spline (`Spline3D.ts`), 2D OBB SAT collision solver, and high-visibility simulator feature breakdown.*

<p align="center">
  <img src="public/screenshots/promotional_poster.jpg" alt="Formula Racing 3D Promotional Poster Landscape" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Official LinkedIn & Portrait Showcase Poster (4:5 Portrait)
*High-DPI `2400×3000` PNG ([1200×1500 JPEG edition](public/screenshots/promotional_poster_portrait.jpg)) built for LinkedIn feeds and mobile showcases, featuring clear feed-scale feature callouts (`0 B/frame` render loop, Pacejka slip, 6 banked circuits, 5 AI rivals, IBL + CSM 2048, and Web APIs audio/haptics).*

<p align="center">
  <img src="public/screenshots/linkedin_poster.png" alt="Formula Racing 3D LinkedIn & Portrait Poster" width="70%" style="max-width: 650px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Social & OpenGraph Preview Banner (1200×675)
*Clean 16:9 OpenGraph and Twitter/LinkedIn link-preview card ([`public/social_preview.jpg`](public/social_preview.jpg)) highlighting core telemetry specs at thumbnail scale.*

<p align="center">
  <img src="public/screenshots/social_preview.jpg" alt="Formula Racing 3D Social & OpenGraph Preview Banner" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### In-Race Action (Monaco GP — Low Chase Camera)
*Wheel-to-wheel Grand Prix battle on the streets of Monte Carlo at 183 km/h in 4th gear, featuring sculpted ground-effect bodywork, W-beam Armco barriers, alpha-tested catch fencing, glowing FIA rain lights, 15-LED shift tachometer, live timing tower, and vector minimap.*

<p align="center">
  <img src="public/screenshots/gameplay_chase.png" alt="Monaco GP Wheel-to-Wheel Chase Camera" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Monaco Louis II Tunnel (294 km/h High-Speed Run)
*Blasting through Monaco's curved concrete tunnel under warm ceiling sodium lights at 294 km/h in 7th gear with floor titanium skid sparks flying toward the bright Port Hercule daylight exit.*

<p align="center">
  <img src="public/screenshots/monaco_tunnel.png" alt="Monaco Louis II Tunnel High Speed" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Wet Track & Screen-Space Reflections (Spa-Francorchamps — Ultra SSR)
*Real-time Screen-Space Reflections (`SSRRenderingPipeline`), TAA, puddle clearcoat modulation, Spa yellow-and-red Wallonia kerbs, and rubbered racing grooves on wet tarmac.*

<p align="center">
  <img src="public/screenshots/wet_ssr_spa.png" alt="Wet Track SSR Reflections on Spa" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Autodromo Nazionale Monza (Royal Blue Runoffs & Podium Overhang)
*Monza's Rettifilo start/finish straight featuring Royal Blue tarmac runoffs, red-and-white kerbs, cantilevered Podium Overhang, and Italian umbrella pines.*

<p align="center">
  <img src="public/screenshots/monza_showcase.png" alt="Monza Royal Blue Runoffs and Podium" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Silverstone Circuit (Golden Hour)
*Northamptonshire Golden Hour sunlight across Silverstone's Hamilton Straight with physical Rayleigh/Mie sky dome, grass runoffs, and sculpted aero bodywork.*

<p align="center">
  <img src="public/screenshots/silverstone_showcase.png" alt="Silverstone Circuit Golden Hour" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Night Floodlit Grand Prix (Suzuka)
*Night circuit lighting at Suzuka with instanced trackside floodlight towers, spoked Ouka Ferris wheel silhouette, Japanese cedar & sakura trees, and glowing FIA rear rain light.*

<p align="center">
  <img src="public/screenshots/night_suzuka.png" alt="Night Floodlit Suzuka Grand Prix" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Broadcast T-Cam (Monaco Roll-Hoop Onboard)
*Signature Formula broadcast T-Cam mounted atop the airbox roll-hoop climbing Beau Rivage, framing the sculpted nosecone, 8 carbon suspension wishbones, multi-element front wing, and compound sidewall tires.*

<p align="center">
  <img src="public/screenshots/tcam_view.png" alt="Broadcast T-Cam Onboard View" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Paddock Garage & Circuit Selection Menu
*Interactive paddock setup interface for selecting circuits, session formats (Grand Prix, Qualifying, Practice), team liveries, **Weather & Lighting** presets, **Graphics Quality** tiers (`LOW`–`ULTRA`), and calibrating **Steering Sensitivity** ($50\% - 150\%$).*

<p align="center">
  <img src="public/screenshots/menu.png" alt="Paddock Circuit & Setup Menu" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### In-Game Pause, Graphics & Sensitivity Calibration Screen
*Seamless mid-race pause overlay accessible via `ESC` / `P` to adjust steering sensitivity, touch controls, graphics quality tier, and weather lighting presets.*

<p align="center">
  <img src="public/screenshots/pause_menu.png" alt="In-Game Pause Menu" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Cockpit & Halo Perspective (Monaco Casino Square)
*Driver-eye point of view braking past Monte Carlo's copper-domed Casino Square, looking out over the sculpted monocoque, carbon suspension arms, and compound-striped front tires.*

<p align="center">
  <img src="public/screenshots/cockpit_view.png" alt="Cockpit & Halo View at Monaco Casino Square" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

### Track-Level Nose Cam (Monaco)
*Ultra-low bumper camera angle delivering a high-speed rush along Monaco's tight street barriers and catch fencing.*

<p align="center">
  <img src="public/screenshots/nose_cam.png" alt="Nose Camera View at Monaco" width="100%" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);"/>
</p>

---

## ⚡ Game Features

### 🏎️ Advanced Vehicle Dynamics & Elastic Barrier Physics
- **Dynamic Bicycle Model with Pacejka Slip**: Decoupled forward ($u$) and lateral ($v$) chassis velocities. Tires transition into a controllable lateral slide when cornering forces exceed downforce grip thresholds ($F_{\text{lat}} > \mu \cdot N$).
- **Zero "Magnetic Barrier Trap"**: Non-radial elastic collision resolution ($\epsilon = 0.35$) with penetration pushback that naturally deflects the vehicle nose away from perimeter Armco barriers back toward the racing line.
- **Low-Speed 3-Point Maneuvers**: Full steering authority and reverse gear rotation allow drivers to escape tight runoffs and perform stationary spin-turns.
- **Aerodynamic Ground Effects & DRS**: Dynamic downforce scales with the square of forward velocity ($F_{\text{down}} \propto v^2$), while the Drag Reduction System (DRS) trims rear wing drag along straightaway zones.

---

### 🗺️ Live Vector Track Navigation Map (Minimap)
- **Mathematical Spline Projection**: Real-time 2D vector minimap anchored in the top-right HUD, projecting the Catmull-Rom circuit spline with outer asphalt margins and racing centerline.
- **Live Competitor Tracking**:
  - **Player Beacon**: Pulsing golden indicator with an expanding radar pulse ring (`YOU`).
  - **AI Grid Rivals**: Color-coded circular markers rendered in their authentic team livery palettes.
- **Circuit Intelligence**: Visualizes sector split markers (`S1`, `S2`, `S3`), start/finish line tick, and active DRS zones highlighted in glowing neon green.

---

### 🎮 Zero-Latency Controller & Steering Sensitivity
- **Custom Sensitivity Curve ($50\% - 150\%$)**: Configurable in $5\%$ increments with instant visual feedback badges (`SMOOTH`, `BALANCED`, `SHARP`) and quick preset pills:
  - `SMOOTH (70%)`: High-speed stability and gentle cornering transitions.
  - `STANDARD (100%)`: Balanced factory simulation baseline.
  - `SHARP (130%)`: Rapid corner turn-in for high-precision apex clipping.
- **Dual UI Control Points**: Calibrate steering in both the Paddock Garage Menu and live in-race via the Pause Menu (`ESC` / `P`).
- **Input Responsiveness**: Keyboard steering features instant attack ($24\text{ rad/s}$) and fast spring return-to-center ($36\text{ rad/s}$). Gamepad analog sticks utilize direct cubic response mapping.
- **Dual-Motor Gamepad Haptics**: Implements Web Gamepad Vibration Actuator API for tactile feedback during barrier impacts, kerb rumble, and brake lockups.
- **Settings Persistence**: Saves automatically to browser `localStorage` (`f1_steering_sensitivity`).

---

### 🎙️ Real-Time Voice Race Commentary
- **In-Browser Speech Synthesis**: Real-time contextual race engineer audio powered by the client-side Web Speech API with zero external dependencies.
- **Smart Event Triggering**: Voice callouts for 5-light start sequences, position gains/overtakes, lap transitions, personal best sectors, DRS zone activation, off-track limits warnings, and checkered flag finishes.
- **Bottom-Left Broadcast Banner**: Floating HUD notification banner with auto-dismiss timers and team radio styling positioned safely outside the driver's forward sightlines.

---

### 🏁 6 Procedural 3D Banked Circuits & Trackside Props
Six accurately modeled championship circuits with true 3D elevation gradients and cambered banking:
1. **Ardennes Forest Circuit** (7,004m) — Sweeping elevation ascents through high-speed uphill sweeps.
2. **Riviera Street Circuit** (3,337m) — Narrow seaside barrier-lined street circuit with technical chicanes.
3. **Grand Prix Park** (5,891m) — High-downforce modern layout with flowing high-G esses.
4. **Royal Autodrome** (5,793m) — Classic temple of speed with heavy braking zones and slipstream straights.
5. **Alpine Ring** (5,807m) — Figure-eight technical layout with dramatic elevation crests and dips.
6. **Coastal GP Raceway** (4,309m) — Undulating oceanfront circuit with downhill apex entries.

**Track Infrastructure**:
- **3D Apex Kerbs**: Chamfered red-and-white rumble kerbs with tactile chassis elevation kick.
- **Trackside Brake Markers**: Prominent **150m**, **100m**, and **50m** distance countdown boards approaching heavy braking zones.
- **Safety Barriers & Catch Fencing**: Continuous Armco steel barriers lined with protective wire catch-fencing.
- **Start/Finish Gantry Bridge**: Structural overhead gantry housing the 5-red-light starting array.

---

### 🤖 Autonomous Multi-Car AI Grid & Physical Car-to-Car Collisions
- **Intelligent Grid Racing**: Race against 5 autonomous AI drivers, each representing distinct constructor teams and driver profiles.
- **Curvature Speed Profiling & Proactive Avoidance**: AI drivers evaluate upcoming track curvature in real time and apply wrap-around longitudinal TTC braking down to a standstill when blocked, plus dynamic left/right overtaking lane selection and side-by-side racing etiquette.
- **2D OBB SAT Car-to-Car Physics**: Player–AI and AI–AI overlaps are resolved every frame via a zero-allocation Oriented Bounding Box Separating Axis Theorem solver with elevation gating for crossover bridges, elastic-plastic momentum transfer, and barrier re-clamping.
- **FIA-Style Race Control & Incident Feedback**: Contact triggers 3D titanium sparks, camera jolt, synthesized impact audio, gamepad haptics, screen-edge red impact pulses, temporary DRS lockouts, Race Control incident banners, and time penalties reflected across the HUD, timing tower, and final race classification.

---

### 📱 Mobile Auto-Landscape & Multi-Touch / Tilt Controls
- **Automatic 90° Landscape Stage**: Portrait phones and tablets automatically rotate `90°` into a full horizontal racing stage (`LandscapeStage`) with synchronized Babylon.js canvas resizing and rotated pointer mapping—even on iOS Safari or OS portrait-locked devices.
- **Three Switchable Touch Schemes**:
  - **Touch Pads (`BUTTONS`)**: Multi-touch Left/Right steering buttons with SVG directional icons alongside Brake, Gas, and smart-latching DRS controls.
  - **Analog Slider (`SLIDER`)**: Continuous horizontal touch steering slider with live thumb feedback.
  - **Gyroscope Tilt (`TILT`)**: `DeviceOrientationEvent` tilt steering with live needle indicator and one-tap recentering.
- **Adaptive Mobile GPU Tier**: Touch devices and compact viewports (`<= 900px` short edge) automatically scale down to `1024px` single shadow maps and `1x` pipeline sampling (disabling SSAO2, 3-tier CSM, and motion blur) to maintain smooth framerates.

---

### ⚙️ 8-Speed Sequential Transmission & Procedural Web Audio
- **Automatic Sequential Gearbox**: Shift points calculated from dynamic torque curves, featuring kickdown downshifts and shift hesitation timers to prevent erratic gear hunting.
- **100% Procedural Web Audio Engine**: Multi-oscillator synthesis generating authentic V6 turbo-hybrid engine whine, turbo spool, gear change ignition cuts, and slip-dependent tire squeal without external audio files.

---

### 🌟 Broadcast-Grade Graphics Pipeline, Weather & Shaders
- **Physical Sky Dome & 5 Weather Presets**: Custom GLSL Rayleigh/Mie atmospheric scattering dome paired with selectable **Clear Daylight**, **Golden Hour**, **Overcast**, **Wet Track (SSR)**, and **Night Floodlit** presets.
- **Screen-Space Reflections (SSR) & Temporal AA (TAA)**: `SSRRenderingPipeline` and `TAARenderingPipeline` on `ULTRA` / wet desktop tiers for crisp reflections across wet tarmac puddles and automotive clearcoats.
- **Image-Based Lighting (IBL) & Cascaded Shadows (CSM 2048)**: Prefiltered `.env` environment reflections plus 3–4 cascade `CascadedShadowGenerator` contact-hardening shadows and soft floor contact AO beneath every car.
- **Multi-Layer PBR Tarmac & Instanced Trackside World**: Sobel height-field asphalt normal maps, roughness-mapped rubbered racing grooves, single-occurrence banked start/finish grid, W-beam Armco barriers, alpha-tested catch fencing, and `ThinInstance` trackside grandstands, pit garages, floodlights, and circuit landmarks.
- **Sculpted Ground-Effect Vehicle & Live Cockpit**: `ExtrudeShapeCustom` tapered monocoque & undercut sidepods, 2×2 twill carbon weave, 8 suspension wishbones, iridescent titanium exhaust, glowing carbon-ceramic brakes, 4-wheel suspension travel, and live steering wheel LCD telemetry.
- **Dynamic VFX & Calibrated HDR Post-Processing**: ACES photographic tonemapping, threshold-calibrated bloom, SSAO2, velocity-based motion blur, 4-wheel lockup smoke, ring-buffer tire skidmarks, wet rooster-tail rain spray, and titanium sparks.

---

### 📺 Broadcast F1 Telemetry HUD
- **15-LED Shift Light Tachometer**: Progressive green $\to$ yellow $\to$ red $\to$ flashing blue shift lights.
- **Digital Instrument Cluster**: Large digital speedometer (km/h), gear selector readout, and live engine tachometer.
- **Live Timing Tower**: Real-time position order (P1–P6) and dynamic gap intervals to leader and rivals.
- **Real-Time Telemetry Cards**: Sector split timing, lap counters, brake rotor temperatures with glowing thermal emissive effects, and lateral/longitudinal G-force accelerometer.

---

## 🕹️ Controls Guide

| Action | Primary (Keyboard) | Alternative (Keyboard) | Gamepad (Xbox / DualShock) |
| :--- | :--- | :--- | :--- |
| **Throttle / Accelerate** | `W` | `Up Arrow` | `Right Trigger (RT / R2)` |
| **Brake / Reverse** | `S` | `Down Arrow` | `Left Trigger (LT / L2)` |
| **Steer Left** | `A` | `Left Arrow` | `Left Stick (Left)` |
| **Steer Right** | `D` | `Right Arrow` | `Left Stick (Right)` |
| **Toggle DRS** | `E` | `Spacebar` | `A / Cross Button` |
| **Cycle Camera** | `C` | — | `Y / Triangle Button` |
| **Pause Session** | `Escape` | `P` | `Start / Options Button` |
| **Mute / Unmute Audio** | `M` | — | — |

---

## 🚦 Session Formats

- **Grand Prix**: 5-red-light starting gantry countdown sequence, full AI competitor grid, multi-lap racing, live timing gaps, and checkered flag finish.
- **Qualifying**: Single-car hot-lap format with empty circuit for setting the ultimate pole position lap time.
- **Free Practice**: Open circuit session for dialing in steering sensitivity, testing braking markers, and optimizing racing lines.

---

## 💻 Minimum & Recommended Device Requirements

### Supported Browsers & Web APIs
- **Required**: Modern browser with **WebGL 2.0** and **WebAssembly (WASM)** enabled (`Chrome 90+`, `Edge 90+`, `Firefox 90+`, `Brave`, `Safari / iOS Safari 16.4+`).
- **Enhanced Capabilities**: Web Audio API (procedural engine & collision audio), Web Speech API (race engineer voice commentary), Gamepad API with Dual-Rumble Vibration Actuator, and `DeviceOrientationEvent` (optional mobile tilt steering).

### Minimum & Recommended Hardware

| Platform | Minimum Requirements | Recommended (60–120 FPS) |
| :--- | :--- | :--- |
| **Desktop / Laptop** | Windows 10+, macOS 13+, or 64-bit Linux · Dual-core 2.0 GHz CPU · 4 GB RAM · WebGL 2.0 GPU (512 MB+ VRAM, D3D11/Metal/OpenGL ES 3.0) · 1280×720 viewport | Quad-core CPU or Apple Silicon · 8 GB+ RAM · Dedicated or modern integrated GPU (Intel UHD 730 / Iris Xe / M-series / GTX 1050+) · 1920×1080 display · Gamepad or keyboard |
| **Mobile & Tablet** | iOS / iPadOS 16.4+ or Android 10+ · 64-bit ARM SoC · 3 GB RAM · Touch screen with WebGL 2.0 enabled | iOS 17+ / Android 12+ · Mid-range or flagship SoC (Apple A14+ / Snapdragon 7xx/8xx+) · 4 GB+ RAM · Landscape or Auto-Landscape touch mode |

> **Adaptive Graphics Tier**: Devices with coarse touch pointers or a short viewport edge `<= 900px` automatically switch to lightweight `1024px` shadow maps and single-sample post-processing (disabling SSAO2, 3-tier cascaded shadows, and velocity motion blur) to sustain playable framerates on mobile GPUs.

---

## 🚀 Getting Started

### Local Development Prerequisites
- [Node.js](https://nodejs.org) 20.0 or higher
- [npm](https://www.npmjs.com) 9.0 or higher
- Modern web browser with WebGL 2.0 support (Chrome, Edge, Firefox, Brave, Safari 16.4+)

### Installation & Local Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/layanpro123456/formula-racing-3d.git
   cd formula-racing-3d
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Start the local Next.js development server**:
   ```bash
   npm run dev
   ```

4. **Launch the simulator**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Static Export

```bash
# Build optimized static production bundle
npm run build

# Serve static production export
npx serve out
```

---

## 📂 Repository Layout

```text
formula-racing-3d/
├── app/
│   ├── globals.css              # Telemetry HUD, paddock styling, and range sliders
│   ├── icon.svg                 # Vector browser favicon
│   ├── layout.tsx               # Root layout, viewport metadata, and fonts
│   └── page.tsx                 # Main application entry point
├── components/
│   ├── LandscapeStage.tsx       # Auto-rotating 90° landscape stage for portrait mobile
│   ├── MobileControls.tsx       # Multi-touch pads, analog slider, tilt & DRS controls
│   ├── RacingGame.tsx           # Paddock garage menu shell & session configurator
│   ├── RacingHUD.tsx            # Shift lights, timing tower, Race Control & HUD
│   ├── TrackNavigationMap.tsx   # Top-right 2D vector GPS circuit minimap
│   └── babylon/
│       ├── BabylonRacingGame.tsx    # Babylon.js engine, render loop, and camera
│       ├── BabylonTrackGenerator.ts # Procedural 3D banked ribbon, kerbs, barriers
│       └── BabylonVehicle.ts        # PBR car model with animated wheels and DRS
├── data/
│   ├── liveries.ts              # Team livery definitions and PBR materials
│   └── tracks.ts                # Track waypoints, sector splits, and DRS zones
├── lib/
│   ├── ai/
│   │   └── AIDriver.ts          # AI grid simulator, TTC braking & overtaking
│   ├── audio/
│   │   └── EngineSound.ts       # Synthesized Web Audio API sound & impact engine
│   ├── babylon/
│   │   ├── CircuitLandmarks.ts    # Per-circuit landmarks, bridges, tunnel, harbor & flora
│   │   ├── EnvironmentPreset.ts   # Weather/lighting presets, GPU tiers & physical sky shader
│   │   ├── TrackPropsGenerator.ts # ThinInstance pit garages, stands & gantry LEDs
│   │   ├── VehicleMaterials.ts    # Twill carbon weave, tire grain, contact AO & PBR liveries
│   │   └── havokLoader.ts         # Havok WASM physics plugin loader
│   ├── commentary/
│   │   └── RaceCommentary.ts    # Web Speech API race commentary announcer
│   ├── effects/
│   │   ├── BarrierSparkSystem.ts # Particle spark system on collisions
│   │   ├── RainSpraySystem.ts    # Wet-track rooster-tail wake spray particles
│   │   ├── SkidmarkSystem.ts     # Zero-allocation ring-buffer tire skidmarks
│   │   └── TireSmokeSystem.ts    # 4-wheel lockup & slip tire smoke particles
│   ├── input/
│   │   └── InputManager.ts      # Keyboard, gamepad, touch & gyro inputs
│   ├── math/
│   │   └── Spline3D.ts          # Arc-length Catmull-Rom spline calculations
│   └── physics/
│       ├── CollisionSystem.ts   # Zero-allocation 2D OBB SAT collision & penalties
│       └── VehiclePhysics.ts    # Pacejka tire slip, downforce, gearbox, barriers
├── public/
│   ├── assets/
│   │   └── environment/
│   │       └── environmentSpecular.env # Prefiltered IBL environment reflection probe
│   ├── HavokPhysics.wasm        # Havok physics WebAssembly binary
│   ├── logo.svg                 # Vector brand logo
│   ├── manifest.json            # Fullscreen landscape PWA web app manifest
│   ├── promotional_poster.jpg   # Master 1920x1080 promotional showcase poster
│   ├── social_preview.jpg       # OpenGraph 1200x675 social media banner
│   ├── screenshots/             # High-resolution visual showcase captures
│       ├── linkedin_poster.png             # 2400x3000 (4:5) high-DPI LinkedIn poster
│       ├── promotional_poster.jpg          # 1920x1080 landscape showcase poster
│       ├── promotional_poster_portrait.jpg # 1200x1500 portrait showcase poster
│       ├── social_preview.jpg   # 1200x675 OpenGraph banner
│       ├── gameplay_chase.png     # Monaco GP wheel-to-wheel chase camera
│       ├── monaco_tunnel.png      # Monaco Louis II Tunnel high-speed sprint
│       ├── wet_ssr_spa.png        # Wet track Screen-Space Reflections on Spa
│       ├── monza_showcase.png     # Monza Royal Blue runoffs & Podium Overhang
│       ├── silverstone_showcase.png # Silverstone Golden Hour showcase
│       ├── night_suzuka.png       # Night floodlit Grand Prix at Suzuka
│       ├── tcam_view.png          # Broadcast T-Cam roll-hoop onboard view
│       ├── menu.png               # Paddock garage circuit, weather & quality setup
│       ├── pause_menu.png         # Mid-race pause, sensitivity & graphics calibration
│       ├── cockpit_view.png       # Cockpit & Halo view at Monaco Casino Square
│       └── nose_cam.png           # Front nose bumper camera at Monaco
│   └── videos/                    # 1-minute Monaco Grand Prix gameplay captures
│       ├── formula_racing_3d_demo.mp4 # 60s Monaco Grand Prix demo (MP4)
│       └── raw_gameplay.webm          # 60s Monaco Grand Prix capture (VP9 WebM)
├── ARCHITECTURE.md              # Graphics & simulation mathematical architecture
├── CONTRIBUTING.md              # Engineering guidelines & invariant standards
├── ROADMAP.md                   # Future milestones & development roadmap
└── package.json                 # Project dependencies and scripts
```

---

## 📜 Architectural Invariants

- **Zero Allocations in Render Loops**: Never allocate vectors, matrices, or object literals inside `runRenderLoop`. Scratch vectors are pre-allocated and reused in-place (`.copyFrom()`, `.set()`, `Vector3.LerpToRef()`).
- **Physics Decoupled from React State**: High-frequency physics and inputs run in native requestAnimationFrame loops; React state updates are throttled to HUD consumption intervals.
- **Native Browser APIs**: Web Audio API, Web Speech API, and Gamepad API execute client-side with zero external SaaS dependencies.

---

## 📄 License & Disclaimers

This project is open-source under the [MIT License](LICENSE).

> **Disclaimer**: *Formula Racing 3D* is an independent educational engineering demonstration. It employs original generic open-wheel vehicle designs, stylized fictional liveries, and hand-authored track approximations. It is not affiliated with, sponsored by, or endorsed by Formula 1 (F1), the FIA, or any commercial racing organization.
