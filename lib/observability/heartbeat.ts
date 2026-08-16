export type WorkerHeartbeat = {
  worker: string;
  at: number;
  loop: boolean;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastDurationMs: number | null;
  oldestJobAgeMs: number | null;
  queueDepth: number | null;
};

const heartbeats = new Map<string, WorkerHeartbeat>();

export function recordWorkerHeartbeat(
  update: Partial<WorkerHeartbeat> & { worker: string },
): WorkerHeartbeat {
  const previous = heartbeats.get(update.worker);
  const next: WorkerHeartbeat = {
    worker: update.worker,
    at: update.at ?? Date.now(),
    loop: update.loop ?? previous?.loop ?? false,
    lastSuccessAt: update.lastSuccessAt ?? previous?.lastSuccessAt ?? null,
    lastFailureAt: update.lastFailureAt ?? previous?.lastFailureAt ?? null,
    lastDurationMs: update.lastDurationMs ?? previous?.lastDurationMs ?? null,
    oldestJobAgeMs: update.oldestJobAgeMs ?? previous?.oldestJobAgeMs ?? null,
    queueDepth: update.queueDepth ?? previous?.queueDepth ?? null,
  };
  heartbeats.set(update.worker, next);
  return next;
}

export function getWorkerHeartbeat(worker: string): WorkerHeartbeat | undefined {
  return heartbeats.get(worker);
}

export function listWorkerHeartbeats(): WorkerHeartbeat[] {
  return [...heartbeats.values()];
}

export function isWorkerStale(worker: string, maxAgeMs: number, now = Date.now()): boolean {
  const beat = heartbeats.get(worker);
  if (!beat) return true;
  return now - beat.at > maxAgeMs;
}

export function resetWorkerHeartbeatsForTests(): void {
  heartbeats.clear();
}
