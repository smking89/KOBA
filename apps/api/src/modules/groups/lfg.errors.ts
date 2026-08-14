/** Base class for all typed LFG domain errors. */
export abstract class LfgDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LfgPostNotFoundError extends LfgDomainError {
  constructor(postId: string) {
    super(`LFG post "${postId}" was not found`);
  }
}

/** Thrown when `maxSlots` is not a positive integer. */
export class InvalidMaxSlotsError extends LfgDomainError {
  constructor(maxSlots: number) {
    super(`maxSlots must be a positive integer, got ${maxSlots}`);
  }
}

/** Thrown by `join()` when `expiresAt` is already in the past. */
export class LfgPostExpiredError extends LfgDomainError {
  constructor(postId: string) {
    super(`LFG post "${postId}" has expired and no longer accepts joins`);
  }
}

/** Thrown by `join()` when `filledSlots` has already reached `maxSlots`. */
export class LfgPostFullError extends LfgDomainError {
  constructor(postId: string) {
    super(`LFG post "${postId}" is full`);
  }
}

/** Thrown by `join()` when `kobaId` has already joined this post — a slot
 * is never double-counted for the same KOBAID. */
export class AlreadyJoinedLfgPostError extends LfgDomainError {
  constructor(postId: string, kobaId: string) {
    super(`KOBAID "${kobaId}" has already joined LFG post "${postId}"`);
  }
}
