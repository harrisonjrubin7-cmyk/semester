// @vitest-environment jsdom
import { EMPTY_ACTION_CHOICES } from './actions';
import { EMPTY_CLARITY } from './clarity';
import { EMPTY_PATH_PROFILE } from './path-profile';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ATHLETICS } from './athletics';
import { EMPTY_CAREER } from './career';
import { EMPTY_CREATIONS } from './creations';
import { EMPTY_FAMILY } from './family';
import { EMPTY_PATHWAY } from './pathway';
import { EMPTY_HOUSING, EMPTY_MEALS, HOUSING_PLAN_PREFIX, MEAL_PLAN_PREFIX } from './portal-storage';
import {
  readWorkspaceBackup,
  restoreWorkspaces,
  workspaceBackup,
  workspaceLabel,
  type WorkspaceBackup,
} from './workspace-backup';

/**
 * The six workspaces that are in no other backup, and the ways a file can lie.
 *
 * Two halves. The first is that a backup contains what it should and nothing
 * else — in particular not another account's workspaces, which is the failure
 * that would be invisible until somebody restored onto a shared device. The
 * second is that a bad file changes nothing: validated whole before the first
 * write, and rolled back if storage refuses partway.
 *
 * Run against a stand-in `Storage` rather than the real one, so a quota
 * failure is a thing the test causes on purpose at a chosen moment instead of
 * something it hopes for.
 */

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  /** Set to a key to make the write of that key throw, as a full disk would. */
  refuseAt: string | null = null;
  /** Set to make rollback writes fail too. */
  refuseRestore = false;

  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.refuseAt === k) throw new Error('QuotaExceededError');
    if (this.refuseRestore && this.map.has(k)) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    if (this.refuseRestore) throw new Error('QuotaExceededError');
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

const ACCOUNT = 'acct-1';
/** Stands for whatever was already on the device being restored onto. */
const MINE = JSON.stringify({ mine: true });
const TERM = '2026FA';

/*
 * Each screen's own empty value, not a hand-written one.
 *
 * The readers are strict about version and shape, and a literal here would be
 * a second definition of "empty" that drifts the first time one of them gains
 * a field — passing this file while the app writes something else.
 */
const seed = (storage: FakeStorage, account = ACCOUNT) => {
  storage.setItem(`semester.athletics.v1:${account}:${TERM}`, JSON.stringify(EMPTY_ATHLETICS));
  storage.setItem(`semester.career.v1:${account}:${TERM}`, JSON.stringify(EMPTY_CAREER));
  storage.setItem(`semester.creations.v1:${account}:${TERM}`, JSON.stringify(EMPTY_CREATIONS));
  storage.setItem(`semester.university.drafts.v1:${account}:${TERM}`, JSON.stringify([]));
  storage.setItem(`semester.family.v1:${account}`, JSON.stringify(EMPTY_FAMILY));
  storage.setItem(`semester.pathway.v1:${account}`, JSON.stringify(EMPTY_PATHWAY));
  storage.setItem(`semester.actions.v1:${account}`, JSON.stringify(EMPTY_ACTION_CHOICES));
  storage.setItem(`semester.path-profile.v1:${account}`, JSON.stringify(EMPTY_PATH_PROFILE));
  storage.setItem(`semester.clarity.v1:${account}`, JSON.stringify(EMPTY_CLARITY));
  storage.setItem(`${HOUSING_PLAN_PREFIX}:${account}:${TERM}`, JSON.stringify(EMPTY_HOUSING));
  storage.setItem(`${MEAL_PLAN_PREFIX}:${account}:${TERM}`, JSON.stringify(EMPTY_MEALS));
};

/** How many workspaces `seed` writes: one per definition. */
const SEEDED = 11;

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
});

describe('what goes into a workspace backup', () => {
  it('takes every workspace', () => {
    seed(storage);
    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.format).toBe('semester.workspaces.v1');
    expect(backup.records.map((r) => r.kind).sort()).toEqual([
      'actions',
      'athletics',
      'career',
      'clarity',
      'creations',
      'family',
      'housingPlan',
      'mealPlan',
      'pathProfile',
      'pathway',
      'university',
    ]);
  });

  it('takes every term of a term-scoped workspace', () => {
    storage.setItem(`semester.career.v1:${ACCOUNT}:2026FA`, JSON.stringify(EMPTY_CAREER));
    storage.setItem(`semester.career.v1:${ACCOUNT}:2027SP`, JSON.stringify(EMPTY_CAREER));
    expect(
      workspaceBackup(ACCOUNT, storage)
        .records.map((r) => r.term)
        .sort(),
    ).toEqual(['2026FA', '2027SP']);
  });

  it('never reaches another account', () => {
    seed(storage, ACCOUNT);
    seed(storage, 'someone-else');
    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records).toHaveLength(SEEDED);
    expect(JSON.stringify(backup)).not.toContain('someone-else');
  });

  it('takes only the account-owned housing plan and leaves the ambiguous legacy draft unclaimed', () => {
    const mine = { ...EMPTY_HOUSING, residence: 'North Hall', notes: 'Ask about the quiet floor.' };
    storage.setItem(`${HOUSING_PLAN_PREFIX}:${ACCOUNT}:${TERM}`, JSON.stringify(mine));
    storage.setItem(`${HOUSING_PLAN_PREFIX}:someone-else:${TERM}`, JSON.stringify({ ...mine, residence: 'Other Hall' }));
    storage.setItem(`semester.housing-plan.${TERM}`, JSON.stringify({ ...mine, residence: 'Legacy Hall' }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records).toEqual([{ kind: 'housingPlan', term: TERM, value: mine }]);
    expect(JSON.stringify(backup)).not.toContain('Other Hall');
    expect(JSON.stringify(backup)).not.toContain('Legacy Hall');

    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem(`${HOUSING_PLAN_PREFIX}:acct-2:${TERM}`)!)).toEqual(mine);
    expect(fresh.getItem(`${HOUSING_PLAN_PREFIX}:${ACCOUNT}:${TERM}`)).toBeNull();
  });

  it('takes only the account-owned meal estimate and leaves the ambiguous legacy estimate unclaimed', () => {
    const mine = { ...EMPTY_MEALS, name: 'Flex 14', weekly: '14', weeks: '15', cost: '3200' };
    storage.setItem(`${MEAL_PLAN_PREFIX}:${ACCOUNT}:${TERM}`, JSON.stringify(mine));
    storage.setItem(`${MEAL_PLAN_PREFIX}:someone-else:${TERM}`, JSON.stringify({ ...mine, name: 'Other plan' }));
    storage.setItem(`semester.meal-plan.${TERM}`, JSON.stringify({ ...mine, name: 'Legacy plan' }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records).toEqual([{ kind: 'mealPlan', term: TERM, value: mine }]);
    expect(JSON.stringify(backup)).not.toContain('Other plan');
    expect(JSON.stringify(backup)).not.toContain('Legacy plan');

    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem(`${MEAL_PLAN_PREFIX}:acct-2:${TERM}`)!)).toEqual(mine);
    expect(fresh.getItem(`${MEAL_PLAN_PREFIX}:${ACCOUNT}:${TERM}`)).toBeNull();
  });

  it('leaves everything that is not a named workspace alone', () => {
    // The reason this is built from the definitions rather than from a sweep.
    seed(storage);
    storage.setItem('semester.tokens.v1', JSON.stringify({ refresh: 'secret-token' }));
    storage.setItem('semester.v1', JSON.stringify({ nav: 'guides' }));
    storage.setItem(`semester.career.v1.stray:${ACCOUNT}:${TERM}`, JSON.stringify(EMPTY_CAREER));
    const text = JSON.stringify(workspaceBackup(ACCOUNT, storage));
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('stray');
    expect(workspaceBackup(ACCOUNT, storage).records).toHaveLength(SEEDED);
  });

  it('refuses to write a backup that would silently omit a corrupted workspace', () => {
    seed(storage);
    storage.setItem(`semester.career.v1:${ACCOUNT}:${TERM}`, 'not json');
    expect(() => workspaceBackup(ACCOUNT, storage)).toThrow(/Career plans \(2026FA\) could not be read/);
  });

  it('names a workspace the way somebody would recognise it', () => {
    expect(workspaceLabel({ kind: 'career', term: TERM, value: EMPTY_CAREER })).toBe('Career plans · 2026FA');
    expect(workspaceLabel({ kind: 'pathway', term: '', value: EMPTY_PATHWAY })).toBe('Education pathway');
  });
});

describe('what a workspace backup is allowed to be', () => {
  const file = (records: unknown[]) => JSON.stringify({ format: 'semester.workspaces.v1', exported: '', records });

  it('rejects a file that is not one', () => {
    expect(() => readWorkspaceBackup(JSON.stringify({ format: 'something.else', records: [] }))).toThrow(
      /not a Semester workspace backup/,
    );
    expect(() => readWorkspaceBackup(JSON.stringify({ format: 'semester.workspaces.v1' }))).toThrow();
  });

  it('rejects a workspace this version does not have', () => {
    expect(() => readWorkspaceBackup(file([{ kind: 'payroll', term: '', value: {} }]))).toThrow(/not a workspace/);
  });

  it('rejects a term that would write outside its own key', () => {
    // `other-account:2026FA` as a term would land in another account's storage.
    expect(() => readWorkspaceBackup(file([{ kind: 'career', term: 'other:2026FA', value: EMPTY_CAREER }]))).toThrow(
      /could not have been saved under/,
    );
    expect(() => readWorkspaceBackup(file([{ kind: 'career', term: '', value: EMPTY_CAREER }]))).toThrow();
  });

  it('rejects a term on a workspace that has no term', () => {
    expect(() => readWorkspaceBackup(file([{ kind: 'pathway', term: TERM, value: EMPTY_PATHWAY }]))).toThrow(
      /carries a term it cannot have/,
    );
  });

  it('rejects the same workspace twice', () => {
    expect(() =>
      readWorkspaceBackup(
        file([
          { kind: 'career', term: TERM, value: EMPTY_CAREER },
          { kind: 'career', term: TERM, value: EMPTY_CAREER },
        ]),
      ),
    ).toThrow(/the same workspace twice/);
  });

  it('runs every value through its own reader', () => {
    expect(() => readWorkspaceBackup(file([{ kind: 'university', term: TERM, value: 'not a list' }]))).toThrow();
  });
});

describe('restoring', () => {
  it('writes into the restoring account, not the one it came from', () => {
    seed(storage, 'the-old-account');
    const backup = workspaceBackup('the-old-account', storage);
    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'the-new-account', fresh);
    expect(fresh.getItem(`semester.career.v1:the-new-account:${TERM}`)).toBeTruthy();
    expect(fresh.getItem(`semester.career.v1:the-old-account:${TERM}`)).toBeNull();
  });

  it('round-trips', () => {
    seed(storage);
    const backup = workspaceBackup(ACCOUNT, storage);
    const fresh = new FakeStorage();
    restoreWorkspaces(backup, ACCOUNT, fresh);
    expect(workspaceBackup(ACCOUNT, fresh).records).toHaveLength(SEEDED);
  });

  it('tells the screens, so an open one redraws', () => {
    const heard: string[] = [];
    const listener = (e: Event) => heard.push(String((e as CustomEvent).detail));
    window.addEventListener('semester-device-library', listener);
    seed(storage);
    restoreWorkspaces(workspaceBackup(ACCOUNT, storage), ACCOUNT, new FakeStorage());
    window.removeEventListener('semester-device-library', listener);
    expect(heard).toContain(`semester.family.v1:${ACCOUNT}`);
  });

  it('changes nothing when storage refuses partway', () => {
    seed(storage);
    const backup = workspaceBackup(ACCOUNT, storage);

    const target = new FakeStorage();
    target.setItem(`semester.athletics.v1:${ACCOUNT}:${TERM}`, MINE);
    target.setItem(`semester.family.v1:${ACCOUNT}`, MINE);
    target.refuseAt = `semester.pathway.v1:${ACCOUNT}`;

    expect(() => restoreWorkspaces(backup, ACCOUNT, target)).toThrow(/Nothing was changed/);
    // Both the key that existed and the keys that did not are as they were.
    expect(target.getItem(`semester.athletics.v1:${ACCOUNT}:${TERM}`)).toBe(MINE);
    expect(target.getItem(`semester.family.v1:${ACCOUNT}`)).toBe(MINE);
    expect(target.getItem(`semester.career.v1:${ACCOUNT}:${TERM}`)).toBeNull();
  });

  it('says so plainly when the rollback itself could not finish', () => {
    seed(storage);
    const backup = workspaceBackup(ACCOUNT, storage);
    const target = new FakeStorage();
    const refuse = vi.spyOn(target, 'setItem');
    let calls = 0;
    refuse.mockImplementation((k: string, v: string) => {
      // Two writes land, the third fails, and every rollback write fails too.
      if (++calls > 2) throw new Error('QuotaExceededError');
      FakeStorage.prototype.setItem.call(target, k, v);
    });
    target.refuseRestore = true;
    expect(() => restoreWorkspaces(backup, ACCOUNT, target)).toThrow(/could not be put back/);
  });

  it('writes nothing at all when the file is invalid', () => {
    const target = new FakeStorage();
    const bad = { format: 'semester.workspaces.v1', exported: '', records: [{ kind: 'career', term: TERM, value: EMPTY_CAREER }, { kind: 'nope', term: '', value: {} }] };
    expect(() => restoreWorkspaces(bad as unknown as WorkspaceBackup, ACCOUNT, target)).toThrow();
    expect(target.length).toBe(0);
  });
});

/*
 * The three learning stores, with something in them.
 *
 * The seed above uses each store's empty value, which proves a kind is taken
 * and says nothing about whether what a student wrote comes back. These are a
 * concept, a private question, a check answer and a filed comment, restored
 * onto a different account's device.
 */
describe('the learning stores', () => {
  const inbox = { version: 1, items: [{ id: 'f1', courseId: 'c1', work: 'Essay 1', origin: 'Marked paper', comment: 'Claims need support.', category: 'Evidence and citation', next: 'List claims first', filed: '2026-09-30' }] };
  const map = { version: 1, own: [{ id: 'o1', courseId: 'c1', name: 'Confounders', note: 'ask in office hours', label: 'Exploring', question: true }], checks: { c1: { at: '2026-09-30', useInPlan: true, answers: [{ conceptId: 'c1:unit:0', answer: 'unsure' }] } } };
  const prefs = { version: 1, session: 30, density: 'expanded', patterns: true };
  const put = (account: string) => {
    storage.setItem(`semester.feedback-inbox.v1:${account}:${TERM}`, JSON.stringify(inbox));
    storage.setItem(`semester.learning-map.v1:${account}:${TERM}`, JSON.stringify(map));
    storage.setItem(`semester.learning-prefs.v1:${account}`, JSON.stringify(prefs));
  };

  it('are taken, and come back whole on another account', () => {
    put(ACCOUNT);
    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((r) => r.kind).sort()).toEqual(['feedbackInbox', 'learningMap', 'learningPrefs']);
    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem(`semester.feedback-inbox.v1:acct-2:${TERM}`)!)).toEqual(inbox);
    expect(JSON.parse(fresh.getItem(`semester.learning-map.v1:acct-2:${TERM}`)!)).toEqual(map);
    expect(JSON.parse(fresh.getItem('semester.learning-prefs.v1:acct-2')!)).toEqual(prefs);
    expect(fresh.length).toBe(3);
  });

  it('refuse a file whose learning map carries a label nobody offers, and write nothing', () => {
    put(ACCOUNT);
    const backup = workspaceBackup(ACCOUNT, storage);
    const bad = JSON.parse(JSON.stringify(backup)) as WorkspaceBackup;
    const rec = bad.records.find((r) => r.kind === 'learningMap')!;
    (rec.value as typeof map).own[0].label = 'Weak at statistics';
    const fresh = new FakeStorage();
    expect(() => restoreWorkspaces(bad, 'acct-2', fresh)).toThrow();
    expect(fresh.length).toBe(0);
  });
});

describe('the Toolkit stores', () => {
  const toolkit = {
    hidden: ['researchStudio'],
    showLess: true,
    workspaces: [],
    research: [{
      id: 'research-1',
      question: 'What supports student persistence?',
      concepts: 'persistence',
      synonyms: 'retention',
      databases: 'ERIC',
      dateRange: '2020-2026',
      include: 'Higher education',
      exclude: 'Editorials',
      evidence: [],
      claims: [],
    }],
    declaration: { assignment: '', course: '', tool: '', version: '', dates: '', uses: [], purpose: '', inputTier: 'T2', interaction: '', outputUsed: '', sourcesChecked: '', verified: '', edits: '', limitations: '', attested: false },
  };
  const data = [{
    id: 'data-1',
    name: 'Survey extract',
    tier: 'T1',
    raw: 'score\n4',
    imported: '2026-10-11T12:00:00.000Z',
    dictionary: [{ name: 'score', type: 'number', unit: '', valid: '', source: '', missingRule: '', confirmed: true }],
    transforms: [],
    randomized: false,
    interpretation: { shows: '', method: '', uncertainty: '', conclude: '', cannotConclude: '' },
  }];

  it('backs up both account-scoped records and restores them only to the restoring account', () => {
    storage.setItem(`semester.toolkit.v1:${ACCOUNT}`, JSON.stringify(toolkit));
    storage.setItem(`semester.toolkit-data.v1:${ACCOUNT}`, JSON.stringify(data));
    storage.setItem('semester.toolkit.v1:someone-else', JSON.stringify({ ...toolkit, hidden: ['other-account'] }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((record) => record.kind).sort()).toEqual(['toolkit', 'toolkitData']);
    expect(JSON.stringify(backup)).not.toContain('other-account');

    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem('semester.toolkit.v1:acct-2')!)).toEqual(toolkit);
    expect(JSON.parse(fresh.getItem('semester.toolkit-data.v1:acct-2')!)).toEqual(data);
    expect(fresh.getItem(`semester.toolkit.v1:${ACCOUNT}`)).toBeNull();
  });

  it('validates Toolkit data before any restore write', () => {
    const bad = {
      format: 'semester.workspaces.v1',
      exported: '',
      records: [
        { kind: 'toolkit', term: '', value: toolkit },
        { kind: 'toolkitData', term: '', value: [{ ...data[0], raw: 42 }] },
      ],
    } as unknown as WorkspaceBackup;
    const fresh = new FakeStorage();
    expect(() => restoreWorkspaces(bad, 'acct-2', fresh)).toThrow();
    expect(fresh.length).toBe(0);
  });
});

describe('the Launchpad workspace', () => {
  const launchpad = {
    stage: 'first-term',
    types: ['first-year'],
    done: { deposit: '2026-08-01' },
    reflection: { working: 'I found a study group.' },
    mentorOptIn: true,
    interests: ['Study habits'],
  };

  it('backs up one account without putting private reflections in the file', () => {
    storage.setItem(`semester.launchpad.v1:${ACCOUNT}`, JSON.stringify(launchpad));
    storage.setItem('semester.launchpad.v1:someone-else', JSON.stringify({ ...launchpad, stage: 'admitted' }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((record) => record.kind)).toEqual(['launchpad']);
    const record = backup.records[0];
    expect(record).toBeDefined();
    expect(record!.value).toMatchObject({
      stage: 'first-term',
      done: { deposit: '2026-08-01' },
      mentorOptIn: true,
    });
    expect((record!.value as typeof launchpad).reflection).toEqual({});
    expect(JSON.stringify(backup)).not.toContain('I found a study group.');
    expect(JSON.stringify(backup)).not.toContain('someone-else');
  });

  it('restores progress to the restoring account and keeps that device\'s reflections', () => {
    storage.setItem(`semester.launchpad.v1:${ACCOUNT}`, JSON.stringify(launchpad));
    const backup = workspaceBackup(ACCOUNT, storage);
    const fresh = new FakeStorage();
    fresh.setItem('semester.launchpad.v1:acct-2', JSON.stringify({
      ...launchpad,
      stage: 'admitted',
      done: {},
      reflection: { working: 'Keep this private answer.' },
      mentorOptIn: false,
    }));

    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem('semester.launchpad.v1:acct-2')!)).toMatchObject({
      stage: 'first-term',
      done: { deposit: '2026-08-01' },
      reflection: { working: 'Keep this private answer.' },
      mentorOptIn: true,
    });
    expect(fresh.getItem(`semester.launchpad.v1:${ACCOUNT}`)).toBeNull();
  });
});

describe('the Opportunities workspace', () => {
  const opportunity = {
    id: 'op-1',
    kind: 'job',
    title: 'Library assistant',
    org: 'Main Library',
    stage: 'Preparing',
    deadline: '2026-10-20',
    source: 'https://example.edu/jobs/1',
    steps: { find: true },
    notes: 'Ask about evening shifts.',
    hoursPerWeek: 8,
    workStudy: true,
    evidence: [{ id: 'ev-1', text: 'Helped students find archival sources', approved: true }],
    references: [],
    skills: ['Research'],
  };
  const workspace = {
    items: [opportunity],
    budget: { classes: 15, study: 30, work: 8, commute: 2, caregiving: 0, sleep: 56, other: 10 },
  };

  it('backs up one account without exporting the private work-study choice', () => {
    storage.setItem(`semester.opportunities.v1:${ACCOUNT}`, JSON.stringify(workspace));
    storage.setItem('semester.opportunities.v1:someone-else', JSON.stringify({
      ...workspace,
      items: [{ ...opportunity, id: 'other-account-opportunity', title: 'Private other account item' }],
    }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((record) => record.kind)).toEqual(['opportunities']);
    expect(backup.records[0]?.value).toMatchObject({
      items: [{ id: 'op-1', title: 'Library assistant', notes: 'Ask about evening shifts.' }],
      budget: { work: 8 },
    });
    expect(JSON.stringify(backup)).not.toContain('workStudy');
    expect(JSON.stringify(backup)).not.toContain('other-account-opportunity');
    expect(JSON.stringify(backup)).not.toContain('Private other account item');
  });

  it('restores portable work to the restoring account and keeps that device\'s work-study choice', () => {
    storage.setItem(`semester.opportunities.v1:${ACCOUNT}`, JSON.stringify(workspace));
    const backup = workspaceBackup(ACCOUNT, storage);
    const fresh = new FakeStorage();
    fresh.setItem('semester.opportunities.v1:acct-2', JSON.stringify({
      ...workspace,
      items: [{ ...opportunity, title: 'Older device title', workStudy: true }],
    }));

    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem('semester.opportunities.v1:acct-2')!)).toMatchObject({
      items: [{ id: 'op-1', title: 'Library assistant', workStudy: true }],
      budget: { work: 8 },
    });
    expect(fresh.getItem(`semester.opportunities.v1:${ACCOUNT}`)).toBeNull();

    const newDevice = new FakeStorage();
    restoreWorkspaces(backup, 'acct-3', newDevice);
    expect(JSON.parse(newDevice.getItem('semester.opportunities.v1:acct-3')!).items[0].workStudy).toBe(false);
  });
});

describe('the Hub preferences', () => {
  const preferences = {
    muted: ['semester'],
    quietFrom: 21 * 60,
    quietTo: 8 * 60,
    digest: 'daily',
    read: ['course:old-deadline'],
    saved: ['official:old-notice'],
    followUp: ['opportunity:old-item'],
  };

  it('backs up one account without exporting device-specific message markers', () => {
    storage.setItem(`semester.hub.v1:${ACCOUNT}`, JSON.stringify(preferences));
    storage.setItem('semester.hub.v1:someone-else', JSON.stringify({
      ...preferences,
      digest: 'weekly',
      saved: ['official:other-account'],
    }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((record) => record.kind)).toEqual(['hubPreferences']);
    expect(backup.records[0]?.value).toEqual({
      muted: ['semester'],
      quietFrom: 21 * 60,
      quietTo: 8 * 60,
      digest: 'daily',
      read: [],
      saved: [],
      followUp: [],
    });
    expect(JSON.stringify(backup)).not.toContain('old-deadline');
    expect(JSON.stringify(backup)).not.toContain('old-notice');
    expect(JSON.stringify(backup)).not.toContain('old-item');
    expect(JSON.stringify(backup)).not.toContain('other-account');
  });

  it('restores portable settings to the restoring account and keeps that device\'s markers', () => {
    storage.setItem(`semester.hub.v1:${ACCOUNT}`, JSON.stringify(preferences));
    const backup = workspaceBackup(ACCOUNT, storage);
    const fresh = new FakeStorage();
    fresh.setItem('semester.hub.v1:acct-2', JSON.stringify({
      ...preferences,
      muted: ['course'],
      digest: 'weekly',
      read: ['course:current-deadline'],
      saved: ['official:current-notice'],
      followUp: ['opportunity:current-item'],
    }));

    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem('semester.hub.v1:acct-2')!)).toEqual({
      muted: ['semester'],
      quietFrom: 21 * 60,
      quietTo: 8 * 60,
      digest: 'daily',
      read: ['course:current-deadline'],
      saved: ['official:current-notice'],
      followUp: ['opportunity:current-item'],
    });
    expect(fresh.getItem(`semester.hub.v1:${ACCOUNT}`)).toBeNull();

    const newDevice = new FakeStorage();
    restoreWorkspaces(backup, 'acct-3', newDevice);
    expect(JSON.parse(newDevice.getItem('semester.hub.v1:acct-3')!)).toMatchObject({
      digest: 'daily',
      read: [],
      saved: [],
      followUp: [],
    });
  });
});

describe('the Support workspace', () => {
  const support = {
    contacts: [{ id: 'contact-1', name: 'Aunt Maya', phone: '615-555-0142' }],
    accessNotes: 'Ask about a quiet testing room.',
    routines: ['A regular bedtime on weeknights'],
    continuity: { sources: true, backup: true },
    commute: { travel: 25, buffer: 12 },
  };

  it('backs up one account without exporting emergency contacts or access notes', () => {
    storage.setItem(`semester.support.v1:${ACCOUNT}`, JSON.stringify(support));
    storage.setItem('semester.support.v1:someone-else', JSON.stringify({
      ...support,
      contacts: [{ id: 'other-contact', name: 'Other account contact', phone: '555-0100' }],
    }));

    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((record) => record.kind)).toEqual(['support']);
    expect(backup.records[0]?.value).toEqual({
      contacts: [],
      accessNotes: '',
      routines: ['A regular bedtime on weeknights'],
      continuity: { sources: true, backup: true },
      commute: { travel: 25, buffer: 12 },
    });
    expect(JSON.stringify(backup)).not.toContain('Aunt Maya');
    expect(JSON.stringify(backup)).not.toContain('quiet testing room');
    expect(JSON.stringify(backup)).not.toContain('Other account contact');
  });

  it('restores portable planning to the restoring account and keeps private device details', () => {
    storage.setItem(`semester.support.v1:${ACCOUNT}`, JSON.stringify(support));
    const backup = workspaceBackup(ACCOUNT, storage);
    const fresh = new FakeStorage();
    fresh.setItem('semester.support.v1:acct-2', JSON.stringify({
      ...support,
      contacts: [{ id: 'current-contact', name: 'Keep this contact', phone: '555-0199' }],
      accessNotes: 'Keep this private note.',
      routines: [],
      continuity: {},
      commute: { travel: 5, buffer: 5 },
    }));

    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem('semester.support.v1:acct-2')!)).toEqual({
      contacts: [{ id: 'current-contact', name: 'Keep this contact', phone: '555-0199' }],
      accessNotes: 'Keep this private note.',
      routines: ['A regular bedtime on weeknights'],
      continuity: { sources: true, backup: true },
      commute: { travel: 25, buffer: 12 },
    });
    expect(fresh.getItem(`semester.support.v1:${ACCOUNT}`)).toBeNull();

    const newDevice = new FakeStorage();
    restoreWorkspaces(backup, 'acct-3', newDevice);
    expect(JSON.parse(newDevice.getItem('semester.support.v1:acct-3')!)).toMatchObject({
      contacts: [],
      accessNotes: '',
      routines: ['A regular bedtime on weeknights'],
    });
  });
});

/*
 * The study journal, with an entry in it.
 *
 * It holds what a student got wrong, in their own words, so it is backed up
 * like the other stores that hold their writing, and held to the same rule: a
 * file with an entry the reader cannot accept is refused whole.
 */
describe('the study journal', () => {
  const journal = {
    version: 1,
    entries: [{ id: 'j1', courseId: 'c1', topic: 'Confounders', attempt: 'I said correlation proves cause.', correction: 'It does not; a third variable can drive both.', kind: 'Concept', source: 'Week 4, slide 12', review: '2026-10-07', resolved: false }],
  };
  const put = (account: string) => storage.setItem(`semester.study-journal.v1:${account}:${TERM}`, JSON.stringify(journal));

  it('is taken, and comes back whole on another account', () => {
    put(ACCOUNT);
    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.records.map((r) => r.kind)).toEqual(['studyJournal']);
    const fresh = new FakeStorage();
    restoreWorkspaces(backup, 'acct-2', fresh);
    expect(JSON.parse(fresh.getItem(`semester.study-journal.v1:acct-2:${TERM}`)!)).toEqual(journal);
    expect(fresh.length).toBe(1);
  });

  it('refuses a file whose entry is unreadable, and writes nothing', () => {
    put(ACCOUNT);
    const bad = JSON.parse(JSON.stringify(workspaceBackup(ACCOUNT, storage))) as WorkspaceBackup;
    (bad.records[0].value as typeof journal).entries[0].resolved = 'yes' as unknown as boolean;
    const fresh = new FakeStorage();
    expect(() => restoreWorkspaces(bad, 'acct-2', fresh)).toThrow();
    expect(fresh.length).toBe(0);
  });
});
