/** Base class for all typed TDLS domain errors. */
export abstract class TdlsDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown by validateAndExtract() when a token's expiresAt has already passed. */
export class TdlsTokenExpiredError extends TdlsDomainError {
  constructor(keyId: string, expiresAt: Date) {
    super(`TDLS token "${keyId}" expired at ${expiresAt.toISOString()}`);
  }
}

/**
 * Thrown by validateAndExtract() when the token cannot be trusted: the
 * wrapped ephemeral key or payload auth tag fails to verify. Covers both
 * tampered ciphertext and an incorrect master key — AES-GCM authentication
 * failures don't distinguish between the two, so neither does this error.
 */
export class TdlsTokenInvalidError extends TdlsDomainError {
  constructor(reason: string) {
    super(`TDLS token failed authentication: ${reason}`);
  }
}
