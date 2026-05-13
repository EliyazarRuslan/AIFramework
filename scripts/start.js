#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PORT = String(process.env.PORT || "5173");
const DIST_INDEX = path.join("dist", "index.html");
const VIDEO = path.join("remotion-hero", "out", "hero-ambient.mp4");

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const log = (message = "") => console.log(message);
const heading = (message) => log(`${color.green}${color.bold}▶ ${message}${color.reset}`);
const warn = (message) =>
  log(`${color.yellow}${color.bold}!${color.reset} ${color.yellow}${message}${color.reset}`);
const fail = (message) => console.error(`${color.red}${color.bold}error:${color.reset} ${message}`);

function run(command, args, options = {}) {
  const label = `${command} ${args.join(" ")}`;
  log(`${color.dim}$ ${label}${color.reset}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, PORT },
      ...options,
    });

    const forwardSignal = (signal) => child.kill(signal);
    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);

    child.on("error", reject);
    child.on("close", (code, signal) => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${signal || code}`));
    });
  });
}

async function ensureBuild() {
  const needsBuild = process.env.FORCE_BUILD || !fs.existsSync(DIST_INDEX);
  if (!needsBuild) {
    log(`${color.dim}Using existing dist/ build. Set FORCE_BUILD=1 to rebuild.${color.reset}`);
    return;
  }

  if (!fs.existsSync(VIDEO)) {
    warn("Hero video not found. The first build may render Remotion output.");
    log(
      `${color.dim}Skip rendering with SKIP_REMOTION_RENDER=1 npm start; the page keeps its CSS fallback.${color.reset}`,
    );
  }

  const skipRender = process.env.SKIP_REMOTION_RENDER === "1" || process.env.NO_RENDER === "1";
  const buildScript = skipRender ? "build:site" : "build";
  heading(`Building site via npm run ${buildScript}`);
  await run("npm", ["run", buildScript]);
}

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(opener, [url], { stdio: "ignore", detached: true, shell: true });
  child.on("error", () => undefined);
  child.unref();
}

async function main() {
  await ensureBuild();

  const url = `http://localhost:${PORT}/`;
  log();
  heading("Goldbell AI");
  log(
    `${color.dim}Serving production build at${color.reset} ${color.cyan}${color.bold}${url}${color.reset}`,
  );
  log(
    `${color.dim}Source modules live in src/. Remotion composition lives in remotion-hero/src/.${color.reset}`,
  );
  log(`${color.dim}Press Ctrl+C to stop.${color.reset}`);
  log();

  setTimeout(() => openBrowser(url), 1000);
  await run("npm", ["run", "serve"]);
}

main().catch((error) => {
  fail(error.message);
  process.exit(1);
});
