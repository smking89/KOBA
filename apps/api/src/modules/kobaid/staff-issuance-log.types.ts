import { KobaIdRole } from './kobaid.types';

/**
 * A durable audit record of one `issueStaff()` call. Distinct from the
 * `issuedByKobaId` pointer on the issued `KobaId` itself — that pointer is
 * the minimum data needed to trace an issuance; this log is the append-only
 * audit trail ROADMAP.md's Phase 1 section calls `StaffIssuanceLog`
 * (issuer_kobaid_id, issued_kobaid_id, timestamp), extended with the
 * target role for convenience since it's already known at issuance time.
 */
export interface StaffIssuanceLogEntry {
  /** Internal storage id (uuid) for the log entry. */
  readonly id: string;
  /** KobaId#id of the staff member who performed the issuance. */
  readonly issuerKobaId: string;
  /** KobaId#id of the newly issued staff KOBAID. */
  readonly issuedKobaId: string;
  /** Role the new KOBAID was issued for (SA/AD/MD). */
  readonly targetRole: KobaIdRole;
  readonly issuedAt: Date;
}
