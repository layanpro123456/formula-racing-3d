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
import { LIVERIES } from "@/components/FormulaCarModel";

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

  // PBR Materials
  public bodyMat: PBRMaterial;
  public brakeDiscMat: PBRMaterial;

  private wheelSpin: number = 0;
  private readonly wheelRadius = 0.36;

  constructor(name: string, liveryIndex: number, scene: Scene) {
    const livery = LIVERIES[liveryIndex % LIVERIES.length];
    this.root = new TransformNode(name, scene);

    // 1. Automotive Clearcoat Bodywork Material
    this.bodyMat = new PBRMaterial(`${name}_bodyMat`, scene);
    this.bodyMat.albedoColor = Color3.FromHexString(livery.primary);
    this.bodyMat.metallic = 0.65;
    this.bodyMat.roughness = 0.2;
    this.bodyMat.clearCoat.isEnabled = true;
    this.bodyMat.clearCoat.roughness = 0.08;
    this.bodyMat.clearCoat.intensity = 1.0;

    const carbonMat = new PBRMaterial(`${name}_carbonMat`, scene);
    carbonMat.albedoColor = new Color3(0.08, 0.08, 0.1);
    carbonMat.metallic = 0.4;
    carbonMat.roughness = 0.6;

    const accentMat = new PBRMaterial(`${name}_accentMat`, scene);
    accentMat.albedoColor = Color3.FromHexString(livery.accent);
    accentMat.metallic = 0.55;
    accentMat.roughness = 0.25;

    const rubberMat = new PBRMaterial(`${name}_rubberMat`, scene);
    rubberMat.albedoColor = new Color3(0.05, 0.05, 0.06);
    rubberMat.roughness = 0.95;
    rubberMat.metallic = 0.02;

    this.brakeDiscMat = new PBRMaterial(`${name}_brakeDiscMat`, scene);
    this.brakeDiscMat.albedoColor = new Color3(0.2, 0.22, 0.24);
    this.brakeDiscMat.metallic = 0.85;
    this.brakeDiscMat.roughness = 0.35;
    this.brakeDiscMat.emissiveColor = new Color3(1.0, 0.22, 0.0);
    this.brakeDiscMat.emissiveIntensity = 0;

    // 2. Chassis Monocoque
    this.chassis = MeshBuilder.CreateBox("chassis", { width: 0.88, height: 0.34, depth: 2.8 }, scene);
    this.chassis.parent = this.root;
    this.chassis.position = new Vector3(0, 0.38, 0.1);
    this.chassis.material = this.bodyMat;

    // Nose Cone
    const nose = MeshBuilder.CreateCylinder("nose", { diameterTop: 0.2, diameterBottom: 0.65, height: 1.3, tessellation: 4 }, scene);
    nose.parent = this.root;
    nose.rotation.x = Math.PI / 2;
    nose.position = new Vector3(0, 0.34, 1.85);
    nose.material = this.bodyMat;

    // Sidepods
    const leftSidepod = MeshBuilder.CreateBox("leftSidepod", { width: 0.44, height: 0.32, depth: 1.6 }, scene);
    leftSidepod.parent = this.root;
    leftSidepod.position = new Vector3(-0.62, 0.34, -0.1);
    leftSidepod.material = this.bodyMat;

    const rightSidepod = MeshBuilder.CreateBox("rightSidepod", { width: 0.44, height: 0.32, depth: 1.6 }, scene);
    rightSidepod.parent = this.root;
    rightSidepod.position = new Vector3(0.62, 0.34, -0.1);
    rightSidepod.material = this.bodyMat;

    // Engine Cover Fin
    const fin = MeshBuilder.CreateBox("fin", { width: 0.06, height: 0.38, depth: 1.3 }, scene);
    fin.parent = this.root;
    fin.position = new Vector3(0, 0.65, -0.45);
    fin.material = accentMat;

    // Halo Safety Titanium Hoop
    const halo = MeshBuilder.CreateTorus("halo", { diameter: 0.48, thickness: 0.08, tessellation: 18 }, scene);
    halo.parent = this.root;
    halo.rotation.x = Math.PI / 8;
    halo.position = new Vector3(0, 0.72, 0.32);
    halo.material = carbonMat;

    // Front Wing
    const frontWing = MeshBuilder.CreateBox("frontWing", { width: 1.9, height: 0.06, depth: 0.42 }, scene);
    frontWing.parent = this.root;
    frontWing.position = new Vector3(0, 0.22, 2.3);
    frontWing.material = carbonMat;

    // Rear Wing & DRS Flap
    const rearWing = MeshBuilder.CreateBox("rearWing", { width: 1.7, height: 0.06, depth: 0.35 }, scene);
    rearWing.parent = this.root;
    rearWing.position = new Vector3(0, 0.88, -1.55);
    rearWing.material = carbonMat;

    this.drsFlap = MeshBuilder.CreateBox("drsFlap", { width: 1.68, height: 0.05, depth: 0.22 }, scene);
    this.drsFlap.parent = this.root;
    this.drsFlap.position = new Vector3(0, 0.98, -1.48);
    this.drsFlap.material = this.bodyMat;

    // 3. Wheel Assemblies
    const createWheel = (wheelName: string, isFront: boolean) => {
      const wheelMesh = MeshBuilder.CreateCylinder(wheelName, {
        diameter: this.wheelRadius * 2,
        height: isFront ? 0.32 : 0.42,
        tessellation: 24
      }, scene);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.material = rubberMat;

      // Disc
      const disc = MeshBuilder.CreateCylinder(`${wheelName}_disc`, {
        diameter: 0.26 * 2,
        height: 0.035,
        tessellation: 16
      }, scene);
      disc.parent = wheelMesh;
      disc.material = this.brakeDiscMat;
      this.brakeDiscs.push(disc);

      return wheelMesh;
    };

    // Front Steer Assembly Node
    this.frontSteerNode = new TransformNode(`${name}_frontSteer`, scene);
    this.frontSteerNode.parent = this.root;
    this.frontSteerNode.position = new Vector3(0, 0.36, 1.45);

    this.wheelFL = createWheel("wheelFL", true);
    this.wheelFL.parent = this.frontSteerNode;
    this.wheelFL.position = new Vector3(-0.92, 0, 0);

    this.wheelFR = createWheel("wheelFR", true);
    this.wheelFR.parent = this.frontSteerNode;
    this.wheelFR.position = new Vector3(0.92, 0, 0);

    // Rear Wheels
    const rearNode = new TransformNode(`${name}_rearNode`, scene);
    rearNode.parent = this.root;
    rearNode.position = new Vector3(0, 0.36, -1.15);

    this.wheelRL = createWheel("wheelRL", false);
    this.wheelRL.parent = rearNode;
    this.wheelRL.position = new Vector3(-0.96, 0, 0);

    this.wheelRR = createWheel("wheelRR", false);
    this.wheelRR.parent = rearNode;
    this.wheelRR.position = new Vector3(0.96, 0, 0);
  }

  public update(
    speed: number,
    steerAngle: number,
    dt: number,
    isBraking: boolean,
    brakeTemp: number,
    drsActive: boolean
  ) {
    // Axle rotation
    const angularSpeed = speed / this.wheelRadius;
    this.wheelSpin += angularSpeed * dt;

    this.wheelFL.rotation.y = this.wheelSpin;
    this.wheelFR.rotation.y = this.wheelSpin;
    this.wheelRL.rotation.y = this.wheelSpin;
    this.wheelRR.rotation.y = this.wheelSpin;

    // Front steer angle
    this.frontSteerNode.rotation.y = steerAngle * 0.44;

    // DRS Flap
    this.drsFlap.rotation.x = drsActive ? -0.35 : 0;
    this.drsFlap.position.y = drsActive ? 1.05 : 0.98;

    // Brake disc temperature emissive glow (starts at 450 C, peaks at 950 C)
    const glowRatio = Math.max(0, Math.min(1, (brakeTemp - 450) / 450));
    this.brakeDiscMat.emissiveIntensity = glowRatio * 4.5;
    this.brakeDiscMat.emissiveColor = new Color3(1.0, glowRatio * 0.36, 0.0);
  }

  public dispose() {
    this.root.dispose();
  }
}
