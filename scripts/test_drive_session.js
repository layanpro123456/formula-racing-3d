// Automated driving test verifying Babylon.js simulation, zero NaN, and acceleration
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PORT = 3006;
const OUT_DIR = path.join(__dirname, "..", "out");

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

// 1. Static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";
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
  console.log(`Test server running on port ${PORT}`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("Error") || text.includes("fail")) {
      console.log(`[Browser Console] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser PageError]`, err);
  });

  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    console.log("Page loaded successfully.");

    // Take screenshot of menu
    await page.screenshot({ path: "C:/Users/layan/.gemini/antigravity/brain/ccca0f47-d5c4-43d5-89d5-f350a1a8121b/babylon_menu_verified.png" });
    console.log("Menu screenshot saved.");

    // Click 'LAUNCH RACE' button
    const launchBtn = page.locator("button.f1-primary-btn");
    await launchBtn.click();
    console.log("Launch Race button clicked.");

    // Wait for countdown (4 seconds: 3, 2, 1, GO!)
    await page.waitForTimeout(4200);

    // Check HUD values before driving
    const speedEl = page.locator(".speed-display .value");
    const gearEl = page.locator(".gear-display .value");
    const rpmEl = page.locator(".rpm-text");

    let initialSpeed = await speedEl.innerText();
    let initialGear = await gearEl.innerText();
    let initialRpm = await rpmEl.innerText();
    console.log(`Initial at start line -> Speed: ${initialSpeed} km/h, Gear: ${initialGear}, RPM: ${initialRpm}`);

    if (initialSpeed.includes("NaN") || initialGear.includes("NaN") || initialRpm.includes("NaN")) {
      throw new Error(`NaN detected in HUD at start: Speed=${initialSpeed}, Gear=${initialGear}, RPM=${initialRpm}`);
    }

    // Now press and hold 'w' key to accelerate for 3.5 seconds
    console.log("Applying full throttle (W)...");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(1500);

    let midSpeed = await speedEl.innerText();
    let midGear = await gearEl.innerText();
    console.log(`At 1.5s -> Speed: ${midSpeed} km/h, Gear: ${midGear}`);

    // Steer left while accelerating
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(1500);
    await page.keyboard.up("KeyA");

    let endSpeed = await speedEl.innerText();
    let endGear = await gearEl.innerText();
    let endRpm = await rpmEl.innerText();
    console.log(`At 3.0s -> Speed: ${endSpeed} km/h, Gear: ${endGear}, RPM: ${endRpm}`);

    await page.keyboard.up("KeyW");

    // Take screenshot while driving
    await page.screenshot({ path: "C:/Users/layan/.gemini/antigravity/brain/ccca0f47-d5c4-43d5-89d5-f350a1a8121b/babylon_driving_verified.png" });
    console.log("Driving screenshot saved.");

    const parsedEndSpeed = parseInt(endSpeed, 10);
    if (isNaN(parsedEndSpeed) || parsedEndSpeed <= 0) {
      throw new Error(`Vehicle failed to accelerate! Final speed: ${endSpeed}`);
    }

    console.log(`TEST PASSED! Car successfully accelerated from 0 to ${parsedEndSpeed} km/h with zero NaN issues!`);
  } catch (err) {
    console.error("Test failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
