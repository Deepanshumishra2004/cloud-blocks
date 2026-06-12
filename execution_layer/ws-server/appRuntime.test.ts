import { describe, expect, it } from "bun:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAppRunCommand } from "./appRuntime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bootScript = path.resolve(__dirname, "../main.sh");
const dockerfile = path.resolve(__dirname, "../dockerfile");

describe("repl app runtime", () => {
  it("does not auto-start user code from the pod boot script", () => {
    const script = fs.readFileSync(bootScript, "utf-8");

    expect(script).not.toContain("bun run dev");
    expect(script).not.toContain("bun x next dev");
    expect(script).not.toMatch(/start_preview\s*$/m);
  });

  it("installs ws-server dependencies in the runtime image before booting", () => {
    const image = fs.readFileSync(dockerfile, "utf-8");

    expect(image).toContain("COPY ws-server/package.json ws-server/bun.lock ./ws-server/");
    expect(image).toContain("bun install --frozen-lockfile");
  });

  it("installs native build prerequisites for node-pty before dependency install", () => {
    const image = fs.readFileSync(dockerfile, "utf-8");
    const buildDepsIndex = image.indexOf("python3");
    const installIndex = image.indexOf("bun install --frozen-lockfile");

    expect(buildDepsIndex).toBeGreaterThan(-1);
    expect(image).toContain("make");
    expect(image).toContain("g++");
    expect(buildDepsIndex).toBeLessThan(installIndex);
  });

  it("installs Node.js for Next.js and Node repl runtimes", () => {
    const image = fs.readFileSync(dockerfile, "utf-8");

    expect(image).toContain("nodejs");
  });

  it("builds an explicit React dev-server command for Run Code", () => {
    expect(getAppRunCommand({ replType: "react", hasPackageJson: true, hasBunLock: false })).toContain(
      "bun run dev --host 0.0.0.0 --port 5173",
    );
  });

  it("builds an explicit Next dev-server command for Run Code", () => {
    expect(getAppRunCommand({ replType: "next", hasPackageJson: true, hasBunLock: true })).toContain(
      "bun x next dev --hostname 0.0.0.0 -p 3000",
    );
  });
});
