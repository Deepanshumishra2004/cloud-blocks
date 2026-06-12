const { spawn } = require("child_process");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const frontendLockPath = path.join(root, "frontend", ".next", "dev", "lock");

function cleanupWindowsDevProcesses() {
  if (process.platform !== "win32") return;

  const command = [
    "$project = 'D:\\repit'",
    "Get-CimInstance Win32_Process | Where-Object {",
    "  $_.CommandLine -and (",
    "    ($_.CommandLine -like '*cd frontend; bun run dev*') -or",
    "    ($_.CommandLine -like '*cd backend; bun run dev*') -or",
    "    ($_.CommandLine -like '*D:\\repit\\frontend*next dev*') -or",
    "    ($_.CommandLine -like '*D:\\repit\\backend*bun --watch index.ts*')",
    "  )",
    "} | ForEach-Object {",
    "  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue",
    "}",
  ].join(" ");

  spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    cwd: root,
    stdio: "ignore",
  });
}

function cleanupFrontendLock() {
  try {
    fs.rmSync(frontendLockPath, { force: true });
  } catch {}
}

function start(name, cwd) {
  const child = spawn("bun", ["run", "dev"], {
    cwd,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      process.exitCode = code ?? 1;
      shutdown();
    }
  });

  return child;
}

cleanupWindowsDevProcesses();
cleanupFrontendLock();

const children = [
  start("frontend", path.join(root, "frontend")),
  start("backend", path.join(root, "backend")),
];

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  setTimeout(() => process.exit(process.exitCode ?? 0), 300);
});

process.on("SIGTERM", () => {
  shutdown();
  setTimeout(() => process.exit(process.exitCode ?? 0), 300);
});
