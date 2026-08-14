import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { buildFullId, generateCode } from './kobaid-format';
import {
  CommunityRoleCannotBeStaffIssuedError,
  DuplicateKobaIdForDeviceRoleError,
  InvalidIssuerError,
  KobaIdCollisionRetryExhaustedError,
  StaffRoleRequiresAdminIssuanceError,
} from './kobaid.errors';
import { KOBAID_REPOSITORY, KobaIdRepository } from './kobaid.repository';
import {
  IssueStaffKobaIdParams,
  isCommunityRole,
  isStaffRole,
  KobaId,
  MintKobaIdParams,
} from './kobaid.types';

/** Bounded retry budget for CODE collisions before giving up loudly. */
const MAX_CODE_GENERATION_ATTEMPTS = 8;

@Injectable()
export class KobaidService {
  constructor(
    @Inject(KOBAID_REPOSITORY) private readonly repository: KobaIdRepository,
  ) {}

  /**
   * Public self-registration path for community roles (PL/BZ/IN) only.
   * Staff roles must go through issueStaff().
   */
  async mint(params: MintKobaIdParams): Promise<KobaId> {
    if (!isCommunityRole(params.role)) {
      throw new StaffRoleRequiresAdminIssuanceError(params.role);
    }
    return this.createKobaId({
      role: params.role,
      deviceId: params.deviceId,
      userId: params.userId,
      referralCode: params.referralCode ?? null,
      issuedByKobaId: null,
    });
  }

  /**
   * Admin-issuance path for staff roles (SA/AD/MD). Never exposed over
   * HTTP this phase — Phase 13 decides whether/how it becomes a route,
   * gated by Phase 11's RBAC.
   */
  async issueStaff(params: IssueStaffKobaIdParams): Promise<KobaId> {
    if (!isStaffRole(params.role)) {
      throw new CommunityRoleCannotBeStaffIssuedError(params.role);
    }

    const issuer = await this.repository.findById(params.issuedByKobaId);
    if (!issuer || !isStaffRole(issuer.role)) {
      throw new InvalidIssuerError(params.issuedByKobaId);
    }

    return this.createKobaId({
      role: params.role,
      deviceId: params.deviceId,
      userId: params.userId,
      referralCode: null,
      issuedByKobaId: params.issuedByKobaId,
    });
  }

  async findByDeviceAndRole(deviceId: string, role: KobaId['role']): Promise<KobaId | null> {
    return this.repository.findByDeviceAndRole(deviceId, role);
  }

  async findByCode(code: string): Promise<KobaId | null> {
    return this.repository.findByCode(code);
  }

  private async createKobaId(input: {
    role: KobaId['role'];
    deviceId: string;
    userId: string;
    referralCode: string | null;
    issuedByKobaId: string | null;
  }): Promise<KobaId> {
    const existing = await this.repository.findByDeviceAndRole(input.deviceId, input.role);
    if (existing) {
      throw new DuplicateKobaIdForDeviceRoleError(input.deviceId, input.role);
    }

    const code = await this.generateUniqueCode();

    const kobaId: KobaId = {
      id: randomUUID(),
      role: input.role,
      code,
      fullId: buildFullId(input.role, code),
      deviceId: input.deviceId,
      userId: input.userId,
      referralCode: input.referralCode,
      // TODO(cosmetics/Phase 3): cosmetic ownership refs start empty and are
      // populated once the marketplace/cosmetics module exists to grant them.
      cosmeticOwnershipRefs: [],
      issuedByKobaId: input.issuedByKobaId,
      mintedAt: new Date(),
    };

    // TODO(TDLS): the client's Phase 0 prototype and ROADMAP.md's open
    // questions reference "TDLS encryption" for the KOBAID payload at rest
    // and in transit, but no algorithm/spec is defined anywhere in the repo.
    // This is the storage boundary where TDLS would be applied once it's
    // specified — for now the KOBAID is persisted as a plain validated
    // string/struct. Do not invent a scheme here; wire it up once the
    // client answers what TDLS means.
    return this.repository.save(kobaId);
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const candidate = generateCode();
      const existing = await this.repository.findByCode(candidate);
      if (!existing) {
        return candidate;
      }
    }
    throw new KobaIdCollisionRetryExhaustedError(MAX_CODE_GENERATION_ATTEMPTS);
  }
}
