// Formula Racing 3D — Shared Procedural Vehicle PBR Textures & Material Builders
import {
  Scene,
  Color3,
  PBRMaterial,
  DynamicTexture,
  StandardMaterial
} from "@babylonjs/core";
import { Livery } from "@/data/liveries";

interface CachedVehicleTextures {
  carbonAlbedo: DynamicTexture;
  carbonBump: DynamicTexture;
  tireTreadBump: DynamicTexture;
  contactShadowTex: DynamicTexture;
  wheelContactShadowTex: DynamicTexture;
}

const sceneTextureCache = new WeakMap<Scene, CachedVehicleTextures>();

export function getSharedVehicleTextures(scene: Scene): CachedVehicleTextures {
  const existing = sceneTextureCache.get(scene);
  if (existing) return existing;

  const maxAnisotropy = Math.min(8, scene.getEngine().getCaps().maxAnisotropy || 1);

  // 1. 2x2 Twill Carbon Fiber Albedo + Bump (128x128 tileable)
  const carbonAlbedo = new DynamicTexture("f1CarbonAlbedo", { width: 128, height: 128 }, scene);
  const cCtx = carbonAlbedo.getContext() as CanvasRenderingContext2D;
  const carbonBump = new DynamicTexture("f1CarbonBump", { width: 128, height: 128 }, scene);
  const bCtx = carbonBump.getContext() as CanvasRenderingContext2D;

  if (cCtx && bCtx) {
    const cell = 8;
    for (let y = 0; y < 128; y += cell) {
      for (let x = 0; x < 128; x += cell) {
        const xi = Math.floor(x / cell);
        const yi = Math.floor(y / cell);
        const phase = (xi + yi) % 4;
        const isWarp = phase < 2;

        cCtx.fillStyle = isWarp ? "#181a1f" : "#0c0d10";
        cCtx.fillRect(x, y, cell, cell);
        cCtx.fillStyle = isWarp ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.22)";
        cCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

        bCtx.fillStyle = isWarp ? "rgb(156,128,245)" : "rgb(100,145,245)";
        bCtx.fillRect(x, y, cell, cell);
      }
    }
    carbonAlbedo.update();
    carbonBump.update();
    carbonAlbedo.uScale = 8;
    carbonAlbedo.vScale = 8;
    carbonBump.uScale = 8;
    carbonBump.vScale = 8;
    carbonAlbedo.anisotropicFilteringLevel = maxAnisotropy;
    carbonBump.anisotropicFilteringLevel = maxAnisotropy;
  }

  // 2. Scrubbed Racing Tire Tread Micro-Grain Bump
  const tireTreadBump = new DynamicTexture("f1TireTreadBump", { width: 128, height: 128 }, scene);
  const tCtx = tireTreadBump.getContext() as CanvasRenderingContext2D;
  if (tCtx) {
    tCtx.fillStyle = "rgb(128,128,255)";
    tCtx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      const band = 128 + Math.sin(y * 0.45) * 18;
      for (let x = 0; x < 128; x += 2) {
        const grain = (Math.random() - 0.5) * 26;
        const r = Math.max(0, Math.min(255, Math.round(band + grain)));
        const g = Math.max(0, Math.min(255, Math.round(128 + grain * 0.5)));
        tCtx.fillStyle = `rgb(${r},${g},248)`;
        tCtx.fillRect(x, y, 2, 1);
      }
    }
    tireTreadBump.update();
    tireTreadBump.uScale = 2;
    tireTreadBump.vScale = 4;
  }

  // 3. Soft Floor Contact Ambient Occlusion Shadow Texture
  const contactShadowTex = new DynamicTexture("f1ContactShadowTex", { width: 256, height: 512 }, scene, false);
  contactShadowTex.hasAlpha = true;
  const sCtx = contactShadowTex.getContext() as CanvasRenderingContext2D;
  if (sCtx) {
    sCtx.clearRect(0, 0, 256, 512);
    // Elongated elliptical car shadow under floor & wings
    const drawSoftOval = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
      sCtx.save();
      sCtx.translate(cx, cy);
      sCtx.scale(rx, ry);
      const grad = sCtx.createRadialGradient(0, 0, 0.1, 0, 0, 1.0);
      grad.addColorStop(0.0, `rgba(0, 0, 0, ${alpha})`);
      grad.addColorStop(0.6, `rgba(0, 0, 0, ${alpha * 0.55})`);
      grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(0, 0, 1.0, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.restore();
    };

    drawSoftOval(128, 252, 86, 175, 0.72); // Floor undertray
    drawSoftOval(128, 72, 102, 42, 0.48);  // Front wing footprint
    drawSoftOval(128, 438, 84, 38, 0.52);  // Rear diffuser footprint
    contactShadowTex.update();
  }

  // 4. Per-Wheel Soft Radial Contact Shadow Texture (Ambient Occlusion under rubber)
  const wheelContactShadowTex = new DynamicTexture("f1WheelContactShadowTex", { width: 128, height: 128 }, scene, false);
  wheelContactShadowTex.hasAlpha = true;
  const wsCtx = wheelContactShadowTex.getContext() as CanvasRenderingContext2D;
  if (wsCtx) {
    wsCtx.clearRect(0, 0, 128, 128);
    wsCtx.save();
    wsCtx.translate(64, 64);
    wsCtx.scale(58, 60);
    const grad = wsCtx.createRadialGradient(0, 0, 0.12, 0, 0, 1.0);
    grad.addColorStop(0.0, "rgba(0, 0, 0, 0.92)");
    grad.addColorStop(0.45, "rgba(0, 0, 0, 0.65)");
    grad.addColorStop(0.75, "rgba(0, 0, 0, 0.25)");
    grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
    wsCtx.fillStyle = grad;
    wsCtx.beginPath();
    wsCtx.arc(0, 0, 1.0, 0, Math.PI * 2);
    wsCtx.fill();
    wsCtx.restore();
    wheelContactShadowTex.update();
  }

  const entry: CachedVehicleTextures = {
    carbonAlbedo,
    carbonBump,
    tireTreadBump,
    contactShadowTex,
    wheelContactShadowTex
  };
  sceneTextureCache.set(scene, entry);
  return entry;
}

export interface VehicleMaterialSet {
  bodyMat: PBRMaterial;
  secondaryMat: PBRMaterial;
  accentMat: PBRMaterial;
  carbonMat: PBRMaterial;
  rubberMat: PBRMaterial;
  rimMat: PBRMaterial;
  spokeMat: PBRMaterial;
  blurredWheelMat: StandardMaterial;
  caliperMat: PBRMaterial;
  exhaustMat: PBRMaterial;
  brakeDiscMat: PBRMaterial;
  helmetMat: PBRMaterial;
  visorMat: PBRMaterial;
  rainLightMat: PBRMaterial;
  contactShadowMat: StandardMaterial;
  wheelContactShadowMat: StandardMaterial;
  sidewallMat: StandardMaterial;
}

export function createVehicleMaterials(
  name: string,
  livery: Livery,
  carNumber: number,
  scene: Scene
): VehicleMaterialSet {
  const shared = getSharedVehicleTextures(scene);

  // Crisp procedural livery texture with original racing stripes & car number
  const bodyTex = new DynamicTexture(`${name}_liveryTex`, { width: 512, height: 512 }, scene);
  const bCtx = bodyTex.getContext() as CanvasRenderingContext2D;
  if (bCtx) {
    bCtx.fillStyle = livery.primary;
    bCtx.fillRect(0, 0, 512, 512);

    // Subtle metallic flake tone gradient
    const grad = bCtx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, "rgba(255,255,255,0.08)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.0)");
    grad.addColorStop(1, "rgba(0,0,0,0.18)");
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, 512, 512);

    // Clean metallic racing stripes & pinstripes (avoids UV text distortion on curved extruded monocoque)
    bCtx.fillStyle = livery.secondary;
    bCtx.fillRect(0, 0, 512, 92);
    bCtx.fillRect(0, 420, 512, 92);

    bCtx.fillStyle = livery.accent;
    bCtx.fillRect(0, 92, 512, 16);
    bCtx.fillRect(0, 404, 512, 16);

    // Subtle carbon-tone spine stripe
    bCtx.fillStyle = "rgba(15, 18, 24, 0.35)";
    bCtx.fillRect(0, 244, 512, 24);

    bodyTex.update();
  }

  // 1. High-Gloss Automotive Metallic Clearcoat Bodywork
  const bodyMat = new PBRMaterial(`${name}_bodyMat`, scene);
  bodyMat.albedoTexture = bodyTex;
  bodyMat.metallic = 0.78;
  bodyMat.roughness = 0.16;
  bodyMat.clearCoat.isEnabled = true;
  bodyMat.clearCoat.roughness = 0.035;
  bodyMat.clearCoat.intensity = 1.0;

  // 2. Secondary Satin-Metallic Trim
  const secondaryMat = new PBRMaterial(`${name}_secondaryMat`, scene);
  secondaryMat.albedoColor = Color3.FromHexString(livery.secondary);
  secondaryMat.metallic = 0.65;
  secondaryMat.roughness = 0.22;
  secondaryMat.clearCoat.isEnabled = true;
  secondaryMat.clearCoat.roughness = 0.06;
  secondaryMat.clearCoat.intensity = 0.85;

  // 3. Accent Aero Trim
  const accentMat = new PBRMaterial(`${name}_accentMat`, scene);
  accentMat.albedoColor = Color3.FromHexString(livery.accent);
  accentMat.metallic = 0.62;
  accentMat.roughness = 0.20;
  accentMat.clearCoat.isEnabled = true;
  accentMat.clearCoat.roughness = 0.05;

  // 4. 2x2 Twill Carbon Fiber (Wings, Floor, Halo, Suspension)
  const carbonMat = new PBRMaterial(`${name}_carbonMat`, scene);
  carbonMat.albedoTexture = shared.carbonAlbedo;
  carbonMat.bumpTexture = shared.carbonBump;
  carbonMat.bumpTexture.level = 0.42;
  carbonMat.metallic = 0.28;
  carbonMat.roughness = 0.36;
  carbonMat.clearCoat.isEnabled = true;
  carbonMat.clearCoat.intensity = 0.65;
  carbonMat.clearCoat.roughness = 0.14;

  // 5. Scrubbed Slick Tire Rubber
  const rubberMat = new PBRMaterial(`${name}_rubberMat`, scene);
  rubberMat.albedoColor = new Color3(0.065, 0.068, 0.074);
  rubberMat.bumpTexture = shared.tireTreadBump;
  rubberMat.bumpTexture.level = 0.35;
  rubberMat.roughness = 0.56;
  rubberMat.metallic = 0.04;

  // 6. Forged Alloy Rim / Aero Wheel Cover & Crisp Spokes
  const rimMat = new PBRMaterial(`${name}_rimMat`, scene);
  rimMat.albedoColor = new Color3(0.11, 0.12, 0.14);
  rimMat.metallic = 0.92;
  rimMat.roughness = 0.18;
  rimMat.clearCoat.isEnabled = true;
  rimMat.clearCoat.intensity = 0.75;

  const spokeMat = new PBRMaterial(`${name}_spokeMat`, scene);
  spokeMat.albedoColor = new Color3(0.16, 0.17, 0.20);
  spokeMat.metallic = 0.92;
  spokeMat.roughness = 0.18;
  spokeMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  spokeMat.alpha = 1.0;

  // 6b. High-Speed Radial Motion-Blur Wheel Overlay (eliminates wagon-wheel strobing)
  const wheelBlurTex = new DynamicTexture(`${name}_wheelBlurTex`, { width: 256, height: 256 }, scene, false);
  wheelBlurTex.hasAlpha = true;
  const wbCtx = wheelBlurTex.getContext() as CanvasRenderingContext2D;
  if (wbCtx) {
    wbCtx.clearRect(0, 0, 256, 256);
    const cx = 128;
    const cy = 128;

    // Subtle dark rubber sidewall motion ring
    wbCtx.strokeStyle = "rgba(18, 20, 24, 0.78)";
    wbCtx.lineWidth = 42;
    wbCtx.beginPath();
    wbCtx.arc(cx, cy, 102, 0, Math.PI * 2);
    wbCtx.stroke();

    // Radially blurred alloy spoke disc (concentric swept streaks)
    const rimGrad = wbCtx.createRadialGradient(cx, cy, 14, cx, cy, 86);
    rimGrad.addColorStop(0.0, "rgba(38, 41, 48, 0.96)");
    rimGrad.addColorStop(0.28, "rgba(56, 60, 70, 0.72)");
    rimGrad.addColorStop(0.62, "rgba(42, 46, 54, 0.80)");
    rimGrad.addColorStop(0.92, "rgba(28, 31, 36, 0.85)");
    rimGrad.addColorStop(1.0, "rgba(20, 22, 26, 0.0)");
    wbCtx.fillStyle = rimGrad;
    wbCtx.beginPath();
    wbCtx.arc(cx, cy, 86, 0, Math.PI * 2);
    wbCtx.fill();

    // Motion-streaked concentric spoke rings
    for (let r = 28; r <= 76; r += 8) {
      wbCtx.strokeStyle = r % 16 === 0 ? "rgba(130, 138, 152, 0.24)" : "rgba(22, 24, 28, 0.35)";
      wbCtx.lineWidth = 3.2;
      wbCtx.beginPath();
      wbCtx.arc(cx, cy, r, 0, Math.PI * 2);
      wbCtx.stroke();
    }

    // Blurred livery compound sidewall stripe
    wbCtx.strokeStyle = livery.accent;
    wbCtx.globalAlpha = 0.85;
    wbCtx.lineWidth = 7;
    wbCtx.beginPath();
    wbCtx.arc(cx, cy, 98, 0, Math.PI * 2);
    wbCtx.stroke();
    wbCtx.globalAlpha = 1.0;

    wheelBlurTex.update();
  }

  const blurredWheelMat = new StandardMaterial(`${name}_blurredWheelMat`, scene);
  blurredWheelMat.diffuseTexture = wheelBlurTex;
  blurredWheelMat.useAlphaFromDiffuseTexture = true;
  blurredWheelMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  blurredWheelMat.backFaceCulling = false;
  blurredWheelMat.specularColor = new Color3(0.28, 0.30, 0.34);
  blurredWheelMat.alpha = 0.0;

  // 7. Anodized Brake Caliper
  const caliperMat = new PBRMaterial(`${name}_caliperMat`, scene);
  caliperMat.albedoColor = Color3.FromHexString(livery.accent);
  caliperMat.metallic = 0.75;
  caliperMat.roughness = 0.24;

  // 8. Heat-Tinted Iridescent Titanium Exhaust
  const exhaustMat = new PBRMaterial(`${name}_exhaustMat`, scene);
  exhaustMat.albedoColor = new Color3(0.38, 0.36, 0.42);
  exhaustMat.metallic = 0.96;
  exhaustMat.roughness = 0.22;
  exhaustMat.iridescence.isEnabled = true;
  exhaustMat.iridescence.intensity = 0.85;
  exhaustMat.iridescence.minimumThickness = 240;
  exhaustMat.iridescence.maximumThickness = 520;

  // 9. Carbon-Ceramic Thermal Brake Disc
  const brakeDiscMat = new PBRMaterial(`${name}_brakeDiscMat`, scene);
  brakeDiscMat.albedoColor = new Color3(0.20, 0.21, 0.24);
  brakeDiscMat.metallic = 0.88;
  brakeDiscMat.roughness = 0.26;
  brakeDiscMat.emissiveColor = new Color3(1.0, 0.25, 0.02);
  brakeDiscMat.emissiveIntensity = 0;

  // 10. Driver Helmet & Iridescent Visor
  const helmetMat = new PBRMaterial(`${name}_helmetMat`, scene);
  helmetMat.albedoColor = Color3.FromHexString(livery.accent);
  helmetMat.metallic = 0.82;
  helmetMat.roughness = 0.12;
  helmetMat.clearCoat.isEnabled = true;
  helmetMat.clearCoat.roughness = 0.03;

  const visorMat = new PBRMaterial(`${name}_visorMat`, scene);
  visorMat.albedoColor = new Color3(0.05, 0.10, 0.18);
  visorMat.metallic = 0.96;
  visorMat.roughness = 0.04;
  visorMat.iridescence.isEnabled = true;
  visorMat.iridescence.intensity = 0.9;

  // 11. FIA Rear Rain / ERS Safety Light
  const rainLightMat = new PBRMaterial(`${name}_rainLightMat`, scene);
  rainLightMat.albedoColor = new Color3(0.9, 0.05, 0.05);
  rainLightMat.emissiveColor = new Color3(2.4, 0.08, 0.06);
  rainLightMat.emissiveIntensity = 1.6;

  // 12. Tire Sidewall Compound Stripe
  const sidewallMat = new StandardMaterial(`${name}_stripeMat`, scene);
  sidewallMat.diffuseColor = Color3.FromHexString(livery.accent);
  sidewallMat.emissiveColor = Color3.FromHexString(livery.accent).scale(0.18);
  sidewallMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  sidewallMat.alpha = 1.0;

  // 13. Soft Ground Contact Shadow Material (Undertray & Per-Wheel AO)
  const contactShadowMat = new StandardMaterial(`${name}_contactShadowMat`, scene);
  contactShadowMat.diffuseTexture = shared.contactShadowTex;
  contactShadowMat.useAlphaFromDiffuseTexture = true;
  contactShadowMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  contactShadowMat.disableLighting = true;
  contactShadowMat.disableDepthWrite = true;
  contactShadowMat.emissiveColor = new Color3(0, 0, 0);
  contactShadowMat.zOffset = -1;
  contactShadowMat.zOffsetUnits = -1;

  const wheelContactShadowMat = new StandardMaterial(`${name}_wheelContactShadowMat`, scene);
  wheelContactShadowMat.diffuseTexture = shared.wheelContactShadowTex;
  wheelContactShadowMat.useAlphaFromDiffuseTexture = true;
  wheelContactShadowMat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
  wheelContactShadowMat.disableLighting = true;
  wheelContactShadowMat.disableDepthWrite = true;
  wheelContactShadowMat.emissiveColor = new Color3(0, 0, 0);
  wheelContactShadowMat.alpha = 0.76;
  wheelContactShadowMat.zOffset = -2;
  wheelContactShadowMat.zOffsetUnits = -2;

  return {
    bodyMat,
    secondaryMat,
    accentMat,
    carbonMat,
    rubberMat,
    rimMat,
    spokeMat,
    blurredWheelMat,
    caliperMat,
    exhaustMat,
    brakeDiscMat,
    helmetMat,
    visorMat,
    rainLightMat,
    contactShadowMat,
    wheelContactShadowMat,
    sidewallMat
  };
}
