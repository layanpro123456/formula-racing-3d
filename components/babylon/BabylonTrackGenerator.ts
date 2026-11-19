// Formula Racing 3D — Babylon.js Track & Infrastructure Generator
// Mathematically synchronized with Spline3D and VehiclePhysics
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

  // Path arrays for CreateRibbon
  const leftRoadPath: Vector3[] = [];
  const rightRoadPath: Vector3[] = [];

  const leftKerbInner: Vector3[] = [];
  const leftKerbOuter: Vector3[] = [];

  const rightKerbInner: Vector3[] = [];
  const rightKerbOuter: Vector3[] = [];

  const leftRunoffOuter: Vector3[] = [];
  const rightRunoffOuter: Vector3[] = [];

  const leftBarrierPath: Vector3[] = [];
  const rightBarrierPath: Vector3[] = [];

  const up = new Vector3(0, 1, 0);
  const pt = new Vector3();
  const tangent = new Vector3();
  const nextTan = new Vector3();
  const cross = new Vector3();
  const side = new Vector3();

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tangent);

    // Tangent derivative curvature for authentic banking
    const nextU = (u + 0.005) % 1.0;
    spline.getTangentAtToRef(nextU, nextTan);
    Vector3.CrossToRef(tangent, nextTan, cross);
    const curvSign = cross.y * 22.0;
    const bankingAngle = Math.max(-0.12, Math.min(0.12, curvSign));

    Vector3.CrossToRef(tangent, up, side);
    side.normalize();
    const bankAxis = up.add(side.scale(-bankingAngle)).normalize();
    const bankedSide = Vector3.Cross(tangent, bankAxis).normalize();

    // Road edges
    const lRoad = pt.add(bankedSide.scale(halfW));
    const rRoad = pt.add(bankedSide.scale(-halfW));
    leftRoadPath.push(lRoad.add(new Vector3(0, 0.02, 0)));
    rightRoadPath.push(rRoad.add(new Vector3(0, 0.02, 0)));

    // 3D Kerbs
    const lKerbOut = lRoad.add(bankedSide.scale(kerbW)).add(new Vector3(0, 0.08, 0));
    const rKerbOut = rRoad.add(bankedSide.scale(-kerbW)).add(new Vector3(0, 0.08, 0));
    leftKerbInner.push(lRoad.add(new Vector3(0, 0.02, 0)));
    leftKerbOuter.push(lKerbOut);
    rightKerbInner.push(rRoad.add(new Vector3(0, 0.02, 0)));
    rightKerbOuter.push(rKerbOut);

    // Runoffs
    leftRunoffOuter.push(lKerbOut.add(bankedSide.scale(runoffW)));
    rightRunoffOuter.push(rKerbOut.add(bankedSide.scale(-runoffW)));

    // Barriers
    leftBarrierPath.push(pt.add(bankedSide.scale(barrierOffset)).add(new Vector3(0, 0.52, 0)));
    rightBarrierPath.push(pt.add(bankedSide.scale(-barrierOffset)).add(new Vector3(0, 0.52, 0)));
  }

  // 1. Procedural PBR Asphalt Road
  const roadMesh = MeshBuilder.CreateRibbon(
    "babylonRoad",
    { pathArray: [leftRoadPath, rightRoadPath], sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  roadMesh.parent = root;
  roadMesh.receiveShadows = true;

  // Procedural Canvas Asphalt Texture
  const asphaltTexture = new DynamicTexture("asphaltTexture", { width: 512, height: 512 }, scene);
  const ctx = asphaltTexture.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    ctx.fillStyle = "#1e2023";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 24000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const gray = Math.floor(25 + Math.random() * 35);
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, "rgba(20, 22, 25, 0.1)");
    grad.addColorStop(0.35, "rgba(10, 11, 13, 0.7)"); // Dark rubber racing line
    grad.addColorStop(0.5, "rgba(22, 24, 28, 0.2)");
    grad.addColorStop(0.65, "rgba(10, 11, 13, 0.7)");
    grad.addColorStop(1, "rgba(20, 22, 25, 0.1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // White edge lines
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(10, 0, 14, 512);
    ctx.fillRect(488, 0, 14, 512);
    asphaltTexture.update();
    asphaltTexture.uScale = 1;
    asphaltTexture.vScale = 75;
  }

  const roadMaterial = new PBRMaterial("pbrRoad", scene);
  roadMaterial.albedoTexture = asphaltTexture;
  roadMaterial.roughness = 0.85;
  roadMaterial.metallic = 0.1;
  roadMesh.material = roadMaterial;

  // 2. 3D Kerbs with Alternating Red/White Stripes
  const leftKerbMesh = MeshBuilder.CreateRibbon(
    "leftKerb",
    { pathArray: [leftKerbInner, leftKerbOuter], sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftKerbMesh.parent = root;
  const rightKerbMesh = MeshBuilder.CreateRibbon(
    "rightKerb",
    { pathArray: [rightKerbInner, rightKerbOuter], sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightKerbMesh.parent = root;

  // Procedural Kerb Stripe Texture (red/white alternating diagonal stripes)
  const kerbTex = new DynamicTexture("kerbTex", { width: 128, height: 64 }, scene);
  const kCtx = kerbTex.getContext() as CanvasRenderingContext2D;
  if (kCtx) {
    const stripeW = 16;
    for (let i = 0; i < 8; i++) {
      kCtx.fillStyle = i % 2 === 0 ? "#e10600" : "#ffffff";
      kCtx.fillRect(i * stripeW, 0, stripeW, 64);
    }
    kerbTex.update();
    kerbTex.uScale = 1;
    kerbTex.vScale = 80;
  }

  const kerbMat = new PBRMaterial("kerbMat", scene);
  kerbMat.albedoTexture = kerbTex;
  kerbMat.roughness = 0.72;
  kerbMat.metallic = 0.05;
  leftKerbMesh.material = kerbMat;
  rightKerbMesh.material = kerbMat;

  // 3. Runoff Synthetic AstroTurf
  const leftRunoffMesh = MeshBuilder.CreateRibbon(
    "leftRunoff",
    { pathArray: [leftKerbOuter, leftRunoffOuter], sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftRunoffMesh.parent = root;
  const rightRunoffMesh = MeshBuilder.CreateRibbon(
    "rightRunoff",
    { pathArray: [rightKerbOuter, rightRunoffOuter], sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightRunoffMesh.parent = root;

  const runoffMat = new StandardMaterial("runoffMat", scene);
  runoffMat.diffuseColor = new Color3(0.11, 0.22, 0.13);
  leftRunoffMesh.material = runoffMat;
  rightRunoffMesh.material = runoffMat;

  // 4. Armco Barriers
  const leftBarrier = MeshBuilder.CreateTube(
    "leftBarrier",
    { path: leftBarrierPath, radius: 0.24, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  leftBarrier.parent = root;
  const rightBarrier = MeshBuilder.CreateTube(
    "rightBarrier",
    { path: rightBarrierPath, radius: 0.24, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  rightBarrier.parent = root;

  const barrierMat = new PBRMaterial("barrierPBR", scene);
  barrierMat.albedoColor = new Color3(0.85, 0.88, 0.92);
  barrierMat.metallic = 0.8;
  barrierMat.roughness = 0.35;
  leftBarrier.material = barrierMat;
  rightBarrier.material = barrierMat;

  // 5. Track-side Marshal Posts along barriers
  const postSpacing = Math.floor(segments / 24);
  for (let i = 0; i < segments; i += postSpacing) {
    const lPos = leftBarrierPath[i];
    const rPos = rightBarrierPath[i];

    if (lPos) {
      const lPost = MeshBuilder.CreateCylinder(`lPost_${i}`, {
        diameter: 0.16,
        height: 2.2,
        tessellation: 6
      }, scene);
      lPost.parent = root;
      lPost.position = new Vector3(lPos.x, lPos.y + 0.6, lPos.z);
      lPost.material = barrierMat;
    }
    if (rPos) {
      const rPost = MeshBuilder.CreateCylinder(`rPost_${i}`, {
        diameter: 0.16,
        height: 2.2,
        tessellation: 6
      }, scene);
      rPost.parent = root;
      rPost.position = new Vector3(rPos.x, rPos.y + 0.6, rPos.z);
      rPost.material = barrierMat;
    }
  }

  // 6. Surrounding Ground Terrain with Procedural Grass Texture
  const ground = MeshBuilder.CreateGround("ground", { width: 1800, height: 1800 }, scene);
  ground.parent = root;
  ground.position.y = -0.35;
  ground.receiveShadows = true;

  const groundTex = new DynamicTexture("groundTex", { width: 512, height: 512 }, scene);
  const gCtx = groundTex.getContext() as CanvasRenderingContext2D;
  if (gCtx) {
    gCtx.fillStyle = track.groundColor;
    gCtx.fillRect(0, 0, 512, 512);

    const r = parseInt(track.groundColor.slice(1, 3), 16) || 40;
    const g = parseInt(track.groundColor.slice(3, 5), 16) || 70;
    const b = parseInt(track.groundColor.slice(5, 7), 16) || 45;
    for (let i = 0; i < 16000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const factor = 0.7 + Math.random() * 0.55;
      gCtx.fillStyle = `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
      gCtx.fillRect(x, y, 1.5, 2.5);
    }
    groundTex.update();
    groundTex.uScale = 90;
    groundTex.vScale = 90;
  }

  const groundMat = new PBRMaterial("groundMat", scene);
  groundMat.albedoTexture = groundTex;
  groundMat.roughness = 0.95;
  groundMat.metallic = 0.0;
  ground.material = groundMat;

  return root;
}

export function createProceduralSkybox(scene: Scene, skyColorHex: string): Mesh {
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
  skybox.infiniteDistance = true;

  const skyMat = new StandardMaterial("skyBoxMat", scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;

  const skyTex = new DynamicTexture("skyTex", { width: 16, height: 256 }, scene);
  const ctx = skyTex.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    const r = parseInt(skyColorHex.slice(1, 3), 16) || 140;
    const g = parseInt(skyColorHex.slice(3, 5), 16) || 180;
    const b = parseInt(skyColorHex.slice(5, 7), 16) || 220;

    const deep = `rgb(${Math.floor(r * 0.7)},${Math.floor(g * 0.75)},${Math.floor(b * 0.9)})`;
    const mid = `rgb(${r},${g},${b})`;
    const horizon = "rgb(238, 242, 246)";

    grad.addColorStop(0.0, deep);
    grad.addColorStop(0.45, mid);
    grad.addColorStop(0.78, horizon);
    grad.addColorStop(1.0, "rgb(215, 225, 235)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    skyTex.update();
  }

  skyMat.emissiveTexture = skyTex;
  skyMat.diffuseColor = new Color3(0, 0, 0);
  skyMat.specularColor = new Color3(0, 0, 0);
  skybox.material = skyMat;

  return skybox;
}
