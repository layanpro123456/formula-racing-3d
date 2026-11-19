---
name: racing-sim-gameplay
description: >-
  Procedural guidance, implementation steps, and runbooks for developing, optimizing, and extending
  the 3D racing simulator in Next.js and Babylon.js with Havok physics.
  Use when modifying vehicle physics, spline track generation, camera damping, checkpoint validation,
  telemetry HUD, or 3D asset integration.
---

# Racing Simulation Gameplay & Babylon.js Development Skill

This skill provides step-by-step technical procedures, mathematical formulas, and architectural recipes for developing features in the **Formula Racing 3D** Next.js & Babylon.js codebase.

---

## 1. Vehicle Physics & Real-World Dynamics

The vehicle uses a deterministic physics model inside `lib/physics/VehiclePhysics.ts` operating natively with Babylon.js `Vector3`.

### Handling Dynamics Model
- **Acceleration Curve**: Force applied in the forward direction. High-power turbo hybrid engines taper acceleration at higher speeds:
  $$\text{effectiveAccel} = \text{maxAccel} \times \left(1 - \frac{\text{speed}}{\text{maxSpeed}}\right)$$
- **Steering Sensitivity Scaling**: High speeds require lower steering sensitivity to maintain high-speed aerodynamic stability:
  $$\text{turnRate} = \text{baseSteering} \times \left(1.0 - \frac{\text{speed}}{\text{maxSpeed}} \times 0.55\right)$$
- **Brake Thermal Model**: Dynamic rotor temperature heating under braking friction and cooling via ram-air ducts.
- **Pacejka Slip Model**: Lateral tire slip modeling for understeer and oversteer dynamics.

---

## 2. Track Spline & Mesh Generation

Tracks in `data/tracks.ts` are defined by 3D coordinates `[x, y, z]`. The 3D ribbon mesh is generated using `Spline3D` and Babylon ribbon builders in `components/babylon/BabylonTrackGenerator.ts`.

### Extrusion Algorithm
1. Sample $N$ points along the curve: $u_i = \frac{i}{N}$ where $i \in [0, N]$.
2. For each point $P(u)$:
   - Compute tangent vector: $T(u) = \text{normalize}\left(P'(u)\right)$
   - Compute perpendicular normal (lateral vector): $S(u) = T(u) \times \text{Up}$
   - Left road edge: $P_L = P(u) + S(u) \cdot w_{\text{half}}$
   - Right road edge: $P_R = P(u) - S(u) \cdot w_{\text{half}}$
3. Construct ribbon paths for road surface, apex kerbs, runoff zones, and Armco steel barriers.

---

## 3. Performance Checklist & Code Invariants

Before committing code changes to the simulation loop:
- [ ] **No Garbage Generation in Render Loop**: Verify that no `new Vector3()` calls exist within the frame loop.
- [ ] **Strict Typing**: Maintain TypeScript `strict: true` compliance without using `any`.
- [ ] **Next.js Production Build**: Verify `npm run build` completes with 0 errors.
