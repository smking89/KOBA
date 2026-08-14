export abstract class AccountsDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when capability resolution is requested for a staff role. */
export class CapabilitiesNotDefinedForStaffRoleError extends AccountsDomainError {
  constructor(role: string) {
    super(
      `Capability flags for staff role "${role}" are not defined in Phase 1 — ` +
        'staff permissions are governed by Phase 11 (Role System / RBAC)',
    );
  }
}

/** Thrown when an account has fewer than the minimum required interest tags. */
export class InsufficientInterestsError extends AccountsDomainError {
  constructor(count: number, minimum: number) {
    super(`At least ${minimum} interests are required to complete onboarding, got ${count}`);
  }
}

/** Thrown when tagging-permission resolution is requested for a staff role. */
export class TaggingPermissionsNotDefinedForStaffRoleError extends AccountsDomainError {
  constructor(role: string) {
    super(
      `Tagging permissions for staff role "${role}" are not defined — the Player/Business/` +
        'Influencer tagging-permission model (ROADMAP.md Phase 2/6) does not apply to staff roles',
    );
  }
}
