import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Purpose-separated AES-256-GCM sealing for staff TOTP secrets (Phase 15C).
 *
 * Deliberately uses its own master key (`KOBA_STAFF_MFA_ENCRYPTION_KEY`)
 * rather than the RCON credential key: the existing key-management design
 * does not derive purpose-scoped subkeys, so key material is separated per
 * cryptographic purpose instead. AAD binds each ciphertext to the owning
 * user so a sealed secret cannot be replayed onto another account.
 *
 * Fails closed everywhere: no key, no sealing, no plaintext fallback.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;

export class StaffMfaCryptoError extends Error {
  constructor(
    message: string,
    readonly category: "INTERNAL_CONFIGURATION" | "TAMPERED" = "INTERNAL_CONFIGURATION",
  ) {
    super(message);
    this.name = "StaffMfaCryptoError";
  }
}

export type SealedTotpSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function currentKeyVersion(): number {
  const raw = process.env.KOBA_STAFF_MFA_KEY_VERSION ?? "1";
  const version = Number.parseInt(raw, 10);
  if (!Number.isInteger(version) || version < 1) {
    throw new StaffMfaCryptoError("KOBA_STAFF_MFA_KEY_VERSION must be a positive integer.");
  }
  return version;
}

export function resolveStaffMfaKey(version = currentKeyVersion()): {
  key: Buffer;
  version: number;
} {
  const versioned = process.env[`KOBA_STAFF_MFA_ENCRYPTION_KEY_V${version}`];
  const current = process.env.KOBA_STAFF_MFA_ENCRYPTION_KEY;
  const raw = versioned && versioned.trim() ? versioned : current;
  if (!raw || !raw.trim()) {
    throw new StaffMfaCryptoError(
      "KOBA_STAFF_MFA_ENCRYPTION_KEY is required. Staff TOTP secrets are never stored unencrypted.",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    throw new StaffMfaCryptoError("KOBA_STAFF_MFA_ENCRYPTION_KEY is not valid base64.");
  }
  if (key.length !== KEY_BYTES) {
    throw new StaffMfaCryptoError(
      `KOBA_STAFF_MFA_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes.`,
    );
  }
  return { key, version };
}

export function isStaffMfaEncryptionConfigured(): boolean {
  try {
    resolveStaffMfaKey();
    return true;
  } catch {
    return false;
  }
}

function totpAad(userId: string): Buffer {
  return Buffer.from(`koba:staff-totp:v1:${userId}`, "utf8");
}

export function sealTotpSecret(plainSecret: string, userId: string): SealedTotpSecret {
  if (!plainSecret) {
    throw new StaffMfaCryptoError("Refusing to seal an empty TOTP secret.");
  }
  const { key, version } = resolveStaffMfaKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(totpAad(userId));
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: version,
  };
}

export function openTotpSecret(sealed: SealedTotpSecret, userId: string): string {
  const { key } = resolveStaffMfaKey(sealed.keyVersion);
  try {
    const iv = Buffer.from(sealed.iv, "base64");
    const authTag = Buffer.from(sealed.authTag, "base64");
    const ciphertext = Buffer.from(sealed.ciphertext, "base64");
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new StaffMfaCryptoError("Sealed TOTP secret encoding is invalid.", "TAMPERED");
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(totpAad(userId));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof StaffMfaCryptoError) throw error;
    throw new StaffMfaCryptoError("TOTP secret authentication failed.", "TAMPERED");
  }
}
