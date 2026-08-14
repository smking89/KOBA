import { randomBytes } from 'crypto';
import { TdlsTokenExpiredError, TdlsTokenInvalidError } from './tdls.errors';
import { TdlsService } from './tdls.service';
import { TdlsToken } from './tdls.types';

describe('TdlsService', () => {
  let service: TdlsService;
  let masterKey: Buffer;

  beforeEach(() => {
    service = new TdlsService();
    masterKey = randomBytes(32);
  });

  describe('generateEphemeralKey', () => {
    it('produces a random 32-byte AES-256 key with a keyId and TTL-based expiry', () => {
      const before = Date.now();
      const ephemeralKey = service.generateEphemeralKey();
      const after = Date.now();

      expect(ephemeralKey.key).toHaveLength(32);
      expect(ephemeralKey.keyId).toBeTruthy();
      expect(ephemeralKey.expiresAt.getTime()).toBeGreaterThan(before);
      expect(ephemeralKey.expiresAt.getTime()).toBeLessThanOrEqual(after + 60_000);
    });

    it('generates unique keys and keyIds across calls', () => {
      const a = service.generateEphemeralKey();
      const b = service.generateEphemeralKey();

      expect(a.keyId).not.toBe(b.keyId);
      expect(a.key.equals(b.key)).toBe(false);
    });
  });

  describe('issueToken / validateAndExtract round-trip', () => {
    it('returns the original payload unchanged when using the same master key', () => {
      const payload = { fullId: 'KOBA-PL-7F3K', role: 'PL', mintedAt: '2026-08-13T00:00:00.000Z' };

      const token = service.issueToken(payload, 'peer-service-b', masterKey);
      const extracted = service.validateAndExtract<typeof payload>(token, masterKey);

      expect(extracted).toEqual(payload);
    });

    it('does not reuse ephemeral keys/keyIds across issueToken calls for the same peer', () => {
      const tokenA = service.issueToken({ n: 1 }, 'peer-1', masterKey);
      const tokenB = service.issueToken({ n: 2 }, 'peer-1', masterKey);

      expect(tokenA.keyId).not.toBe(tokenB.keyId);
      expect(tokenA.wrappedKey).not.toBe(tokenB.wrappedKey);
    });
  });

  describe('tamper detection', () => {
    it('throws TdlsTokenInvalidError when the ciphertext is mutated', () => {
      const token = service.issueToken({ n: 1 }, 'peer-1', masterKey);
      const tampered: TdlsToken = {
        ...token,
        ciphertext: Buffer.from('tampered-ciphertext-bytes').toString('base64'),
      };

      expect(() => service.validateAndExtract(tampered, masterKey)).toThrow(
        TdlsTokenInvalidError,
      );
    });

    it('throws TdlsTokenInvalidError when the payload auth tag is mutated', () => {
      const token = service.issueToken({ n: 1 }, 'peer-1', masterKey);
      const flippedTag = Buffer.from(token.payloadAuthTag, 'base64');
      flippedTag[0] ^= 0xff;
      const tampered: TdlsToken = { ...token, payloadAuthTag: flippedTag.toString('base64') };

      expect(() => service.validateAndExtract(tampered, masterKey)).toThrow(
        TdlsTokenInvalidError,
      );
    });
  });

  describe('wrong master key', () => {
    it('throws TdlsTokenInvalidError when validating with a different master key', () => {
      const token = service.issueToken({ n: 1 }, 'peer-1', masterKey);
      const wrongKey = randomBytes(32);

      expect(() => service.validateAndExtract(token, wrongKey)).toThrow(TdlsTokenInvalidError);
    });
  });

  describe('expiry', () => {
    it('throws TdlsTokenExpiredError for a token past its expiresAt, even with the right master key', () => {
      const shortLivedService = new TdlsService(-1);
      const token = shortLivedService.issueToken({ n: 1 }, 'peer-1', masterKey);

      expect(() => shortLivedService.validateAndExtract(token, masterKey)).toThrow(
        TdlsTokenExpiredError,
      );
    });
  });
});
