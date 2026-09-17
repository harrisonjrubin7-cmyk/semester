import { Refusal } from '../../../packages/institution/src/index.ts';
import type { ActionInput, Receipt, UniversityRecord } from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import {
  SANDBOX_INSTITUTION,
  SANDBOX_MARK,
  already,
  connection,
  isStudent,
  matching,
  money,
  page,
  type Award,
  type Charge,
  type SandboxStore,
} from './sandbox.ts';

/**
 * Billing and financial aid, against the sandbox, as a labelled demonstration.
 *
 * Phase 3's second domain. The source documents constrain its shape in one
 * sentence and this obeys it exactly: a real account balance *"built as read
 * access to Vanderbilt's own systems first, **not a competing processor**"*.
 *
 * ## What that sentence rules out, concretely
 *
 * Semester never holds money, never takes a card number, and has no payment
 * credential of any kind. The one write a student makes here — paying — is
 * prepared by Semester and **committed by the institution's own adapter**,
 * which is what returns the receipt. That is the architectural claim rather
 * than a detail: the same two-phase prepare/commit that puts a student in a
 * seat, with the institution on the far side of it.
 *
 * In this demonstration the sandbox *is* the institution, so it is the sandbox
 * that records the payment and says so. Against a real school, the same
 * adapter would hand off to that school's own processor and return its
 * receipt. Nothing about the app changes.
 *
 * ## What is owed is computed, never stored
 *
 * `charges` minus what is paid against them, every time. A balance column and
 * the rows that add up to it are two answers to one question, and the first
 * half-failed write is where they stop agreeing. Registration makes the same
 * argument about seats; it is worth making twice because money is where
 * somebody notices.
 *
 * ## The amount is never read from the request
 *
 * An award's amount is the institution's to set. A student accepting one sends
 * no number, and `execute` reads the award rather than the field — which is
 * the obvious attack on a screen like this and is refused by construction
 * rather than by validation.
 */

/** What is still owed on one charge. */
export const owing = (c: Charge): number => Math.max(0, c.cents - c.paid);

/** The account, in one line: owed, paid, and what aid is covering. */
export function balance(store: SandboxStore, student: string): {
  charged: number;
  paid: number;
  owed: number;
  accepted: number;
} {
  const charges = store.charges(student);
  const charged = charges.reduce((n, c) => n + c.cents, 0);
  const paid = charges.reduce((n, c) => n + c.paid, 0);
  const accepted = store
    .awards(student)
    .filter((a) => a.state === 'accepted' || a.state === 'disbursed')
    .reduce((n, a) => n + a.cents, 0);
  return { charged, paid, owed: Math.max(0, charged - paid), accepted };
}

const stamp = (at: string) => at.slice(0, 16).replace('T', ' ');

function chargeRecord(store: SandboxStore, c: Charge): UniversityRecord {
  const left = owing(c);
  const { owed, accepted } = balance(store, c.student);
  return {
    id: c.id,
    area: 'billing',
    title: `${SANDBOX_MARK} · ${c.what}`,
    summary: `${money(c.cents)} · due ${c.due}`,
    status: left === 0 ? 'Paid' : c.paid > 0 ? `${money(left)} still owed` : `${money(left)} owed`,
    version: `${c.version}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Charged', value: money(c.cents) },
      { label: 'Paid', value: money(c.paid) },
      { label: 'Still owed', value: money(left) },
      { label: 'Due', value: c.due },
      { label: 'Account balance', value: `${money(owed)} across everything on this account` },
      ...(accepted > 0 ? [{ label: 'Aid accepted', value: `${money(accepted)}, applied by the institution` }] : []),
      ...c.history.map((h) => ({ label: stamp(h.at), value: `${h.what} — ${h.who}` })),
      {
        label: 'Who moves the money',
        /*
         * On the record itself, not only in a header somebody does not read.
         * This is the sentence the whole domain is shaped by.
         */
        value:
          'The institution does. Semester prepares the payment and the institution commits it and issues the receipt. ' +
          'Semester holds no card and no balance.',
      },
    ],
    dates: [{ at: `${c.due}T23:59:59.000Z`, what: `${c.what} — due` }],
    actions:
      left === 0
        ? []
        : [
            {
              id: 'pay',
              label: 'Pay towards this',
              fields: [
                {
                  id: 'amount',
                  label: `How much, in dollars (up to ${money(left)})`,
                  kind: 'number',
                  required: true,
                },
              ],
            },
          ],
  };
}

function awardRecord(a: Award, now: Date): UniversityRecord {
  const late = now.toISOString().slice(0, 10) > a.answerBy;
  const open = a.state === 'offered' && !late;
  return {
    id: a.id,
    area: 'aid',
    title: `${SANDBOX_MARK} · ${a.what}`,
    summary: `${a.kind} · ${money(a.cents)}`,
    status:
      a.state === 'offered'
        ? late
          ? 'Offered — the date to answer has passed'
          : `Offered — answer by ${a.answerBy}`
        : a.state === 'accepted'
          ? 'Accepted'
          : a.state === 'declined'
            ? 'Declined'
            : 'Disbursed',
    version: `${a.version}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Kind', value: a.kind },
      { label: 'Amount', value: money(a.cents) },
      { label: 'Answer by', value: a.answerBy },
      {
        label: 'Set by',
        value: 'The institution. The amount is not something this app can change, and nothing you send here alters it.',
      },
      ...a.history.map((h) => ({ label: stamp(h.at), value: `${h.what} — ${h.who}` })),
    ],
    dates: open ? [{ at: `${a.answerBy}T23:59:59.000Z`, what: `${a.what} — answer by` }] : undefined,
    actions: open
      ? [
          { id: 'accept', label: 'Accept this award', fields: [] },
          { id: 'decline', label: 'Decline this award', fields: [] },
        ]
      : [],
  };
}

/** Dollars typed by a person, as cents, or a refusal that says why. */
export function cents(said: string): number {
  const text = (said ?? '').trim().replace(/^\$/, '').replace(/,/g, '');
  if (!text) throw new Refusal('Say how much to pay.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Refusal('Enter an amount in dollars, like 250 or 250.00.');
  }
  const n = Math.round(Number(text) * 100);
  if (!Number.isFinite(n) || n <= 0) throw new Refusal('Enter an amount greater than nothing.');
  return n;
}

const commitCharge = (
  store: SandboxStore,
  row: Charge,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (c: Charge) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveCharge(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. Recorded by the demonstration institution. No real money moved and no card was used.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

const commitAward = (
  store: SandboxStore,
  row: Award,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (a: Award) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveAward(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. Recorded by the demonstration institution. No real award was changed.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

/** The charge this id names, if it is this person's. */
function mineCharge(store: SandboxStore, context: AdapterContext, id: string): Charge {
  if (!isStudent(context)) throw new Refusal('Only the student on the account can pay it.');
  const row = store.charge(id);
  if (!row) throw new Refusal('No such charge on this account.');
  // The check that matters: a well-formed id for somebody else's bill.
  if (row.student !== context.identity.userId) throw new Refusal('That is not your account.');
  return row;
}

function mineAward(store: SandboxStore, context: AdapterContext, id: string): Award {
  if (!isStudent(context)) throw new Refusal('Only the student the award was made to can answer it.');
  const row = store.award(id);
  if (!row) throw new Refusal('No such award on this account.');
  if (row.student !== context.identity.userId) throw new Refusal('That is not your award.');
  return row;
}

export function billingAdapter(store: SandboxStore): InstitutionAdapter {
  const adapter: InstitutionAdapter = {
    area: 'billing',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('billing', context, isStudent(context)),
    list: async (context, query) => {
      const me = context.identity.userId;
      store.openAccount(me, new Date().toISOString());
      return page(matching(store.charges(me).map((c) => chargeRecord(store, c)), query.search));
    },
    get: async (context, id) => {
      store.openAccount(context.identity.userId, new Date().toISOString());
      const row = store.charge(id);
      if (!row || row.student !== context.identity.userId) return null;
      return chargeRecord(store, row);
    },
    review: async (context, input) => {
      const row = mineCharge(store, context, input.recordId);
      if (input.actionId !== 'pay') throw new Refusal('That is not something you can do to a charge.');
      const left = owing(row);
      if (left === 0) throw new Refusal(`${row.what} is already paid.`);
      const amount = cents(input.fields.amount ?? '');
      if (amount > left) {
        throw new Refusal(`That is more than the ${money(left)} still owed on ${row.what}.`);
      }
      return {
        title: `Pay ${money(amount)} towards ${row.what}`,
        details: [
          { label: 'Charge', value: row.what },
          { label: 'Still owed', value: money(left) },
          { label: 'Paying', value: money(amount) },
          { label: 'After this', value: `${money(left - amount)} left on this charge.` },
          {
            label: 'Who takes the money',
            value:
              'The institution, through its own system. Semester is preparing this and will not hold, route or touch the funds.',
          },
        ],
      };
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;
      const row = mineCharge(store, context, input.recordId);
      if (input.actionId !== 'pay') throw new Refusal('That is not something you can do to a charge.');
      const left = owing(row);
      if (left === 0) throw new Refusal(`${row.what} is already paid.`);
      const amount = cents(input.fields.amount ?? '');
      // Again at the write boundary, because the bill may have been paid from
      // somewhere else between the review and this.
      if (amount > left) throw new Refusal(`That is more than the ${money(left)} still owed on ${row.what}.`);

      return commitCharge(
        store,
        row,
        key,
        context.identity.userId,
        `Paid ${money(amount)} towards ${row.what}`,
        new Date().toISOString(),
        (c) => {
          c.paid += amount;
        },
      );
    },
    reconcile: async (_context: AdapterContext, _input: ActionInput, key: string) => store.receipt(key),
  };
  return adapter;
}

export function aidAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const adapter: InstitutionAdapter = {
    area: 'aid',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('aid', context, isStudent(context)),
    list: async (context, query) => {
      const me = context.identity.userId;
      store.openAccount(me, new Date().toISOString());
      const now = clock();
      return page(matching(store.awards(me).map((a) => awardRecord(a, now)), query.search));
    },
    get: async (context, id) => {
      store.openAccount(context.identity.userId, new Date().toISOString());
      const row = store.award(id);
      if (!row || row.student !== context.identity.userId) return null;
      return awardRecord(row, clock());
    },
    review: async (context, input) => {
      const row = answerable(store, context, input, clock());
      const { owed } = balance(store, row.student);
      if (input.actionId === 'accept') {
        return {
          title: `Accept ${row.what}`,
          details: [
            { label: 'Award', value: `${row.kind} — ${row.what}` },
            { label: 'Amount', value: money(row.cents) },
            { label: 'Owed now', value: money(owed) },
            {
              label: 'After this',
              value: 'The institution applies it to your account. It does not clear the bill by itself here.',
            },
          ],
        };
      }
      return {
        title: `Decline ${row.what}`,
        details: [
          { label: 'Award', value: `${row.kind} — ${row.what}` },
          { label: 'Amount', value: money(row.cents) },
          { label: 'After this', value: 'It is gone. Declining cannot be undone from here.' },
        ],
      };
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;
      const now = clock();
      const row = answerable(store, context, input, now);
      const at = now.toISOString();
      const taking = input.actionId === 'accept';
      /*
       * The amount comes from the row and never from `input.fields`. A screen
       * that let a student send the number would be a screen that let them
       * choose it, which is the obvious attack here and is refused by there
       * being nowhere to put one rather than by checking what was put.
       */
      return commitAward(
        store,
        row,
        key,
        context.identity.userId,
        `${taking ? 'Accepted' : 'Declined'} ${row.what} (${money(row.cents)})`,
        at,
        (a) => {
          a.state = taking ? 'accepted' : 'declined';
        },
      );
    },
    reconcile: async (_context: AdapterContext, _input: ActionInput, key: string) => store.receipt(key),
  };
  return adapter;
}

/** The award this action can be taken on, or the refusal that says why not. */
function answerable(store: SandboxStore, context: AdapterContext, input: ActionInput, now: Date): Award {
  const row = mineAward(store, context, input.recordId);
  if (input.actionId !== 'accept' && input.actionId !== 'decline') {
    throw new Refusal('An award can be accepted or declined, and nothing else.');
  }
  if (row.state === 'disbursed') throw new Refusal(`${row.what} has already been paid out. Talk to the aid office.`);
  if (row.state === 'accepted') throw new Refusal(`${row.what} is already accepted.`);
  if (row.state === 'declined') throw new Refusal(`${row.what} was declined. That cannot be undone from here.`);
  if (now.toISOString().slice(0, 10) > row.answerBy) {
    throw new Refusal(`The date to answer ${row.what} passed on ${row.answerBy}. Talk to the aid office.`);
  }
  return row;
}
