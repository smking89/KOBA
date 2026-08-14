import { randomInt } from 'crypto';
import { InvalidKobaIdFormatError } from './kobaid.errors';
import { KobaIdRole } from './kobaid.types';

/**
 * CODE alphabet: uppercase alphanumeric, excluding visually ambiguous
 * characters 0, O, 1, I, L.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

const ROLE_VALUES = Object.values(KobaIdRole) as string[];
const ROLE_PATTERN = ROLE_VALUES.join('|');
const CODE_CHAR_PATTERN = `[${CODE_ALPHABET}]{${CODE_LENGTH}}`;
export const KOBA_ID_PATTERN = new RegExp(`^KOBA-(${ROLE_PATTERN})-(${CODE_CHAR_PATTERN})$`);

/** True if `value` matches the KOBA-ROLE-CODE format with a known role and valid charset. */
export function isValidKobaIdFormat(value: string): boolean {
  return KOBA_ID_PATTERN.test(value);
}

/** Throws InvalidKobaIdFormatError if `value` does not match the KOBAID format. */
export function assertValidKobaIdFormat(value: string): void {
  if (!isValidKobaIdFormat(value)) {
    throw new InvalidKobaIdFormatError(value);
  }
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^${CODE_CHAR_PATTERN}$`).test(code);
}

export function buildFullId(role: KobaIdRole, code: string): string {
  return `KOBA-${role}-${code}`;
}

/**
 * Generates a 4-character CODE using crypto.randomInt (CSPRNG-backed),
 * never Math.random — codes must be genuinely unpredictable.
 */
export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}
