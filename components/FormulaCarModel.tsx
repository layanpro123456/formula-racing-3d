"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export interface Livery {
  name: string;
  team: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const LIVERIES: Livery[] = [
  { name: "Scuderia", team: "Maranello Rosso", primary: "#dc2626", secondary: "#111827", accent: "#fbbf24" },
  { name: "Silver Arrow", team: "Stuttgart Motorsport", primary: "#9ca3af", secondary: "#111827", accent: "#06b6d4" },
  { name: "Papaya", team: "Woking Racing", primary: "#f97316", secondary: "#1e3a8a", accent: "#38bdf8" },
  { name: "Bull Speed", team: "Milton Keynes", primary: "#1e293b", secondary: "#991b1b", accent: "#facc15" },
  { name: "Verdant Racing", team: "Silverstone Green", primary: "#065f46", secondary: "#047857", accent: "#a3e635" }
];

interface FormulaCarModelProps {
  liveryIndex?: number;
  steerAngle?: number; // Steering angle in radians
  speed?: number;      // Current speed in m/s
  isBraking?: boolean;
  drsActive?: boolean;
}

export function FormulaCarModel({
  liveryIndex = 0,
  steerAngle = 0,
  speed = 0,
  isBraking = false,
  drsActive = false
}: FormulaCarModelProps) {
  const livery = LIVERIES[liveryIndex % LIVERIES.length];

  // Wheel refs for continuous physical rotation without frame allocations
  const wheelFL = useRef<THREE.Group>(null);
  const wheelFR = useRef<THREE.Group>(null);
  const wheelRL = useRef<THREE.Group>(null);
  const wheelRR = useRef<THREE.Group>(null);
  const frontSteerGroup = useRef<THREE.Group>(null);
  const wheelSpin = useRef(0);

  // Wheel dimensions
  const wheelRadius = 0.36;

  useFrame((_, delta) => {
    // Wheel spin based on speed (omega = v / r)
    const angularVelocity = speed / wheelRadius;
    wheelSpin.current += angularVelocity * delta;

    if (wheelFL.current) wheelFL.current.rotation.x = wheelSpin.current;
    if (wheelFR.current) wheelFR.current.rotation.x = wheelSpin.current;
    if (wheelRL.current) wheelRL.current.rotation.x = wheelSpin.current;
    if (wheelRR.current) wheelRR.current.rotation.x = wheelSpin.current;

    // Front steering assembly
    if (frontSteerGroup.current) {
      frontSteerGroup.current.rotation.y = THREE.MathUtils.lerp(
        frontSteerGroup.current.rotation.y,
        steerAngle * 0.42,
        0.25
      );
    }
  });

  // Cached materials
  const materials = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({
        color: livery.primary,
        metalness: 0.6,
        roughness: 0.22,
        envMapIntensity: 1.2
      }),
      bodySecondary: new THREE.MeshStandardMaterial({
        color: livery.secondary,
        metalness: 0.7,
        roughness: 0.28
      }),
      carbon: new THREE.MeshStandardMaterial({
        color: "#18181b",
        metalness: 0.4,
        roughness: 0.65
      }),
      accent: new THREE.MeshStandardMaterial({
        color: livery.accent,
        metalness: 0.5,
        roughness: 0.3
      }),
      rubber: new THREE.MeshStandardMaterial({
        color: "#09090b",
        roughness: 0.92,
        metalness: 0.05
      }),
      tireCompound: new THREE.MeshStandardMaterial({
        color: "#ef4444", // Soft compound red stripe
        roughness: 0.5
      }),
      wheelRim: new THREE.MeshStandardMaterial({
        color: "#27272a",
        metalness: 0.9,
        roughness: 0.15
      }),
      helmet: new THREE.MeshStandardMaterial({
        color: livery.accent,
        roughness: 0.15,
        metalness: 0.4
      }),
      visor: new THREE.MeshStandardMaterial({
        color: "#09090b",
        roughness: 0.05,
        metalness: 0.95
      }),
      brakeGlow: new THREE.MeshBasicMaterial({
        color: "#ff2200"
      })
    };
  }, [livery]);

  const wheelAssembly = (isFront: boolean, isLeft: boolean) => (
    <group rotation={[0, isLeft ? 0 : Math.PI, 0]}>
      {/* Tire Rubber Cylinder */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[wheelRadius, wheelRadius, isFront ? 0.32 : 0.42, 28]} />
        <primitive object={materials.rubber} attach="material" />
      </mesh>
      {/* Wheel Rim Cap */}
      <mesh position={[isLeft ? 0.14 : -0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
        <primitive object={materials.wheelRim} attach="material" />
      </mesh>
      {/* Compound Red Sidewall Stripe */}
      <mesh position={[isLeft ? 0.165 : -0.165, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <ringGeometry args={[0.24, 0.27, 24]} />
        <primitive object={materials.tireCompound} attach="material" />
      </mesh>
    </group>
  );

  return (
    <group>
      {/* Central Monocoque Chassis */}
      <mesh position={[0, 0.38, 0.1]} material={materials.body} castShadow>
        <boxGeometry args={[0.88, 0.34, 2.8]} />
      </mesh>

      {/* Tapered Nose Cone */}
      <mesh position={[0, 0.34, 1.85]} material={materials.body} castShadow>
        <coneGeometry args={[0.42, 1.3, 4]} />
      </mesh>

      {/* Aerodynamic Sidepods */}
      <mesh position={[-0.62, 0.34, -0.1]} material={materials.body} castShadow>
        <boxGeometry args={[0.44, 0.32, 1.6]} />
      </mesh>
      <mesh position={[0.62, 0.34, -0.1]} material={materials.body} castShadow>
        <boxGeometry args={[0.44, 0.32, 1.6]} />
      </mesh>

      {/* Engine Cover Spine & Fin */}
      <mesh position={[0, 0.65, -0.45]} material={materials.accent} castShadow>
        <boxGeometry args={[0.06, 0.38, 1.3]} />
      </mesh>

      {/* Engine Air Intake Scoop */}
      <mesh position={[0, 0.82, -0.1]} material={materials.bodySecondary} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.5]} />
      </mesh>

      {/* Halo Safety Titanium Hoop */}
      <mesh position={[0, 0.72, 0.32]} rotation={[Math.PI / 8, 0, 0]}>
        <torusGeometry args={[0.24, 0.042, 8, 20, Math.PI]} />
        <primitive object={materials.carbon} attach="material" />
      </mesh>
      {/* Halo Central Strut */}
      <mesh position={[0, 0.58, 0.52]} rotation={[Math.PI / 6, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <primitive object={materials.carbon} attach="material" />
      </mesh>

      {/* Driver Helmet in Cockpit */}
      <group position={[0, 0.68, 0.18]}>
        <mesh material={materials.helmet}>
          <sphereGeometry args={[0.18, 16, 16]} />
        </mesh>
        <mesh position={[0, 0.02, 0.12]} material={materials.visor}>
          <boxGeometry args={[0.22, 0.08, 0.12]} />
        </mesh>
      </group>

      {/* Front Aerodynamic Wing & Endplates */}
      <group position={[0, 0.22, 2.3]}>
        <mesh material={materials.carbon} castShadow>
          <boxGeometry args={[1.9, 0.06, 0.42]} />
        </mesh>
        <mesh position={[-0.94, 0.12, 0]} material={materials.accent}>
          <boxGeometry args={[0.05, 0.28, 0.48]} />
        </mesh>
        <mesh position={[0.94, 0.12, 0]} material={materials.accent}>
          <boxGeometry args={[0.05, 0.28, 0.48]} />
        </mesh>
      </group>

      {/* Rear Wing & DRS Flap */}
      <group position={[0, 0.88, -1.55]}>
        {/* Main Lower Plane */}
        <mesh material={materials.carbon} castShadow>
          <boxGeometry args={[1.7, 0.06, 0.35]} />
        </mesh>
        {/* Upper DRS Flap */}
        <mesh
          position={[0, drsActive ? 0.24 : 0.14, 0.06]}
          rotation={[drsActive ? -0.35 : 0, 0, 0]}
          material={materials.bodySecondary}
          castShadow
        >
          <boxGeometry args={[1.68, 0.05, 0.22]} />
        </mesh>
        {/* Endplates */}
        <mesh position={[-0.85, 0.06, 0]} material={materials.accent}>
          <boxGeometry args={[0.05, 0.42, 0.52]} />
        </mesh>
        <mesh position={[0.85, 0.06, 0]} material={materials.accent}>
          <boxGeometry args={[0.05, 0.42, 0.52]} />
        </mesh>
        {/* Rear Rain / Safety LED */}
        <mesh position={[0, -0.38, 0.1]}>
          <boxGeometry args={[0.15, 0.08, 0.05]} />
          <meshBasicMaterial color={isBraking ? "#ff0000" : "#ff3333"} />
        </mesh>
      </group>

      {/* Underbody Carbon Floor & Diffuser */}
      <mesh position={[0, 0.14, 0.1]} material={materials.carbon}>
        <boxGeometry args={[1.68, 0.05, 3.1]} />
      </mesh>

      {/* Front Steerable Wheels Assembly */}
      <group ref={frontSteerGroup} position={[0, 0.36, 1.45]}>
        {/* Front Left */}
        <group ref={wheelFL} position={[-0.92, 0, 0]}>
          {wheelAssembly(true, true)}
        </group>
        {/* Front Right */}
        <group ref={wheelFR} position={[0.92, 0, 0]}>
          {wheelAssembly(true, false)}
        </group>
      </group>

      {/* Rear Wheels Assembly (Fixed Alignment, Rotational Drive) */}
      <group position={[0, 0.36, -1.15]}>
        {/* Rear Left */}
        <group ref={wheelRL} position={[-0.96, 0, 0]}>
          {wheelAssembly(false, true)}
        </group>
        {/* Rear Right */}
        <group ref={wheelRR} position={[0.96, 0, 0]}>
          {wheelAssembly(false, false)}
        </group>
      </group>
    </group>
  );
}
