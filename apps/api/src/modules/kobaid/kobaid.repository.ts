import { KobaId, KobaIdRole } from './kobaid.types';

/**
 * Storage seam for KOBAIDs. Kept as an interface so KobaidService stays
 * decoupled from the storage engine — see kobaid/README.md for why this
 * phase ships an in-memory implementation instead of wiring Prisma/Postgres.
 */
export const KOBAID_REPOSITORY = Symbol('KOBAID_REPOSITORY');

export interface KobaIdRepository {
  findByDeviceAndRole(deviceId: string, role: KobaIdRole): Promise<KobaId | null>;
  findByCode(code: string): Promise<KobaId | null>;
  findById(id: string): Promise<KobaId | null>;
  /** All KOBAIDs (any role) registered for a device — used by switching. */
  findAllByDevice(deviceId: string): Promise<KobaId[]>;
  save(kobaId: KobaId): Promise<KobaId>;
}
