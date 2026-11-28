// Formula Racing 3D — Broadcast-Grade Sculpted Ground-Effect PBR Formula Vehicle
import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  PBRMaterial,
  StandardMaterial,
  DynamicTexture,
  TransformNode,
  Mesh,
  AbstractMesh,
  Curve3,
  Space,
  SceneLoader
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { LIVERIES } from "@/data/liveries";
import { createVehicleMaterials } from "@/lib/babylon/VehicleMaterials";

export class BabylonVehicle {
  public root: TransformNode;
  public chassis: Mesh;
  public frontSteerNode: TransformNode;
  public steerWheel: Mesh;
  public wheelFL: Mesh;
  public wheelFR: Mesh;
  public wheelRL: Mesh;
  public wheelRR: Mesh;
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

  private wheelSpin: number = 0;
  private readonly wheelRadius = 0.36;
  private readonly baseWheelY = 0.36;

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

    const mats = createVehicleMaterials(name, livery, carNumber, scene);
    this.bodyMat = mats.bodyMat;
    this.secondaryMat = mats.secondaryMat;
    this.accentMat = mats.accentMat;
    this.carbonMat = mats.carbonMat;
    this.brakeDiscMat = mats.brakeDiscMat;
    this.helmetMat = mats.helmetMat;
    this.rainLightMat = mats.rainLightMat;

    // =========================================================================
    // 1. Soft Contact Ambient Occlusion Quad beneath floor
    // =========================================================================
    const contactShadow = MeshBuilder.CreateGround(
      `${name}_contactAO`,
      { width: 2.35, height: 5.2 },
      scene
    );
    contactShadow.parent = this.root;
    contactShadow.position.set(0, 0.036, 0.28);
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
    floorUndertray.parent = this.root;
    floorUndertray.position.set(0, 0.145, 0.12);
    floorUndertray.material = this.carbonMat;
    this.shadowCasters.push(floorUndertray);

    for (const sgn of [-1, 1]) {
      const floorEdgeWing = MeshBuilder.CreateBox(
        `${name}_floorEdge_${sgn}`,
        { width: 0.06, height: 0.09, depth: 2.45 },
        scene
      );
      floorEdgeWing.parent = this.root;
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
      strake.parent = this.root;
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
    this.chassis.parent = this.root;
    this.chassis.material = this.bodyMat;
    this.shadowCasters.push(this.chassis);

    // Sculpted Overhead Airbox Intake & Roll Hoop (T-Cam mount)
    const airbox = MeshBuilder.CreateCylinder(
      `${name}_airbox`,
      { diameterTop: 0.22, diameterBottom: 0.34, height: 0.72, tessellation: 14 },
      scene
    );
    airbox.parent = this.root;
    airbox.rotation.x = Math.PI / 2 - 0.18;
    airbox.position.set(0, 0.74, -0.24);
    airbox.material = this.bodyMat;
    this.shadowCasters.push(airbox);

    // T-Cam Broadcast Pod atop Airbox
    const tCamPod = MeshBuilder.CreateBox(`${name}_tCamPod`, { width: 0.24, height: 0.045, depth: 0.12 }, scene);
    tCamPod.parent = this.root;
    tCamPod.position.set(0, 0.96, -0.05);
    tCamPod.material = this.carbonMat;

    // Shark Fin Engine Cover Spine
    const fin = MeshBuilder.CreateBox(`${name}_fin`, { width: 0.035, height: 0.34, depth: 1.15 }, scene);
    fin.parent = this.root;
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
      sidepod.parent = this.root;
      sidepod.material = this.secondaryMat;
      this.shadowCasters.push(sidepod);

      // Recessed Dark Radiator Inlet Scoop
      const intake = MeshBuilder.CreateBox(
        `${name}_intake_${sgn}`,
        { width: 0.32, height: 0.18, depth: 0.08 },
        scene
      );
      intake.parent = this.root;
      intake.position.set(sgn * 0.58, 0.39, 0.80);
      intake.material = this.carbonMat;

      // Sidepod Rearview Mirror Stalk & Housing
      const mirror = MeshBuilder.CreateBox(
        `${name}_mirror_${sgn}`,
        { width: 0.14, height: 0.07, depth: 0.10 },
        scene
      );
      mirror.parent = this.root;
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
    haloHoop.parent = this.root;
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
    haloPillar.parent = this.root;
    haloPillar.material = this.carbonMat;
    this.shadowCasters.push(haloPillar);

    // Driver Helmet, Iridescent Visor & Headrest Bolster
    const headrest = MeshBuilder.CreateBox(`${name}_headrest`, { width: 0.36, height: 0.14, depth: 0.28 }, scene);
    headrest.parent = this.root;
    headrest.position.set(0, 0.56, 0.04);
    headrest.material = this.secondaryMat;

    const helmet = MeshBuilder.CreateSphere(`${name}_helmet`, { diameter: 0.27, segments: 14 }, scene);
    helmet.parent = this.root;
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
    this.steerWheel.parent = this.root;
    this.steerWheel.position.set(0, 0.52, 0.54);
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
      fwBlade.parent = this.root;
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
      fwEndplate.parent = this.root;
      fwEndplate.position.set(sgn * 0.99, 0.24, 2.30);
      fwEndplate.rotation.z = sgn * -0.10;
      fwEndplate.material = this.accentMat;
      this.shadowCasters.push(fwEndplate);
    }

    // Rear Wing Mainplane + Swan-Neck Pylons + Curved Endplates + DRS Flap
    const rearWing = MeshBuilder.CreateBox(`${name}_rearWing`, { width: 1.62, height: 0.045, depth: 0.34 }, scene);
    rearWing.parent = this.root;
    rearWing.position.set(0, 0.88, -1.56);
    rearWing.rotation.x = 0.16;
    rearWing.material = this.carbonMat;
    this.shadowCasters.push(rearWing);

    for (const sgn of [-1, 1]) {
      const pylon = MeshBuilder.CreateBox(`${name}_rwPylon_${sgn}`, { width: 0.03, height: 0.54, depth: 0.18 }, scene);
      pylon.parent = this.root;
      pylon.position.set(sgn * 0.14, 0.64, -1.48);
      pylon.material = this.carbonMat;

      const rwEndplate = MeshBuilder.CreateBox(
        `${name}_rwEndplate_${sgn}`,
        { width: 0.035, height: 0.62, depth: 0.48 },
        scene
      );
      rwEndplate.parent = this.root;
      rwEndplate.position.set(sgn * 0.82, 0.78, -1.56);
      rwEndplate.material = this.secondaryMat;
      this.shadowCasters.push(rwEndplate);
    }

    // Beam Wing
    const beamWing = MeshBuilder.CreateBox(`${name}_beamWing`, { width: 1.38, height: 0.035, depth: 0.24 }, scene);
    beamWing.parent = this.root;
    beamWing.position.set(0, 0.48, -1.48);
    beamWing.rotation.x = 0.18;
    beamWing.material = this.carbonMat;

    // Heat-Tinted Titanium Central Exhaust Tailpipe
    const exhaust = MeshBuilder.CreateCylinder(
      `${name}_exhaust`,
      { diameter: 0.125, height: 0.28, tessellation: 14 },
      scene
    );
    exhaust.parent = this.root;
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0.42, -1.42);
    exhaust.material = mats.exhaustMat;

    // Central FIA Rain / ERS Safety LED Light
    const rainLight = MeshBuilder.CreateBox(`${name}_rainLight`, { width: 0.11, height: 0.085, depth: 0.05 }, scene);
    rainLight.parent = this.root;
    rainLight.position.set(0, 0.29, -1.60);
    rainLight.material = this.rainLightMat;

    // Active DRS Flap + Central Actuator Pod
    this.drsFlap = MeshBuilder.CreateBox(`${name}_drsFlap`, { width: 1.58, height: 0.04, depth: 0.22 }, scene);
    this.drsFlap.parent = this.root;
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
      arm.parent = this.root;
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
    // 9. Wheel Assemblies with Multi-Spoke Rims, Brake Discs & Calipers
    // =========================================================================
    const createWheel = (wheelName: string, isFront: boolean, sideSign: number) => {
      const wheelWidth = isFront ? 0.34 : 0.44;
      const wheelMesh = MeshBuilder.CreateCylinder(
        wheelName,
        { diameter: this.wheelRadius * 2, height: wheelWidth, tessellation: 32 },
        scene
      );
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.material = mats.rubberMat;
      this.shadowCasters.push(wheelMesh);

      // Recessed Alloy Wheel Rim
      const rim = MeshBuilder.CreateCylinder(
        `${wheelName}_rim`,
        { diameter: this.wheelRadius * 1.32, height: wheelWidth + 0.008, tessellation: 22 },
        scene
      );
      rim.parent = wheelMesh;
      rim.material = mats.rimMat;

      // Wheel Spokes (5 spoke bars intersecting rim)
      for (let s = 0; s < 5; s++) {
        const spoke = MeshBuilder.CreateBox(
          `${wheelName}_spoke_${s}`,
          { width: 0.032, height: wheelWidth + 0.015, depth: this.wheelRadius * 1.24 },
          scene
        );
        spoke.parent = wheelMesh;
        spoke.rotation.y = (s / 5) * Math.PI;
        spoke.material = mats.rimMat;
      }

      // Center Lock Nut
      const nut = MeshBuilder.CreateCylinder(
        `${wheelName}_nut`,
        { diameter: 0.11, height: wheelWidth + 0.035, tessellation: 8 },
        scene
      );
      nut.parent = wheelMesh;
      nut.material = this.accentMat;

      // Tire Compound Sidewall Stripe
      const sidewallRing = MeshBuilder.CreateTorus(
        `${wheelName}_sidewall`,
        { diameter: this.wheelRadius * 1.56, thickness: 0.014, tessellation: 24 },
        scene
      );
      sidewallRing.parent = wheelMesh;
      sidewallRing.rotation.x = Math.PI / 2;
      sidewallRing.position.y = sideSign * (wheelWidth * 0.48);
      sidewallRing.material = mats.sidewallMat;

      // Ventilated Carbon Brake Disc
      const disc = MeshBuilder.CreateCylinder(
        `${wheelName}_disc`,
        { diameter: 0.27 * 2, height: 0.038, tessellation: 20 },
        scene
      );
      disc.parent = wheelMesh;
      disc.material = this.brakeDiscMat;
      this.brakeDiscs.push(disc);

      // Anodized Brake Caliper
      const caliper = MeshBuilder.CreateBox(
        `${wheelName}_caliper`,
        { width: 0.08, height: 0.12, depth: 0.16 },
        scene
      );
      caliper.parent = wheelMesh;
      caliper.position.set(0, 0.18, 0);
      caliper.material = mats.caliperMat;

      return wheelMesh;
    };

    // Front Steer Assembly Node
    this.frontSteerNode = new TransformNode(`${name}_frontSteer`, scene);
    this.frontSteerNode.parent = this.root;
    this.frontSteerNode.position.set(0, this.baseWheelY, 1.45);

    this.wheelFL = createWheel(`${name}_wheelFL`, true, -1);
    this.wheelFL.parent = this.frontSteerNode;
    this.wheelFL.position.set(-0.94, 0, 0);

    this.wheelFR = createWheel(`${name}_wheelFR`, true, 1);
    this.wheelFR.parent = this.frontSteerNode;
    this.wheelFR.position.set(0.94, 0, 0);

    // Rear Wheels Node
    const rearNode = new TransformNode(`${name}_rearNode`, scene);
    rearNode.parent = this.root;
    rearNode.position.set(0, this.baseWheelY, -1.15);

    this.wheelRL = createWheel(`${name}_wheelRL`, false, -1);
    this.wheelRL.parent = rearNode;
    this.wheelRL.position.set(-0.98, 0, 0);

    this.wheelRR = createWheel(`${name}_wheelRR`, false, 1);
    this.wheelRR.parent = rearNode;
    this.wheelRR.position.set(0.98, 0, 0);
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

  public update(
    speed: number,
    steerAngle: number,
    dt: number,
    isBraking: boolean,
    brakeTemp: number,
    drsActive: boolean,
    gear = 1,
    rpmRatio = 0,
    suspensionOffsets?: [number, number, number, number]
  ) {
    const safeSpeed = Number.isFinite(speed) ? speed : 0;
    const safeSteer = Number.isFinite(steerAngle) ? steerAngle : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;
    const safeBrakeTemp = Number.isFinite(brakeTemp) ? brakeTemp : 100;

    // Wheel spin rotation
    const angularSpeed = safeSpeed / this.wheelRadius;
    const deltaRotation = angularSpeed * safeDt;
    this.wheelSpin = (this.wheelSpin + deltaRotation) % (Math.PI * 2);

    this.wheelFL.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelFR.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelRL.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelRR.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);

    // Front wheel steering & cockpit steering wheel animation
    this.frontSteerNode.rotation.y = safeSteer * 0.45;
    this.steerWheel.rotation.z = -safeSteer * 1.35;

    // 4-wheel suspension travel (zero allocations)
    if (suspensionOffsets) {
      this.wheelFL.position.y = Math.max(-0.08, Math.min(0.08, suspensionOffsets[0]));
      this.wheelFR.position.y = Math.max(-0.08, Math.min(0.08, suspensionOffsets[1]));
      this.wheelRL.position.y = Math.max(-0.08, Math.min(0.08, suspensionOffsets[2]));
      this.wheelRR.position.y = Math.max(-0.08, Math.min(0.08, suspensionOffsets[3]));
    }

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
