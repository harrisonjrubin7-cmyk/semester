import { beforeEach, describe, expect, it } from 'vitest';
import { clipCounts, forgetFiles } from './clips';
import type { Doc } from './document';
import type { Settled } from './files';

const doc = (id: string, itemId: string | null): Doc => ({
  id,
  title: id,
  subtitle: '',
  courseId: null,
  itemId,
  blocks: [],
  created: 1,
  updated: 1,
});

const file = (id: string, itemId: string | null): Settled =>
  ({
    id,
    name: id,
    type: 'text/plain',
    size: 1,
    added: 1,
    courseId: null,
    folderId: null,
    starred: false,
    trashedAt: null,
    openedAt: null,
    itemId,
  }) as Settled;

beforeEach(forgetFiles);

describe('clipCounts', () => {
  it('counts the store and the files together', () => {
    // The two halves live in different stores — the documents in localStorage
    // and the files in IndexedDB — and a marker that counted one of them would
    // be wrong on exactly the deadline somebody uploaded a PDF for.
    expect(clipCounts({ documents: [doc('d', 'x')], files: [file('f', 'x')] })).toEqual({ x: 2 });
  });

  it('hands back the same object for the same lists', () => {
    // This is the whole point of the module: forty rows in one render ask the
    // same question, and the walk has to happen once.
    const documents = [doc('d', 'x')];
    const first = clipCounts({ documents });
    expect(clipCounts({ documents })).toBe(first);
  });

  it('recounts when a list is replaced', () => {
    const first = clipCounts({ documents: [doc('d', 'x')] });
    const second = clipCounts({ documents: [doc('d', 'x'), doc('e', 'x')] });
    expect(first).not.toBe(second);
    expect(second).toEqual({ x: 2 });
  });

  it('hands back one shared empty answer', () => {
    // A screen of rows with nothing filed against them compares equal render
    // after render, which is what stops a re-render loop in the row.
    const empty = clipCounts({ documents: [doc('d', null)] });
    expect(empty).toEqual({});
    expect(clipCounts({ documents: [doc('e', null)] })).toBe(empty);
  });

  it('reads a missing list as nothing rather than throwing', () => {
    expect(clipCounts({})).toEqual({});
  });
});
