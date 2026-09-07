import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSISTED, type State } from '../state/shape';
import { scopesFor } from './scoped';

/**
 * The offer to keep looking somewhere narrower, and what it may not offer.
 */

const NOW = Date.now();
const base = (over: Partial<State>) => ({ ...DEFAULT_PERSISTED, ...over }) as State;

const source = (raw: string, role = '') => ({
  id: raw,
  raw,
  role,
  project: '',
  courseId: '',
  created: NOW,
});

describe('what it offers', () => {
  it('counts the records rather than naming the screen and hoping', () => {
    const state = base({
      sources: [source('Keynes, General Theory'), source('Keynes on money'), source('Smith')] as never,
    });
    const [hit] = scopesFor('keynes', state);
    expect(hit.screen).toBe('sources');
    expect(hit.count).toBe(2);
    expect(hit.said).toBe('2 sources');
  });

  it('gets the singular right, because "1 sources" is how a count stops being trusted', () => {
    const state = base({ sources: [source('Keynes')] as never });
    expect(scopesFor('keynes', state)[0].said).toBe('1 source');
  });

  it('says nothing about a collection nothing matched', () => {
    const state = base({ sources: [source('Smith')] as never });
    expect(scopesFor('keynes', state)).toEqual([]);
  });

  it('puts the biggest pile first', () => {
    const state = base({
      sources: [source('audit a')] as never,
      applications: [
        { id: 'a', org: 'Audit Corp', role: '', stage: 'applied', due: '', rolling: false, next: '', nextBy: '', kind: 'internship', moves: [], created: NOW },
        { id: 'b', org: 'Auditors LLP', role: '', stage: 'applied', due: '', rolling: false, next: '', nextBy: '', kind: 'internship', moves: [], created: NOW },
      ] as never,
    });
    expect(scopesFor('audit', state).map((s) => s.screen)).toEqual(['applying', 'sources']);
  });

  it('ignores a query too short to mean anything', () => {
    // One letter matches most of somebody's records, and "48 sources match a"
    // is not an offer, it is noise on every keystroke.
    const state = base({ sources: [source('Keynes')] as never });
    expect(scopesFor('k', state)).toEqual([]);
  });
});

describe('what it will not offer', () => {
  it('never offers People, whatever is typed', () => {
    /*
     * The same rule as `lib/context.ts` and the missing provider in `ai/`.
     * Searching your own professors is fine and the People screen does it —
     * this list is read by the command overlay, and the one collection that
     * is refused everywhere else is refused here too rather than being the
     * exception nobody noticed.
     */
    const state = base({
      people: [
        { id: 'p', name: 'Dr Stromme', role: 'Professor', courseId: '', email: '', note: '', created: NOW },
      ] as never,
    });
    expect(scopesFor('stromme', state)).toEqual([]);
    expect(scopesFor('professor', state).map((s) => s.screen)).not.toContain('people');
  });

  it('offers no screen twice', () => {
    const state = base({
      sources: [source('a note'), source('another note')] as never,
      taken: [{ id: 't', code: 'NOTE 101', title: '', term: '', hours: 3, grade: '', current: false }] as never,
    });
    const screens = scopesFor('note', state).map((s) => s.screen);
    expect(new Set(screens).size).toBe(screens.length);
  });
});
