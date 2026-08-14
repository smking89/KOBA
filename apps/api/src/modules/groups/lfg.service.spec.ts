import {
  AlreadyJoinedLfgPostError,
  InvalidMaxSlotsError,
  LfgPostExpiredError,
  LfgPostFullError,
  LfgPostNotFoundError,
} from './lfg.errors';
import { InMemoryLfgPostRepository } from './in-memory-lfg.repository';
import { LfgService } from './lfg.service';

describe('LfgService', () => {
  let repository: InMemoryLfgPostRepository;
  let service: LfgService;

  const AUTHOR = 'KOBA-PL-AUTH';

  const HOUR_MS = 60 * 60 * 1000;

  beforeEach(() => {
    repository = new InMemoryLfgPostRepository();
    service = new LfgService(repository);
  });

  function futureDate(msFromNow: number): Date {
    return new Date(Date.now() + msFromNow);
  }

  describe('createLfgPost', () => {
    it('creates a standalone (no groupId) LFG post starting at 0 filled slots', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Duo Wipe',
        requirementsText: 'Mic required',
        maxSlots: 2,
        expiresAt: futureDate(HOUR_MS),
      });

      expect(post.id).toBeDefined();
      expect(post.groupId).toBeNull();
      expect(post.authorKobaId).toBe(AUTHOR);
      expect(post.game).toBe('Rust');
      expect(post.mode).toBe('Duo Wipe');
      expect(post.requirementsText).toBe('Mic required');
      expect(post.maxSlots).toBe(2);
      expect(post.filledSlots).toBe(0);
      expect(post.createdAt).toBeInstanceOf(Date);
    });

    it('creates a group-scoped LFG post when groupId is provided', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        groupId: 'group-1',
        game: 'Rust',
        mode: 'Trio',
        requirementsText: '',
        maxSlots: 3,
        expiresAt: futureDate(HOUR_MS),
      });

      expect(post.groupId).toBe('group-1');
    });

    it('rejects a non-positive maxSlots', async () => {
      await expect(
        service.createLfgPost({
          authorKobaId: AUTHOR,
          game: 'Rust',
          mode: 'Duo',
          requirementsText: '',
          maxSlots: 0,
          expiresAt: futureDate(HOUR_MS),
        }),
      ).rejects.toThrow(InvalidMaxSlotsError);
    });

    it('rejects a non-integer maxSlots', async () => {
      await expect(
        service.createLfgPost({
          authorKobaId: AUTHOR,
          game: 'Rust',
          mode: 'Duo',
          requirementsText: '',
          maxSlots: 2.5,
          expiresAt: futureDate(HOUR_MS),
        }),
      ).rejects.toThrow(InvalidMaxSlotsError);
    });
  });

  describe('getById', () => {
    it('throws LfgPostNotFoundError for an unknown id', async () => {
      await expect(service.getById('does-not-exist')).rejects.toThrow(LfgPostNotFoundError);
    });
  });

  describe('joinLfgPost', () => {
    it('increments filledSlots correctly across multiple joiners', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Trio',
        requirementsText: '',
        maxSlots: 3,
        expiresAt: futureDate(HOUR_MS),
      });

      const afterFirst = await service.joinLfgPost(post.id, 'KOBA-PL-BBBB');
      expect(afterFirst.filledSlots).toBe(1);

      const afterSecond = await service.joinLfgPost(post.id, 'KOBA-PL-CCCC');
      expect(afterSecond.filledSlots).toBe(2);
    });

    it('rejects joining once the post is full', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Duo',
        requirementsText: '',
        maxSlots: 1,
        expiresAt: futureDate(HOUR_MS),
      });

      await service.joinLfgPost(post.id, 'KOBA-PL-BBBB');

      await expect(service.joinLfgPost(post.id, 'KOBA-PL-CCCC')).rejects.toThrow(LfgPostFullError);
    });

    it('rejects joining an already-expired post', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Duo',
        requirementsText: '',
        maxSlots: 2,
        expiresAt: futureDate(-1000),
      });

      await expect(service.joinLfgPost(post.id, 'KOBA-PL-BBBB')).rejects.toThrow(LfgPostExpiredError);
    });

    it('rejects the same kobaId joining twice (no double-counted slot)', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Trio',
        requirementsText: '',
        maxSlots: 3,
        expiresAt: futureDate(HOUR_MS),
      });

      await service.joinLfgPost(post.id, 'KOBA-PL-BBBB');

      await expect(service.joinLfgPost(post.id, 'KOBA-PL-BBBB')).rejects.toThrow(AlreadyJoinedLfgPostError);

      const reloaded = await service.getById(post.id);
      expect(reloaded.filledSlots).toBe(1);
    });
  });

  describe('isExpired', () => {
    it('derives expired/active status from the clock at multiple time points, not a stored field', async () => {
      const post = await service.createLfgPost({
        authorKobaId: AUTHOR,
        game: 'Rust',
        mode: 'Duo',
        requirementsText: '',
        maxSlots: 2,
        expiresAt: new Date('2026-01-01T12:00:00.000Z'),
      });

      expect(service.isExpired(post, new Date('2026-01-01T11:59:59.000Z'))).toBe(false);
      expect(service.isExpired(post, new Date('2026-01-01T12:00:00.000Z'))).toBe(false);
      expect(service.isExpired(post, new Date('2026-01-01T12:00:01.000Z'))).toBe(true);
      expect(service.isExpired(post, new Date('2030-01-01T00:00:00.000Z'))).toBe(true);
    });
  });
});
