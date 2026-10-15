# 4 · Engineering standards

For code under `kernel/`, `domains/`, `composition/`. Legacy is held to its
existing standards (`CLAUDE.md`, `docs/design/SEMESTER-CONTENT-STANDARDS.md`)
and is migrated into these as it is touched.

## Coding standards

- A file does one thing and says why it exists in its first comment. Comments
  explain *why*, not what, in the voice the repository already uses.
- Pure by default. A function of its inputs; side effects live in `adapters/`
  and `composition/`.
- No ambient: no `Date.now()`, `new Date()`, `Math.random()`, `localStorage`,
  `fetch`, `import.meta.env` in `domain/` or `application/` (tested).
- Types describe the domain, not the storage. Optional means "may be absent in
  the domain", not "may be missing from an old record" — that is the
  adapter's problem.
- Slice files ≤ 350 lines; a growing file is a missing concept.
- Names: use cases are verbs (`completeTask`), entities nouns, ports named for
  what they provide (`TaskRepository`, `CalendarSource`).
- User-facing strings obey the content ledger (`npm run lint` fails on
  retired words; "task" is retired in UI text, use "action").
- Every guard ships with the fault it guards against, shown red once.

## Error model

`kernel/errors.ts`. One shape everywhere: the ADR 0010 envelope, carried
inside the app.

```ts
{ kind: 'validation'|'forbidden'|'not_found'|'conflict'|'invariant'|'unavailable',
  code: '<slice>.<reason>',   // switchable, lower snake
  message: string,            // a sentence for the person
  retryable: boolean,         // true ONLY for 'unavailable'
  userAction?, correlationId? }
```

- Use cases return `Result<T, DomainError>`; they do not throw for expected
  outcomes. Throw only for bugs.
- `kind` chooses behaviour (inline message, sign-in prompt, retry), `code`
  chooses wording. A screen needs the first, a log the second.
- `retryable` is derived from `kind`, never passed, so a 4xx cannot claim it.
- `toEnvelope()` produces the wire shape for anything that leaves the process.
- Degraded is not failed. A connected calendar that is down is reported in
  `Agenda.unavailable`; the native day still draws. A native store that cannot
  be read fails the request.

## State machines

Any workflow where a wrong transition costs somebody something is a
`WorkflowDefinition` (ADR 0009): states, legal moves, terminals, exception
paths; no storage, no actions. The caller asks `transition(def, from, to)`
*before* it writes and writes what it was handed.

Pattern (from `tasks/domain/task.ts`): the machine is data; commands
(`complete`, `reopen`) call `transition` and return a `TaskChange` *value*;
the use case applies the change through the repository and then publishes an
event. Tests walk **every pair of states** and include a control the other way.
Ticking what is done is a `conflict`, not a silent no-op.

## Dependency injection

No container. A use case is `(deps) => (input) => Promise<Result>`. `deps` are
ports: small interfaces or function types declared by the consumer.

- `composition/domains.ts` is the only place ports meet implementations.
- Cross-slice needs are function types (`Guard`, `TodayInputs`), so slices do
  not import each other's use cases. Declaring a one-line `Guard` per slice is
  deliberate duplication: it costs a line and removes an edge.
- Tests pass arrow functions or in-memory fakes; `fixedClock('2026-10-08')`,
  `counterIds()`, `MemorySink` are in the kernel.

## Configuration

- Domains never read `import.meta.env`. The composition root reads the
  environment once, into a typed object, and hands each slice what it needs.
  26 legacy files read it directly today; the census tracks the number.
- Defaults are safe and off: a capability absent from configuration is
  unavailable, not guessed (the institutional authorizer refuses with no
  server facts).
- Behavioural switches are flags with the existing ladder
  `off → preview → sandbox → production` (`lib/experience-flags.ts`).
  Sensitive institutional features are enabled per tenant, never by a build flag
  (ADR invariant 9).
- Secrets never reach `app/src`; see `SECRETS.md`.

## Feature lifecycle

```
proposed ─ slice + tests ─ preview ─ sandbox ─ production ─ deprecated ─ retired
```

| stage | entry | exit evidence |
|---|---|---|
| proposed | a decision file `docs/decisions/D-<PR>.md` opened from a draft PR | owner, domain, data owner, source of truth |
| slice | domain, ports, adapters, front door | rules green; parity tests where it replaces something |
| preview | flag `preview`; seeded data | accessibility smoke; error, empty, loading and degraded states exist |
| sandbox | flag `sandbox` for named tenants | runbook, metrics, rollback drill |
| production | flag `production` | gates green on the release commit; no open red-circle review thread |
| deprecated | replacement live one release | usage near zero |
| retired | code deleted with its tests, screen unlocked from `legacy.json` | bundle diff recorded |

A capability is not "live" because it has a screen. Native data ownership,
authorization, audit, persistence, monitoring, recovery and export are the bar
(the earlier audit's completion standard); this lifecycle is how each is
checked, and `docs/CAPABILITY-ACTIVATION-REGISTER.md` is where status is
recorded.
