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
  page,
  type Application,
  type Employer,
  type Listing,
  type SandboxStore,
} from './sandbox.ts';

/**
 * Career, advising and alumni, against the sandbox, as a labelled
 * demonstration.
 *
 * The build-out plan opens Phase 4 with these. **Nothing here reaches
 * anybody.** No employer named in `EMPLOYERS` exists, no application is
 * delivered, no appointment is in an adviser's diary, and the alumni are
 * invented. Phase 4 in that document requires everything in Phase 3 sustained
 * through a live pilot *plus* a university choosing to extend trust into
 * official institutional transactions one function at a time. Neither has
 * happened, and this file does not move either of them.
 *
 * ## What each of the three is actually for
 *
 * Registration taught this repository where to look: the hard part of any
 * institutional area is the sentence "two people can want the last one", and
 * an area without that sentence in it is a list.
 *
 *   **Career.** The finite thing is not the application — a posting can take
 *   a thousand of those and nothing is lost. It is the *offer*. Two openings
 *   and three offers is a promise the employer cannot keep, and it is checked
 *   at review and again at the write for the same reason the seat is: the
 *   review reserves nothing.
 *
 *   **Advising.** The half-hour. One person has it.
 *
 *   **Alumni.** The mentor's attention, which is why a mentor carries a
 *   number and why the count is derived from their accepted mentorships
 *   rather than stored beside them.
 *
 * ## Three disclosures, and each is an absence rather than a lock
 *
 * Family access settled the rule: a permission the server does not hold shows
 * up as *missing data*, not as a greyed-out row. Three of those are here, and
 * each is tested from the outside — by reading the record as somebody who
 * should not see the field and asserting the field is not on it at all.
 *
 *   1. **An employer sees the applicants to their own postings and no
 *      others.** A career site where a competitor can read your pipeline is
 *      not a career site.
 *   2. **A student never sees who else applied.** Not the names, and not the
 *      count either — a count is a disclosure with the names removed and is
 *      the one people forget.
 *   3. **An alumnus's address does not exist on the record until they have
 *      said yes.** The whole of the alumni network is that one sentence.
 *
 * ## Why an employer is a table and not a role
 *
 * The contract's six roles are the six a *draft* can be written as, and there
 * is no employer among them, which turned out to be the right answer rather
 * than a gap. An employer is not a kind of person at a university, it is a
 * relationship the career office has approved and can suspend. So it lives in
 * a row the server owns, with a state the office sets, and the only thing
 * that grants the right to act for one is being named in its `owner` column.
 * A pending employer cannot post; a suspended one cannot post and cannot be
 * applied to. Both are real career-office controls and both are walkable.
 */

const day = (at: Date) => at.toISOString().slice(0, 10);

/* ── Career ─────────────────────────────────────────────────────────────── */

/**
 * Whether the office has vetted this employer for posting to students.
 *
 * A plain boolean and deliberately not a type predicate. Written as
 * `e is Employer` it narrowed the *refusing* branch to `null`, which made the
 * refusal that names the employer — "QuickCash Partners is not currently
 * approved" — unreachable as far as the types were concerned, even though at
 * run time the name was always there. A predicate that asserts something
 * false about the failure path is worse than no predicate, because the
 * failure path is the one nobody reads.
 */
export const vetted = (e: Employer | null): boolean => e?.state === 'approved';

/** Whether a listing has shut. A day, in the listing, in the past. */
export const closed = (listing: Listing, now: Date) => day(now) > listing.closes;

/**
 * Offers already made against this listing, counted rather than stored.
 *
 * `accepted` counts, because an accepted offer is an opening spent. `declined`
 * does not, because the opening came back — which is the whole reason an
 * employer makes a second offer at all, and the reason this is a count over
 * rows rather than a number somebody decrements.
 */
export const offered = (store: SandboxStore, listing: string): number =>
  store.applications(listing).filter((a) => a.state === 'offered' || a.state === 'accepted').length;

/** Somebody's application to one listing, or null. */
const appOf = (store: SandboxStore, student: string, listing: string): Application | null =>
  store.applications(listing).find((a) => a.student === student) ?? null;

const appId = (student: string, listing: string) => `${listing}::${student}`;

/**
 * The employer this caller may act for, refusing rather than returning null.
 *
 * Two different refusals, because they need two different things done about
 * them: somebody with no employer row at all is not an employer, and somebody
 * whose row is pending or suspended is one the office has not cleared. A
 * single message would have told the second person to go and register.
 */
function actingFor(store: SandboxStore, context: AdapterContext): Employer {
  const row = store.employerOf(context.identity.userId);
  if (!row) throw new Refusal('Only an employer the career office holds a record for can do that.');
  if (row.state === 'pending') {
    throw new Refusal(`${row.name} is still awaiting review by the career office. ${row.why}`);
  }
  if (row.state === 'suspended') {
    throw new Refusal(`${row.name} is suspended. ${row.why}`);
  }
  return row;
}

/**
 * One listing, as this particular person is allowed to read it.
 *
 * The applicant lines are the interesting part and they are built from
 * `mine`, which is the employer's ownership of *this* listing. A student
 * always gets `mine === false`, so the branch that discloses is not reachable
 * from a student session at all rather than being reachable and then filtered.
 */
export function listingRecord(
  store: SandboxStore,
  listing: Listing,
  context: AdapterContext,
  now: Date,
): UniversityRecord {
  const employer = store.employer(listing.employer);
  const me = context.identity.userId;
  const mine = employer?.owner === me;
  const ours = mine ? null : appOf(store, me, listing.id);
  const shut = closed(listing, now);
  const out = offered(store, listing.id);
  const left = Math.max(0, listing.openings - out);
  const all = mine ? store.applications(listing.id) : [];

  const state = mine
    ? `${all.length} application${all.length === 1 ? '' : 's'} · ${left} of ${listing.openings} openings left`
    : ours
      ? ours.state === 'submitted'
        ? 'Applied'
        : ours.state === 'shortlisted'
          ? 'Shortlisted'
          : ours.state === 'offered'
            ? 'Offered'
            : ours.state === 'accepted'
              ? 'Accepted'
              : ours.state === 'declined'
                ? 'You declined'
                : ours.state === 'passed'
                  ? 'Not taken further'
                  : 'Withdrawn'
      : shut
        ? `Closed ${listing.closes}`
        : `Open until ${listing.closes}`;

  return {
    id: listing.id,
    area: 'career',
    title: `${SANDBOX_MARK} · ${listing.title}`,
    summary: `${employer?.name ?? 'Unknown employer'} · ${listing.kind} · ${listing.where}`,
    status: state,
    /*
     * The version moves on anything that changes what a reader was shown: the
     * offers made, and this person's own state. An employer preparing an
     * offer while the last opening goes is refused by the seat check; this is
     * the cheaper refusal that catches it one step earlier.
     */
    version: `${out}:${all.length}:${ours?.version ?? 0}`,
    updatedAt: new Date().toISOString(),
    details: [
      { label: 'Employer', value: employer?.name ?? 'Unknown' },
      { label: 'Kind', value: listing.kind },
      { label: 'Where', value: listing.where },
      { label: 'Pay', value: listing.pay },
      { label: 'Openings', value: String(listing.openings) },
      { label: 'Closes', value: listing.closes },
      /*
       * The pipeline, for the employer who posted it and for nobody else.
       * A student's record carries no applicant line at all — not a count,
       * not a redaction. `career.test.ts` asserts the *absence*, because a
       * line reading "3 applicants (hidden)" is a disclosure with the names
       * removed.
       */
      ...(mine
        ? all.map((a) => ({
            label: a.student,
            value: `${a.state}${a.note ? ` — ${a.note}` : ''}`,
          }))
        : []),
      ...(mine ? [{ label: 'Offers made', value: `${out} of ${listing.openings}` }] : []),
      ...(ours
        ? [
            { label: 'You', value: ours.state },
            ...ours.history.map((h) => ({ label: h.at.slice(0, 16).replace('T', ' '), value: `${h.what} — ${h.who}` })),
          ]
        : []),
    ],
    dates: [{ at: `${listing.closes}T23:59:59.000Z`, what: `${listing.title} — applications close` }],
    actions: mine
      ? [
          { id: 'shortlist', label: 'Shortlist an applicant', fields: [{ id: 'who', label: 'Applicant', kind: 'text' as const, required: true }] },
          { id: 'offer', label: 'Make an offer', fields: [{ id: 'who', label: 'Applicant', kind: 'text' as const, required: true }] },
          { id: 'pass', label: 'Not taking further', fields: [{ id: 'who', label: 'Applicant', kind: 'text' as const, required: true }] },
          { id: 'close', label: 'Close this listing now', fields: [] },
        ]
      : ours?.state === 'offered'
        ? [
            { id: 'accept', label: 'Accept this offer', fields: [] },
            { id: 'decline', label: 'Decline this offer', fields: [] },
          ]
        : ours && ours.state !== 'withdrawn'
          ? [{ id: 'withdraw', label: 'Withdraw my application', fields: [] }]
          : ours
            ? []
            : shut
              ? []
              : [{ id: 'apply', label: 'Apply', fields: [{ id: 'note', label: 'A line about why', kind: 'text' as const, required: false }] }],
  };
}

/**
 * Whether this listing can be applied to at all, by this person, now.
 *
 * The employer check comes before the date check deliberately: a listing from
 * a suspended employer should say so rather than say "closed", because the
 * two want different things done about them.
 */
function applicable(store: SandboxStore, context: AdapterContext, listing: Listing, now: Date): void {
  if (!isStudent(context)) throw new Refusal('Only a student can apply to a listing.');

  const employer = store.employer(listing.employer);
  if (!vetted(employer)) {
    throw new Refusal(
      `${employer?.name ?? 'That employer'} is not currently approved by the career office, so this posting is not open.`,
    );
  }
  if (closed(listing, now)) {
    throw new Refusal(`Applications for ${listing.title} closed on ${listing.closes}.`);
  }

  const ours = appOf(store, context.identity.userId, listing.id);
  if (ours?.state === 'withdrawn') {
    /*
     * Terminal, and on purpose. The employer has already read it. A career
     * site whose "undo" quietly un-reads something a person acted on is
     * teaching a student the wrong thing about what an application is.
     */
    throw new Refusal(
      `You withdrew this application on ${ours.at.slice(0, 10)}. An employer has already read it, so it cannot be re-sent from here — write to them directly.`,
    );
  }
  if (ours) throw new Refusal(`You applied to ${listing.title} on ${ours.at.slice(0, 10)}.`);
}

/** The offer limit, checked at review and again at the write. */
function openingFor(store: SandboxStore, listing: Listing): void {
  if (offered(store, listing.id) >= listing.openings) {
    throw new Refusal(
      `${listing.title} has ${listing.openings} opening${listing.openings === 1 ? '' : 's'} and they are all offered. Withdraw an offer before making another.`,
    );
  }
}

const commitApp = (
  store: SandboxStore,
  row: Application,
  key: string,
  who: string,
  what: string,
  at: string,
  change: (a: Application) => void,
): Receipt => {
  change(row);
  row.version += 1;
  row.history.push({ at, who, what, receipt: key });
  store.saveApplication(row);
  const receipt: Receipt = {
    id: key,
    status: 'completed',
    message: `${SANDBOX_MARK} · ${what}. No employer named here exists and nothing was sent to anybody.`,
    recordedAt: at,
  };
  store.keep(receipt);
  return receipt;
};

/**
 * Accepting an offer settles the student's other outstanding offers.
 *
 * Inside the accept's own commit, the way a drop promotes the waiting list
 * inside its own. A student holding three offers is holding two openings
 * somebody else could have had, and a career office that let that stand is
 * the reason one-offer policies exist. The declines are recorded as the
 * student's own act because they are: accepting was the decision.
 */
function settleOthers(store: SandboxStore, student: string, keep: string, at: string, key: string): Application[] {
  const rest: Application[] = [];
  for (const other of store.applicationsOf(student)) {
    if (other.id === keep || other.state !== 'offered') continue;
    other.state = 'declined';
    other.version += 1;
    other.history.push({ at, who: student, what: 'Declined on accepting another offer', receipt: key });
    store.saveApplication(other);
    rest.push(other);
  }
  return rest;
}

export function careerAdapter(store: SandboxStore, clock: () => Date = () => new Date()): InstitutionAdapter {
  const listingOr = (id: string): Listing => {
    const row = store.listing(id);
    if (!row) throw new Refusal('No such listing in the sandbox career office.');
    return row;
  };

  /** The named applicant's row, refused unless this caller posted the listing. */
  const theirs = (context: AdapterContext, listing: Listing, who: string): Application => {
    const mine = actingFor(store, context);
    if (listing.employer !== mine.id) {
      throw new Refusal('That posting belongs to another employer. You can only act on your own.');
    }
    const row = appOf(store, who, listing.id);
    if (!row) throw new Refusal(`Nobody by that name has applied to ${listing.title}.`);
    if (row.state === 'withdrawn') throw new Refusal('That application was withdrawn.');
    return row;
  };

  /** The caller's own application, refused when it is not theirs to move. */
  const ours = (context: AdapterContext, listing: Listing): Application => {
    if (!isStudent(context)) throw new Refusal('Only a student can move their own application.');
    const row = appOf(store, context.identity.userId, listing.id);
    if (!row) throw new Refusal(`You have not applied to ${listing.title}.`);
    return row;
  };

  const adapter: InstitutionAdapter = {
    area: 'career',
    institutionId: SANDBOX_INSTITUTION,
    status: async (context) =>
      connection('career', context, isStudent(context) || store.employerOf(context.identity.userId) !== null),
    list: async (context, query) => {
      const now = clock();
      return page(matching(store.listings().map((l) => listingRecord(store, l, context, now)), query.search));
    },
    get: async (context, id) => {
      const row = store.listing(id);
      return row ? listingRecord(store, row, context, clock()) : null;
    },
    review: async (context, input) => {
      const now = clock();
      const listing = listingOr(input.recordId);
      const employer = store.employer(listing.employer);

      if (input.actionId === 'apply') {
        applicable(store, context, listing, now);
        return {
          title: `Apply to ${listing.title}`,
          details: [
            { label: 'Employer', value: employer?.name ?? 'Unknown' },
            { label: 'Openings', value: String(listing.openings) },
            { label: 'Closes', value: listing.closes },
            {
              label: 'After this',
              value: 'It goes to the employer and they can read it. Withdrawing is possible once and is final.',
            },
          ],
        };
      }

      if (input.actionId === 'withdraw') {
        const row = ours(context, listing);
        if (row.state === 'withdrawn') throw new Refusal('That application is already withdrawn.');
        return {
          title: `Withdraw your application to ${listing.title}`,
          details: [
            { label: 'Applied', value: row.at.slice(0, 10) },
            { label: 'Where it got to', value: row.state },
            { label: 'After this', value: 'It is final. You cannot apply to this posting again from here.' },
          ],
        };
      }

      if (input.actionId === 'accept' || input.actionId === 'decline') {
        const row = ours(context, listing);
        if (row.state !== 'offered') throw new Refusal('There is no open offer on this application.');
        const rest = store.applicationsOf(context.identity.userId).filter((a) => a.id !== row.id && a.state === 'offered');
        return {
          title: `${input.actionId === 'accept' ? 'Accept' : 'Decline'} the offer from ${employer?.name ?? 'this employer'}`,
          details: [
            { label: 'Role', value: listing.title },
            { label: 'Pay', value: listing.pay },
            ...(input.actionId === 'accept' && rest.length
              ? [
                  {
                    label: 'Your other offers',
                    value: `${rest.length} will be declined for you, because accepting is a decision about all of them.`,
                  },
                ]
              : []),
            {
              label: 'After this',
              value:
                input.actionId === 'accept'
                  ? 'An opening is spent. Nothing here tells a real employer anything.'
                  : 'The opening goes back and the employer can offer it to somebody else.',
            },
          ],
        };
      }

      // Everything below is the employer's side.
      if (input.actionId === 'close') {
        const mine = actingFor(store, context);
        if (listing.employer !== mine.id) {
          throw new Refusal('That posting belongs to another employer. You can only act on your own.');
        }
        if (closed(listing, now)) throw new Refusal('That posting is already closed.');
        return {
          title: `Close ${listing.title}`,
          details: [
            { label: 'Applications so far', value: String(store.applications(listing.id).length) },
            { label: 'After this', value: 'No further applications. The ones you have are unaffected.' },
          ],
        };
      }

      /*
       * The three below all name an applicant, so the name is read once. An
       * unknown action has to be refused *before* that read, though: falling
       * through to "Name the applicant" told somebody who typed a wrong
       * action that they had left a field out, which is a refusal doing two
       * jobs with one message.
       */
      if (input.actionId !== 'offer' && input.actionId !== 'shortlist' && input.actionId !== 'pass') {
        throw new Refusal('That is not something this listing can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the applicant.');
      const row = theirs(context, listing, who);

      if (input.actionId === 'offer') {
        if (row.state === 'offered' || row.state === 'accepted') throw new Refusal('That applicant already has an offer.');
        openingFor(store, listing);
        return {
          title: `Offer ${listing.title} to ${who}`,
          details: [
            { label: 'Openings left', value: String(listing.openings - offered(store, listing.id)) },
            { label: 'After this', value: 'One fewer opening. They can accept or decline; declining gives it back.' },
          ],
        };
      }
      if (input.actionId === 'shortlist') {
        if (row.state !== 'submitted') throw new Refusal('Only a new application can be shortlisted.');
        return {
          title: `Shortlist ${who}`,
          details: [{ label: 'After this', value: 'They see that they are shortlisted. No opening is spent.' }],
        };
      }
      if (input.actionId === 'pass') {
        if (row.state === 'accepted') throw new Refusal('They have accepted an offer. That cannot be taken back here.');
        return {
          title: `Not taking ${who} further`,
          details: [
            { label: 'Where they got to', value: row.state },
            {
              label: 'After this',
              value: row.state === 'offered' ? 'The offer is withdrawn and the opening goes back.' : 'They are told, and that is the end of it.',
            },
          ],
        };
      }
      throw new Refusal('That is not something this listing can do.');
    },
    execute: async (context: AdapterContext, input: ActionInput, key: string) => {
      const done = already(store, key);
      if (done) return done;

      const now = clock();
      const at = now.toISOString();
      const listing = listingOr(input.recordId);
      const me = context.identity.userId;

      if (input.actionId === 'apply') {
        applicable(store, context, listing, now);
        const row: Application = {
          id: appId(me, listing.id),
          listing: listing.id,
          student: me,
          state: 'submitted',
          note: String(input.fields?.note ?? '').slice(0, 300),
          at,
          version: 0,
          history: [],
        };
        return commitApp(store, row, key, me, `Applied to ${listing.title}`, at, () => {});
      }

      if (input.actionId === 'withdraw') {
        const row = ours(context, listing);
        if (row.state === 'withdrawn') throw new Refusal('That application is already withdrawn.');
        return commitApp(store, row, key, me, `Withdrew the application to ${listing.title}`, at, (a) => {
          a.state = 'withdrawn';
        });
      }

      if (input.actionId === 'accept') {
        const row = ours(context, listing);
        if (row.state !== 'offered') throw new Refusal('There is no open offer on this application.');
        const rest = settleOthers(store, me, row.id, at, key);
        const receipt = commitApp(store, row, key, me, `Accepted the offer for ${listing.title}`, at, (a) => {
          a.state = 'accepted';
        });
        if (rest.length) {
          const said: Receipt = {
            ...receipt,
            message: `${receipt.message} ${rest.length} other offer${rest.length === 1 ? ' was' : 's were'} declined for you.`,
          };
          store.keep(said);
          return said;
        }
        return receipt;
      }

      if (input.actionId === 'decline') {
        const row = ours(context, listing);
        if (row.state !== 'offered') throw new Refusal('There is no open offer on this application.');
        return commitApp(store, row, key, me, `Declined the offer for ${listing.title}`, at, (a) => {
          a.state = 'declined';
        });
      }

      if (input.actionId === 'close') {
        const mine = actingFor(store, context);
        if (listing.employer !== mine.id) {
          throw new Refusal('That posting belongs to another employer. You can only act on your own.');
        }
        if (closed(listing, now)) throw new Refusal('That posting is already closed.');
        listing.closes = day(now);
        store.saveListing(listing);
        const receipt: Receipt = {
          id: key,
          status: 'completed',
          message: `${SANDBOX_MARK} · Closed ${listing.title} to further applications. No real posting anywhere changed.`,
          recordedAt: at,
        };
        store.keep(receipt);
        return receipt;
      }

      // Same guard as the review's, and for the same reason.
      if (input.actionId !== 'offer' && input.actionId !== 'shortlist' && input.actionId !== 'pass') {
        throw new Refusal('That is not something this listing can do.');
      }
      const who = String(input.fields?.who ?? '').trim();
      if (!who) throw new Refusal('Name the applicant.');
      const row = theirs(context, listing, who);
      const mine = store.employer(listing.employer);

      if (input.actionId === 'offer') {
        if (row.state === 'offered' || row.state === 'accepted') throw new Refusal('That applicant already has an offer.');
        // Again, because the review reserved nothing. This is the check that
        // stops two openings becoming three promises.
        openingFor(store, listing);
        return commitApp(store, row, key, mine?.name ?? 'employer', `Offered ${listing.title}`, at, (a) => {
          a.state = 'offered';
        });
      }
      if (input.actionId === 'shortlist') {
        if (row.state !== 'submitted') throw new Refusal('Only a new application can be shortlisted.');
        return commitApp(store, row, key, mine?.name ?? 'employer', `Shortlisted for ${listing.title}`, at, (a) => {
          a.state = 'shortlisted';
        });
      }
      if (input.actionId === 'pass') {
        if (row.state === 'accepted') throw new Refusal('They have accepted an offer. That cannot be taken back here.');
        return commitApp(store, row, key, mine?.name ?? 'employer', `Not taken further for ${listing.title}`, at, (a) => {
          a.state = 'passed';
        });
      }
      throw new Refusal('That is not something this listing can do.');
    },
  };
  return adapter;
}
