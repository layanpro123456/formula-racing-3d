// Formula Racing 3D — Circuit-Specific Landmarks, Architecture, Gravel Traps & Regional Biomes
import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  Matrix,
  Quaternion,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  Mesh,
  TransformNode
} from "@babylonjs/core";
import { Track } from "@/data/tracks";
import { Spline3D } from "@/lib/math/Spline3D";

export interface CircuitLandmarkContext {
  density: number;
  isNight: boolean;
  isWet: boolean;
  barrierOffset: number;
  maxAnisotropy: number;
  concreteMat: PBRMaterial;
  darkMetalMat: PBRMaterial;
  standRoofMat: PBRMaterial;
}

const UP = new Vector3(0, 1, 0);

function makeMatrix(pos: Vector3, yaw: number, sx = 1, sy = 1, sz = 1): Matrix {
  return Matrix.Compose(new Vector3(sx, sy, sz), Quaternion.RotationAxis(UP, yaw), pos);
}

function isClearOfTrack(spline: Spline3D, pos: Vector3, minClearSq: number): boolean {
  const samples = spline.samples;
  for (let s = 0; s < samples.length; s += 8) {
    const sp = samples[s].point;
    const dx = pos.x - sp.x;
    const dz = pos.z - sp.z;
    if (dx * dx + dz * dz < minClearSq) return false;
  }
  return true;
}

function createGravelMaterial(scene: Scene, isWet: boolean): PBRMaterial {
  const tex = new DynamicTexture("gravelTrapTex", { width: 256, height: 256 }, scene);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    ctx.fillStyle = isWet ? "#7d684c" : "#a88f6a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = isWet ? 95 : 135;
      const v = Math.floor(shade + (Math.random() - 0.5) * 55);
      ctx.fillStyle = `rgb(${v},${Math.round(v * 0.86)},${Math.round(v * 0.65)})`;
      ctx.fillRect(x, y, 2.2, 2.2);
    }
    // Classic combed gravel lines
    ctx.fillStyle = "rgba(55, 42, 26, 0.14)";
    for (let y = 0; y < 256; y += 16) {
      ctx.fillRect(0, y, 256, 3);
    }
    tex.update();
    tex.uScale = 12;
    tex.vScale = 2;
  }
  const mat = new PBRMaterial("gravelTrapMat", scene);
  mat.albedoTexture = tex;
  mat.roughness = isWet ? 0.72 : 0.96;
  mat.metallic = 0.0;
  mat.zOffset = -1;
  return mat;
}

function createGravelTrapRibbon(
  name: string,
  scene: Scene,
  root: TransformNode,
  spline: Spline3D,
  uStart: number,
  uEnd: number,
  sideSign: number,
  halfW: number,
  kerbW: number,
  runoffW: number,
  mat: PBRMaterial
): void {
  const innerPath: Vector3[] = [];
  const outerPath: Vector3[] = [];
  const steps = 20;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  for (let i = 0; i <= steps; i++) {
    const u = ((uStart + (i / steps) * (uEnd - uStart)) % 1 + 1) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();

    const pIn = pt.add(side.scale(sideSign * (halfW + kerbW + 0.1)));
    const pOut = pt.add(side.scale(sideSign * (halfW + kerbW + runoffW - 0.15)));
    pIn.y += 0.044;
    pOut.y += 0.032;
    innerPath.push(pIn);
    outerPath.push(pOut);
  }

  const mesh = MeshBuilder.CreateRibbon(
    name,
    { pathArray: [innerPath, outerPath], closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  mesh.parent = root;
  mesh.receiveShadows = true;
  mesh.material = mat;
}

function createOverheadBridge(
  name: string,
  scene: Scene,
  root: TransformNode,
  spline: Spline3D,
  u: number,
  trackWidth: number,
  barrierOffset: number,
  labelText: string,
  bannerBgHex: string,
  accentHex: string,
  deckMat: PBRMaterial,
  pillarMat: PBRMaterial,
  maxAnisotropy: number
): void {
  const pos = spline.getPointAt(u);
  const tan = spline.getTangentAt(u);
  const yaw = Math.atan2(tan.x, tan.z);
  const span = barrierOffset * 2 + 2.4;

  const group = new TransformNode(name, scene);
  group.parent = root;
  group.position.copyFrom(pos);
  group.rotation.y = yaw;

  const lPier = MeshBuilder.CreateBox(`${name}_lPier`, { width: 1.1, height: 6.8, depth: 1.8 }, scene);
  lPier.parent = group;
  lPier.position.set(span * 0.5, 3.3, 0);
  lPier.material = pillarMat;

  const rPier = MeshBuilder.CreateBox(`${name}_rPier`, { width: 1.1, height: 6.8, depth: 1.8 }, scene);
  rPier.parent = group;
  rPier.position.set(-span * 0.5, 3.3, 0);
  rPier.material = pillarMat;

  const deck = MeshBuilder.CreateBox(`${name}_deck`, { width: span + 1.4, height: 1.5, depth: 2.2 }, scene);
  deck.parent = group;
  deck.position.set(0, 6.2, 0);
  deck.material = deckMat;

  const tex = new DynamicTexture(`${name}_tex`, { width: 512, height: 128 }, scene);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  if (ctx) {
    ctx.fillStyle = bannerBgHex;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 512, 14);
    ctx.fillRect(0, 114, 512, 14);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, 256, 66);
    tex.update();
  }
  tex.anisotropicFilteringLevel = maxAnisotropy;
  const signMat = new PBRMaterial(`${name}_signMat`, scene);
  signMat.albedoTexture = tex;
  signMat.roughness = 0.55;
  signMat.metallic = 0.1;

  const frontSign = MeshBuilder.CreatePlane(`${name}_fSign`, { width: Math.min(span - 1.2, trackWidth + 7.0), height: 1.25 }, scene);
  frontSign.parent = deck;
  frontSign.position.set(0, 0, -1.12);
  frontSign.material = signMat;

  const backSign = MeshBuilder.CreatePlane(`${name}_bSign`, { width: Math.min(span - 1.2, trackWidth + 7.0), height: 1.25 }, scene);
  backSign.parent = deck;
  backSign.position.set(0, 0, 1.12);
  backSign.rotation.y = Math.PI;
  backSign.material = signMat;
}

function createCoveredGrandstand(
  name: string,
  scene: Scene,
  root: TransformNode,
  spline: Spline3D,
  u: number,
  sideSign: number,
  offsetOut: number,
  length: number,
  seatMat: PBRMaterial,
  roofMat: PBRMaterial,
  frameMat: PBRMaterial
): void {
  const pos = spline.getPointAt(u);
  const tan = spline.getTangentAt(u);
  const side = Vector3.Cross(tan, UP).normalize();
  const center = pos.add(side.scale(sideSign * offsetOut));
  if (!isClearOfTrack(spline, center, (offsetOut - 4.0) * (offsetOut - 4.0))) return;

  const yaw = Math.atan2(tan.x, tan.z);
  const group = new TransformNode(name, scene);
  group.parent = root;
  group.position.copyFrom(center);
  group.rotation.y = yaw;

  const faceDir = -sideSign; // Faces track
  // 3 stepped bleacher tiers
  for (let t = 0; t < 3; t++) {
    const tier = MeshBuilder.CreateBox(`${name}_tier_${t}`, { width: 3.2, height: 1.5 + t * 1.4, depth: length }, scene);
    tier.parent = group;
    tier.position.set(-faceDir * (t * 2.8 - 2.8), (1.5 + t * 1.4) * 0.5, 0);
    tier.material = seatMat;
  }

  // Rear support wall + cantilevered angled roof
  const backWall = MeshBuilder.CreateBox(`${name}_back`, { width: 0.5, height: 7.2, depth: length }, scene);
  backWall.parent = group;
  backWall.position.set(-faceDir * 4.4, 3.6, 0);
  backWall.material = frameMat;

  const roof = MeshBuilder.CreateBox(`${name}_roof`, { width: 10.5, height: 0.35, depth: length + 1.2 }, scene);
  roof.parent = group;
  roof.position.set(-faceDir * 0.2, 7.6, 0);
  roof.rotation.z = faceDir * 0.14;
  roof.material = roofMat;
}

// ============================================================================
// 1. SPA-FRANCORCHAMPS: Raidillon Tricolor, Eau Rouge Stream, Chalet & Ardennes
// ============================================================================
function buildSpaSurroundings(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  const halfW = track.width * 0.5;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  // Belgian Black-Yellow-Red Tricolor Runoff Flanking Eau Rouge / Raidillon (u: 0.085 -> 0.175)
  const triTex = new DynamicTexture("spaTricolorTex", { width: 256, height: 256 }, scene);
  const tCtx = triTex.getContext() as CanvasRenderingContext2D;
  if (tCtx) {
    tCtx.fillStyle = "#18181b";
    tCtx.fillRect(0, 0, 256, 86);
    tCtx.fillStyle = "#eab308";
    tCtx.fillRect(0, 86, 256, 84);
    tCtx.fillStyle = "#dc2626";
    tCtx.fillRect(0, 170, 256, 86);
    triTex.update();
    triTex.uScale = 14;
    triTex.vScale = 1;
  }
  const triMat = new PBRMaterial("spaTricolorMat", scene);
  triMat.albedoTexture = triTex;
  triMat.roughness = ctx.isWet ? 0.42 : 0.78;
  triMat.metallic = 0.02;
  triMat.zOffset = -1;

  for (const sgn of [-1, 1]) {
    const inP: Vector3[] = [];
    const outP: Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = 0.085 + (i / 28) * 0.09;
      spline.getPointAtToRef(u, pt);
      spline.getTangentAtToRef(u, tan);
      Vector3.CrossToRef(tan, UP, side);
      side.normalize();
      const a = pt.add(side.scale(sgn * (halfW + 1.0)));
      const b = pt.add(side.scale(sgn * (ctx.barrierOffset - 0.1)));
      a.y += 0.044;
      b.y += 0.032;
      inP.push(a);
      outP.push(b);
    }
    const triRibbon = MeshBuilder.CreateRibbon(
      `spaTricolor_${sgn}`,
      { pathArray: [inP, outP], closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    triRibbon.parent = root;
    triRibbon.material = triMat;
    triRibbon.receiveShadows = true;
  }

  // Iron-rich reddish-brown Eau Rouge Stream crossing beneath the dip (u ≈ 0.094)
  const erPos = spline.getPointAt(0.094);
  const erTan = spline.getTangentAt(0.094);
  const stream = MeshBuilder.CreateGround("eauRougeStream", { width: 11, height: 140 }, scene);
  stream.parent = root;
  stream.position.set(erPos.x, erPos.y - 1.25, erPos.z);
  stream.rotation.y = Math.atan2(erTan.x, erTan.z) + Math.PI * 0.5;
  const streamMat = new PBRMaterial("eauRougeStreamMat", scene);
  streamMat.albedoColor = new Color3(0.32, 0.14, 0.09);
  streamMat.metallic = 0.15;
  streamMat.roughness = 0.12;
  streamMat.clearCoat.isEnabled = true;
  streamMat.clearCoat.intensity = 0.85;
  stream.material = streamMat;

  // Historic European Chalet & Observation Tower overlooking Raidillon Crest (u ≈ 0.165)
  const crestPos = spline.getPointAt(0.165);
  const crestTan = spline.getTangentAt(0.165);
  const crestSide = Vector3.Cross(crestTan, UP).normalize();
  const chaletCenter = crestPos.add(crestSide.scale(ctx.barrierOffset + 12.5));
  if (isClearOfTrack(spline, chaletCenter, (ctx.barrierOffset + 6) * (ctx.barrierOffset + 6))) {
    const chaletMat = new PBRMaterial("spaChaletMat", scene);
    chaletMat.albedoColor = new Color3(0.84, 0.78, 0.68);
    chaletMat.roughness = 0.85;

    const roofTimberMat = new PBRMaterial("spaRoofMat", scene);
    roofTimberMat.albedoColor = new Color3(0.28, 0.17, 0.12);
    roofTimberMat.roughness = 0.82;

    const chalet = MeshBuilder.CreateBox("spaRaidillonChalet", { width: 11, height: 7.5, depth: 15 }, scene);
    chalet.parent = root;
    chalet.position.set(chaletCenter.x, crestPos.y + 3.5, chaletCenter.z);
    chalet.rotation.y = Math.atan2(crestTan.x, crestTan.z);
    chalet.material = chaletMat;

    const roof = MeshBuilder.CreateCylinder("spaChaletRoof", { diameter: 14.5, height: 16, tessellation: 3 }, scene);
    roof.parent = chalet;
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 6.2, 0);
    roof.material = roofTimberMat;

    const obsTower = MeshBuilder.CreateBox("spaObsTower", { width: 3.6, height: 16, depth: 3.6 }, scene);
    obsTower.parent = root;
    obsTower.position.set(chaletCenter.x - crestSide.x * 4.0, crestPos.y + 8.0, chaletCenter.z + 12.0);
    obsTower.material = ctx.darkMetalMat;
  }

  // Gold Grandstands on Raidillon climb, La Source, and Bus Stop
  const goldSeatMat = new PBRMaterial("spaGoldSeatMat", scene);
  goldSeatMat.albedoColor = new Color3(0.68, 0.52, 0.14);
  goldSeatMat.roughness = 0.72;
  createCoveredGrandstand("spaRaidillonStand", scene, root, spline, 0.145, -1, ctx.barrierOffset + 7.5, 28, goldSeatMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("spaLaSourceStand", scene, root, spline, 0.032, 1, ctx.barrierOffset + 7.5, 22, goldSeatMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("spaBusStopStand", scene, root, spline, 0.86, -1, ctx.barrierOffset + 7.5, 22, goldSeatMat, ctx.standRoofMat, ctx.darkMetalMat);

  // Kemmel Straight Overhead Footbridge
  createOverheadBridge(
    "spaKemmelBridge",
    scene,
    root,
    spline,
    0.24,
    track.width,
    ctx.barrierOffset,
    "ARDENNES CIRCUIT",
    "#0f172a",
    "#facc15",
    ctx.darkMetalMat,
    ctx.concreteMat,
    ctx.maxAnisotropy
  );

  // Dense Multi-Tone Ardennes Forest (Spruce Cones + Birch Canopy)
  const trunkMat = new PBRMaterial("spaTrunkMat", scene);
  trunkMat.albedoColor = new Color3(0.22, 0.15, 0.10);
  trunkMat.roughness = 0.95;

  const spruceMat = new PBRMaterial("spaSpruceMat", scene);
  spruceMat.albedoColor = new Color3(0.08, 0.19, 0.10);
  spruceMat.roughness = 0.90;

  const birchMat = new PBRMaterial("spaBirchMat", scene);
  birchMat.albedoColor = new Color3(0.16, 0.30, 0.14);
  birchMat.roughness = 0.88;

  const trunkMaster = MeshBuilder.CreateCylinder("spaTrunkMaster", { diameter: 0.55, height: 3.8, tessellation: 6 }, scene);
  trunkMaster.parent = root;
  trunkMaster.material = trunkMat;

  const spruceMaster = MeshBuilder.CreateCylinder("spaSpruceMaster", { diameterTop: 0.2, diameterBottom: 5.0, height: 9.5, tessellation: 7 }, scene);
  spruceMaster.parent = root;
  spruceMaster.material = spruceMat;

  const birchMaster = MeshBuilder.CreateSphere("spaBirchMaster", { diameter: 4.8, segments: 6 }, scene);
  birchMaster.parent = root;
  birchMaster.material = birchMat;

  const treeCount = Math.floor(135 * ctx.density);
  const minClearSq = (ctx.barrierOffset + 10.5) * (ctx.barrierOffset + 10.5);
  for (let i = 0; i < treeCount; i++) {
    const u = (i / treeCount + 0.005 * (i % 7)) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const sgn = i % 2 === 0 ? 1 : -1;
    const distOut = ctx.barrierOffset + 13.5 + ((i * 19) % 28);
    const tPos = pt.add(side.scale(sgn * distOut));
    if (!isClearOfTrack(spline, tPos, minClearSq)) continue;

    const sc = 0.8 + ((i * 29) % 10) * 0.08;
    trunkMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 1.6 * sc - 1.5, tPos.z), i * 0.4, sc, sc, sc));
    if (i % 3 === 0) {
      birchMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 5.4 * sc - 1.5, tPos.z), i * 0.7, sc, sc * 1.15, sc));
    } else {
      spruceMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 6.8 * sc - 1.5, tPos.z), i * 0.5, sc, sc, sc));
    }
  }
}

// ============================================================================
// 2. MONZA: Sopraelevata Banked Oval, Serraglio Bridge, Podium & Umbrella Pines
// ============================================================================
function buildMonzaSurroundings(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  const halfW = track.width * 0.5;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  // Historic 1955 Sopraelevata Banked Concrete Oval sweeping outside Parabolica (u: 0.85 -> 0.955)
  const bankIn: Vector3[] = [];
  const bankOut: Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const u = 0.85 + (i / 28) * 0.105;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    // On Monza (CCW), -side points outward away from the circuit loop
    const pIn = pt.add(side.scale(-(ctx.barrierOffset + 12.0)));
    const pOut = pt.add(side.scale(-(ctx.barrierOffset + 27.5)));
    if (!isClearOfTrack(spline, pIn, (ctx.barrierOffset + 6.0) * (ctx.barrierOffset + 6.0))) continue;
    pIn.y += 0.5;
    pOut.y += 11.5; // Dramatic historic high banking
    bankIn.push(pIn);
    bankOut.push(pOut);
  }
  if (bankIn.length >= 2) {
    const sopraelevata = MeshBuilder.CreateRibbon(
      "monzaSopraelevata",
      { pathArray: [bankIn, bankOut], closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE },
      scene
    );
    sopraelevata.parent = root;
    const oldConcreteMat = new PBRMaterial("monzaOldConcreteMat", scene);
    oldConcreteMat.albedoColor = new Color3(0.36, 0.37, 0.34);
    oldConcreteMat.roughness = 0.94;
    oldConcreteMat.metallic = 0.02;
    sopraelevata.material = oldConcreteMat;
  }

  // Serraglio Historic Brick Overpass Bridge (u ≈ 0.554) & Curva Grande Bridge (u ≈ 0.16)
  const brickMat = new PBRMaterial("monzaBrickMat", scene);
  brickMat.albedoColor = new Color3(0.56, 0.30, 0.22);
  brickMat.roughness = 0.9;
  createOverheadBridge(
    "monzaSerraglioBridge",
    scene,
    root,
    spline,
    0.554,
    track.width,
    ctx.barrierOffset,
    "SERRAGLIO PARK",
    "#1e293b",
    "#16a34a",
    brickMat,
    brickMat,
    ctx.maxAnisotropy
  );
  createOverheadBridge(
    "monzaCurvaGrandeBridge",
    scene,
    root,
    spline,
    0.16,
    track.width,
    ctx.barrierOffset,
    "AUTODROMO PARCO",
    "#0f172a",
    "#dc2626",
    ctx.darkMetalMat,
    ctx.concreteMat,
    ctx.maxAnisotropy
  );

  // Cantilevered Podium Overhang at Pit Straight (u ≈ 0.006, pit side)
  const podPos = spline.getPointAt(0.006);
  const podTan = spline.getTangentAt(0.006);
  const podSide = Vector3.Cross(podTan, UP).normalize();
  const podium = MeshBuilder.CreateCylinder("monzaPodiumOverhang", { diameter: 7.5, height: 0.75, tessellation: 18 }, scene);
  podium.parent = root;
  const podCenter = podPos.add(podSide.scale(ctx.barrierOffset + 4.8));
  podium.position.set(podCenter.x, podPos.y + 5.2, podCenter.z);
  const redTrimMat = new PBRMaterial("monzaRedTrimMat", scene);
  redTrimMat.albedoColor = new Color3(0.75, 0.10, 0.12);
  redTrimMat.roughness = 0.45;
  podium.material = redTrimMat;

  // Gravel Traps on true outer corners of Prima Variante & Curva Parabolica (-side on Monza)
  const gravelMat = createGravelMaterial(scene, ctx.isWet);
  createGravelTrapRibbon("monzaRettifiloGravel", scene, root, spline, 0.075, 0.11, -1, halfW, 0.95, 3.0, gravelMat);
  createGravelTrapRibbon("monzaParabolicaGravel", scene, root, spline, 0.85, 0.925, -1, halfW, 0.95, 3.0, gravelMat);

  // Prima Variante & Parabolica Grandstands
  createCoveredGrandstand("monzaRettifiloStand", scene, root, spline, 0.088, -1, ctx.barrierOffset + 7.5, 24, redTrimMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("monzaParabolicaStand", scene, root, spline, 0.89, -1, ctx.barrierOffset + 7.5, 24, redTrimMat, ctx.standRoofMat, ctx.darkMetalMat);

  // Towering Italian Umbrella Pines (Pini Domestici)
  const trunkMat = new PBRMaterial("monzaPineTrunkMat", scene);
  trunkMat.albedoColor = new Color3(0.30, 0.20, 0.14);
  trunkMat.roughness = 0.95;
  const pineCanopyMat = new PBRMaterial("monzaPineCanopyMat", scene);
  pineCanopyMat.albedoColor = new Color3(0.11, 0.25, 0.12);
  pineCanopyMat.roughness = 0.88;

  const trunkMaster = MeshBuilder.CreateCylinder("monzaTrunkMaster", { diameter: 0.5, height: 8.5, tessellation: 6 }, scene);
  trunkMaster.parent = root;
  trunkMaster.material = trunkMat;
  const canopyMaster = MeshBuilder.CreateCylinder(
    "monzaCanopyMaster",
    { diameterTop: 7.4, diameterBottom: 3.6, height: 2.6, tessellation: 9 },
    scene
  );
  canopyMaster.parent = root;
  canopyMaster.material = pineCanopyMat;

  const treeCount = Math.floor(95 * ctx.density);
  const minClearSq = (ctx.barrierOffset + 11.5) * (ctx.barrierOffset + 11.5);
  for (let i = 0; i < treeCount; i++) {
    const u = (i / treeCount + 0.004 * (i % 5)) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const sgn = i % 2 === 0 ? 1 : -1;
    // Leave room for Sopraelevata on u >= 0.86 outside
    const distOut = ctx.barrierOffset + (u > 0.85 && sgn > 0 ? 31.0 : 15.0) + ((i * 13) % 24);
    const tPos = pt.add(side.scale(sgn * distOut));
    if (!isClearOfTrack(spline, tPos, minClearSq)) continue;

    const sc = 0.85 + ((i * 23) % 8) * 0.08;
    trunkMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 4.0 * sc - 1.5, tPos.z), i * 0.4, sc, sc, sc));
    canopyMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 8.8 * sc - 1.5, tPos.z), i * 0.5, sc, sc, sc));
  }
}

// ============================================================================
// 3. SILVERSTONE: The Wing Pit Complex, RAF Airfield Hangars & Gravel Traps
// ============================================================================
function buildSilverstoneSurroundings(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  const halfW = track.width * 0.5;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  // "The Wing" Sweeping Architectural Pit Complex along Hamilton Straight (u: 0.95 -> 0.03)
  const wingSilverMat = new PBRMaterial("silverstoneWingMat", scene);
  wingSilverMat.albedoColor = new Color3(0.76, 0.79, 0.83);
  wingSilverMat.metallic = 0.68;
  wingSilverMat.roughness = 0.28;

  const wingGlassMat = new PBRMaterial("silverstoneGlassMat", scene);
  wingGlassMat.albedoColor = new Color3(0.12, 0.20, 0.28);
  wingGlassMat.metallic = 0.85;
  wingGlassMat.roughness = 0.12;
  wingGlassMat.clearCoat.isEnabled = true;

  const wingUs = [0.955, 0.985, 0.015];
  for (let i = 0; i < wingUs.length; i++) {
    const wPos = spline.getPointAt(wingUs[i]);
    const wTan = spline.getTangentAt(wingUs[i]);
    const wSide = Vector3.Cross(wTan, UP).normalize();
    const center = wPos.add(wSide.scale(ctx.barrierOffset + 8.5));
    const yaw = Math.atan2(wTan.x, wTan.z);

    const glassWall = MeshBuilder.CreateBox(`silverWingGlass_${i}`, { width: 9.0, height: 5.5, depth: 22.0 }, scene);
    glassWall.parent = root;
    glassWall.position.set(center.x, wPos.y + 2.75, center.z);
    glassWall.rotation.y = yaw;
    glassWall.material = wingGlassMat;

    const waveRoof = MeshBuilder.CreateBox(`silverWingRoof_${i}`, { width: 12.8, height: 0.65, depth: 24.0 }, scene);
    waveRoof.parent = glassWall;
    waveRoof.position.set(0, 3.1, 0);
    waveRoof.rotation.z = i % 2 === 0 ? 0.12 : -0.10;
    waveRoof.material = wingSilverMat;
  }

  // WWII RAF Airfield Arched Hangars lining Hangar Straight (u ≈ 0.65 - 0.74)
  const hangarMat = new PBRMaterial("rafHangarMat", scene);
  hangarMat.albedoColor = new Color3(0.45, 0.48, 0.51);
  hangarMat.metallic = 0.52;
  hangarMat.roughness = 0.56;

  const hangarMaster = MeshBuilder.CreateCylinder("rafHangarMaster", { diameter: 18, height: 24, tessellation: 14 }, scene);
  hangarMaster.parent = root;
  hangarMaster.material = hangarMat;

  for (let i = 0; i < 3; i++) {
    const u = 0.66 + i * 0.032;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const hPos = pt.add(side.scale(ctx.barrierOffset + 18.0));
    if (!isClearOfTrack(spline, hPos, (ctx.barrierOffset + 9) * (ctx.barrierOffset + 9))) continue;
    hPos.y -= 1.0;
    const q = Quaternion.RotationYawPitchRoll(Math.atan2(tan.x, tan.z), Math.PI * 0.5, 0);
    hangarMaster.thinInstanceAdd(Matrix.Compose(new Vector3(1, 1, 0.72), q, hPos));
  }

  // Airfield Control Tower near Hangar Straight / Stowe
  const twPos = spline.getPointAt(0.73);
  const twTan = spline.getTangentAt(0.73);
  const twSide = Vector3.Cross(twTan, UP).normalize();
  const twCenter = twPos.add(twSide.scale(ctx.barrierOffset + 15.0));
  const controlTower = MeshBuilder.CreateBox("silverstoneAirfieldTower", { width: 4.0, height: 15.0, depth: 4.0 }, scene);
  controlTower.parent = root;
  controlTower.position.set(twCenter.x, twPos.y + 7.5, twCenter.z);
  controlTower.material = ctx.concreteMat;
  const towerCab = MeshBuilder.CreateBox("silverstoneTowerCab", { width: 5.8, height: 2.6, depth: 5.8 }, scene);
  towerCab.parent = controlTower;
  towerCab.position.set(0, 7.6, 0);
  towerCab.material = wingGlassMat;

  // Gravel Traps at Copse, Stowe & Club
  const gravelMat = createGravelMaterial(scene, ctx.isWet);
  createGravelTrapRibbon("silverCopseGravel", scene, root, spline, 0.455, 0.495, 1, halfW, 0.95, 3.0, gravelMat);
  createGravelTrapRibbon("silverStoweGravel", scene, root, spline, 0.74, 0.79, 1, halfW, 0.95, 3.0, gravelMat);
  createGravelTrapRibbon("silverClubGravel", scene, root, spline, 0.89, 0.935, 1, halfW, 0.95, 3.0, gravelMat);

  // Abbey, Becketts & Stowe Covered Grandstands
  const britishBlueMat = new PBRMaterial("silverStandBlueMat", scene);
  britishBlueMat.albedoColor = new Color3(0.10, 0.25, 0.52);
  britishBlueMat.roughness = 0.68;
  createCoveredGrandstand("silverAbbeyStand", scene, root, spline, 0.04, -1, ctx.barrierOffset + 7.5, 22, britishBlueMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("silverBeckettsStand", scene, root, spline, 0.59, 1, ctx.barrierOffset + 7.5, 24, britishBlueMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("silverStoweStand", scene, root, spline, 0.77, 1, ctx.barrierOffset + 7.5, 24, britishBlueMat, ctx.standRoofMat, ctx.darkMetalMat);

  // Northamptonshire Oak Trees + Horizon Wind Turbines
  const trunkMat = new PBRMaterial("silverTrunkMat", scene);
  trunkMat.albedoColor = new Color3(0.25, 0.17, 0.12);
  trunkMat.roughness = 0.95;
  const oakMat = new PBRMaterial("silverOakMat", scene);
  oakMat.albedoColor = new Color3(0.14, 0.29, 0.13);
  oakMat.roughness = 0.90;

  const trunkMaster = MeshBuilder.CreateCylinder("silverTrunkMaster", { diameter: 0.6, height: 3.5, tessellation: 6 }, scene);
  trunkMaster.parent = root;
  trunkMaster.material = trunkMat;
  const oakMaster = MeshBuilder.CreateSphere("silverOakMaster", { diameter: 5.4, segments: 6 }, scene);
  oakMaster.parent = root;
  oakMaster.material = oakMat;

  const treeCount = Math.floor(68 * ctx.density);
  const minClearSq = (ctx.barrierOffset + 11.0) * (ctx.barrierOffset + 11.0);
  for (let i = 0; i < treeCount; i++) {
    const u = (i / treeCount + 0.008 * (i % 5)) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const sgn = i % 2 === 0 ? 1 : -1;
    const distOut = ctx.barrierOffset + 18.0 + ((i * 17) % 28);
    const tPos = pt.add(side.scale(sgn * distOut));
    if (!isClearOfTrack(spline, tPos, minClearSq)) continue;

    const sc = 0.8 + ((i * 19) % 8) * 0.08;
    trunkMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 1.5 * sc - 1.5, tPos.z), 0, sc, sc, sc));
    oakMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 4.8 * sc - 1.5, tPos.z), 0, sc * 1.15, sc * 0.9, sc * 1.15));
  }

  // Distant Northamptonshire Wind Turbines
  const turbMastMaster = MeshBuilder.CreateCylinder("turbMastMaster", { diameterTop: 0.7, diameterBottom: 1.6, height: 42, tessellation: 8 }, scene);
  turbMastMaster.parent = root;
  turbMastMaster.material = ctx.standRoofMat;
  for (let t = 0; t < 4; t++) {
    const ang = t * 1.45 + 0.6;
    const tx = Math.cos(ang) * 760;
    const tz = Math.sin(ang) * 760;
    turbMastMaster.thinInstanceAdd(makeMatrix(new Vector3(tx, 16, tz), ang));
  }
}

// ============================================================================
// 4. MONACO: Ste. Devote Chapel, Casino, Fairmont, Tunnel, Harbor Yachts & Pool
// ============================================================================
function buildMonacoSurroundings(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  const halfW = track.width * 0.5;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  // 4a. Louis II Curved Concrete Tunnel (u: 0.515 -> 0.635)
  const tunLBot: Vector3[] = [];
  const tunLTop: Vector3[] = [];
  const tunRTop: Vector3[] = [];
  const tunRBot: Vector3[] = [];
  const tunnelHalfW = halfW + 3.2;
  const tunnelCeiling = 5.4;

  for (let i = 0; i <= 36; i++) {
    const u = 0.515 + (i / 36) * 0.12;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();

    tunLBot.push(pt.add(side.scale(tunnelHalfW)).add(new Vector3(0, -0.2, 0)));
    tunLTop.push(pt.add(side.scale(tunnelHalfW - 0.5)).add(new Vector3(0, tunnelCeiling, 0)));
    tunRTop.push(pt.add(side.scale(-tunnelHalfW + 0.5)).add(new Vector3(0, tunnelCeiling, 0)));
    tunRBot.push(pt.add(side.scale(-tunnelHalfW)).add(new Vector3(0, -0.2, 0)));
  }

  const tunnelMesh = MeshBuilder.CreateRibbon(
    "monacoLouisIITunnel",
    {
      pathArray: [tunLBot, tunLTop, tunRTop, tunRBot],
      closeArray: false,
      closePath: false,
      sideOrientation: Mesh.DOUBLESIDE
    },
    scene
  );
  tunnelMesh.parent = root;
  const tunnelMat = new PBRMaterial("monacoTunnelMat", scene);
  tunnelMat.albedoColor = new Color3(0.24, 0.25, 0.27);
  tunnelMat.roughness = 0.88;
  tunnelMat.metallic = 0.05;
  tunnelMesh.material = tunnelMat;

  // Warm Sodium Ceiling Light Strips inside Tunnel
  const tunLightMat = new StandardMaterial("monacoTunnelLightMat", scene);
  tunLightMat.diffuseColor = new Color3(1.0, 0.78, 0.45);
  tunLightMat.emissiveColor = new Color3(1.9, 1.3, 0.6);
  const tunLightMaster = MeshBuilder.CreateBox("monacoTunLightMaster", { width: 0.45, height: 0.18, depth: 3.6 }, scene);
  tunLightMaster.parent = root;
  tunLightMaster.material = tunLightMat;

  for (let i = 1; i < 20; i++) {
    const u = 0.515 + (i / 20) * 0.12;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    const lPos = new Vector3(pt.x, pt.y + tunnelCeiling - 0.18, pt.z);
    tunLightMaster.thinInstanceAdd(makeMatrix(lPos, Math.atan2(tan.x, tan.z)));
  }

  // 4b. Port Hercule Mediterranean Harbor Water (east of track seawall, never under pit straight!)
  const waterMesh = MeshBuilder.CreateGround("monacoHarborWater", { width: 720, height: 1500 }, scene);
  waterMesh.parent = root;
  waterMesh.position.set(595, -2.2, 200);
  const waterMat = new PBRMaterial("monacoWaterMat", scene);
  waterMat.albedoColor = ctx.isNight ? new Color3(0.03, 0.08, 0.15) : new Color3(0.04, 0.26, 0.42);
  waterMat.metallic = 0.20;
  waterMat.roughness = ctx.isWet ? 0.07 : 0.13;
  waterMat.clearCoat.isEnabled = true;
  waterMat.clearCoat.intensity = 0.92;
  waterMat.clearCoat.roughness = 0.05;
  waterMesh.material = waterMat;

  // Harbor Quay Seawall along east edge (u: 0.67 -> 0.88)
  const quayIn: Vector3[] = [];
  const quayOut: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = 0.67 + (i / 24) * 0.21;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    // -side points east toward harbor
    quayIn.push(pt.add(side.scale(-(ctx.barrierOffset + 1.0))).add(new Vector3(0, 0.2, 0)));
    quayOut.push(pt.add(side.scale(-(ctx.barrierOffset + 10.0))).add(new Vector3(0, -2.6, 0)));
  }
  const quayWall = MeshBuilder.CreateRibbon(
    "monacoHarborQuay",
    { pathArray: [quayIn, quayOut], closeArray: false, closePath: false, sideOrientation: Mesh.DOUBLESIDE },
    scene
  );
  quayWall.parent = root;
  quayWall.material = ctx.concreteMat;

  // Moored Superyachts in Port Hercule (ThinInstance)
  const yachtHullMat = new PBRMaterial("monacoYachtHullMat", scene);
  yachtHullMat.albedoColor = new Color3(0.92, 0.94, 0.96);
  yachtHullMat.roughness = 0.22;
  yachtHullMat.clearCoat.isEnabled = true;
  const yachtDeckMat = new PBRMaterial("monacoYachtDeckMat", scene);
  yachtDeckMat.albedoColor = new Color3(0.09, 0.14, 0.20);
  yachtDeckMat.metallic = 0.8;
  yachtDeckMat.roughness = 0.12;

  const hullMaster = MeshBuilder.CreateBox("yachtHullMaster", { width: 6.5, height: 3.2, depth: 26 }, scene);
  hullMaster.parent = root;
  hullMaster.material = yachtHullMat;
  const cabinMaster = MeshBuilder.CreateBox("yachtCabinMaster", { width: 4.8, height: 2.6, depth: 15 }, scene);
  cabinMaster.parent = root;
  cabinMaster.material = yachtDeckMat;

  const yachtCount = Math.floor(8 * ctx.density);
  for (let y = 0; y < yachtCount; y++) {
    const u = 0.69 + (y / yachtCount) * 0.17;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const yPos = pt.add(side.scale(-(ctx.barrierOffset + 22 + (y % 2) * 18)));
    if (!isClearOfTrack(spline, yPos, (ctx.barrierOffset + 14) * (ctx.barrierOffset + 14))) continue;
    const yaw = Math.atan2(tan.x, tan.z) + 0.35;
    hullMaster.thinInstanceAdd(makeMatrix(new Vector3(yPos.x, -1.1, yPos.z), yaw));
    cabinMaster.thinInstanceAdd(makeMatrix(new Vector3(yPos.x, 1.5, yPos.z), yaw));
  }

  // 4c. Swimming Pool Complex (Stade Nautique Rainier III, u ≈ 0.80)
  const poolPos = spline.getPointAt(0.80);
  const poolTan = spline.getTangentAt(0.80);
  const poolSide = Vector3.Cross(poolTan, UP).normalize();
  const poolCenter = poolPos.add(poolSide.scale(ctx.barrierOffset + 11.5));
  if (isClearOfTrack(spline, poolCenter, (ctx.barrierOffset + 5) * (ctx.barrierOffset + 5))) {
    const poolBasin = MeshBuilder.CreateBox("monacoSwimmingPool", { width: 14, height: 0.4, depth: 34 }, scene);
    poolBasin.parent = root;
    poolBasin.position.set(poolCenter.x, poolPos.y - 0.1, poolCenter.z);
    poolBasin.rotation.y = Math.atan2(poolTan.x, poolTan.z);
    const poolMat = new PBRMaterial("monacoPoolMat", scene);
    poolMat.albedoColor = new Color3(0.08, 0.66, 0.86);
    poolMat.roughness = 0.1;
    poolMat.clearCoat.isEnabled = true;
    poolBasin.material = poolMat;
  }

  // 4d. Iconic Street Landmarks: Sainte-Devote Chapel (u≈0.15), Casino (u≈0.34), Fairmont (u≈0.415), Rascasse (u≈0.88)
  const creamStoneMat = new PBRMaterial("monacoCreamMat", scene);
  creamStoneMat.albedoColor = new Color3(0.86, 0.80, 0.69);
  creamStoneMat.roughness = 0.78;
  const copperDomeMat = new PBRMaterial("monacoCopperDomeMat", scene);
  copperDomeMat.albedoColor = new Color3(0.28, 0.56, 0.48);
  copperDomeMat.metallic = 0.55;
  copperDomeMat.roughness = 0.35;

  // Sainte-Devote Chapel
  const sdPos = spline.getPointAt(0.15);
  const sdTan = spline.getTangentAt(0.15);
  const sdSide = Vector3.Cross(sdTan, UP).normalize();
  const chapelPos = sdPos.add(sdSide.scale(ctx.barrierOffset + 10.5));
  if (isClearOfTrack(spline, chapelPos, (ctx.barrierOffset + 5) * (ctx.barrierOffset + 5))) {
    const chapel = MeshBuilder.CreateBox("steDevoteChapel", { width: 9, height: 10, depth: 14 }, scene);
    chapel.parent = root;
    chapel.position.set(chapelPos.x, sdPos.y + 4.5, chapelPos.z);
    chapel.rotation.y = Math.atan2(sdTan.x, sdTan.z);
    chapel.material = creamStoneMat;
  }

  // Casino Square Belle Epoque Facade
  const casPos = spline.getPointAt(0.34);
  const casTan = spline.getTangentAt(0.34);
  const casSide = Vector3.Cross(casTan, UP).normalize();
  const casinoCenter = casPos.add(casSide.scale(-(ctx.barrierOffset + 13.5)));
  if (isClearOfTrack(spline, casinoCenter, (ctx.barrierOffset + 6) * (ctx.barrierOffset + 6))) {
    const casino = MeshBuilder.CreateBox("monteCarloCasino", { width: 18, height: 14, depth: 28 }, scene);
    casino.parent = root;
    casino.position.set(casinoCenter.x, casPos.y + 6.5, casinoCenter.z);
    casino.rotation.y = Math.atan2(casTan.x, casTan.z);
    casino.material = creamStoneMat;

    const dome = MeshBuilder.CreateSphere("casinoDome", { diameter: 9.0, segments: 12 }, scene);
    dome.parent = casino;
    dome.position.set(0, 7.5, 0);
    dome.material = copperDomeMat;
  }

  // La Rascasse Pavilion (red & cream corner building at u ≈ 0.88)
  const rascPos = spline.getPointAt(0.88);
  const rascTan = spline.getTangentAt(0.88);
  const rascSide = Vector3.Cross(rascTan, UP).normalize();
  const rascCenter = rascPos.add(rascSide.scale(ctx.barrierOffset + 9.5));
  if (isClearOfTrack(spline, rascCenter, (ctx.barrierOffset + 5) * (ctx.barrierOffset + 5))) {
    const rascMat = new PBRMaterial("rascasseMat", scene);
    rascMat.albedoColor = new Color3(0.76, 0.24, 0.20);
    rascMat.roughness = 0.72;
    const rasc = MeshBuilder.CreateBox("laRascasse", { width: 10, height: 6.5, depth: 12 }, scene);
    rasc.parent = root;
    rasc.position.set(rascCenter.x, rascPos.y + 3.0, rascCenter.z);
    rasc.rotation.y = Math.atan2(rascTan.x, rascTan.z);
    rasc.material = rascMat;
  }

  // 4e. Monte Carlo Hillside Apartments & Boulevard Palm Trees (ThinInstance)
  const bldgTex = new DynamicTexture("monacoBldgTex", { width: 256, height: 256 }, scene);
  const bCtx = bldgTex.getContext() as CanvasRenderingContext2D;
  if (bCtx) {
    bCtx.fillStyle = "#c4b6a4";
    bCtx.fillRect(0, 0, 256, 256);
    for (let row = 16; row < 240; row += 28) {
      for (let col = 14; col < 242; col += 28) {
        bCtx.fillStyle = ctx.isNight && (row + col) % 3 === 0 ? "#fde68a" : "#1e293b";
        bCtx.fillRect(col, row, 16, 18);
      }
    }
    bldgTex.update();
  }
  const bldgMat = new PBRMaterial("monacoBldgMat", scene);
  bldgMat.albedoTexture = bldgTex;
  bldgMat.roughness = 0.82;

  const bldgMaster = MeshBuilder.CreateBox("monacoBldgMaster", { width: 14, height: 22, depth: 14 }, scene);
  bldgMaster.parent = root;
  bldgMaster.material = bldgMat;

  const bCount = Math.floor(28 * ctx.density);
  const minBldgClearSq = (ctx.barrierOffset + 14.5) * (ctx.barrierOffset + 14.5);
  for (let i = 0; i < bCount; i++) {
    const u = (i / bCount) % 1;
    if (u > 0.50 && u < 0.88) continue; // Keep Tunnel & Harbor sightlines open!
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const bPos = pt.add(side.scale(ctx.barrierOffset + 20 + (i % 3) * 14));
    if (!isClearOfTrack(spline, bPos, minBldgClearSq)) continue;

    const hScale = 0.65 + ((i * 37) % 10) * 0.14;
    bldgMaster.thinInstanceAdd(makeMatrix(new Vector3(bPos.x, pt.y + 11 * hScale - 2.0, bPos.z), Math.atan2(tan.x, tan.z), 1, hScale, 1));
  }

  // Boulevard Palm Trees along Harbor & Casino
  const palmTrunkMat = new PBRMaterial("monacoPalmTrunk", scene);
  palmTrunkMat.albedoColor = new Color3(0.36, 0.28, 0.20);
  palmTrunkMat.roughness = 0.92;
  const palmFrondMat = new PBRMaterial("monacoPalmFrond", scene);
  palmFrondMat.albedoColor = new Color3(0.18, 0.42, 0.18);
  palmFrondMat.roughness = 0.82;

  const palmTrunk = MeshBuilder.CreateCylinder("monacoPalmTrunkM", { diameterTop: 0.3, diameterBottom: 0.45, height: 6.2, tessellation: 6 }, scene);
  palmTrunk.parent = root;
  palmTrunk.material = palmTrunkMat;
  const palmCrown = MeshBuilder.CreateCylinder("monacoPalmCrownM", { diameterTop: 4.5, diameterBottom: 0.6, height: 1.8, tessellation: 7 }, scene);
  palmCrown.parent = root;
  palmCrown.material = palmFrondMat;

  const palmCount = Math.floor(24 * ctx.density);
  for (let i = 0; i < palmCount; i++) {
    const u = 0.68 + (i / palmCount) * 0.22;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const pPos = pt.add(side.scale(-(ctx.barrierOffset + 4.5)));
    if (!isClearOfTrack(spline, pPos, (ctx.barrierOffset + 2.5) * (ctx.barrierOffset + 2.5))) continue;
    palmTrunk.thinInstanceAdd(makeMatrix(new Vector3(pPos.x, pt.y + 3.0, pPos.z), i * 0.5));
    palmCrown.thinInstanceAdd(makeMatrix(new Vector3(pPos.x, pt.y + 6.4, pPos.z), i * 0.5));
  }
}

// ============================================================================
// 5. SUZUKA: Spoked Ferris Wheel, Motopia Coaster, Viaduct Piers & Sakura
// ============================================================================
function buildSuzukaSurroundings(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  const halfW = track.width * 0.5;
  const pt = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();

  // 5a. Elevated Figure-8 Viaduct Parapets & Support Piers (u: 0.64 -> 0.75)
  const pierMaster = MeshBuilder.CreateBox("suzukaViaductPier", { width: 2.2, height: 22, depth: 2.2 }, scene);
  pierMaster.parent = root;
  pierMaster.material = ctx.concreteMat;

  for (let i = 0; i < 8; i++) {
    const u = 0.645 + (i / 7) * 0.095;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const yaw = Math.atan2(tan.x, tan.z);
    for (const sgn of [-1, 1]) {
      const pPos = pt.add(side.scale(sgn * (halfW + 1.5)));
      pierMaster.thinInstanceAdd(makeMatrix(new Vector3(pPos.x, pt.y - 11.2, pPos.z), yaw));
    }
  }

  // 5b. Detailed Ouka Ferris Wheel (Rim + Radial Spokes + Hub + Colored Gondolas)
  const wheelAnchor = spline.getPointAt(0.25);
  const wheelNode = new TransformNode("suzukaFerrisWheelGroup", scene);
  wheelNode.parent = root;
  wheelNode.position.set(wheelAnchor.x - 105, wheelAnchor.y + 32, wheelAnchor.z + 70);
  wheelNode.rotation.y = Math.PI / 4;

  const wheelMat = new PBRMaterial("suzukaWheelMat", scene);
  wheelMat.albedoColor = new Color3(0.88, 0.90, 0.94);
  wheelMat.metallic = 0.55;
  wheelMat.roughness = 0.35;
  if (ctx.isNight) {
    wheelMat.emissiveColor = new Color3(0.45, 0.65, 1.0);
  }

  const outerRim = MeshBuilder.CreateTorus("suzukaWheelRim", { diameter: 52, thickness: 1.5, tessellation: 32 }, scene);
  outerRim.parent = wheelNode;
  outerRim.rotation.x = Math.PI / 2;
  outerRim.material = wheelMat;

  const innerRim = MeshBuilder.CreateTorus("suzukaWheelInner", { diameter: 34, thickness: 0.9, tessellation: 24 }, scene);
  innerRim.parent = wheelNode;
  innerRim.rotation.x = Math.PI / 2;
  innerRim.material = wheelMat;

  const hub = MeshBuilder.CreateCylinder("suzukaWheelHub", { diameter: 5.0, height: 4.5, tessellation: 14 }, scene);
  hub.parent = wheelNode;
  hub.rotation.x = Math.PI / 2;
  hub.material = ctx.darkMetalMat;

  // 12 Radial Spokes & Colored Gondolas
  const gondolaMat = new StandardMaterial("suzukaGondolaMat", scene);
  gondolaMat.diffuseColor = new Color3(0.95, 0.25, 0.25);
  gondolaMat.emissiveColor = ctx.isNight ? new Color3(1.4, 0.45, 0.35) : new Color3(0.15, 0.04, 0.04);

  for (let s = 0; s < 12; s++) {
    const ang = (s / 12) * Math.PI * 2;
    const spoke = MeshBuilder.CreateBox(`suzukaSpoke_${s}`, { width: 0.45, height: 51, depth: 0.45 }, scene);
    spoke.parent = wheelNode;
    spoke.rotation.z = ang;
    spoke.material = wheelMat;

    const gondola = MeshBuilder.CreateBox(`suzukaGondola_${s}`, { width: 2.6, height: 2.8, depth: 2.6 }, scene);
    gondola.parent = wheelNode;
    gondola.position.set(Math.cos(ang) * 26, Math.sin(ang) * 26, 0);
    gondola.material = gondolaMat;
  }

  // Support A-Frame Legs down to ground
  for (const sgn of [-1, 1]) {
    const leg = MeshBuilder.CreateBox(`suzukaWheelLeg_${sgn}`, { width: 1.8, height: 44, depth: 1.8 }, scene);
    leg.parent = wheelNode;
    leg.position.set(sgn * 11, -21, 0);
    leg.rotation.z = sgn * -0.26;
    leg.material = ctx.darkMetalMat;
  }

  // Motopia Amusement Park Rollercoaster Arch Silhouette
  const coasterMat = new PBRMaterial("suzukaCoasterMat", scene);
  coasterMat.albedoColor = new Color3(0.88, 0.22, 0.26);
  coasterMat.roughness = 0.45;
  const coaster = MeshBuilder.CreateTorus("suzukaMotopiaCoaster", { diameter: 32, thickness: 1.2, tessellation: 24 }, scene);
  coaster.parent = wheelNode;
  coaster.position.set(-48, -8, -18);
  coaster.rotation.x = Math.PI / 2;
  coaster.material = coasterMat;

  // 5c. Arch Footbridge (u ≈ 0.24), V1/V2 & Casio Grandstands, Degner/Spoon Gravel
  createOverheadBridge(
    "suzukaMotoparkBridge",
    scene,
    root,
    spline,
    0.24,
    track.width,
    ctx.barrierOffset,
    "MOTOPARK SUZUKA",
    "#0f172a",
    "#eab308",
    ctx.darkMetalMat,
    ctx.concreteMat,
    ctx.maxAnisotropy
  );

  const gravelMat = createGravelMaterial(scene, ctx.isWet);
  createGravelTrapRibbon("suzukaDegnerGravel", scene, root, spline, 0.27, 0.32, 1, halfW, 0.95, 3.0, gravelMat);
  createGravelTrapRibbon("suzukaSpoonGravel", scene, root, spline, 0.51, 0.58, 1, halfW, 0.95, 3.0, gravelMat);

  const hondaRedMat = new PBRMaterial("suzukaStandRedMat", scene);
  hondaRedMat.albedoColor = new Color3(0.72, 0.14, 0.16);
  hondaRedMat.roughness = 0.68;
  createCoveredGrandstand("suzukaMainStand", scene, root, spline, 0.975, -1, ctx.barrierOffset + 7.5, 26, hondaRedMat, ctx.standRoofMat, ctx.darkMetalMat);
  createCoveredGrandstand("suzukaCasioStand", scene, root, spline, 0.84, 1, ctx.barrierOffset + 7.5, 22, hondaRedMat, ctx.standRoofMat, ctx.darkMetalMat);

  // 5d. Japanese Cedar & Pink Sakura Cherry-Blossom Trees (ThinInstance)
  const trunkMat = new PBRMaterial("suzukaTrunkMat", scene);
  trunkMat.albedoColor = new Color3(0.24, 0.16, 0.11);
  trunkMat.roughness = 0.95;

  const cedarMat = new PBRMaterial("suzukaCedarMat", scene);
  cedarMat.albedoColor = new Color3(0.11, 0.24, 0.12);
  cedarMat.roughness = 0.90;

  const sakuraMat = new PBRMaterial("suzukaSakuraMat", scene);
  sakuraMat.albedoColor = new Color3(0.95, 0.64, 0.74);
  sakuraMat.roughness = 0.84;

  const trunkMaster = MeshBuilder.CreateCylinder("suzukaTrunkM", { diameter: 0.52, height: 3.4, tessellation: 6 }, scene);
  trunkMaster.parent = root;
  trunkMaster.material = trunkMat;

  const cedarMaster = MeshBuilder.CreateCylinder("suzukaCedarM", { diameterTop: 0.2, diameterBottom: 4.6, height: 8.5, tessellation: 7 }, scene);
  cedarMaster.parent = root;
  cedarMaster.material = cedarMat;

  const sakuraMaster = MeshBuilder.CreateSphere("suzukaSakuraM", { diameter: 4.8, segments: 6 }, scene);
  sakuraMaster.parent = root;
  sakuraMaster.material = sakuraMat;

  const treeCount = Math.floor(90 * ctx.density);
  const minClearSq = (ctx.barrierOffset + 10.5) * (ctx.barrierOffset + 10.5);
  for (let i = 0; i < treeCount; i++) {
    const u = (i / treeCount + 0.006 * (i % 5)) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, UP, side);
    side.normalize();
    const sgn = i % 2 === 0 ? 1 : -1;
    const distOut = ctx.barrierOffset + 15.0 + ((i * 17) % 24);
    const tPos = pt.add(side.scale(sgn * distOut));
    if (!isClearOfTrack(spline, tPos, minClearSq)) continue;

    const sc = 0.78 + ((i * 29) % 10) * 0.07;
    trunkMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 1.5 * sc - 1.5, tPos.z), i * 0.5, sc, sc, sc));
    if (i % 4 === 0) {
      sakuraMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 4.8 * sc - 1.5, tPos.z), i * 0.4, sc * 1.15, sc * 0.85, sc * 1.15));
    } else {
      cedarMaster.thinInstanceAdd(makeMatrix(new Vector3(tPos.x, pt.y + 6.4 * sc - 1.5, tPos.z), i * 0.5, sc, sc, sc));
    }
  }
}

export function buildCircuitLandmarks(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  ctx: CircuitLandmarkContext
): void {
  switch (track.id) {
    case "spa":
      buildSpaSurroundings(track, spline, scene, root, ctx);
      break;
    case "monza":
      buildMonzaSurroundings(track, spline, scene, root, ctx);
      break;
    case "silverstone":
      buildSilverstoneSurroundings(track, spline, scene, root, ctx);
      break;
    case "monaco":
      buildMonacoSurroundings(track, spline, scene, root, ctx);
      break;
    case "suzuka":
      buildSuzukaSurroundings(track, spline, scene, root, ctx);
      break;
    default:
      buildSpaSurroundings(track, spline, scene, root, ctx);
      break;
  }
}
