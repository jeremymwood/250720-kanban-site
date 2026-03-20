import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const baseUrl = process.env.README_APP_URL || "http://localhost:5173";
const username = process.env.README_DEMO_USERNAME || "alex";
const password = process.env.README_DEMO_PASSWORD || "Password123";

const clientDir = process.cwd();
const repoRoot = path.resolve(clientDir, "..");
const mediaDir = path.join(repoRoot, "docs", "media");
const videoTmpDir = path.join(mediaDir, "_tmp-video");

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(videoTmpDir, { recursive: true });

function hasFfmpeg() {
  const check = spawnSync("ffmpeg", ["-version"], { stdio: "ignore", shell: true });
  return check.status === 0;
}

function newestFile(dir) {
  const files = fs
    .readdirSync(dir)
    .map((name) => ({
      name,
      full: path.join(dir, name),
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .filter((entry) => fs.statSync(entry.full).isFile())
    .sort((a, b) => b.mtime - a.mtime);

  return files[0]?.full || null;
}

async function waitForStableBoard(page) {
  await page.waitForSelector(".board-grid", { timeout: 20000 });
  await page.waitForTimeout(1000);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: videoTmpDir,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  console.log(`Opening ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(mediaDir, "login-screen.png"),
    fullPage: true,
  });

  const loginButton = page.locator("#button-login");
  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if ((await loginButton.count()) > 0 && (await usernameInput.count()) > 0 && (await passwordInput.count()) > 0) {
    await usernameInput.fill(username);
    await passwordInput.fill(password);
    await loginButton.click();
    await waitForStableBoard(page);

    await page.screenshot({
      path: path.join(mediaDir, "board-overview.png"),
      fullPage: true,
    });

    const firstIssueCard = page.locator(".issue-card").first();
    if ((await firstIssueCard.count()) > 0) {
      await firstIssueCard.click();
      await page.waitForSelector(".modal-overlay-issue-detail .modal-card", { timeout: 10000 });
      await page.screenshot({
        path: path.join(mediaDir, "issue-modal.png"),
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
    }

    const settingsButton = page.locator(".header-icon-button").first();
    if ((await settingsButton.count()) > 0) {
      await settingsButton.click();
      await page.waitForSelector(".modal-overlay-settings .modal-card", { timeout: 10000 });
      await page.screenshot({
        path: path.join(mediaDir, "settings-modal.png"),
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
    }
  } else {
    console.warn("Login controls were not found. Captured only login-screen.png.");
  }

  await context.close();
  await browser.close();

  const videoFile = newestFile(videoTmpDir);
  if (videoFile) {
    const webmOut = path.join(mediaDir, "ishi-flow.webm");
    fs.copyFileSync(videoFile, webmOut);
    console.log(`Saved workflow video: ${webmOut}`);

    if (hasFfmpeg()) {
      const gifOut = path.join(mediaDir, "ishi-flow.gif");
      const ffmpeg = spawnSync(
        "ffmpeg",
        [
          "-y",
          "-i",
          webmOut,
          "-vf",
          "fps=10,scale=1200:-1:flags=lanczos",
          gifOut,
        ],
        { stdio: "inherit", shell: true }
      );
      if (ffmpeg.status === 0) {
        console.log(`Saved workflow gif: ${gifOut}`);
      } else {
        console.warn("ffmpeg conversion failed; keeping .webm output.");
      }
    } else {
      console.warn("ffmpeg not found; skipped GIF conversion. Use ishi-flow.webm.");
    }
  }

  fs.rmSync(videoTmpDir, { recursive: true, force: true });
  console.log("README media capture complete.");
}

run().catch((err) => {
  console.error("Capture failed:", err);
  process.exitCode = 1;
});


