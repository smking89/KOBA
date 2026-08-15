import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CredentialCryptoError,
  ivsEqual,
  openCredential,
  resolveCredentialKey,
  sealCredential,
  credentialAad,
} from "@/lib/crypto/credential-box";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");

describe("credential-box", () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY = KEY_V1;
    process.env.KOBA_CREDENTIAL_KEY_VERSION = "1";
    delete process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY_V1;
    delete process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY_V2;
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it("round-trips a secret with unique nonces", () => {
    const aad = credentialAad("srv_1", "int_1");
    const first = sealCredential("hunter2", aad);
    const second = sealCredential("hunter2", aad);
    expect(openCredential(first, aad)).toBe("hunter2");
    expect(openCredential(second, aad)).toBe("hunter2");
    expect(ivsEqual(first.iv, second.iv)).toBe(false);
    expect(first.keyVersion).toBe(1);
  });

  it("rejects tampered ciphertext and wrong AAD", () => {
    const aad = credentialAad("srv_1", "int_1");
    const sealed = sealCredential("hunter2", aad);
    expect(() =>
      openCredential({ ...sealed, ciphertext: Buffer.from("nope").toString("base64") }, aad),
    ).toThrow(CredentialCryptoError);
    expect(() => openCredential(sealed, credentialAad("srv_2", "int_1"))).toThrow(
      CredentialCryptoError,
    );
  });

  it("fails closed when the production key is missing", () => {
    delete process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY;
    expect(() => resolveCredentialKey()).toThrow(/required/);
    expect(() => sealCredential("x", credentialAad("a", "b"))).toThrow(CredentialCryptoError);
  });

  it("opens a previous key version after rotation", () => {
    const aad = credentialAad("srv_1", "int_1");
    const sealed = sealCredential("legacy", aad);
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY = KEY_V2;
    process.env.KOBA_CREDENTIAL_KEY_VERSION = "2";
    process.env.KOBA_CREDENTIAL_ENCRYPTION_KEY_V1 = KEY_V1;
    expect(openCredential(sealed, aad)).toBe("legacy");
    const rotated = sealCredential("next", aad);
    expect(rotated.keyVersion).toBe(2);
    expect(openCredential(rotated, aad)).toBe("next");
  });
});
