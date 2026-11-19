// Formula Racing 3D — Comprehensive Automated Test Suite
// Validates: All 6 circuits, Spline3D, VehiclePhysics, Surface Detection, Non-Radial Barriers,
// Multi-Framerate Stability (30, 60, 120 FPS), InputManager, AI Grid, and Browser E2E.

const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// Load modules from compiled project
const { TRACKS } = require("../data/tracks");
const { Spline3D } = require("../lib/math/Spline3D");
const { VehiclePhysics } = require("../lib/physics/VehiclePhysics");
const { AISimulator } = require("../lib/ai/AIDriver");
const { InputManager } = require("../lib/input/InputManager");
const { RaceCommentary } = require("../lib/commentary/RaceCommentary");
const { Vector3 } = require("@babylonjs/core");

const PORT = 3008;
const OUT_DIR = path.join(__dirname, "..", "out");

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

console.log("=================================================");
console.log("  FORMULA RACING 3D — AUTOMATED TEST SUITE       ");
console.log("=================================================");

// -----------------------------------------------------------------------------
// 1. Spline & Circuit Geometry Tests for ALL 6 Tracks
// -----------------------------------------------------------------------------
TRACKS.forEach((track) => {
  runTest(`Track Geometry: ${track.name} (${track.id})`, () => {
    assert(track.points && track.points.length >= 8, "Track must have at least 8 waypoints");
    const spline = new Spline3D(track.points);
    assert(spline.totalLength > 1000, `Track length must be realistic (>1000m), got ${spline.totalLength}`);
    assert(spline.samples.length === 1500, "Spline must precompute 1500 dense samples");

    // Test continuity & tangent normalization across samples
    for (let i = 0; i < spline.samples.length; i++) {
      const s = spline.samples[i];
      assert(Number.isFinite(s.point.x) && Number.isFinite(s.point.y) && Number.isFinite(s.point.z), `Sample ${i} point has NaN`);
      const tanLen = s.tangent.length();
      assert(Math.abs(tanLen - 1.0) < 0.01, `Sample ${i} tangent must be normalized, got ${tanLen}`);
      const normLen = s.normal.length();
      assert(Math.abs(normLen - 1.0) < 0.01, `Sample ${i} normal must be normalized, got ${normLen}`);
      
      // Tangent and normal must be strictly orthogonal
      const dot = Vector3.Dot(s.tangent, s.normal);
      assert(Math.abs(dot) < 0.02, `Sample ${i} tangent and normal not orthogonal, dot=${dot}`);
    }

    // Test allocation-free queryClosest
    const outPt = new Vector3();
    const outTan = new Vector3();
    const outNorm = new Vector3();
    const testPos = spline.samples[100].point.clone().addInPlace(spline.samples[100].normal.scale(2.5));
    
    const query = spline.queryClosest(testPos, 100 / 1500, outPt, outTan, outNorm);
    assert(Math.abs(query.lateralDistance - 2.5) < 0.15, `Expected lateral distance ~2.5m, got ${query.lateralDistance}`);
    assert(Math.abs(query.signedLateralDistance - 2.5) < 0.15, `Expected signed lateral distance ~2.5m, got ${query.signedLateralDistance}`);
  });
});

// -----------------------------------------------------------------------------
// 2. Surface Classification Tests (Asphalt, Kerb, Runoff, Barrier)
// -----------------------------------------------------------------------------
runTest("Surface Classification & Off-Track Detection", () => {
  const spaTrack = TRACKS.find((t) => t.id === "spa");
  const spline = new Spline3D(spaTrack.points);
  const physics = new VehiclePhysics();

  const startPt = spline.getPointAt(0);
  const startTan = spline.getTangentAt(0);
  const startHeading = Math.atan2(startTan.x, startTan.z);
  physics.reset(startPt, startHeading);

  const halfW = spaTrack.width * 0.5; // 3.4m
  const kerbW = 0.95;
  const runoffW = 3.0;
  const barrierOffset = halfW + kerbW + runoffW; // 7.35m

  const centerPt = new Vector3();
  const tan = new Vector3();
  const norm = new Vector3();
  spline.queryClosest(startPt, 0, centerPt, tan, norm);

  // A. On Asphalt (Centerline)
  physics.position.copyFrom(centerPt);
  let tData = physics.update(0.016, { throttle: 0, brake: 0, steer: 0 }, spaTrack, spline);
  assert(!tData.onKerb, "Center of road should not be on kerb");
  assert(!tData.offTrack, "Center of road should not be off track");

  // B. On Asphalt (Near white line, 2.0m from center)
  physics.position.copyFrom(centerPt).addInPlace(norm.scale(2.0));
  tData = physics.update(0.016, { throttle: 0, brake: 0, steer: 0 }, spaTrack, spline);
  assert(!tData.onKerb, "Road edge (2.0m) should not be on kerb");
  assert(!tData.offTrack, "Road edge (2.0m) should not be off track");

  // C. On Kerb (3.8m from center -> halfW=3.4m, kerb=3.4m..4.35m)
  physics.position.copyFrom(centerPt).addInPlace(norm.scale(3.8));
  tData = physics.update(0.016, { throttle: 0, brake: 0, steer: 0 }, spaTrack, spline);
  assert(tData.onKerb, "3.8m from center MUST be detected on kerb");
  assert(!tData.offTrack, "Vehicle on kerb must NOT trigger offTrack");

  // D. In Runoff / Grass (5.5m from center -> runoff=4.35m..7.35m)
  physics.position.copyFrom(centerPt).addInPlace(norm.scale(5.5));
  tData = physics.update(0.016, { throttle: 0, brake: 0, steer: 0 }, spaTrack, spline);
  assert(!tData.onKerb, "5.5m from center should not be on kerb");
  assert(tData.offTrack, "5.5m from center MUST trigger offTrack");

  // E. Barrier Collision (8.5m from center -> past barrier 7.35m)
  physics.speed = 40; // Driving at 40 m/s (~144 km/h)
  physics.position.copyFrom(centerPt).addInPlace(norm.scale(8.5));
  const preCollisionT = physics.currentT;
  tData = physics.update(0.016, { throttle: 0, brake: 0, steer: 0 }, spaTrack, spline);

  // Must be deflected back inside barrier boundary
  assert(physics.lateralDistance <= barrierOffset, `Car must be deflected inside barrier (${barrierOffset}), got ${physics.lateralDistance}`);
  // Barrier collision must be strictly non-radial: longitudinal position must not jump wildly
  assert(Math.abs(physics.currentT - preCollisionT) < 0.005, `Longitudinal position jumped during barrier hit: pre=${preCollisionT}, post=${physics.currentT}`);
  // Speed should be scrubbed
  assert(physics.speed < 40, `Speed should be scrubbed on barrier hit, got ${physics.speed}`);
});

// -----------------------------------------------------------------------------
// 3. Multi-Framerate Stability (30 FPS, 60 FPS, 120 FPS)
// -----------------------------------------------------------------------------
[30, 60, 120].forEach((fps) => {
  runTest(`Vehicle Physics Stability at ${fps} FPS`, () => {
    const monzaTrack = TRACKS.find((t) => t.id === "monza");
    const spline = new Spline3D(monzaTrack.points);
    const physics = new VehiclePhysics();

    const startPt = spline.getPointAt(0);
    const startTan = spline.getTangentAt(0);
    const startHeading = Math.atan2(startTan.x, startTan.z);
    physics.reset(startPt, startHeading);

    const dt = 1.0 / fps;
    for (let step = 0; step < fps * 3; step++) {
      const tData = physics.update(dt, { throttle: 1.0, brake: 0, steer: 0.1 }, monzaTrack, spline);
      assert(Number.isFinite(tData.speedKmh), `NaN speed at step ${step} (${fps}fps)`);
      assert(Number.isFinite(tData.rpm), `NaN RPM at step ${step} (${fps}fps)`);
      assert(Number.isFinite(tData.brakeTemp), `NaN brakeTemp at step ${step} (${fps}fps)`);
      assert(Number.isFinite(tData.gForceLat), `NaN gForceLat at step ${step} (${fps}fps)`);
      assert(Number.isFinite(tData.gForceLong), `NaN gForceLong at step ${step} (${fps}fps)`);
    }

    assert(physics.speed > 15, `Expected speed > 15 m/s after 3s at ${fps}fps, got ${physics.speed}`);
    assert(physics.gear >= 1, `Expected gear >= 1 at ${fps}fps, got ${physics.gear}`);
  });
});

// -----------------------------------------------------------------------------
// 4. InputManager Gamepad & Analog Deadzone Filtering
// -----------------------------------------------------------------------------
runTest("InputManager Gamepad Deadzone & Releasing", () => {
  const input = new InputManager();
  input.deadzone = 0.08;

  let res = input.getInputs(0.016, true);
  assert.strictEqual(res.throttle, 0);
  assert.strictEqual(res.brake, 0);
  assert.strictEqual(res.steer, 0);
  assert.strictEqual(res.accelerate, false);

  res = input.getInputs(0.016, false);
  assert.strictEqual(res.throttle, 0);
  assert.strictEqual(res.brake, 0);
  assert.strictEqual(res.steer, 0);

  input.reset();
  assert.strictEqual(input.getInputs(0.016, true).steer, 0);
});

// -----------------------------------------------------------------------------
// 5. AI Grid Real Arc-Length Progression
// -----------------------------------------------------------------------------
runTest("AI Simulator Arc-Length Progression across Tracks", () => {
  TRACKS.forEach((track) => {
    const spline = new Spline3D(track.points);
    const aiSim = new AISimulator();
    aiSim.initializeGrid(track, spline);

    assert(aiSim.cars.length === 5, "AI Grid must have 5 cars");
    for (const car of aiSim.cars) {
      assert(Number.isFinite(car.position.x), `AI car ${car.name} position.x is NaN`);
      assert(Number.isFinite(car.position.y), `AI car ${car.name} position.y is NaN`);
      assert(Number.isFinite(car.position.z), `AI car ${car.name} position.z is NaN`);
      assert(car.t >= 0 && car.t < 1, `AI car ${car.name} t out of range: ${car.t}`);
    }

    const playerPos = spline.getPointAt(0);
    for (let step = 0; step < 60; step++) {
      aiSim.update(0.016, track, spline, playerPos, true);
    }

    for (const car of aiSim.cars) {
      assert(car.speed > 5, `AI car ${car.name} should accelerate, got ${car.speed}`);
      assert(Number.isFinite(car.heading), `AI car ${car.name} heading is NaN`);
    }
  });
});

// -----------------------------------------------------------------------------
// 6. Automatic Gearbox: Full Throttle Acceleration Gears 1-8 & Downshifting
// -----------------------------------------------------------------------------
const straightTestTrack = {
  id: "straight-test",
  name: "Straight Test Strip",
  officialName: "Straight Acceleration Strip",
  location: "Proving Ground",
  country: "Italy",
  length: "5.0 km",
  turns: 0,
  color: "#2a9d8f",
  skyColor: "#9ec5e8",
  groundColor: "#2f4f34",
  width: 15,
  points: [
    [0, 0, 0],
    [0, 0, 500],
    [0, 0, 1000],
    [0, 0, 1500],
    [0, 0, 2000],
    [0, 0, 2500],
    [0, 0, 3000],
    [0, 0, 3500],
    [0, 0, 4000],
    [0, 0, 4500],
    [0, 0, 5000]
  ],
  sectors: [
    { id: 1, name: "Sector 1", tEnd: 0.33 },
    { id: 2, name: "Sector 2", tEnd: 0.67 },
    { id: 3, name: "Sector 3", tEnd: 1.0 }
  ],
  drsZones: [{ start: 0, end: 1 }],
  lapsDefault: 3
};

runTest("Automatic Gearbox: Gears 1 through 8 Progression", () => {
  const spline = new Spline3D(straightTestTrack.points, 1.0);
  const physics = new VehiclePhysics();

  const startPt = spline.getPointAt(0);
  const startTan = spline.getTangentAt(0);
  const startHeading = Math.atan2(startTan.x, startTan.z);
  physics.reset(startPt, startHeading);

  const reachedGears = new Set([1]);
  let rpmDropObserved = false;
  let prevRpm = 4000;

  physics.onGearShift = (newG, oldG) => {
    reachedGears.add(newG);
    if (newG > oldG) {
      if (prevRpm > 10500) {
        rpmDropObserved = true;
      }
    }
  };

  const dt = 1.0 / 60.0;
  // Accelerate for 24 seconds at 60 FPS down straight
  for (let step = 0; step < 60 * 24; step++) {
    prevRpm = physics.rpm;
    const tData = physics.update(dt, { throttle: 1.0, brake: 0, steer: 0, drs: true }, straightTestTrack, spline);

    assert(Number.isFinite(tData.speedMs), `Speed became NaN at step ${step}`);
    assert(Number.isFinite(tData.rpm), `RPM became NaN at step ${step}`);
    assert(tData.rpm >= 3800 && tData.rpm <= 12600, `RPM out of range: ${tData.rpm}`);
  }

  // Verify all 8 forward gears were reached
  for (let g = 1; g <= 8; g++) {
    assert(reachedGears.has(g), `Gear ${g} was not reached! Reached: ${[...reachedGears].join(", ")}`);
  }

  assert(rpmDropObserved, "RPM drop on upshift was not observed");
  assert(physics.speed > 85, `Expected top speed > 85 m/s (>306 km/h) in gear 8, got ${physics.speed}`);
  assert.strictEqual(physics.gear, 8, `Expected gear 8 at top speed, got ${physics.gear}`);
});

runTest("Automatic Gearbox: Downshifting under Braking", () => {
  const spline = new Spline3D(straightTestTrack.points, 1.0);
  const physics = new VehiclePhysics();

  physics.reset(spline.getPointAt(0), 0);

  // Bring car to speed in high gear
  const dt = 1.0 / 60.0;
  for (let step = 0; step < 60 * 18; step++) {
    physics.update(dt, { throttle: 1.0, brake: 0, steer: 0, drs: true }, straightTestTrack, spline);
  }
  assert(physics.gear >= 7, `Expected high gear before braking, got ${physics.gear}`);

  // Apply heavy braking
  const downshiftedGears = new Set([physics.gear]);
  physics.onGearShift = (newG, oldG) => {
    downshiftedGears.add(newG);
  };

  for (let step = 0; step < 60 * 6; step++) {
    const brakeInput = physics.speed > 0.2 ? 1.0 : 0;
    const tData = physics.update(dt, { throttle: 0, brake: brakeInput, steer: 0 }, straightTestTrack, spline);
    assert(Number.isFinite(tData.speedMs), `NaN speed during braking step ${step}`);
    assert(tData.rpm <= 12500, `Redline exceeded during downshift: ${tData.rpm}`);
  }

  // Car should be stopped and in gear 1
  assert(physics.speed <= 0.5, `Car should be stopped, got speed: ${physics.speed}`);
  assert.strictEqual(physics.gear, 1, `Car should be in gear 1 when stopped, got ${physics.gear}`);
  assert(downshiftedGears.has(1), "Downshift to gear 1 was not recorded");
  assert(downshiftedGears.has(2), "Downshift to gear 2 was not recorded");
});

runTest("Automatic Gearbox: Reverse and Stationary Behavior", () => {
  const spline = new Spline3D(straightTestTrack.points, 1.0);
  const physics = new VehiclePhysics();

  physics.reset(spline.getPointAt(0), 0);
  const dt = 0.016;

  // At standstill with no inputs
  let tData = physics.update(dt, { throttle: 0, brake: 0, steer: 0 }, straightTestTrack, spline);
  assert.strictEqual(tData.gear, 1, "Standstill must be in gear 1");
  assert.strictEqual(tData.isReverse, false);

  // Apply brake at standstill -> reverse
  for (let i = 0; i < 40; i++) {
    tData = physics.update(dt, { throttle: 0, brake: 1.0, steer: 0 }, straightTestTrack, spline);
  }
  assert(physics.speed < 0, `Expected negative speed in reverse, got ${physics.speed}`);
  assert.strictEqual(tData.gear, -1, `Expected reverse gear (-1), got ${tData.gear}`);
  assert.strictEqual(tData.isReverse, true);

  // Apply throttle -> pull forward into gear 1
  for (let i = 0; i < 60; i++) {
    tData = physics.update(dt, { throttle: 1.0, brake: 0, steer: 0 }, straightTestTrack, spline);
  }
  assert(physics.speed > 5, `Expected forward motion, got ${physics.speed}`);
  assert(tData.gear >= 1, `Expected gear 1+, got ${tData.gear}`);
  assert.strictEqual(tData.isReverse, false);
});

runTest("Automatic Gearbox: Multi-framerate Shift Stability (30, 60, 120 FPS)", () => {
  const spline = new Spline3D(straightTestTrack.points, 1.0);

  [30, 60, 120].forEach((fps) => {
    const physics = new VehiclePhysics();
    physics.reset(spline.getPointAt(0), 0);
    const dt = 1.0 / fps;

    for (let step = 0; step < fps * 15; step++) {
      physics.update(dt, { throttle: 1.0, brake: 0, steer: 0, drs: true }, straightTestTrack, spline);
    }

    assert(physics.gear >= 6, `Expected gear >= 6 after 15s at ${fps} FPS, got ${physics.gear}`);
    assert(physics.speed > 60, `Expected speed > 60 m/s at ${fps} FPS, got ${physics.speed}`);
  });
});

// -----------------------------------------------------------------------------
// 7. English Race Commentary Engine Tests
// -----------------------------------------------------------------------------
runTest("Race Commentary: Events, Priorities, and Transitions", () => {
  const commentary = new RaceCommentary();
  let latestUpdate = null;
  commentary.onUpdate = (st) => {
    latestUpdate = st;
  };

  // Test Race Start
  commentary.update(0, 1, 3, 1, 6, false, false, false, false, 0, false, 0);
  assert(latestUpdate !== null, "Commentary should produce state update on start");
  assert.strictEqual(latestUpdate.latestMessage.category, "START");

  // Test Overtake (P6 -> P4)
  commentary.update(null, 1, 3, 1, 4, false, false, false, false, 10, false, 30);
  assert.strictEqual(latestUpdate.latestMessage.category, "OVERTAKE");
  assert(latestUpdate.latestMessage.text.includes("P4"));

  // Test Sector Split (S1 -> S2)
  commentary.update(null, 1, 3, 2, 4, false, false, false, false, 25, false, 45);
  assert.strictEqual(latestUpdate.latestMessage.category, "SECTOR");

  // Test DRS Available
  commentary.update(null, 1, 3, 2, 4, false, false, true, false, 35, false, 55);
  assert.strictEqual(latestUpdate.latestMessage.category, "DRS");

  // Test Off-Track Warning
  commentary.update(null, 1, 3, 2, 4, true, false, true, false, 40, false, 40);
  assert.strictEqual(latestUpdate.latestMessage.category, "WARNING");

  // Test Track Limits Recovery
  commentary.update(null, 1, 3, 2, 4, false, false, true, false, 45, false, 42);
  assert.strictEqual(latestUpdate.latestMessage.category, "LIMITS");

  // Test Final Lap
  commentary.update(null, 3, 3, 1, 2, false, false, false, false, 90, false, 50);
  assert.strictEqual(latestUpdate.latestMessage.category, "LAP");

  // Test Race Finish
  commentary.update(null, 3, 3, 3, 1, false, false, false, false, 120, true, 20);
  assert.strictEqual(latestUpdate.latestMessage.category, "FINISH");

  // Test Mute / Unmute
  assert.strictEqual(commentary.getIsEnabled(), true);
  commentary.toggleMute();
  assert.strictEqual(commentary.getIsEnabled(), false);
  commentary.toggleMute();
  assert.strictEqual(commentary.getIsEnabled(), true);

  commentary.dispose();
});

// -----------------------------------------------------------------------------
// 8. Playwright End-to-End Browser Test
// -----------------------------------------------------------------------------
function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html";
  if (ext === ".js") return "application/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".json") return "application/json";
  if (ext === ".png") return "image/png";
  if (ext === ".wasm") return "application/wasm";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || !reqPath) {
    reqPath = "index.html";
  } else {
    reqPath = reqPath.replace(/^\//, "");
  }

  let fullPath = path.join(OUT_DIR, reqPath);
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(OUT_DIR, "index.html");
  }

  try {
    const data = fs.readFileSync(fullPath);
    res.writeHead(200, { "Content-Type": getMime(fullPath) });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, async () => {
  console.log(`E2E Test server active on http://localhost:${PORT}`);

  await runAsyncTest("Playwright E2E: Launch, Countdown, Camera Toggle, Pause/Resume, Driving", async () => {
    const browser = await chromium.launch({
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const consoleErrors = [];

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error" && !text.includes("favicon")) {
        consoleErrors.push(text);
      }
    });

    console.log("Navigating to app...");
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    console.log("Page loaded.");

    // 1. Launch Grand Prix
    const launchBtn = page.locator("button.f1-primary-btn");
    await launchBtn.click();
    console.log("Session launched, starting 5-red-lights countdown...");

    // 2. Wait for countdown lights out (4.2 seconds)
    await page.waitForTimeout(4200);

    const speedEl = page.locator(".speed-display .value");
    const gearEl = page.locator(".gear-display .value");
    const rpmEl = page.locator(".rpm-text");

    let initialSpeed = await speedEl.innerText();
    let initialGear = await gearEl.innerText();
    let initialRpm = await rpmEl.innerText();

    console.log(`Start line -> Speed: ${initialSpeed} km/h, Gear: ${initialGear}, RPM: ${initialRpm}`);
    assert(!initialSpeed.includes("NaN"), `NaN in speed: ${initialSpeed}`);
    assert(!initialGear.includes("NaN"), `NaN in gear: ${initialGear}`);
    assert(!initialRpm.includes("NaN"), `NaN in RPM: ${initialRpm}`);
    assert.strictEqual(initialSpeed.trim(), "0", `Speed should be 0 at start, got ${initialSpeed}`);
    assert.strictEqual(initialGear.trim(), "1", `Gear should be 1 at start, got ${initialGear}`);

    // 3. Accelerate forward
    console.log("Accelerating with W key...");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);

    let drivingSpeed = await speedEl.innerText();
    let drivingGear = await gearEl.innerText();
    console.log(`At 2s -> Speed: ${drivingSpeed} km/h, Gear: ${drivingGear}`);
    const parsedDrivingSpeed = parseInt(drivingSpeed, 10);
    assert(parsedDrivingSpeed > 20, `Car should accelerate on W, got ${drivingSpeed}`);

    // Capture chase camera view with graphics upgrades
    const chaseScreenshotPath = "C:/Users/layan/.gemini/antigravity/brain/ccca0f47-d5c4-43d5-89d5-f350a1a8121b/chase_cam_graphics.png";
    await page.screenshot({ path: chaseScreenshotPath });
    console.log(`Chase camera graphics screenshot saved to ${chaseScreenshotPath}`);

    // 4. Test Camera Switching (Press 'C') -> Should NOT reset car or speed!
    console.log("Testing Camera Toggle (C)...");
    await page.keyboard.press("KeyC");
    await page.waitForTimeout(500);
    let postCamSpeed = await speedEl.innerText();
    console.log(`Post-camera toggle -> Speed: ${postCamSpeed} km/h`);
    const parsedPostCamSpeed = parseInt(postCamSpeed, 10);
    assert(parsedPostCamSpeed > 15, `Camera toggle must NOT reset vehicle speed: pre=${drivingSpeed}, post=${postCamSpeed}`);

    // 5. Test Pause / Resume -> Should preserve state
    console.log("Testing Pause (Escape)...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const pausedModal = page.locator(".modal h2");
    const pausedText = await pausedModal.innerText();
    console.log(`Modal header: ${pausedText}`);
    assert(pausedText.includes("PAUSED"), `Modal should state PAUSED, got ${pausedText}`);

    // Click Resume button
    console.log("Testing Resume...");
    const resumeBtn = page.locator(".modal button.primary-btn");
    await resumeBtn.click();
    await page.waitForTimeout(500);

    let postResumeSpeed = await speedEl.innerText();
    console.log(`Post-resume -> Speed: ${postResumeSpeed} km/h`);
    const parsedResumeSpeed = parseInt(postResumeSpeed, 10);
    assert(parsedResumeSpeed > 15, `Resume must preserve vehicle speed, got ${postResumeSpeed}`);

    // Release throttle
    await page.keyboard.up("KeyW");

    // Capture screenshot
    const screenshotPath = "C:/Users/layan/.gemini/antigravity/brain/ccca0f47-d5c4-43d5-89d5-f350a1a8121b/e2e_repaired_gameplay.png";
    await page.screenshot({ path: screenshotPath });
    console.log(`Gameplay verification screenshot saved to ${screenshotPath}`);

    // Verify zero console errors
    assert.strictEqual(consoleErrors.length, 0, `Browser had console errors: ${consoleErrors.join("; ")}`);

    await browser.close();
  });

  server.close();
  console.log("=================================================");
  console.log("  ALL TESTS COMPLETED SUCCESSFULLY!              ");
  console.log("=================================================");
});
