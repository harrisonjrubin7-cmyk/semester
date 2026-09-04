import { describe, expect, it } from 'vitest';
import {
  adopt,
  bury,
  contents,
  live,
  mergeRows,
  pick,
  summarise,
  summaryLine,
  unsent,
  watermark,
  type Row,
} from './records';

const T = 1_788_000_000_000;

interface Note {
  id: string;
  title: string;
}

const row = (id: string, title: string, updatedAt: number, deletedAt = 0): Row<Note> => ({
  id,
  data: { id, title },
  updatedAt,
  deletedAt,
});

const ids = (rows: Row<Note>[]) => rows.map((r) => r.id).sort();

describe('the thing a union could not do', () => {
  it('a deletion on one device survives the trip to the other', () => {
    // This is the whole point. `resurrect.test.ts` shows the same scenario
    // under the current blob merge, where the note comes back.
    const phone = [row('n1', 'Kept', T), row('n2', 'Deleted here', T + 10, T + 10)];
    const laptop = [row('n1', 'Kept', T), row('n2', 'Deleted here', T)];
    const merged = mergeRows(laptop, phone);
    expect(ids(live(merged))).toEqual(['n1']);
    expect(merged).toHaveLength(2);
  });

  it('still keeps what only one device has', () => {
    // The union behaviour that was always right.
    const merged = mergeRows([row('a', 'laptop', T)], [row('b', 'phone', T)]);
    expect(ids(live(merged))).toEqual(['a', 'b']);
  });

  it('does not resurrect on a second round trip', () => {
    // The laptop applied the deletion; now it syncs again. The tombstone has
    // to still be there or the note walks back in.
    const first = mergeRows([row('n', 'x', T)], [row('n', 'x', T + 5, T + 5)]);
    const second = mergeRows(first, [row('n', 'x', T)]);
    expect(live(second)).toEqual([]);
  });
});

describe('which version wins', () => {
  it('the newer one', () => {
    expect(pick(row('n', 'old', T), row('n', 'new', T + 1)).data.title).toBe('new');
    expect(pick(row('n', 'new', T + 1), row('n', 'old', T)).data.title).toBe('new');
  });

  it('a tombstone, when they are the same age', () => {
    // Two devices syncing on the same second is a normal Tuesday. A
    // wrongly-kept row is a note that reappears and can be deleted again; a
    // wrongly-deleted row is gone. Only one of those is recoverable.
    expect(pick(row('n', 'live', T), row('n', 'gone', T, T)).deletedAt).toBe(T);
    expect(pick(row('n', 'gone', T, T), row('n', 'live', T)).deletedAt).toBe(T);
  });

  it('an older edit never beats a newer deletion', () => {
    expect(pick(row('n', 'edited', T), row('n', 'gone', T + 1, T + 1)).deletedAt).toBeGreaterThan(0);
  });

  it('a newer edit does beat an older deletion', () => {
    // Undeleting by editing is a real thing people do — write in a note they
    // deleted on another device this morning.
    expect(pick(row('n', 'gone', T, T), row('n', 'back', T + 1)).deletedAt).toBe(0);
  });

  it('keeps mine on a tie where neither is deleted', () => {
    // A device should not see its own screen change for a write that is not
    // newer than what it already had.
    expect(pick(row('n', 'mine', T), row('n', 'theirs', T)).data.title).toBe('mine');
  });
});

describe('burying a record', () => {
  it('marks rather than removes', () => {
    const after = bury([row('a', 'x', T), row('b', 'y', T)], 'a', T + 5);
    expect(after).toHaveLength(2);
    expect(live(after).map((r) => r.id)).toEqual(['b']);
  });

  it('moves the timestamp too, so the deletion is what is newest', () => {
    // Otherwise the tombstone loses to its own row's last edit.
    const [buried] = bury([row('a', 'x', T)], 'a', T + 5);
    expect(buried.updatedAt).toBe(T + 5);
    expect(buried.deletedAt).toBe(T + 5);
  });

  it('leaves the others alone', () => {
    const after = bury([row('a', 'x', T), row('b', 'y', T)], 'a', T + 5);
    expect(after.find((r) => r.id === 'b')?.updatedAt).toBe(T);
  });

  it('does nothing for an id that is not there', () => {
    expect(bury([row('a', 'x', T)], 'nope', T + 5)).toEqual([row('a', 'x', T)]);
  });
});

describe('what to send and what to ask for', () => {
  const rows = [row('a', 'x', T), row('b', 'y', T + 10), row('c', 'z', T + 20, T + 20)];

  it('sends only what changed since the last push', () => {
    expect(ids(unsent(rows, T + 5))).toEqual(['b', 'c']);
  });

  it('sends tombstones as readily as edits', () => {
    expect(unsent(rows, T + 15).map((r) => r.id)).toEqual(['c']);
  });

  it('sends everything when nothing has been pushed', () => {
    expect(unsent(rows, 0)).toHaveLength(3);
  });

  it('remembers the newest it has seen', () => {
    expect(watermark(rows)).toBe(T + 20);
    expect(watermark([])).toBe(0);
  });
});

describe('the first run on a device that has only ever had the blob', () => {
  it('treats existing notes as written now, not as ancient', () => {
    // Marked ancient, the account's copy would silently win over work that was
    // never uploaded — which is the failure this whole change exists to avoid.
    const rows = adopt([{ id: 'a', title: 'Written months ago' }], T);
    expect(rows[0].updatedAt).toBe(T);
    expect(rows[0].deletedAt).toBe(0);
    expect(unsent(rows, T - 1)).toHaveLength(1);
  });

  it('keeps the record itself untouched', () => {
    const note = { id: 'a', title: 'x' };
    expect(adopt([note], T)[0].data).toBe(note);
  });
});

describe('saying what a sync did', () => {
  const before = [row('a', 'x', T), row('b', 'y', T)];

  it('counts what arrived, changed and went', () => {
    const after = [row('a', 'x', T), row('b', 'edited', T + 1), row('c', 'new', T + 1)];
    expect(summarise(before, after)).toEqual({ added: 1, updated: 1, deleted: 0 });
  });

  it('counts a deletion that happened elsewhere', () => {
    const after = [row('a', 'x', T), row('b', 'y', T + 1, T + 1)];
    expect(summarise(before, after).deleted).toBe(1);
  });

  it('does not count a tombstone that arrived as an addition', () => {
    const after = [...before, row('c', 'never seen', T + 1, T + 1)];
    expect(summarise(before, after).added).toBe(0);
  });

  it('says nothing when nothing moved', () => {
    expect(summaryLine(summarise(before, before), 'Notes')).toBe('');
  });

  it('reads as a sentence when something did', () => {
    const after = [row('a', 'x', T), row('b', 'y', T + 1, T + 1), row('c', 'new', T + 1)];
    expect(summaryLine(summarise(before, after), 'Notes')).toBe(
      'Notes: 1 new, 1 deleted elsewhere.',
    );
  });
});

describe('reading the records out', () => {
  it('gives the live ones, without their envelope', () => {
    expect(contents([row('a', 'x', T), row('b', 'y', T, T)])).toEqual([{ id: 'a', title: 'x' }]);
  });
});
