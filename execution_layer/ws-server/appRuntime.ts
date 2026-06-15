import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";

export type AppStatus = "idle" | "starting" | "running" | "stopped" | "error";

type RunCommandArgs = {
  replType: string;
  replId?: string;
  previewHost?: string;
  hasPackageJson: boolean;
  hasBunLock: boolean;
  packageScripts?: Record<string, unknown>;
};

type AppRuntimeArgs = {
  workspace: string;
  replType: string;
  replId: string;
  previewLogPath: string;
  onOutput: (data: string) => void;
  onStatus: (status: AppStatus) => void;
  onError: (message: string) => void;
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, "'\"'\"'")}'`;
const REACT_PREVIEW_PORT = 5173;
const NEXT_PREVIEW_PORT = 3000;

function getInstallCommand(hasBunLock: boolean): string {
  return hasBunLock ? "bun install --frozen-lockfile" : "bun install";
}

function scriptExists(scripts: Record<string, unknown> | undefined, name: string): boolean {
  return typeof scripts?.[name] === "string" && scripts[name] !== "";
}

export function getAppRunCommand(args: RunCommandArgs): string {
  const type = args.replType.toLowerCase();
  const install = args.hasPackageJson ? `${getInstallCommand(args.hasBunLock)}\n` : "";

  if (type === "react") {
    const previewHost =
      args.previewHost ??
      (() => {
        try {
          return process.env.PREVIEW_URL ? new URL(process.env.PREVIEW_URL).host : "";
        } catch {
          return "";
        }
      })();
    return [
      "set -euo pipefail",
      install.trimEnd(),
      previewHost ? `export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=${shellQuote(previewHost)}` : "",
      `bun run dev --host 0.0.0.0 --port ${REACT_PREVIEW_PORT}`,
    ].filter(Boolean).join("\n");
  }

  if (type === "next") {
    const previewHost =
      args.previewHost ??
      (() => {
        try {
          return process.env.PREVIEW_URL ? new URL(process.env.PREVIEW_URL).host : "";
        } catch {
          return "";
        }
      })();
    return [
      "set -euo pipefail",
      install.trimEnd(),
      "export HOSTNAME=0.0.0.0",
      // Next 15+/16 block cross-origin dev requests (HMR, dev scripts) unless the
      // preview host is allow-listed. next.config.ts reads PREVIEW_HOST into allowedDevOrigins.
      previewHost ? `export PREVIEW_HOST=${shellQuote(previewHost)}` : "",
      `bun x next dev --hostname 0.0.0.0 -p ${NEXT_PREVIEW_PORT}`,
    ].filter(Boolean).join("\n");
  }

  if (args.hasPackageJson) {
    if (scriptExists(args.packageScripts, "dev")) return `set -euo pipefail\n${install}bun run dev`;
    if (scriptExists(args.packageScripts, "start")) return `set -euo pipefail\n${install}bun run start`;
  }

  if (type === "bun") return "set -euo pipefail\nbun run index.ts";
  if (type === "node" || type === "javascript") return "set -euo pipefail\nnode index.js";

  throw new Error(`Run Code is not configured for repl type: ${args.replType}`);
}

function readPackageScripts(workspace: string): Record<string, unknown> | undefined {
  const packagePath = path.join(workspace, "package.json");
  if (!fs.existsSync(packagePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as { scripts?: Record<string, unknown> };
    return parsed.scripts;
  } catch {
    return undefined;
  }
}

function getPreviewHost(): string | undefined {
  try {
    return process.env.PREVIEW_URL ? new URL(process.env.PREVIEW_URL).host : undefined;
  } catch {
    return undefined;
  }
}

export function createAppRuntime(args: AppRuntimeArgs) {
  let child: ChildProcessWithoutNullStreams | null = null;
  let status: AppStatus = "idle";

  const setStatus = (next: AppStatus) => {
    status = next;
    args.onStatus(next);
  };

  const stop = async (): Promise<void> => {
    if (!child) {
      if (status === "running" || status === "starting") setStatus("stopped");
      return;
    }

    const current = child;
    child = null;
    try {
      if (current.pid) process.kill(-current.pid, "SIGTERM");
      else current.kill("SIGTERM");
    } catch {
      current.kill("SIGTERM");
    }
    setStatus("stopped");
  };

  const start = async (): Promise<void> => {
    await stop();

    const hasPackageJson = fs.existsSync(path.join(args.workspace, "package.json"));
    const hasBunLock = fs.existsSync(path.join(args.workspace, "bun.lock"));
    const command = getAppRunCommand({
      replType: args.replType,
      replId: args.replId,
      previewHost: getPreviewHost(),
      hasPackageJson,
      hasBunLock,
      packageScripts: readPackageScripts(args.workspace),
    });

    fs.mkdirSync(path.dirname(args.previewLogPath), { recursive: true });
    fs.writeFileSync(args.previewLogPath, "", "utf-8");
    args.onOutput(`$ ${command.split("\n").at(-1) ?? "run"}\n`);
    setStatus("starting");

    child = spawn("su", ["-s", "/bin/bash", "sandbox", "-c", command], {
      cwd: args.workspace,
      detached: true,
      env: {
        ...process.env,
        HOME: "/home/sandbox",
        HOSTNAME: "0.0.0.0",
        REPL_ID: args.replId,
        REPL_TYPE: args.replType,
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      },
    });

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      fs.appendFile(args.previewLogPath, text, () => {});
      args.onOutput(text);
    };

    child.stdout.on("data", handleOutput);
    child.stderr.on("data", handleOutput);
    child.on("error", (error) => {
      args.onError(error.message);
      setStatus("error");
    });
    child.on("exit", (code, signal) => {
      if (child) {
        child = null;
        setStatus(code === 0 ? "stopped" : "error");
        args.onOutput(`\n[process exited: ${signal ?? code}]\n`);
      }
    });
  };

  return {
    getStatus: () => status,
    markRunning: () => {
      if (status === "starting") setStatus("running");
    },
    start,
    stop,
  };
}
