import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL, SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { BINDING, COMMITMENTS, COMMITMENT_STATUSES, PROMISABLE, STATUS_MEANING, SUPPORT_TIERS, problems, type Commitment, type Context } from './commitments';
import { controlLine, renderedFrom, table } from './render';

/**
 * The customer commitment register, and the rules that keep a promise honest.
 *
 * The register is empty, and the first test says why it must be: the
 * `champion` seat is vacant, so there is no customer to have promised
 * anything to. The rest exercise `problems()` against fixtures — a commitment
 * that should stand, and one broken in each way the brief's columns exist to
 * catch — because a rule that has never refused anything is not known to be
 * a rule.
 *
 * `ops/customer-commitments/README.md` is rendered from the data; `npm run
 * registers` from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'ops/customer-commitments/README.md';

const ctx: Context = {
  register: new Map(REGISTER.map((r) => [r.id, r.status])),
  seats: SEATS,
};

/** A commitment that should stand: bound by a contract, resting on tested rows, risk named. */
const sound: Commitment = {
  id: 'C-001',
  customer: 'Example University, Office of the Registrar',
  commitment: 'Registration windows and holds shown to enrolled students within one hour of publication',
  scope: 'The registrar’s published windows and holds; not degree audits, not grades',
  contractRef: 'PILOT-2026-001 §4.2',
  owner: 'data',
  due: '2027-01-15',
  dependsOn: ['STU-005', 'IAM-008'],
  supportTier: 'T2',
  evidence: [],
  status: 'accepted',
  risk: { severity: 'P1', why: 'Registration day is the school’s critical period; a stale window is a missed class' },
  communication: { on: '2026-11-01', said: 'Pilot scope confirmed in the kickoff note' },
  approval: null,
};

const tested = REGISTER.find((r) => r.status === 'tested')!.id;
const building = REGISTER.find((r) => r.status === 'building')!.id;

describe('the customer commitment register', () => {
  it('is empty while the champion seat is vacant, because there is nobody to have promised to', () => {
    const champion = COUNCIL.find((c) => c.seat === 'champion')!;
    if (champion.holder === null) expect(COMMITMENTS).toEqual([]);
  });

  it('carries no commitment that problems() would refuse', () => {
    for (const c of COMMITMENTS) expect(problems(c, ctx), c.id).toEqual([]);
    expect(new Set(COMMITMENTS.map((c) => c.id)).size).toBe(COMMITMENTS.length);
  });

  describe('problems()', () => {
    it('lets a sound commitment stand', () => {
      expect(problems(sound, ctx)).toEqual([]);
      expect(problems({ ...sound, dependsOn: [tested] }, ctx)).toEqual([]);
    });

    it('refuses a promise that rests on nothing, or on a row that is not in the register', () => {
      expect(problems({ ...sound, dependsOn: [] }, ctx)).toContain('depends on nothing: every promise rests on a register row');
      expect(problems({ ...sound, dependsOn: ['STU-999'] }, ctx)).toContain('depends on STU-999, which is not a register row');
    });

    it('refuses a binding promise with no contract reference', () => {
      for (const status of BINDING) expect(problems({ ...sound, status, contractRef: null, evidence: ['x'], approval: { seat: 'founder', on: '2027-01-01' } }, ctx)).toContain(`${status} with no contract reference`);
      expect(problems({ ...sound, status: 'proposed', contractRef: null }, ctx)).toEqual([]);
    });

    it('refuses delivery without evidence, and delivery on a row below tested', () => {
      expect(problems({ ...sound, status: 'delivered' }, ctx)).toContain('delivered with no evidence');
      expect(problems({ ...sound, status: 'delivered', evidence: ['docs/evidence/registrar-windows.md'] }, ctx)).toEqual([]);
      expect(problems({ ...sound, status: 'delivered', evidence: ['x'], dependsOn: [building] }, ctx)).toContain(`delivered while ${building} is below tested`);
      expect(PROMISABLE).not.toContain('building');
    });

    it('lets only the founder seat approve completion, dated, with the customer told', () => {
      const approved: Commitment = { ...sound, status: 'approved', evidence: ['x'], approval: { seat: 'founder', on: '2027-01-20' } };
      expect(problems(approved, ctx)).toEqual([]);
      expect(problems({ ...approved, approval: null }, ctx)).toContain('approved with no approval');
      expect(problems({ ...approved, approval: { seat: 'product', on: '2027-01-20' } }, ctx)).toContain('approved by product; only the founder seat approves completion');
      expect(problems({ ...approved, approval: { seat: 'founder', on: 'January' } }, ctx)).toContain('approval is undated');
      expect(problems({ ...approved, communication: null }, ctx)).toContain('approved and the customer was not told');
      expect(problems({ ...sound, approval: { seat: 'founder', on: '2027-01-20' } }, ctx)).toContain('accepted but carries an approval');
    });

    it('requires a named risk when a customer relies on something unproven', () => {
      const unproven: Commitment = { ...sound, dependsOn: [building], risk: { severity: 'P2', why: '' } };
      expect(problems(unproven, ctx)).toContain(`relies on ${building} below tested and names no risk`);
      expect(problems({ ...unproven, risk: { severity: 'P2', why: 'Building; the fallback is the registrar’s own page' } }, ctx)).toEqual([]);
      expect(problems({ ...unproven, status: 'proposed', contractRef: null }, ctx)).toEqual([]);
    });

    it('refuses a withdrawal the customer was not told about', () => {
      expect(problems({ ...sound, status: 'withdrawn', communication: null }, ctx)).toContain('withdrawn and the customer was not told');
    });

    it('refuses the columns that are simply wrong', () => {
      expect(problems({ ...sound, id: 'X1' }, ctx)).toContain('id X1 is not C-nnn');
      expect(problems({ ...sound, customer: 'someone@example.edu' }, ctx)).toContain('customer looks like a personal address');
      expect(problems({ ...sound, owner: 'nobody' as Commitment['owner'] }, ctx)).toContain('owner nobody is not a council seat');
      expect(problems({ ...sound, due: 'soon' }, ctx)).toContain('due soon is not a date');
      expect(problems({ ...sound, supportTier: 'T4' as Commitment['supportTier'] }, ctx)).toContain(`support tier T4 is not one of ${SUPPORT_TIERS.join(', ')}`);
      expect(problems({ ...sound, communication: { on: 'Tuesday', said: 'x' } }, ctx)).toContain('communication is undated');
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const champion = COUNCIL.find((c) => c.seat === 'champion')!;
  const heads = ['Id', 'Customer', 'Commitment', 'Scope', 'Contract', 'Owner', 'Due', 'Depends on', 'Support', 'Evidence', 'Status', 'Risk', 'Communication', 'Approval'];
  const rows = COMMITMENTS.map((c) => [
    c.id,
    c.customer,
    c.commitment,
    c.scope,
    c.contractRef ?? '—',
    `\`${c.owner}\``,
    c.due,
    c.dependsOn.map((d) => `\`${d}\``).join(', '),
    c.supportTier,
    c.evidence.length ? c.evidence.map((e) => `\`${e}\``).join('<br>') : '—',
    c.status,
    `${c.risk.severity}: ${c.risk.why}`,
    c.communication ? `${c.communication.on}: ${c.communication.said}` : '—',
    c.approval ? `\`${c.approval.seat}\` ${c.approval.on}` : '—',
  ]);
  const out: string[] = [
    '# Customer commitments',
    '',
    renderedFrom('app/src/lib/ops/commitments.ts', 'commitments.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Every promise made to a named customer: what was promised, to whom, in',
    'which document, resting on which rows of the',
    '[master readiness register](../../docs/MASTER-LAUNCH-READINESS-REGISTER.md),',
    'with the evidence that it was kept and the approval that closed it. This is',
    'how a sales promise and the product’s reality are made to meet, and it is as',
    'important as the roadmap: a roadmap says what will be built, this says what',
    'somebody is already relying on.',
    '',
    '## Where it stands',
    '',
    COMMITMENTS.length === 0
      ? champion.holder === null
        ? '**No commitments.** There is no customer: the council’s `champion` seat is vacant, no pilot agreement is signed, and the company that would sign one is not formed ([`docs/LAUNCH-DECISIONS.md`](../../docs/LAUNCH-DECISIONS.md) items 4, 5 and 7). The test holds the register empty while the seat is vacant, so the first promise cannot be recorded before there is somebody to have made it to.'
        : '**No commitments** recorded yet.'
      : `**${COMMITMENTS.length} commitments**, ${COMMITMENTS.filter((c) => BINDING.includes(c.status)).length} binding.`,
    '',
    ...(COMMITMENTS.length ? [...table(heads, rows), ''] : []),
    '## The columns',
    '',
    ...table(
      ['Column', 'What goes in it'],
      [
        ['Customer', 'The institution or department. Never a person, never an address.'],
        ['Commitment', 'What was promised, in the words it was promised in.'],
        ['Scope', 'What is in, and what is out.'],
        ['Contract reference', 'The identifier on the signed document. The document stays in the private operations system.'],
        ['Owner', 'A council seat, from [`docs/LAUNCH-READINESS-COUNCIL.md`](../../docs/LAUNCH-READINESS-COUNCIL.md).'],
        ['Due date', 'ISO date.'],
        ['Product dependency', 'Master-register row ids the promise rests on. Their status is the truth about how far along it is.'],
        ['Support tier', `${SUPPORT_TIERS.join(', ')} from [\`docs/market-readiness/SUPPORT_PLAYBOOK.md\`](../../docs/market-readiness/SUPPORT_PLAYBOOK.md).`],
        ['Evidence', 'Paths under `docs/evidence/`, or private-system references, showing it was kept.'],
        ['Status', COMMITMENT_STATUSES.map((s) => `\`${s}\``).join(' → ')],
        ['Risk', 'The severity of missing the date, and why.'],
        ['Customer communication', 'What the customer was last told, and when.'],
        ['Completion approval', 'The founder seat, dated. Nobody else approves completion.'],
      ],
    ),
    '',
    '## Statuses',
    '',
    ...table(['Status', 'Meaning'], COMMITMENT_STATUSES.map((s) => [`\`${s}\``, STATUS_MEANING[s]])),
    '',
    '## The rules `problems()` enforces',
    '',
    '- Every promise names at least one register row, and each must exist.',
    `- A binding promise (${BINDING.map((s) => `\`${s}\``).join(', ')}) has a contract reference.`,
    `- \`delivered\` and \`approved\` need evidence, and no dependency below \`tested\` (${PROMISABLE.map((s) => `\`${s}\``).join(', ')} count).`,
    '- Only the founder seat approves completion, dated, and the customer is told.',
    '- A customer relying on a row below `tested` has a named risk.',
    '- A withdrawal is communicated.',
    '',
    'Each rule was shown a commitment it must refuse before it was trusted to',
    'accept one. `app/src/lib/ops/commitments.test.ts` holds the fixtures.',
    '',
    '## Recording one',
    '',
    '1. Add the row to `COMMITMENTS` in `app/src/lib/ops/commitments.ts`.',
    '2. Run `npm test -- commitments` from `app/`; fix what `problems()` names.',
    '3. Run `npm run registers` to rewrite this page, and open the pull request',
    '   with the contract reference in its description.',
    '',
  ];
  return out.join('\n');
}
