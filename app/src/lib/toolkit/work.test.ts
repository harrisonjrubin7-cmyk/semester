import { describe, expect, it } from 'vitest';
import { addTransform, altText, clean, describeColumn, importCsv, interpretationGaps, methodsFor, methodsWriteUp, readDataProjects, type DataProject } from './data';
import { declarationGaps, declarationText, blankDeclaration } from './disclosure';
import { audit, bibtex, blankEvidence, causalWording, cautions, edit, readProjects, reference, ris, screen, searchString, verify, type Evidence } from './research';
import { DISCLAIMER, interpret } from './rubric';
import { completeStage, newWorkspace, progress, readWorkspaces, submissionChecklist, TEMPLATE_IDS, TEMPLATES } from './templates';

/**
 * The work the toolkit structures: assignment stages, research evidence,
 * datasets, rubrics and declarations. The guards here are the ones a student
 * could otherwise talk past — marking a stage done without doing it, calling
 * evidence verified without opening it, concluding cause from a survey.
 */

const now = new Date('2026-09-27T12:00:00Z');

describe('assignment workspaces', () => {
  it('ships every template the brief names, each with stages', () => {
    for (const id of ['problem_set', 'essay', 'lab_report', 'research_paper', 'coding_project', 'design_project', 'case_analysis', 'presentation', 'group_project', 'exam_preparation', 'policy_memo', 'annotated_bibliography', 'technical_report'])
      expect(TEMPLATE_IDS).toContain(id);
    for (const id of TEMPLATE_IDS) expect(TEMPLATES[id].stages.length).toBeGreaterThan(3);
  });

  it('keeps stages in the brief’s order', () => {
    expect(TEMPLATES.research_paper.stages.map((s) => s.id)).toEqual(['question', 'search', 'screening', 'matrix', 'bibliography', 'outline', 'draft', 'audit']);
  });

  it('refuses to mark a stage done until the student has written their own note for it', () => {
    const ws = newWorkspace('w1', 'essay', 'Essay 1', 'ENGL 1100', now);
    const refused = completeStage(ws, 'claim');
    expect(refused.ok).toBe(false);
    const withNote = { ...ws, notes: { claim: 'Remote work lowers commuting emissions.' } };
    const done = completeStage(withNote, 'claim');
    expect(done.ok && done.workspace.done).toEqual(['claim']);
  });

  it('reports the next stage and progress', () => {
    const ws = { ...newWorkspace('w1', 'problem_set', '', '', now), done: ['concepts'] };
    expect(progress(ws)).toMatchObject({ done: 1, total: 6 });
    expect(progress(ws).next?.id).toBe('example');
  });

  it('is private and stays private through a round trip', () => {
    const ws = newWorkspace('w1', 'essay', '', '', now);
    expect(ws.visibility).toBe('private');
    const tampered = JSON.parse(JSON.stringify([{ ...ws, visibility: 'public' }]));
    expect(readWorkspaces(tampered)[0].visibility).toBe('private');
  });

  it('asks for a declaration only when the policy needs one', () => {
    expect(submissionChecklist({ disclosureNeeded: false, hasRubric: true, hasSources: false }).join()).not.toMatch(/declaration/);
    expect(submissionChecklist({ disclosureNeeded: true, hasRubric: true, hasSources: false }).join()).toMatch(/declaration/);
  });
});

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
});

const CSV = 'id,group,score\n1,a,10\n2,a,12\n3,b,\n3,b,\n4,b,9\n';

const project = (): DataProject => {
  const r = importCsv('d1', 'Survey', CSV, 'T2', now);
  if (!r.ok) throw new Error(r.reason);
  return r.project;
};

describe('data studio', () => {
  it('refuses to import regulated or restricted data, and unclassified data', () => {
    expect(importCsv('d', 'x', CSV, 'T4', now).ok).toBe(false);
    expect(importCsv('d', 'x', CSV, 'T5', now).ok).toBe(false);
    expect(importCsv('d', 'x', CSV, undefined, now).ok).toBe(false);
  });

  it('suggests a dictionary but leaves it unconfirmed', () => {
    const p = project();
    expect(p.dictionary.find((c) => c.name === 'score')?.type).toBe('number');
    expect(p.dictionary.every((c) => !c.confirmed)).toBe(true);
  });

  it('never changes the raw data; cleaning is the log replayed', () => {
    let p = project();
    const add = (t: Parameters<typeof addTransform>[1]) => {
      const r = addTransform(p, t);
      if (!r.ok) throw new Error(r.reason);
      p = r.project;
    };
    add({ id: 't1', kind: 'drop-duplicates', column: '', from: '', to: '', note: 'Row 3 was exported twice.' });
    add({ id: 't2', kind: 'drop-missing', column: 'score', from: '', to: '', note: 'No score recorded.' });
    expect(p.raw).toBe(CSV);
    expect(clean(p).rows.length).toBe(3);
    expect(clean({ ...p, transforms: p.transforms.slice(0, 1) }).rows.length).toBe(4);
    expect(methodsWriteUp(p)).toContain('5 rows as imported; 3 after cleaning');
  });

  it('refuses a cleaning step with no reason', () => {
    expect(addTransform(project(), { id: 't', kind: 'drop-missing', column: 'score', from: '', to: '', note: ' ' }).ok).toBe(false);
  });

  it('writes alt text from the computed numbers', () => {
    const d = describeColumn(clean(project()), 'score')!;
    expect(altText(d)).toMatch(/3 values \(2 missing\)/);
    expect(altText(d)).toMatch(/median/);
  });

  it('always offers more than one method, each with its assumptions', () => {
    for (const outcome of ['number', 'category'] as const)
      for (const comparison of ['one-group', 'two-groups', 'three-plus-groups', 'relationship'] as const)
        for (const paired of [false, true]) {
          const m = methodsFor(outcome, comparison, paired);
          expect(m.length).toBeGreaterThan(1);
          for (const x of m) expect(x.assumptions.length).toBeGreaterThan(0);
        }
  });

  it('will not accept an interpretation without uncertainty and limits', () => {
    const p = project();
    const gaps = interpretationGaps({ ...p, interpretation: { shows: 'a', method: 'b', uncertainty: '', conclude: 'c', cannotConclude: '' } });
    expect(gaps.join(' ')).toMatch(/uncertainty/);
    expect(gaps.join(' ')).toMatch(/cannot show/);
  });

  it('flags a causal conclusion from non-randomized data', () => {
    const p = { ...project(), interpretation: { shows: 'a', method: 'b', uncertainty: 'c', conclude: 'Group b causes lower scores', cannotConclude: 'd' } };
    expect(interpretationGaps(p).join(' ')).toMatch(/causal/);
    expect(interpretationGaps({ ...p, randomized: true }).join(' ')).not.toMatch(/causal/);
  });

  it('refuses stored data claiming a regulated tier', () => {
    expect(() => readDataProjects([{ ...project(), tier: 'T4' }])).toThrow();
  });
});

describe('rubric interpreter', () => {
  const RUBRIC = `Evidence and Analysis — 30 points
Makes a clear claim. Supports it with relevant, credible evidence. Explains how each source supports the claim.
Addresses a limitation or counterargument.
Organization (10 pts)
Paragraphs follow a logical order.`;

  it('splits criteria and keeps the rubric’s own words as the checks', () => {
    const c = interpret(RUBRIC);
    expect(c.map((x) => x.name)).toEqual(['Evidence and Analysis', 'Organization']);
    expect(c[0].points).toBe(30);
    expect(c[0].checks).toContain('Makes a clear claim');
    expect(c[0].checks).toContain('Addresses a limitation or counterargument');
  });

  it('predicts nothing: no output mentions a score, grade or points earned', () => {
    const text = JSON.stringify(interpret(RUBRIC));
    expect(text).not.toMatch(/earn|predict|likely grade|you will get|score of/i);
    expect(DISCLAIMER).toMatch(/not a grade prediction/);
    expect(DISCLAIMER).toMatch(/not feedback from your instructor/);
  });
});

describe('AI-use declaration', () => {
  it('lists what is missing, including the attestation', () => {
    const gaps = declarationGaps(blankDeclaration());
    expect(gaps.join(' ')).toMatch(/tool/);
    expect(gaps.join(' ')).toMatch(/attestation/);
  });

  it('names the kind of material, never its contents', () => {
    const d = { ...blankDeclaration('Essay 1', 'ENGL 1100'), tool: 'Claude', dates: 'Sep 20', uses: ['outline-feedback' as const], outputUsed: 'Outline only', sourcesChecked: 'All four readings', attested: true, inputTier: 'T2' as const };
    expect(declarationGaps(d)).toEqual([]);
    const text = declarationText(d);
    expect(text).toContain('Your own academic work');
    expect(text).toContain('Outline feedback');
    expect(text).toMatch(/Attestation: I am responsible/);
  });
});
