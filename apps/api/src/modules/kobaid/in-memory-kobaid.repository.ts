import { Injectable } from '@nestjs/common';
import { KobaIdRepository } from './kobaid.repository';
import { KobaId, KobaIdRole } from './kobaid.types';

@Injectable()
export class InMemoryKobaIdRepository implements KobaIdRepository {
  private readonly byId = new Map<string, KobaId>();
  private readonly byCode = new Map<string, KobaId>();
  private readonly byDeviceRole = new Map<string, KobaId>();

  private deviceRoleKey(deviceId: string, role: KobaIdRole): string {
    return `${deviceId}::${role}`;
  }

  async findByDeviceAndRole(deviceId: string, role: KobaIdRole): Promise<KobaId | null> {
    return this.byDeviceRole.get(this.deviceRoleKey(deviceId, role)) ?? null;
  }

  async findByCode(code: string): Promise<KobaId | null> {
    return this.byCode.get(code) ?? null;
  }

  async findById(id: string): Promise<KobaId | null> {
    return this.byId.get(id) ?? null;
  }

  async findAllByDevice(deviceId: string): Promise<KobaId[]> {
    return [...this.byId.values()].filter((kobaId) => kobaId.deviceId === deviceId);
  }

  async save(kobaId: KobaId): Promise<KobaId> {
    this.byId.set(kobaId.id, kobaId);
    this.byCode.set(kobaId.code, kobaId);
    this.byDeviceRole.set(this.deviceRoleKey(kobaId.deviceId, kobaId.role), kobaId);
    return kobaId;
  }

  async getCosmeticOwnerships(kobaId: string): Promise<readonly string[]> {
    return this.byId.get(kobaId)?.cosmeticOwnershipRefs ?? [];
  }

  /** Test/dev helper — not part of the repository interface. */
  clear(): void {
    this.byId.clear();
    this.byCode.clear();
    this.byDeviceRole.clear();
  }
}
