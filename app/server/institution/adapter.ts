import type {
  ActionInput,
  ConnectionStatus,
  Receipt,
  RecordPage,
  UniversityArea,
  UniversityIdentity,
  UniversityRecord,
} from '../../../packages/institution/src/index.ts';

/**
 * What a school has to write to connect one of its systems.
 *
 * One adapter per approved system: the registrar, the bursar, the LMS. The
 * gateway in `gateway.ts` does the parts that are the same everywhere —
 * authentication, rate limiting, the two-phase action, the journal — and
 * calls into one of these for everything that is specific to an institution.
 *
 * ## The rule the whole design rests on
 *
 * **An adapter enforces its own authorization, every time.** Not the gateway,
 * and certainly not the client. Every method here must independently check
 * the vendor's own object-level grants: that this person is enrolled in that
 * course, owns that bill, has consented to that disclosure, has no hold
 * blocking it, and that the vendor's policy permits the operation today.
 *
 * Three things that are never an authorization, stated because each has been
 * somebody's bug: a role the browser sent, a record id that happens to be
 * well formed, and a tenant named in a request. `AdapterContext.identity` is
 * the only identity, it comes from `auth.ts`, and it comes out of server-side
 * `app_metadata` that no client can write.
 *
 * Credentials — API keys, service accounts, signing secrets — come from the
 * server's own configuration or secret store. Never from anything reachable
 * here.
 */

export interface AdapterContext {
  identity: UniversityIdentity;
  /** Aborts at the gateway's timeout. Pass it to every upstream call. */
  signal: AbortSignal;
}

export interface InstitutionAdapter {
  area: UniversityArea;
  institutionId: string;

  /**
   * Whether this connection is live, and what it currently permits.
   *
   * Called on every `/status` and before every read and write, so it must be
   * cheap and must reflect *now* — a cached "connected" from an hour ago is
   * how a revoked account keeps reading.
   */
  status(context: AdapterContext): Promise<ConnectionStatus>;

  list(context: AdapterContext, query: { search: string; cursor: string | null }): Promise<RecordPage>;

  get(context: AdapterContext, id: string): Promise<UniversityRecord | null>;

  /**
   * What this action would do, checked but not done.
   *
   * Validate the fields, the dates, the eligibility, the financial rules, the
   * scan status of any attachment — everything that could refuse it. Return
   * human-readable lines for the person to read before confirming.
   *
   * **No writes and no reservations.** Not a seat hold, not a draft row, not
   * an upstream "pending" record. A review that reserved something would mean
   * a person who read it and walked away had still changed the world.
   *
   * The gateway calls this twice: once at prepare, and again at commit, and
   * refuses the commit if the answer has changed.
   */
  review(
    context: AdapterContext,
    input: ActionInput,
  ): Promise<{ title: string; details: { label: string; value: string }[] }>;

  /**
   * Ask what happened to an operation whose outcome was never seen, without
   * repeating it.
   *
   * The case: `execute` was called, the connection died, and nobody knows
   * whether the course was dropped. Retrying the execute could drop it twice.
   * So this looks the operation up by its idempotency key at the vendor and
   * reports what it finds.
   *
   * `null` means genuinely still unknown, and the gateway then tells the
   * student to wait rather than letting them submit again. Optional because
   * not every vendor can answer it — and where one cannot, the honest
   * behaviour is the 503 the gateway returns, not a guess.
   */
  reconcile?(context: AdapterContext, input: ActionInput, idempotencyKey: string): Promise<Receipt | null>;

  /**
   * Do it.
   *
   * Recheck the record's version and the authorization at the vendor's own
   * write boundary — the gateway checked both, but time has passed and the
   * gateway is not the system of record.
   *
   * Pass `idempotencyKey` to the vendor as *their* idempotency key. It is the
   * review's id, it is stable across retries, and it is what makes
   * `reconcile` able to find the operation later.
   *
   * Return `pending` when the school has accepted the request but not
   * completed it. `completed` means the institution says it is done.
   */
  execute(context: AdapterContext, input: ActionInput, idempotencyKey: string): Promise<Receipt>;
}
