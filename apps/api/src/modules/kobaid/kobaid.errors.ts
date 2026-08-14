/** Base class for all typed KOBAID domain errors. */
export abstract class KobaIdDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidKobaIdFormatError extends KobaIdDomainError {
  constructor(value: string) {
    super(`"${value}" is not a valid KOBAID (expected format KOBA-ROLE-CODE)`);
  }
}

/** Thrown when a device already holds a KOBAID for the requested role. */
export class DuplicateKobaIdForDeviceRoleError extends KobaIdDomainError {
  constructor(deviceId: string, role: string) {
    super(`Device "${deviceId}" already has a KOBAID for role "${role}"`);
  }
}

/** Thrown when the public/self-registration mint path is used for a staff role. */
export class StaffRoleRequiresAdminIssuanceError extends KobaIdDomainError {
  constructor(role: string) {
    super(
      `Role "${role}" is a staff role and cannot be self-registered; use the admin-issuance path`,
    );
  }
}

/** Thrown when a community role is passed to the admin-issuance path. */
export class CommunityRoleCannotBeStaffIssuedError extends KobaIdDomainError {
  constructor(role: string) {
    super(
      `Role "${role}" is a community role and must be self-registered via mint(), not staff-issued`,
    );
  }
}

/** Thrown when the issuer supplied to the admin-issuance path is not a known staff KOBAID. */
export class InvalidIssuerError extends KobaIdDomainError {
  constructor(issuedByKobaId: string) {
    super(`Issuer KOBAID "${issuedByKobaId}" does not exist or is not a staff KOBAID`);
  }
}

/**
 * Thrown when switching (activateForDevice) targets a role the device has
 * no KOBAID for. Switching only activates an existing KOBAID — it never
 * mints one, so this is a hard failure, not an implicit mint.
 */
export class KobaIdNotFoundForDeviceRoleError extends KobaIdDomainError {
  constructor(deviceId: string, role: string) {
    super(`Device "${deviceId}" has no KOBAID for role "${role}" to switch to`);
  }
}

/** Thrown when random CODE generation collides on every retry attempt. */
export class KobaIdCollisionRetryExhaustedError extends KobaIdDomainError {
  constructor(attempts: number) {
    super(`Failed to generate a unique KOBAID code after ${attempts} attempts`);
  }
}
