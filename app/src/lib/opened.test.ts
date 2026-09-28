import { describe, expect, it } from 'vitest';
import { continuing, KEEP, readOpened, rememberOpened, type Opened } from './opened';
import { navigate } from '../state/slices/navigate';
import { freshPersisted, initialEphemeral, type State } from '../state/shape';

const catalog = {
  items: [
    { id: 'lab', c: 'chem', title: 'Lab report' },
    { id: 'ps4', c: 'econ', title: 'Problem Set 4' },
  ],
  byId: {
    chem: { id: 'chem', code: 'CHEM 1601', name: 'General Chemistry' },
    econ: { id: 'econ', code: 'ECON 1010', name: 'Principles of Macroeconomics' },
  },
} as never;

describe('rememberOpened', () => {
  it('puts the newest first and never lists a thing twice', () => {
    let list: Opened[] = [];
    list = rememberOpened(list, { kind: 'item', id: 'lab' });
    list = rememberOpened(list, { kind: 'course', id: 'econ' });
    list = rememberOpened(list, { kind: 'item', id: 'lab' });
    expect(list).toEqual([
      { kind: 'item', id: 'lab' },
      { kind: 'course', id: 'econ' },
    ]);
  });

  it('keeps an item and a course with the same id apart', () => {
    const list = rememberOpened([{ kind: 'course', id: 'x' }], { kind: 'item', id: 'x' });
    expect(list).toHaveLength(2);
  });

  it('is capped', () => {
    let list: Opened[] = [];
    for (let n = 0; n < KEEP + 5; n++) list = rememberOpened(list, { kind: 'item', id: String(n) });
    expect(list).toHaveLength(KEEP);
    expect(list[0].id).toBe(String(KEEP + 4));
  });
});

describe('readOpened', () => {
  it('drops damaged entries rather than throwing', () => {
    expect(readOpened('nope')).toEqual([]);
    expect(
      readOpened([{ kind: 'item', id: 'a' }, null, { kind: 'screen', id: 'b' }, { kind: 'course', id: '' }, 7]),
    ).toEqual([{ kind: 'item', id: 'a' }]);
  });
});

describe('continuing', () => {
  const list: Opened[] = [
    { kind: 'item', id: 'gone' },
    { kind: 'item', id: 'lab' },
    { kind: 'course', id: 'econ' },
    { kind: 'item', id: 'ps4' },
  ];

  it('resolves titles and course codes from the catalogue', () => {
    expect(continuing(list, catalog, {})).toEqual([
      { kind: 'item', id: 'lab', title: 'Lab report', context: 'CHEM 1601' },
      { kind: 'course', id: 'econ', title: 'Principles of Macroeconomics', context: 'ECON 1010' },
      { kind: 'item', id: 'ps4', title: 'Problem Set 4', context: 'ECON 1010' },
    ]);
  });

  it('offers back only unfinished work', () => {
    expect(continuing(list, catalog, { lab: true }).map((c) => c.id)).toEqual(['econ', 'ps4']);
  });

  it('respects the limit', () => {
    expect(continuing(list, catalog, {}, 1)).toHaveLength(1);
  });
});

describe('the navigation funnel records what was opened', () => {
  const start = (): State => ({ ...freshPersisted(), ...initialEphemeral(), screen: 'home' }) as State;

  it('remembers a deadline', () => {
    const s = navigate(start(), { type: 'openItem', id: 'lab' })!;
    expect(s.opened[0]).toEqual({ kind: 'item', id: 'lab' });
  });

  it('remembers a course', () => {
    const s = navigate(start(), { type: 'openCourse', id: 'econ' as never })!;
    expect(s.opened[0]).toEqual({ kind: 'course', id: 'econ' });
  });
});
