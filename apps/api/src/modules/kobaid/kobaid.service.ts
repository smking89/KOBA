import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { TdlsService } from '../../common/tdls/tdls.service';
import { TdlsToken } from '../../common/tdls/tdls.types';
import { buildFullId, generateCode } from './kobaid-format';
import {
  CommunityRoleCannotBeStaffIssuedError,
  DuplicateKobaIdForDeviceRoleError,
  InvalidIssuerError,
  KobaIdCollisionRetryExhaustedError,
  KobaIdNotFoundForDeviceRoleError,
  StaffRoleRequiresAdminIssuanceError,
} from './kobaid.errors';
import { KOBAID_REPOSITORY, KobaIdRepository } from './kobaid.repository';
import {
  IssueStaffKobaIdParams,
  isCommunityRole,
  isStaffRole,
  KobaId,
  KobaIdRole,
  MintKobaIdParams,
} from './kobaid.types';
import {
  STAFF_ISSUANCE_LOG_REPOSITORY,
  StaffIssuanceLogRepository,
} from './staff-issuance-log.repository';
import { StaffIssuanceLogEntry } from './staff-issuance-log.types';

/** Bounded retry budget for CODE collisions before giving up loudly. */
const MAX_CODE_GENERATION_ATTEMPTS = 8;

/**
 * The subset of a KobaId that's ever transmitted between sandboxed
 * functions/services via TDLS — public/transmissible fields only, never
 * the internal storage id.
 */
export interface KobaIdTransportPayload {
  fullId: string;
  role: KobaIdRole;
  mintedAt: string;
}

@Injectable()
export class KobaidService {
  constructor(
    @Inject(KOBAID_REPOSITORY) private readonly repository: KobaIdRepository,
    @Inject(STAFF_ISSUANCE_LOG_REPOSITORY)
    private readonly staffIssuanceLogRepository: StaffIssuanceLogRepository,
    private readonly tdlsService: TdlsService,
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

    const issued = await this.createKobaId({
      role: params.role,
      deviceId: params.deviceId,
      userId: params.userId,
      referralCode: null,
      issuedByKobaId: params.issuedByKobaId,
    });

    // Only recorded once issuance has actually succeeded (createKobaId
    // above threw already on any failure, e.g. duplicate device+role or
    // exhausted code collisions) — the log must never contain an entry
    // for an issuance that didn't happen.
    const logEntry: StaffIssuanceLogEntry = {
      id: randomUUID(),
      issuerKobaId: params.issuedByKobaId,
      issuedKobaId: issued.id,
      targetRole: issued.role,
      issuedAt: new Date(),
    };
    await this.staffIssuanceLogRepository.record(logEntry);

    return issued;
  }

  /** All staff-issuance audit log entries, most-recent-last. */
  async getStaffIssuanceLog(): Promise<StaffIssuanceLogEntry[]> {
    return this.staffIssuanceLogRepository.findAll();
  }

  /** Staff-issuance audit log entries created by a specific issuer KOBAID. */
  async getStaffIssuanceLogByIssuer(issuerKobaId: string): Promise<StaffIssuanceLogEntry[]> {
    return this.staffIssuanceLogRepository.findByIssuer(issuerKobaId);
  }

  async findByDeviceAndRole(deviceId: string, role: KobaId['role']): Promise<KobaId | null> {
    return this.repository.findByDeviceAndRole(deviceId, role);
  }

  async findByCode(code: string): Promise<KobaId | null> {
    return this.repository.findByCode(code);
  }

  /**
   * Marks the device's existing KOBAID for `role` as active, and any other
   * active KOBAID on the same device as inactive. Does NOT mint a KOBAID —
   * the device must already hold one for `role`, or this throws
   * `KobaIdNotFoundForDeviceRoleError`. Never mutates role/code/fullId/
   * mintedAt on the KOBAIDs it touches — only the `active` flag changes,
   * per KobaId's immutability contract (see kobaid.types.ts).
   */
  async activateForDevice(deviceId: string, role: KobaIdRole): Promise<KobaId> {
    const target = await this.repository.findByDeviceAndRole(deviceId, role);
    if (!target) {
      throw new KobaIdNotFoundForDeviceRoleError(deviceId, role);
    }

    const deviceKobaIds = await this.repository.findAllByDevice(deviceId);
    for (const kobaId of deviceKobaIds) {
      if (kobaId.id !== target.id && kobaId.active) {
        await this.repository.save({ ...kobaId, active: false });
      }
    }

    if (target.active) {
      return target;
    }

    return this.repository.save({ ...target, active: true });
  }

  /**
   * Wraps an already-minted KOBAID's transmissible fields (fullId, role,
   * mintedAt — never the internal storage id) into a TDLS token for
   * sending to another sandboxed function/service over the transport
   * boundary. See common/tdls/README.md for the underlying envelope-
   * encryption scheme. `masterKey` is the pre-shared trust relationship
   * with `peerId`; this method does not provision or distribute it.
   */
  exportForTransport(kobaId: KobaId, peerId: string, masterKey: Buffer): TdlsToken {
    const payload: KobaIdTransportPayload = {
      fullId: kobaId.fullId,
      role: kobaId.role,
      mintedAt: kobaId.mintedAt.toISOString(),
    };
    return this.tdlsService.issueToken(payload, peerId, masterKey);
  }

  /**
   * Validates and decrypts a TDLS token produced by exportForTransport(),
   * returning the KOBAID's public fields. Purely a transport operation —
   * it does not re-mint or look up anything in the repository, and is
   * distinct from mint()/issueStaff()/activateForDevice().
   */
  importFromTransport(token: TdlsToken, masterKey: Buffer): KobaIdTransportPayload {
    return this.tdlsService.validateAndExtract<KobaIdTransportPayload>(token, masterKey);
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
      // Not active at mint/issuance time — a device must explicitly switch
      // to a role to make it active (see activateForDevice()).
      active: false,
    };

    // TDLS (see common/tdls/) covers the transport/transmission boundary
    // between sandboxed functions/services — exportForTransport()/
    // importFromTransport() below wrap an already-minted KOBAID's public
    // fields for that. This save() is the storage boundary, which is a
    // separate, still-open concern (at-rest encryption) — the KOBAID is
    // persisted as a plain validated string/struct here.
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
