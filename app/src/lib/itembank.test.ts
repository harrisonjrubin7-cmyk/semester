import { describe, expect, it } from 'vitest';
import {
  buildTest, eligibleItems, reviseItem, scoreAnswer, validateItem,
  type AnswerKey, type Item, type ItemKind, type Response,
} from './itembank';

type KeyOf<K extends AnswerKey['kind']> = Extract<AnswerKey, { kind: K }>;
/** The key for an item, typed by its kind; throws if the key is another kind. */
const keyOf = <K extends AnswerKey['kind']>(t: { key: Readonly<Record<string, AnswerKey>> }, id: string, kind: K): KeyOf<K> => {
  const k = t.key[id];
  if (!k || k.kind !== kind) throw new Error(`no ${kind} key for ${id}`);
  return k as KeyOf<K>;
};

const ASOF = '2026-10-15T00:00:00Z';
const approved = { status: 'approved' as const, author: 'Dr. Lee', reviewer: 'Dr. Park', approvedAt: '2026-09-01T00:00:00Z', reviewAfter: '2027-09-01T00:00:00Z', accessibilityReviewed: true };
const base = { version: 1, points: 2, outcomeIds: ['O1'], tags: ['unit1'], ...approved };

const mc = (id: string, over: Partial<Item> = {}): Item => ({ ...base, id, kind: 'multiple_choice', stem: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answer: 2, ...over }) as Item;
const mr = (id: string): Item => ({ ...base, id, kind: 'multiple_response', stem: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answers: [0, 3] }) as Item;
const tf = (id: string): Item => ({ ...base, id, kind: 'true_false', stem: `Q ${id}`, answer: true }) as Item;
const ord = (id: string): Item => ({ ...base, id, kind: 'ordering', stem: `Q ${id}`, steps: ['first', 'second', 'third', 'fourth'] }) as Item;
const num = (id: string): Item => ({ ...base, id, kind: 'numeric', stem: `Q ${id}`, answer: 9.8, tolerance: 0.1, unit: 'm/s²' }) as Item;
const essay = (id: string): Item => ({ ...base, id, kind: 'essay', stem: `Q ${id}`, modelAnswer: 'A thesis with evidence.' }) as Item;
const why = (i: Item) => { const r = validateItem(i); return r.ok ? 'OK' : r.why; };

describe('an item', () => {
  it('is well formed for every kind', () => {
    for (const i of [mc('a'), mr('b'), tf('c'), ord('d'), num('e'), essay('f')]) expect(why(i)).toBe('OK');
  });

  it('refuses a malformed question of each kind', () => {
    expect(why(mc('a', { options: ['a', 'b'] } as never))).toMatch(/at least three/);
    expect(why(mc('a', { options: ['a', 'A ', 'c'] } as never))).toMatch(/different/);
    expect(why(mc('a', { answer: 9 } as never))).toMatch(/one of the options/);
    expect(why({ ...mr('b'), answers: [0, 1, 2, 3] } as Item)).toMatch(/not all/);
    expect(why({ ...mr('b'), answers: [] } as Item)).toMatch(/not all/);
    expect(why({ ...mr('b'), answers: [1, 1] } as Item)).toMatch(/distinct/);
    expect(why({ ...ord('d'), steps: ['x', 'y'] } as Item)).toMatch(/at least three/);
    expect(why({ ...num('e'), tolerance: -1 } as Item)).toMatch(/tolerance/);
    expect(why({ ...essay('f'), modelAnswer: ' ' } as Item)).toMatch(/model answer/);
    expect(why(mc('a', { stem: ' ' }))).toMatch(/needs a question/);
    expect(why(mc('a', { points: 0 }))).toMatch(/more than zero/);
  });

  it('cannot be approved by its author, or without a review, an outcome, an accessibility check or a review date', () => {
    expect(why(mc('a', { reviewer: 'dr. lee' }))).toMatch(/author cannot approve/);
    expect(why(mc('a', { reviewer: undefined }))).toMatch(/needs a reviewer/);
    expect(why(mc('a', { accessibilityReviewed: false }))).toMatch(/accessibility/);
    expect(why(mc('a', { outcomeIds: [] }))).toMatch(/learning outcome/);
    expect(why(mc('a', { reviewAfter: '2026-08-01T00:00:00Z' }))).toMatch(/after its approval/);
    expect(why(mc('a', { approvedAt: undefined }))).toMatch(/time it was approved/);
    expect(why(mc('a', { status: 'draft', reviewer: undefined, approvedAt: undefined, reviewAfter: undefined }))).toBe('OK');
  });

  it('names the model, prompt version and human editor when an AI drafted it', () => {
    const ai = (over: object) => mc('a', { aiDrafted: { model: 'm-1', promptVersion: 'p-3', editor: 'Dr. Park', ...over } });
    expect(why(ai({}))).toBe('OK');
    expect(why(ai({ editor: ' ' }))).toMatch(/human editor/);
    expect(why(ai({ promptVersion: '' }))).toMatch(/prompt version/);
  });

  it('revises into the next version, back in draft, with its review cleared', () => {
    const r = reviseItem(mc('a'), mc('a', { stem: 'A better question' }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.why);
    expect(r.value).toMatchObject({ version: 2, status: 'draft', accessibilityReviewed: false, stem: 'A better question' });
    expect(r.value.reviewer).toBeUndefined();
    expect(r.value.approvedAt).toBeUndefined();
    expect(r.value.reviewAfter).toBeUndefined();
    expect(reviseItem(mc('a'), mc('b')).ok).toBe(false);
  });
});

describe('which items may be drawn', () => {
  it('excludes drafts, retired items, expired items and items whose approval is not valid', () => {
    const bank = [
      mc('ok'),
      mc('draft', { status: 'draft' }),
      mc('retired', { status: 'retired' }),
      mc('expired', { reviewAfter: '2026-10-01T00:00:00Z' }),
      mc('self', { reviewer: 'Dr. Lee' }),
    ];
    expect(eligibleItems(bank, ASOF).map((i) => i.id)).toEqual(['ok']);
  });

  it('uses the newest approved version, and a newer draft does not displace it', () => {
    const bank = [mc('a', { version: 1, stem: 'old' }), mc('a', { version: 2, stem: 'new' }), mc('a', { version: 3, status: 'draft', stem: 'draft' })];
    expect(eligibleItems(bank, ASOF).map((i) => i.stem)).toEqual(['new']);
  });
});

const bank: Item[] = [
  ...['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => mc(id)),
  mr('r1'), tf('t1'), ord('o1'), num('n1'), essay('e1'),
  mc('other', { outcomeIds: ['O2'], tags: ['unit2'] }),
];

describe('assembling a test', () => {
  const blueprint = [{ pool: { kind: 'multiple_choice' as ItemKind, outcomeId: 'O1' }, count: 4 }, { pool: { kind: 'ordering' as ItemKind }, count: 1 }, { pool: { kind: 'essay' as ItemKind }, count: 1 }];

  it('is reproducible from the seed, whatever order the bank was passed in', () => {
    const a = buildTest(bank, blueprint, 42, ASOF);
    const b = buildTest([...bank].reverse(), blueprint, 42, ASOF);
    expect(a.ok && b.ok && JSON.stringify(a.value)).toBe(b.ok ? JSON.stringify(b.value) : '');
    const c = buildTest(bank, blueprint, 43, ASOF);
    expect(c.ok && JSON.stringify(c.value)).not.toBe(a.ok ? JSON.stringify(a.value) : '');
  });

  it('draws only from the pool of each slot, and never the same item twice', () => {
    const r = buildTest(bank, [{ pool: { tag: 'unit1' }, count: 5 }, { pool: { tag: 'unit1' }, count: 5 }], 7, ASOF);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.why);
    const ids = r.value.questions.map((q) => q.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(10);
    expect(ids).not.toContain('other');
  });

  it('refuses a blueprint the bank cannot fill, naming the slot, instead of shortening it', () => {
    const r = buildTest(bank, [{ pool: { kind: 'ordering' }, count: 1 }, { pool: { kind: 'numeric' }, count: 3 }], 1, ASOF);
    expect(r.ok ? 'BUILT' : r.why).toMatch(/Slot 2 asks for 3 but the bank has 1/);
    expect(buildTest(bank, [], 1, ASOF).ok).toBe(false);
    expect(buildTest(bank, [{ pool: {}, count: 0 }], 1, ASOF).ok).toBe(false);
  });

  it('shows the student no answer, and keeps the key aligned with the shuffled choices', () => {
    const r = buildTest([mc('only'), mr('mr'), ord('ord')], [{ pool: {}, count: 3 }], 99, ASOF);
    if (!r.ok) throw new Error(r.why);
    const shown = JSON.stringify(r.value.questions);
    expect(shown).not.toMatch(/answer|correct|modelAnswer/i);
    const q = (id: string) => r.value.questions.find((x) => x.itemId === id)!;
    expect(q('only').choices![keyOf(r.value, 'only', 'multiple_choice').answer]).toBe('c');
    expect(keyOf(r.value, 'mr', 'multiple_response').answers.map((i) => q('mr').choices![i]).sort()).toEqual(['a', 'd']);
    expect(keyOf(r.value, 'ord', 'ordering').order.map((i) => q('ord').choices![i])).toEqual(['first', 'second', 'third', 'fourth']);
  });
});

describe('scoring a response', () => {
  const build = (items: Item[]) => {
    const r = buildTest(items, [{ pool: {}, count: items.length }], 5, ASOF);
    if (!r.ok) throw new Error(r.why);
    return r.value;
  };
  const score = (t: ReturnType<typeof build>, id: string, response: Response) => {
    const q = t.questions.find((x) => x.itemId === id)!;
    return scoreAnswer(t.key[id]!, q.points, q.choices?.length ?? 0, response);
  };

  it('scores each auto-scored kind against the shuffled key', () => {
    const t = build([mc('c'), mr('r'), tf('t'), ord('o'), num('n')]);
    const c = keyOf(t, 'c', 'multiple_choice').answer;
    const r = keyOf(t, 'r', 'multiple_response').answers;
    const o = keyOf(t, 'o', 'ordering').order;
    expect(score(t, 'c', c)).toEqual({ status: 'scored', points: 2, max: 2 });
    expect(score(t, 'c', (c + 1) % 4)).toEqual({ status: 'scored', points: 0, max: 2 });
    expect(score(t, 'r', r)).toMatchObject({ points: 2 });
    expect(score(t, 'r', [...r].reverse())).toMatchObject({ points: 2 });
    expect(score(t, 'r', [r[0]!])).toMatchObject({ points: 0 });
    expect(score(t, 't', true)).toMatchObject({ points: 2 });
    expect(score(t, 't', false)).toMatchObject({ points: 0 });
    expect(score(t, 'o', o)).toMatchObject({ points: 2 });
    expect(score(t, 'o', [...o].reverse())).toMatchObject({ points: 0 });
    expect(score(t, 'n', 9.85)).toMatchObject({ points: 2 });
    expect(score(t, 'n', 10)).toMatchObject({ points: 0 });
  });

  it('never scores a written answer', () => {
    const t = build([essay('e')]);
    expect(score(t, 'e', 3)).toEqual({ status: 'needs_marking' });
    expect(JSON.stringify(score(t, 'e', 3))).not.toMatch(/points/);
  });

  it('reports a response that is not an answer as invalid, never as zero', () => {
    const t = build([mc('c'), mr('r'), tf('t'), ord('o'), num('n')]);
    expect(score(t, 'c', 9).status).toBe('invalid_response');
    expect(score(t, 'c', true).status).toBe('invalid_response');
    expect(score(t, 'r', [1, 1]).status).toBe('invalid_response');
    expect(score(t, 'r', [7]).status).toBe('invalid_response');
    expect(score(t, 't', 1).status).toBe('invalid_response');
    expect(score(t, 'o', [0, 1]).status).toBe('invalid_response');
    expect(score(t, 'n', Number.NaN).status).toBe('invalid_response');
    expect(score(t, 'n', true).status).toBe('invalid_response');
  });
});
