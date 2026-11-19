---
name: racing-sim-gameplay
description: >-
  Procedural guidance, implementation steps, and runbooks for developing, optimizing, and extending
  the 3D racing simulator in Next.js, Three.js, and React Three Fiber (@react-three/fiber).
  Use when modifying vehicle physics, spline track generation, camera damping, checkpoint validation,
  telemetry HUD, or 3D asset integration.
---

# Racing Simulation Gameplay & R3F Development Skill

This skill provides step-by-step technical procedures, mathematical formulas, and architectural recipes for developing features in the **Formula Racing 3D** Next.js & React Three Fiber codebase.

---

## 1. Vehicle Physics & Arcade Handling Tuning

The vehicle currently uses an arcade kinematics simulation inside `components/RacingGame.tsx` within the `Driver` component.

### Handling Dynamics Model
- **Acceleration Curve**: Force applied in the forward direction. Real engines taper acceleration at higher speeds:
  $$\text{effectiveAccel} = \text{maxAccel} \times \left(1 - \frac{\text{speed}}{\text{maxSpeed}}\right)$$
- **Steering Sensitivity Scaling**: High speeds require lower steering sensitivity to avoid snap spins:
  $$\text{turnRate} = \text{baseSteering} \times \left(1.0 - \frac{\text{speed}}{\text{maxSpeed}} \times 0.55\right)$$
- **Drag & Braking**:
  - Mechanical braking rate: $48\,\text{m/s}^2$
  - Natural aerodynamic drag: proportional to $v^2$ or linear decay: $5.5\,\text{m/s}^2$

### Step-by-Step: Adding Drift / Lateral Slip
1. Define a persistent `lateralVelocity` ref in the `Driver` component:
   ```ts
   const lateralVelocity = useRef(0);
   ```
2. When steering at high speed ($v > 20$), blend the vehicle's heading vector with its momentum vector:
   ```ts
   const slipFactor = THREE.MathUtils.clamp((speed.current - 20) / 60, 0, 0.4);
   lateralVelocity.current = THREE.MathUtils.lerp(
     lateralVelocity.current,
     steering * slipFactor * speed.current,
     dt * 6
   );
   ```
3. Apply lateral drift to the car position:
   ```ts
   const right = new THREE.Vector3(Math.cos(heading.current), 0, -Math.sin(heading.current));
   car.current.position.addScaledVector(right, lateralVelocity.current * dt);
   ```

---

## 2. Track Spline & Mesh Generation

Tracks in `data/tracks.ts` are defined by 2D coordinates `[x, z]`. The 3D ribbon mesh is generated using `THREE.CatmullRomCurve3`.

### Extrusion Algorithm
To generate smooth racing ribbons with kerbs and runoff:
1. Sample $N$ points along the curve: $t_i = \frac{i}{N}$ where $i \in [0, N]$.
2. For each point $P(t)$:
   - Compute tangent vector: $T(t) = \text{normalize}\left(P'(t)\right)$
   - Compute perpendicular normal (lateral vector): $S(t) = (T_z, 0, -T_x)$
   - Left road edge: $P_L = P(t) + S(t) \cdot w_{\text{half}}$
   - Right road edge: $P_R = P(t) - S(t) \cdot w_{\text{half}}$
3. Construct triangle strip indices:
   $$[2i, 2i+1, 2i+2], \quad [2i+1, 2i+3, 2i+2]$$
4. Set UV coordinates: $U \in [0, 1]$ across the width, and $V = t \times \text{repeatCount}$ along the track length.

### Step-by-Step: Adding Alternating Kerbs (Curbs)
1. In `TrackScene`, generate an auxiliary buffer geometry for outer edges ($w_{\text{half}} \to w_{\text{half}} + 0.8$).
2. Color vertices or use a repeating red/white shader material based on $\sin(t \times \text{segments} \times 4)$.

---

## 3. Implementing Checkpoint Gates & Lap Validation

To replace the placeholder lap counter with an exploit-proof lap system:

### Checkpoint Structure
```ts
export interface Checkpoint {
  index: number;
  t: number;             // Position on curve [0, 1]
  center: THREE.Vector3;
  normal: THREE.Vector3; // Gate plane normal
  radius: number;        // Track width gate
}
```

### Validation Procedure
1. Divide the spline curve into $K$ equidistant checkpoints (e.g., $K = 8$ sectors).
2. Maintain a `currentCheckpointIndex` state:
   ```ts
   const nextCheckpoint = (currentCheckpoint + 1) % K;
   ```
3. In `useFrame`, calculate the car's distance to the upcoming checkpoint gate:
   ```ts
   const dist = carPos.distanceTo(checkpoints[nextCheckpoint].center);
   if (dist < checkpoints[nextCheckpoint].radius) {
     setCurrentCheckpoint(nextCheckpoint);
     if (nextCheckpoint === 0) {
       // Lap completed!
       recordLapCompletion(lapTime.current);
     }
   }
   ```
4. This ensures drivers cannot reverse or cut across the track infield to trigger fake lap times.

---

## 4. Camera Rig & Dynamic Follow Damping

The chase camera follows the car with exponential smoothing:

### Smooth Lerp Equation
Use frame-rate independent exponential decay:
```ts
const smoothFactor = 1 - Math.exp(-decayRate * dt);
camera.current.position.lerp(desiredPosition, smoothFactor);
```

### Dynamic Speed FOV
To intensify the sensation of speed:
1. Adjust camera FOV based on current vehicle velocity:
   ```ts
   const targetFOV = 60 + (speed.current / 90) * 18; // 60 deg at rest, up to 78 deg at top speed
   camera.current.fov = THREE.MathUtils.lerp(camera.current.fov, targetFOV, dt * 4);
   camera.current.updateProjectionMatrix();
   ```

---

## 5. Integrating 3D GLTF/GLB Models

When upgrading from procedural geometry to 3D vehicle assets:

### Pipeline
1. Place optimized `.glb` models into `public/models/` (e.g., `public/models/formula_car.glb`).
2. Preload and render with `@react-three/drei`:
   ```tsx
   import { useGLTF } from "@react-three/drei";

   export function FormulaCarModel(props: JSX.IntrinsicElements["group"]) {
     const { scene } = useGLTF("/models/formula_car.glb");
     
     // Clone scene if multiple cars or AI opponents will be rendered
     const clonedScene = useMemo(() => scene.clone(), [scene]);
     
     return <primitive object={clonedScene} {...props} />;
   }

   useGLTF.preload("/models/formula_car.glb");
   ```
3. Ensure Draco compression is enabled for web efficiency if models exceed 2MB.

---

## 6. Performance & Memory Hygiene Runbook

Always follow this runbook before submitting code changes:

- [ ] **No Garbage Generation in `useFrame`**: Verify that no `new THREE.Vector3()` or `new THREE.Matrix4()` calls exist within the frame loop.
- [ ] **Canvas DPR Clamped**: Keep Canvas `dpr={[1, 1.6]}` to prevent 4K mobile/retina devices from rendering 16 million pixels per frame.
- [ ] **Shadow Map Resolution**: Restrict directional light shadow map size to `1024x1024` or `2048x2048`.
- [ ] **Type Check**: Ensure `npm run build` succeeds without type errors.
