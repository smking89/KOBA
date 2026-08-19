import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchProviderBytes } from "@/features/aiden/lib/safe-fetch";
import { isEnvConfigured } from "@/features/aiden/providers/env-gate";
import { AIDEN_MAX_MESH_BYTES, AIDEN_MESH_ACCEPT } from "@/features/aiden/lib/output-validation";

const ENV_VAR = "AIDEN_BLENDER_BINARY";
const ASSEMBLE_SCRIPT = path.resolve(process.cwd(), "scripts/aiden/assemble_skin.py");
const BLENDER_TIMEOUT_MS = 120_000;

/**
 * Client, 2026-08-18 (KOBA Aiden pipeline spec): the missing assembly
 * step between "here are four separate raw files" (Tripo's textured
 * mesh + three Kandinsky PBR maps, see pbr-maps.ts) and one installable,
 * game-ready asset. Headless Blender (`blender --background --python`)
 * is the standard tool for exactly this in production art pipelines —
 * scripted UV texture application, material graph assembly, and
 * multi-format export without a human opening the GUI.
 *
 * Fails closed like every other Aiden provider in this codebase
 * (features/aiden/providers/*NotConfiguredError) rather than silently
 * skipping — callers decide whether to fall back to the mesh-only
 * result or surface the error, this module never guesses.
 *
 * Blender itself is a native system binary, not an npm package — it
 * has to be installed on the host separately (the target is a GoDaddy
 * VPS, per the client). This sandbox has no Blender binary available
 * to actually execute against, so only the parts below that don't
 * require running it (buildBlenderArgs, isBlenderConfigured, the
 * download/timeout/error-handling logic) are verified by this
 * codebase's test suite. scripts/aiden/assemble_skin.py's actual 3D
 * output has NOT been smoke-tested end to end — that needs a real run
 * once Blender is installed on the target host.
 */
export class AidenBlenderNotConfiguredError extends Error {
  constructor() {
    super(
      `Blender assembly is not configured (set ${ENV_VAR} to the blender binary's absolute path to enable).`,
    );
    this.name = "AidenBlenderNotConfiguredError";
  }
}

export class AidenBlenderAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AidenBlenderAssemblyError";
  }
}

export function isBlenderConfigured(): boolean {
  return isEnvConfigured(ENV_VAR);
}

export function blenderBinaryPath(): string {
  return (process.env[ENV_VAR] ?? "").trim();
}

/** Split out from assembleSkinAsset so the exact command shape is
 * unit-testable without spawning a real process. */
export function buildBlenderArgs(scratchDir: string): string[] {
  return ["--background", "--python", ASSEMBLE_SCRIPT, "--", "--workdir", scratchDir];
}

async function downloadTo(url: string, destPath: string): Promise<void> {
  const bytes = await fetchProviderBytes(url, {
    accept: AIDEN_MESH_ACCEPT,
    maxBytes: AIDEN_MAX_MESH_BYTES,
  });
  await writeFile(destPath, bytes);
}

function runBlender(scratchDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(blenderBinaryPath(), buildBlenderArgs(scratchDir), {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AidenBlenderAssemblyError("Blender assembly timed out."));
    }, BLENDER_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new AidenBlenderAssemblyError(`Could not start Blender: ${error.message}`));
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new AidenBlenderAssemblyError(
            `Blender exited with code ${code ?? "unknown"}: ${stderr.slice(0, 2000)}`,
          ),
        );
      }
    });
  });
}

/**
 * Combines a Tripo mesh (already textured with a baked diffuse) with
 * three Kandinsky-generated PBR maps into one exported .glb with a
 * real PBR material graph. Throws AidenBlenderNotConfiguredError if
 * this host has no Blender binary configured — callers should catch
 * that specifically and fall back to the mesh-only result rather than
 * failing the whole generation over a missing optional enhancement.
 */
export async function assembleSkinAsset(input: {
  meshUrl: string;
  normalMapUrl: string;
  specularMapUrl: string;
  emissionMapUrl: string;
}): Promise<{ bytes: Buffer; mime: string }> {
  if (!isBlenderConfigured()) {
    throw new AidenBlenderNotConfiguredError();
  }

  const scratchDir = await mkdtemp(path.join(tmpdir(), "aiden-blender-"));
  try {
    await Promise.all([
      downloadTo(input.meshUrl, path.join(scratchDir, "mesh.glb")),
      downloadTo(input.normalMapUrl, path.join(scratchDir, "normal.png")),
      downloadTo(input.specularMapUrl, path.join(scratchDir, "specular.png")),
      downloadTo(input.emissionMapUrl, path.join(scratchDir, "emission.png")),
    ]);

    await runBlender(scratchDir);

    const outputPath = path.join(scratchDir, "output.glb");
    const bytes = await readFile(outputPath);
    return { bytes, mime: "model/gltf-binary" };
  } finally {
    await rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}
