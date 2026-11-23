// Formula Racing 3D — Babylon.js Track & Infrastructure Generator
// Synchronized with Spline3D and VehiclePhysics with high-fidelity PBR environment
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

export function createBabylonTrack(track: Track, spline: Spline3D, scene: Scene) {
  const root = new TransformNode("trackRoot", scene);
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
  const leftKerbOuter: Vector3[] = [];
  const rightKerbInner: Vector3[] = [];
  const rightKerbOuter: Vector3[] = [];

  const leftRunoffInner: Vector3[] = [];
  const leftRunoffOuter: Vector3[] = [];
  const rightRunoffInner: Vector3[] = [];
  const rightRunoffOuter: Vector3[] = [];

  const leftSkirtOuter: Vector3[] = [];
  const rightSkirtOuter: Vector3[] = [];

  const leftBarrierPath: Vector3[] = [];
  const rightBarrierPath: Vector3[] = [];

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
    const lRoad = pt.add(bankedSide.scale(halfW)).add(new Vector3(0, 0.03, 0));
    const rRoad = pt.add(bankedSide.scale(-halfW)).add(new Vector3(0, 0.03, 0));
    leftRoadPath.push(lRoad);
    rightRoadPath.push(rRoad);

    // 2. 3D Kerbs (distinct elevation: inner 0.034m, outer 0.068m)
    const lKerbIn = pt.add(bankedSide.scale(halfW)).add(new Vector3(0, 0.034, 0));
    const rKerbIn = pt.add(bankedSide.scale(-halfW)).add(new Vector3(0, 0.034, 0));
    const lKerbOut = pt.add(bankedSide.scale(halfW + kerbW)).add(new Vector3(0, 0.068, 0));
    const rKerbOut = pt.add(bankedSide.scale(-(halfW + kerbW))).add(new Vector3(0, 0.068, 0));
    leftKerbInner.push(lKerbIn);
    leftKerbOuter.push(lKerbOut);
    rightKerbInner.push(rKerbIn);
    rightKerbOuter.push(rKerbOut);

    // 3. AstroTurf Runoffs (inner 0.04m, outer 0.025m sloping gently outward)
    const lRunoffIn = pt.add(bankedSide.scale(halfW + kerbW)).add(new Vector3(0, 0.04, 0));
    const rRunoffIn = pt.add(bankedSide.scale(-(halfW + kerbW))).add(new Vector3(0, 0.04, 0));
    const lRunoffOut = pt.add(bankedSide.scale(barrierOffset)).add(new Vector3(0, 0.025, 0));
    const rRunoffOut = pt.add(bankedSide.scale(-barrierOffset)).add(new Vector3(0, 0.025, 0));
    leftRunoffInner.push(lRunoffIn);
    leftRunoffOuter.push(lRunoffOut);
    rightRunoffInner.push(rRunoffIn);
    rightRunoffOuter.push(rRunoffOut);

    // 4. Grass Embankment Skirts (anchoring track to surrounding terrain)
    const lSkirtOut = pt.add(bankedSide.scale(barrierOffset + 14.0)).add(new Vector3(0, -3.8, 0));
    const rSkirtOut = pt.add(bankedSide.scale(-(barrierOffset + 14.0))).add(new Vector3(0, -3.8, 0));
    leftSkirtOuter.push(lSkirtOut);
    rightSkirtOuter.push(rSkirtOut);

    // 5. Armco Barriers (calibrated height 0.42m above surface)
    const lBarrier = pt.add(bankedSide.scale(barrierOffset)).add(new Vector3(0, 0.42, 0));
    const rBarrier = pt.add(bankedSide.scale(-barrierOffset)).add(new Vector3(0, 0.42, 0));
    leftBarrierPath.push(lBarrier);
    rightBarrierPath.push(rBarrier);

    // 6. FIA Catch Fence paths (above Armco from 0.42m to 2.1m)
    leftFenceBottomPath.push(lBarrier);
    leftFenceTopPath.push(lBarrier.add(new Vector3(0, 1.68, 0)));
    rightFenceBottomPath.push(rBarrier);
    rightFenceTopPath.push(rBarrier.add(new Vector3(0, 1.68, 0)));
  }

  // 1. Procedural PBR Asphalt Road with seamless closed loop
  const roadMesh = MeshBuilder.CreateRibbon(
    "babylonRoad",
    { pathArray: [leftRoadPath, rightRoadPath], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  roadMesh.parent = root;
  roadMesh.receiveShadows = true;

  // High-fidelity Procedural Asphalt Texture with Grid Slots and Rubbering
  const asphaltTexture = new DynamicTexture("asphaltTexture", { width: 1024, height: 1024 }, scene);
  const ctx = asphaltTexture.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    // Rich asphalt base color
    ctx.fillStyle = "#1b1d21";
    ctx.fillRect(0, 0, 1024, 1024);

    // High frequency aggregate stone speckles
    for (let i = 0; i < 48000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const gray = Math.floor(22 + Math.random() * 42);
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, 1.8, 1.8);
    }

    // Rubbered racing grooves
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, "rgba(16, 18, 20, 0.15)");
    grad.addColorStop(0.32, "rgba(8, 9, 11, 0.72)"); // Left tire groove
    grad.addColorStop(0.48, "rgba(22, 24, 28, 0.2)");
    grad.addColorStop(0.68, "rgba(8, 9, 11, 0.72)"); // Right tire groove
    grad.addColorStop(1, "rgba(16, 18, 20, 0.15)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Crisp white track boundary lines
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(20, 0, 24, 1024);
    ctx.fillRect(980, 0, 24, 1024);

    // Start / Finish checkered line in texture repeat
    ctx.fillStyle = "#ffffff";
    const checkSize = 32;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 1024 / checkSize; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(col * checkSize, row * checkSize + 2, checkSize, checkSize);
        }
      }
    }

    // Grid boxes on starting straight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 4;
    ctx.strokeRect(180, 120, 220, 140);
    ctx.strokeRect(624, 280, 220, 140);

    asphaltTexture.update();
    asphaltTexture.uScale = 1;
    asphaltTexture.vScale = 85;
  }

  const roadMaterial = new PBRMaterial("pbrRoad", scene);
  roadMaterial.albedoTexture = asphaltTexture;
  roadMaterial.roughness = 0.88;
  roadMaterial.metallic = 0.08;
  roadMesh.material = roadMaterial;

  // 2. 3D Kerbs with Alternating Red/White Stripes
  const leftKerbMesh = MeshBuilder.CreateRibbon(
    "leftKerb",
    { pathArray: [leftKerbInner, leftKerbOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftKerbMesh.parent = root;
  const rightKerbMesh = MeshBuilder.CreateRibbon(
    "rightKerb",
    { pathArray: [rightKerbInner, rightKerbOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightKerbMesh.parent = root;

  // Procedural Kerb Stripe Texture (red/white alternating diagonal stripes)
  const kerbTex = new DynamicTexture("kerbTex", { width: 256, height: 128 }, scene);
  const kCtx = kerbTex.getContext() as CanvasRenderingContext2D;
  if (kCtx) {
    const stripeW = 32;
    for (let i = 0; i < 8; i++) {
      kCtx.fillStyle = i % 2 === 0 ? "#dc2626" : "#f8fafc";
      kCtx.fillRect(i * stripeW, 0, stripeW, 128);
    }
    // Kerb bevel edge shading
    const kGrad = kCtx.createLinearGradient(0, 0, 0, 128);
    kGrad.addColorStop(0, "rgba(255,255,255,0.2)");
    kGrad.addColorStop(0.8, "rgba(0,0,0,0.0)");
    kGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    kCtx.fillStyle = kGrad;
    kCtx.fillRect(0, 0, 256, 128);

    kerbTex.update();
    kerbTex.uScale = 1;
    kerbTex.vScale = 90;
  }

  const kerbMat = new PBRMaterial("kerbMat", scene);
  kerbMat.albedoTexture = kerbTex;
  kerbMat.roughness = 0.68;
  kerbMat.metallic = 0.05;
  leftKerbMesh.material = kerbMat;
  rightKerbMesh.material = kerbMat;

  // 3. Runoff Synthetic AstroTurf
  const leftRunoffMesh = MeshBuilder.CreateRibbon(
    "leftRunoff",
    { pathArray: [leftRunoffInner, leftRunoffOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftRunoffMesh.parent = root;
  const rightRunoffMesh = MeshBuilder.CreateRibbon(
    "rightRunoff",
    { pathArray: [rightRunoffInner, rightRunoffOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightRunoffMesh.parent = root;

  const runoffMat = new StandardMaterial("runoffMat", scene);
  runoffMat.diffuseColor = new Color3(0.09, 0.2, 0.11);
  runoffMat.roughness = 0.9;
  leftRunoffMesh.material = runoffMat;
  rightRunoffMesh.material = runoffMat;

  // 4. Natural Earth Embankment Skirts
  const groundTex = new DynamicTexture("groundTex", { width: 512, height: 512 }, scene);
  const gCtx = groundTex.getContext() as CanvasRenderingContext2D;
  if (gCtx) {
    gCtx.fillStyle = track.groundColor;
    gCtx.fillRect(0, 0, 512, 512);

    const r = parseInt(track.groundColor.slice(1, 3), 16) || 40;
    const g = parseInt(track.groundColor.slice(3, 5), 16) || 70;
    const b = parseInt(track.groundColor.slice(5, 7), 16) || 45;
    for (let i = 0; i < 20000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const factor = 0.68 + Math.random() * 0.55;
      gCtx.fillStyle = `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
      gCtx.fillRect(x, y, 2.0, 2.5);
    }
    groundTex.update();
    groundTex.uScale = 90;
    groundTex.vScale = 90;
  }

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

  const rightSkirtMesh = MeshBuilder.CreateRibbon(
    "rightSkirt",
    { pathArray: [rightRunoffOuter, rightSkirtOuter], closeArray: false, closePath: true, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightSkirtMesh.parent = root;
  rightSkirtMesh.material = groundMat;

  // 5. Armco Barriers (calibrated radius 0.16m for sleek F1 guardrail)
  const leftBarrier = MeshBuilder.CreateTube(
    "leftBarrier",
    { path: leftBarrierPath, radius: 0.16, tessellation: 8, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftBarrier.parent = root;
  const rightBarrier = MeshBuilder.CreateTube(
    "rightBarrier",
    { path: rightBarrierPath, radius: 0.16, tessellation: 8, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightBarrier.parent = root;

  const barrierMat = new PBRMaterial("barrierPBR", scene);
  barrierMat.albedoColor = new Color3(0.88, 0.9, 0.94);
  barrierMat.metallic = 0.85;
  barrierMat.roughness = 0.28;
  leftBarrier.material = barrierMat;
  rightBarrier.material = barrierMat;

  // 6. FIA Catch Fencing above Armco
  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseColor = new Color3(0.3, 0.35, 0.4);
  fenceMat.alpha = 0.35;
  fenceMat.backFaceCulling = false;

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

  // 7. Track-side Marshal Posts along barriers
  const postSpacing = Math.floor(segments / 32);
  for (let i = 0; i < segments; i += postSpacing) {
    const lPos = leftBarrierPath[i];
    const rPos = rightBarrierPath[i];

    if (lPos) {
      const lPost = MeshBuilder.CreateCylinder(`lPost_${i}`, {
        diameter: 0.14,
        height: 2.2,
        tessellation: 6
      }, scene);
      lPost.parent = root;
      lPost.position = new Vector3(lPos.x, lPos.y + 0.6, lPos.z);
      lPost.material = barrierMat;
    }
    if (rPos) {
      const rPost = MeshBuilder.CreateCylinder(`rPost_${i}`, {
        diameter: 0.14,
        height: 2.2,
        tessellation: 6
      }, scene);
      rPost.parent = root;
      rPost.position = new Vector3(rPos.x, rPos.y + 0.6, rPos.z);
      rPost.material = barrierMat;
    }
  }

  // 8. Brake Distance Marker Boards (150m, 100m, 50m) preceding corner apexes
  const brakeMat = new StandardMaterial("brakeBoardMat", scene);
  brakeMat.diffuseColor = new Color3(0.95, 0.95, 0.95);
  brakeMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const markerTex150 = new DynamicTexture("m150", { width: 128, height: 64 }, scene);
  const mCtx150 = markerTex150.getContext() as CanvasRenderingContext2D;
  if (mCtx150) {
    mCtx150.fillStyle = "#ffffff";
    mCtx150.fillRect(0, 0, 128, 64);
    mCtx150.fillStyle = "#000000";
    mCtx150.font = "bold 44px sans-serif";
    mCtx150.textAlign = "center";
    mCtx150.textBaseline = "middle";
    mCtx150.fillText("150", 64, 32);
    markerTex150.update();
  }
  const mMat150 = new StandardMaterial("mMat150", scene);
  mMat150.diffuseTexture = markerTex150;

  const markerTex100 = new DynamicTexture("m100", { width: 128, height: 64 }, scene);
  const mCtx100 = markerTex100.getContext() as CanvasRenderingContext2D;
  if (mCtx100) {
    mCtx100.fillStyle = "#ffffff";
    mCtx100.fillRect(0, 0, 128, 64);
    mCtx100.fillStyle = "#000000";
    mCtx100.font = "bold 44px sans-serif";
    mCtx100.textAlign = "center";
    mCtx100.textBaseline = "middle";
    mCtx100.fillText("100", 64, 32);
    markerTex100.update();
  }
  const mMat100 = new StandardMaterial("mMat100", scene);
  mMat100.diffuseTexture = markerTex100;

  const markerTex50 = new DynamicTexture("m50", { width: 128, height: 64 }, scene);
  const mCtx50 = markerTex50.getContext() as CanvasRenderingContext2D;
  if (mCtx50) {
    mCtx50.fillStyle = "#ffffff";
    mCtx50.fillRect(0, 0, 128, 64);
    mCtx50.fillStyle = "#dc2626";
    mCtx50.font = "bold 44px sans-serif";
    mCtx50.textAlign = "center";
    mCtx50.textBaseline = "middle";
    mCtx50.fillText("50", 64, 32);
    markerTex50.update();
  }
  const mMat50 = new StandardMaterial("mMat50", scene);
  mMat50.diffuseTexture = markerTex50;

  // Place brake marker clusters at key points along track
  const brakeIndices = [
    { idx: Math.floor(segments * 0.08), mat: mMat150 },
    { idx: Math.floor(segments * 0.09), mat: mMat100 },
    { idx: Math.floor(segments * 0.10), mat: mMat50 },
    { idx: Math.floor(segments * 0.38), mat: mMat150 },
    { idx: Math.floor(segments * 0.39), mat: mMat100 },
    { idx: Math.floor(segments * 0.40), mat: mMat50 },
    { idx: Math.floor(segments * 0.72), mat: mMat150 },
    { idx: Math.floor(segments * 0.73), mat: mMat100 },
    { idx: Math.floor(segments * 0.74), mat: mMat50 }
  ];

  for (const b of brakeIndices) {
    const pos = leftBarrierPath[b.idx];
    if (pos) {
      const board = MeshBuilder.CreatePlane(`brakeBoard_${b.idx}`, { width: 1.4, height: 0.8 }, scene);
      board.parent = root;
      board.position = new Vector3(pos.x, pos.y + 0.9, pos.z);
      board.material = b.mat;
    }
  }

  // 9. Start / Finish Overhead Gantry Structure
  const gantryPos = spline.getPointAt(0.005);
  const gantryTan = spline.getTangentAt(0.005);
  const gantrySide = Vector3.Cross(gantryTan, new Vector3(0, 1, 0)).normalize();

  const gantryBar = MeshBuilder.CreateBox("gantryCrossbar", {
    width: track.width + 5.0,
    height: 0.8,
    depth: 0.6
  }, scene);
  gantryBar.parent = root;
  gantryBar.position = new Vector3(gantryPos.x, gantryPos.y + 5.5, gantryPos.z);
  gantryBar.material = barrierMat;

  const leftPillar = MeshBuilder.CreateCylinder("gantryLeftPillar", { diameter: 0.35, height: 6.0 }, scene);
  leftPillar.parent = root;
  const lGantryPt = gantryPos.add(gantrySide.scale(halfW + 2.2));
  leftPillar.position = new Vector3(lGantryPt.x, gantryPos.y + 2.8, lGantryPt.z);
  leftPillar.material = barrierMat;

  const rightPillar = MeshBuilder.CreateCylinder("gantryRightPillar", { diameter: 0.35, height: 6.0 }, scene);
  rightPillar.parent = root;
  const rGantryPt = gantryPos.add(gantrySide.scale(-(halfW + 2.2)));
  rightPillar.position = new Vector3(rGantryPt.x, gantryPos.y + 2.8, rGantryPt.z);
  rightPillar.material = barrierMat;

  // 10. Surrounding Ground Terrain (placed safely at groundFloorY below all tracks)
  const ground = MeshBuilder.CreateGround("ground", { width: 2600, height: 2600 }, scene);
  ground.parent = root;
  ground.position.y = groundFloorY;
  ground.receiveShadows = true;
  ground.material = groundMat;

  return root;
}

export function createProceduralSkybox(scene: Scene, skyColorHex: string): Mesh {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 1200 }, scene);
  skybox.infiniteDistance = true;

  const skyMat = new StandardMaterial("skyBoxMat", scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;

  const skyTex = new DynamicTexture("skyTex", { width: 32, height: 512 }, scene);
  const ctx = skyTex.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    const r = parseInt(skyColorHex.slice(1, 3), 16) || 140;
    const g = parseInt(skyColorHex.slice(3, 5), 16) || 180;
    const b = parseInt(skyColorHex.slice(5, 7), 16) || 220;

    const zenith = `rgb(${Math.max(15, Math.floor(r * 0.45))},${Math.max(25, Math.floor(g * 0.55))},${Math.max(50, Math.floor(b * 0.78))})`;
    const midSky = `rgb(${r},${g},${b})`;
    const haze = "rgb(242, 246, 252)";
    const groundFog = "rgb(205, 218, 230)";

    grad.addColorStop(0.0, zenith);
    grad.addColorStop(0.42, midSky);
    grad.addColorStop(0.72, haze);
    grad.addColorStop(0.85, "rgb(255, 252, 245)"); // Sunlit horizon
    grad.addColorStop(1.0, groundFog);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 512);

    // Subtle atmospheric cloud strata
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(0, 180, 32, 35);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(0, 240, 32, 25);

    skyTex.update();
  }

  skyMat.emissiveTexture = skyTex;
  skyMat.diffuseColor = new Color3(0, 0, 0);
  skyMat.specularColor = new Color3(0, 0, 0);
  skybox.material = skyMat;

  return skybox;
}
