import { Injectable } from '@nestjs/common';
import { StaffIssuanceLogRepository } from './staff-issuance-log.repository';
import { StaffIssuanceLogEntry } from './staff-issuance-log.types';

@Injectable()
export class InMemoryStaffIssuanceLogRepository implements StaffIssuanceLogRepository {
  private readonly entries: StaffIssuanceLogEntry[] = [];

  async record(entry: StaffIssuanceLogEntry): Promise<StaffIssuanceLogEntry> {
    this.entries.push(entry);
    return entry;
  }

  async findAll(): Promise<StaffIssuanceLogEntry[]> {
    return [...this.entries];
  }

  async findByIssuer(issuerKobaId: string): Promise<StaffIssuanceLogEntry[]> {
    return this.entries.filter((entry) => entry.issuerKobaId === issuerKobaId);
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.entries.length = 0;
  }
}
