// Formula Racing 3D — Broadcast-Grade Sculpted Ground-Effect PBR Formula Vehicle
import {
  Scene,
  MeshBuilder,
  Vector3,
  Matrix,
  Quaternion,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  TransformNode,
  Mesh,
  AbstractMesh,
  Curve3,
  SceneLoader
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { LIVERIES } from "@/data/liveries";
import { createVehicleMaterials } from "@/lib/babylon/VehicleMaterials";

const CONTACT_EPSILON = 0.002; // 2mm visual lift to prevent road clipping

interface WheelRig {
  wheelGroup: TransformNode;
  squishNode: TransformNode;
  spinNode: TransformNode;
  tireMesh: Mesh;
  contactPatch: Mesh;
  contactShadow: Mesh;
  radius: number;
  baseY: number;
  isFront: boolean;
}

export class BabylonVehicle {
  public root: TransformNode;
  public chassisGroup: TransformNode;
  public chassis: Mesh;
  public frontSteerNode: TransformNode;
  public steerWheel: Mesh;
  public wheelFL: Mesh;
  public wheelFR: Mesh;
  public wheelRL: Mesh;
  public wheelRR: Mesh;
  public contactPatchNodes: [Mesh, Mesh, Mesh, Mesh];
  public brakeDiscs: Mesh[] = [];
  public shadowCasters: AbstractMesh[] = [];
  public drsFlap: Mesh;
  public rainLightMat: PBRMaterial;

  // PBR Materials
  public bodyMat: PBRMaterial;
  public secondaryMat: PBRMaterial;
  public accentMat: PBRMaterial;
  public carbonMat: PBRMaterial;
  public brakeDiscMat: PBRMaterial;
  public helmetMat: PBRMaterial;
  private spokeMat: PBRMaterial;
  private blurredWheelMat: StandardMaterial;
  private sidewallMat: StandardMaterial;

  private wheelRigs: [WheelRig, WheelRig, WheelRig, WheelRig];
  private blurDiscs: Mesh[] = [];
  private wheelSpin: number = 0;
  private elapsedTime: number = 0;
  private readonly nominalWheelRadius = 0.36;

  // Pre-allocated scratch math objects for zero-allocation surface orientation
  private _surfRight = new Vector3();
  private _surfUp = new Vector3();
  private _surfFwd = new Vector3();
  private _rotMat = new Matrix();

  // Live steering wheel LCD state (throttled redraws, zero per-frame allocations)
  private dispTex: DynamicTexture | null = null;
  private dispCtx: CanvasRenderingContext2D | null = null;
  private lastHudDrawMs = 0;
  private lastDrawnGear = -99;
  private lastDrawnSpeed = -1;
  private lastDrawnDrs = false;

  /**
   * Optional async factory supporting CC0/MIT Draco-compressed GLTF/GLB models,
   * automatically falling back to the built-in sculpted procedural F1 chassis.
   */
  public static async CreateAsync(
    name: string,
    liveryIndex: number,
    scene: Scene,
    carNumber = 1,
    glbUrl?: string
  ): Promise<BabylonVehicle> {
    const vehicle = new BabylonVehicle(name, liveryIndex, scene, carNumber);
    if (glbUrl) {
      try {
        const result = await SceneLoader.ImportMeshAsync("", "", glbUrl, scene);
        if (result.meshes.length > 0) {
          const modelRoot = new TransformNode(`${name}_glbRoot`, scene);
          modelRoot.parent = vehicle.root;
          for (const mesh of result.meshes) {
            if (!mesh.parent) {
              mesh.parent = modelRoot;
            }
            vehicle.shadowCasters.push(mesh);
          }
          // Hide procedural body shell while retaining functional wheels/steer nodes
          vehicle.chassis.isVisible = false;
        }
      } catch (err) {
        console.warn("GLB vehicle import failed, keeping procedural F1 chassis:", err);
      }
    }
    return vehicle;
  }

  constructor(name: string, liveryIndex: number, scene: Scene, carNumber = 1) {
    const livery = LIVERIES[liveryIndex % LIVERIES.length];
    this.root = new TransformNode(name, scene);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.chassisGroup = new TransformNode(`${name}_chassisGroup`, scene);
    this.chassisGroup.parent = this.root;

    const mats = createVehicleMaterials(name, livery, carNumber, scene);
    this.bodyMat = mats.bodyMat;
    this.secondaryMat = mats.secondaryMat;
    this.accentMat = mats.accentMat;
    this.carbonMat = mats.carbonMat;
    this.brakeDiscMat = mats.brakeDiscMat;
    this.helmetMat = mats.helmetMat;
    this.rainLightMat = mats.rainLightMat;
    this.spokeMat = mats.spokeMat;
    this.blurredWheelMat = mats.blurredWheelMat;
    this.sidewallMat = mats.sidewallMat;

    // =========================================================================
    // 1. Soft Contact Ambient Occlusion Quad beneath floor (root sits at roadY)
    // =========================================================================
    const contactShadow = MeshBuilder.CreateGround(
      `${name}_contactAO`,
      { width: 2.35, height: 5.2 },
      scene
    );
    contactShadow.parent = this.root;
    contactShadow.position.set(0, 0.004, 0.28);
    contactShadow.material = mats.contactShadowMat;
    contactShadow.isPickable = false;

    // =========================================================================
    // 2. Ground-Effect Sculpted Floor Undertray & Venturi Edge Strakes
    // =========================================================================
    const floorUndertray = MeshBuilder.CreateBox(
      `${name}_floorUndertray`,
      { width: 1.66, height: 0.035, depth: 3.35 },
      scene
    );
    floorUndertray.parent = this.chassisGroup;
    floorUndertray.position.set(0, 0.145, 0.12);
    floorUndertray.material = this.carbonMat;
    this.shadowCasters.push(floorUndertray);

    for (const sgn of [-1, 1]) {
      const floorEdgeWing = MeshBuilder.CreateBox(
        `${name}_floorEdge_${sgn}`,
        { width: 0.06, height: 0.09, depth: 2.45 },
        scene
      );
      floorEdgeWing.parent = this.chassisGroup;
      floorEdgeWing.position.set(sgn * 0.84, 0.18, 0.05);
      floorEdgeWing.material = this.accentMat;
    }

    // Rear Diffuser Strakes
    for (let i = -1; i <= 1; i++) {
      const strake = MeshBuilder.CreateBox(
        `${name}_diffuser_${i}`,
        { width: 0.03, height: 0.14, depth: 0.45 },
        scene
      );
      strake.parent = this.chassisGroup;
      strake.position.set(i * 0.24, 0.19, -1.52);
      strake.rotation.x = 0.22;
      strake.material = this.carbonMat;
    }

    // =========================================================================
    // 3. Sculpted Monocoque Tub & Tapered Nose Cone (ExtrudeShapeCustom)
    // =========================================================================
    // Smooth oval monocoque profile in XY plane, extruded along Z
    const monocoqueShape: Vector3[] = [];
    const profileSteps = 14;
    for (let i = 0; i <= profileSteps; i++) {
      const theta = (i / profileSteps) * Math.PI * 2;
      const rx = 0.38 * Math.cos(theta);
      const ry = (Math.sin(theta) > 0 ? 0.24 : 0.16) * Math.sin(theta);
      monocoqueShape.push(new Vector3(rx, ry, 0));
    }

    const nosePath = [
      new Vector3(0, 0.36, -1.35), // Gearbox tail
      new Vector3(0, 0.40, -0.55), // Engine cover bulk
      new Vector3(0, 0.39, 0.25),  // Cockpit bulkhead
      new Vector3(0, 0.36, 1.05),  // Front suspension bulkhead
      new Vector3(0, 0.30, 1.85),  // Mid nose taper
      new Vector3(0, 0.23, 2.52)   // Nose tip
    ];

    this.chassis = MeshBuilder.ExtrudeShapeCustom(
      `${name}_chassis`,
      {
        shape: monocoqueShape,
        path: nosePath,
        scaleFunction: (i) => {
          // Taper aggressively forward of front bulkhead and backward at Coke-bottle rear
          if (i === 0) return 0.55;
          if (i === 1) return 1.06;
          if (i === 2) return 1.02;
          if (i === 3) return 0.88;
          if (i === 4) return 0.54;
          return 0.24;
        },
        updatable: false,
        cap: Mesh.CAP_ALL,
        sideOrientation: Mesh.DOUBLESIDE
      },
      scene
    );
    this.chassis.parent = this.chassisGroup;
    this.chassis.material = this.bodyMat;
    this.shadowCasters.push(this.chassis);

    // Sculpted Overhead Airbox Intake & Roll Hoop (T-Cam mount)
    const airbox = MeshBuilder.CreateCylinder(
      `${name}_airbox`,
      { diameterTop: 0.22, diameterBottom: 0.34, height: 0.72, tessellation: 14 },
      scene
    );
    airbox.parent = this.chassisGroup;
    airbox.rotation.x = Math.PI / 2 - 0.18;
    airbox.position.set(0, 0.74, -0.24);
    airbox.material = this.bodyMat;
    this.shadowCasters.push(airbox);

    // T-Cam Broadcast Pod atop Airbox
    const tCamPod = MeshBuilder.CreateBox(`${name}_tCamPod`, { width: 0.24, height: 0.045, depth: 0.12 }, scene);
    tCamPod.parent = this.chassisGroup;
    tCamPod.position.set(0, 0.96, -0.05);
    tCamPod.material = this.carbonMat;

    // Shark Fin Engine Cover Spine
    const fin = MeshBuilder.CreateBox(`${name}_fin`, { width: 0.035, height: 0.34, depth: 1.15 }, scene);
    fin.parent = this.chassisGroup;
    fin.position.set(0, 0.72, -0.78);
    fin.material = this.accentMat;

    // =========================================================================
    // 4. Sculpted Undercut Sidepods & Recessed Radiator Ducts
    // =========================================================================
    const sidepodProfile: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      sidepodProfile.push(new Vector3(0.24 * Math.cos(a), 0.18 * Math.sin(a), 0));
    }

    for (const sgn of [-1, 1]) {
      const sidepodPath = [
        new Vector3(sgn * 0.28, 0.30, -1.15),
        new Vector3(sgn * 0.56, 0.36, -0.45),
        new Vector3(sgn * 0.62, 0.38, 0.30),
        new Vector3(sgn * 0.58, 0.38, 0.78)
      ];
      const sidepod = MeshBuilder.ExtrudeShapeCustom(
        `${name}_sidepod_${sgn}`,
        {
          shape: sidepodProfile,
          path: sidepodPath,
          scaleFunction: (i) => (i === 0 ? 0.38 : i === 1 ? 0.85 : i === 2 ? 1.0 : 0.82),
          cap: Mesh.CAP_ALL,
          sideOrientation: Mesh.DOUBLESIDE
        },
        scene
      );
      sidepod.parent = this.chassisGroup;
      sidepod.material = this.secondaryMat;
      this.shadowCasters.push(sidepod);

      // Recessed Dark Radiator Inlet Scoop
      const intake = MeshBuilder.CreateBox(
        `${name}_intake_${sgn}`,
        { width: 0.32, height: 0.18, depth: 0.08 },
        scene
      );
      intake.parent = this.chassisGroup;
      intake.position.set(sgn * 0.58, 0.39, 0.80);
      intake.material = this.carbonMat;

      // Sidepod Rearview Mirror Stalk & Housing
      const mirror = MeshBuilder.CreateBox(
        `${name}_mirror_${sgn}`,
        { width: 0.14, height: 0.07, depth: 0.10 },
        scene
      );
      mirror.parent = this.chassisGroup;
      mirror.position.set(sgn * 0.48, 0.59, 0.52);
      mirror.material = this.bodyMat;
    }

    // =========================================================================
    // 5. Curved 3-Point Titanium Halo Safety Structure
    // =========================================================================
    const haloCurve = Curve3.CreateCatmullRomSpline(
      [
        new Vector3(-0.26, 0.58, 0.05),
        new Vector3(-0.25, 0.69, 0.32),
        new Vector3(0.0, 0.72, 0.58),
        new Vector3(0.25, 0.69, 0.32),
        new Vector3(0.26, 0.58, 0.05)
      ],
      16,
      false
    );
    const haloHoop = MeshBuilder.CreateTube(
      `${name}_haloHoop`,
      { path: haloCurve.getPoints(), radius: 0.032, tessellation: 12, cap: Mesh.CAP_ALL },
      scene
    );
    haloHoop.parent = this.chassisGroup;
    haloHoop.material = this.carbonMat;
    this.shadowCasters.push(haloHoop);

    const haloPillarCurve = Curve3.CreateCatmullRomSpline(
      [
        new Vector3(0, 0.45, 0.72),
        new Vector3(0, 0.61, 0.63),
        new Vector3(0, 0.72, 0.58)
      ],
      8,
      false
    );
    const haloPillar = MeshBuilder.CreateTube(
      `${name}_haloPillar`,
      { path: haloPillarCurve.getPoints(), radius: 0.028, tessellation: 10, cap: Mesh.CAP_ALL },
      scene
    );
    haloPillar.parent = this.chassisGroup;
    haloPillar.material = this.carbonMat;
    this.shadowCasters.push(haloPillar);

    // Driver Helmet, Iridescent Visor & Headrest Bolster
    const headrest = MeshBuilder.CreateBox(`${name}_headrest`, { width: 0.36, height: 0.14, depth: 0.28 }, scene);
    headrest.parent = this.chassisGroup;
    headrest.position.set(0, 0.56, 0.04);
    headrest.material = this.secondaryMat;

    const helmet = MeshBuilder.CreateSphere(`${name}_helmet`, { diameter: 0.27, segments: 14 }, scene);
    helmet.parent = this.chassisGroup;
    helmet.position.set(0, 0.57, 0.18);
    helmet.material = this.helmetMat;

    const visor = MeshBuilder.CreateBox(`${name}_visor`, { width: 0.20, height: 0.075, depth: 0.11 }, scene);
    visor.parent = helmet;
    visor.position.set(0, 0.02, 0.095);
    visor.material = mats.visorMat;

    // =========================================================================
    // 6. Live F1 Steering Wheel Yoke & Dynamic Telemetry LCD
    // =========================================================================
    this.steerWheel = MeshBuilder.CreateBox(`${name}_cockpitWheel`, { width: 0.26, height: 0.145, depth: 0.036 }, scene);
    this.steerWheel.parent = this.chassisGroup;
    this.steerWheel.position.set(0, 0.59, 0.56);
    this.steerWheel.rotation.x = -Math.PI / 7;
    this.steerWheel.material = this.carbonMat;

    const wheelDisplay = MeshBuilder.CreatePlane(`${name}_wheelDisplay`, { width: 0.16, height: 0.085 }, scene);
    wheelDisplay.parent = this.steerWheel;
    wheelDisplay.position.set(0, 0.01, -0.02);
    wheelDisplay.rotation.y = Math.PI; // Faces rearwards toward cockpit driver!

    const dispMat = new StandardMaterial(`${name}_steerDispMat`, scene);
    this.dispTex = new DynamicTexture(`${name}_steerDispTex`, { width: 256, height: 128 }, scene);
    this.dispCtx = this.dispTex.getContext() as CanvasRenderingContext2D;
    dispMat.diffuseTexture = this.dispTex;
    dispMat.emissiveTexture = this.dispTex;
    dispMat.disableLighting = true;
    wheelDisplay.material = dispMat;
    this.redrawSteeringLcd(1, 0, 0, false, true);

    // =========================================================================
    // 7. Multi-Element Front Wing, Swan-Neck Rear Wing, DRS & Titanium Exhaust
    // =========================================================================
    // 3 Stacked Front Wing Planes
    for (let el = 0; el < 3; el++) {
      const fwBlade = MeshBuilder.CreateBox(
        `${name}_fwBlade_${el}`,
        { width: 1.98 - el * 0.04, height: 0.025, depth: 0.18 },
        scene
      );
      fwBlade.parent = this.chassisGroup;
      fwBlade.position.set(0, 0.14 + el * 0.042, 2.44 - el * 0.14);
      fwBlade.rotation.x = -0.10 - el * 0.12;
      fwBlade.material = el === 0 ? this.carbonMat : el === 1 ? this.bodyMat : this.accentMat;
      this.shadowCasters.push(fwBlade);
    }

    for (const sgn of [-1, 1]) {
      const fwEndplate = MeshBuilder.CreateBox(
        `${name}_fwEndplate_${sgn}`,
        { width: 0.035, height: 0.25, depth: 0.52 },
        scene
      );
      fwEndplate.parent = this.chassisGroup;
      fwEndplate.position.set(sgn * 0.99, 0.24, 2.30);
      fwEndplate.rotation.z = sgn * -0.10;
      fwEndplate.material = this.accentMat;
      this.shadowCasters.push(fwEndplate);
    }

    // Rear Wing Mainplane + Swan-Neck Pylons + Curved Endplates + DRS Flap
    const rearWing = MeshBuilder.CreateBox(`${name}_rearWing`, { width: 1.62, height: 0.045, depth: 0.34 }, scene);
    rearWing.parent = this.chassisGroup;
    rearWing.position.set(0, 0.88, -1.56);
    rearWing.rotation.x = 0.16;
    rearWing.material = this.carbonMat;
    this.shadowCasters.push(rearWing);

    for (const sgn of [-1, 1]) {
      const pylon = MeshBuilder.CreateBox(`${name}_rwPylon_${sgn}`, { width: 0.03, height: 0.54, depth: 0.18 }, scene);
      pylon.parent = this.chassisGroup;
      pylon.position.set(sgn * 0.14, 0.64, -1.48);
      pylon.material = this.carbonMat;

      const rwEndplate = MeshBuilder.CreateBox(
        `${name}_rwEndplate_${sgn}`,
        { width: 0.035, height: 0.62, depth: 0.48 },
        scene
      );
      rwEndplate.parent = this.chassisGroup;
      rwEndplate.position.set(sgn * 0.82, 0.78, -1.56);
      rwEndplate.material = this.secondaryMat;
      this.shadowCasters.push(rwEndplate);
    }

    // Beam Wing
    const beamWing = MeshBuilder.CreateBox(`${name}_beamWing`, { width: 1.38, height: 0.035, depth: 0.24 }, scene);
    beamWing.parent = this.chassisGroup;
    beamWing.position.set(0, 0.48, -1.48);
    beamWing.rotation.x = 0.18;
    beamWing.material = this.carbonMat;

    // Heat-Tinted Titanium Central Exhaust Tailpipe
    const exhaust = MeshBuilder.CreateCylinder(
      `${name}_exhaust`,
      { diameter: 0.125, height: 0.28, tessellation: 14 },
      scene
    );
    exhaust.parent = this.chassisGroup;
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0.42, -1.42);
    exhaust.material = mats.exhaustMat;

    // Central FIA Rain / ERS Safety LED Light
    const rainLight = MeshBuilder.CreateBox(`${name}_rainLight`, { width: 0.11, height: 0.085, depth: 0.05 }, scene);
    rainLight.parent = this.chassisGroup;
    rainLight.position.set(0, 0.29, -1.60);
    rainLight.material = this.rainLightMat;

    // Active DRS Flap + Central Actuator Pod
    this.drsFlap = MeshBuilder.CreateBox(`${name}_drsFlap`, { width: 1.58, height: 0.04, depth: 0.22 }, scene);
    this.drsFlap.parent = this.chassisGroup;
    this.drsFlap.position.set(0, 0.99, -1.52);
    this.drsFlap.material = this.bodyMat;
    this.shadowCasters.push(this.drsFlap);

    const drsPod = MeshBuilder.CreateBox(`${name}_drsPod`, { width: 0.07, height: 0.09, depth: 0.24 }, scene);
    drsPod.parent = rearWing;
    drsPod.position.set(0, 0.08, 0.02);
    drsPod.material = this.carbonMat;

    // =========================================================================
    // 8. Suspension Wishbones & Pushrods (Front & Rear)
    // =========================================================================
    const addWishboneArm = (pA: Vector3, pB: Vector3, armName: string) => {
      const arm = MeshBuilder.CreateTube(
        armName,
        { path: [pA, pB], radius: 0.016, tessellation: 6 },
        scene
      );
      arm.parent = this.chassisGroup;
      arm.material = this.carbonMat;
    };

    for (const sgn of [-1, 1]) {
      // Front upper & lower wishbone + pushrod
      addWishboneArm(new Vector3(sgn * 0.22, 0.42, 1.56), new Vector3(sgn * 0.88, 0.39, 1.45), `${name}_fUpF_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.22, 0.40, 1.24), new Vector3(sgn * 0.88, 0.39, 1.45), `${name}_fUpR_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.20, 0.22, 1.52), new Vector3(sgn * 0.88, 0.28, 1.45), `${name}_fLoF_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.20, 0.22, 1.26), new Vector3(sgn * 0.88, 0.28, 1.45), `${name}_fLoR_${sgn}`);

      // Rear upper & lower wishbone
      addWishboneArm(new Vector3(sgn * 0.22, 0.42, -1.00), new Vector3(sgn * 0.90, 0.40, -1.15), `${name}_rUpF_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.22, 0.40, -1.32), new Vector3(sgn * 0.90, 0.40, -1.15), `${name}_rUpR_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.20, 0.22, -1.02), new Vector3(sgn * 0.90, 0.28, -1.15), `${name}_rLoF_${sgn}`);
      addWishboneArm(new Vector3(sgn * 0.20, 0.22, -1.30), new Vector3(sgn * 0.90, 0.28, -1.15), `${name}_rLoR_${sgn}`);
    }

    // =========================================================================
    // 9. Wheel Assemblies: Bounds-Locked Ground Contact, Per-Wheel AO, Squish & Blur
    // =========================================================================
    const createWheelRig = (
      wheelName: string,
      isFront: boolean,
      sideSign: number,
      xOffset: number,
      zOffset: number
    ): WheelRig => {
      const wheelWidth = isFront ? 0.34 : 0.44;
      const wheelGroup = new TransformNode(`${wheelName}_group`, scene);
      wheelGroup.parent = this.root;

      // Squish pivot sits at tire contact patch; spinNode sits at hub center inside squishNode
      const squishNode = new TransformNode(`${wheelName}_squish`, scene);
      squishNode.parent = wheelGroup;

      const spinNode = new TransformNode(`${wheelName}_spin`, scene);
      spinNode.parent = squishNode;

      const tireMesh = MeshBuilder.CreateCylinder(
        wheelName,
        { diameter: this.nominalWheelRadius * 2, height: wheelWidth, tessellation: 32 },
        scene
      );
      tireMesh.parent = spinNode;
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.material = mats.rubberMat;
      this.shadowCasters.push(tireMesh);

      // Compute true wheel radius from actual geometry bounding box
      tireMesh.computeWorldMatrix(true);
      const bounds = tireMesh.getHierarchyBoundingVectors(true);
      const measuredSpanY = bounds.max.y - bounds.min.y;
      const wheelRadius = Number.isFinite(measuredSpanY) && measuredSpanY > 0.1
        ? measuredSpanY * 0.5
        : this.nominalWheelRadius;
      const baseY = wheelRadius + CONTACT_EPSILON;

      // Anchor wheelGroup at exact road contact height (root sits at roadY)
      wheelGroup.position.set(xOffset, baseY, zOffset);
      squishNode.position.set(0, -wheelRadius, 0);
      spinNode.position.set(0, wheelRadius, 0);

      // Per-Wheel Contact Shadow (Ambient Occlusion hugging the road under the rubber)
      const wheelContactShadow = MeshBuilder.CreateGround(
        `${wheelName}_contactShadow`,
        { width: wheelWidth * 1.45, height: wheelRadius * 2.25 },
        scene
      );
      wheelContactShadow.parent = wheelGroup;
      wheelContactShadow.position.set(0, -wheelRadius + 0.002, 0);
      wheelContactShadow.material = mats.wheelContactShadowMat;
      wheelContactShadow.isPickable = false;

      // Invisible contact-patch anchor at bottom-rear of tire for smoke/spray particles
      const contactPatch = MeshBuilder.CreateBox(
        `${wheelName}_contactPatch`,
        { size: 0.02 },
        scene
      );
      contactPatch.parent = wheelGroup;
      contactPatch.position.set(0, -wheelRadius + 0.04, -wheelRadius * 0.55);
      contactPatch.isVisible = false;
      contactPatch.isPickable = false;

      // Recessed Alloy Wheel Rim Barrel (stays opaque behind spokes/blur)
      const rim = MeshBuilder.CreateCylinder(
        `${wheelName}_rim`,
        { diameter: wheelRadius * 1.32, height: wheelWidth + 0.006, tessellation: 24 },
        scene
      );
      rim.parent = spinNode;
      rim.rotation.z = Math.PI / 2;
      rim.material = mats.rimMat;

      // Crisp Wheel Spokes (5 spoke bars, crossfades out at high speed)
      for (let s = 0; s < 5; s++) {
        const spoke = MeshBuilder.CreateBox(
          `${wheelName}_spoke_${s}`,
          { width: 0.032, height: wheelWidth + 0.015, depth: wheelRadius * 1.24 },
          scene
        );
        spoke.parent = spinNode;
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (s / 5) * Math.PI;
        spoke.material = mats.spokeMat;
      }

      // Center Lock Nut
      const nut = MeshBuilder.CreateCylinder(
        `${wheelName}_nut`,
        { diameter: 0.11, height: wheelWidth + 0.035, tessellation: 8 },
        scene
      );
      nut.parent = spinNode;
      nut.rotation.z = Math.PI / 2;
      nut.material = this.accentMat;

      // Tire Compound Sidewall Stripe (in YZ plane around X axle)
      const sidewallRing = MeshBuilder.CreateTorus(
        `${wheelName}_sidewall`,
        { diameter: wheelRadius * 1.56, thickness: 0.014, tessellation: 24 },
        scene
      );
      sidewallRing.parent = spinNode;
      sidewallRing.rotation.z = Math.PI / 2;
      sidewallRing.position.x = sideSign * (wheelWidth * 0.48);
      sidewallRing.material = mats.sidewallMat;

      // Radial Motion-Blur Sidewall & Spoke Overlay Discs (kills wagon-wheel strobing >25 m/s)
      for (const faceSign of [-1, 1]) {
        const blurDisc = MeshBuilder.CreateDisc(
          `${wheelName}_blur_${faceSign}`,
          { radius: wheelRadius * 0.95, tessellation: 32, sideOrientation: Mesh.DOUBLESIDE },
          scene
        );
        blurDisc.parent = spinNode;
        blurDisc.rotation.y = Math.PI / 2;
        blurDisc.position.x = faceSign * (wheelWidth * 0.5 + 0.004);
        blurDisc.material = mats.blurredWheelMat;
        blurDisc.isPickable = false;
        blurDisc.isVisible = false;
        this.blurDiscs.push(blurDisc);
      }

      // Ventilated Carbon Brake Disc (spins with hub)
      const disc = MeshBuilder.CreateCylinder(
        `${wheelName}_disc`,
        { diameter: 0.27 * 2, height: 0.038, tessellation: 20 },
        scene
      );
      disc.parent = spinNode;
      disc.rotation.z = Math.PI / 2;
      disc.material = this.brakeDiscMat;
      this.brakeDiscs.push(disc);

      // Anodized Brake Caliper (fixed to non-spinning wheelGroup)
      const caliper = MeshBuilder.CreateBox(
        `${wheelName}_caliper`,
        { width: 0.16, height: 0.12, depth: 0.16 },
        scene
      );
      caliper.parent = wheelGroup;
      caliper.position.set(-sideSign * 0.12, 0.04, -0.14);
      caliper.material = mats.caliperMat;

      return {
        wheelGroup,
        squishNode,
        spinNode,
        tireMesh,
        contactPatch,
        contactShadow: wheelContactShadow,
        radius: wheelRadius,
        baseY,
        isFront
      };
    };

    // Legacy steer node handle retained for structural compatibility
    this.frontSteerNode = new TransformNode(`${name}_frontSteer`, scene);
    this.frontSteerNode.parent = this.root;
    this.frontSteerNode.position.set(0, this.nominalWheelRadius + CONTACT_EPSILON, 1.45);

    const rigFL = createWheelRig(`${name}_wheelFL`, true, -1, -0.94, 1.45);
    const rigFR = createWheelRig(`${name}_wheelFR`, true, 1, 0.94, 1.45);
    const rigRL = createWheelRig(`${name}_wheelRL`, false, -1, -0.98, -1.15);
    const rigRR = createWheelRig(`${name}_wheelRR`, false, 1, 0.98, -1.15);

    this.wheelRigs = [rigFL, rigFR, rigRL, rigRR];
    this.wheelFL = rigFL.tireMesh;
    this.wheelFR = rigFR.tireMesh;
    this.wheelRL = rigRL.tireMesh;
    this.wheelRR = rigRR.tireMesh;
    this.contactPatchNodes = [
      rigFL.contactPatch,
      rigFR.contactPatch,
      rigRL.contactPatch,
      rigRR.contactPatch
    ];
  }

  private redrawSteeringLcd(
    gear: number,
    speedKmh: number,
    rpmRatio: number,
    drsActive: boolean,
    force = false
  ): void {
    const ctx = this.dispCtx;
    const tex = this.dispTex;
    if (!ctx || !tex) return;

    const now = performance.now();
    if (!force && now - this.lastHudDrawMs < 65) return;
    if (
      !force &&
      gear === this.lastDrawnGear &&
      speedKmh === this.lastDrawnSpeed &&
      drsActive === this.lastDrawnDrs &&
      rpmRatio < 0.75
    ) {
      return;
    }

    this.lastHudDrawMs = now;
    this.lastDrawnGear = gear;
    this.lastDrawnSpeed = speedKmh;
    this.lastDrawnDrs = drsActive;

    ctx.fillStyle = "#050914";
    ctx.fillRect(0, 0, 256, 128);

    // Progressive Shift LEDs (10 LEDs)
    const activeLeds = Math.floor(Math.max(0, Math.min(1, rpmRatio)) * 10);
    for (let i = 0; i < 10; i++) {
      const isLit = i < activeLeds;
      if (!isLit) {
        ctx.fillStyle = "#1e293b";
      } else if (i < 4) {
        ctx.fillStyle = "#22c55e";
      } else if (i < 7) {
        ctx.fillStyle = "#eab308";
      } else {
        ctx.fillStyle = rpmRatio > 0.93 ? "#38bdf8" : "#ef4444";
      }
      ctx.fillRect(14 + i * 23, 10, 17, 12);
    }

    // Center Gear Display
    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gear === -1 ? "R" : String(Math.max(1, gear)), 128, 66);

    // DRS Badge & Live Speed
    ctx.textAlign = "left";
    ctx.fillStyle = drsActive ? "#10b981" : "#475569";
    ctx.font = "bold 20px monospace";
    ctx.fillText(drsActive ? "DRS ON" : "DRS", 14, 110);

    ctx.textAlign = "right";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`${Math.max(0, Math.round(speedKmh))} KMH`, 242, 110);

    tex.update();
  }

  /**
   * Aligns vehicle root to the exact road surface tangent & banking normal (zero allocations).
   */
  public setRoadOrientation(forward: Vector3, surfaceNormal: Vector3): void {
    if (!this.root.rotationQuaternion) {
      this.root.rotationQuaternion = Quaternion.Identity();
    }
    this._surfFwd.copyFrom(forward);
    if (this._surfFwd.lengthSquared() < 1e-6) {
      this._surfFwd.set(0, 0, 1);
    } else {
      this._surfFwd.normalize();
    }

    this._surfUp.copyFrom(surfaceNormal);
    if (this._surfUp.lengthSquared() < 1e-6) {
      this._surfUp.set(0, 1, 0);
    } else {
      this._surfUp.normalize();
    }

    Vector3.CrossToRef(this._surfUp, this._surfFwd, this._surfRight);
    if (this._surfRight.lengthSquared() < 1e-6) {
      this._surfRight.set(1, 0, 0);
    } else {
      this._surfRight.normalize();
    }
    Vector3.CrossToRef(this._surfFwd, this._surfRight, this._surfUp);
    this._surfUp.normalize();

    Matrix.FromValuesToRef(
      this._surfRight.x, this._surfRight.y, this._surfRight.z, 0,
      this._surfUp.x, this._surfUp.y, this._surfUp.z, 0,
      this._surfFwd.x, this._surfFwd.y, this._surfFwd.z, 0,
      0, 0, 0, 1,
      this._rotMat
    );
    Quaternion.FromRotationMatrixToRef(this._rotMat, this.root.rotationQuaternion);
  }

  public update(
    speed: number,
    steerAngle: number,
    dt: number,
    isBraking: boolean,
    brakeTemp: number,
    drsActive: boolean,
    gear = 1,
    rpmRatio = 0,
    suspensionOffsets?: [number, number, number, number],
    chassisPitch = 0,
    chassisRoll = 0
  ) {
    const safeSpeed = Number.isFinite(speed) ? speed : 0;
    const safeSteer = Number.isFinite(steerAngle) ? steerAngle : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;
    const safeBrakeTemp = Number.isFinite(brakeTemp) ? brakeTemp : 100;
    const absSpeed = Math.abs(safeSpeed);

    this.elapsedTime += safeDt;
    const speedFactor = Math.min(absSpeed / 80, 1.0);

    // 1. Exact angular wheel spin locked to forward speed: dTheta = (v * dt) / r
    const deltaRotation = (safeSpeed / this.wheelRigs[0].radius) * safeDt;
    this.wheelSpin = (this.wheelSpin + deltaRotation) % (Math.PI * 2);

    // 2. High-speed radial blur crossfade (kills wagon-wheel strobing above ~20 m/s)
    const blurBlend = Math.max(0, Math.min(1, (absSpeed - 20) / 30));
    this.spokeMat.alpha = 1.0 - blurBlend * 0.92;
    this.sidewallMat.alpha = 1.0 - blurBlend * 0.92;
    this.blurredWheelMat.alpha = blurBlend;
    const showBlur = blurBlend > 0.01;
    for (let i = 0; i < this.blurDiscs.length; i++) {
      this.blurDiscs[i].isVisible = showBlur;
    }

    // 3. Per-wheel steering, spin, micro-suspension vibration & bottom-anchored tire squish
    const frontSteerRad = safeSteer * 0.45;
    const squish = Math.max(0.955, 1.0 - 0.03 * speedFactor - (isBraking && absSpeed > 5 ? 0.012 * speedFactor : 0));
    const squishWidening = 1.0 + (1.0 - squish) * 0.5;

    for (let i = 0; i < 4; i++) {
      const rig = this.wheelRigs[i];
      rig.spinNode.rotation.x += (safeSpeed / rig.radius) * safeDt;

      if (rig.isFront) {
        rig.wheelGroup.rotation.y = frontSteerRad;
      }

      // Micro-bump vibration biased so tire bottom stays flush above roadY
      const roadVibration = Math.sin(this.elapsedTime * 55 + i * 1.7) * 0.003 * speedFactor;
      const suspUp = suspensionOffsets ? Math.max(0, Math.min(0.035, suspensionOffsets[i] * 0.35)) : 0;
      rig.wheelGroup.position.y = Math.max(rig.radius + 0.001, rig.baseY + suspUp + roadVibration);

      // Vertical tire squish anchored at road contact patch
      rig.squishNode.scaling.set(squishWidening, squish, 1.0);
    }

    // Cockpit steering wheel animation
    this.steerWheel.rotation.z = -safeSteer * 1.35;

    // 4. Chassis suspension dive/squat/roll & aero compression (tires remain planted on road)
    const safePitch = Number.isFinite(chassisPitch) ? chassisPitch : 0;
    const safeRoll = Number.isFinite(chassisRoll) ? chassisRoll : 0;
    this.chassisGroup.rotation.x = safePitch;
    this.chassisGroup.rotation.z = safeRoll;
    this.chassisGroup.position.y = -0.018 * speedFactor;

    // DRS Flap
    this.drsFlap.rotation.x = drsActive ? -0.38 : 0;
    this.drsFlap.position.y = drsActive ? 1.06 : 0.99;

    // Brake disc thermal emissive glow
    const rawRatio = (safeBrakeTemp - 450) / 450;
    const glowRatio = Number.isFinite(rawRatio) ? Math.max(0, Math.min(1, rawRatio)) : 0;
    this.brakeDiscMat.emissiveIntensity = glowRatio * 5.0;
    this.brakeDiscMat.emissiveColor.set(1.0, glowRatio * 0.38, 0.0);

    // Live steering wheel LCD update (throttled ~15 Hz)
    this.redrawSteeringLcd(gear, Math.round(safeSpeed * 3.6), rpmRatio, drsActive);
  }

  public dispose() {
    this.root.dispose();
  }
}
