const { execSync, spawn } = require("child_process");
const path = require("path");

const frontendRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const port = 3000;

function findWindowsPortPid(targetPort) {
  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${targetPort}`, {
      cwd: frontendRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });

    const line = output
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry && entry.includes(`:${targetPort}`) && entry.includes("LISTENING"));

    if (!line) return null;
    const parts = line.split(/\s+/);
    const pid = Number(parts.at(-1));
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function getWindowsProcessName(pid) {
  try {
    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      cwd: frontendRoot,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    if (!output || output.startsWith("INFO:")) return null;
    const firstField = output.split(",")[0] ?? "";
    return firstField.replace(/^"|"$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

function ensurePort3000() {
  if (!isWindows) return;

  const pid = findWindowsPortPid(port);
  if (!pid) return;

  const processName = getWindowsProcessName(pid);
  if (processName === "node.exe" || processName === "bun.exe") {
    try {
      execSync(`taskkill /PID ${pid} /F`, {
        cwd: frontendRoot,
        stdio: ["ignore", "ignore", "ignore"],
      });
      return;
    } catch {}
  }

  console.error(`Port ${port} is busy (PID ${pid}${processName ? `, ${processName}` : ""}). Free it, then run again.`);
  process.exit(1);
}

ensurePort3000();

const child = spawn("next", ["dev", "-p", String(port)], {
  cwd: frontendRoot,
  shell: true,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
