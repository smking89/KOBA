import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { resolveAuthSecret } from "@/lib/auth/secret";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SCRYPT_SALT = "koba-secret-box-v1";

export type SealedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function deriveKey(secret: string): Buffer {
  try {
    return scryptSync(secret, SCRYPT_SALT, KEY_BYTES);
  } catch {
    return createHash("sha256").update(secret).digest().subarray(0, KEY_BYTES);
  }
}

function encryptionKey(): Buffer {
  return deriveKey(resolveAuthSecret());
}

/** Seal plaintext with AES-256-GCM. Never log plaintext. */
export function sealSecret(plaintext: string): SealedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/** Open a sealed secret. Never log plaintext. */
export function openSecret(sealed: SealedSecret): string {
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
