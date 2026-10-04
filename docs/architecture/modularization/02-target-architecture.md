# 2 · Target module graph, dependency rules, boundaries, anti-corruption layers

## The shape: a modular monolith with a hard inside

One deployable (the Vite app, the existing edge functions, the existing
institution gateway). Inside the app, code is organized by **domain**, not by
kind of file. Why not services: [ADR 0011](../0011-modular-monolith-before-services.md).

```
 L5  shell            main.tsx · App.tsx · screens.tsx · composition/
 L4  experience       screens/ · components/        (views only, over read models)
 ───────────────────────────────────────────────────────────────────────────
 L3  domains          domains/<name>/{index.ts, domain/, application/, adapters/}
 ───────────────────────────────────────────────────────────────────────────
 L2  kernel           kernel/   Result · DomainError · Clock · IdSource · EventSink
 L1  contracts        packages/contract · packages/institution   (@semester/*)
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
 legacy (the quarry; shrinks)   lib/ · state/ · ai/ · community/ · insights/ ·
                                intelligence/ · data/ · site/ · a11y/ · styles/
```

Imports point **down only**. The legacy block is reachable from a domain only
through that domain's `adapters/`. A screen reaches a domain only through
`composition/`. Nothing imports a slice's insides.

## Inside a slice

```
domains/tasks/
  index.ts            the public API: types, use-case factories, port types
  domain/             pure: entities, rules, the lifecycle machine.
                      imports: own domain/, kernel, @semester/* — nothing else.
                      no React, no storage, no clock, no env, no network.
  application/        use cases over ports. ports.ts holds the interfaces.
                      imports: domain/, application/, kernel, @semester/*,
                      and OTHER slices' index.ts. Never legacy, never adapters.
  adapters/           implementations of the ports over legacy code.
                      the ONLY place a slice touches lib/ or state/.
                      adapters/index.ts is the one deep path composition/ may import.
```

## Domains and ownership

Seventeen owners, assigned mechanically per file
(`src/architecture/inventory.ts`, output in `legacy-inventory.csv`). The five
in bold exist in this pull request.

| domain | owns | today lives mostly in |
|---|---|---|
| **identity** | who is asking: subject, role, school, capabilities | `lib/role`, `capabilities`, `profile`, `session*` |
| **policy** | may they: one question, one answer shape | `lib/role` gating, `featurepolicy`, `packages/institution/policy` |
| **tasks** | things to do, their lifecycle | `lib/chores`, `repeat`, `actions` |
| **calendar** | what is on a day, from every calendar | `lib/select`, `calsource`, `repeat` |
| **today** | the day as one read model | `lib/today-*`, `nextstep` |
| academic | degree, registration, grades, records | `lib/degree`, `registration*`, `gradebook/` |
| learning | study, assessment, course content | `lib/study*`, `quiz*`, `data/` |
| productivity | documents, sheets, decks, files | `lib/document`, `sheet*`, `deck*` |
| ai | assistant, gateway client, retrieval | `ai/`, `intelligence/`, `lib/claude` |
| campus | dining, housing, maps, athletics | `lib/dining/`, `athletics*`, `maps` |
| community | groups, mail, moderation | `community/`, `lib/mail*` |
| family | guardian relationships and sharing | `lib/family*` |
| career | opportunities, credentials, pathways | `lib/career*` |
| commercial | plans, billing, packaging | `lib/billing/`, `gtm/`, `plans` |
| institution | integrations, migration, console | `lib/integration/`, `university*` |
| trust-ops | governance, evidence, support, launch | `lib/governance/`, `ops/`, `trust/` |
| platform | storage, sync, routing, design tokens | `lib/cloud`, `state/`, `look`, `nav` |

The domain list is the one in the earlier audit, reduced to what the code
actually contains. Nothing was dropped: every requirement in that list maps to
a row, and the unassigned remainder is 22 files.

## Dependency rules (each one is a test)

1. `kernel/` imports nothing from the app.
2. `domain/` imports only its own `domain/`, the kernel, `@semester/*`; touches
   no browser global, clock, randomness, network or environment.
3. `application/` additionally imports other slices' **`index.ts`** only.
4. `adapters/` may import legacy *logic*, never a screen or component, and no
   third-party module (reach it through a legacy seam).
5. Nothing outside a slice imports past its `index.ts`; `composition/` may also
   import `adapters/index.ts`.
6. Slices form a DAG. Today depends on tasks and calendar; tasks and calendar
   depend on nothing; policy depends on nothing; identity depends on nothing.
   They coordinate through functions handed in by `composition/`, which is why
   `Guard` is a function type declared in each slice that needs it rather than
   an import of policy.
7. Legacy may not gain an import that points up the layer order, and may not
   gain a cycle (ratchet, `legacy.json`).
8. A screen listed in `legacy.json` as locked imports no `lib/` or `state/`.
9. A slice file stays under 350 lines; every slice has a front door and tests;
   error codes start with the slice's name.

## Anti-corruption layers

An ACL is an adapter whose job is **translation and refusal**, not forwarding.
Four concrete ones exist:

| adapter | legacy it wraps | what it translates or refuses |
|---|---|---|
| `identity/adapters/legacy.ts` | `roleOf`, `forSchool` | unknown stored role → default; only grants over exactly the person's school count |
| `tasks/adapters/legacy.ts` | `PersonalTask`, `chores.tick`, `repeat.nextAfter` | 8-field record → 5-field `Task`; changes applied by the legacy `tick`, so legacy knowledge (steps reset) is borrowed not copied |
| `calendar/adapters/legacy.ts` | `appointmentsOn`, `appointmentLength`, `DatedItem` | repeats expanded by the legacy rule; "no hour" (24×60) → all-day; deadlines occupy no minutes |
| `today/adapters/legacy.ts` | `todayActions`, `actions.rank` | the Action Center's `Action` → six fields Today draws; one ranking, not two |

Where the legacy model is wrong for the domain, the adapter is where it is
fixed: the domain never inherits a shape it would have to apologise for.

## Ports

Function types and small interfaces, declared by the consumer, implemented by
an adapter, handed in by the composition root. No DI container: plain
functions are enough at this size and are easier to read in a stack trace.
See [04](04-engineering-standards.md).

## Coexistence

Both structures run at once. Legacy code may import a slice's `index.ts`
(that is how a screen migrates); a slice reaches legacy only through its
adapters, which read the **same** stores the legacy screens write. So there is
no data migration in the first phases, and rolling back a screen is a flag.
