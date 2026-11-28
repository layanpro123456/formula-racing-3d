// Formula Racing 3D — Weather, Lighting & Graphics Tier Presets + Physical Sky Dome
import {
  Scene,
  MeshBuilder,
  Vector3,
  Color3,
  Color4,
  ShaderMaterial,
  Effect,
  Mesh
} from "@babylonjs/core";
import { Track } from "@/data/tracks";

export type WeatherPreset = "midday" | "golden" | "overcast" | "wet" | "night";
export type GraphicsTier = "low" | "medium" | "high" | "ultra";

export interface GraphicsTierConfig {
  tier: GraphicsTier;
  maxDpr: number;
  msaaSamples: number;
  shadowMapSize: number;
  useCsm: boolean;
  csmCascades: number;
  enableSSAO2: boolean;
  enableSSR: boolean;
  enableTAA: boolean;
  enableMotionBlur: boolean;
  enableSharpen: boolean;
  enableChromaticAberration: boolean;
  bloomKernel: number;
  bloomWeight: number;
  particleDensity: number;
  propDensity: number;
}

export interface WeatherLightingConfig {
  preset: WeatherPreset;
  label: string;
  sunDirection: Vector3;
  sunPosition: Vector3;
  sunColor: Color3;
  sunIntensity: number;
  hemiDiffuse: Color3;
  hemiGround: Color3;
  hemiIntensity: number;
  environmentIntensity: number;
  fogColor: Color3;
  fogDensity: number;
  exposure: number;
  contrast: number;
  isWet: boolean;
  isNight: boolean;
  wetness: number;
  zenithColor: Color3;
  midSkyColor: Color3;
  horizonColor: Color3;
  sunDiscColor: Color3;
  cloudColor: Color3;
  cloudDensity: number;
  sunGlowPower: number;
}

export function getGraphicsPresetConfig(tier: GraphicsTier, isMobileTier: boolean): GraphicsTierConfig {
  switch (tier) {
    case "low":
      return {
        tier,
        maxDpr: 1.0,
        msaaSamples: 1,
        shadowMapSize: 512,
        useCsm: false,
        csmCascades: 1,
        enableSSAO2: false,
        enableSSR: false,
        enableTAA: false,
        enableMotionBlur: false,
        enableSharpen: false,
        enableChromaticAberration: false,
        bloomKernel: 16,
        bloomWeight: 0.12,
        particleDensity: 0.45,
        propDensity: 0.5
      };
    case "medium":
      return {
        tier,
        maxDpr: isMobileTier ? 1.35 : 1.5,
        msaaSamples: isMobileTier ? 1 : 2,
        shadowMapSize: 1024,
        useCsm: false,
        csmCascades: 1,
        enableSSAO2: false,
        enableSSR: false,
        enableTAA: false,
        enableMotionBlur: false,
        enableSharpen: !isMobileTier,
        enableChromaticAberration: false,
        bloomKernel: 24,
        bloomWeight: 0.16,
        particleDensity: 0.7,
        propDensity: 0.75
      };
    case "high":
      return {
        tier,
        maxDpr: isMobileTier ? 1.5 : 2.0,
        msaaSamples: isMobileTier ? 2 : 4,
        shadowMapSize: 2048,
        useCsm: !isMobileTier,
        csmCascades: 3,
        enableSSAO2: !isMobileTier,
        enableSSR: false,
        enableTAA: false,
        enableMotionBlur: !isMobileTier,
        enableSharpen: true,
        enableChromaticAberration: !isMobileTier,
        bloomKernel: 48,
        bloomWeight: 0.2,
        particleDensity: 1.0,
        propDensity: 1.0
      };
    case "ultra":
      return {
        tier,
        maxDpr: isMobileTier ? 1.75 : 2.0,
        msaaSamples: 4,
        shadowMapSize: 2048,
        useCsm: true,
        csmCascades: 4,
        enableSSAO2: !isMobileTier,
        enableSSR: !isMobileTier,
        enableTAA: !isMobileTier,
        enableMotionBlur: !isMobileTier,
        enableSharpen: true,
        enableChromaticAberration: true,
        bloomKernel: 56,
        bloomWeight: 0.22,
        particleDensity: 1.25,
        propDensity: 1.0
      };
  }
}

export function getWeatherLightingConfig(preset: WeatherPreset, track: Track): WeatherLightingConfig {
  const baseSky = Color3.FromHexString(track.skyColor);

  switch (preset) {
    case "golden": {
      const sunDir = new Vector3(-0.68, -0.24, -0.69).normalize();
      return {
        preset,
        label: "GOLDEN HOUR",
        sunDirection: sunDir,
        sunPosition: sunDir.scale(-160),
        sunColor: new Color3(1.0, 0.76, 0.50),
        sunIntensity: 2.35,
        hemiDiffuse: new Color3(0.75, 0.68, 0.72),
        hemiGround: new Color3(0.18, 0.14, 0.12),
        hemiIntensity: 0.45,
        environmentIntensity: 0.95,
        fogColor: new Color3(0.78, 0.64, 0.56),
        fogDensity: 0.0014,
        exposure: 1.08,
        contrast: 1.26,
        isWet: false,
        isNight: false,
        wetness: 0,
        zenithColor: new Color3(0.14, 0.24, 0.46),
        midSkyColor: new Color3(0.42, 0.48, 0.65),
        horizonColor: new Color3(0.98, 0.68, 0.44),
        sunDiscColor: new Color3(1.0, 0.88, 0.66),
        cloudColor: new Color3(1.0, 0.84, 0.70),
        cloudDensity: 0.32,
        sunGlowPower: 18.0
      };
    }

    case "overcast": {
      const sunDir = new Vector3(-0.35, -0.82, -0.45).normalize();
      return {
        preset,
        label: "OVERCAST",
        sunDirection: sunDir,
        sunPosition: sunDir.scale(-150),
        sunColor: new Color3(0.84, 0.88, 0.94),
        sunIntensity: 1.15,
        hemiDiffuse: new Color3(0.72, 0.76, 0.82),
        hemiGround: new Color3(0.16, 0.18, 0.20),
        hemiIntensity: 0.68,
        environmentIntensity: 0.88,
        fogColor: new Color3(0.62, 0.67, 0.72),
        fogDensity: 0.0021,
        exposure: 1.04,
        contrast: 1.18,
        isWet: false,
        isNight: false,
        wetness: 0.15,
        zenithColor: new Color3(0.32, 0.39, 0.48),
        midSkyColor: new Color3(0.54, 0.60, 0.67),
        horizonColor: new Color3(0.74, 0.78, 0.82),
        sunDiscColor: new Color3(0.92, 0.94, 0.98),
        cloudColor: new Color3(0.80, 0.84, 0.89),
        cloudDensity: 0.68,
        sunGlowPower: 6.0
      };
    }

    case "wet": {
      const sunDir = new Vector3(-0.32, -0.78, -0.54).normalize();
      return {
        preset,
        label: "WET RACE",
        sunDirection: sunDir,
        sunPosition: sunDir.scale(-150),
        sunColor: new Color3(0.76, 0.83, 0.93),
        sunIntensity: 1.25,
        hemiDiffuse: new Color3(0.62, 0.69, 0.78),
        hemiGround: new Color3(0.12, 0.14, 0.17),
        hemiIntensity: 0.58,
        environmentIntensity: 1.05,
        fogColor: new Color3(0.46, 0.53, 0.60),
        fogDensity: 0.0026,
        exposure: 1.06,
        contrast: 1.24,
        isWet: true,
        isNight: false,
        wetness: 0.95,
        zenithColor: new Color3(0.20, 0.26, 0.34),
        midSkyColor: new Color3(0.38, 0.45, 0.53),
        horizonColor: new Color3(0.58, 0.64, 0.71),
        sunDiscColor: new Color3(0.86, 0.90, 0.95),
        cloudColor: new Color3(0.58, 0.63, 0.70),
        cloudDensity: 0.82,
        sunGlowPower: 8.0
      };
    }

    case "night": {
      const sunDir = new Vector3(-0.30, -0.86, -0.41).normalize();
      return {
        preset,
        label: "NIGHT FLOODLIT",
        sunDirection: sunDir,
        sunPosition: sunDir.scale(-140),
        sunColor: new Color3(0.88, 0.93, 1.0),
        sunIntensity: 1.55,
        hemiDiffuse: new Color3(0.28, 0.34, 0.48),
        hemiGround: new Color3(0.05, 0.06, 0.09),
        hemiIntensity: 0.42,
        environmentIntensity: 0.85,
        fogColor: new Color3(0.05, 0.08, 0.14),
        fogDensity: 0.0018,
        exposure: 1.18,
        contrast: 1.28,
        isWet: false,
        isNight: true,
        wetness: 0,
        zenithColor: new Color3(0.015, 0.025, 0.065),
        midSkyColor: new Color3(0.04, 0.065, 0.13),
        horizonColor: new Color3(0.11, 0.15, 0.25),
        sunDiscColor: new Color3(0.85, 0.90, 1.0),
        cloudColor: new Color3(0.12, 0.15, 0.24),
        cloudDensity: 0.24,
        sunGlowPower: 48.0
      };
    }

    case "midday":
    default: {
      const sunDir = new Vector3(-0.48, -0.74, -0.47).normalize();
      return {
        preset: "midday",
        label: "CLEAR DAY",
        sunDirection: sunDir,
        sunPosition: sunDir.scale(-160),
        sunColor: new Color3(1.0, 0.96, 0.90),
        sunIntensity: 2.05,
        hemiDiffuse: Color3.Lerp(baseSky, new Color3(0.82, 0.90, 1.0), 0.45),
        hemiGround: new Color3(0.16, 0.17, 0.19),
        hemiIntensity: 0.48,
        environmentIntensity: 0.92,
        fogColor: Color3.Lerp(baseSky, new Color3(0.80, 0.86, 0.93), 0.55),
        fogDensity: 0.0012,
        exposure: 1.02,
        contrast: 1.22,
        isWet: false,
        isNight: false,
        wetness: 0,
        zenithColor: new Color3(0.14, 0.34, 0.66),
        midSkyColor: Color3.Lerp(baseSky, new Color3(0.44, 0.66, 0.90), 0.4),
        horizonColor: new Color3(0.84, 0.90, 0.96),
        sunDiscColor: new Color3(1.0, 0.98, 0.90),
        cloudColor: new Color3(0.98, 0.99, 1.0),
        cloudDensity: 0.28,
        sunGlowPower: 32.0
      };
    }
  }
}

let skyShadersRegistered = false;

function registerSkyShaders(): void {
  if (skyShadersRegistered) return;
  skyShadersRegistered = true;

  Effect.ShadersStore["f1PhysicalSkyVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    uniform mat4 world;
    varying vec3 vWorldDir;
    void main(void) {
      vec4 worldPos = world * vec4(position, 1.0);
      vWorldDir = normalize(position);
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  Effect.ShadersStore["f1PhysicalSkyFragmentShader"] = `
    precision highp float;
    varying vec3 vWorldDir;

    uniform vec3 uSunDir;
    uniform vec3 uZenithColor;
    uniform vec3 uMidSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uSunDiscColor;
    uniform vec3 uCloudColor;
    uniform float uCloudDensity;
    uniform float uSunGlowPower;
    uniform float uIsNight;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.04;
        a *= 0.5;
      }
      return v;
    }

    void main(void) {
      vec3 dir = normalize(vWorldDir);
      float elev = clamp(dir.y, -0.25, 1.0);

      // Rayleigh vertical atmospheric gradient
      float hFactor = pow(clamp(elev, 0.0, 1.0), 0.52);
      vec3 sky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.38, hFactor));
      sky = mix(sky, uZenithColor, smoothstep(0.32, 0.95, hFactor));

      // Below-horizon atmospheric bounce so distant terrain edges blend smoothly
      if (elev < 0.0) {
        sky = mix(uHorizonColor, uHorizonColor * 0.62, clamp(-elev * 4.0, 0.0, 1.0));
      }

      // Solar/Lunar Mie halo & disc
      float sunDot = max(dot(dir, normalize(-uSunDir)), 0.0);
      float mieHalo = pow(sunDot, max(4.0, uSunGlowPower * 0.25)) * (uIsNight > 0.5 ? 0.14 : 0.34);
      float sunCore = smoothstep(0.9991, 0.99975, sunDot) * (uIsNight > 0.5 ? 1.2 : 3.0);
      sky += uSunDiscColor * (mieHalo + sunCore);

      // Procedural FBM cloud strata above horizon
      if (elev > 0.02 && uCloudDensity > 0.01) {
        vec2 uv = dir.xz / (elev + 0.18) * 1.4;
        float c = fbm(uv + vec2(0.4, 0.8));
        float cloudMask = smoothstep(1.0 - uCloudDensity * 0.72, 1.0, c) * smoothstep(0.02, 0.22, elev);
        vec3 litCloud = mix(uCloudColor, uSunDiscColor, pow(sunDot, 6.0) * 0.35);
        sky = mix(sky, litCloud, cloudMask * 0.78);
      }

      gl_FragColor = vec4(sky, 1.0);
    }
  `;
}

export function createPhysicalSkyDome(scene: Scene, config: WeatherLightingConfig): Mesh {
  registerSkyShaders();

  scene.clearColor = new Color4(config.fogColor.r, config.fogColor.g, config.fogColor.b, 1.0);

  const skyDome = MeshBuilder.CreateSphere(
    "physicalSkyDome",
    { diameter: 2400, segments: 24 },
    scene
  );
  skyDome.infiniteDistance = true;
  skyDome.isPickable = false;

  const skyShader = new ShaderMaterial(
    "f1PhysicalSkyMat",
    scene,
    {
      vertex: "f1PhysicalSky",
      fragment: "f1PhysicalSky"
    },
    {
      attributes: ["position"],
      uniforms: [
        "worldViewProjection",
        "world",
        "uSunDir",
        "uZenithColor",
        "uMidSkyColor",
        "uHorizonColor",
        "uSunDiscColor",
        "uCloudColor",
        "uCloudDensity",
        "uSunGlowPower",
        "uIsNight"
      ]
    }
  );

  skyShader.backFaceCulling = false;
  skyShader.disableDepthWrite = true;
  skyShader.setVector3("uSunDir", config.sunDirection);
  skyShader.setColor3("uZenithColor", config.zenithColor);
  skyShader.setColor3("uMidSkyColor", config.midSkyColor);
  skyShader.setColor3("uHorizonColor", config.horizonColor);
  skyShader.setColor3("uSunDiscColor", config.sunDiscColor);
  skyShader.setColor3("uCloudColor", config.cloudColor);
  skyShader.setFloat("uCloudDensity", config.cloudDensity);
  skyShader.setFloat("uSunGlowPower", config.sunGlowPower);
  skyShader.setFloat("uIsNight", config.isNight ? 1.0 : 0.0);

  skyDome.material = skyShader;
  return skyDome;
}
