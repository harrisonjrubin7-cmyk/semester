import { describe, expect, it } from 'vitest';
import { audit, bibtex, blankEvidence, causalWording, cautions, edit, readProjects, reference, ris, screen, searchString, verify, type Evidence } from './research';

const study = (patch: Partial<Evidence> = {}): Evidence => ({
  ...blankEvidence('e1'),
  kind: 'peer-reviewed',
  authors: 'Okano, K.; Kaczmarzyk, J.',
  year: '2019',
  title: 'Sleep quality, duration and consistency are associated with better academic performance',
  venue: 'npj Science of Learning',
  design: 'cohort',
  n: 88,
  quote: 'better sleep quality',
  excerpt: 'Students with Better  sleep quality had higher scores.',
  originalOpened: true,
  ...patch,
});

describe('evidence verification', () => {
  it('verifies an entry that meets every condition', () => {
    expect(verify(study()).ok).toBe(true);
  });

  it('refuses without the original having been opened', () => {
    const r = verify(study({ originalOpened: false }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reasons.join()).toMatch(/original/);
  });

  it('never verifies an AI summary', () => {
    expect(verify(study({ kind: 'ai-summary' })).ok).toBe(false);
  });

  it('refuses a quotation the pasted excerpt does not contain', () => {
    const r = verify(study({ quote: 'sleep causes higher scores' }));
    expect(!r.ok && r.reasons.join()).toMatch(/does not appear/);
  });

  it('refuses a quotation with no excerpt and no page', () => {
    expect(verify(study({ excerpt: '', page: '' })).ok).toBe(false);
    expect(verify(study({ excerpt: '', page: 'p. 4' })).ok).toBe(true);
  });

  it('refuses a citation with missing authors, year or title', () => {
    expect(verify(study({ authors: '' })).ok).toBe(false);
    expect(verify(study({ year: '19' })).ok).toBe(false);
    expect(verify(study({ title: ' ' })).ok).toBe(false);
  });

  it('clears verification when a field it rests on is edited', () => {
    const r = verify(study());
    const v = r.ok ? r.evidence : study();
    expect(v.verified).toBe(true);
    expect(edit(v, { quote: 'something else entirely' }).verified).toBe(false);
    expect(edit(v, { relevance: 'central to claim 2' }).verified).toBe(true);
  });

  it('cannot be set verified by patch when the fields do not earn it', () => {
    expect(edit(study({ originalOpened: false }), { verified: true }).verified).toBe(false);
  });

  it('re-checks verification when reading stored data, so a hand-edited file cannot carry it', () => {
    const stored = [{ id: 'p', question: '', evidence: [{ ...study({ originalOpened: false }), verified: true }], claims: [] }];
    expect(readProjects(stored)[0].evidence[0].verified).toBe(false);
  });

  it('needs a reason to exclude in screening', () => {
    expect(screen(study(), 'exclude', '').ok).toBe(false);
    expect(screen(study(), 'exclude', 'Wrong population').ok).toBe(true);
  });

  it('warns about preprints, small samples and declared conflicts', () => {
    const c = cautions(study({ kind: 'preprint', n: 12, conflicts: 'Funded by a mattress company' }));
    expect(c.join(' ')).toMatch(/Preprint/);
    expect(c.join(' ')).toMatch(/n = 12/);
    expect(c.join(' ')).toMatch(/Conflict/);
    expect(cautions(study({ conflicts: 'None declared' })).join(' ')).not.toMatch(/Conflict/);
    // A design nobody has chosen yet is not called observational — but see the audit below.
    expect(cautions(study({ design: 'other' })).join(' ')).not.toMatch(/Observational/);
  });
});

describe('claim audit', () => {
  const verified = (patch: Partial<Evidence> = {}) => {
    const r = verify(study(patch));
    if (!r.ok) throw new Error(r.reasons.join());
    return r.evidence;
  };

  it('says insufficient evidence for a claim with nothing linked, rather than passing it', () => {
    expect(audit({ id: 'c', text: 'x', evidence: [] }, []).status).toBe('insufficient-evidence');
  });

  it('says not verified when the linked source is not', () => {
    expect(audit({ id: 'c', text: 'x', evidence: ['e1'] }, [study()]).status).toBe('unverified');
  });

  it('flags causal wording resting only on observational studies', () => {
    const a = audit({ id: 'c', text: 'Short sleep causes lower exam scores.', evidence: ['e1'] }, [verified()]);
    expect(a.status).toBe('overclaim');
  });

  it('does not let an unstated design carry a causal claim', () => {
    expect(audit({ id: 'c', text: 'Short sleep causes lower exam scores.', evidence: ['e1'] }, [verified({ design: 'other' })]).status).toBe('overclaim');
  });

  it('passes the same claim worded as association, or backed by a randomized study', () => {
    expect(audit({ id: 'c', text: 'Short sleep is associated with lower exam scores.', evidence: ['e1'] }, [verified()]).status).toBe('verified');
    expect(audit({ id: 'c', text: 'Short sleep causes lower exam scores.', evidence: ['e1'] }, [verified({ design: 'randomized' })]).status).toBe('verified');
  });

  it('still reads “the effects of X on Y” as causal, within a sentence', () => {
    expect(causalWording('The effects of sleep on recall were large')).toBe(true);
    expect(causalWording('Effects of sleep were studied. On recall, scores rose modestly')).toBe(false);
  });

  it('reads hedged wording as hedged even with a causal verb inside it', () => {
    expect(causalWording('Sleep is associated with increases in recall')).toBe(false);
    expect(causalWording('Sleep increases recall')).toBe(true);
  });

  it('ignores excluded sources when auditing', () => {
    expect(audit({ id: 'c', text: 'x', evidence: ['e1'] }, [{ ...verified(), screening: 'exclude' }]).status).toBe('insufficient-evidence');
  });
});

describe('citation export', () => {
  it('marks a missing field instead of inventing one', () => {
    const ref = reference(study({ year: '' }), 'apa');
    expect(ref).toContain('[year missing]');
    expect(ref).not.toMatch(/\(\d{4}\)/);
  });

  it('never exports an AI summary as a reference', () => {
    expect(ris([study({ kind: 'ai-summary' })])).toBe('');
    expect(bibtex([study({ kind: 'ai-summary' })])).toBe('');
  });

  it('marks unverified entries in the exported file', () => {
    expect(ris([study()])).toMatch(/Not yet verified/);
    expect(bibtex([study()])).toMatch(/Not yet verified/);
  });

  it('writes one RIS author line per author', () => {
    expect(ris([study()]).match(/^AU {2}- /gm)?.length).toBe(2);
  });

  it('builds a Boolean string from concepts and synonyms', () => {
    expect(searchString('sleep duration\nmemory', 'sleep length, sleep time\nrecall')).toBe('("sleep duration" OR "sleep length" OR "sleep time") AND (memory OR recall)');
  });

  it('cannot smuggle a second reference into RIS through a line break', () => {
    const out = ris([study({ title: 'Real title\nER  - \n\nTY  - JOUR\nTI  - Invented', verified: false })]);
    expect(out.match(/^ER {2}- /gm)?.length).toBe(1);
    expect(out.match(/^TY {2}- /gm)?.length).toBe(1);
  });
});
