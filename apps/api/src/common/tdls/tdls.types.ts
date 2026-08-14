/**
 * A fresh, transient AES-256-GCM key generated per issueToken() call.
 * Never cached or reused — single-purpose per call, per the ephemeral-key
 * architecture the client specified.
 */
export interface EphemeralKey {
  readonly keyId: string;
  readonly key: Buffer;
  readonly expiresAt: Date;
}

/**
 * The opaque token handed from Function A to Function B. Bundles everything
 * Function B needs to unwrap the ephemeral key (with the shared master key)
 * and then decrypt/authenticate the payload — nothing else is required.
 */
export interface TdlsToken {
  readonly keyId: string;
  readonly peerId: string;
  readonly expiresAt: string;
  /** Ephemeral key, AES-256-GCM-encrypted under the pre-shared master key. */
  readonly wrappedKey: string;
  readonly wrapIv: string;
  readonly wrapAuthTag: string;
  /** Payload, AES-256-GCM-encrypted under the ephemeral key. */
  readonly ciphertext: string;
  readonly payloadIv: string;
  readonly payloadAuthTag: string;
}
