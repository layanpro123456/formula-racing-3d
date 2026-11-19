# Formula Racing 3D — Next.js starter

A browser-based 3D arcade racing prototype built with Next.js, TypeScript, Three.js and React Three Fiber.

## Requirements

- Node.js 20 or newer
- npm
- Chrome, Edge, or Firefox with WebGL enabled

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Controls

- W / Arrow Up: accelerate
- S / Arrow Down: brake
- A / Arrow Left: steer left
- D / Arrow Right: steer right
- Pause button: pause the race

## Current prototype scope

- 3D scene and follow camera
- Procedural Formula-style placeholder car
- Selectable prototype circuit centerlines
- Basic arcade acceleration, braking and steering
- Speed, gear and lap-time HUD
- Main menu and pause overlay

## Important limitations

The included track paths are hand-authored approximations for a playable prototype. They are not verified official circuit centerlines and should not be marketed as exact reproductions. The current vehicle is procedural geometry, not a photorealistic licensed car model. The lap counter is currently a UI placeholder; checkpoint-based lap validation, AI opponents, collisions, tire physics, sound and race rules remain to be implemented.

## Upgrade path

1. Replace placeholder vehicle geometry with optimized GLB models that you have rights to use.
2. Import verified track centerline data and create a closed road mesh with kerbs, runoff, barriers and pit lane.
3. Add a physics engine (Rapier or cannon-es) for tire grip, suspension and collisions.
4. Add checkpoint gates and a proper lap timing system.
5. Add AI opponents with racing lines and overtaking behavior.
6. Add audio, particles, tire smoke, skid marks and post-processing.
7. Add multiplayer only after the single-player simulation is stable.

## Asset licensing

Use original or properly licensed 3D cars, circuit data, logos, fonts, sounds and textures. F1, team names, liveries and logos may be protected trademarks or copyrighted designs. This starter uses generic original styling and does not include official F1 assets.
