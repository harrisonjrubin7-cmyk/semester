# Write a SIS adapter

> **Type:** how-to · **Audience:** implementers, institution-admins · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

This page walks through the contract an institution's integrator implements to connect a system such as a student information system to the gateway, using a skeleton backed by a fake in-memory SIS; stop reading if you only call the gateway, which is [Call the institution gateway](gateway-client.md).

**Status:** `PLANNED` for real connectors. The truth table lists SIS and catalog connectors as `PLANNED` and `BLOCKED` on a school-approved, credentialed adapter, and the gateway itself as `MOCK_DEMO` ([`docs/FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md)). `app/server/institution/adapters.ts` exports an empty array on purpose. The skeleton here connects to nothing real, and the test installs it into a gateway built for the test. It shows the shape of the work, not a supported way to go live.

The code is [`examples/sis-adapter/adapter.ts`](../../../examples/sis-adapter/adapter.ts) and [`examples/sis-adapter/fake-sis.ts`](../../../examples/sis-adapter/fake-sis.ts). Every code block below is copied from the repository byte for byte and held by `app/src/lib/docs/examples.test.ts`. The real interface is `app/server/institution/adapter.ts`; read its comments, because they are the contract. The wire the gateway puts in front of you is in [`docs/reference/API-GATEWAY.md`](../../reference/API-GATEWAY.md).

## 1. Know the division of work

The gateway does what is the same at every school: authentication, rate limiting, the two-phase action, the journal and the audit rows. The adapter does everything specific to one institution's system. One adapter serves one area (`advising` here) for one institution.

The rule the design rests on is in the interface's own words:

<!-- from: app/server/institution/adapter.ts -->
```ts
 * **An adapter enforces its own authorization, every time.** Not the gateway,
 * and certainly not the client. Every method here must independently check
```

`context.identity` is the only identity. Never trust a role the browser sent, a well-formed record id, or a tenant named in a request. Credentials for the upstream system come from the server's own configuration, never from anything reachable inside these methods.

## 2. Install it

The gateway builds its lookup from the array it is given. The key is the identity's own tenant and the area, so no request input selects which adapter runs:

<!-- from: app/server/institution/gateway.ts -->
```ts
  const installed = new Map(config.adapters.map((a) => [`${a.institutionId}:${a.area}`, a]));
```

In production that array is `adapters` in `app/server/institution/adapters.ts`, which is empty:

<!-- from: app/server/institution/adapters.ts -->
```ts
export const adapters: InstitutionAdapter[] = [];
```

Adding an entry there means a school has written, tested and approved an adapter for real student records. Do not add one to try something out. The sandbox institution is installed separately, behind `SEMESTER_SANDBOX_INSTITUTION=1` in `start.ts`.

## 3. Answer `status` every time

Called on every `/status` and before every read and write, so it must be cheap and must reflect now. A cached "connected" from an hour ago is how a revoked account keeps reading. The skeleton asks the SIS each time, and reports a down SIS as `error` instead of throwing:

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
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
```

If the state is not `connected`, or `canRead` is false, the gateway answers 403 `connection_forbids` for reads. For writes it also needs `canWrite`. The test takes the SIS down and reads the response bodies: the connection error text never appears in them.

## 4. Serve records

`list` returns a page. The cursor is yours to define and opaque to clients; this one is an offset. `get` returns one record, or `null` when the account cannot see it. `null` produces a 404, the same answer as for a record that does not exist.

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
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
```

Two fields on a record carry weight. `version` is the vendor's own revision, passed through unchanged; the gateway compares it between prepare and commit and answers 409 `record_changed` if it moved. `actions` lists what the account may do now. A booked slot lists none, so a stale request is refused before it reaches your code:

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
    version: String(slot.revision), // the SIS's revision, verbatim: the gateway compares it for 409s
```

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
    // A booked slot offers no action, so a stale commit is refused by the gateway before it reaches execute.
```

If a record commits a person to a date, set `dates` from the same value that built the display text, so the two cannot disagree.

## 5. Review: refuse with a sentence, write nothing

`review` is what the action would do, checked but not done. Validate everything that could refuse it, and return lines the person will read. **No writes and no reservations.** The gateway calls it twice, at prepare and again at commit, and refuses the commit if the answer changed.

Refuse by throwing `Refusal`, not `Error`:

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
  const check = (context: Context, input: ActionInput) => {
    const student = studentFor(context);
    if (!student) throw new Refusal('Your account is not linked to a student record.');
    if (student.hold) throw new Refusal('A hold on your account blocks booking. Clear it with the registrar first.');
    const slot = sis.slot(input.recordId);
    if (!slot || slot.bookedBy) throw new Refusal('That appointment is no longer available.');
    return slot;
  };
```

What the gateway does with what you throw, as the test shows:

| You throw | In `review` | In `execute` |
| --- | --- | --- |
| `Refusal` | 400 `refused`, with your sentence | 400 `refused`, your sentence, and the action is marked refused: nothing was written |
| Any other `Error` | 503 `unavailable`, one generic sentence; your message is dropped | 502 `outcome_uncertain`, and the action is marked uncertain until `reconcile` resolves it |

That is why a `Refusal` from `execute` is a promise: never throw one from halfway through a change.

This is the review the person reads for the same request that the client guide sends, and the receipt that follows a commit:

<!-- output: sis-adapter/review -->
```json
{
  "title": "Book an advising appointment",
  "details": [
    {
      "label": "Advisor",
      "value": "Dr. Rivera"
    },
    {
      "label": "Starts",
      "value": "2026-10-12T14:00:00Z"
    },
    {
      "label": "Topic",
      "value": "Course planning"
    }
  ]
}
```

<!-- output: sis-adapter/receipt -->
```json
{
  "id": "bk-1",
  "status": "completed",
  "message": "Appointment booked in the student information system.",
  "recordedAt": "2026-10-04T12:00:00.000Z"
}
```

## 6. Execute with the idempotency key, and reconcile

`execute` does it. Check again, because time has passed and the gateway is not the system of record. Pass `idempotencyKey` to the SIS as its own key. It is the review id, it is stable across retries, and it is what lets `reconcile` find the operation later.

<!-- from: examples/sis-adapter/adapter.ts -->
```ts
    async execute(context, input, idempotencyKey) {
      check(context, input); // the gateway checked; time has passed. A Refusal here means nothing was written.
      // The review id is the SIS's idempotency key. Any ordinary error from here on leaves the outcome unknown.
      return receipt(sis.book(input.recordId, context.identity.userId, input.fields.topic, idempotencyKey).id);
    },

    async reconcile(_context, _input, idempotencyKey) {
      const booking = sis.findByKey(idempotencyKey); // look up; never repeat the booking
      return booking ? receipt(booking.id) : null;
    },
```

The fake SIS shows the other half, a write that is safe to ask for twice:

<!-- from: examples/sis-adapter/fake-sis.ts -->
```ts
  /** Books a slot. Calling it again with the same key returns the first booking and writes nothing. */
  book(slotId: string, studentId: string, topic: string, key: string): Booking {
    this.ensureUp();
    const earlier = this.bookings.find((b) => b.key === key);
    if (earlier) return earlier;
```

Return `status: 'pending'` when the school accepted the request but has not completed it, and `completed` only when the institution says it is done. `reconcile` is optional. If you cannot implement it, the gateway answers a reconcile with 503 and tells the person to ask the institution for help. Returning `null` means still unknown, and the gateway tells the person to wait rather than submit again.

The test stages a lost response: the fake SIS books the slot, then fails as the answer comes back. The gateway answers 502, `reconcile` finds the booking by key, and the SIS holds one booking, not two.

## 7. Check it against the contract

The skeleton declares the interface locally, because an example may not import from `app/`. The test passes the adapter to the real `createGateway`, so the compiler rejects it if the real interface gains a required member. A second check compares the method names in the two interfaces.

## What this skeleton leaves to you

- A real client for your system, with timeouts. Pass `context.signal` to every upstream call; it aborts at the gateway's 20-second timeout.
- Secrets. Read them from the server's configuration or secret store.
- The school's approval and the evidence for it. See [`docs/UNIVERSITY_CONNECTIONS.md`](../../UNIVERSITY_CONNECTIONS.md) and [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](../../INTEGRATION-OPERATOR-RUNBOOK.md).
- Wiring it into a deployment. The array in `adapters.ts` stays empty until a school approves.

## Try it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "sis-adapter"
```

## Next

- [Call the institution gateway](gateway-client.md): the client side of the same flow.
- [Which integration path do I want?](which-integration-path.md)
- [`docs/INTEROPERABILITY-ROADMAP.md`](../../INTEROPERABILITY-ROADMAP.md) for the standards (OneRoster, LTI) a SIS connection may use instead.
