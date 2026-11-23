// Formula Racing 3D — Babylon.js Automotive PBR Vehicle
import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  PBRMaterial,
  TransformNode,
  Mesh,
  Space
} from "@babylonjs/core";
import { LIVERIES } from "@/data/liveries";

export class BabylonVehicle {
  public root: TransformNode;
  public chassis: Mesh;
  public frontSteerNode: TransformNode;
  public wheelFL: Mesh;
  public wheelFR: Mesh;
  public wheelRL: Mesh;
  public wheelRR: Mesh;
  public brakeDiscs: Mesh[] = [];
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

  constructor(name: string, liveryIndex: number, scene: Scene) {
    const livery = LIVERIES[liveryIndex % LIVERIES.length];
    this.root = new TransformNode(name, scene);

    // 1. Automotive Clearcoat Bodywork Material
    this.bodyMat = new PBRMaterial(`${name}_bodyMat`, scene);
    this.bodyMat.albedoColor = Color3.FromHexString(livery.primary);
    this.bodyMat.metallic = 0.72;
    this.bodyMat.roughness = 0.18;
    this.bodyMat.clearCoat.isEnabled = true;
    this.bodyMat.clearCoat.roughness = 0.05;
    this.bodyMat.clearCoat.intensity = 1.0;

    this.secondaryMat = new PBRMaterial(`${name}_secondaryMat`, scene);
    this.secondaryMat.albedoColor = Color3.FromHexString(livery.secondary);
    this.secondaryMat.metallic = 0.65;
    this.secondaryMat.roughness = 0.22;
    this.secondaryMat.clearCoat.isEnabled = true;
    this.secondaryMat.clearCoat.roughness = 0.06;
    this.secondaryMat.clearCoat.intensity = 0.95;

    this.accentMat = new PBRMaterial(`${name}_accentMat`, scene);
    this.accentMat.albedoColor = Color3.FromHexString(livery.accent);
    this.accentMat.metallic = 0.6;
    this.accentMat.roughness = 0.25;

    this.carbonMat = new PBRMaterial(`${name}_carbonMat`, scene);
    this.carbonMat.albedoColor = new Color3(0.06, 0.06, 0.08);
    this.carbonMat.metallic = 0.35;
    this.carbonMat.roughness = 0.55;

    const rubberMat = new PBRMaterial(`${name}_rubberMat`, scene);
    rubberMat.albedoColor = new Color3(0.06, 0.06, 0.07);
    rubberMat.roughness = 0.92;
    rubberMat.metallic = 0.03;

    const rimMat = new PBRMaterial(`${name}_rimMat`, scene);
    rimMat.albedoColor = new Color3(0.12, 0.12, 0.14);
    rimMat.metallic = 0.92;
    rimMat.roughness = 0.28;

    const caliperMat = new PBRMaterial(`${name}_caliperMat`, scene);
    caliperMat.albedoColor = new Color3(0.85, 0.1, 0.1);
    caliperMat.metallic = 0.4;
    caliperMat.roughness = 0.3;

    this.helmetMat = new PBRMaterial(`${name}_helmetMat`, scene);
    this.helmetMat.albedoColor = Color3.FromHexString(livery.accent);
    this.helmetMat.metallic = 0.8;
    this.helmetMat.roughness = 0.15;
    this.helmetMat.clearCoat.isEnabled = true;

    const visorMat = new PBRMaterial(`${name}_visorMat`, scene);
    visorMat.albedoColor = new Color3(0.08, 0.12, 0.18);
    visorMat.metallic = 0.95;
    visorMat.roughness = 0.08;

    this.brakeDiscMat = new PBRMaterial(`${name}_brakeDiscMat`, scene);
    this.brakeDiscMat.albedoColor = new Color3(0.24, 0.26, 0.28);
    this.brakeDiscMat.metallic = 0.88;
    this.brakeDiscMat.roughness = 0.32;
    this.brakeDiscMat.emissiveColor = new Color3(1.0, 0.22, 0.0);
    this.brakeDiscMat.emissiveIntensity = 0;

    this.rainLightMat = new PBRMaterial(`${name}_rainLightMat`, scene);
    this.rainLightMat.albedoColor = new Color3(0.9, 0.05, 0.05);
    this.rainLightMat.emissiveColor = new Color3(1.0, 0.05, 0.05);
    this.rainLightMat.emissiveIntensity = 2.5;

    // 2. Chassis Monocoque & Floor Undertray
    // Aerodynamic sculpted floor undertray with ground-effect edges
    const floorUndertray = MeshBuilder.CreateBox("floorUndertray", { width: 1.62, height: 0.04, depth: 3.1 }, scene);
    floorUndertray.parent = this.root;
    floorUndertray.position = new Vector3(0, 0.16, 0.1);
    floorUndertray.material = this.carbonMat;

    // Central chassis monocoque
    this.chassis = MeshBuilder.CreateBox("chassis", { width: 0.86, height: 0.36, depth: 2.8 }, scene);
    this.chassis.parent = this.root;
    this.chassis.position = new Vector3(0, 0.36, 0.1);
    this.chassis.material = this.bodyMat;

    // Sculpted Nose Cone
    const nose = MeshBuilder.CreateCylinder("nose", { diameterTop: 0.18, diameterBottom: 0.62, height: 1.45, tessellation: 6 }, scene);
    nose.parent = this.root;
    nose.rotation.x = Math.PI / 2;
    nose.position = new Vector3(0, 0.33, 1.95);
    nose.material = this.bodyMat;

    // Aerodynamic Sidepods with Radiator Inlets
    const leftSidepod = MeshBuilder.CreateBox("leftSidepod", { width: 0.44, height: 0.34, depth: 1.7 }, scene);
    leftSidepod.parent = this.root;
    leftSidepod.position = new Vector3(-0.62, 0.34, -0.05);
    leftSidepod.material = this.secondaryMat;

    const rightSidepod = MeshBuilder.CreateBox("rightSidepod", { width: 0.44, height: 0.34, depth: 1.7 }, scene);
    rightSidepod.parent = this.root;
    rightSidepod.position = new Vector3(0.62, 0.34, -0.05);
    rightSidepod.material = this.secondaryMat;

    // Sidepod Radiator Air Intake Scoops (dark carbon cavity)
    const leftIntake = MeshBuilder.CreateBox("leftIntake", { width: 0.36, height: 0.22, depth: 0.15 }, scene);
    leftIntake.parent = this.root;
    leftIntake.position = new Vector3(-0.62, 0.36, 0.8);
    leftIntake.material = this.carbonMat;

    const rightIntake = MeshBuilder.CreateBox("rightIntake", { width: 0.36, height: 0.22, depth: 0.15 }, scene);
    rightIntake.parent = this.root;
    rightIntake.position = new Vector3(0.62, 0.36, 0.8);
    rightIntake.material = this.carbonMat;

    // Engine Cover Fin (Shark Fin)
    const fin = MeshBuilder.CreateBox("fin", { width: 0.05, height: 0.42, depth: 1.4 }, scene);
    fin.parent = this.root;
    fin.position = new Vector3(0, 0.68, -0.45);
    fin.material = this.accentMat;

    // Halo Safety Titanium Structure with Central Pillar
    const halo = MeshBuilder.CreateTorus("halo", { diameter: 0.52, thickness: 0.075, tessellation: 20 }, scene);
    halo.parent = this.root;
    halo.rotation.x = Math.PI / 8;
    halo.position = new Vector3(0, 0.72, 0.3);
    halo.material = this.carbonMat;

    const haloPillar = MeshBuilder.CreateCylinder("haloPillar", { diameter: 0.06, height: 0.28, tessellation: 8 }, scene);
    haloPillar.parent = this.root;
    haloPillar.position = new Vector3(0, 0.6, 0.55);
    haloPillar.material = this.carbonMat;

    // Cockpit Driver Helmet & Visor
    const helmet = MeshBuilder.CreateSphere("helmet", { diameter: 0.28, segments: 12 }, scene);
    helmet.parent = this.root;
    helmet.position = new Vector3(0, 0.6, 0.2);
    helmet.material = this.helmetMat;

    const visor = MeshBuilder.CreateBox("visor", { width: 0.2, height: 0.08, depth: 0.12 }, scene);
    visor.parent = helmet;
    visor.position = new Vector3(0, 0.02, 0.1);
    visor.material = visorMat;

    // F1 Cockpit Steering Wheel Yoke
    const steerWheel = MeshBuilder.CreateBox("cockpitWheel", { width: 0.24, height: 0.14, depth: 0.04 }, scene);
    steerWheel.parent = this.root;
    steerWheel.position = new Vector3(0, 0.52, 0.62);
    steerWheel.rotation.x = -Math.PI / 6;
    steerWheel.material = this.carbonMat;

    // Front Wing Mainplane & Cascades
    const frontWing = MeshBuilder.CreateBox("frontWing", { width: 1.95, height: 0.05, depth: 0.45 }, scene);
    frontWing.parent = this.root;
    frontWing.position = new Vector3(0, 0.2, 2.35);
    frontWing.material = this.carbonMat;

    // Front Wing Endplates
    const leftFWEndplate = MeshBuilder.CreateBox("leftFWEndplate", { width: 0.04, height: 0.28, depth: 0.48 }, scene);
    leftFWEndplate.parent = this.root;
    leftFWEndplate.position = new Vector3(-0.98, 0.28, 2.35);
    leftFWEndplate.material = this.accentMat;

    const rightFWEndplate = MeshBuilder.CreateBox("rightFWEndplate", { width: 0.04, height: 0.28, depth: 0.48 }, scene);
    rightFWEndplate.parent = this.root;
    rightFWEndplate.position = new Vector3(0.98, 0.28, 2.35);
    rightFWEndplate.material = this.accentMat;

    // Rear Wing Structure
    const rearWing = MeshBuilder.CreateBox("rearWing", { width: 1.68, height: 0.05, depth: 0.36 }, scene);
    rearWing.parent = this.root;
    rearWing.position = new Vector3(0, 0.88, -1.55);
    rearWing.material = this.carbonMat;

    const leftRWEndplate = MeshBuilder.CreateBox("leftRWEndplate", { width: 0.04, height: 0.55, depth: 0.45 }, scene);
    leftRWEndplate.parent = this.root;
    leftRWEndplate.position = new Vector3(-0.84, 0.82, -1.55);
    leftRWEndplate.material = this.secondaryMat;

    const rightRWEndplate = MeshBuilder.CreateBox("rightRWEndplate", { width: 0.04, height: 0.55, depth: 0.45 }, scene);
    rightRWEndplate.parent = this.root;
    rightRWEndplate.position = new Vector3(0.84, 0.82, -1.55);
    rightRWEndplate.material = this.secondaryMat;

    // Beam Wing
    const beamWing = MeshBuilder.CreateBox("beamWing", { width: 1.45, height: 0.04, depth: 0.25 }, scene);
    beamWing.parent = this.root;
    beamWing.position = new Vector3(0, 0.54, -1.45);
    beamWing.material = this.carbonMat;

    // Central FIA Rain / Safety LED Light
    const rainLight = MeshBuilder.CreateBox("rainLight", { width: 0.12, height: 0.08, depth: 0.06 }, scene);
    rainLight.parent = this.root;
    rainLight.position = new Vector3(0, 0.32, -1.55);
    rainLight.material = this.rainLightMat;

    // DRS Flap
    this.drsFlap = MeshBuilder.CreateBox("drsFlap", { width: 1.64, height: 0.05, depth: 0.22 }, scene);
    this.drsFlap.parent = this.root;
    this.drsFlap.position = new Vector3(0, 0.98, -1.48);
    this.drsFlap.material = this.bodyMat;

    // 3. Wheel Assemblies with Rims and Brake Calipers
    const createWheel = (wheelName: string, isFront: boolean) => {
      // Main wheel cylinder oriented horizontally along X-axis
      const wheelMesh = MeshBuilder.CreateCylinder(wheelName, {
        diameter: this.wheelRadius * 2,
        height: isFront ? 0.34 : 0.44,
        tessellation: 28
      }, scene);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.material = rubberMat;

      // Wheel Rim
      const rim = MeshBuilder.CreateCylinder(`${wheelName}_rim`, {
        diameter: this.wheelRadius * 1.35,
        height: isFront ? 0.345 : 0.445,
        tessellation: 20
      }, scene);
      rim.parent = wheelMesh;
      rim.material = rimMat;

      // Center lock nut
      const nut = MeshBuilder.CreateCylinder(`${wheelName}_nut`, {
        diameter: 0.12,
        height: isFront ? 0.37 : 0.47,
        tessellation: 8
      }, scene);
      nut.parent = wheelMesh;
      nut.material = this.accentMat;

      // Brake Disc
      const disc = MeshBuilder.CreateCylinder(`${wheelName}_disc`, {
        diameter: 0.27 * 2,
        height: 0.038,
        tessellation: 20
      }, scene);
      disc.parent = wheelMesh;
      disc.material = this.brakeDiscMat;
      this.brakeDiscs.push(disc);

      // Brake Caliper
      const caliper = MeshBuilder.CreateBox(`${wheelName}_caliper`, {
        width: 0.08,
        height: 0.12,
        depth: 0.16
      }, scene);
      caliper.parent = wheelMesh;
      caliper.position = new Vector3(0, 0.18, 0);
      caliper.material = caliperMat;

      return wheelMesh;
    };

    // Front Steer Assembly Node
    this.frontSteerNode = new TransformNode(`${name}_frontSteer`, scene);
    this.frontSteerNode.parent = this.root;
    this.frontSteerNode.position = new Vector3(0, 0.36, 1.45);

    this.wheelFL = createWheel("wheelFL", true);
    this.wheelFL.parent = this.frontSteerNode;
    this.wheelFL.position = new Vector3(-0.94, 0, 0);

    this.wheelFR = createWheel("wheelFR", true);
    this.wheelFR.parent = this.frontSteerNode;
    this.wheelFR.position = new Vector3(0.94, 0, 0);

    // Rear Wheels
    const rearNode = new TransformNode(`${name}_rearNode`, scene);
    rearNode.parent = this.root;
    rearNode.position = new Vector3(0, 0.36, -1.15);

    this.wheelRL = createWheel("wheelRL", false);
    this.wheelRL.parent = rearNode;
    this.wheelRL.position = new Vector3(-0.98, 0, 0);

    this.wheelRR = createWheel("wheelRR", false);
    this.wheelRR.parent = rearNode;
    this.wheelRR.position = new Vector3(0.98, 0, 0);
  }

  public update(
    speed: number,
    steerAngle: number,
    dt: number,
    isBraking: boolean,
    brakeTemp: number,
    drsActive: boolean
  ) {
    const safeSpeed = Number.isFinite(speed) ? speed : 0;
    const safeSteer = Number.isFinite(steerAngle) ? steerAngle : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0.016;
    const safeBrakeTemp = Number.isFinite(brakeTemp) ? brakeTemp : 100;

    // Axle rotation: rotate around local rolling axis cleanly
    const angularSpeed = safeSpeed / this.wheelRadius;
    const deltaRotation = angularSpeed * safeDt;
    this.wheelSpin = (this.wheelSpin + deltaRotation) % (Math.PI * 2);

    this.wheelFL.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelFR.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelRL.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);
    this.wheelRR.rotate(Vector3.Up(), deltaRotation, Space.LOCAL);

    // Front steer angle
    this.frontSteerNode.rotation.y = safeSteer * 0.45;

    // DRS Flap
    this.drsFlap.rotation.x = drsActive ? -0.38 : 0;
    this.drsFlap.position.y = drsActive ? 1.06 : 0.98;

    // Brake disc temperature emissive glow (starts glowing cherry red at 450 C, peaks at 950 C)
    const rawRatio = (safeBrakeTemp - 450) / 450;
    const glowRatio = Number.isFinite(rawRatio) ? Math.max(0, Math.min(1, rawRatio)) : 0;
    this.brakeDiscMat.emissiveIntensity = glowRatio * 5.0;
    this.brakeDiscMat.emissiveColor.set(1.0, glowRatio * 0.38, 0.0);
  }

  public dispose() {
    this.root.dispose();
  }
}
