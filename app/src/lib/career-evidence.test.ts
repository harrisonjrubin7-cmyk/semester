import { describe, expect, it } from 'vitest';
import type { Application } from './apply';
import { EMPTY_CAREER, type CareerExperience, type CareerLibrary } from './career';
import {
  EMPTY_EVIDENCE,
  addOwnSkill,
  composeBullet,
  confirmedSkills,
  decide,
  interviewCards,
  missingPrompts,
  pitchDraft,
  readEvidence,
  renderResume,
  reviewedSkills,
  saveArtifact,
  saveBullet,
  saveEmployer,
  saveVersion,
  type Evidence,
} from './career-evidence';
import type { SkillClaim } from './skills-graph';

/**
 * Phase I's model, held to one rule above the rest: nothing reaches a résumé
 * that the student did not confirm or write — no skill they did not accept,
 * no number they did not give, no entry they did not make.
 */

const claim = (skill: string): SkillClaim => ({
  id: `skill-${skill.toLowerCase()}`,
  skill,
  level: 'emerging',
  verification: 'suggested',
  freshness: 'current',
  evidence: [{ sourceId: 'econ', sourceType: 'course', label: 'ECON 1010 · Principles' }],
});
const CLAIMS = [claim('Data analysis'), claim('Writing'), claim('Research')];
const exp = (id: string, category: CareerExperience['category'], title: string, organization = ''): CareerExperience => ({ id, category, title, organization, dates: '2025–26', details: `${title} details` });
const EXPERIENCES = [exp('e1', 'Experience', 'Research assistant', 'Econ lab'), exp('p1', 'Project', 'Transit study'), exp('l1', 'Leadership', 'Club treasurer', 'Finance club')];
const CAREER: CareerLibrary = { ...EMPTY_CAREER, name: 'Sam Lee', contact: 'sam@school.edu', headline: 'Economics and security studies', experiences: EXPERIENCES };
const KNOWN = { experiences: EXPERIENCES, courseIds: ['econ'] };
const NOW = 1_000;

describe('suggested skills are the student’s to decide', () => {
  it('start as suggestions, and none is confirmed until the student says so', () => {
    expect(reviewedSkills(CLAIMS, EMPTY_EVIDENCE).map((s) => s.state)).toEqual(['suggested', 'suggested', 'suggested']);
    expect(confirmedSkills(CLAIMS, EMPTY_EVIDENCE)).toEqual([]);
  });

  it('can be confirmed, renamed, rejected and undone', () => {
    let ev = decide(EMPTY_EVIDENCE, CLAIMS[0], 'confirmed', 'Regression analysis in Stata', NOW);
    ev = decide(ev, CLAIMS[1], 'rejected', undefined, NOW);
    expect(reviewedSkills(CLAIMS, ev).map((s) => [s.name, s.state])).toEqual([
      ['Regression analysis in Stata', 'confirmed'],
      ['Writing', 'rejected'],
      ['Research', 'suggested'],
    ]);
    expect(confirmedSkills(CLAIMS, ev)).toEqual(['Regression analysis in Stata']);
    expect(confirmedSkills(CLAIMS, decide(ev, CLAIMS[0], null, undefined, NOW))).toEqual([]);
  });

  it('lets the student add a skill only with a course or entry behind it', () => {
    const ev = addOwnSkill(EMPTY_EVIDENCE, 'Public speaking', { kind: 'experience', id: 'l1', label: 'Club treasurer' }, KNOWN, NOW);
    expect(confirmedSkills(CLAIMS, ev)).toEqual(['Public speaking']);
    expect(() => addOwnSkill(EMPTY_EVIDENCE, 'Leadership', { kind: 'experience', id: 'made-up', label: 'Captain, varsity' }, KNOWN, NOW)).toThrow('course or an entry');
    expect(() => addOwnSkill(EMPTY_EVIDENCE, 'Python', { kind: 'course', id: 'cs101', label: 'CS 101' }, KNOWN, NOW)).toThrow('course or an entry');
    expect(() => addOwnSkill(EMPTY_EVIDENCE, '  ', { kind: 'course', id: 'econ', label: 'ECON' }, KNOWN, NOW)).toThrow('Name the skill');
  });
});

describe('bullets say only what the student answered', () => {
  const answers = { did: 'rebuilt the club’s sign-up process', people: '240', tools: 'Google Forms and a shared budget sheet', outcome: 'sign-ups doubled over one term' };

  it('are composed from the answers', () => {
    expect(composeBullet(answers)).toBe('Rebuilt the club’s sign-up process using Google Forms and a shared budget sheet, reaching 240 people; sign-ups doubled over one term.');
  });

  it('leave an unanswered question out rather than fill it in, and say which', () => {
    expect(composeBullet({ ...answers, people: '', outcome: '' })).toBe('Rebuilt the club’s sign-up process using Google Forms and a shared budget sheet.');
    expect(missingPrompts({ people: '', tools: 'x', outcome: '' })).toEqual(['How many people did this affect?', 'What was the outcome?']);
    expect(composeBullet({ did: '', people: '5', tools: 'x', outcome: 'y' })).toBe('');
  });

  it('contain no word or number the student did not supply, beyond “using”, “reaching” and “people”', () => {
    const cases = [
      answers,
      { did: 'Led a team', people: '', tools: '', outcome: '' },
      { did: 'wrote a policy memo on sanctions', people: '1,200+', tools: 'Stata', outcome: 'cited in the unit’s brief' },
    ];
    for (const a of cases) {
      const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}’',+]+/gu) ?? [];
      const given = new Set([...words(a.did), ...words(a.people), ...words(a.tools), ...words(a.outcome), 'using', 'reaching', 'people']);
      const extra = words(composeBullet(a)).filter((w) => !given.has(w.replace(/[,]+$/, '')) && !given.has(w));
      expect(extra, JSON.stringify(a)).toEqual([]);
      const numbers = composeBullet(a).match(/\d[\d,]*/g) ?? [];
      for (const n of numbers) expect(a.people.includes(n)).toBe(true);
    }
  });

  it('belong to an entry the student made, and take the number of people as digits only', () => {
    expect(() => saveBullet(EMPTY_EVIDENCE, { experienceId: 'ghost', did: 'x', people: '', tools: '', outcome: '', final: true }, EXPERIENCES, NOW)).toThrow('Add the entry first');
    expect(() => saveBullet(EMPTY_EVIDENCE, { experienceId: 'e1', did: 'x', people: 'about a thousand', tools: '', outcome: '', final: true }, EXPERIENCES, NOW)).toThrow('as digits');
    const ev = saveBullet(EMPTY_EVIDENCE, { experienceId: 'e1', did: 'coded 300 survey responses', people: '', tools: 'NVivo', outcome: '', final: true }, EXPERIENCES, NOW);
    expect(ev.bullets[0]).toMatchObject({ experienceId: 'e1', people: '', final: true });
  });
});

describe('portfolio artifacts', () => {
  const base = { title: 'Transit ridership analysis', kind: 'Data analysis' as const, date: '2026-04', description: 'Regressions on route data', url: 'https://github.com/sam/transit', evidence: { kind: 'experience' as const, id: 'p1', label: 'Transit study' }, skills: ['Data analysis'] };

  it('are tied to something the student did and tagged only with confirmed skills', () => {
    const known = { ...KNOWN, confirmed: ['Data analysis'] };
    expect(saveArtifact(EMPTY_EVIDENCE, base, known).artifacts[0]).toMatchObject({ title: 'Transit ridership analysis', skills: ['Data analysis'] });
    expect(() => saveArtifact(EMPTY_EVIDENCE, { ...base, evidence: { kind: 'course', id: 'nope', label: 'x' } }, known)).toThrow('Tie it to a course');
    expect(() => saveArtifact(EMPTY_EVIDENCE, { ...base, skills: ['Machine learning'] }, known)).toThrow('Only confirmed skills');
    expect(() => saveArtifact(EMPTY_EVIDENCE, { ...base, url: 'http://example.com' }, known)).toThrow('https');
    expect(() => saveArtifact(EMPTY_EVIDENCE, { ...base, date: 'April' }, known)).toThrow('a month');
  });

  it('lose a tag when its skill is no longer confirmed, and follow a rename', () => {
    const confirmed = decide(EMPTY_EVIDENCE, CLAIMS[0], 'confirmed', undefined, NOW);
    const tagged = saveArtifact(confirmed, { ...base, skills: ['Data analysis'] }, { ...KNOWN, confirmed: ['Data analysis'] });
    expect(decide(tagged, CLAIMS[0], 'rejected', undefined, NOW).artifacts[0].skills).toEqual([]);
    expect(decide(tagged, CLAIMS[0], null, undefined, NOW).artifacts[0].skills).toEqual([]);
    expect(decide(tagged, CLAIMS[0], 'confirmed', 'Regression analysis', NOW).artifacts[0].skills).toEqual(['Regression analysis']);
    // Confirming again, unchanged, leaves the tag (the control).
    expect(decide(tagged, CLAIMS[0], 'confirmed', undefined, NOW).artifacts[0].skills).toEqual(['Data analysis']);
  });
});

describe('résumé versions', () => {
  let ev: Evidence = decide(decide(EMPTY_EVIDENCE, CLAIMS[0], 'confirmed', undefined, NOW), CLAIMS[1], 'rejected', undefined, NOW);
  ev = saveBullet(ev, { experienceId: 'e1', did: 'cleaned 3 years of survey data', people: '', tools: 'Stata', outcome: '', final: true }, EXPERIENCES, NOW);
  ev = saveBullet(ev, { experienceId: 'e1', did: 'draft only', people: '', tools: '', outcome: '', final: false }, EXPERIENCES, NOW);
  const version = (template: 'chronological' | 'skills_first' | 'projects_first', ids = ['e1', 'p1']) =>
    ({ id: 'v', name: 'Econ', template, experienceIds: ids, bulletIds: ev.bullets.map((b) => b.id), artifactIds: [], updated: 0 });

  it('list confirmed skills only — never suggested or rejected ones', () => {
    const md = renderResume(version('chronological'), CAREER, ev, confirmedSkills(CLAIMS, ev));
    expect(md).toContain('## Skills\nData analysis');
    expect(md).not.toMatch(/Writing|Research\b(?! assistant)/);
  });

  it('use finished bullets only, and the entry’s own words where there are none', () => {
    const md = renderResume(version('chronological'), CAREER, ev, []);
    expect(md).toContain('- Cleaned 3 years of survey data using Stata.');
    expect(md.toLowerCase()).not.toContain('draft only');
    expect(md).toContain('### Transit study · 2025–26\nTransit study details');
  });

  it('follow the template’s order, and include only entries that exist', () => {
    const order = (t: 'chronological' | 'skills_first' | 'projects_first') =>
      [...renderResume(version(t, ['e1', 'p1', 'ghost']), CAREER, ev, ['Data analysis']).matchAll(/^## (\w+)/gm)].map((m) => m[1]);
    expect(order('chronological')).toEqual(['Experience', 'Projects', 'Skills']);
    expect(order('skills_first')).toEqual(['Skills', 'Experience', 'Projects']);
    expect(order('projects_first')).toEqual(['Projects', 'Experience', 'Skills']);
    expect(renderResume(version('chronological', ['ghost']), CAREER, ev, [])).not.toContain('ghost');
  });

  it('leave a bracketed gap for a missing name or contact, never a made-up one', () => {
    expect(renderResume(version('chronological'), { ...CAREER, name: '', contact: '' }, ev, []).split('\n').slice(0, 2)).toEqual(['# [Your name]', '[Email · phone · link]']);
  });

  it('need a name to be saved', () => {
    expect(() => saveVersion(EMPTY_EVIDENCE, { name: ' ', template: 'chronological', experienceIds: [], bulletIds: [], artifactIds: [] }, NOW)).toThrow('Name the version');
  });
});

describe('interview cards and fair plans', () => {
  const app = (id: string, stage: Application['stage']): Application =>
    ({ id, org: 'Acme', role: 'Analyst intern', kind: 'internship', url: 'https://acme.example/jobs/1', where: '', due: '', rolling: false, stage, next: '', nextBy: '2026-10-02', note: '', created: 0, moves: [] }) as Application;

  it('appear only for applications at the interview stage, with stories from finished bullets', () => {
    expect(interviewCards([app('a', 'sent'), app('b', 'offer')], EMPTY_EVIDENCE)).toEqual([]);
    const [card] = interviewCards([app('t', 'talking')], EMPTY_EVIDENCE);
    expect(card.title).toBe('Analyst intern · Acme');
    expect(card.steps.map((s) => s.id)).toEqual(['posting', 'stories', 'questions', 'logistics', 'thanks']);
    expect(card.steps[1].text).toBe('Write two finished bullets first, then practice them aloud as stories.');
    const ev = saveBullet(EMPTY_EVIDENCE, { experienceId: 'e1', did: 'ran the survey', people: '', tools: '', outcome: '', final: true }, EXPERIENCES, NOW);
    expect(interviewCards([app('t', 'talking')], ev)[0].steps[1].text).toContain('“Ran the survey.”');
  });

  it('build a pitch from the student’s own details, with brackets where something is missing', () => {
    expect(pitchDraft(CAREER, ['Data analysis'])).toBe(
      'Hi, I’m Sam Lee — Economics and security studies. Most recently: Club treasurer at Finance club. I bring Data analysis. [Why this employer, in one sentence.]',
    );
    expect(pitchDraft({ ...EMPTY_CAREER }, [])).toBe(
      'Hi, I’m [your name] — [what you study and what you are looking for]. [One thing you have done that you are proud of.] [Two or three skills you have confirmed.] [Why this employer, in one sentence.]',
    );
  });

  it('keep employers per fair', () => {
    const ev = saveEmployer(EMPTY_EVIDENCE, 'fair1', { name: 'Acme', why: 'Transit analytics', question: 'What do interns own?', visited: false, followUp: '' });
    expect(ev.fairs.fair1.employers.map((e) => e.name)).toEqual(['Acme']);
    expect(() => saveEmployer(ev, 'fair1', { name: '', why: '', question: '', visited: false, followUp: '' })).toThrow('Name the employer');
  });
});

describe('the device store', () => {
  it('reads what it wrote, and refuses anything else', () => {
    let ev = decide(EMPTY_EVIDENCE, CLAIMS[0], 'confirmed', undefined, NOW);
    ev = saveBullet(ev, { experienceId: 'e1', did: 'x', people: '12', tools: '', outcome: '', final: true }, EXPERIENCES, NOW);
    ev = saveEmployer(ev, 'f', { name: 'Acme', why: '', question: '', visited: true, followUp: '' });
    expect(readEvidence(JSON.parse(JSON.stringify(ev)))).toEqual(ev);
    expect(() => readEvidence({ ...ev, bullets: [{ ...ev.bullets[0], people: 'lots' }] })).toThrow();
    expect(() => readEvidence({ ...ev, decisions: { x: { status: 'maybe', name: 'x', at: 1 } } })).toThrow();
    expect(() => readEvidence({ ...ev, versions: [{ id: 'v', name: 'x', template: 'fancy', experienceIds: [], bulletIds: [], artifactIds: [], updated: 1 }] })).toThrow();
    expect(() => readEvidence({ ...ev, version: 2 })).toThrow();
  });
});
