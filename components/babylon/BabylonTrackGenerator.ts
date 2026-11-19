// Formula Racing 3D — Babylon.js Track & Infrastructure Generator
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

export function createBabylonTrack(track: Track, curvePoints: [number, number, number][], scene: Scene) {
  const root = new TransformNode("trackRoot", scene);
  const segments = 520;
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
  const numPoints = curvePoints.length;

  // Helper to interpolate points
  const getPointAt = (t: number): Vector3 => {
    const rawIdx = t * (numPoints - 1);
    const i = Math.floor(rawIdx);
    const frac = rawIdx - i;
    const p1 = curvePoints[i % numPoints];
    const p2 = curvePoints[(i + 1) % numPoints];
    const scale = 4.8;
    return new Vector3(
      (p1[0] + (p2[0] - p1[0]) * frac) * scale,
      (p1[1] + (p2[1] - p1[1]) * frac) * scale * 0.8,
      (p1[2] + (p2[2] - p1[2]) * frac) * scale
    );
  };

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = getPointAt(t);
    const nextPt = getPointAt((t + 0.005) % 1.0);
    const tangent = nextPt.subtract(pt).normalize();

    // Tangent derivative curvature for authentic banking
    const nextTan = getPointAt((t + 0.01) % 1.0).subtract(nextPt).normalize();
    const deltaTan = nextTan.subtract(tangent);
    const curvSign = (tangent.z * deltaTan.x - tangent.x * deltaTan.z) * 14.0;
    const bankingAngle = Math.max(-0.14, Math.min(0.14, curvSign));

    const side = Vector3.Cross(tangent, up).normalize();
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

  // 2. 3D Kerbs
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

  const kerbMat = new StandardMaterial("kerbMat", scene);
  kerbMat.diffuseColor = new Color3(0.94, 0.12, 0.14); // Safety red
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

  // 5. Surrounding Ground Terrain
  const ground = MeshBuilder.CreateGround("ground", { width: 1400, height: 1400 }, scene);
  ground.parent = root;
  ground.position.y = -0.35;
  ground.receiveShadows = true;

  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = Color3.FromHexString(track.groundColor);
  ground.material = groundMat;

  return root;
}
