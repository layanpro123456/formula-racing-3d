// Formula Racing 3D — Instanced Trackside World, Landmarks & Start Gantry Props
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

export interface TrackPropsHandle {
  updateStartLights: (countdown: number | null) => void;
}

export interface TrackPropsOptions {
  propDensity?: number;
  isNight?: boolean;
  isWet?: boolean;
}

export function createTracksideProps(
  track: Track,
  spline: Spline3D,
  scene: Scene,
  root: TransformNode,
  barrierOffset: number,
  options: TrackPropsOptions = {}
): TrackPropsHandle {
  const density = Math.max(0.35, Math.min(1.0, options.propDensity ?? 1.0));
  const isNight = Boolean(options.isNight);
  const isWet = Boolean(options.isWet);
  const maxAnisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);

  const up = new Vector3(0, 1, 0);
  const pt = new Vector3();
  const tan = new Vector3();
  const nextTan = new Vector3();
  const side = new Vector3();
  const cross = new Vector3();

  // Shared materials
  const concreteMat = new PBRMaterial("propConcreteMat", scene);
  concreteMat.albedoColor = new Color3(0.46, 0.48, 0.50);
  concreteMat.roughness = 0.88;
  concreteMat.metallic = 0.02;

  const darkMetalMat = new PBRMaterial("propDarkMetalMat", scene);
  darkMetalMat.albedoColor = new Color3(0.14, 0.16, 0.19);
  darkMetalMat.metallic = 0.72;
  darkMetalMat.roughness = 0.44;

  const standRoofMat = new PBRMaterial("propStandRoofMat", scene);
  standRoofMat.albedoColor = new Color3(0.82, 0.84, 0.87);
  standRoofMat.metallic = 0.25;
  standRoofMat.roughness = 0.45;

  const sponsorBoardMat = new PBRMaterial("propSponsorMat", scene);
  sponsorBoardMat.metallic = 0.12;
  sponsorBoardMat.roughness = 0.55;
  const sponsorTex = new DynamicTexture("propSponsorTex", { width: 512, height: 128 }, scene);
  const sCtx = sponsorTex.getContext() as CanvasRenderingContext2D;
  if (sCtx) {
    sCtx.fillStyle = "#0f172a";
    sCtx.fillRect(0, 0, 512, 128);
    sCtx.fillStyle = "#e10600";
    sCtx.fillRect(0, 0, 22, 128);
    sCtx.fillRect(490, 0, 22, 128);
    sCtx.fillStyle = "#f8fafc";
    sCtx.font = "900 44px sans-serif";
    sCtx.textAlign = "center";
    sCtx.textBaseline = "middle";
    sCtx.fillText("APEX MOTORSPORT", 256, 64);
    sponsorTex.update();
  }
  sponsorTex.anisotropicFilteringLevel = maxAnisotropy;
  sponsorBoardMat.albedoTexture = sponsorTex;

  // Helper to build a ThinInstance transform matrix from position, yaw, and scale
  const makeTransformMatrix = (pos: Vector3, yaw: number, sx = 1, sy = 1, sz = 1): Matrix => {
    const q = Quaternion.RotationAxis(up, yaw);
    return Matrix.Compose(new Vector3(sx, sy, sz), q, pos);
  };

  // =========================================================================
  // 1. Trackside Barrier Posts & Catch-Fence Arms (ThinInstance)
  // =========================================================================
  const postMaster = MeshBuilder.CreateBox("barrierPostMaster", { width: 0.14, height: 2.35, depth: 0.14 }, scene);
  postMaster.parent = root;
  postMaster.material = darkMetalMat;

  const postStep = Math.max(1, Math.round(6 / density));
  const postCount = Math.floor(420 / postStep) * postStep;
  for (let i = 0; i < 420; i += postStep) {
    const u = i / 420;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, up, side);
    side.normalize();
    const yaw = Math.atan2(tan.x, tan.z);

    const lPos = pt.add(side.scale(barrierOffset + 0.08));
    lPos.y += 1.15;
    postMaster.thinInstanceAdd(makeTransformMatrix(lPos, yaw));

    const rPos = pt.add(side.scale(-(barrierOffset + 0.08)));
    rPos.y += 1.15;
    postMaster.thinInstanceAdd(makeTransformMatrix(rPos, yaw));
  }
  void postCount;

  // =========================================================================
  // 2. Start / Finish Gantry with 5 Live Red/Green LED Light Pods
  // =========================================================================
  const gantryU = 0.004;
  const gPos = spline.getPointAt(gantryU);
  const gTan = spline.getTangentAt(gantryU);
  const gSide = Vector3.Cross(gTan, up).normalize();
  const gYaw = Math.atan2(gTan.x, gTan.z);
  const gantryWidth = track.width + 6.2;

  const gantryGroup = new TransformNode("startGantryGroup", scene);
  gantryGroup.parent = root;
  gantryGroup.position.copyFrom(gPos);
  gantryGroup.rotation.y = gYaw;

  const leftPillar = MeshBuilder.CreateBox("gantryLeftPillar", { width: 0.48, height: 6.0, depth: 0.48 }, scene);
  leftPillar.parent = gantryGroup;
  leftPillar.position.set(gantryWidth * 0.5, 3.0, 0);
  leftPillar.material = darkMetalMat;

  const rightPillar = MeshBuilder.CreateBox("gantryRightPillar", { width: 0.48, height: 6.0, depth: 0.48 }, scene);
  rightPillar.parent = gantryGroup;
  rightPillar.position.set(-gantryWidth * 0.5, 3.0, 0);
  rightPillar.material = darkMetalMat;

  const crossBeam = MeshBuilder.CreateBox("gantryCrossBeam", { width: gantryWidth + 0.8, height: 0.95, depth: 0.72 }, scene);
  crossBeam.parent = gantryGroup;
  crossBeam.position.set(0, 5.75, 0);
  crossBeam.material = darkMetalMat;

  const gantrySign = MeshBuilder.CreatePlane("gantrySignFace", { width: gantryWidth - 1.2, height: 0.72 }, scene);
  gantrySign.parent = crossBeam;
  gantrySign.position.set(0, 0, -0.37);
  gantrySign.material = sponsorBoardMat;

  const gantrySignBack = MeshBuilder.CreatePlane("gantrySignBack", { width: gantryWidth - 1.2, height: 0.72 }, scene);
  gantrySignBack.parent = crossBeam;
  gantrySignBack.position.set(0, 0, 0.37);
  gantrySignBack.rotation.y = Math.PI;
  gantrySignBack.material = sponsorBoardMat;

  // 5 Gantry LED Light Pods hanging beneath crossbar
  const lightBox = MeshBuilder.CreateBox("gantryLightBar", { width: 3.4, height: 0.48, depth: 0.36 }, scene);
  lightBox.parent = gantryGroup;
  lightBox.position.set(0, 5.05, 0);
  lightBox.material = darkMetalMat;

  const podMats: StandardMaterial[] = [];
  for (let i = 0; i < 5; i++) {
    const podMat = new StandardMaterial(`gantryPodMat_${i}`, scene);
    podMat.diffuseColor = new Color3(0.08, 0.08, 0.1);
    podMat.emissiveColor = new Color3(0.02, 0.02, 0.02);
    podMat.specularColor = new Color3(0.1, 0.1, 0.1);
    podMats.push(podMat);

    const pod = MeshBuilder.CreateCylinder(`gantryPod_${i}`, { diameter: 0.26, height: 0.42, tessellation: 14 }, scene);
    pod.parent = lightBox;
    pod.rotation.x = Math.PI / 2;
    pod.position.set((i - 2) * 0.62, 0, 0);
    pod.material = podMat;
  }

  // =========================================================================
  // 3. Pit Wall, Pit Garages & Grandstands along Pit Straight
  // =========================================================================
  const pitStraightUs = [0.94, 0.965, 0.99, 0.015];
  const pitBuildingMaster = MeshBuilder.CreateBox("pitBuildingMaster", { width: 8.5, height: 5.2, depth: 16.0 }, scene);
  pitBuildingMaster.parent = root;
  pitBuildingMaster.material = concreteMat;
  pitBuildingMaster.receiveShadows = true;

  const grandstandMaster = MeshBuilder.CreateBox("grandstandMaster", { width: 9.0, height: 6.5, depth: 20.0 }, scene);
  grandstandMaster.parent = root;
  grandstandMaster.material = standRoofMat;
  grandstandMaster.receiveShadows = true;

  for (const u of pitStraightUs) {
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, up, side);
    side.normalize();
    const yaw = Math.atan2(tan.x, tan.z);

    // Pit building on left side
    const pitPos = pt.add(side.scale(barrierOffset + 7.5));
    pitPos.y += 2.4;
    pitBuildingMaster.thinInstanceAdd(makeTransformMatrix(pitPos, yaw));

    // Main grandstand on right side
    const standPos = pt.add(side.scale(-(barrierOffset + 9.0)));
    standPos.y += 3.0;
    grandstandMaster.thinInstanceAdd(makeTransformMatrix(standPos, yaw));
  }

  // Race Control Timing Tower near start line
  const towerPos = gPos.add(gSide.scale(barrierOffset + 6.8));
  const timingTower = MeshBuilder.CreateBox("timingTower", { width: 3.2, height: 14.0, depth: 3.2 }, scene);
  timingTower.parent = root;
  timingTower.position.set(towerPos.x, towerPos.y + 7.0, towerPos.z);
  timingTower.rotation.y = gYaw;
  timingTower.material = darkMetalMat;

  // =========================================================================
  // 4. Automatic Curvature-Based Brake Boards (150/100/50m) & TecPro Apex Barriers
  // =========================================================================
  const makeBoardMat = (label: string, accentHex: string) => {
    const tex = new DynamicTexture(`boardTex_${label}`, { width: 128, height: 64 }, scene);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = accentHex;
      ctx.fillRect(0, 0, 14, 64);
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 70, 34);
      tex.update();
    }
    tex.anisotropicFilteringLevel = maxAnisotropy;
    const mat = new PBRMaterial(`boardMat_${label}`, scene);
    mat.albedoTexture = tex;
    mat.roughness = 0.72;
    mat.metallic = 0.05;
    return mat;
  };

  const boardMats = [
    makeBoardMat("150", "#0f172a"),
    makeBoardMat("100", "#0f172a"),
    makeBoardMat("50", "#dc2626")
  ];

  // TecPro barrier blocks (alternating red/white)
  const tecProRedMat = new PBRMaterial("tecProRedMat", scene);
  tecProRedMat.albedoColor = new Color3(0.76, 0.12, 0.12);
  tecProRedMat.roughness = 0.62;
  tecProRedMat.metallic = 0.05;
  const tecProWhiteMat = new PBRMaterial("tecProWhiteMat", scene);
  tecProWhiteMat.albedoColor = new Color3(0.84, 0.86, 0.88);
  tecProWhiteMat.roughness = 0.62;
  tecProWhiteMat.metallic = 0.05;

  const tecProRedMaster = MeshBuilder.CreateBox("tecProRed", { width: 0.75, height: 0.85, depth: 2.6 }, scene);
  tecProRedMaster.parent = root;
  tecProRedMaster.material = tecProRedMat;

  const tecProWhiteMaster = MeshBuilder.CreateBox("tecProWhite", { width: 0.75, height: 0.85, depth: 2.6 }, scene);
  tecProWhiteMaster.parent = root;
  tecProWhiteMaster.material = tecProWhiteMat;

  // Scan spline for sharp corners (curvature spikes)
  const scanSteps = 200;
  const cornerCandidates: { u: number; sign: number; curvature: number }[] = [];
  for (let i = 0; i < scanSteps; i++) {
    const u = i / scanSteps;
    const uNext = (u + 0.015) % 1;
    spline.getTangentAtToRef(u, tan);
    spline.getTangentAtToRef(uNext, nextTan);
    Vector3.CrossToRef(tan, nextTan, cross);
    const curv = Math.abs(cross.y);
    if (curv > 0.24) {
      cornerCandidates.push({ u, sign: Math.sign(cross.y) || 1, curvature: curv });
    }
  }

  // Pick distinct braking zones spaced at least 0.08 apart in u
  const placedBrakeZones: number[] = [];
  for (const c of cornerCandidates) {
    if (placedBrakeZones.some((uPrev) => Math.min(Math.abs(uPrev - c.u), 1 - Math.abs(uPrev - c.u)) < 0.09)) {
      continue;
    }
    placedBrakeZones.push(c.u);

    // Place TecPro wall blocks on outer corner edge
    for (let k = -2; k <= 2; k++) {
      const tu = ((c.u + k * 0.004) % 1 + 1) % 1;
      spline.getPointAtToRef(tu, pt);
      spline.getTangentAtToRef(tu, tan);
      Vector3.CrossToRef(tan, up, side);
      side.normalize();
      const outerSide = -c.sign; // Outside of turn
      const bPos = pt.add(side.scale(outerSide * (barrierOffset - 0.5)));
      bPos.y += 0.45;
      const yaw = Math.atan2(tan.x, tan.z);
      if (Math.abs(k) % 2 === 0) {
        tecProRedMaster.thinInstanceAdd(makeTransformMatrix(bPos, yaw));
      } else {
        tecProWhiteMaster.thinInstanceAdd(makeTransformMatrix(bPos, yaw));
      }
    }

    // Place 150 / 100 / 50m boards preceding the corner apex
    const boardOffsets = [0.032, 0.022, 0.012];
    for (let b = 0; b < 3; b++) {
      const bu = ((c.u - boardOffsets[b]) % 1 + 1) % 1;
      spline.getPointAtToRef(bu, pt);
      spline.getTangentAtToRef(bu, tan);
      Vector3.CrossToRef(tan, up, side);
      side.normalize();
      const outerSide = -c.sign;
      const boardPos = pt.add(side.scale(outerSide * (barrierOffset + 0.45)));
      boardPos.y += 1.05;
      const board = MeshBuilder.CreatePlane(`brakeBoard_${placedBrakeZones.length}_${b}`, { width: 1.5, height: 0.78 }, scene);
      board.parent = root;
      board.position.copyFrom(boardPos);
      // Face oncoming driver (opposite tangent)
      board.rotation.y = Math.atan2(-tan.x, -tan.z);
      board.material = boardMats[b];
    }

    if (placedBrakeZones.length >= 6) break;
  }

  // =========================================================================
  // 5. Trackside Sponsor Hoardings & Night Floodlight Towers (ThinInstance)
  // =========================================================================
  const hoardingMaster = MeshBuilder.CreateBox("hoardingMaster", { width: 0.18, height: 1.1, depth: 6.0 }, scene);
  hoardingMaster.parent = root;
  hoardingMaster.material = sponsorBoardMat;

  const hoardingCount = Math.floor(24 * density);
  for (let i = 0; i < hoardingCount; i++) {
    const u = (i / hoardingCount + 0.03) % 1;
    spline.getPointAtToRef(u, pt);
    spline.getTangentAtToRef(u, tan);
    Vector3.CrossToRef(tan, up, side);
    side.normalize();
    const sgn = i % 2 === 0 ? 1 : -1;
    const hPos = pt.add(side.scale(sgn * (barrierOffset + 1.2)));
    hPos.y += 0.65;
    hoardingMaster.thinInstanceAdd(makeTransformMatrix(hPos, Math.atan2(tan.x, tan.z)));
  }

  if (isNight) {
    const floodPoleMaster = MeshBuilder.CreateCylinder("floodPoleMaster", { diameter: 0.35, height: 15.0, tessellation: 8 }, scene);
    floodPoleMaster.parent = root;
    floodPoleMaster.material = darkMetalMat;

    const floodHeadMat = new StandardMaterial("floodHeadMat", scene);
    floodHeadMat.diffuseColor = new Color3(1.0, 0.98, 0.94);
    floodHeadMat.emissiveColor = new Color3(2.2, 2.1, 1.9);
    const floodHeadMaster = MeshBuilder.CreateBox("floodHeadMaster", { width: 2.2, height: 0.85, depth: 0.65 }, scene);
    floodHeadMaster.parent = root;
    floodHeadMaster.material = floodHeadMat;

    const lightCount = Math.floor(28 * density);
    for (let i = 0; i < lightCount; i++) {
      const u = i / lightCount;
      spline.getPointAtToRef(u, pt);
      spline.getTangentAtToRef(u, tan);
      Vector3.CrossToRef(tan, up, side);
      side.normalize();
      const sgn = i % 2 === 0 ? 1 : -1;
      const yaw = Math.atan2(tan.x, tan.z);

      const pPos = pt.add(side.scale(sgn * (barrierOffset + 4.5)));
      pPos.y += 7.5;
      floodPoleMaster.thinInstanceAdd(makeTransformMatrix(pPos, yaw));

      const hPos = pPos.clone();
      hPos.y += 7.4;
      floodHeadMaster.thinInstanceAdd(makeTransformMatrix(hPos, yaw + (sgn > 0 ? -Math.PI * 0.5 : Math.PI * 0.5)));
    }
  }

  // =========================================================================
  // 6. Circuit-Specific Biome Foliage & Landmarks (ThinInstance)
  // =========================================================================
  if (track.id === "monaco") {
    // Mediterranean Harbor Water Plane & Hillside Apartments
    const waterMesh = MeshBuilder.CreateGround("monacoHarborWater", { width: 900, height: 900 }, scene);
    waterMesh.parent = root;
    waterMesh.position.set(160, -2.5, 220);
    const waterMat = new PBRMaterial("monacoWaterMat", scene);
    waterMat.albedoColor = isNight ? new Color3(0.03, 0.08, 0.15) : new Color3(0.05, 0.24, 0.36);
    waterMat.metallic = 0.22;
    waterMat.roughness = isWet ? 0.08 : 0.14;
    waterMat.clearCoat.isEnabled = true;
    waterMat.clearCoat.intensity = 0.9;
    waterMat.clearCoat.roughness = 0.06;
    waterMesh.material = waterMat;

    const bldgMat = new PBRMaterial("monacoBldgMat", scene);
    bldgMat.albedoColor = new Color3(0.76, 0.72, 0.66);
    bldgMat.roughness = 0.82;
    bldgMat.metallic = 0.05;
    const bldgMaster = MeshBuilder.CreateBox("monacoBldgMaster", { width: 14, height: 22, depth: 14 }, scene);
    bldgMaster.parent = root;
    bldgMaster.material = bldgMat;

    const bCount = Math.floor(32 * density);
    const minBldgClearSq = (barrierOffset + 14.5) * (barrierOffset + 14.5);
    const checkBldgPt = new Vector3();
    for (let i = 0; i < bCount; i++) {
      const u = (i / bCount) % 1;
      spline.getPointAtToRef(u, pt);
      spline.getTangentAtToRef(u, tan);
      Vector3.CrossToRef(tan, up, side);
      side.normalize();
      const bPos = pt.add(side.scale(-(barrierOffset + 19 + (i % 3) * 14)));

      // Prevent buildings from intersecting adjacent track loops (e.g. pit straight / hairpin)
      let tooClose = false;
      for (let s = 0; s < spline.samples.length; s += 16) {
        checkBldgPt.copyFrom(spline.samples[s].point);
        const dx = bPos.x - checkBldgPt.x;
        const dz = bPos.z - checkBldgPt.z;
        if (dx * dx + dz * dz < minBldgClearSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const hScale = 0.6 + ((i * 37) % 10) * 0.14;
      bPos.y += 11 * hScale - 2.0;
      bldgMaster.thinInstanceAdd(makeTransformMatrix(bPos, Math.atan2(tan.x, tan.z), 1, hScale, 1));
    }
  } else {
    // Procedural Instanced Foliage (Conifer & Parkland Trees outside barriers)
    const trunkMat = new PBRMaterial("treeTrunkMat", scene);
    trunkMat.albedoColor = new Color3(0.24, 0.16, 0.11);
    trunkMat.roughness = 0.95;

    const canopyMat = new PBRMaterial("treeCanopyMat", scene);
    canopyMat.albedoColor = track.id === "spa" ? new Color3(0.09, 0.20, 0.11) : new Color3(0.14, 0.28, 0.13);
    canopyMat.roughness = 0.88;
    canopyMat.metallic = 0.0;

    const trunkMaster = MeshBuilder.CreateCylinder("treeTrunkMaster", { diameter: 0.55, height: 3.4, tessellation: 6 }, scene);
    trunkMaster.parent = root;
    trunkMaster.material = trunkMat;

    const canopyMaster = MeshBuilder.CreateCylinder(
      "treeCanopyMaster",
      { diameterTop: 0.2, diameterBottom: 4.8, height: 8.5, tessellation: 7 },
      scene
    );
    canopyMaster.parent = root;
    canopyMaster.material = canopyMat;

    const treeCount = Math.floor((track.id === "spa" ? 110 : 75) * density);
    const minTrackClearSq = (barrierOffset + 10.5) * (barrierOffset + 10.5);
    const checkPt = new Vector3();

    for (let i = 0; i < treeCount; i++) {
      const u = (i / treeCount + 0.007 * (i % 5)) % 1;
      spline.getPointAtToRef(u, pt);
      spline.getTangentAtToRef(u, tan);
      Vector3.CrossToRef(tan, up, side);
      side.normalize();
      const sgn = i % 2 === 0 ? 1 : -1;
      const distOut = barrierOffset + 15.0 + ((i * 17) % 24);
      const tPos = pt.add(side.scale(sgn * distOut));

      // Verify tree isn't colliding with another segment of a figure-8 / hairpin track
      let tooClose = false;
      for (let s = 0; s < spline.samples.length; s += 20) {
        checkPt.copyFrom(spline.samples[s].point);
        const dx = tPos.x - checkPt.x;
        const dz = tPos.z - checkPt.z;
        if (dx * dx + dz * dz < minTrackClearSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const scale = 0.75 + ((i * 29) % 10) * 0.07;
      const trunkPos = new Vector3(tPos.x, pt.y + 1.5 * scale - 1.5, tPos.z);
      const canopyPos = new Vector3(tPos.x, pt.y + 6.5 * scale - 1.5, tPos.z);
      trunkMaster.thinInstanceAdd(makeTransformMatrix(trunkPos, i * 0.5, scale, scale, scale));
      canopyMaster.thinInstanceAdd(makeTransformMatrix(canopyPos, i * 0.5, scale, scale, scale));
    }

    // Suzuka Iconic Skyline Ferris Wheel (oriented upright vertically)
    if (track.id === "suzuka") {
      const wheelPos = spline.getPointAt(0.25);
      const wheel = MeshBuilder.CreateTorus("suzukaFerrisWheel", { diameter: 48, thickness: 1.8, tessellation: 28 }, scene);
      wheel.parent = root;
      wheel.position.set(wheelPos.x - 105, wheelPos.y + 30, wheelPos.z + 70);
      wheel.rotation.x = Math.PI / 2;
      wheel.rotation.z = Math.PI / 5;
      wheel.material = standRoofMat;
    }
  }

  return {
    updateStartLights: (countdown: number | null) => {
      for (let i = 0; i < podMats.length; i++) {
        const mat = podMats[i];
        if (countdown === null) {
          mat.emissiveColor.set(0.02, 0.02, 0.02);
        } else if (countdown === 0) {
          mat.emissiveColor.set(0.15, 2.2, 0.45);
        } else if (i < 4 - countdown) {
          mat.emissiveColor.set(2.4, 0.08, 0.05);
        } else {
          mat.emissiveColor.set(0.02, 0.02, 0.02);
        }
      }
    }
  };
}
