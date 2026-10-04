# 03 · Retrieval policy

**Builds on:** [`../trust/AI-DATA-USE-STANDARD.md`](../trust/AI-DATA-USE-STANDARD.md),
[`../ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md`](../ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md),
[`../ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md`](../ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md),
`app/src/ai/untrusted.ts`, `app/server/institution/intelligence-repository.ts`,
`supabase/migrations/20260923210000_intelligence_policy.sql`.

Retrieval is the point where the model meets data it was not trained on, and so the point where authorisation,
provenance, freshness and injection all arrive at once. This chapter says what the gateway may send a model, from
where, how fresh, and what it does about text that is trying to give the model orders.

## What exists, as verified

There is no retrieval service. **Retrieval today is selection**: the client names up to 100 `sourceIds` and the
gateway checks each. That is a smaller thing than retrieval, and the checks it does are strong.

| Control | State |
| --- | --- |
| Every requested source must be approved for this tenant; one that is not refuses the whole request (`source-not-approved`) | built |
| `tenant_id` comes from the verified identity; `authority = 'prohibited'` sources are excluded in the query | built |
| Each source needs an institution-approved **policy binding**: `institution`, or a course code and term matching `^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$` and `^[0-9]{4}(FA\|SP\|SU)$`. A client-asserted course or term is a consistency hint and never selects a policy | built |
| Tutor and course-guide roles need sources from exactly one course, matching the selected one | built |
| Course AI policy loaded per scope, **unknown policy permits concepts only**; an unloadable policy is `503`, not a default | built |
| Evidence ids returned are the intersection of those requested, those the sources own, and those the provider cited | built |
| Provider-cited source ids must all have been requested, else the answer is invalid | built |
| Sources travel as JSON in the user turn; the answer is schema-locked; the instruction turn says sources are data | built (the last in this change) |
| Content, not just metadata, is read through `load_approved_source_content` after the metadata check | built |

Four things it does **not** do, each verified in code and each a requirement below:

1. **`verifiedAt` is not a verification date.** It is `approved_source.updated_at`, the last time the metadata row
   changed. The provider is told a source was "verified at" a time nobody verified it, and nothing refuses a stale
   one. (`RP-04`)
2. **`authority` is selected and dropped.** `authoritative` and `supplemental` are columns the loader reads and never
   maps into the source the model sees, so the model cannot say which is which. The course-guide instruction asks it to
   label unapproved material "student-selected"; it has nothing to base that on. (`RP-03`)
3. **Whole bodies, unbounded before the call.** There is no chunking, ranking or input-size bound. The budget
   reservation is a flat estimate per model; an over-ceiling response is discarded after it was paid for. (`RP-05`)
4. **No classification column.** `approved_source` has no data tier, and the server never imports
   `toolkit/classification.ts`, whose own doc says "the phase that adds generation must call the gate on the server".
   (`RP-02`)

## The retrieval contract

One service, one function, used by every route class.

```
retrieve(identity, query, scope) → RetrievalSet
  items[]  { sourceId, chunkId, versionHash, text, anchor, origin, authority,
             classification, verifiedAt, validUntil, license, owner }
  policy   { decision, version, courseScopes[], modes[] }
  dropped[]{ sourceId, reason }          // why a candidate did not make it, never its text
  hash                                    // over the item ids and versions, for the audit
```

`dropped` is part of the contract on purpose. A retrieval that silently returns less is how a student gets a
confident answer from half the policy.

## Authorisation-filtered retrieval

**Filter before you rank, and again before you send.** Authorisation is an input to the index query, never a
property the model is asked to honour.

1. **Attributes on every chunk:** tenant, course and section, term, audience (roles), embargo and release time,
   classification, legal-hold flag, owner, origin and authority.
2. **The filter is built from the identity, never the request:** tenant, enrolled sections, role, age and consent
   status. A request supplies a *query* and *hints*; it does not supply the predicate.
3. **Pre-filter in the index.** A chunk the user may not see is never a candidate, so it cannot be a near-miss that a
   re-ranker or a log line carries out.
4. **Post-check at assembly** against the central policy decision (authorisation, classification gate, course policy),
   as defence in depth: a divergence between index and policy is a P0 signal, not a silent drop.
5. **Tenant partition is physical for the strictest customers**: a namespace per tenant at minimum; a separate index
   for tier 3 or a customer's contract. A cross-tenant query is not expressible, rather than expressible and filtered.
6. **Embeddings and indexes are derived data.** Same classification, retention, deletion propagation and data zone as
   their source. A source deleted or placed on hold is removed from the index inside the deletion SLA, and the audit
   records that it was. T3 and above are never embedded by default.

## Provenance

Every chunk the model sees carries where it came from, and the answer carries it back.

| Field | Meaning | Today |
| --- | --- | --- |
| `sourceId`, `chunkId`, `versionHash` | What exactly, at which version. A superseded version is never retrieved | id only |
| `anchor` | Page, section or timestamp the claim rests on | `citation_label`, free text |
| `origin` | `course`, `institution`, `library`, `web` | built |
| `authority` | `authoritative`, `supplemental` (`prohibited` never retrieved) | read, dropped (`RP-03`) |
| `verifiedAt` | When a **person** last confirmed it | mislabelled `updated_at` |
| `owner` | Who answers for it | `created_by` |

The answer's provenance panel ([chapter 09](09-user-transparency.md)) shows these. A claim with no chunk behind it is
labelled **general knowledge**, never presented as from the course. The existing instruction to cite titles and
anchors, state missing or stale information and not invent citations is kept; the data makes it possible to obey.

## Freshness

Freshness is a property of the *source class*, set by the institution inside bounds Semester sets, and enforced at
retrieval rather than hoped for in the prompt.

| Class | Default `validUntil` (a proposal for the owner to ratify) | If stale | If missing |
| --- | --- | --- | --- |
| Course policy and syllabus | End of the term, or until superseded | Answer with an "as of" label and the date | Concept-only mode, as unknown course policy already behaves |
| Dates, deadlines, schedules | Authoritative record read through a tool, **not** retrieval; if retrieved, 24 hours | Exclude; read the record | Say it is unknown and where to look |
| Catalog and requirements | The catalog year | Label the year | Refuse a requirement claim; route to the advisor |
| Library and published references | As set by the library | Label | Omit |
| Web | Not used by default (`web_sources_allowed` defaults false) | n/a | n/a |

Rules: a source past `validUntil` is **excluded and reported in `dropped`**, not sent with a warning the model may
ignore; the answer says it left something out. A date the app already holds authoritatively is answered from the
record by a tool and not from a retrieved paragraph that may be older. `validUntil` and a real `verified_at` and
`verified_by` are new columns on `approved_source`.

## Data minimisation and redaction

1. **Send the least.** Top-*k* chunks under a per-mode token cap, never a whole document. The cap is checked before
   the call and the reservation is sized from it.
2. **Pseudonymise people.** Student and staff identifiers, names and emails in retrieved text and in the request are
   replaced with opaque handles for the model; the map stays server-side and is applied when rendering. A provider's
   logs then hold handles.
3. **Detect, then block or redact, before the call:**

| Detected | Action |
| --- | --- |
| Credentials, API keys, tokens, payment card numbers, government identifiers | **Block.** No AI purpose authorises sending them; the user is told to use the secure route |
| Contact details, student ids | Redact unless the task needs them |
| Health, disability or accommodation, counselling, immigration, discipline, financial-aid content | **Refuse the AI route** and offer the human route; exceptional written approval only |
| Classification T3 and above | Refuse; the institution-approved workflow is named |

4. **Scan the output** for redacted handles and planted canaries and for anything shaped like the blocked classes.
5. The classification gate runs **on the server**, in the pipeline (S2), over every chunk and the question; the
   client gate (`gate()`) remains as the first line, not the only one.

## Prompt-injection resistance

A source is untrusted input even when an institution approved it: an instructor's page can be edited, a PDF can carry
hidden text, an announcement can be forwarded from outside. The structural defence is necessary and is not claimed to
be sufficient: **a fence is a guarantee about the prompt, not about the answer.** So the controls are layered, and
each is tied to an attack it stops and a test that would notice it failing.

| Layer | Control | Stops | State |
| --- | --- | --- | --- |
| 1. Separation | Instructions never contain source text. Consumer: `fence()` with tags the material cannot close, `DATA_RULE` once. Institutional: JSON in the user turn, schema-locked output, `SOURCE_DATA_RULE` once. A test shows the instruction turn is byte-identical for benign and hostile material | Material altering instructions | built, tested on twelve injection-shaped strings and every consumer builder |
| 2. Normalise | Strip zero-width and bidirectional controls, flatten HTML comments, normalise Unicode, treat text recovered from images and PDFs as material | Hidden and obfuscated instructions (the corpus already carries a right-to-left override) | partial: the corpus tests it; no normaliser on ingest |
| 3. Screen on ingest | A detector over uploaded and approved sources for instruction-shaped content; flagged sources are **quarantined** and shown to an admin, not silently dropped | Poisoned sources entering the index | not started |
| 4. Trust labels | Handling by origin: `web` and student uploads least trusted; institution-published trusted *as data*, still fenced | Treating a source's authority as permission | origin exists; handling does not vary |
| 5. Least privilege | The model's tool set is the agent's and mode's, not the source's; tools ignore identity values from model output ([chapter 04](04-tool-broker.md)) | A source that asks for a tool call | built on the consumer side (`toolscope.ts`) and for the roles (`agentAllows`) |
| 6. Output contract | Schema-locked; every cited id was requested; no URL, image or markdown link in an answer that is not in a source or on an allow-list | **Exfiltration through a rendered link or image** | schema and ids built; link and image rule not started |
| 7. No secrets in context | Nothing in a prompt a model could usefully leak: no keys, no other users' data, no hidden policy beyond what the user may see | Prompt extraction | designed |
| 8. Canaries | A planted token in system prompts and test sources; any appearance in output is an incident signal | Silent leakage, and a measurable red-team result | not started |
| 9. Per turn | Fence again on every turn; **tool results are data** and fenced; a model's earlier output is not instruction | Multi-turn and tool-result injection | consumer partially |
| 10. Evidence | Live-model red-team on the route, per model and prompt change | The claim that the above works | one 21-case run, consumer route only |

The honest summary for a buyer: separation is tested and holds as a structural property; **behaviour against a live
model on the institutional route has never been red-teamed**, and the consumer run (2026-09-29, 21 cases, no
canary followed) is a point-in-time artifact, not a standing guarantee.

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `RP-01` | Retrieval service with the `RetrievalSet` contract, including `dropped` | **the assembly step is tested as a pure function** (`assemble`, `packages/institution/src/retrieval.ts`: items, `dropped` with reasons and no text, a `key` for the audit, a `crossTenant` flag); the index and the service around it are not built, and nothing is wired |
| `RP-02` | Classification gate on the server over every chunk and the question; `classification` column on sources | **the gate is tested as a pure function** and held equal to the toolkit's `gate(tier, 'ai', courseAllowsAi)` for every tier, both course policies and an unclassified source (`ai-retrieval.test.ts`); the column does not exist and the question is not yet gated, so nothing is wired |
| `RP-03` | `authority` and `origin` reach the model and the provenance panel | **carried on every assembled item** (tested); the loader still drops `authority` and the provider does not yet print it |
| `RP-04` | A real `verified_at` and `verified_by`; `validUntil`; stale sources excluded and reported | **exclusion and reporting tested** (last valid day sent, the day after dropped as `stale`; unverified dropped when required; an undated source flagged); the columns do not exist and `verifiedAt` is still `updated_at` |
| `RP-05` | Chunking, top-*k* and a per-mode input cap, checked before the call; reservation sized from it | **the count and size bound is tested** (overflow dropped as `budget`, text never truncated); no chunker exists and the reservation is not yet sized from it |
| `RP-06` | Authorisation as an index pre-filter built from identity; post-check at assembly; divergence is a P0 signal | designed |
| `RP-07` | Embeddings and indexes follow their source's classification, retention, deletion, hold and zone | designed |
| `RP-08` | Resolve the assistant's T3 lookups: either route `read_grades` and `read_attendance` through the gate with explicit per-school consent, or document them as the student's own data under the student's own key and refuse them on any institution-directed consumer route | not started; recorded as the `reconcile` on `AI-01.1` |
| `RP-09` | Pseudonymise people in prompts; map server-side | not started |
| `RP-10` | Pre-send detectors with block, redact and refuse actions; post-send scan | not started |
| `RP-11` | Ingest-time injection screen with quarantine and admin review | not started |
| `RP-12` | Link, image and markdown allow-list on model output | not started |
| `RP-13` | Canary tokens in system prompts and test sources, with an alert | not started |
| `RP-14` | Instruction/data separation tested on every route, on every builder, with a control that fails a builder that writes material as prose | **tested** (`injection.test.ts`) |
| `RP-15` | Live red-team of the institutional route before any tenant | not started |
