// A skeleton institution adapter: advising appointments, backed by a fake SIS.
// Node 22, no dependencies. Run through its test: cd app && npx vitest run src/lib/docs/examples.test.ts
import { Refusal } from '../../packages/institution/src/index.ts';
import type {
  ActionInput,
  ConnectionStatus,
  Receipt,
  RecordPage,
  UniversityIdentity,
  UniversityRecord,
} from '../../packages/institution/src/index.ts';
import type { FakeSis, Slot } from './fake-sis.ts';

/**
 * The contract, in the shape app/server/institution/adapter.ts declares it.
 * The test passes an adapter to the real `createGateway`, so TypeScript
 * rejects this file if the real interface gains a required member.
 */
interface Context {
  identity: UniversityIdentity;
  /** Aborts at the gateway's 20 second timeout. A real adapter passes it to every upstream call. */
  signal: AbortSignal;
}
export interface AdvisingAdapter {
  area: 'advising';
  institutionId: string;
  status(context: Context): Promise<ConnectionStatus>;
  list(context: Context, query: { search: string; cursor: string | null }): Promise<RecordPage>;
  get(context: Context, id: string): Promise<UniversityRecord | null>;
  review(context: Context, input: ActionInput): Promise<{ title: string; details: { label: string; value: string }[] }>;
  reconcile?(context: Context, input: ActionInput, idempotencyKey: string): Promise<Receipt | null>;
  execute(context: Context, input: ActionInput, idempotencyKey: string): Promise<Receipt>;
}

export const TOPICS = ['Course planning', 'Graduation check', 'Academic standing'];
const PAGE_SIZE = 2;

export function advisingAdapter(sis: FakeSis, institutionId: string, clock: () => Date): AdvisingAdapter {
  /** The adapter's own authorization. The gateway verified who this is; the SIS says what they may do. */
  const studentFor = (context: Context) => {
    const student = sis.student(context.identity.userId);
    return student && context.identity.roles.includes('student') ? student : null;
  };

  const toRecord = (slot: Slot): UniversityRecord => ({
    id: slot.id,
    area: 'advising',
    title: `Advising with ${slot.advisor}`,
    summary: slot.bookedBy ? 'Booked' : 'Open',
    status: slot.bookedBy ? 'Booked' : 'Open',
    version: String(slot.revision), // the SIS's revision, verbatim: the gateway compares it for 409s
    updatedAt: clock().toISOString(),
    details: [{ label: 'Starts', value: slot.startsAt }],
    dates: [{ at: slot.startsAt, what: 'Advising appointment' }],
    // A booked slot offers no action, so a stale commit is refused by the gateway before it reaches execute.
    actions: slot.bookedBy
      ? []
      : [{ id: 'book', label: 'Book', fields: [{ id: 'topic', label: 'Topic', kind: 'select', required: true, options: TOPICS }] }],
  });

  /** Everything that could refuse a booking. Writes nothing, reserves nothing. */
  const check = (context: Context, input: ActionInput) => {
    const student = studentFor(context);
    if (!student) throw new Refusal('Your account is not linked to a student record.');
    if (student.hold) throw new Refusal('A hold on your account blocks booking. Clear it with the registrar first.');
    const slot = sis.slot(input.recordId);
    if (!slot || slot.bookedBy) throw new Refusal('That appointment is no longer available.');
    return slot;
  };

  const receipt = (bookingId: string): Receipt => ({
    id: bookingId,
    status: 'completed',
    message: 'Appointment booked in the student information system.',
    recordedAt: clock().toISOString(),
  });

  return {
    area: 'advising',
    institutionId,

    async status(context) {
      // Called before every read and write: ask the SIS now, never cache "connected".
      const base = { area: 'advising' as const, provider: 'Example SIS', lastSyncAt: null, permissions: ['self:advising'] };
      try {
        const linked = studentFor(context) !== null;
        return { ...base, state: linked ? 'connected' : 'disconnected', canRead: linked, canWrite: linked, message: linked ? '' : 'No linked student record.' };
      } catch {
        return { ...base, state: 'error', canRead: false, canWrite: false, message: 'The SIS did not answer.' };
      }
    },

    async list(context, query) {
      if (!studentFor(context)) return { records: [], nextCursor: null, fetchedAt: clock().toISOString() };
      const matching = sis.slots.filter((s) => `${s.advisor} ${s.startsAt}`.toLowerCase().includes(query.search.toLowerCase()));
      const start = Number(query.cursor ?? '0') || 0; // the cursor is opaque to clients; this one is an offset
      const end = start + PAGE_SIZE;
      return {
        records: matching.slice(start, end).map(toRecord),
        nextCursor: end < matching.length ? String(end) : null,
        fetchedAt: clock().toISOString(),
      };
    },

    async get(context, id) {
      if (!studentFor(context)) return null; // not "forbidden": a record the account cannot see does not exist
      const slot = sis.slot(id);
      return slot ? toRecord(slot) : null;
    },

    async review(context, input) {
      const slot = check(context, input);
      return {
        title: 'Book an advising appointment',
        details: [
          { label: 'Advisor', value: slot.advisor },
          { label: 'Starts', value: slot.startsAt },
          { label: 'Topic', value: input.fields.topic },
        ],
      };
    },

    async execute(context, input, idempotencyKey) {
      check(context, input); // the gateway checked; time has passed. A Refusal here means nothing was written.
      // The review id is the SIS's idempotency key. Any ordinary error from here on leaves the outcome unknown.
      return receipt(sis.book(input.recordId, context.identity.userId, input.fields.topic, idempotencyKey).id);
    },

    async reconcile(_context, _input, idempotencyKey) {
      const booking = sis.findByKey(idempotencyKey); // look up; never repeat the booking
      return booking ? receipt(booking.id) : null;
    },
  };
}
