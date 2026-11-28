// Formula Racing 3D — Babylon.js Track & Infrastructure Generator
// Synchronized with Spline3D and VehiclePhysics with multi-layer PBR tarmac, beveled kerbs,
// W-beam Armco barriers, alpha-tested catch fencing, and instanced trackside props.
import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  PBRMaterial,
  DynamicTexture,
  StandardMaterial,
  Mesh,
  TransformNode
} from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { Spline3D } from "@/lib/math/Spline3D";
import { createTracksideProps, TrackPropsHandle } from "@/lib/babylon/TrackPropsGenerator";

export interface TrackGenerationOptions {
  wetness?: number;
  isNight?: boolean;
  propDensity?: number;
}

export interface TrackGenerationResult {
  root: TransformNode;
  props: TrackPropsHandle;
}

export function createBabylonTrack(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  options: TrackGenerationOptions = {}
): TrackGenerationResult {
  const root = new TransformNode("trackRoot", scene);
  const maxAnisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);
  const wetness = Math.max(0, Math.min(1, options.wetness ?? 0));
  const isWet = wetness > 0.35;

  const segments = 640;
  const halfW = track.width * 0.5;
  const kerbW = 0.95;
  const runoffW = 3.0;
  const barrierOffset = halfW + kerbW + runoffW;

  // Calculate lowest track elevation to place ground safely beneath all roads
  let minElev = 0;
  for (const pt3 of spline.points) {
    if (pt3.y < minElev) minElev = pt3.y;
  }
  const groundFloorY = Math.min(-18.0, minElev - 8.0);

  // Path arrays for CreateRibbon with strict vertical layers to eliminate Z-fighting
  const leftRoadPath: Vector3[] = [];
  const rightRoadPath: Vector3[] = [];

  const leftKerbInner: Vector3[] = [];
  const leftKerbMid: Vector3[] = [];
  const leftKerbOuter: Vector3[] = [];
  const rightKerbInner: Vector3[] = [];
  const rightKerbMid: Vector3[] = [];
  const rightKerbOuter: Vector3[] = [];

  const leftRunoffInner: Vector3[] = [];
  const leftRunoffOuter: Vector3[] = [];
  const rightRunoffInner: Vector3[] = [];
  const rightRunoffOuter: Vector3[] = [];

  const leftSkirtOuter: Vector3[] = [];
  const rightSkirtOuter: Vector3[] = [];

  // Corrugated W-beam Armco barrier paths (3 vertical ribs)
  const leftBarrierBottom: Vector3[] = [];
  const leftBarrierMidIn: Vector3[] = [];
  const leftBarrierTop: Vector3[] = [];
  const rightBarrierBottom: Vector3[] = [];
  const rightBarrierMidIn: Vector3[] = [];
  const rightBarrierTop: Vector3[] = [];

  const leftFenceTopPath: Vector3[] = [];
  const leftFenceBottomPath: Vector3[] = [];
  const rightFenceTopPath: Vector3[] = [];
  const rightFenceBottomPath: Vector3[] = [];

  const up = new Vector3(0, 1, 0);
  const pt = new Vector3();
  const tangent = new Vector3();
  const nextTan = new Vector3();
  const cross = new Vector3();
  const side = new Vector3();

  for (let i = 0; i <= segments; i++) {
    const u = (i % segments) / segments;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tangent);

    // Tangent derivative curvature for smooth realistic banking
    const nextU = (u + 0.005) % 1.0;
    spline.getTangentAtToRef(nextU, nextTan);
    Vector3.CrossToRef(tangent, nextTan, cross);
    const curvSign = cross.y * 18.0;
    const bankingAngle = Math.max(-0.10, Math.min(0.10, curvSign));

    Vector3.CrossToRef(tangent, up, side);
    side.normalize();
    const bankAxis = up.add(side.scale(-bankingAngle)).normalize();
    const bankedSide = Vector3.Cross(tangent, bankAxis).normalize();

    // 1. Asphalt Road surface (elevated 0.03m above centerline)
    leftRoadPath.push(pt.add(bankedSide.scale(halfW)).add(new Vector3(0, 0.03, 0)));
    rightRoadPath.push(pt.add(bankedSide.scale(-halfW)).add(new Vector3(0, 0.03, 0)));

    // 2. Beveled 3D Kerbs (inner apron -> raised rumble lip -> outer slope)
    leftKerbInner.push(pt.add(bankedSide.scale(halfW)).add(new Vector3(0, 0.034, 0)));
    leftKerbMid.push(pt.add(bankedSide.scale(halfW + kerbW * 0.55)).add(new Vector3(0, 0.078, 0)));
    leftKerbOuter.push(pt.add(bankedSide.scale(halfW + kerbW)).add(new Vector3(0, 0.048, 0)));

    rightKerbInner.push(pt.add(bankedSide.scale(-halfW)).add(new Vector3(0, 0.034, 0)));
    rightKerbMid.push(pt.add(bankedSide.scale(-(halfW + kerbW * 0.55))).add(new Vector3(0, 0.078, 0)));
    rightKerbOuter.push(pt.add(bankedSide.scale(-(halfW + kerbW))).add(new Vector3(0, 0.048, 0)));

    // 3. Runoff Synthetic AstroTurf / Gravel
    leftRunoffInner.push(pt.add(bankedSide.scale(halfW + kerbW)).add(new Vector3(0, 0.04, 0)));
    rightRunoffInner.push(pt.add(bankedSide.scale(-(halfW + kerbW))).add(new Vector3(0, 0.04, 0)));
    leftRunoffOuter.push(pt.add(bankedSide.scale(barrierOffset)).add(new Vector3(0, 0.025, 0)));
    rightRunoffOuter.push(pt.add(bankedSide.scale(-barrierOffset)).add(new Vector3(0, 0.025, 0)));

    // 4. Grass Embankment Skirts (anchoring track to surrounding terrain)
    leftSkirtOuter.push(pt.add(bankedSide.scale(barrierOffset + 18.0)).add(new Vector3(0, -4.2, 0)));
    rightSkirtOuter.push(pt.add(bankedSide.scale(-(barrierOffset + 18.0))).add(new Vector3(0, -4.2, 0)));

    // 5. Corrugated W-Beam Armco Barriers (0.24m to 0.72m height)
    const lBase = pt.add(bankedSide.scale(barrierOffset));
    const rBase = pt.add(bankedSide.scale(-barrierOffset));
    leftBarrierBottom.push(lBase.add(new Vector3(0, 0.22, 0)));
    leftBarrierMidIn.push(lBase.add(bankedSide.scale(-0.08)).add(new Vector3(0, 0.46, 0)));
    leftBarrierTop.push(lBase.add(new Vector3(0, 0.72, 0)));

    rightBarrierBottom.push(rBase.add(new Vector3(0, 0.22, 0)));
    rightBarrierMidIn.push(rBase.add(bankedSide.scale(0.08)).add(new Vector3(0, 0.46, 0)));
    rightBarrierTop.push(rBase.add(new Vector3(0, 0.72, 0)));

    // 6. FIA Catch Fence paths (above Armco from 0.72m to 2.35m)
    leftFenceBottomPath.push(lBase.add(new Vector3(0, 0.72, 0)));
    leftFenceTopPath.push(lBase.add(new Vector3(0, 2.35, 0)));
    rightFenceBottomPath.push(rBase.add(new Vector3(0, 0.72, 0)));
    rightFenceTopPath.push(rBase.add(new Vector3(0, 2.35, 0)));
  }

  // =========================================================================
  // 1. Multi-Layer PBR Asphalt Road (No repeating start/finish line!)
  // =========================================================================
  const roadMesh = MeshBuilder.CreateRibbon(
    "babylonRoad",
    { pathArray: [leftRoadPath, rightRoadPath], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  roadMesh.parent = root;
  roadMesh.receiveShadows = true;

  const asphaltTexture = new DynamicTexture("asphaltTexture", { width: 1024, height: 1024 }, scene);
  const ctx = asphaltTexture.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    // Deep weathered tarmac base (slightly darker when wet)
    ctx.fillStyle = isWet ? "#16181c" : "#22252b";
    ctx.fillRect(0, 0, 1024, 1024);

    // Multi-scale aggregate speckles (seamless across V)
    for (let i = 0; i < 65000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const base = isWet ? 18 : 26;
      const gray = Math.floor(base + Math.random() * 34);
      const sz = Math.random() > 0.85 ? 2.2 : 1.3;
      ctx.fillStyle = `rgb(${gray},${gray},${gray + 2})`;
      ctx.fillRect(x, y, sz, sz);
    }

    // Rubbered-in racing grooves (subtle dark tire tracks, clean center crown)
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0.0, "rgba(12, 13, 16, 0.25)");
    grad.addColorStop(0.10, "rgba(28, 30, 35, 0.08)");
    grad.addColorStop(0.30, "rgba(7, 8, 10, 0.52)");
    grad.addColorStop(0.46, "rgba(24, 26, 30, 0.10)");
    grad.addColorStop(0.54, "rgba(24, 26, 30, 0.10)");
    grad.addColorStop(0.70, "rgba(7, 8, 10, 0.52)");
    grad.addColorStop(0.90, "rgba(28, 30, 35, 0.08)");
    grad.addColorStop(1.0, "rgba(12, 13, 16, 0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle longitudinal seam lines & weathered track edge lines (off-white so no bloom blowout)
    ctx.fillStyle = "rgba(14, 16, 20, 0.35)";
    ctx.fillRect(510, 0, 4, 1024);

    ctx.fillStyle = "#cfd6df";
    ctx.fillRect(18, 0, 20, 1024);
    ctx.fillRect(986, 0, 20, 1024);

    asphaltTexture.update();
    asphaltTexture.uScale = 1;
    asphaltTexture.vScale = 96;
  }
  asphaltTexture.anisotropicFilteringLevel = maxAnisotropy;

  // Coupled Height-Field Normal Map (Sobel filtered) + Roughness Texture
  const normSize = 512;
  const asphaltNormalTexture = new DynamicTexture("asphaltNormal", { width: normSize, height: normSize }, scene);
  const nCtx = asphaltNormalTexture.getContext() as CanvasRenderingContext2D;
  if (nCtx) {
    const heightField = new Float32Array(normSize * normSize);
    for (let y = 0; y < normSize; y++) {
      for (let x = 0; x < normSize; x++) {
        // Coarse + fine aggregate height
        const coarse = Math.sin(x * 0.11) * Math.cos(y * 0.11) * 0.25;
        heightField[y * normSize + x] = coarse + Math.random() * 0.75;
      }
    }
    const imgData = nCtx.createImageData(normSize, normSize);
    const d = imgData.data;
    const strength = 2.6;
    for (let y = 0; y < normSize; y++) {
      const yPrev = (y - 1 + normSize) % normSize;
      const yNext = (y + 1) % normSize;
      for (let x = 0; x < normSize; x++) {
        const xPrev = (x - 1 + normSize) % normSize;
        const xNext = (x + 1) % normSize;
        const dX = (heightField[y * normSize + xNext] - heightField[y * normSize + xPrev]) * strength;
        const dY = (heightField[yNext * normSize + x] - heightField[yPrev * normSize + x]) * strength;
        const invLen = 1 / Math.sqrt(dX * dX + dY * dY + 1);
        const idx = (y * normSize + x) * 4;
        d[idx] = Math.round(((-dX * invLen) * 0.5 + 0.5) * 255);
        d[idx + 1] = Math.round(((-dY * invLen) * 0.5 + 0.5) * 255);
        d[idx + 2] = Math.round(((invLen) * 0.5 + 0.5) * 255);
        d[idx + 3] = 255;
      }
    }
    nCtx.putImageData(imgData, 0, 0);
    asphaltNormalTexture.update();
    asphaltNormalTexture.uScale = 6;
    asphaltNormalTexture.vScale = 180;
  }
  asphaltNormalTexture.anisotropicFilteringLevel = maxAnisotropy;

  // Roughness map (G channel = roughness, B channel = metallic): rubbered grooves are smoother than shoulders
  const asphaltRoughTex = new DynamicTexture("asphaltRoughness", { width: 256, height: 256 }, scene);
  const rCtx = asphaltRoughTex.getContext() as CanvasRenderingContext2D;
  if (rCtx) {
    const rGrad = rCtx.createLinearGradient(0, 0, 256, 0);
    const grooveRough = isWet ? 38 : 132;
    const midRough = isWet ? 85 : 196;
    const edgeRough = isWet ? 128 : 228;
    rGrad.addColorStop(0.0, `rgb(0,${edgeRough},10)`);
    rGrad.addColorStop(0.30, `rgb(0,${grooveRough},18)`);
    rGrad.addColorStop(0.50, `rgb(0,${midRough},12)`);
    rGrad.addColorStop(0.70, `rgb(0,${grooveRough},18)`);
    rGrad.addColorStop(1.0, `rgb(0,${edgeRough},10)`);
    rCtx.fillStyle = rGrad;
    rCtx.fillRect(0, 0, 256, 256);
    asphaltRoughTex.update();
    asphaltRoughTex.uScale = 1;
    asphaltRoughTex.vScale = 24;
  }

  const roadMaterial = new PBRMaterial("pbrRoad", scene);
  roadMaterial.albedoTexture = asphaltTexture;
  roadMaterial.bumpTexture = asphaltNormalTexture;
  roadMaterial.bumpTexture.level = isWet ? 0.45 : 0.72;
  roadMaterial.metallicTexture = asphaltRoughTex;
  roadMaterial.useRoughnessFromMetallicTextureAlpha = false;
  roadMaterial.useRoughnessFromMetallicTextureGreen = true;
  roadMaterial.useMetallnessFromMetallicTextureBlue = true;
  roadMaterial.roughness = 1.0;
  roadMaterial.metallic = 1.0;

  if (isWet) {
    roadMaterial.clearCoat.isEnabled = true;
    roadMaterial.clearCoat.intensity = wetness * 0.92;
    roadMaterial.clearCoat.roughness = 0.08 + (1.0 - wetness) * 0.14;
  } else {
    roadMaterial.clearCoat.isEnabled = false;
  }
  roadMesh.material = roadMaterial;

  // =========================================================================
  // 1b. Dedicated Single Start/Finish Line & Starting Grid Boxes Decal Ribbon
  // =========================================================================
  const gridLeft: Vector3[] = [];
  const gridRight: Vector3[] = [];
  const gridSteps = 32;
  const gridStartU = 0.972;
  const gridEndU = 1.012;
  for (let i = 0; i <= gridSteps; i++) {
    const u = ((gridStartU + (i / gridSteps) * (gridEndU - gridStartU)) % 1 + 1) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tangent);
    Vector3.CrossToRef(tangent, up, side);
    side.normalize();
    gridLeft.push(pt.add(side.scale(halfW - 0.18)).add(new Vector3(0, 0.036, 0)));
    gridRight.push(pt.add(side.scale(-(halfW - 0.18))).add(new Vector3(0, 0.036, 0)));
  }

  const startGridMesh = MeshBuilder.CreateRibbon(
    "startGridDecal",
    { pathArray: [gridLeft, gridRight], closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  startGridMesh.parent = root;
  startGridMesh.receiveShadows = true;

  const gridTex = new DynamicTexture("startGridTex", { width: 512, height: 1024 }, scene, false);
  gridTex.hasAlpha = true;
  const gDecalCtx = gridTex.getContext() as CanvasRenderingContext2D;
  if (gDecalCtx) {
    gDecalCtx.clearRect(0, 0, 512, 1024);

    // Checkered Start/Finish Line near u=0 (approx 70% along this ribbon)
    const sfY = 720;
    const sq = 16;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 512 / sq; col++) {
        gDecalCtx.fillStyle = (row + col) % 2 === 0 ? "rgba(232,236,242,0.9)" : "rgba(15,18,24,0.88)";
        gDecalCtx.fillRect(col * sq, sfY + row * sq, sq, sq);
      }
    }
    // Red FIA Timing Line stripe
    gDecalCtx.fillStyle = "rgba(215, 25, 25, 0.9)";
    gDecalCtx.fillRect(0, sfY - 8, 512, 6);

    // Staggered Starting Grid Boxes (6 slots behind start line)
    gDecalCtx.strokeStyle = "rgba(235, 240, 246, 0.78)";
    gDecalCtx.lineWidth = 6;
    for (let slot = 0; slot < 6; slot++) {
      const isLeft = slot % 2 === 0;
      const boxX = isLeft ? 105 : 315;
      const boxY = sfY - 90 - slot * 95;
      gDecalCtx.beginPath();
      gDecalCtx.moveTo(boxX, boxY + 34);
      gDecalCtx.lineTo(boxX, boxY);
      gDecalCtx.lineTo(boxX + 92, boxY);
      gDecalCtx.lineTo(boxX + 92, boxY + 34);
      gDecalCtx.stroke();
    }
    gridTex.update();
  }
  gridTex.anisotropicFilteringLevel = maxAnisotropy;

  const gridMat = new PBRMaterial("startGridMat", scene);
  gridMat.albedoTexture = gridTex;
  gridMat.useAlphaFromAlbedoTexture = true;
  gridMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  gridMat.roughness = isWet ? 0.25 : 0.65;
  gridMat.metallic = 0.04;
  gridMat.zOffset = -2;
  startGridMesh.material = gridMat;

  // =========================================================================
  // 2. Beveled 3D Kerbs (No clearcoat blowout, receives shadows)
  // =========================================================================
  const leftKerbMesh = MeshBuilder.CreateRibbon(
    "leftKerb",
    { pathArray: [leftKerbInner, leftKerbMid, leftKerbOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftKerbMesh.parent = root;
  leftKerbMesh.receiveShadows = true;

  const rightKerbMesh = MeshBuilder.CreateRibbon(
    "rightKerb",
    { pathArray: [rightKerbInner, rightKerbMid, rightKerbOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightKerbMesh.parent = root;
  rightKerbMesh.receiveShadows = true;

  const kerbTex = new DynamicTexture("kerbTex", { width: 256, height: 128 }, scene);
  const kCtx = kerbTex.getContext() as CanvasRenderingContext2D;
  if (kCtx) {
    const stripeW = 32;
    for (let i = 0; i < 8; i++) {
      kCtx.fillStyle = i % 2 === 0 ? "#b91c1c" : "#d8dee6";
      kCtx.fillRect(i * stripeW, 0, stripeW, 128);
      // Subtle tire scuffing & joint shadows on kerb ribs
      kCtx.fillStyle = "rgba(15, 18, 22, 0.24)";
      kCtx.fillRect(i * stripeW, 0, 3, 128);
    }
    const kGrad = kCtx.createLinearGradient(0, 0, 0, 128);
    kGrad.addColorStop(0, "rgba(0,0,0,0.18)");
    kGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
    kGrad.addColorStop(1, "rgba(0,0,0,0.32)");
    kCtx.fillStyle = kGrad;
    kCtx.fillRect(0, 0, 256, 128);

    kerbTex.update();
    kerbTex.uScale = 1;
    kerbTex.vScale = 90;
  }
  kerbTex.anisotropicFilteringLevel = maxAnisotropy;

  const kerbMat = new PBRMaterial("kerbMat", scene);
  kerbMat.albedoTexture = kerbTex;
  kerbMat.roughness = isWet ? 0.35 : 0.68;
  kerbMat.metallic = 0.02;
  kerbMat.clearCoat.isEnabled = false;
  leftKerbMesh.material = kerbMat;
  rightKerbMesh.material = kerbMat;

  // =========================================================================
  // 3. Runoff Synthetic AstroTurf / Painted Apron (PBR, receives shadows)
  // =========================================================================
  const leftRunoffMesh = MeshBuilder.CreateRibbon(
    "leftRunoff",
    { pathArray: [leftRunoffInner, leftRunoffOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftRunoffMesh.parent = root;
  leftRunoffMesh.receiveShadows = true;

  const rightRunoffMesh = MeshBuilder.CreateRibbon(
    "rightRunoff",
    { pathArray: [rightRunoffInner, rightRunoffOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightRunoffMesh.parent = root;
  rightRunoffMesh.receiveShadows = true;

  const runoffTex = new DynamicTexture("runoffTex", { width: 256, height: 256 }, scene);
  const roCtx = runoffTex.getContext() as CanvasRenderingContext2D;
  if (roCtx) {
    roCtx.fillStyle = track.id === "monaco" ? "#2d333b" : "#183320";
    roCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      roCtx.fillStyle = track.id === "monaco"
        ? `rgba(75, 82, 92, ${0.15 + Math.random() * 0.2})`
        : `rgba(34, 72, 42, ${0.2 + Math.random() * 0.25})`;
      roCtx.fillRect(x, y, 2, 2);
    }
    runoffTex.update();
    runoffTex.uScale = 2;
    runoffTex.vScale = 120;
  }
  runoffTex.anisotropicFilteringLevel = maxAnisotropy;

  const runoffMat = new PBRMaterial("runoffPBR", scene);
  runoffMat.albedoTexture = runoffTex;
  runoffMat.roughness = isWet ? 0.55 : 0.90;
  runoffMat.metallic = 0.02;
  leftRunoffMesh.material = runoffMat;
  rightRunoffMesh.material = runoffMat;

  // =========================================================================
  // 4. Natural Earth Embankment Skirts & Ground Plane
  // =========================================================================
  const groundTex = new DynamicTexture("groundTex", { width: 512, height: 512 }, scene);
  const gCtx = groundTex.getContext() as CanvasRenderingContext2D;
  if (gCtx) {
    gCtx.fillStyle = track.groundColor;
    gCtx.fillRect(0, 0, 512, 512);

    const r = parseInt(track.groundColor.slice(1, 3), 16) || 40;
    const g = parseInt(track.groundColor.slice(3, 5), 16) || 70;
    const b = parseInt(track.groundColor.slice(5, 7), 16) || 45;
    for (let i = 0; i < 24000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const factor = 0.64 + Math.random() * 0.58;
      gCtx.fillStyle = `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
      gCtx.fillRect(x, y, 2.2, 2.6);
    }
    groundTex.update();
    groundTex.uScale = 90;
    groundTex.vScale = 90;
  }
  groundTex.anisotropicFilteringLevel = maxAnisotropy;

  const groundMat = new PBRMaterial("groundMat", scene);
  groundMat.albedoTexture = groundTex;
  groundMat.roughness = 0.96;
  groundMat.metallic = 0.0;

  const leftSkirtMesh = MeshBuilder.CreateRibbon(
    "leftSkirt",
    { pathArray: [leftRunoffOuter, leftSkirtOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftSkirtMesh.parent = root;
  leftSkirtMesh.material = groundMat;
  leftSkirtMesh.receiveShadows = true;

  const rightSkirtMesh = MeshBuilder.CreateRibbon(
    "rightSkirt",
    { pathArray: [rightRunoffOuter, rightSkirtOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightSkirtMesh.parent = root;
  rightSkirtMesh.material = groundMat;
  rightSkirtMesh.receiveShadows = true;

  // =========================================================================
  // 5. Corrugated W-Beam Armco Barriers (Galvanized steel, non-blooming)
  // =========================================================================
  const leftBarrier = MeshBuilder.CreateRibbon(
    "leftBarrier",
    {
      pathArray: [leftBarrierBottom, leftBarrierMidIn, leftBarrierTop],
      closeArray: false,
      closePath: true,
      sideOrientation: Mesh.DOUBLESIDE
    },
    scene
  );
  leftBarrier.parent = root;
  leftBarrier.receiveShadows = true;

  const rightBarrier = MeshBuilder.CreateRibbon(
    "rightBarrier",
    {
      pathArray: [rightBarrierBottom, rightBarrierMidIn, rightBarrierTop],
      closeArray: false,
      closePath: true,
      sideOrientation: Mesh.DOUBLESIDE
    },
    scene
  );
  rightBarrier.parent = root;
  rightBarrier.receiveShadows = true;

  const barrierMat = new PBRMaterial("barrierPBR", scene);
  barrierMat.albedoColor = new Color3(0.54, 0.57, 0.62);
  barrierMat.metallic = 0.68;
  barrierMat.roughness = 0.44;
  barrierMat.clearCoat.isEnabled = false;
  leftBarrier.material = barrierMat;
  rightBarrier.material = barrierMat;

  // =========================================================================
  // 6. Alpha-Tested FIA Chain-Link Catch Fencing
  // =========================================================================
  const fenceTex = new DynamicTexture("fenceMeshTex", { width: 128, height: 128 }, scene, false);
  fenceTex.hasAlpha = true;
  const fCtx = fenceTex.getContext() as CanvasRenderingContext2D;
  if (fCtx) {
    fCtx.clearRect(0, 0, 128, 128);
    fCtx.strokeStyle = "rgba(155, 165, 178, 0.85)";
    fCtx.lineWidth = 4;
    for (let offset = -128; offset <= 256; offset += 24) {
      fCtx.beginPath();
      fCtx.moveTo(offset, 0);
      fCtx.lineTo(offset + 128, 128);
      fCtx.stroke();

      fCtx.beginPath();
      fCtx.moveTo(offset, 128);
      fCtx.lineTo(offset + 128, 0);
      fCtx.stroke();
    }
    // Top and bottom tension cables
    fCtx.fillStyle = "rgba(180, 188, 198, 0.9)";
    fCtx.fillRect(0, 0, 128, 5);
    fCtx.fillRect(0, 123, 128, 5);
    fenceTex.update();
    fenceTex.uScale = 180;
    fenceTex.vScale = 2;
  }

  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseTexture = fenceTex;
  fenceMat.useAlphaFromDiffuseTexture = true;
  fenceMat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
  fenceMat.alphaCutOff = 0.35;
  fenceMat.backFaceCulling = false;
  fenceMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const leftFence = MeshBuilder.CreateRibbon(
    "leftFence",
    { pathArray: [leftFenceBottomPath, leftFenceTopPath], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftFence.parent = root;
  leftFence.material = fenceMat;

  const rightFence = MeshBuilder.CreateRibbon(
    "rightFence",
    { pathArray: [rightFenceBottomPath, rightFenceTopPath], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightFence.parent = root;
  rightFence.material = fenceMat;

  // =========================================================================
  // 7. Surrounding Ground Terrain
  // =========================================================================
  const ground = MeshBuilder.CreateGround("ground", { width: 2800, height: 2800 }, scene);
  ground.parent = root;
  ground.position.y = groundFloorY;
  ground.receiveShadows = true;
  ground.material = groundMat;

  // =========================================================================
  // 8. Instanced Trackside Furniture, Gantry Lights & Circuit Landmarks
  // =========================================================================
  const props = createTracksideProps(track, spline, scene, root, barrierOffset, {
    propDensity: options.propDensity,
    isNight: options.isNight,
    isWet
  });

  return { root, props };
}
