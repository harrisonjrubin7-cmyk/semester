import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NAMED,
  NOT_ACTIVATED,
  NOT_ACTIVATED_MESSAGE,
  REQUIREMENTS,
  SHARED_PROVIDER,
  SWITCH,
  activation,
  blockers,
  type Requirement,
  type SharedProviderActivation,
} from '../../../../supabase/functions/_shared/provideractivation';
import { NOT_ACTIVATED_CODE, NOT_ACTIVATED_MARK } from '../claude';
import { STANDING } from './provider-terms';

/**
 * Holds the shared AI key off until the owner has done five things, and the
 * deployment has been switched on.
 *
 * The gate itself is `supabase/functions/_shared/provideractivation.ts`, read
 * by the deployed `claude` function. This file holds four things about it:
 *
 *  - **The truth table.** Each requirement missing on its own keeps the key off
 *    and is named; the switch alone does nothing; a complete record alone does
 *    nothing; only both together serve anybody.
 *  - **The committed record is honest.** A field reads `recorded` only with an
 *    evidence file under `docs/evidence/vendors/` that is in the tree, and
 *    while that folder does not exist every field is `pending-owner`. Nothing
 *    here can be approved by editing a string.
 *  - **The function asks first.** Before it reads the key, checks the caller,
 *    counts the call or reaches Anthropic.
 *  - **The checklist is the record.** `docs/trust/SHARED-PROVIDER-ACTIVATION.md`
 *    is rendered from it; `npm run registers` from app/ rewrites it.
 */

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/trust/SHARED-PROVIDER-ACTIVATION.md';
const FUNCTION = 'supabase/functions/claude/index.ts';

/** A record with every decision made, for the table. Invented evidence paths: this is a fixture, not the record. */
const complete: SharedProviderActivation = {
  provider: 'Anthropic',
  legalEntity: { status: 'recorded', name: 'Fixture Co', jurisdiction: 'Nowhere', evidence: 'docs/evidence/vendors/fixture-entity.pdf', recordedOn: '2027-01-01' },
  termsAccepted: { status: 'recorded', terms: 'Commercial Terms', account: 'fixture org', evidence: 'docs/evidence/vendors/fixture-terms.md', recordedOn: '2027-01-01' },
  studentData: { status: 'recorded', decision: 'student-data-addendum-signed', evidence: 'docs/evidence/vendors/fixture-addendum.pdf', recordedOn: '2027-01-01' },
  retention: { status: 'recorded', setting: 'zero-data-retention-granted', evidence: 'docs/evidence/vendors/fixture-zdr.md', recordedOn: '2027-01-01' },
  approval: { status: 'recorded', individuals: true, institutions: [], evidence: 'docs/evidence/vendors/fixture-approval.md', recordedOn: '2027-01-01' },
};

const without = (r: Requirement): SharedProviderActivation => ({ ...complete, [r]: { status: 'pending-owner', next: 'fixture' } });

describe('the shared-provider gate', () => {
  it('serves nobody from the committed record, whatever the switch says', () => {
    for (const value of [undefined, '', 'off', 'on', ' on ', 'ON', 'true', '1']) {
      const got = activation(SHARED_PROVIDER, value);
      expect(got.active, String(value)).toBe(false);
      for (const r of REQUIREMENTS) expect(got.blockers.join('\n'), `${value} ${r}`).toContain(NAMED[r]);
    }
  });

  it('serves nobody from a complete record until the switch is exactly on', () => {
    for (const value of [undefined, '', 'off', 'ON', 'true', '1', 'yes', 'on please']) {
      const got = activation(complete, value);
      expect(got.active, String(value)).toBe(false);
      expect(got.blockers, String(value)).toEqual([`the deployment switch ${SWITCH} is not set to on`]);
    }
    expect(activation(complete, 'on')).toEqual({ active: true, blockers: [] });
    // A trailing newline is what `supabase secrets set` from a file leaves.
    expect(activation(complete, 'on\n').active).toBe(true);
  });

  it('keeps the key off for each requirement left owed on its own, and names it', () => {
    for (const r of REQUIREMENTS) {
      const got = activation(without(r), 'on');
      expect(got.active, r).toBe(false);
      expect(got.blockers, r).toEqual([`${NAMED[r]}: pending the owner`]);
    }
  });

  it('refuses a decision recorded without evidence under docs/evidence/vendors/, or without a date', () => {
    const outside = { ...complete, termsAccepted: { ...complete.termsAccepted, evidence: 'docs/trust/PROVIDER-TERMS.md' } } as SharedProviderActivation;
    expect(activation(outside, 'on').blockers).toEqual([`${NAMED.termsAccepted}: recorded without evidence under docs/evidence/vendors/`]);
    // The supplied playbooks are never evidence, and neither is an empty path.
    // Nor is a path that walks out of the folder, or a folder: Codex's review of
    // #1031 found `.` and `..` segments passing the first pattern.
    for (const evidence of [
      '', 'docs/evidence/vendors/', 'docs/evidence/ai/killswitch.json', 'Semester 2026 playbook.pdf',
      'docs/evidence/vendors/.', 'docs/evidence/vendors/..', 'docs/evidence/vendors/../ai',
      'docs/evidence/vendors/../ai/killswitch.json', 'docs/evidence/vendors/x/../../ai/k.json',
      'docs/evidence/vendors/.hidden.pdf', 'docs/evidence/vendors/terms', 'docs/evidence/vendors//terms.pdf',
    ]) {
      const bad = { ...complete, retention: { ...complete.retention, evidence } } as SharedProviderActivation;
      expect(activation(bad, 'on').active, evidence).toBe(false);
    }
    const undated = { ...complete, legalEntity: { ...complete.legalEntity, recordedOn: 'soon' } } as SharedProviderActivation;
    expect(activation(undated, 'on').blockers).toEqual([`${NAMED.legalEntity}: recorded without a date`]);
  });

  it('refuses an approval that does not cover the individual accounts the key serves', () => {
    const schoolsOnly = { ...complete, approval: { ...complete.approval, individuals: false, institutions: ['a school'] } } as SharedProviderActivation;
    const got = activation(schoolsOnly, 'on');
    expect(got.active).toBe(false);
    expect(got.blockers[0]).toMatch(/individual accounts/);
  });

  it('lists what is owed in one fixed order, so the log and the checklist read alike', () => {
    expect(blockers(SHARED_PROVIDER)).toEqual(REQUIREMENTS.map((r) => `${NAMED[r]}: pending the owner`));
  });
});

describe('the committed activation record', () => {
  const vendors = join(root, 'docs', 'evidence', 'vendors');

  it('records nothing whose evidence is not in the tree', () => {
    for (const r of REQUIREMENTS) {
      const field = SHARED_PROVIDER[r];
      if (field.status === 'recorded') {
        const at = join(root, field.evidence);
        expect(existsSync(at) && statSync(at).isFile(), `${r} cites ${field.evidence}, which is not a file in the tree`).toBe(true);
      } else {
        expect(field.next.trim().length, r).toBeGreaterThan(20);
      }
    }
  });

  it('records nothing at all while docs/evidence/vendors/ does not exist', () => {
    if (existsSync(vendors)) return;
    for (const r of REQUIREMENTS) expect(SHARED_PROVIDER[r].status, r).toBe('pending-owner');
  });

  it('agrees with the provider-terms record about whether Anthropic’s terms are accepted', () => {
    const anthropic = STANDING.find((s) => s.provider === 'Anthropic')!;
    // `published` there and `pending-owner` here are the same fact. The day one
    // moves, both move in the same pull request.
    expect(anthropic.standing === 'published').toBe(SHARED_PROVIDER.termsAccepted.status === 'pending-owner');
  });

  it('cannot record accepted terms before there is an entity to accept them', () => {
    if (SHARED_PROVIDER.termsAccepted.status === 'recorded') expect(SHARED_PROVIDER.legalEntity.status).toBe('recorded');
  });

  it('switches nothing on anywhere in the repository', () => {
    // The second half of the gate is the deployment's to set. A workflow,
    // config file or example that sets it would make merging the switch.
    const on = new RegExp(`${SWITCH}\\s*[=:]\\s*["']?on\\b`, 'i');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        if (['node_modules', '.git', 'dist', 'coverage'].includes(f)) return [];
        const full = join(dir, f);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    const places = [join(root, '.github'), join(root, 'supabase'), join(root, 'app', '.env.example')].filter(existsSync);
    const files = places.flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p])).filter((f) => /\.(ya?ml|toml|json|env|example|sh)$|\.env/.test(f));
    expect(files.length).toBeGreaterThan(3);
    expect(files.filter((f) => on.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length + 1))).toEqual([]);
    // The control: the pattern does find the line it is looking for.
    expect(on.test(`${SWITCH}=on`)).toBe(true);
    expect(on.test(`${SWITCH}=off`)).toBe(false);
  });
});

describe('the claude function', () => {
  const source = readFileSync(join(root, FUNCTION), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const at = (needle: string) => {
    const i = code.indexOf(needle);
    expect(i, `${FUNCTION} no longer contains ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it('asks the gate before it reads the key, checks the caller, counts the call or reaches Anthropic', () => {
    const gate = at('activation(SHARED_PROVIDER, Deno.env.get(SWITCH))');
    const refusal = at('if (!gate.active)');
    expect(gate).toBeLessThan(refusal);
    for (const later of ["Deno.env.get('AI_GATEWAY_API_KEY')", "Deno.env.get('ANTHROPIC_API_KEY')", 'auth.getUser(', "rpc('count_call'", 'fetch(upstreamTo.url']) {
      expect(refusal, later).toBeLessThan(at(later));
    }
  });

  it('answers the refusal with the code the app reads', () => {
    expect(code).toMatch(/\{ message: NOT_ACTIVATED_MESSAGE, code: NOT_ACTIVATED \}/);
    expect(NOT_ACTIVATED_CODE).toBe(NOT_ACTIVATED);
    expect(NOT_ACTIVATED_MESSAGE).toContain(NOT_ACTIVATED_MARK);
  });

  it('is the only function that spends a key of Semester’s', () => {
    // A second function reading the secret would be a second door with no
    // gate on it. The institution gateway spends a university's own key
    // under that university's policy and is not in this folder.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const full = join(dir, f);
        return statSync(full).isDirectory() ? walk(full) : f.endsWith('.ts') ? [full] : [];
      });
    const spenders = walk(join(root, 'supabase', 'functions'))
      .filter((f) => /Deno\.env\.get\(\s*['"](ANTHROPIC|OPENAI|AI_GATEWAY)_API_KEY/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length + 1));
    expect(spenders).toEqual([FUNCTION]);
  });
});

describe('the activation checklist', () => {
  it('says what the record says, whatever it says', () => {
    // Codex's review of #1031: the opening paragraph was fixed text, so it
    // would have kept saying "nothing is recorded" beside a recorded row.
    const none = render({ ...complete, ...Object.fromEntries(REQUIREMENTS.map((r) => [r, { status: 'pending-owner', next: 'fixture' }])) } as SharedProviderActivation);
    expect(none).toMatch(/Nothing below is recorded/);
    const owed = { status: 'pending-owner', next: 'fixture' } as const;
    const one = render({ ...complete, termsAccepted: owed, studentData: owed, retention: owed, approval: owed });
    expect(one).toMatch(/1 of 5 decisions are recorded/);
    expect(one).not.toMatch(/Nothing below is recorded|no company is formed/);
    const all = render(complete);
    expect(all).toMatch(/Every decision is recorded/);
    expect(all).not.toMatch(/Nothing below is recorded|refuses every caller with the sentence below until|no company is formed/);
    expect(all).toContain('docs/evidence/vendors/fixture-entity.pdf');
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const EVIDENCE_FOR: Record<Requirement, string> = {
  legalEntity: 'The formation document, or the state filing receipt.',
  termsAccepted: 'The Console organization’s acceptance record under the entity, or a dated pointer to it (never the key).',
  studentData: 'The signed addendum, or counsel’s written opinion that the shared key carries no education records.',
  retention: 'Anthropic’s written grant of zero data retention, or the owner’s dated acceptance of the default.',
  approval: 'The owner’s dated approval naming who may be served; for a school, that school’s written approval.',
};

/** What the record amounts to, in the page's opening words. Every sentence follows the record, never a constant. */
function standing(record: SharedProviderActivation): string[] {
  const done = REQUIREMENTS.filter((r) => record[r].status === 'recorded').length;
  const gate = `The \`claude\` function serves nobody until every row below is *recorded* with evidence under \`docs/evidence/vendors/\` **and** the deployment sets \`${SWITCH}=on\`. Either alone serves nobody.`;
  if (done === 0) {
    return [
      `**The shared key is off.** ${gate} Nothing below is recorded, because none of it has happened: no company is formed, no terms are accepted in Semester's name, and nothing is decided or approved. These are the owner's acts; no pull request may record one without its evidence, and the test refuses one that tries.`,
      '',
      'The key answered production on 29 September 2026 (the kill-switch drill in `docs/evidence/ai/`). From the first deploy of the function carrying this gate it refuses every caller with the sentence below, and the app says so in place of a missing-key message.',
    ];
  }
  if (blockers(record).length > 0) {
    return [
      `**The shared key is off.** ${gate} ${done} of ${REQUIREMENTS.length} decisions are recorded; the rest are owed, and the function refuses every caller with the sentence below until they are not.`,
    ];
  }
  return [
    `**Every decision is recorded.** The key serves callers only while the deployment sets \`${SWITCH}=on\`; without it the function still refuses every caller with the sentence below. Unsetting the switch, or engaging \`kill.ai_generation\`, turns it off again.`,
  ];
}

function render(record: SharedProviderActivation = SHARED_PROVIDER): string {
  const out: string[] = [
    '# Shared AI provider activation',
    '',
    '<!-- Rendered from supabase/functions/_shared/provideractivation.ts by app/src/lib/trust/provideractivation.test.ts. Edit the record, then run `npm run registers` from app/. -->',
    '',
    ...standing(record),
    '',
    `> ${NOT_ACTIVATED_MESSAGE}`,
    '',
    '## What is owed',
    '',
    '| Requirement | Status | Next step | Evidence that records it |',
    '| --- | --- | --- | --- |',
    ...REQUIREMENTS.map((r) => {
      const f = record[r];
      return f.status === 'recorded'
        ? `| ${cell(NAMED[r])} | recorded ${f.recordedOn} | — | \`${f.evidence}\` |`
        : `| ${cell(NAMED[r])} | pending the owner | ${cell(f.next)} | ${cell(EVIDENCE_FOR[r])} |`;
    }),
    `| the deployment switch | not set by the repository | Set \`${SWITCH}=on\` with \`supabase secrets set\`, only after every row above is recorded. | The deploy log. The test refuses a workflow or config file that sets it. |`,
    '',
    '## Recording a decision',
    '',
    '1. Do the act itself. Nothing here does it for you.',
    '2. Put its evidence under `docs/evidence/vendors/`, with no key, password or account secret in it.',
    '3. In `supabase/functions/_shared/provideractivation.ts`, change that field to `recorded` with the evidence path and the date. For accepted terms, move the Anthropic row of `app/src/lib/trust/provider-terms.ts` off `published` in the same pull request: the test holds the two together.',
    '4. Run `npm run registers` from app/ to rewrite this page, and the gates.',
    '5. Only when every row is recorded, and after the pull request is merged and deployed, set the switch.',
    '',
    '## Where the gate is, and where it is not',
    '',
    '- **Gated:** `supabase/functions/claude`, the only function holding a key of Semester’s. The test fails if another function reads `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`.',
    '- **Not this gate:** a student’s own key goes from their browser to the provider under their own agreement, and the institution gateway (`app/server/institution`, not deployed) spends a university’s own OpenAI key under that university’s tenant policy. Neither is Semester’s key.',
    '- **Turning it off again:** unset the switch, or engage `kill.ai_generation`. Either stops the function before it counts a call.',
    '',
  ];
  return out.join('\n');
}
