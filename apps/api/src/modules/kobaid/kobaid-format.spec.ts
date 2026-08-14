import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateCode,
  isValidCode,
  isValidKobaIdFormat,
} from './kobaid-format';

describe('kobaid-format', () => {
  describe('isValidKobaIdFormat', () => {
    it.each([
      'KOBA-PL-7F3K',
      'KOBA-BZ-9GHJ',
      'KOBA-IN-A2Z9',
      'KOBA-SA-KM4T',
      'KOBA-AD-HJ4K',
      'KOBA-MD-2345',
    ])('accepts a valid format: %s', (value) => {
      expect(isValidKobaIdFormat(value)).toBe(true);
    });

    it('rejects an unknown role', () => {
      expect(isValidKobaIdFormat('KOBA-XX-7F3K')).toBe(false);
    });

    it('rejects lowercase', () => {
      expect(isValidKobaIdFormat('koba-pl-7f3k')).toBe(false);
    });

    it('rejects wrong code length', () => {
      expect(isValidKobaIdFormat('KOBA-PL-7F3')).toBe(false);
      expect(isValidKobaIdFormat('KOBA-PL-7F3KK')).toBe(false);
    });

    it('rejects missing dashes / malformed structure', () => {
      expect(isValidKobaIdFormat('KOBAPL7F3K')).toBe(false);
      expect(isValidKobaIdFormat('')).toBe(false);
    });

    it.each(['0', 'O', '1', 'I', 'L'])(
      'rejects ambiguous character "%s" in the code',
      (ambiguous) => {
        const code = `${ambiguous}23A`;
        expect(isValidKobaIdFormat(`KOBA-PL-${code}`)).toBe(false);
      },
    );
  });

  describe('isValidCode', () => {
    it('accepts a code built only from the allowed alphabet', () => {
      expect(isValidCode('7F3K')).toBe(true);
    });

    it.each(['0', 'O', '1', 'I', 'L'])('rejects ambiguous character "%s"', (ambiguous) => {
      expect(isValidCode(`${ambiguous}23A`)).toBe(false);
    });
  });

  describe('generateCode', () => {
    it('generates codes of the expected length using only the allowed alphabet', () => {
      for (let i = 0; i < 200; i++) {
        const code = generateCode();
        expect(code).toHaveLength(CODE_LENGTH);
        for (const char of code) {
          expect(CODE_ALPHABET).toContain(char);
        }
      }
    });

    it('never contains ambiguous characters', () => {
      const ambiguous = ['0', 'O', '1', 'I', 'L'];
      for (let i = 0; i < 200; i++) {
        const code = generateCode();
        for (const char of ambiguous) {
          expect(code).not.toContain(char);
        }
      }
    });

    it('produces varied output across many generations (not a fixed value)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }
      expect(codes.size).toBeGreaterThan(1);
    });
  });
});
