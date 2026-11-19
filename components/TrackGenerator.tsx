"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Track } from "@/data/tracks";

export function build3DCurve(points: [number, number, number][], scale = 4.8): THREE.CatmullRomCurve3 {
  const pts = points.map(([x, y, z]) => new THREE.Vector3(x * scale, y * scale * 0.8, z * scale));
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.16);
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
    startFinishGantry
  } = useMemo(() => {
    const segments = 640;
    const halfW = track.width * 0.5;
    const kerbW = 0.85;
    const runoffW = 2.4;
    const barrierOffset = halfW + kerbW + runoffW;

    // Road vertices
    const roadVerts: number[] = [];
    const roadNorms: number[] = [];
    const roadUVs: number[] = [];
    const roadIndices: number[] = [];

    // Kerbs vertices
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

    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      
      // Compute lateral normal vector perpendicular to tangent
      const side = new THREE.Vector3().crossVectors(tangent, upVector).normalize();
      
      // Surface banking tilt on curves
      const curvature = Math.sin(t * Math.PI * 8) * 0.05;
      const bankVector = upVector.clone().addScaledVector(side, curvature).normalize();
      const bankedSide = new THREE.Vector3().crossVectors(tangent, bankVector).normalize();

      // Road edges
      const lRoad = pt.clone().addScaledVector(bankedSide, halfW);
      const rRoad = pt.clone().addScaledVector(bankedSide, -halfW);

      roadVerts.push(lRoad.x, lRoad.y + 0.02, lRoad.z, rRoad.x, rRoad.y + 0.02, rRoad.z);
      roadNorms.push(0, 1, 0, 0, 1, 0);
      roadUVs.push(0, t * 80, 1, t * 80);

      // Kerb outer edges
      const lKerb = lRoad.clone().addScaledVector(bankedSide, kerbW);
      const rKerb = rRoad.clone().addScaledVector(bankedSide, -kerbW);

      lKerbVerts.push(lRoad.x, lRoad.y + 0.03, lRoad.z, lKerb.x, lKerb.y + 0.09, lKerb.z);
      rKerbVerts.push(rRoad.x, rRoad.y + 0.03, rRoad.z, rKerb.x, rKerb.y + 0.09, rKerb.z);

      // Alternating red/white kerb coloring
      const isRed = Math.floor(t * 120) % 2 === 0;
      const kr = isRed ? 0.95 : 0.98;
      const kg = isRed ? 0.15 : 0.98;
      const kb = isRed ? 0.18 : 0.98;

      lKerbColors.push(kr, kg, kb, kr, kg, kb);
      rKerbColors.push(kr, kg, kb, kr, kg, kb);

      // Runoff outer edges
      const lRunoff = lKerb.clone().addScaledVector(bankedSide, runoffW);
      const rRunoff = rKerb.clone().addScaledVector(bankedSide, -runoffW);

      runoffVerts.push(
        lKerb.x, lKerb.y + 0.01, lKerb.z, lRunoff.x, lRunoff.y, lRunoff.z,
        rKerb.x, rKerb.y + 0.01, rKerb.z, rRunoff.x, rRunoff.y, rRunoff.z
      );

      // Barrier centerline points
      leftBarrierPts.push(pt.clone().addScaledVector(bankedSide, barrierOffset).add(new THREE.Vector3(0, 0.45, 0)));
      rightBarrierPts.push(pt.clone().addScaledVector(bankedSide, -barrierOffset).add(new THREE.Vector3(0, 0.45, 0)));

      if (i < segments) {
        const a = i * 2;
        // Road quads
        roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        // Kerb quads
        kerbIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);

        // Runoff quads (4 vertices per segment)
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

    // Barrier tube geometries
    const lBarrierCurve = new THREE.CatmullRomCurve3(leftBarrierPts, true);
    const rBarrierCurve = new THREE.CatmullRomCurve3(rightBarrierPts, true);
    const lBarrierGeo = new THREE.TubeGeometry(lBarrierCurve, segments, 0.22, 6, true);
    const rBarrierGeo = new THREE.TubeGeometry(rBarrierCurve, segments, 0.22, 6, true);

    // Start / Finish Gantry arch
    const startPt = curve.getPointAt(0);
    const startTan = curve.getTangentAt(0).normalize();
    const startSide = new THREE.Vector3().crossVectors(startTan, upVector).normalize();

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
        span: halfW * 2 + 5.0
      }
    };
  }, [curve, track.width]);

  // Materials
  const materials = useMemo(() => {
    return {
      road: new THREE.MeshStandardMaterial({
        color: "#282a2e",
        roughness: 0.88,
        metalness: 0.08,
        side: THREE.DoubleSide
      }),
      kerb: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.15,
        side: THREE.DoubleSide
      }),
      runoff: new THREE.MeshStandardMaterial({
        color: "#1e3822",
        roughness: 0.95,
        side: THREE.DoubleSide
      }),
      barrier: new THREE.MeshStandardMaterial({
        color: "#e2e6ea",
        roughness: 0.45,
        metalness: 0.65
      }),
      gantry: new THREE.MeshStandardMaterial({
        color: "#181a1d",
        roughness: 0.5,
        metalness: 0.8
      })
    };
  }, []);

  return (
    <group>
      {/* Surrounding terrain ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color={track.groundColor} roughness={0.98} />
      </mesh>

      {/* Main Asphalt Road */}
      <mesh geometry={roadGeometry} material={materials.road} receiveShadow />

      {/* Curbs / Kerbs */}
      <mesh geometry={leftKerbGeometry} material={materials.kerb} receiveShadow />
      <mesh geometry={rightKerbGeometry} material={materials.kerb} receiveShadow />

      {/* Runoff Grass / AstroTurf */}
      <mesh geometry={runoffGeometry} material={materials.runoff} receiveShadow />

      {/* Outer Armco Barriers */}
      <mesh geometry={leftBarrierGeometry} material={materials.barrier} castShadow receiveShadow />
      <mesh geometry={rightBarrierGeometry} material={materials.barrier} castShadow receiveShadow />

      {/* Start / Finish Gantry Arch */}
      <group position={startFinishGantry.position} quaternion={startFinishGantry.quaternion}>
        {/* Left post */}
        <mesh position={[-startFinishGantry.span / 2, 3.8, 0]} material={materials.gantry}>
          <cylinderGeometry args={[0.22, 0.22, 7.6, 12]} />
        </mesh>
        {/* Right post */}
        <mesh position={[startFinishGantry.span / 2, 3.8, 0]} material={materials.gantry}>
          <cylinderGeometry args={[0.22, 0.22, 7.6, 12]} />
        </mesh>
        {/* Overhead beam */}
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
        {/* Checkered Start/Finish Line on Track */}
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[track.width, 1.6]} />
          <meshBasicMaterial color="#f8f9fa" />
        </mesh>
      </group>
    </group>
  );
}
