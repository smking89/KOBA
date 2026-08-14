import { StaffIssuanceLogEntry } from './staff-issuance-log.types';

/**
 * Storage seam for the staff-issuance audit log. Same pattern as
 * KobaIdRepository — interface here, in-memory implementation wired up
 * this phase, Prisma implementation deferred (see kobaid/README.md).
 */
export const STAFF_ISSUANCE_LOG_REPOSITORY = Symbol('STAFF_ISSUANCE_LOG_REPOSITORY');

export interface StaffIssuanceLogRepository {
  record(entry: StaffIssuanceLogEntry): Promise<StaffIssuanceLogEntry>;
  findAll(): Promise<StaffIssuanceLogEntry[]>;
  findByIssuer(issuerKobaId: string): Promise<StaffIssuanceLogEntry[]>;
}
