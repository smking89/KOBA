import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { TdlsTokenExpiredError, TdlsTokenInvalidError } from './tdls.errors';
import { EphemeralKey, TdlsToken } from './tdls.types';

/** AES-256-GCM: 32-byte key, 96-bit (12-byte) IV, 16-byte auth tag. */
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';

/** Default ephemeral-key lifetime, per the client's "short-lived" spec. */
export const DEFAULT_EPHEMERAL_KEY_TTL_MS = 60_000;

/** DI token for overriding the ephemeral-key TTL; falls back to the default. */
export const TDLS_EPHEMERAL_KEY_TTL_MS = Symbol('TDLS_EPHEMERAL_KEY_TTL_MS');

/**
 * TDLS ("Trusted Data Link Security") — envelope encryption for handing a
 * payload between two sandboxed functions/services that share a pre-issued
 * master key. Each call generates a fresh, single-use ephemeral AES-256-GCM
 * key (never cached or reused), wraps it under the caller-supplied master
 * key, and encrypts the payload under the ephemeral key. See
 * common/tdls/README.md for the full workflow this implements.
 */
@Injectable()
export class TdlsService {
  private readonly ephemeralKeyTtlMs: number;

  constructor(
    @Optional()
    @Inject(TDLS_EPHEMERAL_KEY_TTL_MS)
    ephemeralKeyTtlMs?: number,
  ) {
    this.ephemeralKeyTtlMs = ephemeralKeyTtlMs ?? DEFAULT_EPHEMERAL_KEY_TTL_MS;
  }

  /**
   * Generates a fresh, short-lived AES-256-GCM ephemeral key. Never cached
   * or shared across calls — each issueToken() call gets its own.
   */
  generateEphemeralKey(): EphemeralKey {
    return {
      keyId: randomUUID(),
      key: randomBytes(KEY_LENGTH_BYTES),
      expiresAt: new Date(Date.now() + this.ephemeralKeyTtlMs),
    };
  }

  /**
   * Function A's side: generates a fresh ephemeral key, wraps it under
   * `masterKey` (the pre-shared trust relationship with `peerId`), and
   * encrypts `payload` under the ephemeral key. Returns a single opaque
   * token bundling everything Function B needs to unwrap and decrypt.
   */
  issueToken<T>(payload: T, peerId: string, masterKey: Buffer): TdlsToken {
    const ephemeralKey = this.generateEphemeralKey();

    const wrapIv = randomBytes(IV_LENGTH_BYTES);
    const wrapCipher = createCipheriv(ALGORITHM, masterKey, wrapIv);
    const wrappedKey = Buffer.concat([wrapCipher.update(ephemeralKey.key), wrapCipher.final()]);
    const wrapAuthTag = wrapCipher.getAuthTag();

    const payloadIv = randomBytes(IV_LENGTH_BYTES);
    const payloadCipher = createCipheriv(ALGORITHM, ephemeralKey.key, payloadIv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const ciphertext = Buffer.concat([payloadCipher.update(plaintext), payloadCipher.final()]);
    const payloadAuthTag = payloadCipher.getAuthTag();

    return {
      keyId: ephemeralKey.keyId,
      peerId,
      expiresAt: ephemeralKey.expiresAt.toISOString(),
      wrappedKey: wrappedKey.toString('base64'),
      wrapIv: wrapIv.toString('base64'),
      wrapAuthTag: wrapAuthTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      payloadIv: payloadIv.toString('base64'),
      payloadAuthTag: payloadAuthTag.toString('base64'),
    };
  }

  /**
   * Function B's side: unwraps the ephemeral key with `masterKey`, checks
   * expiry, then decrypts and authenticates the payload. Throws
   * `TdlsTokenExpiredError` if `token.expiresAt` has passed, or
   * `TdlsTokenInvalidError` if either AES-GCM auth tag fails to verify
   * (tampered ciphertext, or the wrong master key).
   */
  validateAndExtract<T>(token: TdlsToken, masterKey: Buffer): T {
    const expiresAt = new Date(token.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      throw new TdlsTokenExpiredError(token.keyId, expiresAt);
    }

    let ephemeralKey: Buffer;
    try {
      const wrapDecipher = createDecipheriv(
        ALGORITHM,
        masterKey,
        Buffer.from(token.wrapIv, 'base64'),
      );
      wrapDecipher.setAuthTag(Buffer.from(token.wrapAuthTag, 'base64'));
      ephemeralKey = Buffer.concat([
        wrapDecipher.update(Buffer.from(token.wrappedKey, 'base64')),
        wrapDecipher.final(),
      ]);
    } catch {
      throw new TdlsTokenInvalidError('ephemeral key could not be unwrapped');
    }

    let plaintext: Buffer;
    try {
      const payloadDecipher = createDecipheriv(
        ALGORITHM,
        ephemeralKey,
        Buffer.from(token.payloadIv, 'base64'),
      );
      payloadDecipher.setAuthTag(Buffer.from(token.payloadAuthTag, 'base64'));
      plaintext = Buffer.concat([
        payloadDecipher.update(Buffer.from(token.ciphertext, 'base64')),
        payloadDecipher.final(),
      ]);
    } catch {
      throw new TdlsTokenInvalidError('payload could not be decrypted/authenticated');
    }

    return JSON.parse(plaintext.toString('utf8')) as T;
  }
}
