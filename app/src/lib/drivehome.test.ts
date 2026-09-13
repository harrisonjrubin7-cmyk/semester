import { describe, expect, it } from 'vitest';
import { LATELY, SUGGESTED_FILES, suggest, suggestFolders, touchedAt, when } from './drivehome';
import type { Settled } from './files';
import type { Shown } from './folders';

const DAY = 86_400_000;
/** A Wednesday afternoon, so "yesterday" and "last week" are not the same day. */
const NOW = new Date('2026-09-09T15:00:00Z').getTime();

const file = (over: Partial<Settled> & { id: string }): Settled =>
  ({
    name: `${over.id}.pdf`,
    type: 'application/pdf',
    size: 1000,
    added: NOW,
    courseId: null,
    folderId: null,
    starred: false,
    openedAt: null,
    trashedAt: null,
    text: '',
    ...over,
  }) as Settled;

const folder = (id: string, name = id): Shown => ({ id, name, parentId: null, created: 0 }) as Shown;

/**
 * The home's two rows.
 *
 * Every test here is about the column Google's drive calls "Reason suggested"
 * and this one calls "Why it is here": six rows in an order nobody can see is
 * a list people check against the folders anyway.
 */
describe('the files a drive suggests', () => {
  it('puts what you opened before what merely arrived', () => {
    const rows = suggest(
      [
        file({ id: 'new', added: NOW }),
        file({ id: 'open', added: NOW - 30 * DAY, openedAt: NOW - DAY }),
      ],
      NOW,
    );
    expect(rows.map((r) => r.file.id)).toEqual(['open', 'new']);
    expect(rows[0].why).toBe('opened');
    expect(rows[1].why).toBe('added');
  });

  it('names each file once, under its strongest reason', () => {
    // The same row three times with three sentences beside it is how a
    // suggestion list stops being read.
    const rows = suggest([file({ id: 'a', openedAt: NOW - DAY, starred: true })], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].why).toBe('opened');
  });

  it('falls back to a star when nothing has been opened or added lately', () => {
    const rows = suggest([file({ id: 'a', starred: true })], NOW, 1);
    expect(rows[0].why).toBe('added');
    const only = suggest([file({ id: 'a', starred: true }), file({ id: 'b' })], NOW, 2);
    expect(only.map((r) => r.why)).toEqual(['added', 'added']);
  });

  it('stops at the number the home has room for', () => {
    const many = Array.from({ length: 30 }, (_, i) => file({ id: `f${i}`, added: NOW - i * 1000 }));
    expect(suggest(many, NOW)).toHaveLength(SUGGESTED_FILES);
  });

  it('says nothing at all when there is nothing', () => {
    expect(suggest([], NOW)).toEqual([]);
    expect(suggestFolders([], [], NOW)).toEqual([]);
  });

  it('gives each row a reason somebody can check', () => {
    const rows = suggest([file({ id: 'a', openedAt: NOW - 2 * 60_000 })], NOW);
    expect(rows[0].says).toContain('You opened it');
  });
});

describe('the folders a drive suggests', () => {
  const folders = [folder('econ', 'ECON 1020'), folder('psci', 'PSCI 1100')];

  it('ranks by what has happened in them rather than by how full they are', () => {
    const rows = suggestFolders(
      folders,
      [
        file({ id: 'a', folderId: 'econ', added: NOW - 5 * DAY }),
        file({ id: 'b', folderId: 'econ', added: NOW - 6 * DAY }),
        file({ id: 'c', folderId: 'econ', added: NOW - 7 * DAY }),
        file({ id: 'd', folderId: 'psci', added: NOW - DAY }),
      ],
      NOW,
    );
    // Three files against one, and the one is still first: the fullest folder
    // is the one from September and the interesting one is today's.
    expect(rows.map((r) => r.folder.id)).toEqual(['psci', 'econ']);
    expect(rows[0].count).toBe(1);
  });

  it('leaves out a folder nothing has happened in for a fortnight', () => {
    const rows = suggestFolders(
      folders,
      [file({ id: 'a', folderId: 'econ', added: NOW - LATELY - DAY })],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('leaves out an empty folder rather than showing a row of noughts', () => {
    expect(suggestFolders(folders, [], NOW)).toEqual([]);
  });
});

describe('when a file was last anything', () => {
  it('is the opening where there is one and the arrival otherwise', () => {
    expect(touchedAt(file({ id: 'a', added: 100, openedAt: 500 }))).toBe(500);
    expect(touchedAt(file({ id: 'a', added: 100 }))).toBe(100);
    // A file added after it was last opened — restored from a backup, say.
    expect(touchedAt(file({ id: 'a', added: 900, openedAt: 500 }))).toBe(900);
  });
});

describe('how a moment reads', () => {
  it('is a time today, a weekday this week and a date before that', () => {
    // The rule every file list uses: nobody needs the year of something from
    // this morning, or the minute of something from March.
    const today = when(NOW - 60_000, NOW);
    expect(today).toMatch(/\d/);
    expect(today).not.toMatch(/[A-Za-z]{4,}/);
    expect(when(NOW - 2 * DAY, NOW)).toMatch(/day$/);
    expect(when(NOW - 60 * DAY, NOW)).toMatch(/[A-Za-z]{3}/);
  });
});
