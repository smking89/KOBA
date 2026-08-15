import { AidenOsError } from "@/features/aiden/os/shared/types";

/**
 * What "Sandbox" means in this pass: a real, working execution boundary —
 * timeout enforcement + error normalization — NOT process/container/VM
 * isolation. True OS-level isolation (Docker, a VM, a separate worker
 * process per execution) is a real infra decision with real cost, and
 * nothing in this codebase runs untrusted third-party code today (every
 * Sandbox call here wraps our own adapter code calling a vendor's HTTP
 * API, not arbitrary user-submitted code) — so it isn't scoped into this
 * pass. Revisit if/when Aiden ever executes user-submitted code directly
 * (e.g. a custom workflow script), which would need real process isolation.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

export async function runInSandbox<T>(
  fn: () => Promise<T>,
  opts: { timeoutMs?: number; label: string } = { label: "sandbox" },
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AidenOsError(`${opts.label} timed out after ${timeoutMs}ms.`, "TIMEOUT"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeout]);
  } catch (error) {
    if (error instanceof AidenOsError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown execution failure.";
    throw new AidenOsError(`${opts.label} failed: ${message}`, "EXECUTION_FAILED");
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
