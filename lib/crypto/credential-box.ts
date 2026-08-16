import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;

export class CredentialCryptoError extends Error {
  constructor(
    message: string,
    readonly category: "INTERNAL_CONFIGURATION" | "TAMPERED" = "INTERNAL_CONFIGURATION",
  ) {
    super(message);
    this.name = "CredentialCryptoError";
  }
}

export type SealedCredential = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function parseKeyMaterial(raw: string, label: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CredentialCryptoError(`${label} is empty.`);
  }
  let key: Buffer;
  try {
    key = Buffer.from(trimmed, "base64");
  } catch {
    throw new CredentialCryptoError(`${label} is not valid base64.`);
  }
  if (key.length !== KEY_BYTES) {
    throw new CredentialCryptoError(`${label} must decode to ${KEY_BYTES} bytes.`);
  }
  return key;
}

function currentKeyVersion(): number {
  const raw = process.env.KOBA_CREDENTIAL_KEY_VERSION ?? "1";
  const version = Number.parseInt(raw, 10);
  if (!Number.isInteger(version) || version < 1) {
    throw new CredentialCryptoError("KOBA_CREDENTIAL_KEY_VERSION must be a positive integer.");
  }
  return version;
}

/**
 * Resolve a versioned AES-256 key. Production and all other environments fail
 * closed when the master key is missing. Never falls back to plaintext.
 */
export function resolveCredentialKey(version = currentKeyVersion()): {
  key: Buffer;
  version: number;
} {
  const versioned = process.env[`KOBA_CREDENTIAL_ENCRYPTION_KEY_V${version}`];
  const current = process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY;
  const raw = versioned && versioned.trim() ? versioned : current;
  if (!raw || !raw.trim()) {
    throw new CredentialCryptoError(
      "KOBA_CREDENTIAL_ENCRYPTION_KEY is required. Never store credentials unencrypted.",
    );
  }
  return { key: parseKeyMaterial(raw, `credential key v${version}`), version };
}

export function isCredentialEncryptionConfigured(): boolean {
  try {
    resolveCredentialKey();
    return true;
  } catch {
    return false;
  }
}

export function assertCredentialEncryptionReady(): void {
  resolveCredentialKey();
}

/** Bind ciphertext to a server/integration so it cannot be replayed onto another row. */
export function credentialAad(serverId: string, integrationId: string): Buffer {
  return Buffer.from(`koba:rcon-credential:v1:${serverId}:${integrationId}`, "utf8");
}

export function sealCredential(
  plaintext: string,
  aad: Buffer,
  opts?: { version?: number },
): SealedCredential {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new CredentialCryptoError("Refusing to seal an empty credential.");
  }
  const { key, version } = resolveCredentialKey(opts?.version);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new CredentialCryptoError("AES-GCM auth tag length is invalid.");
  }
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: version,
  };
}

export function openCredential(sealed: SealedCredential, aad: Buffer): string {
  const { key } = resolveCredentialKey(sealed.keyVersion);
  try {
    const iv = Buffer.from(sealed.iv, "base64");
    const authTag = Buffer.from(sealed.authTag, "base64");
    const ciphertext = Buffer.from(sealed.ciphertext, "base64");
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new CredentialCryptoError("Sealed credential encoding is invalid.", "TAMPERED");
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof CredentialCryptoError) throw error;
    throw new CredentialCryptoError("Credential authentication failed.", "TAMPERED");
  }
}

/** Compare two IVs in constant time. Used to assert unique nonces in tests. */
export function ivsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "base64");
  const b = Buffer.from(right, "base64");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
