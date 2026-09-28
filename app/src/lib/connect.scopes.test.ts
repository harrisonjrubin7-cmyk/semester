import { describe, expect, it } from 'vitest';
import { MAIL_READABLE, PROVIDERS, WRITABLE, type ProviderId } from './connect';

/**
 * The Connect screen tells a student what each account lets Semester read and
 * write. Those lines are prose, and the scope strings are what the provider
 * actually grants, so the two are held together here: every scope has to be
 * accounted for by a line, and every line has to be backed by a scope.
 */

/** Scopes that establish who you are and grant no content. */
const IDENTITY = new Set(['openid', 'profile', 'offline_access', 'User.Read', 'user:read']);

/** Each content scope, the word its disclosure must contain, and whether it writes. */
const RULES: { scope: RegExp; word: RegExp; writes: boolean }[] = [
  { scope: /^Calendars\.ReadWrite$/, word: /calendar/i, writes: true },
  { scope: /calendar\.events\.owned$/, word: /calendar/i, writes: true },
  { scope: /^Mail\.Read$/, word: /mail/i, writes: false },
  { scope: /gmail\.readonly$/, word: /mail/i, writes: false },
  { scope: /^Tasks\.ReadWrite$/, word: /to do/i, writes: true },
  { scope: /\/auth\/tasks$/, word: /checklist/i, writes: true },
  { scope: /^Files\.ReadWrite$/, word: /onedrive/i, writes: true },
  { scope: /drive\.readonly$/, word: /drive/i, writes: false },
  { scope: /drive\.file$/, word: /drive/i, writes: true },
  { scope: /^meeting:read$/, word: /meetings/i, writes: false },
  { scope: /^recording:read$/, word: /recordings/i, writes: false },
];

const IDS = Object.keys(PROVIDERS) as ProviderId[];

describe('what each account says it reads and writes', () => {
  it.each(IDS)('%s: every content scope has a line saying so', (id) => {
    const spec = PROVIDERS[id];
    for (const scope of spec.scopes.split(/\s+/).filter(Boolean)) {
      if (IDENTITY.has(scope)) continue;
      const rule = RULES.find((r) => r.scope.test(scope));
      expect(rule, `${id}: no disclosure rule for scope ${scope}`).toBeDefined();
      if (!rule) continue;
      expect(spec.reads.some((l) => rule.word.test(l)), `${id} reads nothing matching ${rule.word} for ${scope}`).toBe(true);
      if (rule.writes) {
        expect(spec.writes.some((l) => rule.word.test(l)), `${id} writes nothing matching ${rule.word} for ${scope}`).toBe(true);
      }
    }
  });

  it.each(IDS)('%s: every write it claims is backed by a writing scope', (id) => {
    const spec = PROVIDERS[id];
    const granted = spec.scopes.split(/\s+/).filter(Boolean);
    for (const line of spec.writes) {
      const backed = RULES.some((r) => r.writes && r.word.test(line) && granted.some((s) => r.scope.test(s)));
      expect(backed, `${id}: "${line}" has no writing scope behind it`).toBe(true);
    }
  });

  it('only the accounts Semester writes calendars and tasks to say they write', () => {
    const saysWrites = IDS.filter((id) => PROVIDERS[id].writes.length > 0);
    expect(saysWrites.sort()).toEqual([...WRITABLE].sort());
  });

  it('only the accounts whose mail Semester reads say they read mail', () => {
    const saysMail = IDS.filter((id) => PROVIDERS[id].reads.some((l) => /mail/i.test(l)));
    expect(saysMail.sort()).toEqual([...MAIL_READABLE].sort());
  });

  it('an account with no content scope says it reads only who you are', () => {
    for (const id of IDS) {
      const content = PROVIDERS[id].scopes.split(/\s+/).filter((s) => s && !IDENTITY.has(s));
      if (content.length === 0) {
        expect(PROVIDERS[id].writes).toEqual([]);
        expect(PROVIDERS[id].reads.join(' ')).toMatch(/who you are/i);
      }
    }
  });
});
