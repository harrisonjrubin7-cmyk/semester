// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_ATHLETICS } from './athletics';
import { EMPTY_CAREER } from './career';
import { EMPTY_CREATIONS } from './creations';
import { EMPTY_FAMILY } from './family';
import { EMPTY_PATHWAY } from './pathway';
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
};

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
});

describe('what goes into a workspace backup', () => {
  it('takes all six workspaces', () => {
    seed(storage);
    const backup = workspaceBackup(ACCOUNT, storage);
    expect(backup.format).toBe('semester.workspaces.v1');
    expect(backup.records.map((r) => r.kind).sort()).toEqual([
      'athletics',
      'career',
      'creations',
      'family',
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
    expect(backup.records).toHaveLength(6);
    expect(JSON.stringify(backup)).not.toContain('someone-else');
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
    expect(workspaceBackup(ACCOUNT, storage).records).toHaveLength(6);
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
    expect(workspaceBackup(ACCOUNT, fresh).records).toHaveLength(6);
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
