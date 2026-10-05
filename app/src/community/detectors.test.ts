import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composerPrompts, detect, DETECTOR_RULES, DETECTOR_VERSION } from './detectors';

const ids = (text: string, opts = {}) => detect(text, opts).map((h) => h.rule.id);

/** The seed rows out of the migration, translated only from `\y` to `\b`. */
function seeded() {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260928032000_community.sql', import.meta.url), 'utf8');
  const start = sql.indexOf('insert into public.community_detector_rules');
  const seed = sql.slice(start, sql.indexOf('on conflict (id) do nothing;', start));
  const rows = [...seed.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '(P\d)', ([\d.]+),\s*'((?:[^']|'')*)'\)/g)];
  const version = /version\s+text\s+not null default '([^']+)'/.exec(sql)?.[1];
  return {
    version,
    rules: rows.map((m) => ({
      id: m[1],
      detector: m[2],
      category: m[3],
      severity: m[4],
      confidence: Number(m[5]),
      pattern: m[6].replaceAll("''", "'").replaceAll('\\y', '\\b'),
    })),
  };
}

describe('the device copy and the database copy', () => {
  it('reads the seed at all (the control on the parser)', () => {
    expect(seeded().rules.length).toBeGreaterThanOrEqual(10);
  });

  it('are the same rules, numbers and patterns', () => {
    expect(DETECTOR_RULES.map((r) => ({ ...r }))).toEqual(seeded().rules);
  });

  it('carry the same version', () => {
    expect(seeded().version).toBe(DETECTOR_VERSION);
  });

  it('every pattern compiles here, case-insensitively', () => {
    for (const r of DETECTOR_RULES) expect(() => new RegExp(r.pattern, 'i')).not.toThrow();
  });
});

describe('what each detector finds', () => {
  it.each([
    ['Her room number is 214 in Branscomb', 'pii.third-party-contact'],
    ['his phone number is on the flyer', 'pii.third-party-contact'],
    ['she lives in Branscomb Hall', 'pii.lives-at'],
    ['His schedule is posted on his door', 'pii.third-party-schedule'],
    ['I’m going to hurt somebody after class', 'threat.harm'],
    ['we will kill them', 'threat.harm'],
    ['bringing a gun to campus tomorrow', 'threat.weapon-campus'],
    ['you deserve to die', 'threat.wish-death'],
    ['honestly I want to die', 'crisis.self-harm'],
    ['those people are vermin', 'hate.dehumanizing'],
    ['go back to your own country', 'hate.go-back'],
    ['cheap tickets bit.ly/x1', 'scam.shortened-link'],
    ['send gift cards first', 'scam.payment'],
    ['Verify your student portal here', 'scam.credentials'],
    ['anyone have the answer key?', 'integrity.answers'],
    ['answers to the midterm pls', 'integrity.answers'],
    ['I will pay someone to write it', 'integrity.do-it-for-me'],
    ['This is the registrar: deadlines moved', 'impersonation.official'],
  ])('%s → %s', (text, rule) => {
    expect(ids(text)).toContain(rule);
  });

  it('leaves ordinary campus talk alone (controls)', () => {
    for (const text of [
      'Problem 3 on page 214 is hard, anyone free tonight?',
      'The lecture on animal cells was great — animals are fascinating.',
      'My country’s trade policy is the topic of my essay.',
      'I will kill it on this exam, studied all week',
      'The midterm covers chapters 9 to 11.',
      'Office hours are in room 214 on Thursday.',
      'The registrar’s website lists the drop deadline.',
      'Link to the syllabus: https://example.edu/econ1010',
    ]) {
      expect(ids(text), text).toEqual([]);
    }
  });

  it('does not ask a verified post whether it is impersonating', () => {
    expect(ids('This is the registrar: deadlines moved', { verified: true })).toEqual([]);
  });

  it('stamps every hit with the version', () => {
    expect(detect('you deserve to die')[0].version).toBe(DETECTOR_VERSION);
  });
});

describe('what the composer says before a post', () => {
  it('names the course policy for an integrity hit', () => {
    const [p] = composerPrompts('who has the answer key', 'No sharing graded answers.');
    expect(p).toMatchObject({ kind: 'integrity' });
    expect(p.message).toContain('No sharing graded answers.');
  });

  it('offers support, and never blocks, for crisis language', () => {
    const prompts = composerPrompts('I want to die');
    expect(prompts).toEqual([expect.objectContaining({ kind: 'support' })]);
    expect(prompts[0].message).toContain('Your post has gone up as usual');
  });

  it('says nothing about threat, hate or scam hits — the server still records them', () => {
    expect(composerPrompts('you deserve to die')).toEqual([]);
    expect(composerPrompts('those people are vermin')).toEqual([]);
    expect(composerPrompts('verify your account at bit.ly/x')).toEqual([]);
  });
});
