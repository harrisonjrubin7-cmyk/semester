import { Refusal } from '../../../packages/institution/src/index.ts';
import type { ActionInput, Receipt, UniversityRecord } from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import {
  COOLING_OFF_DAYS,
  PLAN_CHANGE_BY,
  SANDBOX_INSTITUTION,
  SANDBOX_MARK,
  already,
  connection,
  isStudent,
  matching,
  money,
  page,
  type Building,
  type Contract,
  type HousingApplication,
  type Plan,
  type PlanChoice,
  type RoomSpace,
  type SandboxStore,
} from './sandbox.ts';

/**
 * Housing and dining, against the sandbox, as a labelled demonstration — the
 * last of Phase 4.
 *
 * `career.ts` carries the warning in full. Here: **no building named here
 * exists**, nobody is housed, and no meal plan feeds anybody.
 *
 * ## The room is a seat; the contract is something this repository has not had
 *
 * A bed in a double is registration's seat and needs no new argument. What is
 * new is that somebody **signs** something, and a signature has two properties
 * a transaction does not.
 *
 *   **It binds.** After it, the money is owed whether or not the person turns
 *   up. That is what a housing contract is *for*, and it is what students are
 *   surprised by. So the review says the figure and the date it becomes
 *   unbreakable, in those words, before anything happens — which is the whole
 *   reason the gateway has a review phase, used here for the thing it is best
 *   at rather than for a seat count.
 *
 *   **It has a window in which it does not bind yet.** Every real housing
 *   contract has one, and that window is the only reason offering a signature
 *   in software is honest at all. Inside it, cancelling is free. Outside it,
 *   this adapter **refuses and names a human**, because releasing somebody
 *   from a binding contract is a decision a person makes. A button that did it
 *   silently would be pretending the signature meant less than it does.
 *
 * Three states and not one, deliberately: **applied** costs nothing and binds
 * nobody; **assigned** is the institution's answer and still binds nobody;
 * **signed** binds. Collapsing them would have hidden the only moment that
 * matters.
 *
 * ## Dining, where the amount is computed and the interesting part is a refusal
 *
 * A meal plan is not a seat — the dining hall does not run out. What it has is
 * a deadline and a price that depends on when you ask, which makes it the
 * first thing in Phase 4 whose *amount* is worked out rather than stated.
 *
 * And it is worked out one way only. **A downgrade after the deadline is
 * refused rather than prorated**, because the meals already bought are already
 * bought. Offering a refund the dining contract does not give would be the
 * software lying about somebody's money, which is worse than the software
 * saying no. An *upgrade* after the deadline is allowed — the difference is
 * charged, and nothing has to be given back to anybody for that to be true.
 */

const day = (at: Date) => at.toISOString().slice(0, 10);
const cash = (cents: number) => money(cents);

/** Add days to an ISO day, which is what a cooling-off period is. */
export function plusDays(from: string, days: number): string {
  const at = new Date(`${from}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return day(at);
}

/* ── Housing ────────────────────────────────────────────────────────────── */

/** Beds taken in one room, counted rather than stored. */
export const filled = (store: SandboxStore, room: string): number =>
  store.housing().filter((h) => h.room === room && (h.state === 'assigned' || h.state === 'signed')).length;

/** Whether a contract can still be undone without a person being involved. */
export const coolingOff = (c: Contract, now: Date) => day(now) <= c.coolingOff;

export function roomRecord(
  store: SandboxStore,
  space: RoomSpace,
  building: Building | null,
  context: AdapterContext,
): UniversityRecord {
  const me = context.identity.userId;
  const taken = filled(store, space.id);
  const left = Math.max(0, space.beds - taken);
  const mine = store.housingOf(me);
  const ours = mine?.room === space.id ? mine : null;

  return {
    id: space.id,
    area: 'housing',
    title: `${SANDBOX_MARK} · ${building?.name ?? space.building} ${space.number}`,
    summary: `${space.kind} · ${space.beds} bed${space.beds === 1 ? '' : 's'} · ${cash(building?.yearCents ?? 0)} a year`,
    status: ours
      ? ours.state === 'signed'
        ? 'Yours, signed'
        : 'Assigned to you, not yet signed'
      : left > 0
        ? `${left} of ${space.beds} free`
        : 'Full',
    version: `${taken}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Building', value: building?.name ?? space.building },
      { label: 'Room', value: space.number },
      { label: 'Kind', value: space.kind },
      { label: 'Beds', value: `${taken} of ${space.beds} taken` },
      { label: 'For the year', value: cash(building?.yearCents ?? 0) },
      /*
       * Never who else is in it. A room-mate's name is theirs to give, and a
       * housing system that hands it over before either has agreed to live
       * with the other is doing something nobody asked it to.
       */
      ...(ours ? [{ label: 'You', value: ours.state }] : []),
    ],
    /*
     * Applying lives on a room rather than on a form of its own, because a
     * student choosing where to live is looking at a room when they decide.
     * The preferences field takes the rest in order; this room is simply the
     * one they were reading.
     */
    actions:
      !mine || mine.state === 'withdrawn' || mine.state === 'ended'
        ? [
            {
              id: 'apply-housing',
              label: 'Apply, with this room first',
              fields: [
                {
                  id: 'wants',
                  label: 'Rooms in order of preference, separated by commas',
                  kind: 'text' as const,
                  required: true,
                },
              ],
            },
          ]
        : [],
  };
}

export function applicationRecord(store: SandboxStore, row: HousingApplication, now: Date): UniversityRecord {
  const space = row.room ? store.space(row.room) : null;
  const building = space ? store.building(space.building) : null;
  const contract = store.contractOf(row.student);
  const live = contract?.state === 'signed' ? contract : null;
  const free = live ? coolingOff(live, now) : false;

  return {
    id: row.id,
    area: 'housing',
    title: `${SANDBOX_MARK} · Your housing application`,
    summary: space ? `${building?.name ?? ''} ${space.number}` : `${row.wants.length} preferences`,
    status:
      row.state === 'signed'
        ? free
          ? `Signed · can still be cancelled until ${live!.coolingOff}`
          : 'Signed and binding'
        : row.state === 'assigned'
          ? 'Assigned, not yet signed'
          : row.state,
    version: `${row.version}:${contract?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Preferences', value: row.wants.map((w) => store.space(w)?.number ?? w).join(', ') || '(none)' },
      ...(space
        ? [
            { label: 'Assigned', value: `${building?.name ?? ''} ${space.number}` },
            { label: 'For the year', value: cash(building?.yearCents ?? 0) },
          ]
        : []),
      ...(live
        ? [
            { label: 'Signed', value: live.signedAt.slice(0, 10) },
            { label: 'Owed for the year', value: cash(live.cents) },
            {
              label: free ? 'Can be cancelled until' : 'Became binding on',
              value: free
                ? `${live.coolingOff} — after that the housing office has to release you.`
                : `${plusDays(live.coolingOff, 1)}. Cancelling now means writing to the housing office.`,
            },
          ]
        : []),
      ...row.history.map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
    ],
    dates: live && free ? [{ at: `${live.coolingOff}T23:59:59.000Z`, what: 'Housing contract — last day to cancel' }] : [],
    actions:
      row.state === 'applied'
        ? [{ id: 'withdraw-housing', label: 'Withdraw the application', fields: [] }]
        : row.state === 'assigned'
          ? [
              { id: 'sign', label: 'Sign the contract', fields: [] },
              { id: 'withdraw-housing', label: 'Turn the room down', fields: [] },
            ]
          : row.state === 'signed' && free
            ? [{ id: 'cancel-contract', label: 'Cancel the contract', fields: [] }]
            : [],
  };
}

/* ── Dining ─────────────────────────────────────────────────────────────── */

/** Whether the meal-plan change deadline has gone. */
export const planShut = (now: Date) => day(now) > PLAN_CHANGE_BY;

/**
 * What a change costs, in cents, which is the first computed amount here.
 *
 * Positive is owed. It is never negative: a downgrade after the deadline is
 * refused rather than returned, and a downgrade before it simply resets the
 * term charge, so there is no path through this function that produces a
 * refund. `housing.test.ts` asserts that from the outside, over every pair of
 * plans on both sides of the deadline, rather than trusting the sentence.
 */
export function changeCosts(from: Plan | null, to: Plan): number {
  if (!from) return to.termCents;
  const difference = to.termCents - from.termCents;
  /*
   * A downgrade costs nothing and returns nothing. Before the deadline it
   * simply re-prices the term; after it the caller has already refused. The
   * first version of this line branched on `planShut` and returned zero from
   * both arms, which is a branch pretending to be a decision — the decision is
   * the refusal, and it lives where refusals live.
   */
  return difference <= 0 ? 0 : difference;
}

export function planRecord(store: SandboxStore, plan: Plan, context: AdapterContext, now: Date): UniversityRecord {
  const me = context.identity.userId;
  const chosen = store.planOf(me);
  const current = chosen ? store.plan(chosen.plan) : null;
  const ours = chosen?.plan === plan.id;
  const shut = planShut(now);
  const down = current !== null && plan.termCents < current.termCents;

  return {
    id: plan.id,
    area: 'dining',
    title: `${SANDBOX_MARK} · ${plan.name}`,
    summary: `${plan.meals} meal${plan.meals === 1 ? '' : 's'} a week · ${cash(plan.termCents)} a term`,
    status: ours ? 'Your plan' : shut ? (down ? 'Cannot change to this now' : 'Can still change up') : 'Available',
    version: `${chosen?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Meals a week', value: String(plan.meals) },
      { label: 'A term', value: cash(plan.termCents) },
      { label: 'Change by', value: PLAN_CHANGE_BY },
      ...(current && !ours
        ? [
            { label: 'You are on', value: current.name },
            {
              label: down ? 'Changing down' : 'Changing up',
              value: down
                ? shut
                  ? `Not possible after ${PLAN_CHANGE_BY}: the meals already bought are already bought, and nothing is given back.`
                  : 'Free until the deadline.'
                : `${cash(changeCosts(current, plan))} more for the term.`,
            },
          ]
        : []),
      ...(ours ? [{ label: 'You', value: `On this plan since ${chosen!.at.slice(0, 10)}` }] : []),
    ],
    dates: [{ at: `${PLAN_CHANGE_BY}T23:59:59.000Z`, what: 'Meal plan — last day to change down' }],
    actions: ours || (shut && down) ? [] : [{ id: 'choose-plan', label: `Move to ${plan.name}`, fields: [] }],
  };
}

/* ── The refusals ───────────────────────────────────────────────────────── */

const commitApplication = (
  store: SandboxStore,
  row: HousingApplication,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (h: HousingApplication) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveHousing(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No building here exists and nobody is housed anywhere.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

export function housingAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const mine = (context: AdapterContext): HousingApplication | null => store.housingOf(context.identity.userId);

  const adapter: InstitutionAdapter = {
    area: 'housing',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('housing', context, isStudent(context)),
    list: async (context, query) => {
      const now = clock();
      const ours = mine(context);
      const records = [
        ...store.spaces().map((s) => roomRecord(store, s, store.building(s.building), context)),
        ...(ours ? [applicationRecord(store, ours, now)] : []),
      ];
      return page(matching(records, query.search));
    },
    get: async (context, id) => {
      const now = clock();
      const space = store.space(id);
      if (space) return roomRecord(store, space, store.building(space.building), context);
      const ours = mine(context);
      return ours && ours.id === id ? applicationRecord(store, ours, now) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const me = context.identity.userId;

      if (input.actionId === 'apply-housing') {
        if (!isStudent(context)) throw new Refusal('Only a student can apply for housing.');
        const existing = mine(context);
        if (existing && existing.state !== 'withdrawn' && existing.state !== 'ended') {
          throw new Refusal(`You already have a housing application, and it is ${existing.state}.`);
        }
        const wants = String(input.fields?.wants ?? '')
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);
        if (!wants.length) throw new Refusal('Name at least one room you would like, in order of preference.');
        for (const w of wants) if (!store.space(w)) throw new Refusal(`There is no room called ${w}.`);
        return {
          title: 'Apply for housing',
          details: [
            { label: 'Your preferences', value: wants.map((w) => store.space(w)!.number).join(', ') },
            {
              label: 'After this',
              value:
                'The office answers with a room, which may not be one of these. Applying costs nothing and binds nobody — only signing does.',
            },
          ],
        };
      }

      const row = mine(context);
      if (!row) throw new Refusal('You have no housing application.');

      if (input.actionId === 'withdraw-housing') {
        if (row.state === 'signed') {
          throw new Refusal('You have signed a contract for that room. Cancel the contract instead.');
        }
        if (row.state === 'withdrawn' || row.state === 'ended') throw new Refusal('That application is already closed.');
        return {
          title: row.state === 'assigned' ? 'Turn the room down' : 'Withdraw your housing application',
          details: [
            { label: 'After this', value: 'The room goes back to the office and you are not housed.' },
          ],
        };
      }

      if (input.actionId === 'sign') {
        if (row.state !== 'assigned') throw new Refusal('There is no room assigned to you to sign for.');
        const space = store.space(row.room);
        if (!space) throw new Refusal('The room on your application is not one this office knows.');
        const building = store.building(space.building);
        const until = plusDays(day(now), COOLING_OFF_DAYS);
        return {
          /*
           * The review earning its keep. This is the one action in Phase 4
           * where what a person needs told is not "can I have it" but "what am
           * I agreeing to", and both numbers are here in the words that make
           * them mean something.
           */
          title: `Sign for ${building?.name ?? ''} ${space.number}`,
          details: [
            { label: 'Room', value: `${building?.name ?? ''} ${space.number} · ${space.kind}` },
            { label: 'You will owe', value: `${cash(building?.yearCents ?? 0)} for the year` },
            { label: 'Whether or not you live there', value: 'Yes. That is what signing a housing contract means.' },
            { label: 'You can cancel until', value: until },
            {
              label: 'After that',
              value: 'Only the housing office can release you, and they do not have to.',
            },
          ],
        };
      }

      if (input.actionId === 'cancel-contract') {
        const contract = store.contractOf(me);
        if (!contract || contract.state !== 'signed') throw new Refusal('You have no signed housing contract.');
        if (!coolingOff(contract, now)) {
          /*
           * The refusal that names a person. A button that released somebody
           * from a binding contract would be pretending the signature meant
           * less than it does, and the honest thing software can do at this
           * point is say who to write to.
           */
          throw new Refusal(
            `The time to cancel ran out on ${contract.coolingOff}. That contract binds you for ${cash(contract.cents)}, and only the housing office can release you from it — write to them.`,
          );
        }
        return {
          title: 'Cancel your housing contract',
          details: [
            { label: 'Signed', value: contract.signedAt.slice(0, 10) },
            { label: 'You would have owed', value: cash(contract.cents) },
            { label: 'Last day to do this', value: contract.coolingOff },
            { label: 'After this', value: 'You owe nothing and the room goes back to the office.' },
          ],
        };
      }

      throw new Refusal('That is not something a housing record can do.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const me = context.identity.userId;

      if (input.actionId === 'apply-housing') {
        if (!isStudent(context)) throw new Refusal('Only a student can apply for housing.');
        const existing = mine(context);
        if (existing && existing.state !== 'withdrawn' && existing.state !== 'ended') {
          throw new Refusal(`You already have a housing application, and it is ${existing.state}.`);
        }
        const wants = String(input.fields?.wants ?? '')
          .split(',')
          .map((w) => w.trim())
          .filter(Boolean);
        if (!wants.length) throw new Refusal('Name at least one room you would like, in order of preference.');
        for (const w of wants) if (!store.space(w)) throw new Refusal(`There is no room called ${w}.`);

        const row: HousingApplication = existing ?? {
          id: `housing::${me}`,
          student: me,
          wants,
          state: 'withdrawn',
          room: '',
          at,
          version: 0,
          history: [],
        };
        return commitApplication(store, row, key, me, 'Applied for housing', at, (h) => {
          h.wants = wants;
          h.state = 'applied';
          h.room = '';
          h.at = at;
        });
      }

      const row = mine(context);
      if (!row) throw new Refusal('You have no housing application.');

      if (input.actionId === 'withdraw-housing') {
        if (row.state === 'signed') {
          throw new Refusal('You have signed a contract for that room. Cancel the contract instead.');
        }
        if (row.state === 'withdrawn' || row.state === 'ended') throw new Refusal('That application is already closed.');
        return commitApplication(store, row, key, me, 'Housing application withdrawn', at, (h) => {
          h.state = 'withdrawn';
          h.room = '';
        });
      }

      if (input.actionId === 'sign') {
        if (row.state !== 'assigned') throw new Refusal('There is no room assigned to you to sign for.');
        const space = store.space(row.room);
        if (!space) throw new Refusal('The room on your application is not one this office knows.');
        const building = store.building(space.building);
        const contract: Contract = {
          id: `contract::${me}`,
          student: me,
          room: space.id,
          cents: building?.yearCents ?? 0,
          signedAt: at,
          coolingOff: plusDays(day(now), COOLING_OFF_DAYS),
          state: 'signed',
          version: 1,
          history: [{ at, who: me, what: `Signed for ${space.number}`, receipt: key }],
        };
        store.saveContract(contract);
        return commitApplication(store, row, key, me, `Signed the contract for ${space.number}`, at, (h) => {
          h.state = 'signed';
        });
      }

      if (input.actionId === 'cancel-contract') {
        const contract = store.contractOf(me);
        if (!contract || contract.state !== 'signed') throw new Refusal('You have no signed housing contract.');
        // Again, and this one matters more than most: the review may have been
        // read on the last day and the commit pressed on the next.
        if (!coolingOff(contract, now)) {
          throw new Refusal(
            `The time to cancel ran out on ${contract.coolingOff}. That contract binds you for ${cash(contract.cents)}, and only the housing office can release you from it — write to them.`,
          );
        }
        contract.state = 'cancelled';
        contract.version += 1;
        contract.history.push({ at, who: me, what: 'Contract cancelled inside the cooling-off period', receipt: key });
        store.saveContract(contract);
        return commitApplication(store, row, key, me, 'Housing contract cancelled', at, (h) => {
          h.state = 'ended';
          h.room = '';
        });
      }

      throw new Refusal('That is not something a housing record can do.');
    },
    /**
     * The housing office answering an application, which is the one action
     * here that is not the student's.
     *
     * It lives on `reconcile` rather than as an action because there is no
     * housing-officer session in this demonstration to authorize, and
     * inventing one would have been inventing the authorization. What it is
     * for is making the assignment reachable, so that signing — the part that
     * matters — can be walked by a person.
     */
    reconcile: async (_context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;
      const now = clock();
      const at = now.toISOString();
      const row = store.housingOf(input.recordId);
      if (!row) throw new Refusal('No such housing application.');
      if (row.state !== 'applied') throw new Refusal(`That application is ${row.state}, not waiting on the office.`);

      const offered = row.wants.map((w) => store.space(w)).find((s) => s && s.beds - filled(store, s.id) > 0);
      /*
       * One check and not two. This was written with a second `bedIn` call
       * after it, copying the review/commit pattern the rest of Phase 4 uses —
       * but there is no review phase here: the office assigning a room is one
       * operation, and the line above has already required a free bed, so the
       * second check could not fail. The mutation harness found it by removing
       * it and watching nothing happen. A guard that cannot fire is worse than
       * no guard, because it reads like protection that is not there.
       */
      if (!offered) throw new Refusal('None of those rooms has a bed free. The office will write to you.');

      return commitApplication(store, row, key, 'housing office', `Assigned ${offered.number}`, at, (h) => {
        h.state = 'assigned';
        h.room = offered.id;
      });
    },
  };
  return adapter;
}

/* ── Dining ─────────────────────────────────────────────────────────────── */

export function diningAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const planOr = (id: string): Plan => {
    const p = store.plan(id);
    if (!p) throw new Refusal('No such meal plan in the sandbox dining hall.');
    return p;
  };

  /** The one rule dining has, asked in one place. */
  const changeable = (context: AdapterContext, to: Plan, now: Date): Plan | null => {
    if (!isStudent(context)) throw new Refusal('Only a student can change their own meal plan.');
    const chosen = store.planOf(context.identity.userId);
    const from = chosen ? store.plan(chosen.plan) : null;
    if (from?.id === to.id) throw new Refusal(`You are already on ${to.name}.`);
    if (from && to.termCents < from.termCents && planShut(now)) {
      throw new Refusal(
        `The last day to change down was ${PLAN_CHANGE_BY}. The meals on ${from.name} are already bought and nothing is given back for them, so this change is not one the dining hall can make — ${to.name} is open to you next term.`,
      );
    }
    return from;
  };

  const adapter: InstitutionAdapter = {
    area: 'dining',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) => connection('dining', context, isStudent(context)),
    list: async (context, query) => {
      const now = clock();
      return page(matching(store.plans().map((p) => planRecord(store, p, context, now)), query.search));
    },
    get: async (context, id) => {
      const p = store.plan(id);
      return p ? planRecord(store, p, context, clock()) : null;
    },
    review: async (context, input) => {
      const now = clock();
      if (input.actionId !== 'choose-plan') throw new Refusal('That is not something a meal plan can do.');
      const to = planOr(input.recordId);
      const from = changeable(context, to, now);
      const owed = changeCosts(from, to);
      return {
        title: `Move to ${to.name}`,
        details: [
          ...(from ? [{ label: 'You are on', value: `${from.name} — ${cash(from.termCents)} a term` }] : []),
          { label: 'Moving to', value: `${to.name} — ${cash(to.termCents)} a term` },
          {
            label: owed > 0 ? 'You will owe' : 'To pay now',
            value: owed > 0 ? `${cash(owed)} more for this term` : 'Nothing. Nothing is given back either.',
          },
          { label: 'Change by', value: PLAN_CHANGE_BY },
          {
            label: 'After this',
            value: 'The plan changes from tomorrow. Nothing here charges you and no dining hall knows about it.',
          },
        ],
      };
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      if (input.actionId !== 'choose-plan') throw new Refusal('That is not something a meal plan can do.');
      const to = planOr(input.recordId);
      // Again, because a review read on the deadline can be committed the day
      // after, and on that day the answer is different.
      const from = changeable(context, to, now);
      const owed = changeCosts(from, to);
      const me = context.identity.userId;

      const row: PlanChoice = store.planOf(me) ?? {
        id: `plan::${me}`,
        student: me,
        plan: '',
        at,
        version: 0,
        history: [],
      };
      row.plan = to.id;
      row.at = at;
      row.version += 1;
      row.history.push({ at, who: me, what: `Moved to ${to.name}`, receipt: key });
      store.savePlanChoice(row);

      const receipt: Receipt = {
        id: key,
        status: 'completed',
        message: `${SANDBOX_MARK} · Moved to ${to.name}${owed > 0 ? `, ${cash(owed)} more for the term` : ''}. Nothing was charged to anybody and no dining hall knows about it.`,
        recordedAt: at,
      };
      store.keep(receipt);
      return receipt;
    },
  };
  return adapter;
}
