import { Injectable } from '@nestjs/common';
import { InsufficientInterestsError } from './accounts.errors';

/** Minimum number of interest hashtags required before an account is considered onboarded. */
export const MINIMUM_INTERESTS = 4;

function normalize(interests: readonly string[]): string[] {
  return Array.from(
    new Set(
      interests
        .map((interest) => interest.trim().toLowerCase())
        .filter((interest) => interest.length > 0),
    ),
  );
}

/**
 * Validates the "mandatory interest selection" rule: an account (of any
 * role) needs at least MINIMUM_INTERESTS distinct, non-empty interest
 * hashtags to be considered onboarded. The interest catalog itself
 * (canonical tag list) is out of scope for Phase 1 — this only enforces
 * the count/shape rule.
 */
@Injectable()
export class InterestsValidator {
  /** Returns true if `interests` satisfies the minimum-interests rule. */
  isSatisfied(interests: readonly string[]): boolean {
    return normalize(interests).length >= MINIMUM_INTERESTS;
  }

  /** Throws InsufficientInterestsError if `interests` does not satisfy the rule. */
  assertSatisfied(interests: readonly string[]): void {
    const distinctCount = normalize(interests).length;
    if (distinctCount < MINIMUM_INTERESTS) {
      throw new InsufficientInterestsError(distinctCount, MINIMUM_INTERESTS);
    }
  }
}
