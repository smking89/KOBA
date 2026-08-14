import { InsufficientInterestsError } from './accounts.errors';
import { InterestsValidator, MINIMUM_INTERESTS } from './interests.validator';

describe('InterestsValidator', () => {
  const validator = new InterestsValidator();

  it('is not satisfied with fewer than the minimum interests', () => {
    expect(validator.isSatisfied(['gaming', 'fps', 'esports'])).toBe(false);
  });

  it('is satisfied with exactly the minimum interests', () => {
    expect(MINIMUM_INTERESTS).toBe(4);
    expect(validator.isSatisfied(['gaming', 'fps', 'esports', 'streaming'])).toBe(true);
  });

  it('is satisfied with more than the minimum', () => {
    expect(
      validator.isSatisfied(['gaming', 'fps', 'esports', 'streaming', 'trading']),
    ).toBe(true);
  });

  it('does not count duplicate (case-insensitive) tags twice', () => {
    expect(validator.isSatisfied(['gaming', 'Gaming', 'GAMING', 'fps'])).toBe(false);
  });

  it('does not count blank/whitespace-only tags', () => {
    expect(validator.isSatisfied(['gaming', 'fps', '   ', 'esports'])).toBe(false);
  });

  it('assertSatisfied throws InsufficientInterestsError below the minimum', () => {
    expect(() => validator.assertSatisfied(['gaming', 'fps'])).toThrow(
      InsufficientInterestsError,
    );
  });

  it('assertSatisfied does not throw at/above the minimum', () => {
    expect(() =>
      validator.assertSatisfied(['gaming', 'fps', 'esports', 'streaming']),
    ).not.toThrow();
  });
});
