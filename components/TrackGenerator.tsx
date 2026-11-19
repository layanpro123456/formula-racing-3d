"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Track } from "@/data/tracks";

export function build3DCurve(points: [number, number, number][], scale = 4.8): THREE.CatmullRomCurve3 {
  const pts = points.map(([x, y, z]) => new THREE.Vector3(x * scale, y * scale * 0.8, z * scale));
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.16);
}

// Procedural Canvas-Generated Asphalt & Rubbered Racing Groove Texture
function createAsphaltTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Dark asphalt base
  ctx.fillStyle = "#1e2023";
  ctx.fillRect(0, 0, 512, 512);

  // Micro-aggregate stone flecks
  for (let i = 0; i < 28000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const gray = Math.floor(25 + Math.random() * 35);
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Dark rubbered-in racing groove along tire lines (X ~ 180 and X ~ 330)
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, "rgba(22, 23, 26, 0.1)");
  grad.addColorStop(0.35, "rgba(10, 11, 13, 0.65)"); // Left wheel rubber groove
  grad.addColorStop(0.5, "rgba(24, 26, 30, 0.2)");  // Clean center
  grad.addColorStop(0.65, "rgba(10, 11, 13, 0.65)"); // Right wheel rubber groove
  grad.addColorStop(1, "rgba(22, 23, 26, 0.1)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // White edge lines on track boundaries
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(12, 0, 14, 512); // Left edge line
  ctx.fillRect(486, 0, 14, 512); // Right edge line

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 80);
  return texture;
}

interface TrackGeneratorProps {
  track: Track;
  curve: THREE.CatmullRomCurve3;
}

export function TrackSceneGeometry({ track, curve }: TrackGeneratorProps) {
  // Memoized procedural geometries for 60+ FPS stability with zero allocations inside frame
  const {
    roadGeometry,
    leftKerbGeometry,
    rightKerbGeometry,
    runoffGeometry,
    leftBarrierGeometry,
    rightBarrierGeometry,
    startFinishGantry,
    brakingBoards,
    tireBarriers
  } = useMemo(() => {
    const segments = 640;
    const halfW = track.width * 0.5;
    const kerbW = 0.95;
    const runoffW = 3.2;
    const barrierOffset = halfW + kerbW + runoffW;

    // Road vertices
    const roadVerts: number[] = [];
    const roadNorms: number[] = [];
    const roadUVs: number[] = [];
    const roadIndices: number[] = [];

    // 3D Chamfered Kerb vertices
    const lKerbVerts: number[] = [];
    const lKerbColors: number[] = [];
    const rKerbVerts: number[] = [];
    const rKerbColors: number[] = [];
    const kerbIndices: number[] = [];

    // Runoff vertices
    const runoffVerts: number[] = [];
    const runoffIndices: number[] = [];

    // Barrier curve paths for TubeGeometry
    const leftBarrierPts: THREE.Vector3[] = [];
    const rightBarrierPts: THREE.Vector3[] = [];

    // Dynamic trackside furniture collections
    const boards: { pos: [number, number, number]; rot: number; text: string }[] = [];
    const tireStacks: { pos: [number, number, number]; rot: number }[] = [];

    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      
      // Calculate true mathematical curvature to derive realistic banking
      const nextT = (t + 0.005) % 1.0;
      const nextTan = curve.getTangentAt(nextT).normalize();
      const deltaTan = nextTan.clone().sub(tangent);
      const curvSign = (tangent.z * deltaTan.x - tangent.x * deltaTan.z) * 14.0;
      
      // Real-world superelevation banking angle (inward on sharp corners)
      const bankingAngle = THREE.MathUtils.clamp(curvSign, -0.14, 0.14);

      // Compute banked lateral axis
      const side = new THREE.Vector3().crossVectors(tangent, upVector).normalize();
      const bankAxis = upVector.clone().addScaledVector(side, -bankingAngle).normalize();
      const bankedSide = new THREE.Vector3().crossVectors(tangent, bankAxis).normalize();

      // Road edges
      const lRoad = pt.clone().addScaledVector(bankedSide, halfW);
      const rRoad = pt.clone().addScaledVector(bankedSide, -halfW);

      roadVerts.push(lRoad.x, lRoad.y + 0.02, lRoad.z, rRoad.x, rRoad.y + 0.02, rRoad.z);
      roadNorms.push(bankAxis.x, bankAxis.y, bankAxis.z, bankAxis.x, bankAxis.y, bankAxis.z);
      roadUVs.push(0, t * 80, 1, t * 80);

      // 3D Chamfered Sawtooth Kerbs (+0.08m vertical lip with 45-deg bevel)
      const lKerbInner = lRoad.clone();
      const lKerbOuter = lRoad.clone().addScaledVector(bankedSide, kerbW).add(new THREE.Vector3(0, 0.085, 0));
      const rKerbInner = rRoad.clone();
      const rKerbOuter = rRoad.clone().addScaledVector(bankedSide, -kerbW).add(new THREE.Vector3(0, 0.085, 0));

      lKerbVerts.push(
        lKerbInner.x, lKerbInner.y + 0.02, lKerbInner.z,
        lKerbOuter.x, lKerbOuter.y, lKerbOuter.z
      );
      rKerbVerts.push(
        rKerbInner.x, rKerbInner.y + 0.02, rKerbInner.z,
        rKerbOuter.x, rKerbOuter.y, rKerbOuter.z
      );

      // Alternating high-visibility red/white kerb segments
      const isRed = Math.floor(t * 140) % 2 === 0;
      const kr = isRed ? 0.94 : 0.98;
      const kg = isRed ? 0.12 : 0.98;
      const kb = isRed ? 0.14 : 0.98;

      lKerbColors.push(kr, kg, kb, kr, kg, kb);
      rKerbColors.push(kr, kg, kb, kr, kg, kb);

      // Runoff gravel/AstroTurf
      const lRunoff = lKerbOuter.clone().addScaledVector(bankedSide, runoffW);
      const rRunoff = rKerbOuter.clone().addScaledVector(bankedSide, -runoffW);

      runoffVerts.push(
        lKerbOuter.x, lKerbOuter.y, lKerbOuter.z, lRunoff.x, lRunoff.y, lRunoff.z,
        rKerbOuter.x, rKerbOuter.y, rKerbOuter.z, rRunoff.x, rRunoff.y, rRunoff.z
      );

      // Armco Guardrail Centerlines
      leftBarrierPts.push(pt.clone().addScaledVector(bankedSide, barrierOffset).add(new THREE.Vector3(0, 0.52, 0)));
      rightBarrierPts.push(pt.clone().addScaledVector(bankedSide, -barrierOffset).add(new THREE.Vector3(0, 0.52, 0)));

      // Place 150m / 100m / 50m braking boards approaching heavy braking zones
      if (Math.abs(curvSign) > 0.08 && i % 38 === 0 && i > 20) {
        const boardHeading = Math.atan2(tangent.x, tangent.z);
        const boardOffset = halfW + kerbW + 0.6;
        const boardPos = pt.clone().addScaledVector(bankedSide, boardOffset);
        boards.push({
          pos: [boardPos.x, boardPos.y + 1.1, boardPos.z],
          rot: boardHeading,
          text: i % 2 === 0 ? "100" : "50"
        });

        // Add protective tire barrier stacks along deep runoff outer edges
        const tirePos = pt.clone().addScaledVector(bankedSide, barrierOffset - 0.7);
        tireStacks.push({
          pos: [tirePos.x, tirePos.y + 0.35, tirePos.z],
          rot: boardHeading
        });
      }

      if (i < segments) {
        const a = i * 2;
        // Road quads
        roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        // Kerb quads
        kerbIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);

        // Runoff quads
        const ra = i * 4;
        runoffIndices.push(ra, ra + 1, ra + 4, ra + 1, ra + 5, ra + 4);
        runoffIndices.push(ra + 2, ra + 3, ra + 6, ra + 3, ra + 7, ra + 6);
      }
    }

    // Road buffer geometry
    const road = new THREE.BufferGeometry();
    road.setAttribute("position", new THREE.Float32BufferAttribute(roadVerts, 3));
    road.setAttribute("normal", new THREE.Float32BufferAttribute(roadNorms, 3));
    road.setAttribute("uv", new THREE.Float32BufferAttribute(roadUVs, 2));
    road.setIndex(roadIndices);
    road.computeVertexNormals();

    // Kerbs geometries
    const lKerb = new THREE.BufferGeometry();
    lKerb.setAttribute("position", new THREE.Float32BufferAttribute(lKerbVerts, 3));
    lKerb.setAttribute("color", new THREE.Float32BufferAttribute(lKerbColors, 3));
    lKerb.setIndex(kerbIndices);
    lKerb.computeVertexNormals();

    const rKerb = new THREE.BufferGeometry();
    rKerb.setAttribute("position", new THREE.Float32BufferAttribute(rKerbVerts, 3));
    rKerb.setAttribute("color", new THREE.Float32BufferAttribute(rKerbColors, 3));
    rKerb.setIndex(kerbIndices);
    rKerb.computeVertexNormals();

    // Runoff geometry
    const runoff = new THREE.BufferGeometry();
    runoff.setAttribute("position", new THREE.Float32BufferAttribute(runoffVerts, 3));
    runoff.setIndex(runoffIndices);
    runoff.computeVertexNormals();

    // Armco barrier tubes
    const lBarrierCurve = new THREE.CatmullRomCurve3(leftBarrierPts, true);
    const rBarrierCurve = new THREE.CatmullRomCurve3(rightBarrierPts, true);
    const lBarrierGeo = new THREE.TubeGeometry(lBarrierCurve, segments, 0.24, 6, true);
    const rBarrierGeo = new THREE.TubeGeometry(rBarrierCurve, segments, 0.24, 6, true);

    // Start / Finish Gantry
    const startPt = curve.getPointAt(0);
    const startTan = curve.getTangentAt(0).normalize();

    return {
      roadGeometry: road,
      leftKerbGeometry: lKerb,
      rightKerbGeometry: rKerb,
      runoffGeometry: runoff,
      leftBarrierGeometry: lBarrierGeo,
      rightBarrierGeometry: rBarrierGeo,
      startFinishGantry: {
        position: [startPt.x, startPt.y, startPt.z] as [number, number, number],
        quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTan),
        span: halfW * 2 + 5.2
      },
      brakingBoards: boards,
      tireBarriers: tireStacks
    };
  }, [curve, track.width]);

  // Materials with PBR procedural texture
  const materials = useMemo(() => {
    const asphaltTex = createAsphaltTexture();

    return {
      road: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: asphaltTex || undefined,
        roughness: 0.85,
        metalness: 0.12,
        side: THREE.DoubleSide
      }),
      kerb: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.18,
        side: THREE.DoubleSide
      }),
      runoff: new THREE.MeshStandardMaterial({
        color: "#1d3822", // Synthetic AstroTurf
        roughness: 0.96,
        side: THREE.DoubleSide
      }),
      barrier: new THREE.MeshStandardMaterial({
        color: "#dce1e6",
        roughness: 0.38,
        metalness: 0.75
      }),
      gantry: new THREE.MeshStandardMaterial({
        color: "#181a1e",
        roughness: 0.48,
        metalness: 0.82
      }),
      board: new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.3,
        metalness: 0.5
      }),
      tireBarrier: new THREE.MeshStandardMaterial({
        color: "#e11d48", // Safety red tire packs
        roughness: 0.92,
        metalness: 0.05
      })
    };
  }, []);

  return (
    <group>
      {/* Expansive terrain ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color={track.groundColor} roughness={0.98} />
      </mesh>

      {/* Main Asphalt Road with Procedural Rubber & Grain */}
      <mesh geometry={roadGeometry} material={materials.road} receiveShadow />

      {/* 3D Chamfered Sawtooth Kerbs */}
      <mesh geometry={leftKerbGeometry} material={materials.kerb} receiveShadow />
      <mesh geometry={rightKerbGeometry} material={materials.kerb} receiveShadow />

      {/* Runoff Synthetic AstroTurf */}
      <mesh geometry={runoffGeometry} material={materials.runoff} receiveShadow />

      {/* Outer Steel Armco Barriers */}
      <mesh geometry={leftBarrierGeometry} material={materials.barrier} castShadow receiveShadow />
      <mesh geometry={rightBarrierGeometry} material={materials.barrier} castShadow receiveShadow />

      {/* 150m / 100m / 50m Distance Boards */}
      {brakingBoards.map((b, idx) => (
        <group key={idx} position={b.pos} rotation={[0, b.rot, 0]}>
          {/* Post */}
          <mesh position={[0, -0.5, 0]} material={materials.gantry}>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
          </mesh>
          {/* Board Face */}
          <mesh material={materials.board} castShadow>
            <boxGeometry args={[0.9, 0.55, 0.06]} />
          </mesh>
        </group>
      ))}

      {/* Stacked Safety Tire Barriers */}
      {tireBarriers.map((tb, idx) => (
        <group key={idx} position={tb.pos} rotation={[0, tb.rot, 0]}>
          <mesh material={materials.tireBarrier} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.65, 12]} />
          </mesh>
        </group>
      ))}

      {/* Start / Finish Gantry Arch */}
      <group position={startFinishGantry.position} quaternion={startFinishGantry.quaternion}>
        <mesh position={[-startFinishGantry.span / 2, 3.8, 0]} material={materials.gantry}>
          <cylinderGeometry args={[0.22, 0.22, 7.6, 12]} />
        </mesh>
        <mesh position={[startFinishGantry.span / 2, 3.8, 0]} material={materials.gantry}>
          <cylinderGeometry args={[0.22, 0.22, 7.6, 12]} />
        </mesh>
        <mesh position={[0, 7.4, 0]} material={materials.gantry}>
          <boxGeometry args={[startFinishGantry.span, 0.65, 0.8]} />
        </mesh>
        {/* 5 Start Light Pods */}
        {[-1.6, -0.8, 0, 0.8, 1.6].map((x, idx) => (
          <group key={idx} position={[x, 6.7, 0.45]}>
            <mesh>
              <boxGeometry args={[0.5, 0.75, 0.2]} />
              <meshStandardMaterial color="#0b0d10" />
            </mesh>
            <mesh position={[0, 0.12, 0.11]}>
              <circleGeometry args={[0.15, 16]} />
              <meshBasicMaterial color="#e63946" />
            </mesh>
          </group>
        ))}
        {/* Checkered Start/Finish Grid Slot on Track */}
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[track.width, 1.8]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      </group>
    </group>
  );
}
