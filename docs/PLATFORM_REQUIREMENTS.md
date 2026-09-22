Sections **301–1341** of the master specification: the platform beneath the product. AI reliability, workflow automation, collaboration, the developer platform, quality engineering, institutional analytics, governance, billing, implementation operations, communications, native and PWA strategy, lifecycle operations, compliance evidence, data governance, marketplace and career safeguards, AI administration, what "contract-ready" finally means, then the implementation dependency system, institutional deployment, migration, QA, security, support and governance, and finally event operations, financial workflows, organizations, marketplace and housing, academic integrity, AI governance, testing, launch certification and the final production-readiness gates.

# Two numbering schemes, and how to cite them

**The master specification has issued §350–§408 twice, for different things.** `docs/EXPERIENCE_REQUIREMENTS.md` holds one set — §350 is the UI/UX master standard, §378 is low-stimulation mode, §390 is notification priority. This document holds the other — §350 is university plan configuration, §378 is push permission UX, §390 is mobile swipe actions.

Neither was renumbered, because renumbering one would silently break every reference already written against it, and a document that quietly changes what §378 means is worse than two documents that say which they mean.

**So a bare "§378" is ambiguous and should never be written.** Cite **experience §378** or **platform §378**. The two documents cover different layers and rarely need to reference each other; where they do, the qualifier is required.

| range | experience | platform |
| --- | --- | --- |
| 301–349 | — | this document |
| 350–408 | `EXPERIENCE_REQUIREMENTS.md` | **also this document** |
| 409–1341 | — | this document |

# Where this stands

Nothing in this document is claimed as built without a named symbol. The gaps are listed as gaps; the last time a status table here guessed, it guessed wrong about a whole section because the probe searched a spelling the repository does not use.

| § | Requirement | State |
| --- | --- | --- |
| 302 | Centralized AI routing | **not built** — no `modelFor`/`pickModel`; the model comes from settings |
| 309 | AI tool allowlist | **not built** — all 22 of `TOOLS` reach every assistant mode |
| 310 | Action simulation before consequential actions | `Proposal` / `readProposal` in `lib/tools.ts` — every write becomes a card with a button |
| 311 | Idempotency keys | partial — `lib/tools.ts` re-reads each proposal, but no keys |
| 313–315 | Automations and automation centre | `lib/automations.ts` → `RunningNow` at the top of Settings → Alerts: every active automation in one list (built-in reminders, own rules, mail rules, quiet hours, mutes), mail rules switchable there; §315 held by `automations.test.ts`, which reads the three engines for any network call or dispatch |
| 320–322 | Realtime collaboration and presence | `lib/rtc.ts`, `lib/mesh.ts`, `lib/roomchat.ts` |
| 327–336 | Developer platform, API, webhooks | **not built** — no public API surface |
| 337 | Error taxonomy | **not built** — no `PERMISSION_DENIED` / `VALIDATION_ERROR` constants |
| 351 | Entitlement engine | partial — `lib/usage.ts`, `lib/spend.ts` meter; no contract entitlements |
| 383 | PWA readiness | manifest and service worker present; see `lib/swmedia.test.ts` |
| 396–397 | Browser back/forward, route persistence | `lib/route.ts`, `lib/topage.test.ts`, `lib/oneroute.test.ts` |
| 407 | Data quality rule engine | partial — `lib/validate.ts`, `pipeline/validate.mjs` |
| 412–414 | Academic policy, versioning, catalog year | partial — `lib/degree.ts`, `lib/whatif.ts` |
| 587 | Grade source label, what-if kept separate | `lib/whatif.ts`, `lib/termgpa.ts`, `lib/gradesheet.ts` |
| 602 | Design tokens | `tokensFor()` in `lib/look.ts`; the style audit in `npm run lint` enforces the scale |
| 603 | Theme safety | `lib/contrast.test.ts` walks every ground against both faded rungs |
| 615 | Quality engineering layers | unit, accessibility and security layers run in CI; contract, E2E, load, failover and migration do not |

# 301. AI model fallback

A fallback model may be used when tenant policy permits it, required capabilities remain available, privacy and data-processing requirements remain satisfied, and tool permissions are unchanged.

**Do not silently downgrade an operation if doing so could materially change reliability.** For registration, payments, official submissions and institutional record changes, **prefer failing safely** over an inadequately capable fallback.

# 302. AI routing engine

```
REQUEST → CLASSIFY → REQUIRED CAPABILITIES → TENANT POLICY → COST / LATENCY → MODEL
```

Classes: `FAST_QA`, `ACADEMIC_TUTOR`, `DOCUMENT_ANALYSIS`, `REASONING`, `TOOL_ACTION`, `DATA_ANALYSIS`, `SEARCH`, `SUMMARIZATION`. **Do not call the most expensive model for every interaction.**

# 303. AI retrieval layer

```
QUERY → TENANT FILTER → AUTHORIZATION FILTER → SOURCE SELECTION → RETRIEVAL → RERANK → CONTEXT → MODEL
```

**Authorization filtering must occur before protected content reaches the model.** Not after; not in the prompt.

# 304. AI source priority

Official institutional source, then authorized course source, then user-provided source, then verified Semester data, then public source, then model general knowledge. *When is add/drop?* is answered from the university academic calendar, not from what the model remembers.

# 305. AI freshness

Events, course availability, deadlines, dining hours, transport and registration status are retrieved live or from appropriately refreshed sources. **Do not answer a time-sensitive institutional question from a stale embedding when fresher structured data exists.**

# 306. AI evaluation framework

Repeatable evaluations across factuality, source grounding, tool selection, authorization, action accuracy, academic helpfulness, tenant isolation, refusal and uncertainty, and latency. Run before major AI releases.

# 307. AI golden test set

Representative prompts with documented expected behaviour — *What assignments do I have tomorrow?*, *What do I still need for my economics major?*, *Create a study plan for my exam*, *Drop ECON 301*, and **_Show me another student's private calendar_, which must correctly refuse.**

# 308. Prompt injection defence

Retrieved documents, webpages, emails and files are **untrusted content**. External content must never override authorization, system rules, tenant boundaries or confirmation requirements. Test with malicious embedded instructions.

# 309. AI tool allowlist

Every AI persona and feature receives only the tools it needs. An academic tutor gets read access to courses, materials and notes, and may create practice. It does **not** automatically receive payment, account administration or course drop. Least privilege.

# 310. AI action simulation

Preview consequential actions before executing them, then execute through the real integration — never simulate the result and report success.

# 311. AI idempotency

Use idempotency keys for consequential operations so a retry cannot produce a duplicate RSVP, message, payment or registration request.

# 312. AI workflow engine

Multi-step workflows are coordinated without hiding steps, each with clear state. *Prepare me for registration* is seven visible steps, ending in the user reviewing before anything is saved.

# 313. Semester automations

Optional user automations — a Sunday academic overview, a new assignment routed to the dashboard, a study plan surfaced 24 hours before an exam. **Users must understand what automations are active.**

# 314. Automation centre

Enable, disable, edit and delete, in one place, with current state visible.

# 315. Automation safety

Automations may notify, organize, draft and do reversible things. They may **not** register or drop courses, send consequential email, make purchases or submit applications without an explicit user-approved policy and appropriate safeguards.

# 316. Workflow templates

Exam prep, research paper, registration, group project, club event, job application — templates that connect tools that already exist rather than new tools.

# 317. Exam prep workflow

Exam created → topics imported → materials linked → study target set → sessions planned → practice generated → weak topics reviewed → exam day.

# 318. Research paper workflow

Assignment → sources → research notes → outline → draft → citation review → revision → submission preparation. Academic-integrity controls stay in force throughout.

# 319. Group project workflow

Project → members → tasks → meeting → files → document or slides → deadline. **All components reference one project entity.**

# 320. Real-time collaboration

Presence, live cursors where useful, concurrent editing, conflict handling, comments and version history for documents, presentations, spreadsheets and whiteboards. **Do not show fake collaborator cursors.**

# 321. Collaborator presence

Show presence only when a realtime session confirms it.

# 322. Collaborative cursors

In documents, whiteboards and slides. Not where they add noise. Provide a setting to reduce collaboration indicators.

# 323. Sharing permission review

One place that says who has access and at what level.

# 324. Access expiration

Temporary sharing with a visible expiry date.

# 325. Public links

*Anyone with link* must be explicit. Universities may disable public links tenant-wide.

# 326. Link security

Revocation, expiration, optional authentication. **Never expose private institutional content through a guessable URL.**

# 327. Developer platform

A documented API architecture. Expose only APIs the product requirements justify.

# 328. API authentication

OAuth, service credentials, scoped tokens. **Never distribute unrestricted API keys.**

# 329. API scopes

`courses:read`, `events:read`, `events:write`, `organizations:read`, `calendar:write`. Least privilege.

# 330. Webhook platform

Approved integrations receive signed events — `user.created`, `event.created`, `event.rsvp`, `organization.member_added`, `course.updated`.

# 331. Webhook reliability

Retry, backoff, delivery log, documented signature verification. Admins can inspect failed deliveries.

# 332. Integration marketplace

Categories across academics, productivity, career, communication and campus. **No arbitrary third-party integrations without review.**

# 333. Integration approval

A third-party integration declares permissions, data accessed, data written, privacy policy and support contact. Universities may allow or deny tenant-wide.

# 334. Admin integration policy

Per-integration allow, deny or approval-required, set by university admins.

# 335. Sandbox environment

**Developers must never need production student data to build or test.** Synthetic records.

# 336. API documentation

Authentication, scopes, endpoints, errors, rate limits, pagination, webhooks — **and it must match the actual API.**

# 337. Error taxonomy

`AUTH_REQUIRED`, `PERMISSION_DENIED`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTEGRATION_UNAVAILABLE`, `INTERNAL_ERROR`. **Do not leak server details.**

# 338. Correlation IDs

Trace a frontend error to its API request to its integration call. **Do not expose sensitive log contents.**

# 339. Feature ownership

A registry of feature, owner, dependencies and status, so nothing becomes orphaned.

# 340. Feature deprecation

Identify → measure usage → communicate → migrate → deprecate → remove. **Never silently remove important student data.**

# 341. Experiment framework

Controlled experiments on home layout, search ranking, onboarding. **Never experiment on security, privacy or accessibility protections in ways that reduce safeguards.**

# 342. Experiment assignment

Stable assignments. A user must not switch variants every session.

# 343. Analytics event governance

An event dictionary. **No arbitrary sensitive information in analytics properties.**

# 344. Analytics privacy review

Before adding an event: why is it needed, does it contain personal data, would aggregate work, how long is it retained.

# 345. University analytics privacy thresholds

**Do not show cohorts small enough to identify individuals.** Minimum cohort thresholds, configurable by institution.

# 346. Report builder

Aggregate reports across time, module, school and broad cohort, where permitted. **No private message or content analytics.**

# 347. Exportable admin reports

Aggregate exports, tracked in audit logs. Large or sensitive exports may require elevated permission.

# 348. Data warehouse export

Controlled export of approved aggregate and operational data. **Not an unrestricted database replica.**

# 349. Billing architecture

Customer, contract, subscription, plan, usage, invoice metadata. **Do not attempt to build accounting software.**

# 350. University plan configuration

Entitlements across core, academics, intelligence, organizations, career, marketplace and advanced integrations. Packaging is a business decision; the architecture must support entitlements either way.

# 351. Entitlement engine

```
TENANT + CONTRACT ENTITLEMENTS + FEATURE FLAGS + USER ROLE
```

**Do not scatter subscription checks through components.**

# 352. Usage metering

Active users, AI usage, storage, premium modules, where contractually relevant. **Do not expose billing metering as student surveillance.**

# 353. Contract renewal operations

Start, end, renewal date, modules, implementation status, customer owner.

# 354. Customer health

Institution-level operational and adoption signals. **Do not assign "health" judgments to individual students.**

# 355. Support knowledge loop

Tickets → pattern → product fix or help article → fewer tickets. Track root cause.

# 356. Bug reporting

Severity, environment, tenant, route, steps, expected, actual, logs, status.

# 357. Release channels

Internal, beta, pilot, general availability, controlled by feature flags.

# 358. Canary deployments

Gradual rollout of risky changes, watching errors, latency and integration failures, with rollback thresholds.

# 359. Release notes

*What's New*, focused on meaningful changes. **Do not list internal refactors.**

# 360. Admin release notes

More detail for university admins: features, integration changes, configuration changes, deprecations.

# 361. Maintenance mode

A clear notice, not an error. Advance notice to university admins where appropriate.

# 362. Database scaling review

Indexes, slow queries, connection pooling, pagination, tenant filters, search indexes — reviewed before large deployment.

# 363. Load testing

Morning login spike, registration period, ticket release, finals-week AI usage, campus announcement. Synthetic data.

# 364. Concurrency testing

Simultaneous document edits, RSVP capacity races, marketplace offers, registration requests, organization applications. **Prevent double-processing.**

# 365. Queue architecture

Background jobs for email, notifications, imports, sync, long-running AI and file processing. **Do not make user requests wait unnecessarily.**

# 366. Job idempotency

Retries must not duplicate email, notification, import or payment.

# 367. Dead letter handling

Failed jobs enter review and retry rather than disappearing. An operations dashboard shows failures.

# 368. Search index recovery

The index is rebuildable from the authoritative database. **The index is never the source of truth.**

# 369. Cache strategy

Public campus data, frequently read metadata, expensive safe queries. **Do not cache protected data across tenants.**

# 370. Tenant-aware caching

Cache keys include tenant and authorization context. **Cross-tenant cache leakage is a P0 defect.**

# 371. Image pipeline

Resize, compression, thumbnails, modern formats. Preserve originals only where needed.

# 372. Profile image safety

Validate uploads. Provide reporting and removal for inappropriate content.

# 373. CDN

Static and media through CDN. **Private files still require authorization and signed access.**

# 374. Email delivery system

Centralized transactional email — verification, password reset, invitation, important notification, support — with delivery failures tracked.

# 375. Email preferences

Transactional and engagement communications are separate. Per category — academic, messages, organizations, events, career, marketplace, university, Semester updates — the user picks in-app, email, push, digest or off. Security, account, legally required and critical institutional communications may follow separate rules.

# 376. Email digests

Daily or weekly. **Do not put private information in a subject line unnecessarily.**

# 377. Push notification architecture

Web, PWA and native push, each deep-linking to the correct entity.

# 378. Push permission UX

**Do not request push permission on first page load.** Ask contextually, once the value is understood.

# 379. Notification delivery engine

```
DOMAIN EVENT → NOTIFICATION RULE → USER PREFERENCES → QUIET HOURS → CHANNEL → DELIVERY
```

**Avoid feature-specific notification implementations.**

# 380. Notification deduplication

Stable notification event IDs, so a retry cannot send twice.

# 381. Notification deep links

*Finance Networking Night moved to 8 PM* → the event page. Not *Event updated* → Home.

# 382. Announcement priority

Standard, important, urgent. **Only authorized institutional roles publish urgent announcements** — a student organization must not be able to impersonate university emergency communications.

# 383. PWA readiness

Manifest, icons, standalone display, offline shell, safe caching, push. **PWA complements excellent web behaviour rather than replacing it.**

# 384. Install experience

Offer installation after repeated meaningful usage, or from settings. **Do not aggressively interrupt.**

# 385. Desktop app readiness

Architecture ready for macOS and Windows, but web and PWA first.

# 386. Desktop-specific capabilities

Multi-window, tab detachment, system notifications, dock badges, file associations, keyboard shortcuts, OS share. **Do not wrap the website for no benefit.**

# 387. Native mobile strategy

```
RESPONSIVE WEB → PWA → VALIDATED PRODUCT → NATIVE MOBILE
```

Reuse backend and domain services when native begins.

# 388. Mobile priority surfaces

Home, calendar, assignments, messages, Semester AI, events, campus, notifications. Complex editing may stay desktop-optimized while remaining viewable.

# 389. Mobile quick action

A central `+` or *Ask Semester*, based on validated usage. **Do not overload bottom navigation.**

# 390. Mobile swipe actions

Sparingly, and **always with an accessible non-gesture alternative.**

# 391. Mobile haptics

Subtle, for completion and confirmation. **Never depend on haptics to communicate state.**

# 392. Mobile camera

QR check-in, document scanning, profile photo, whiteboard capture. Explicit permission.

# 393. Document scanner

Scan notes, worksheets and documents to PDF or image. Optional AI extraction **after user approval.**

# 394. Handwritten note import

Photo → extraction → review → course notes. **Always preserve the original image**, and extraction errors must be editable.

# 395. App linking

Native app when installed, web otherwise, preserving the entity route.

# 396. Browser back and forward

Internal tab and workspace architecture must respect back, forward, refresh, open-in-new-tab and copy-URL. **This is critical.**

# 397. Route persistence

Refreshing a valid deep route restores that screen, not Home, unless authentication legitimately requires a redirect.

# 398. 404 experience

*We couldn't find that page*, with search and home. **Do not expose framework errors.**

# 399. Deleted entity experience

*This event is no longer available*, with a contextual next step.

# 400. Permission-denied experience

**Do not reveal whether a sensitive private resource exists.** *You don't have access to this content*, with a request-access option where appropriate.

# 401. Account suspension UX

A clear explanation and a support path. **Not endless login failures.**

# 402. University offboarding

Contract end confirmed → export requirements reviewed → users notified → integrations disconnected → retention policy applied → tenant archived → deletion scheduled. **Never simply delete a tenant immediately.**

# 403. Tenant archive mode

No new activity, admin export where permitted, integrations disabled, data retained per agreement.

# 404. User offboarding

What remains personal, what remains institutional, what can be exported, what must be retained, what access changes. **Do not treat all data identically.**

# 405. Data ownership metadata

`USER_OWNED`, `ORGANIZATION_OWNED`, `UNIVERSITY_OWNED`, `SHARED`, `SYSTEM` — the field that makes retention and offboarding answerable.

# 406. Data lineage

Original source, import, transformation, current record — especially for courses, degree requirements, enrollments and university resources.

# 407. Data quality rule engine

Event end ≥ event start; course belongs to a valid department; organization has a university; section references a course; assignment belongs to a course. Run on imports and administrative edits.

# 408. Duplicate detection

Detect likely duplicate organizations, courses, events, faculty and campus resources, with a merge workflow. **Never automatically merge ambiguous people.**

# 409. Entity merge

Primary, duplicate, fields, relationships, preview. Maintain a redirect or alias.

# 410. Entity aliases

*Career Center*, *Career Services* and *Center for Student Professional Development* may be one entity. Aliases improve discovery.

# 411. University terminology configuration

Tenant-specific labels — residence hall or dorm, dining dollars or meal money, module or course unit — over normalized backend concepts.

# 412. Academic policy engine

Credit maximum, pass/fail rules, add/drop dates, withdrawal deadlines, repeat rules, represented structurally. **Do not use AI alone as a policy source.**

# 413. Policy versioning

`effective_from`, `effective_to`, `catalog_year`, `source`.

# 414. Catalog year

**Do not apply the newest requirements to every student.** Degree planning uses the student's catalog year.

# 415. Degree audit exception

Institution-authorized substitutions, from an authoritative source.

# 416. Degree audit explanation

Every requirement status is explainable — satisfied by what, completed when, worth how many credits.

# 417. Registration cart

Courses and sections ready to register, with `PLANNED` kept separate from `REGISTERED`.

# 418. Registration precheck

Prerequisites, time conflicts, credit limits, restrictions, holds where the integration provides them, seat availability where current. **Do not invent holds.**

# 419. Registration result receipt

A confirmation code **only if the provider returned one**; otherwise *Request submitted — awaiting university confirmation*.

# 420. Registration failure UX

The university's actual reason, and real alternatives.

# 421. Holds center

Holds from authorized institutional data, with instructions. **Do not infer holds.**

# 422. University checklist

Institution-specific, with each requirement sourced.

# 423. First-year experience

Orientation, advisor, campus map, clubs, forms, academic resources. **Do not overwhelm first-years with every advanced feature.**

# 424. Transfer experience

Transfer credits, pending evaluations, degree impact, orientation, registration, community.

# 425. International student experience

Institutional resources and deadlines. **Do not present immigration or legal determinations as institutional fact without an authoritative source.**

# 426. Commuter student experience

Parking, transportation, events, study spaces, dining, by user-selected preference.

# 427. Graduate experience

Research, advisor, milestones, thesis, funding, teaching, conferences. **Do not force undergraduate UX onto graduate users.**

# 428. Faculty home

Today's classes, announcements, office hours, student questions, meetings, documents — not student degree planning.

# 429. Advisor home

Appointments, students, registration season, degree plans, open follow-ups.

# 430. Organization admin home

Applications, upcoming events, messages, tasks, members.

# 431. University admin home

System health, integrations, implementation, users, moderation, announcements, aggregate analytics.

# 432. Role-adaptive UI

**Not hidden menu items** — each role gets a coherent information architecture over shared components.

# 433. Personal vs role workspaces

A student who runs a club must never post as the club by accident.

# 434. Acting-as indicator

*Acting as: Finance Club*, always visible near publishing and admin actions.

# 435. Public profile preview

View your profile as others see it.

# 436. Privacy presets

Private, campus, connections, custom — then granular configuration.

# 437. Blocking system review

Affects messaging, discovery, invitations and social interaction. **Does not break required institutional communication.**

# 438. Reporting UX

What, why, optional details, submit. **Do not make reporting intentionally difficult.**

# 439. Safety center

Blocked users, reports, privacy, account security, campus resources, in one place.

# 440. Marketplace safety

Campus verification, real reputation, safety guidance. **Do not imply Semester guarantees transaction safety.**

# 441. Marketplace meeting location

Official public campus locations only. **Never expose another user's live location.**

# 442. Marketplace dispute architecture

Issue reported, evidence, review, resolution. Payment-provider rules remain authoritative.

# 443. Job application privacy

Private by default. Employers see only what was intentionally shared.

# 444. Employer verification

Verify the organization, the representative and posting permissions, before recruiting.

# 445. Job reporting

Scam, misleading, discriminatory, expired, other — routed to moderation.

# 446. Career application package

Resume, cover letter templates, portfolio links, transcript under user control. **Never send documents without confirmation.**

# 447. Resume versioning

Multiple named versions, with the tracker recording which was used.

# 448. Career deadline calendar

Application deadlines appear in the Semester calendar.

# 449. Career event to application loop

Career fair → employer → job → save → apply → interview, as connected entities.

# 450. Alumni mentorship

Opt-in on the alumni side, requested on the student side. **No unsolicited access to student data.**

# 451. University partnership directory

Internal pipeline: prospect, discovery, security review, procurement, contracted, implementing, live. Separate from the public catalog.

# 452. Public customer status

**Never expose internal sales status publicly.** *Powered by Semester* only where contractually authorized.

# 453. Contract feature mapping

Modules, user limits, AI allowance, storage, support tier, integrations — enforced through the entitlement engine of §351.

# 454. Implementation dependency graph

Every university deployment has an explicit dependency graph:

```
TENANT → DOMAIN → SSO → USER PROVISIONING → ACADEMIC STRUCTURE
→ COURSES / ENROLLMENTS → LMS → CALENDAR → DEGREE DATA → PILOT → GO LIVE
```

**Implementation tooling must prevent a team from marking a dependent system ready before its prerequisites are satisfied.**

# 455. Implementation blockers

Description, owner, dependency, date identified, required action, status. A blocker names what it blocks.

# 456. Implementation risk register

Security, data, integration, timeline, accessibility, adoption, support — each with probability, impact, mitigation, owner and status. **Do not hide known risks to make implementation status look better.**

# 457. Implementation document vault

Architecture, SSO configuration, integration mappings, data dictionaries, test results, accessibility review, security documentation, launch plan. Sensitive implementation documents are restricted.

# 458. Integration credential management

**Never store API secrets, private keys, SAML secrets or database credentials in ordinary application records or documents.** Store references to secure secret infrastructure.

# 459. Credential rotation

Rotation without redeployment where practical. Track provider, owner, created, rotation due, last rotated. **Do not expose secret values in dashboards.**

# 460. Integration test console

A *Test connection* that reports each capability and when it last ran. **Do not perform destructive writes during a connection test.**

# 461. Field mapping tool

Versioned mapping configuration between a university's schema and Semester's.

# 462. Role mapping

SSO and SIS roles map to Semester roles. **An unknown role must not receive elevated access.**

# 463. Data preview

A representative preview before activating an integration, so the implementation team can validate the mapping.

# 464. Sync scheduler

Per-source cadence, with event or webhook synchronization for critical data where supported.

# 465. Sync manual override

*Sync now*, rate-limited and audited.

# 466. Sync failure queue

**Failures must not disappear.** Show the count, the reason, and support retry after correction.

# 467. Partial sync

**Do not fail an entire import because one record is invalid**, unless consistency requires it. Process the valid ones and quarantine the rest.

# 468. Data quarantine

Invalid or untrusted imported records wait in quarantine. **Quarantined institutional data is never shown to users.**

# 469. Data correction workflow

Report → source check → correction → sync → verify. **Avoid local manual correction that the next sync will overwrite.**

# 470. Source override rules

An administrative override stores value, reason, actor, timestamp and expiration. **The original provider value is never lost.**

# 471. Staging tenant

Production and staging per contracted university where practical. Staging uses synthetic or appropriately protected data.

# 472. University acceptance testing

Role-specific UAT as student, faculty, advisor, organization admin and university admin, with stakeholder sign-off.

# 473. Student UAT

Login, onboarding, home, courses, calendar, search, directory, messages, organizations, events, AI, and degree and registration planning where enabled.

# 474. Faculty UAT

SSO, course access, announcements, resources, office hours, communication, files, permissions.

# 475. Admin UAT

User administration, integrations, configuration, communications, organizations, moderation, analytics, audit logs.

# 476. Accessibility UAT

With real keyboard, screen-reader, zoom and reduced-motion users. **Critical blockers are resolved before broad deployment.**

# 477. Security UAT

Cross-tenant access, privilege escalation, unauthorized file access, unauthorized API access, AI permission bypass, session handling.

# 478. Penetration test readiness

Scope, test environment, test accounts, architecture, contacts, rules of engagement. **Do not claim penetration testing has occurred unless it has.**

# 479. Vulnerability management

`OPEN`, `TRIAGED`, `IN_PROGRESS`, `RESOLVED`, `ACCEPTED_RISK`. Critical first.

# 480. Dependency security

Automated scanning of frontend, backend and container dependencies. **Do not auto-deploy breaking dependency updates without testing.**

# 481. Software bill of materials

SBOM generation tied to releases, where procurement requires it.

# 482. Secure development lifecycle

Design review, threat modelling, code review, automated tests, security scanning, release review, monitoring — proportional to risk.

# 483. Threat model

For authentication, tenant isolation, AI, messaging, marketplace, payments, registration, files and admin.

# 484. AI threat model

Prompt injection, data leakage, unauthorized tools, cross-tenant retrieval, malicious uploaded files, action replay, and **hallucinated transaction success.** Test each.

# 485. File threat model

Malicious uploads, executable content, MIME spoofing, public-link leakage, unauthorized previews.

# 486. Privacy impact review

Before release, for AI, location, analytics, email, calendar, career and housing.

# 487. Location privacy

Semester functions without precise location. Where enabled, use it for nearby resources and directions. **Do not create passive student tracking.**

# 488. Location retention

Prefer ephemeral processing. **Do not retain precise location history** unless an explicit user feature requires it.

# 489. Attendance privacy

**Attendance must not become hidden location surveillance.** Explicit check-in, or an authorized institutional source.

# 490. Student data access log

Access auditing for sensitive institutional records where institutionally required. **Do not expose security-sensitive audit information to ordinary users.**

# 491. Admin just-in-time access

Re-authentication, time-limited elevation and a stated reason for especially sensitive operations.

# 492. Break-glass access

Explicit permission, reason, audit, notification and expiration. Genuine operational need only.

# 493. Data export security

Permission, logging, secure generation, expiring links. **No permanent public export URLs.**

# 494. CSV injection defence

Sanitize exported cells that a spreadsheet would execute as a formula.

# 495. Admin search privacy

Admin search respects role. **A club administrator cannot search institutional records because an admin search component exists.**

# 496. Support access boundaries

Minimum necessary. Tier 1 sees account status, app version and integration status — **not private documents or messages.**

# 497. Support escalation

Tier 1 → technical → security and privacy.

# 498. Support impersonation controls

Explicit banner, no hidden mode, audit, limited actions, re-authentication. **Prefer diagnostic tooling over impersonation.**

# 499. University service desk integration

Route *Wi-Fi not working* into the institution's own ticketing where integrated.

# 500. Universal help intent router

Decide between a self-service article, Semester support, university IT, the registrar, an advisor or another office.

# 501. Help source priority

University official resources, then Semester help, then general guidance.

# 502. Contextual support bundle

Route, app version, browser, device class, error ID, integration state — with permission. **Do not include private page content by default.**

# 503. User-facing error ID

A short reference support can use to find the logs.

# 504. Status-aware errors

Not *Something went wrong* but *Canvas synchronization is temporarily unavailable. Your existing Semester data is still accessible.*

# 505. Degraded mode

When an integration fails, core Semester continues, and the interface says exactly what is and is not available.

# 506. University system dependency map

Which Semester features depend on which external system, so an outage is understandable.

# 507. System status history

Integration uptime and history. **Do not imply a vendor's outage was Semester's.**

# 508. SLA measurement

Measure platform availability, API availability, integration processing and support response. **Only commitments approved by business and legal become SLAs.**

# 509. Capacity planning

Tenants, users, concurrent users, files, messages, AI usage, sync volume — reviewed before onboarding a large institution.

# 510. University size tiers

Small college through large multi-campus system, **without separate codebases.**

# 511. Multi-institution systems

`SYSTEM → INSTITUTION → CAMPUS`, **without weakening tenant isolation.**

# 512. Consortium and cross-registration

Represent explicit cross-institution enrollment. **Do not merge tenants.**

# 513. University sandbox

An isolated demo tenant for prospects. **No real student data.**

# 514. Proof-of-concept mode

Limited integrations against university test systems, clearly labelled `POC — NOT PRODUCTION`.

# 515. Contract to tenant automation

Customer, tenant, entitlements, implementation project, admin invitations and staging environment, created by one authorized workflow rather than repeated by hand.

# 516. University admin invitation

Expiring token, verified institutional email, role, tenant. **No self-registration as a university admin.**

# 517. First admin setup

University profile, implementation contacts, security contacts, support contacts, configuration review.

# 518. Admin delegation

Organizations admin, communications admin, integration admin, analytics viewer. Least privilege.

# 519. Admin approval workflows

Optional approval for campus-wide communication, integration change and large export. Configurable per institution.

# 520. Four-eyes control

A second authorized administrator for certain actions. **Do not impose it unnecessarily on small customers.**

# 521. Configuration change history

Feature flags, SSO mappings, retention policy, integration configuration — with a diff view.

# 522. Configuration rollback

Where safe. **Do not roll back credentials or secrets insecurely.**

# 523. Tenant configuration export

Non-secret configuration, for backup, review and staging replication.

# 524. Configuration promotion

Staging → review → production, for major tenant configuration.

# 525. Academic term rollover

Create or import term → import courses → validate → preview → publish.

# 526. Course archiving

Completed courses archive; authorized historical access remains; current navigation stays uncluttered.

# 527. Organization year rollover

Current officers → new officers → permission transfer → previous officers archived. **Do not require Semester support staff for every leadership change.**

# 528. Organization succession

A scheduled, future-dated role transition.

# 529. Organization archive

Inactive organizations archive; historical events and files remain per policy.

# 530. Campus event lifecycle

`DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`, `ARCHIVED`. **A cancelled event stays visible enough to communicate the cancellation.**

# 531. Event change notifications

Time, location and cancellation notify attendees. **A typo fix does not.**

# 532. Event capacity consistency

Atomic capacity logic. **Two users must not both take the final seat.**

# 533. Waitlist promotion

Waitlist → offer → expiration → confirm. **Do not silently register an attendee where the rules require acceptance.**

# 534. Event ticketing

`FREE`, `PAID`, `INVITE_ONLY`, with payments through an approved provider.

# 535. Ticket transfer

Only where the organizer allows it, with ownership and audit maintained.

# 536. Event ticket validation

A unique, non-guessable identifier per ticket, with states `VALID`, `USED`, `CANCELLED`, `REFUNDED`, `TRANSFERRED`, `EXPIRED`. **QR check-in validates against server state — never trust the QR payload alone.**

# 537. Event fraud prevention

Prevent screenshot reuse, duplicate check-in, invalid transfer and cancelled-ticket usage. Validate against live server state where connectivity permits, with a safe degraded process where it does not.

# 538. Event analytics

Aggregate views, RSVPs, waitlist, attendance and no-show rate for the organizer. **Do not expose unnecessary attendee behaviour.**

# 539. Event discovery quality

Consider campus, time, interests, followed organizations, saved categories and the user's existing schedule. **Do not recommend a conflicting event without saying it conflicts.**

# 540. Recurring events

Weekly, biweekly, monthly and custom. An occurrence can be modified without rewriting the series.

# 541. Event series

Series and occurrences are represented properly, not as copies.

# 542. Event cancellation

Confirmation, optional explanation, attendee notification, calendar update, refund workflow. **Do not delete the event and let it disappear.**

# 543. Organization dues

`NOT_REQUIRED`, `DUE`, `PENDING`, `PAID`, `WAIVED`, `REFUNDED`, through approved payment infrastructure. **Payment status is never public.**

# 544. Organization dues privacy

The user, the treasurer and the appropriate organization admin. **University admins do not get access automatically.**

# 545. Organization reimbursements

Request → receipt → review → approved → paid. **Do not try to replace university financial systems that already exist.**

# 546. Organization budget

Allocated, spent, committed, remaining, by category. Financial records take stricter permissions.

# 547. Organization treasurer role

An explicit permission bundle — `dues:view`, `dues:manage`, `expense:create`, `expense:review`, `budget:view`. **A treasurer does not gain membership-admin privileges.**

# 548. Organization document retention

Constitutions, election records and approved budgets may need different retention from ordinary files. Configurable per tenant and organization.

# 549. Organization handover

A leadership-change checklist: transfer admin access, review files, review budget, review upcoming events, update contacts. **This solves a real student-organization continuity problem.**

# 550. Organization knowledge base

How we book rooms, the annual event checklist, sponsor contacts, the recruitment process. **Leadership turnover must not erase organizational knowledge.**

# 551. Organization AI assistant

For authorized leaders, over organization-authorized data only.

# 552. Organization AI privacy

**AI inherits organization permissions.** No private applications, treasurer data or internal notes without the permission a person would need.

# 553. Marketplace category system

Standard categories, tenant-configurable.

# 554. Marketplace listing quality

Title, description, category, price, condition, images. **Never require a precise home address publicly.**

# 555. Marketplace location privacy

A coarse meeting area publicly; the exact location is shared intentionally between two users.

# 556. Marketplace offer system

`PENDING`, `ACCEPTED`, `DECLINED`, `COUNTERED`, `EXPIRED`, `WITHDRAWN`. An accepted offer can reserve the item.

# 557. Marketplace counteroffers

Structured, with history retained.

# 558. Marketplace transaction chat

The conversation keeps its listing context, and reflects the listing's status when it changes or sells.

# 559. Marketplace completion

Either party may mark complete; where a payment provider confirms, use the provider's state. **Do not create a false completed status.**

# 560. Marketplace reviews

Only after a legitimate completed interaction. **Prevent reviews from users who never transacted.**

# 561. Marketplace reputation

Factual metrics — verified student, completed transactions, average from a stated number of reviews. **Do not invent an opaque trust score.**

# 562. Marketplace moderation

Automated flagging for spam, duplicates, prohibited categories and suspicious links, with human review for ambiguous cases.

# 563. Housing listing lifecycle

`DRAFT`, `ACTIVE`, `PENDING`, `LEASED`, `EXPIRED`, `REMOVED`, with required expiration dates.

# 564. Housing listing verification

`USER SUBMITTED`, `VERIFIED SOURCE`, `UNIVERSITY HOUSING`, `PARTNER LISTING`. **Do not imply verification that did not happen.**

# 565. Housing scam protection

Flag suspicious pricing, repeated listings, external payment demands and new accounts posting many listings. **Do not claim detection guarantees safety.**

# 566. Roommate profile privacy

Visible only within roommate discovery, per the user's chosen privacy. Users can pause matching.

# 567. Roommate match explanation

Shared preferences in plain words. **Avoid opaque compatibility scores.**

# 568. Roommate conversation starters

Prompts that help users evaluate compatibility themselves.

# 569. Career employer trust

*Verified employer* only after real verification. **No self-declared verification.**

# 570. Career application states

`INTERESTED`, `SAVED`, `APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`, `WITHDRAWN`, `CLOSED` — private unless explicitly shared.

# 571. Career AI copilot

Find roles, tailor a resume, prepare interview questions, add a deadline. **Never apply without explicit confirmation.**

# 572. Resume job comparison

Clear matches and areas to address, against a user-authorized resume. **Do not invent skills.**

# 573. Application document tracking

Which resume, cover letter and portfolio version was used.

# 574. Interview workspace

Company, role, date, research, questions, notes, follow-up, with calendar integration.

# 575. Interview preparation AI

Practice questions from the job description, authorized resume and public information — **clearly distinguished from actual employer questions.**

# 576. Academic integrity settings

Universities configure AI tutoring, writing suggestions and answer generation. **Do not claim Semester can perfectly detect prohibited AI use.**

# 577. Assessment mode

`AI_ALLOWED`, `AI_LIMITED`, `AI_NOT_ALLOWED`, respected inside institutionally managed assessment contexts.

# 578. AI restriction transparency

Say that AI is limited for this assessment by course settings, and say what is still allowed.

# 579. Study support during restricted assessment

Calendar, study planning, existing notes and course navigation may remain, per institutional policy.

# 580. Faculty AI controls

Within boundaries granted by university policy. **Course settings cannot override stronger institutional restrictions.**

# 581. AI policy hierarchy

```
PLATFORM SAFETY → UNIVERSITY POLICY → COURSE POLICY → USER PREFERENCE
```

**Higher-level restrictions win.**

# 582. Academic submission architecture

`DRAFT`, `READY`, `SUBMITTING`, `SUBMITTED`, `FAILED`, `RETURNED`, with official provider confirmation required.

# 583. Submission confirmation

Store the external receipt where available.

# 584. Submission failure

**Never show "submitted" until the provider confirms.** On timeout, say the status is unknown, say not to resubmit yet, and handle it idempotently.

# 585. Submission deadline safety

Due date, timezone, provider status. **Do not change a deadline on AI inference alone.**

# 586. Grade import

From LMS or SIS where authorized, with the source tracked. **Student-entered grades never overwrite official grades.**

# 587. Grade source label

Say where a grade came from. What-if calculations stay separate.

# 588. Grade privacy

**Grades are private** — not through a social profile, group, organization or public analytics. Institutional roles require legitimate authorization.

# 589. Faculty grade access

**Not granted because a role says FACULTY.** Faculty *and* an authorized course relationship *and* integration permission.

# 590. Advising academic access

Scoped to assigned or authorized students, per institutional configuration.

# 591. University data governance panel

Data sources, retention, exports, integrations, AI access, audit logs. **Do not expose raw sensitive student content by default.**

# 592. Data classification dashboard

Public, internal, education record, sensitive, restricted — reviewable by the institution.

# 593. Retention policy engine

Configurable retention per data category, validated before destructive deletion.

# 594. Retention jobs

Idempotent, logged, respecting legal and institutional holds, and not deleting referenced records incorrectly.

# 595. Legal hold architecture

Records exempted from normal deletion, under highly restricted permissions. **Do not expose legal-hold state unnecessarily.**

# 596. Consent records

User, policy version, timestamp, method.

# 597. Terms versioning

Track which version was accepted; prompt on material change per legal requirements.

# 598. Cookie and tracking controls

Respect consent and institutional requirements for optional analytics. Essential security and session storage stays separate.

# 599. Accessibility issue reporting

A high-priority route capturing feature, device, browser, optional assistive technology and description.

# 600. Accessibility regression tests

Automate what can be automated. **Automated accessibility testing does not replace manual testing.**

# 601. Design system documentation

Live documentation for every component, **each documenting its accessibility behaviour.**

# 602. Design tokens

Colour, typography, spacing, radius, elevation, motion, breakpoints. **User themes modify tokens, not component CSS.**

# 603. Theme safety

Custom themes preserve minimum contrast. **No arbitrary foreground and background combination that makes content unreadable.**

# 604. Layout preferences sync

Home layout, density, theme, shortcuts and workspace preferences follow the account across devices.

# 605. Reset experience

Reset home, navigation, theme, or all layout preferences. **A user must never be trapped in a bad customization.**

# 606. Feature discovery

Contextual suggestion at the useful moment, not a dump in onboarding.

# 607. Feature discovery limits

Track shown, dismissed and completed. **Do not repeat a tip after dismissal.**

# 608. Power user mode

More shortcuts, denser workspace, advanced tab controls, more metadata. **The default stays simple.**

# 609. Beginner mode

Simplified surfaces that grow. **Do not permanently label somebody a beginner.**

# 610. Semester personalization center

Appearance, home, navigation, notifications, AI, academics, privacy, accessibility.

# 611. User preference portability

Preferences follow the account. Switching universities keeps personal UI preferences and applies the new tenant's policy.

# 612. Tenant policy overrides

**Institutional restriction wins for university-owned content** — and the interface explains why the option is unavailable.

# 613. Platform policy engine

Centralized evaluation of platform policy, tenant policy, role, resource and user preference. **Not `if university === X` scattered through code.**

# 614. Policy explanations

Not *Disabled* but *Public sharing is disabled for university-owned files by your institution.*

# 615. Final quality engineering program

Unit, integration, contract, E2E, accessibility, security, performance, load, failover, migration and UAT — executed before market-ready status.

# 616. Critical E2E personas

Student, faculty, advisor, organization admin, university admin, platform admin.

# 617. Student E2E — core

Signup → onboarding → course → assignment → calendar → search → organization → RSVP → message → AI.

# 618. Student E2E — academics

Course → assignment → study plan → study session → notes → practice → calendar → completion. **Verify persistence after refresh and after re-authentication.**

# 619. Student E2E — registration

Degree progress → course search → section comparison → add to plan → conflict check → prerequisite check → cart → confirmation; and where direct registration is enabled, submit → provider → confirmation → registered. **Test the failures as thoroughly as the successes.**

# 620. Student E2E — degree planning

Academic record → requirements → remaining → what-if → future semester → save → reload. **Verify the correct catalog year.**

# 621. Student E2E — productivity

Document create → edit → autosave → share → comment → version → restore. Presentation create → slides → collaborate → present. Spreadsheet create → formula → chart → save → export.

# 622. Student E2E — workspace

Course tab, document tab, split view, AI, detach to a new window, edit in the second window, verify state sync, close, restore tab, restore session. Where the browser prevents native detachment, test the explicit *Open in new window* fallback.

# 623. Student E2E — history

Open → open → search → close → history → reopen, plus clear, pause, search, and cross-device where supported.

# 624. Student E2E — organizations

Discover → follow → apply → admin reviews → accept → member access → event → RSVP → message.

# 625. Student E2E — marketplace

Listing → search → offer → accept → message → complete → review. **If payments are disabled, do not test a fake payment completion.**

# 626. Student E2E — career

Search → save → application → attach resume → deadline → interview → status.

# 627. Faculty E2E

SSO → faculty home → course → announcement → resource → office hours → the student-facing result. **Verify faculty cannot reach unauthorized courses.**

# 628. Advisor E2E

Login → assigned student → degree plan → registration plan → shared advising note → appointment. **Verify an advisor cannot reach unauthorized students.**

# 629. Organization admin E2E

Dashboard → application → accept member → create event → publish → attendance → announcement, with resource-level authorization verified.

# 630. University admin E2E

SSO → dashboard → integration health → user search → organization verification → announcement → analytics → audit log.

# 631. Cross-tenant E2E

Two synthetic universities. Attempt unauthorized cross-tenant user, file, course, admin, search, AI-retrieval and API access. **All must fail safely. This is a P0 release gate.**

# 632. AI E2E

Question → retrieval → source → answer; and action request → tool selection → permission → confirmation → action → receipt.

# 633. AI cross-tenant test

*Show me private assignments from University B*, asked by a University A user, retrieves **no** University B protected data.

# 634. AI action failure test

When the provider fails, the AI says the action failed. **Never *You're all set!***

# 635. AI duplicate action test

Retry the same tool request: one RSVP, one payment, one message, one registration request.

# 636. AI source conflict test

Given a syllabus and an email that disagree, **surface the conflict** rather than inventing a resolution.

# 637. Accessibility E2E

Login, navigation, search, course, assignment, calendar, messaging, AI and registration, all usable by keyboard.

# 638. Screen reader QA

Representative critical flows on common screen-reader and browser combinations. **Document the actual coverage**, not the intended coverage.

# 639. Zoom QA

No clipped controls, unreachable dialogs, horizontal traps or hidden content at increased zoom.

# 640. Reduced motion QA

Verify the setting propagates across navigation, modals, workspace, charts, loading and drag-and-drop alternatives. *(The setting itself is experience §378–379, built as `CALMS` in `lib/look.ts`.)*

# 641. Mobile QA matrix

320, 375, 390, 430 and 768 px, portrait, and landscape where appropriate.

# 642. Browser QA

A defined supported matrix. **Do not claim legacy compatibility that is not tested.**

# 643. macOS QA

Safari, Chrome, multi-window, keyboard shortcuts, file upload and download, PWA, window restoration — because student MacBook usage is a large share of the audience.

# 644. Windows QA

Chrome, Edge, Windows keyboard conventions, file workflows, window behaviour. **Do not assume macOS-only desktop behaviour.**

# 645. Network failure QA

Slow network, offline, connection dropped mid-save, integration timeout, AI timeout — each recovering gracefully.

# 646. Database failure QA

Fail safely in a non-production environment. **No false success.**

# 647. Integration failure QA

LMS down, SIS timeout, calendar auth expired, email permission revoked, drive unavailable — core Semester stays usable.

# 648. Migration QA

Valid data, duplicates, missing fields, invalid relationships, large datasets, partial failures, with reconciliation verified.

# 649. Load test — normal campus day

Logins, home loads, search, messaging, events, AI. Measure.

# 650. Load test — registration

High concurrency at registration opening. **Do not let noncritical features degrade registration-critical infrastructure.**

# 651. Load test — finals

AI tutor spike, documents, study planner, flashcards, file retrieval.

# 652. Load test — campus event

Thousands viewing, hundreds RSVPing simultaneously, **capacity still correct.**

# 653. Chaos and resilience testing

In staging: fail the AI provider, email provider, search, cache and one integration, and verify graceful degradation. **Never uncontrolled chaos testing in production.**

# 654. Data recovery test

Restore a backup into an isolated environment and verify users, courses, file metadata, messages and tenant configuration. **A backup is not verified until a restore works.**

# 655. File recovery

Test the storage recovery and versioning strategy.

# 656. Production smoke test

After every deployment: home, login, search, course, message, calendar, basic AI read. **No destructive production testing.**

# 657. Synthetic monitoring

Continuous, safe, non-destructive checks of the homepage, login, health endpoint and search health.

# 658. Release blocker classification

**P0** — cross-tenant leak, authentication bypass, data corruption, false payment success, false registration success, critical outage. Immediate blocker.

**P1** — core workflow broken, major accessibility blocker, persistent save failure, messaging failure, critical integration failure. Blocks general release.

**P2** — important, with a workaround. **P3** — polish.

# 659. Bug budget

**Do not launch because "only 40 bugs remain."** Classify by severity and affected workflow: no known P0, no launch-blocking P1.

# 660. Production data policy

**Never seed production with fake students pretending to be real.** Synthetic and demo users are clearly isolated.

# 661. Demo data isolation

`DEMO` and `PRODUCTION` tenants never mix.

# 662. Environment banners

Non-production environments say `STAGING`, `DEMO` or `DEVELOPMENT`, so no administrator mistakes a test environment for production.

# 663. Admin dangerous action design

Delete tenant, disable SSO, bulk deactivate, delete integration, large export — all require strong confirmation.

# 664. Typed confirmation

For the genuinely destructive, require the name typed out. **Only where truly warranted.**

# 665. Soft delete

Prefer it for recoverable administrative entities; let the retention process handle permanent deletion.

# 666. Admin undo

A limited window for safe reversible admin changes.

# 667. Configuration validation

Validate dependencies before saving — direct registration cannot be enabled without a configured registration provider.

# 668. Feature dependency engine

Dependencies defined centrally, with the UI explaining what is missing.

# 669. Feature maturity level

`EXPERIMENTAL`, `BETA`, `PRODUCTION`, `DEPRECATED`. Universities choose whether beta features are permitted.

# 670. Public feature labeling

**Do not show internal engineering jargon to students.** *Beta*, with an understandable explanation.

# 671. Semester Labs

Opt-in experimental features, kept separate from production-critical functionality.

# 672. Product feedback per feature

*Helpful?* and *Report problem*, especially on new AI and workflow features.

# 673. AI feedback

Helpful, incorrect, outdated, wrong source, action failed. **Used for evaluation — not as an assumption about model retraining.**

# 674. AI correction flow

Capture the response, sources, tenant and feedback, and route a possible source-data issue to review.

# 675. Knowledge base correction

An admin updates the source record; retrieval uses the corrected version after reindexing.

# 676. Search correction loop

A zero-result search can be mapped to the institution's own term — *meal money* → *dining dollars*.

# 677. University terminology learning

An approved tenant dictionary that AI and search may use. **Do not adopt unreviewed slang as official terminology.**

# 678. Semester design quality gate

Before a feature ships: clear hierarchy, obvious primary action, mobile usable, keyboard usable, loading state, empty state, error state, dark mode, **low-stimulation mode**, no unnecessary clutter.

# 679. Cognitive load review

For every major screen: what is the goal, what must be seen now, what can be hidden, are sections competing, can anything be removed. **More information is not automatically better.**

# 680. Home maximum complexity

Today, next, for you, campus, recent — with customization. Not an endless dashboard.

# 681. AI UI restraint

**Do not put a glowing AI button on every component.** Contextual: *Ask Semester* in a document, *Study with Semester* in a course, *Help me plan* in registration.

# 682. Empty-state AI

*Your ECON exam is Friday. [Create Study Plan]* beats generic chatbot promotion.

# 683. Responsive information priority

Mobile shows fewer fields and expands. **Do not simply shrink the desktop table.**

# 684. Table responsiveness

Stacked rows and detail sheets for registration, admin and degree audit. Horizontal scroll only when truly necessary.

# 685. Density by role

Student comfortable, admin compact, both customizable.

# 686. Print and export design review

Good enough for an advising meeting, registration planning, a degree review or an organization report.

# 687. Institutional brand coexistence

*Semester for Vanderbilt University*, where contractually appropriate. **Semester remains the primary product identity.**

# 688. White-label readiness

Limited branding customization if strategy requires it. **Never a separate code fork.**

# 689. University system of record labels

Name the authoritative system where it builds trust.

# 690. Last updated indicator

*Updated 8 minutes ago*, especially for registration, degree audit, dining and transportation.

# 691. Manual refresh

Where useful. **Do not imply a refresh guarantees the external system has newer data.**

# 692. Stale data warning

If an integration has not synced within the expected window, say so and give the time.

# 693. Source conflict UI

Show both sources and let the student review. **Do not hide the conflict.**

# 694. University implementation certification

Before `READY FOR GO LIVE`: product, engineering, security, privacy, accessibility, implementation, support and the university all sign off.

# 695. Internal signoff

Approved, approved with conditions, or not approved — with conditions documented.

# 696. University signoff

The institutional project owner acknowledges configuration, integrations, pilot, training and launch date. **Operational acknowledgement, not a substitute for contractual or legal approval.**

# 697. Launch runbook

T-24h verify integrations, monitoring and backups. T-2h freeze risky deployments and run smoke tests. T0 enable the production tenant and approved features. T+1h review authentication, errors, integrations, support and performance. T+4h review activation, data quality, sync health and AI health. End of day, stakeholder review. Days 2–7, hypercare. **Launch is operationally controlled, not announced and hoped over.**

# 698. Release freeze

Before a major go-live, freeze unrelated high-risk changes. Critical fixes, security fixes and launch blockers only.

# 699. Go-live command center

A launch dashboard over authentication, application, database, search, AI, LMS, SIS, email, calendar, support and error rate — **from real monitoring.**

# 700. Launch war room

A defined channel for engineering, implementation, support, security, customer success and university IT, with named owners.

# 701. Launch contact matrix

Executive sponsor, project manager, IT, security, identity, LMS, SIS and support contacts. **Do not store unnecessary personal information.**

# 702. Launch rollback criteria

Authentication unavailable, cross-tenant security issue, data corruption, severe integration corruption, critical accessibility regression. **Do not continue a launch merely to preserve the schedule.**

# 703. Feature kill switch

Disable AI actions, registration writes, marketplace payments, external sharing or one integration **without shutting down the platform.**

# 704. Read-only mode

Data readable, writes disabled. **Not to be used if displaying possibly corrupted data would itself be unsafe.**

# 705. Maintenance banner

Targeted by university, module or role, saying what still works.

# 706. Incident banner priority

`INFO`, `DEGRADED`, `MAJOR`, `CRITICAL`. **No global banner for a minor issue.**

# 707. Post-launch hypercare

Daily review of P0/P1 incidents, login failures, integration failures, data mismatches, search failures, AI errors, accessibility issues, support volume and performance.

# 708. Hypercare exit

Critical workflows stable, no unresolved P0, acceptable P1 backlog, stable integrations, normalized support volume, **and the university agrees.**

# 709. 30-day review

Activation, weekly actives, module adoption, integration reliability, support themes, data quality, performance, accessibility issues, product feedback — in aggregate.

# 710. 90-day review

Retention, workflow adoption, feature gaps, university goals, integration opportunities, training needs.

# 711. Customer success plan

Goals, stakeholders, modules, adoption targets, integration roadmap, training, review cadence. **Do not invent customer goals — they are agreed with the institution.**

# 712. University goals

Customer-defined objectives, treated as theirs.

# 713. Customer success dashboard

Implementation status, integration health, support volume, aggregate adoption, open risks, upcoming review. **No unnecessary student-level content.**

# 714. University admin success dashboard

The institution's own aggregate outcomes. **Avoid vanity metrics.**

# 715. Adoption funnel

Invited → activated → onboarded → first action → weekly active, as aggregate cohorts.

# 716. First value event

Added courses, found a campus resource, followed an organization, RSVP'd, created a study plan, sent a message. **Login alone is not activation.**

# 717. Module activation

First meaningful action in academics, organizations, events, AI, career, marketplace.

# 718. Retention cohorts

D1, D7, D30 and term-to-term, respecting analytics privacy.

# 719. Term retention

Fall → spring and spring → fall. A university product is seasonal; daily consumer retention is the wrong instrument.

# 720. Seasonal analytics

Orientation, add/drop, midterms, registration, finals, recruiting. **Do not read a seasonal dip as product failure.**

# 721. Product health scorecard

Reliability, performance, security, accessibility, data quality, search quality, AI quality, support. **Do not collapse these into one misleading number.**

# 722. University health view

Multiple indicators with evidence, not a red/yellow/green score.

# 723. Feedback synthesis

Support, in-app feedback, university feedback, search gaps and usage. **Do not prioritize on request volume alone.**

# 724. Feature request system

Request, customer, user type, problem, impact, workaround, status. **Record the problem, not the requested implementation.**

# 725. Roadmap governance

User value, university value, strategic differentiation, engineering complexity, security and privacy, accessibility, maintenance cost.

# 726. University-specific requests

**Avoid a code fork for one university.** Ask first whether it is configuration, a feature flag, a provider adapter or a policy.

# 727. Extension points

Authentication provider, academic structure, degree rules, campus terminology, integration provider, feature policy.

# 728. Configuration validation tests

No orphan departments, valid timezone, valid domains, satisfied feature dependencies, valid provider configuration.

# 729. University configuration preview

Preview as student, faculty and admin before publishing major changes.

# 730. Configuration schedule

Future activation, for academic cycles.

# 731. Content scheduling

Announcements, event publication, resource updates. **Not for emergency messages.**

# 732. Content expiration

Official notices expire, so campus announcements do not go stale.

# 733. Content owner

Every official resource names a responsible office.

# 734. Content review reminders

Slowly changing official content is re-reviewed on a cadence, with the owner notified.

# 735. Stale content queue

*17 resources need review*, prioritized by impact.

# 736. Broken link monitoring

Flag 404s, redirect loops and unavailable links. **Never replace a link with a guessed destination.**

# 737. University website link health

Registrar, financial aid, housing, academic calendar, course catalog, career.

# 738. Campus data versioning

Version history and restore for manually maintained institutional records.

# 739. Campus data bulk import

Upload → map → validate → preview → import. **Never overwrite production without a preview.**

# 740. Campus data API

Scoped service credentials for universities pushing approved data.

# 741. Inbound webhooks

For course, calendar and enrollment updates, **with signatures validated.**

# 742. Outbound university webhooks

Approved institutions may subscribe to events. **Do not expose private student actions** unless contractually and legally appropriate.

# 743. University API rate limits

Tenant-aware, protecting both the platform and the provider.

# 744. Provider backoff

Respect retry-after. **Do not hammer a provider.**

# 745. Provider circuit breaker

Stop calling a repeatedly failing integration, show degraded status, retry safely.

# 746. Integration change detection

Missing fields, new enums, auth failures — alert operations.

# 747. Provider contract tests

Fixtures and contracts, run before deployment.

# 748. Integration version support

Track provider versions and plan migrations before deprecation.

# 749. Integration ownership

**No orphan integrations.** Every adapter has an internal owner.

# 750. Integration documentation

Authentication, scopes, data imported, data exported, sync cadence, failure behaviour, support.

# 751. University implementation library

Reusable patterns — a Google Workspace university, a Microsoft 365 university, a Canvas university, a Banner university.

# 752. Implementation template matching

Identify the closest pattern. **Do not assume an identical setup.**

# 753. Implementation reuse metric

New universities should increasingly need configuration rather than custom engineering.

# 754. Top-100 university data program

A controlled ingestion pipeline: registry → official source registry → fetch → normalize → validate → review → publish. **Do not hardcode university data into components.**

# 755. University public data priority

Tier A: identity, academic calendar, schools and departments, campus resources, organizations, events. Tier B: public course catalog, faculty directory, buildings, dining, libraries. Tier C: housing, career, transportation, recreation.

# 756. Do not scrape private systems

Public sources, official APIs and authorized integrations only. **Never bypass authentication or access controls.**

# 757. University source authority

Official domain, department, catalog and calendar over third-party aggregators.

# 758. Public data attribution

Store the source and show it. **Semester is not the original authority.**

# 759. University data refresh engine

Refresh by source and category. **Do not rebuild the whole dataset every run.**

# 760. University data diff

Added, changed, removed — compared before a large automated update publishes.

# 761. Anomaly detection

Five hundred organizations yesterday and twelve today is an ingestion failure, not a fact. **Flag it; do not publish it.**

# 762. Mass deletion protection

Automated sync cannot delete a large share of records without a threshold and review.

# 763. Soft archive missing records

`PENDING_ARCHIVE` until the disappearance is confirmed.

# 764. Data confidence

Internal confidence from source and review state. **Do not show students a misleading numeric confidence score.**

# 765. Data stewardship

Institutional data owners review and correct official records.

# 766. Campus data portal

Resources, organizations, buildings, offices, processes and official links, subject to source-of-truth rules.

# 767. University knowledge ingestion

Policy pages, FAQs, guides and handbooks, **with source metadata required.**

# 768. Knowledge approval

`DRAFT`, `APPROVED`, `ARCHIVED`. AI prioritizes approved current content.

# 769. Knowledge expiration

**Do not retrieve an archived policy as current** unless the question is historical.

# 770. AI university knowledge tests

Per contracted university: add/drop, transcript request, financial aid, declaring a major — **each with a tenant-correct expected source.**

# 771. Top-100 AI isolation test

The same question across universities must give different, source-correct answers.

# 772. University switching test

Switching institution changes search, AI, events, courses, campus and processes. **No stale information from the previous institution remains.**

# 773. Campus context indicator

Show the active institution where ambiguity matters.

# 774. Cross-university search

An explicit *Search all universities* mode. **Do not mix campuses by default.**

# 775. Prospective university comparison

Factual programs, resources and public information. **No unsupported overall rankings.**

# 776. Transfer course comparison

Authoritative equivalency where it exists; otherwise labelled *Potential match — requires institutional evaluation.*

# 777. University contract activation

`PUBLIC → CONTRACTED` **upgrades the existing tenant.** Do not create a new one; preserve canonical entity IDs.

# 778. Public to contracted migration

Enable SSO, official integrations, admin accounts, verified content and private campus features **without duplicating public records.**

# 779. Official record reconciliation

Review a possible match rather than automatically creating a duplicate.

# 780. University claim workflow

Claim after verification and agreement. **Owning a domain is not authorization.**

# 781. University verification

Contract, institutional contact, domain validation, implementation process — with status stored.

# 782. Contract-ready product package

Fourteen pillars: student experience, academic OS, campus and community, productivity workspace, Semester Intelligence, university integrations, university administration, security and privacy, accessibility, implementation, analytics, support, reliability, data governance.

**Every pillar requires a working product, documentation, test coverage, an owner and stated known limitations.** A pillar with documentation and no product is not a pillar.

# 783. Contract-ready vs roadmap

`AVAILABLE NOW`, `BETA`, `PILOT`, `PLANNED`. **Sales and demo materials must never present planned functionality as production-ready.**

# 784. Product capability matrix

`docs/market-readiness/CAPABILITY_MATRIX.md` — capability, each role, status, integration required, documentation, known limitations. **Kept synchronized with actual code.**

# 785. University technical package

Architecture, deployment, security, data flow, identity, tenant isolation, integration, AI, backup and recovery, monitoring, accessibility, implementation methodology.

# 786. University security package

Authentication, authorization, encryption, secrets, tenant isolation, logging, monitoring, vulnerability management, incident response, backup, disaster recovery, subprocessor management. **Do not claim a control without evidence.**

# 787. Encryption

TLS in transit; appropriate encryption at rest from the production database, storage and infrastructure. **Document what is actually implemented.**

# 788. Password storage

A trusted provider or library with modern hashing. **Never implement custom password encryption. Never log a password.**

# 789. Session security

Secure cookies, HttpOnly where appropriate, SameSite, expiration, revocation, rotation.

# 790. Password reset security

Expiring, single-use, non-guessable. **Do not reveal whether an arbitrary email exists.**

# 791. Email verification

Expiring, single-use, secure. SSO users may not need a duplicate Semester verification.

# 792. Account recovery

**SSO recovery routes to the institution's identity provider** rather than pretending Semester controls the password.

# 793. Domain verification

**Owning a `university.edu` address does not grant University Admin.** Domains are verified before conferring privileged institutional status.

# 794. Admin MFA

Stronger authentication for privileged Semester-native admin accounts; institutional SSO may enforce it externally.

# 795. Privileged session timeout

Appropriate timeout and re-authentication for sensitive admin sessions.

# 796. Admin action reauthentication

Large export, role escalation, tenant deletion, security setting change.

# 797. Security contact

Configured per contracted university, with an internal incident owner.

# 798. Responsible disclosure

A `SECURITY.md` with a proper reporting channel. **Do not invite sensitive disclosure through a public issue tracker.**

# 799. Security incident playbook

Account compromise, credential exposure, cross-tenant access, data leakage, malicious upload, integration compromise.

# 800. Breach response preparation

Document evidence collection and escalation. **Legal notification obligations need qualified legal review — do not encode unsupported deadlines as product behaviour.**

# 801. University privacy package

What is collected, why, from where, sharing, retention, deletion, AI processing, analytics, integrations — **in plain language as well as formal documentation.**

# 802. Student privacy center

Your data, profile visibility, history, AI, connected apps, downloads, account.

# 803. AI privacy center

What Semester AI can use, connected sources, personalization settings, conversation history, action history.

# 804. University AI policy page

Surface the institution's guidance **without making Semester responsible for interpreting every academic policy automatically.**

# 805. Accessibility package

Evidence for keyboard, screen reader, contrast, zoom, reduced motion, mobile, forms, charts and tables. **Track known issues openly with remediation.**

# 806. Accessibility statement

Appropriate to the actual product status. **Do not claim perfect accessibility.** Provide a support contact.

# 807. Procurement data room

Security, privacy, architecture, accessibility, subprocessors, insurance, business continuity, incident response, implementation and AI documentation. **Not public.**

# 808. Procurement request tracker

Security questionnaire, accessibility questionnaire, DPA, architecture review, insurance, AI review, legal review — with owner and status.

# 809. Questionnaire knowledge base

Approved factual answers referencing evidence. **Do not reuse a stale answer after an architecture change.**

# 810. Procurement answer versioning

Question, answer, evidence, last reviewed, owner.

# 811. Implementation statement of work support

Generate technical scope from configured modules, as a **draft requiring business and legal review.**

# 812. Implementation phase 1 — discovery

Stakeholders, objectives, systems, data, security, accessibility, identity, academic structure, policies, launch scope. Output: an approved plan.

# 813. Implementation phase 2 — tenant foundation

Tenant, domains, timezone, branding, roles, policies, feature flags, entitlements.

# 814. Implementation phase 3 — identity

SSO, claim mapping, role mapping, provisioning, deprovisioning, session behaviour — **tested with synthetic users.**

# 815. Implementation phase 4 — campus data

Schools, departments, programs, courses, faculty, organizations, buildings, services, academic calendar.

# 816. Implementation phase 5 — academic integrations

LMS, SIS, degree audit, registration. **Start read-only where prudent.**

# 817. Implementation phase 6 — productivity integrations

Email, calendar, drive, meetings, per the university's environment.

# 818. Implementation phase 7 — AI

Allowed modules, knowledge sources, tool permissions, retention, usage limits, institution instructions — **with tenant-specific evaluations run.**

# 819. Implementation phase 8 — administration

University admins, department admins, organization administration, moderation, communications, analytics.

# 820. Implementation phase 9 — migration

Dry run → review → production import → reconciliation.

# 821. Implementation phase 10 — UAT

Role-based acceptance tests, every failure tracked. **Do not launch with unresolved critical issues.**

# 822. Implementation phase 11 — pilot

A controlled cohort, measuring activation, reliability, support, data quality, AI quality and accessibility.

# 823. Implementation phase 12 — training

University admins, IT, faculty, organization leaders, support. **Students should need minimal training.**

# 824. Implementation phase 13 — campus communication

Templates and resources. **The university controls its official communications.**

# 825. Implementation phase 14 — go live

The approved runbook, a release freeze, monitoring, hypercare.

# 826. Implementation phase 15 — optimization

Review adoption, improve configuration, enable modules, improve integrations, train more groups.

# 827. Changeover philosophy

```
CONNECT → UNIFY → IMPROVE → CONSOLIDATE → OPTIONALLY REPLACE
```

**Semester must not require a university to replace all existing infrastructure immediately.** This is what keeps institutional risk low enough to say yes to.

# 828. System replacement criteria

Equivalent functionality, migration plan, rollback, reliability evidence, security approval, accessibility approval, institutional signoff, support readiness — **all of them, before recommending replacement of anything.**

# 829. System-of-record principle

SIS holds the official academic record, the LMS holds official coursework, the identity provider holds official identity. **Semester is the unified experience above them, not a replacement for them.**

# 830. Gradual write enablement

`READ` → `READ + DRAFT` → `READ + LIMITED WRITE` → `FULL APPROVED WRITE`. **Never institutional writes on day one.**

# 831. Write action audit

Register, drop, submit and official-record changes require authorization, confirmation, a provider receipt and an audit entry.

# 832. Implementation success criteria

Reliable authentication, accurate data, stable core integrations, an understandable student experience, working critical workflows, addressed accessibility blockers, operational support, and the institution accepting launch. **Not "all planned features exist."**

# 833. University contract readiness levels

`LEVEL 0` prototype, `LEVEL 1` functional product, `LEVEL 2` pilot ready, `LEVEL 3` contract ready, `LEVEL 4` enterprise ready — which means multiple live institutions with mature operations. **Do not call Semester enterprise-ready prematurely.**

# 834. Contract-ready gate

Every applicable gate below must pass.

# 835. Product gate

Authentication, profiles, directory, search, academics, calendar, messaging, organizations, events, notifications and university admin must be production-functional.

# 836. Backend gate

Persistent database, migrations, authorization, tenant isolation, storage, background jobs, monitoring, backups.

# 837. Security gate

No known P0 vulnerabilities, tenant isolation tests, secrets management, audit logging, security headers, rate limits, incident response, vulnerability process.

# 838. Privacy gate

Data inventory, privacy controls, retention, deletion and export workflows, AI boundaries, integration permissions.

# 839. Accessibility gate

Critical keyboard workflows, screen-reader review, contrast, zoom, reduced motion, accessible forms, known issue tracking.

# 840. Reliability gate

Monitoring, error tracking, backups, a tested restore, deployment rollback, health checks, integration failure handling.

# 841. Implementation gate

Tenant provisioning, SSO configuration, data migration, integration configuration, UAT, pilot, go-live runbook.

# 842. Support gate

Help center, support intake, escalation, incident process, university contacts.

# 843. AI gate

Gateway, permission enforcement, source grounding, action confirmation, audit, cost controls, tenant isolation tests, failure handling.

# 844. Procurement gate

Architecture, security, privacy and accessibility documentation, subprocessor inventory, implementation overview, business continuity. **Only evidence actually available.**

# 845. Pilot-ready gate

Appropriate authorization, tenant created, authentication configured, data loaded, features configured, support ready, monitoring ready, security blockers resolved, cohort defined.

# 846. Production-ready gate

Everything from the pilot gate, plus pilot success, UAT signoff, accessibility signoff, migration reconciliation, training, communications and go-live approval.

# 847. No fake readiness

**Claude Code must never mark `SECURITY READY`, `ACCESSIBILITY READY`, `CONTRACT READY` or `PRODUCTION READY` merely because documentation files exist. Readiness requires implemented evidence.**

This is the rule the status tables in this document and in `EXPERIENCE_REQUIREMENTS.md` are written to obey: every row that claims something is built names the symbol that implements it, and every row that cannot is marked **not built**.

# 848. Readiness evidence

Every readiness item links to its evidence — a test path, a module, a measured run. A claim with no link is not a claim.

# 849. Final market-readiness dashboard

Product, security, privacy, accessibility, reliability, integrations, implementation, support. **Percentages are calculated from explicit checklist completion. Do not invent subjective scores.**

# 850. Readiness drill-down

Each percentage opens into passed, testing and blocked counts.

# 851. Blocker dashboard

P0, P1 and external blockers, each naming what it waits on.

# 852. External dependency policy

A missing external credential does not stop the implementation. **Build the adapter, build the configuration, build the sandbox contract test, document the credential requirement, mark `BLOCKED_EXTERNAL`, and continue.**

# 853. Mock policy

Mocks are for tests, the demo tenant, development and the integration sandbox. **Never silently in production.**

# 854. Production feature guard

Production startup fails, or disables the feature safely, if a required production integration is configured as a mock.

# 855. Environment validation

Validate required variables, database, storage, authentication, AI, email and monitoring at startup. **Fail safely.**

# 856. Configuration schema

A typed, validated configuration schema. **Not `process.env.X` scattered through the codebase.**

# 857. Secret redaction

Logs redact tokens, passwords, authorization headers, API keys and sensitive cookies.

# 858. PII logging review

**Do not log message contents, document contents, grades or sensitive profile information.** Use identifiers.

# 859. Production database access

Limit direct human access. Use audited admin tooling for routine operations.

# 860. Database admin operations

Dangerous operations follow a documented procedure. **Never ad-hoc production SQL without review.**

# 861. Data repair operations

Controlled tooling for duplicate entities, broken relationships, incorrect tenant assignment, failed synchronization and orphan records. Every repair supports preview, validation, authorization, audit, result and rollback where practical. **Avoid direct manual database manipulation.**

# 862. Data repair scripts

Version controlled, dry-run capable, logging affected records, idempotent where practical, requiring an explicit production flag. **Never a script that silently mutates production on import.**

# 863. Database constraint review

Unique external provider IDs per tenant, valid foreign keys, unique memberships, unique RSVP, valid transaction states. **Do not rely on frontend validation.**

# 864. State machine enforcement

Explicit transitions for marketplace transactions, organization applications, events, payments, registration requests and support tickets. `REFUNDED → PENDING` must be impossible without a valid workflow.

# 865. Domain service boundaries

Business logic out of UI components and into named domain services, fitted to the existing stack.

# 866. Client/server responsibility review

Server owns authorization, sensitive validation, transactions, tenant isolation and official state changes. Client owns presentation, interaction, safe optimistic state and local preferences. **Never trust a client assertion about permissions.**

# 867. Schema validation

Centralized inbound schemas with field-specific errors — *Event start time is required*, not *Invalid request*.

# 868. API pagination standard

Cursor and limit, consistently. **Never load the whole directory, event history, message list, course list or marketplace into memory.**

# 869. API filtering standard

One convention for search, filter, sort and pagination — not one per endpoint.

# 870. API response consistency

`data`, `meta`, `errors`, or the framework's equivalent.

# 871. API error consistency

`code`, `message`, `request_id`.

# 872. API documentation generation

Derived from actual schemas and routes, to reduce drift.

# 873. Domain event catalog

Documented internal events, named and stable.

# 874. Event handler idempotency

Handlers process retries safely.

# 875. Transaction boundaries

Atomic where consistency requires it: accept offer and reserve listing; accept application and create membership; RSVP and decrement capacity.

# 876. Concurrency control

Event capacity, marketplace reservations, waitlists, registration actions, payments.

# 877. Time consistency

**Server-authoritative timestamps.** Do not trust the client clock for important records.

# 878. Soft delete standard

`deleted_at` and `deleted_by`, excluded by default.

# 879. Hard delete process

Authorization, retention check, legal and institutional hold check, confirmation, audit.

# 880. Data cascade review

**Deleting a user must not delete an organization, a shared document, an event or an institutional record.** Ownership and cascade are defined explicitly.

# 881. Orphan prevention

Files without an owner, memberships without an organization, messages without a conversation, sections without a course.

# 882. Periodic data integrity job

Runs safe validation and reports anomalies. **Does not auto-delete them.**

# 883. Message delivery architecture

`SENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`. **Do not show delivered or read unless it is actually tracked.**

# 884. Message ordering

Server sequence robust to multiple devices.

# 885. Message retry

Retry without duplication.

# 886. Message editing

Show *Edited*, with appropriate moderation history.

# 887. Message deletion

*Delete for me*, and unsend within limits. **Do not imply the recipient never saw delivered content.**

# 888. Group chat roles

Owner, admin, member — **without imposing complexity on an ordinary small chat.**

# 889. Group chat member controls

Add, remove, leave, respecting organization- and course-managed groups.

# 890. Message requests

Accept, decline, block, report, for people outside the connection network.

# 891. Anti-spam

Rate-limit connection requests, messages, organization invitations and event invitations.

# 892. User reputation safety signals

Account age, verification, report history, rate-limit violations — **internal only, never an opaque public score.**

# 893. Block evasion review

Prevent trivial bypass. **Do not reveal the blocker's actions.**

# 894. Social discovery controls

Discoverable by campus, by course, by interests, or not at all.

# 895. Course roster privacy

**Enrollment is not public.** Peer discovery requires institutional policy and the user's own privacy settings.

# 896. Social graph export restrictions

**No bulk student relationship graph** to ordinary users or organizations.

# 897. Organization mass messaging limits

Audience limited to followers, members, applicants and attendees. **A club cannot message the university.**

# 898. University broadcast authorization

Campus-wide broadcast needs dedicated institutional permission.

# 899. Email sending reputation

Verified sending domains, bounce handling, complaint handling, suppression.

# 900. Email bounce handling

Delivered, bounced, suppressed. **Do not keep sending to a hard-bounced address.**

# 901. Email template system

Centralized, tenant-aware. **No arbitrary unsafe HTML.**

# 902. Email preview

Desktop, mobile and plain text, before a large send.

# 903. Communication scheduling

With cancellation before send.

# 904. Communication timezone

Tenant timezone unless explicitly configured otherwise.

# 905. Communication quiet policy

Respect user quiet hours. Organizations do not schedule unnecessary push at unreasonable times.

# 906. Campus emergency override

Only authoritative emergency integrations may bypass notification preferences. **A normal admin cannot mark a marketing message as an emergency.**

# 907. Search infrastructure scaling

By tenant, entity type, visibility and status, with authorization still enforced.

# 908. Search index tenant partitioning

**Tenant context belongs in the index and the query — never only in a frontend filter.**

# 909. Search index permission model

Private files, messages and notes are searchable only by authorized users.

# 910. Search index deletion

Deleted and private content leaves the index promptly.

# 911. Search index update

Updates propagate reliably; indexing failures are tracked.

# 912. Search fallback

A basic safe database search if the advanced service fails. **The application does not become unusable.**

# 913. Semantic search

Embeddings with tenant and permission filters. **Semantic search must not become a way around access control.**

# 914. Semantic search source display

Name the document, course and source.

# 915. AI and search unification

Intent → search → permission → results → answer. **The AI must not hallucinate results the search did not return.**

# 916. Global navigation state

Preserve filters, query, scroll and selected tab across navigation where practical.

# 917. Breadcrumbs

In deep desktop workflows. **Not on simple mobile pages.**

# 918. Recent context switcher

Recent items in the command palette.

# 919. Favorite workspaces

Pin a whole workspace configuration.

# 920. Window memory

Tabs, active tab, split and geometry, where the platform permits.

# 921. Window privacy

**Do not persist sensitive transient modal or input state across session restoration.**

# 922. Logout multi-window

Logging out in one window invalidates authenticated state in all of them.

# 923. Account switch multi-window

**No window left authenticated as the previous account.**

# 924. Tenant switch multi-window

Decide explicitly whether the current window switches or a new one opens. **Never silently reinterpret existing tabs under the wrong tenant.**

# 925. Tenant-bound tabs

Each tab stores its tenant, with an institution indicator when more than one is open.

# 926. Cross-tenant tab safety

**A tab opened under one institution's permissions cannot reuse them after a switch.** Reauthorize against the tab's own tenant.

# 927. Application startup

Authentication, essential preferences, current tenant, current route — then progressive loading. **Do not block startup on marketplace or recommendations.**

# 928. App shell

Navigation appears quickly. **No blank screen while modules initialize.**

# 929. Route code splitting

Spreadsheets, presentations, admin, marketplace and AI load on demand.

# 930. Prefetching

Careful. **Do not aggressively consume a student's bandwidth.**

# 931. Mobile bandwidth mode

Reduced imagery and media for poor connectivity.

# 932. Image lazy loading

Offscreen campus, event and profile images.

# 933. Video delivery

Streaming, not a large upfront download.

# 934. Large file upload

Resumable and chunked, with progress.

# 935. Upload cancellation

Cancellable, with incomplete server artifacts cleaned up.

# 936. Upload retry

Recovers from a temporary interruption.

# 937. Storage processing status

Uploading, processing, ready, failed.

# 938. File conversion failure

**The original stays downloadable** where authorized, even when preview generation fails.

# 939. Thumbnail generation

Asynchronous and safe.

# 940. Document search indexing

Searchable after processing, with indexing state visible internally.

# 941. User data export package

A structured archive of user-owned data, with a secure expiring download.

# 942. Export status

Preparing, ready, expired, failed.

# 943. Account deletion flow

Explain what is deleted, what may be retained, what happens to shared content and to institutional records. Require confirmation.

# 944. Shared content after deletion

**An organization's document does not disappear because its creator deleted their account.** Ownership transition is defined.

# 945. Anonymization

**Do not call something anonymized if re-identification remains trivial.**

# 946. University data export on termination

Authorized export per the agreement, with completion tracked.

# 947. Tenant deletion

Contract authorization, retention review, exports complete, integrations disconnected, legal holds checked, strong confirmation.

# 948. Deletion certificate support

Record completion evidence. **Do not generate legal certification language without review.**

# 949. Final product inventory

An automated, current inventory of routes, features, roles, permissions, APIs, integrations, database entities, background jobs and feature flags — **so that no system is unknown.**

# 950. Dead code audit

Unused routes, components, old flags, legacy APIs, duplicate styles — removed carefully after usage verification.

# 951. Dependency audit

Unused packages, abandoned libraries, duplicates. **Do not rewrite stable systems for novelty.**

# 952. Bundle audit

Identify heavy dependencies; lazy-load or replace where justified.

# 953. Database schema documentation

Entities, relationships, tenant ownership, sensitivity classification.

# 954. Permission documentation

A role-by-resource matrix. **Server rules remain authoritative.**

# 955. Feature dependency documentation

What each feature requires to function.

# 956. Operational ownership documentation

Every production system has a named owner.

# 957. Runbook library

SSO outage, LMS sync failure, AI outage, database incident, search outage, email delivery, file storage.

# 958. Runbook testing

**A runbook nobody has tested is not evidence.** Exercise the critical ones in non-production.

# 959. On-call readiness

Incident ownership outside ordinary development workflow. **Do not promise 24/7 response without actual staffing.**

# 960. Escalation matrix

Severity maps to owner, response process and customer communication.

# 961. Postmortem process

Impact, timeline, root cause, resolution, corrective actions. **System improvement, not blame.**

# 962. Corrective action tracking

Postmortem actions enter the backlog with an owner, priority, target release, status and verification. **They do not disappear into a document, and an action is not closed because code merged** — the failure mode has to be verified gone.

# 963. Release governance

`DEVELOPMENT`, `INTERNAL`, `BETA`, `RELEASE CANDIDATE`, `PRODUCTION`.

# 964. Release candidate

An immutable candidate, run through tests, security, accessibility, integration, migration, performance and UAT. **Do not keep adding unrelated features to a release candidate.**

# 965. Release approval

Appropriate technical approval; high-risk releases may need engineering, security, product and implementation.

# 966. Release manifest

Version, commit, migrations, feature flags, integration changes, known issues, rollback procedure.

# 967. Semantic versioning

Consistent and meaningful. **No meaningless build names.**

# 968. Database compatibility window

Deploy so rollback stays possible. **Avoid a migration that instantly makes the previous version unusable** unless it is genuinely necessary.

# 969. Feature flag cleanup

Flags are temporary controls, **not permanent technical debt** — each records owner, created date, purpose and removal condition.

# 970. University release channels

`STANDARD` and `EARLY ACCESS`. **Security fixes apply regardless.**

# 971. Tenant-specific release safety

**Never a tenant-specific build.** Configuration and feature flags.

# 972. Semester benchmark program

Task completion, speed, reliability, search quality, AI accuracy, accessibility, mobile usability, integration reliability.

# 973. Task completion benchmarks

Success rate, time, errors and steps, over representative tasks.

# 974. UX step count

Track the interactions a common workflow takes. **Do not optimize step count at the expense of clarity or safety.**

# 975. Search benchmark

Standardized queries per university, evaluated on correct result, ranking, zero-result rate and latency.

# 976. University process benchmark

Common institutional questions, **verified against the official source.**

# 977. AI benchmark suite

Academic planning, university navigation, study support, registration, degree planning, campus discovery, productivity, career.

# 978. AI factuality benchmark

Correct, partially correct, unsupported, incorrect — against authoritative data. **Do not rely on model self-evaluation.**

# 979. AI source benchmark

Correct source, correct tenant, current, valid citation.

# 980. AI action benchmark

Intent recognition, correct tool, correct arguments, permission, confirmation, execution, receipt.

# 981. AI non-action benchmark

**The AI must know when not to act.** *Drop it* is ambiguous and needs clarification; *read my roommate's messages* is unauthorized and must not execute.

# 982. AI latency benchmark

Time to first response, tool latency, total latency. **Optimize without sacrificing correctness.**

# 983. AI cost benchmark

Cost per chat, study plan, document analysis, registration plan and meeting summary, used to tune routing.

# 984. AI quality regression

Re-run the suite on model, prompt, retrieval or tool changes. **Do not assume a newer model improves these workflows.**

# 985. Search quality regression

Re-run search benchmarks after index or ranking changes.

# 986. Accessibility regression

Automated accessibility tests in CI for critical components and routes.

# 987. Visual regression

Home, calendar, directory, course, AI, registration, admin — with intentional changes reviewed.

# 988. Mobile visual regression

375, 390 and 430 px states.

# 989. Dark mode regression

Core pages in light and dark.

# 990. Low-stimulation regression

**New features must respect low-stimulation mode** — experience §378, built as `CALMS` in `lib/look.ts` and guarded by `a11y/calm.test.ts`.

# 991. Theme regression

Custom accent and theme tokens must not break contrast or layout.

# 992. Design consistency linter

Discourage arbitrary colours, arbitrary spacing, non-system buttons and duplicated inline styles. *(The style audit in `npm run lint` already enforces the type scale and token definitions.)*

# 993. UI component inventory

**Not five implementations of a modal.**

# 994. Component deprecation

Mark, migrate, remove at zero usage.

# 995. Design review checklist

Primary action obvious, anything removable, mobile, keyboard, screen reader, dark mode, low stimulation, loading, empty, error.

# 996. Product copy system

One word for one concept. **Organization, not club and group and community**, unless the distinction is intentional.

# 997. University terminology override

Tenant display terms over a normalized internal entity.

# 998. Error copy system

What happened, what was preserved, what the user can do.

# 999. Success copy system

*Event saved*, not *Success!*

# 1000. Semester design north star

**As easy to understand as a consumer app, with the capability of an enterprise university platform underneath.** The student never feels the complexity required to operate the institution.

# 1001. Developer experience

README, architecture, setup, testing, deployment, database, integrations, AI, design system.

# 1002. One-command development setup

Install, configure, seed, run. A `.env.example` **without secrets.**

# 1003. Development seed

A synthetic dataset. **Never require production data locally.**

# 1004. Role test accounts

Development and demo personas only.

# 1005. Development reset

Safe local reset and seed. **The same command must never be able to reset production.**

# 1006. Environment guards

Dangerous development utilities refuse to run in production.

# 1007. Migration commands

Create, apply, roll back, check status — documented.

# 1008. Test commands

Unit, integration, E2E, accessibility, security, build — documented.

# 1009. Code quality

Type safety, linting, formatting, tests. **Do not introduce competing formatters or linters.**

# 1010. Module boundaries

Organized by domain rather than one enormous miscellaneous folder.

# 1011. Shared core

Auth, permissions, tenant, design system, API client, analytics, errors — **not duplicated per domain.**

# 1012. No god components

Split components that combine fetching, authorization, business logic, presentation and modals. **Do not refactor solely to reduce line count.**

# 1013. No god services

No single service holding all domain logic.

# 1014. Domain types

Explicit types for important concepts. **Not untyped generic objects.**

# 1015. Contract testing

Adapters satisfy a normalized provider contract, **only where the provider genuinely has the capability.**

# 1016. Provider capabilities

Providers advertise what they can do; the UI adapts. **Do not assume every provider supports every action.**

# 1017. Graceful capability differences

Offer the alternative — *Registration changes must be completed in your university portal* — rather than a dead button.

# 1018. Documentation as code

Docs live near the code and change in the same commit as the architecture they describe.

# 1019. Architecture decision records

ADRs for major decisions: multi-tenant strategy, authentication architecture, AI gateway.

# 1020. Tech debt register

Issue, impact, risk, owner, target. **Not hidden in TODO comments.**

# 1021. TODO governance

Important TODOs link to tracked work. **No permanent `// TODO fix later`.**

# 1022. Sales to implementation handoff

Customer goals, purchased modules, promised capabilities, known limitations, stakeholders, target launch — with implementation confirming scope.

# 1023. No untracked sales promises

`COMMITTED`, `PLANNED`, `NOT COMMITTED`. **A sales promise must not become an undocumented engineering obligation.**

# 1024. Customer requirement traceability

Each contracted requirement maps to a feature, configuration, integration, test and evidence.

# 1025. Implementation acceptance matrix

Requirement, owner, implementation, test, university acceptance.

# 1026. University success story data

Aggregate outcomes with permission. **Never publish a customer's name or data without it.**

# 1027. Reference customer program

Opt-in, and **entirely separate from product access.**

# 1028. Market differentiation

One identity, one search, one calendar, one campus graph, one workspace, one AI layer, one university experience. **Compete through integration, not feature count.**

# 1029. Competitive moat — campus graph

The structured relationships between student, course, professor, assignment, organization, event, document, career, campus and university process. **AI operates on top of this graph**, which is what makes it more than chat.

# 1030. Competitive moat — integration graph

Each implementation expands reusable knowledge of identity providers, LMS, SIS, degree audit, calendar, email and campus systems — **while tenant data stays isolated.**

# 1031. Competitive moat — university process graph

Normalize the intent (*register a course*, *change major*, *request a transcript*), then map each institution's own process onto it.

# 1032. Competitive moat — personal context

With permission: what am I studying, what is due, where do I need to be, what am I in, what am I planning, what am I working on.

# 1033. Competitive moat — action layer

Move from *here's how* to *I can help you do that*, through safe integrated tools.

# 1034. Product north star

**The intelligent operating layer between a student and their university.** An LMS, a social app, a planner, an AI tutor and a marketplace are modules, not the product.

# 1035. Student value proposition

*Semester tells me what I need to do, helps me do it, and connects everything at my university.*

# 1036. University value proposition

A configurable student-experience and intelligence layer that **connects existing institutional systems rather than requiring immediate replacement.**

# 1037. Faculty value proposition

A simpler contextual layer for communication, resources, office hours, course community and approved AI — **without abandoning institutional systems.**

# 1038. Organization value proposition

Discovery, recruitment, communication, events, files, continuity and administration in one system.

# 1039. Administrator value proposition

Configurable integrations, trusted campus information, communications, aggregate analytics, moderation, implementation controls and AI governance.

# 1040. Final simplicity requirement

**Despite everything in this document, a new student must not see a thousand features.** Initially: home, calendar, discover, ask, inbox. Everything else appears contextually. **This is critical**, and it is the same instruction as experience §351–353 arriving from the other end of the specification.

# 1041. Final UI principle

**Hide system complexity. Surface user intent.** Not *Degree Audit Engine* but *What do I still need to graduate?*

# 1042. Final AI principle

**AI should reduce navigation, not become another destination to navigate.**

# 1043. Final data principle

**Store structured truth once. Reuse it everywhere.** No per-module copies of course, event or user information.

# 1044. Final integration principle

**Integrate before replacing.**

# 1045. Final security principle

**No convenience feature may bypass authorization, tenant isolation, or truthful transaction state.**

# 1046. Final accessibility principle

**Accessibility is part of functionality, not post-launch polish.**

# 1047. Final privacy principle

**Collect the minimum. Explain its use. Give users meaningful control.**

# 1048. Final product principle

**Depth over superficial breadth.** A smaller number of deeply connected, reliable workflows beats hundreds of mock screens.

From here on, **do not prioritize feature count.** Prioritize functionality, connection, reliability, security, simplicity, accessibility, performance and trust.

# 1049. Master execution directive

More than a thousand requirements exist. **Do not implement everything simultaneously. Do not merely summarize. Do not produce another theoretical roadmap and stop.**

```
AUDIT → PRIORITIZE → IMPLEMENT → TEST → VERIFY → DOCUMENT → CONTINUE
```

# 1050. First execution action

Inspect the repository: framework, frontend, backend, database, authentication, routing, state, APIs, integrations, testing, deployment, existing features, mock features, broken features, debt. **The repository is the source of truth for implementation status** — not any description of it, including this document's own tables.

# 1051. Run the current application

Install, typecheck, lint, test, production build, launch. Record failures.

# 1052. Baseline route audit

Every major route, plus every route the router actually declares.

# 1053. Interaction audit

Every button, link, form, menu, card action, modal, tab, search and filter — **does it actually work?** Inventory it.

# 1054. Mock detection

Search for mock, fake, demo, placeholder, coming soon, TODO, sample, hardcoded. **Classify each. Do not blindly delete test or demo infrastructure.**

# 1055. Implementation database

`SEMESTER_IMPLEMENTATION_STATUS.md` — ID, feature, priority, phase, status, dependencies, files, tests, blocker, notes.

# 1056. Status values

`NOT_STARTED`, `AUDITING`, `IN_PROGRESS`, `BLOCKED_EXTERNAL`, `BLOCKED_INTERNAL`, `TESTING`, `COMPLETE`. **Never "mostly done".**

# 1057. Completion evidence

`COMPLETE` references implementation, database objects and tests by name.

# 1058. Implementation plan

`SEMESTER_IMPLEMENTATION_PLAN.md`, organized by executable phase rather than wish list.

# 1059. Phase A — stabilize

Build failures, runtime errors, broken routes, security vulnerabilities, authentication failures, data corruption risks, critical mobile failures. **No new feature outranks an unresolved P0.**

# 1060. Phase B — production foundation

Backend, database, authentication, authorization, tenant model, user model, environment configuration, logging, error handling, migrations.

# 1061. Phase C — core student network

Profiles, directory, search, connections, messaging, organizations, events, notifications.

# 1062. Phase D — academic core

Courses, assignments, academic calendar, study planner, study sessions, notes, course communities, degree planning foundations.

# 1063. Phase E — Semester Intelligence v1

**Only after reliable structured data exists.** Gateway, retrieval, campus search, academic Q&A, study planning, tool permissions, source grounding, action confirmation.

# 1064. Phase F — university readiness

Multi-tenancy, configuration, roles, admin, feature flags, tenant isolation, university data model, public campus data.

# 1065. Phase G — integrations

Identity, calendar, email, LMS, files, SIS, degree audit, registration — **priority set by the first real customer.**

# 1066. Phase H — productivity workspace

Drive, documents, PDF, projects, history, tabs, multi-window, slides, spreadsheets, whiteboards. **Do not replicate the whole of Microsoft and Google before core university functionality is strong.**

# 1067. Phase I — extended student life

Career, marketplace, housing, services, transportation, dining, recreation — by demand.

# 1068. Phase J — institutional productionization

SSO, integration administration, audit logs, security, privacy, accessibility, monitoring, backups, support, implementation tooling.

# 1069. Phase K — pilot

**Prove one campus deeply.** Not a nationwide launch first.

# 1070. Phase L — top-100 public campus catalog

After the reusable architecture works. **Do not fork the UI per university.**

# 1071. Phase M — multi-university contract scale

Each subsequent university requires less custom engineering than the one before.

# 1072. Dependency-first execution

What does this depend on, does it exist, is it production-ready. **Do not build AI registration before the course catalog, degree rules, registration provider, authorization and confirmation exist.**

# 1073. Vertical slice strategy

One domain, complete — database, API, permissions, profile, join, event, message, notifications, tests — **rather than twenty new screens.**

# 1074. One working flow at a time

Finish the journey before adding obscure widgets to it.

# 1075. Implementation batch size

One feature, one infrastructure improvement, or one refactor with a clear purpose. **Avoid 100-file uncontrolled rewrites.**

# 1076. Build after every batch

Typecheck, lint, tests, production build. Fix before proceeding.

# 1077. Browser verify after every user-facing batch

**Passing unit tests do not mean the UI works.** Launch it and interact with it.

# 1078. Console cleanliness

Runtime errors, framework warnings, failed requests, accessibility warnings.

# 1079. Network inspection

No duplicate requests, no exposed secrets, correct error responses, no massive payloads.

# 1080. Database inspection

After a write: correct tenant, correct owner, no duplicates, correct relationships.

# 1081. Refresh test

Act, refresh, verify. **If the state vanishes, the feature is not complete.**

# 1082. Logout and login test

Important state survives reauthentication.

# 1083. Second user test

Social features need two users and both sides tested.

# 1084. Role test

Allowed **and disallowed.** Do not only test success.

# 1085. Tenant test

Same tenant and different tenant.

# 1086. Mobile test

375, 390 and 430 px at minimum.

# 1087. Accessibility test

Keyboard, focus, label, contrast, screen-reader semantics, on every new interactive feature.

# 1088. Error test

Force the failure. **A feature tested only under success conditions is incomplete.**

# 1089. Loading test

Slow the response and check the loading state means something.

# 1090. Empty test

No records, useful empty state.

# 1091. Large data test

Enough data to expose pagination, overflow, performance and search. **Do not test a directory with five records.**

# 1092. Security test

Attempt the unauthorized request directly. **Do not rely on a hidden button.**

# 1093. AI test

Correct source, correct tenant, correct tool, correct permission, truthful result.

# 1094. Git discipline

Logical commits, scoped and described.

# 1095. Do not commit secrets

Check `.env`, credentials, private keys and tokens before every commit.

# 1096. Migration discipline

A schema change requires a migration. **Never a manual production edit instead.**

# 1097. Document as you build

Architecture, status, API, integration docs and runbooks change in the same batch.

# 1098. External blocker handling

Blocked on credentials, approval, a vendor account, a domain or SSO metadata? **Build the interface, adapter, validation, sandbox tests and configuration docs, mark `BLOCKED_EXTERNAL`, and continue.**

# 1099. Do not fake success

**Never `setTimeout(() => success)`.** Never a fabricated transaction response.

# 1100. Production truth standard

`REGISTERED`, `PAID`, `SENT`, `SUBMITTED`, `VERIFIED`, `CONNECTED` — **only when actually confirmed.**

# 1101. No placeholder interaction

A production-visible button works, is disabled with an explanation, or does not exist. **No clickable dead controls.**

# 1102. Remove "coming soon" clutter

Feature flags, not a navigation full of futures.

# 1103. MVP before platform completeness

**The goal is not all 1,200 requirements.** It is a deeply functional, secure MVP capable of a serious university pilot.

# 1104. Pilot MVP

Authentication, university identity, profiles, directory, search, courses, calendar, organizations, events, messaging, notifications, basic academics, AI v1, university admin, security, accessibility, monitoring.

# 1105. Pilot optional

Marketplace payments, housing transactions, direct registration, native office suite and advanced analytics may stay disabled.

# 1106. Pilot university

One deep deployment. **Do not spread across a hundred integrations before proving the model.**

# 1107. Top-100 strategy

Public profile, resources, organizations, events and academic information through reusable tenant architecture; deep integration after partnership.

# 1108. Product-market validation

Do students return, search, connect, message, plan, discover and use the AI — **before building every possible enterprise feature.**

# 1109. University validation

Do stakeholders value the integration, experience, administration, communication, analytics and AI governance.

# 1110. Priority formula

User impact, pilot requirement, dependency importance, security risk, contract importance, engineering effort. **Do not implement in numerical order.**

# 1111. P0 first

Security breach, cross-tenant leak, data corruption, authentication failure, false transaction success — **always interrupt the roadmap.**

# 1112. P1 second

Core workflow failures, major accessibility blockers, persistent data loss, major integration failure.

# 1113. P2

Important usability and product gaps.

# 1114. P3

Polish and optimization.

# 1115. Weekly technical health review

Build, tests, security, performance, dependencies, errors, tech debt.

# 1116. Weekly product health review

Activation, retention, search, academic usage, events, messaging, AI, feedback.

# 1117. Monthly architecture review

What is becoming hard to change, where duplication is growing, what is unreliable, what should be simplified. **Do not refactor everything monthly.**

# 1118. Performance budget

Initial JS, images, API latency, search latency — with regressions tracked.

# 1119. Accessibility budget

**No release knowingly increases critical accessibility violations.**

# 1120. Security budget

**Security debt affecting tenant isolation or authentication is never ordinary backlog.**

# 1121. Final university pilot demonstration

End to end as student, faculty, organization and university admin, before approaching an institution.

# 1122. Technical demonstration

Tenant isolation, SSO, adapters, audit logs, AI permissions, monitoring, backups, accessibility. **No secrets, no production student data.**

# 1123. Implementation demonstration

Tenant configuration, SSO setup, LMS configuration, data import, pilot cohort, feature flags, go-live checklist — **proving Semester is deployable, not merely attractive.**

# 1124. Contract-ready definition

Twenty-two conditions: pilot product works; multi-tenancy works; tenant isolation is tested; authentication works; university configuration works; integration architecture works; security documentation exists **and reflects reality**; privacy controls exist; accessibility blockers are resolved or formally documented with remediation; monitoring is operational; backups are operational; **restore has been tested**; incident response exists; implementation workflow exists; support workflow exists; pilot deployment provisions **without code forks**; core integrations have testable adapters; AI permission architecture works; admin roles are production-safe; critical E2E tests pass; no unresolved P0; no launch-blocking P1.

# 1125. Contract ready does not mean feature complete

Core platform, secure architecture, a deployable implementation model and a clear roadmap. **Do not delay pilots waiting for every future feature.**

# 1126. Commercial product packaging architecture

Module entitlements prepared **without prematurely fixing pricing.**

# 1127–1135. The modules

Semester Core; Academic OS; Semester Intelligence; Campus Engagement; Organization Management; Career; Workspace; Advanced Integrations; Enterprise Administration — each a bundle of capability, none a separate build.

# 1136. Entitlement-driven product

**No separate codebase per commercial tier.** Tenant, entitlements, feature flags, policy, role, permission.

# 1137. Module dependencies

A commercial module cannot be enabled in violation of its technical dependencies.

# 1138. Usage limit architecture

AI usage, storage, premium integrations. **Do not limit ordinary student core actions.**

# 1139. Contract entitlement activation

Auditable.

# 1140. Contract expiration

Notify, grace period, restrict premium writes, preserve per agreement, begin offboarding. **Never abrupt deletion.**

# 1141. Commercial admin console

Internal only. **Never expose pricing or contract details to students.**

# 1142. Billing provider integration

A reputable provider. **Do not build card storage.**

# 1143. Invoice metadata

ID, customer, period, status. Not a general ledger.

# 1144. University procurement status

Discovery, demo, technical review, security review, accessibility review, legal, procurement, contract.

# 1145. Procurement blockers

Tracked, with an owner.

# 1146. Sales engineering request system

Integration proof, security answer, architecture review, custom demo, data-flow diagram — tracked.

# 1147. No sales-engineering production hacks

**Never university-specific production code to satisfy a demo.** Demo configuration, a feature flag, or a sandbox.

# 1148. Implementation estimation framework

SSO complexity, LMS, SIS, degree audit, registration, migration, campuses, custom policy, accessibility requirements.

# 1149. Implementation complexity levels

Standard, moderate, complex. **Not a judgment of the university's sophistication.**

# 1150. Implementation reuse

Reuse adapters. **Do not duplicate code per customer.**

# 1151. Implementation template versioning

Track which version each university was built from.

# 1152. Customer-specific configuration

Declarative. **Not `if university === "Vanderbilt"` scattered through code.**

# 1153. Custom development policy

Core platform, optional module, generic extension or one-off integration — **prefer the reusable answer.**

# 1154. Implementation cost observability

Internal only.

# 1155. Time-to-launch metric

Contract to go-live, with delays attributed honestly to Semester, the university, a vendor or an approval.

# 1156. Implementation bottleneck analysis

What repeatedly slows deployments — then invest in the reusable fix.

# 1157. Support service architecture

Configurable tiers without changing the core. **Do not promise response times that are not operationally supportable.**

# 1158. Support coverage

Document actual hours, channels and escalation. **Avoid unsupported 24/7 claims.**

# 1159. University support portal

Open a ticket, view tickets, view incidents, view integration status, reach documentation.

# 1160. Student support vs university support

Separate paths for account help and for integration and configuration.

# 1161. Support ticket tenant isolation

Admins see only their own institution's eligible cases.

# 1162. Support attachments

Secure upload. **No public attachment URLs.**

# 1163. Support SLA measurement

Actual response and resolution. **Do not manipulate timestamps.**

# 1164. Support satisfaction

Simple, optional, and not repeatedly prompted.

# 1165. Self-service admin diagnostics

Test SSO, retry sync, view integration status, validate configuration, view failed imports.

# 1166. Admin diagnostic export

Safe package **excluding secrets.**

# 1167–1168. Knowledge bases

Internal implementation articles, and customer-facing admin articles.

# 1169. Documentation search

Searchable, with AI able to navigate approved help content.

# 1170. Documentation versioning

Indicate the product version where relevant.

# 1171. Documentation feedback

*Was this helpful?*, used to improve articles.

# 1172. API change policy

Versioning and deprecation. **No unexpected breaking changes.**

# 1173. API deprecation

Deprecated, replacement, removal date — communicated to integration owners.

# 1174. Integration change communication

Advance notice to university admins for material changes.

# 1175. University admin change log

Integration changed, feature enabled, policy changed.

# 1176. Student change log

Short and relevant.

# 1177. Change management by role

**Do not show every product announcement to everyone.**

# 1178. Major UI migration

A short explanation, temporary orientation, and familiar routes. **Do not make users relearn the product unexpectedly.**

# 1179. Route redirects

Old links should not break.

# 1180. Entity permalink stability

Canonical IDs and URLs stay stable across redesigns.

# 1181. Data migration between schema versions

Upgrades preserve user data, with migration tests required.

# 1182. File format longevity

Standard formats. **Avoid proprietary-only exports.**

# 1183. University exit portability

Documented formats. **Avoid deliberate lock-in through inaccessible data.**

# 1184. Student portability

Documents, notes, calendar and data, where permitted.

# 1185. Semester trust center

Factual security, privacy, accessibility, AI principles and system status. **Do not claim certifications not achieved.**

# 1186. Certification readiness

Prepare for assessment. **Do not claim SOC 2 or ISO unless formally achieved.**

# 1187. Compliance evidence system

Controls mapped to evidence.

# 1188. Control owners

Every important control has one.

# 1189. Control review cadence

**Do not let evidence go stale.**

# 1190. Vendor review

Hosting, database, AI, email, storage, monitoring.

# 1191. Vendor outage plan

Defined fallback and degraded behaviour for each critical vendor.

# 1192–1199. Provider abstractions

AI, email, storage, search, realtime, payment, map and observability providers sit behind interfaces, so a provider change does not mean rewriting every feature. **Do not over-abstract simple, stable infrastructure.**

# 1200. Final market position

**The intelligent university operating layer** connecting students, academics, campus life, productivity and institutional systems through one personalized experience.

# 1201. What Semester is not

Not merely another LMS, portal, social network, ChatGPT wrapper, planner or marketplace. Those are modules.

# 1202. Student north star

*What do I need to do? Where do I need to be? What is happening? Who do I need to talk to? What should I work on? How do I do something at my university?*

# 1203. University north star

Connect systems, improve navigation and discovery, provide governed AI, consolidate the student experience, reduce fragmentation — **without immediate replacement of core systems.**

# 1204. AI north star

**A permission-aware university agent** that understands context, retrieves authoritative information, explains it clearly, and safely executes authorized actions.

# 1205. UI north star

The power of an enterprise platform with the simplicity of a great consumer application.

# 1206. Implementation north star

Every new university needs more configuration and less custom engineering than the one before it.

# 1207. Data north star

Authoritative, sourced, tenant-isolated, reusable.

# 1208. Security north star

**Assume every client request, integration payload and AI instruction is untrusted until validated and authorized.**

# 1209. Accessibility north star

Every critical workflow usable regardless of input method or assistive technology.

# 1210. Trust north star

**Never tell the user something happened unless Semester can verify that it happened.**

# 1211. Final autonomous execution protocol

**Stop expanding the specification unless implementation reveals a genuine missing requirement. Begin execution.**

# 1212. Step 1 — repository audit

Create and maintain `SEMESTER_IMPLEMENTATION_PLAN.md`, `SEMESTER_IMPLEMENTATION_STATUS.md` and `SEMESTER_MARKET_READINESS.md`.

# 1213. Step 2 — build baseline

Install, typecheck, lint, test, production build. Fix blockers.

# 1214. Step 3 — map specification to code

**Do not create 1,200 unrelated tickets.** Group into domains: foundation, identity, academics, calendar, social, organizations, events, workspace, AI, university, integrations, admin, security, operations.

# 1215. Step 4 — identify current maturity

Per domain: `0 NOT PRESENT`, `1 PROTOTYPE`, `2 PARTIAL`, `3 FUNCTIONAL`, `4 PRODUCTION READY`. **Use evidence.**

# 1216. Step 5 — find the critical path

The shortest path from the current repository to a pilot-ready university product. Prioritize it.

# 1217. Step 6 — fix P0

Security, data loss, broken build, authentication, tenant leakage — first, always.

# 1218. Step 7 — establish pilot-ready core

Authentication, tenant model, profiles, directory, search, courses, calendar, organizations, events, messaging, notifications, AI v1, university admin, monitoring, accessibility, security. **Do not divert into optional modules until this stack is stable.**

# 1219. Step 8 — one complete vertical slice per domain

Database → API → authorization → UI → search → RSVP → notification → calendar → analytics → admin → tests. **Do not mark Event complete because a card renders.**

# 1220. Step 9 — establish the first tenant

Tenant configuration, campus data, academic calendar, organizations, services, courses and public resources are **data-driven**. Remove institution-specific frontend assumptions.

# 1221. Step 10 — generalize tenant architecture

Search the codebase for university-specific logic and decide, for each, whether it is configuration, a provider adapter, a data record, a policy or a feature flag. Then refactor.

# 1222. Step 11 — create a second synthetic tenant

University Alpha and University Beta, with separate users, courses, organizations, search, AI retrieval, admin and files. **This validates the architecture before scaling, not after.**

# 1223. Step 12 — tenant isolation hardening

Automated cross-tenant failure tests against REST, database services, search, files, realtime, AI retrieval, admin and exports.

# 1224. Step 13 — authorization hardening

A `RESOURCE × ROLE × ACTION` matrix, tested. A student cannot edit the university, manage another organization or read a private file; an organization admin manages **their** organization and no other.

# 1225. Step 14 — data model consolidation

Four unrelated representations of one domain concept is four places to fix a bug. Normalize carefully.

# 1226. Step 15 — canonical entity IDs

**Never index-, title- or display-name-based identity.** IDs survive a rename.

# 1227. Step 16 — source metadata

`source_type`, `provider`, `external_id`, `last_synced` on imported records.

# 1228. Step 17 — search v1

People, courses, organizations, events, campus resources — tenant-aware, permission-aware, typo tolerant, fast, paginated. **Before expanding to every entity.**

# 1229. Step 18 — search v2

Documents, notes, jobs, marketplace, housing, university processes — **only after core search performs well.**

# 1230. Step 19 — Home redesign

Today, next up, for you, campus now, recent. **Not every module on Home.**

# 1231. Step 20 — calendar as shared infrastructure

Class, assignment, exam, study, organization, event, meeting, career and personal all write to one abstraction. **Avoid separate calendars.**

# 1232. Step 21 — academic data normalization

University, term, school, department, course, section, enrollment, professor, assignment, exam — **before advanced degree or registration AI.**

# 1233. Step 22 — academic dashboard v1

Answers *what classes do I have, what is due, what is next, what exams are coming, what should I work on* — from actual structured data.

# 1234. Step 23 — study planner v1

Create, move, complete, link to course, link to exam. Adaptive planning follows later.

# 1235. Step 24 — course community v1

Course page, privacy-aware peers, discussion, study groups, resources, professor info. **Do not duplicate the LMS gradebook.**

# 1236. Step 25 — organization OS v1

Profile, follow, membership, applications, events, announcements, members, roles — before finance and elections.

# 1237. Step 26 — event platform v1

Create, publish, RSVP, capacity, save, calendar, share, cancel, notifications.

# 1238. Step 27 — messaging v1

Direct conversation, persistent history, unread, notifications, block, report. Realtime preferred.

# 1239. Step 28 — notification infrastructure

**No feature-specific notification tables.** One event-driven service.

# 1240. Step 29 — history infrastructure

Recently viewed, search history, AI history, recently closed workspace — privacy-controlled.

# 1241. Step 30 — workspace tabs

**Only after routes are stable**, and built on canonical routes and entities.

# 1242. Step 31 — multi-window

*Open in new window* first; drag-to-detach only where it is technically reliable.

# 1243. Step 32 — split view

Two panes maximum first: document + AI, course + notes, calendar + registration.

# 1244. Step 33 — documents v1

Create, edit, autosave, share, comments, version history, export. **Not a Google Docs clone immediately.**

# 1245. Step 34 — drive v1

Files, folders, recent, starred, shared, trash, course association.

# 1246. Step 35 — PDF v1

View, search, highlight, course association, AI source reference.

# 1247. Step 36 — projects v1

Tasks, files, members, meetings. Keep it simple.

# 1248. Step 37 — slides and sheets decision gate

Evaluate demand, differentiation, cost and existing integrations **before** building native editors. If Google and Microsoft integrations satisfy most use cases, contextual integration beats rebuilding an office suite.

# 1249. Step 38 — Semester AI gateway

**One gateway, one tool registry, one permissions layer, one cost meter, one audit layer. No direct model calls from arbitrary UI.**

# 1250. Step 39 — AI v1 capabilities

High-value **read** workflows, source-grounded: today's schedule, assignments, campus search, course questions, events, university processes.

# 1251. Step 40 — AI write actions

**Only after read reliability.** Reversible first — save an event, create a task, create a study session, follow an organization. Messages, email, registration and payments come later, with stronger confirmation.

# 1252. Step 41 — AI benchmark before release

**No new AI capability ships without a test set.** Accuracy, tool correctness, authorization, sources, latency, cost.

# 1253. Step 42 — degree tracker v1

Required courses, credits, choose-N groups, general education, major requirements. **Not every edge case immediately.**

# 1254. Step 43 — catalog year

**Catalog-year aware from the first production implementation.** Retrofitting it later is very hard.

# 1255. Step 44 — registration planner v1

Course search, section selection, weekly schedule, conflicts, saved plans, prerequisite display. **No direct registration yet.**

# 1256. Step 45 — registration integration

`READ → PRECHECK → WRITE SANDBOX → PILOT → PRODUCTION WRITE`.

# 1257. Step 46 — university process engine

Change major, request transcript, find advisor, add/drop, financial aid, housing, study abroad — each mapped to the tenant's official process.

# 1258. Step 47 — university knowledge base

Tenant-scoped, with source, owner, last verified, effective date and status.

# 1259. Step 48 — top-100 data platform

Identity, academic calendar, schools, departments, campus services, organizations, events for the initial cohort. **Not every category at once.**

# 1260. Step 49 — top-100 quality gate

A university is not publicly enabled until its baseline dataset passes defined completeness and quality checks.

# 1261. Step 50 — university public mode

Public data, events and resources. **No implication of partnership.**

# 1262. Step 51 — contracted mode

SSO, private student data, admin, integrations, institutional AI.

# 1263. Step 52 — admin v1

University profile, users and roles, organizations, official resources, feature flags, integrations.

# 1264. Step 53 — admin v2

Communications, moderation, analytics, data governance, AI policy.

# 1265. Step 54 — implementation console

**Built before signing multiple universities.** Tenant setup, SSO, integrations, data, testing, pilot, launch.

# 1266. Step 55 — university setup automation

**Creating a university must not require an engineer to hand-create dozens of database records.**

# 1267. Step 56 — SSO provider abstraction

Normalized before adding many customers.

# 1268. Step 57 — Google Workspace integration

Calendar, email, drive, via official APIs, where the first customer uses Google.

# 1269. Step 58 — Microsoft 365 integration

The normalized equivalent. **Do not design the core experience around Google-only assumptions.**

# 1270. Step 59 — LMS first provider

One adapter, built correctly, then tested through the normalized interface.

# 1271. Step 60 — SIS first provider

Same. **Not five shallow adapters at once.**

# 1272. Step 61 — provider test harness

Fixtures and sandbox tests, so an adapter is testable **without live production university credentials.**

# 1273. Step 62 — monitoring before pilot

Errors, uptime, database, integration health, AI failures. **No pilot without it.**

# 1274. Step 63 — backups before pilot

Automated backups, and a **restore test** before broader launch.

# 1275. Step 64 — support before pilot

Help centre, feedback, support request, escalation.

# 1276. Step 65 — accessibility before pilot

Critical workflows pass a defined review. **Do not defer accessibility to enterprise procurement.**

# 1277. Step 66 — security review before pilot

Auth, authorization, tenant isolation, file security, AI permissions, secrets, rate limits.

# 1278. Step 67 — privacy review before pilot

Profile defaults, course visibility, history, AI data, analytics, connected apps.

# 1279. Step 68 — demo tenant

Polished, synthetic, separate. **Sales never demonstrates on live student data.**

# 1280. Step 69 — pilot tenant

Real approved configuration and authorized data, with features kept limited.

# 1281. Step 70 — pilot cohort

Manageable, and chosen with the institution.

# 1282. Step 71 — pilot measurement

Activation, retention, search, errors, support, AI accuracy, integration reliability.

# 1283. Step 72 — pilot interviews

Confusion, missing workflows, trust issues, navigation problems, data errors. **Analytics alone will not show these.**

# 1284. Step 73 — pilot fix sprint

Pilot-discovered P0, P1, usability and data-quality issues **outrank new roadmap features.**

# 1285. Step 74 — university acceptance

SSO, data, integrations, admin, communications, support — validated before full launch.

# 1286. Step 75 — go live

The runbook, and intense monitoring.

# 1287. Step 76 — hypercare

**Do not return to feature development immediately.** Stabilize.

# 1288. Step 77 — post-launch review

What worked, what failed, what was custom, what should become reusable.

# 1289. Step 78 — second university

**Not by copying the first.** Generalized configuration and providers, with any custom engineering tracked.

# 1290. Step 79 — reduce implementation cost

After each university, identify the reusable mappings, provider code, config templates, tests and docs.

# 1291. Step 80 — expansion

**Only after a repeatable implementation exists** should institutional sales scale.

# 1292. Execution loop

Understand → check dependencies → design the smallest correct solution → implement → test → browser verify → security verify → mobile verify → accessibility verify → document → update status → continue.

# 1293. Completion rule

**A screen existing is not completion.** A feature works end to end.

# 1294. Stop-and-fix rule

A security flaw, an architectural blocker or a data integrity problem is fixed in the foundation **before** more is layered on it.

# 1295. No rewrite rule

**Do not rewrite working architecture because another technology looks cleaner.** Only when it prevents requirements, security demands it, maintenance cost is unacceptable, or migration has clear value.

# 1296. No premature enterprise complexity

No microservices, Kubernetes, Kafka or multiple databases without demonstrated need. **A strong modular monolith is acceptable.**

# 1297. No premature ML

Deterministic recommendations, ranking and matching first.

# 1298. No premature office suite rebuild

**Do not spend months reproducing Docs, Excel, PowerPoint or Zoom** before validating whether integrations plus contextual features deliver more.

# 1299. Build unique Semester advantages first

University context, course context, degree context, campus graph, student graph, process navigation, the AI action layer, cross-system workflows.

# 1300. Core competitive product

Semester Intelligence over academics, campus and workspace, all over the campus graph, all over the university's own systems.

# 1301. Market differentiator

**Not more screens. Everything connected.**

# 1302. Student experience differentiator

*What should I do today?* answered coherently across classes, assignments, exams, study plan, clubs, messages, career and calendar.

# 1303. University differentiator

A student experience, intelligence, workflow and integration layer **over** existing systems rather than instead of them.

# 1304. AI differentiator

Not *here's how registration usually works*, but the window, the remaining requirement and three eligible sections — **only when authorized data supports the statement.**

# 1305. Degree differentiator

Not *read the catalog*, but the four remaining requirements, sourced.

# 1306. Campus differentiator

Not *search the university website*, but the office that handles it, the official process and the deadline.

# 1307. Workspace differentiator

Assignment → document → meeting → slides → deadline → course, connected **even when the files live in Google or Microsoft.**

# 1308. History differentiator

What you were working on, in what course, on what project — under your control.

# 1309. Cross-device differentiator

MacBook → phone → desktop without losing work, history, calendar, messages or preferences.

# 1310. Final pilot experience

A pilot student uses Semester for **a full ordinary day**, not a demo. *If Semester is only useful during a demo, the product is not ready.*

# 1311. Final contract sales experience

Student, faculty and admin value, integration strategy, security, accessibility, AI governance and implementation — in one coherent demonstration.

# 1312. Final engineering experience

Clone, configure, seed, run, test — **without tribal knowledge.**

# 1313. Final implementation experience

Configure, connect, import, test, pilot, launch — **not fork, rewrite, patch.**

# 1314. Final admin experience

Normal operations without asking Semester engineering to edit a database.

# 1315. Final support experience

What went wrong, who owns it, what to do — **without sending a screenshot into an unknown inbox.**

# 1316. Final trust experience

*Is this official? Where did it come from? Did this actually happen? Who can see this?*

# 1317. Final market-ready check

A last audit of product, architecture, security, privacy, accessibility, reliability, AI, integrations, implementation, support and documentation.

# 1318. Final red team question

**If a university signs tomorrow, what would prevent us from safely launching them?** Every answer is a blocker or a documented dependency.

# 1319. Final student question

If a student opens Semester with no explanation, can they see why to use it? If not, simplify.

# 1320. Final faculty question

Does it make faculty workflow easier, or add a system to maintain? If the latter, redesign.

# 1321. Final admin question

Can the university control Semester **without giving itself inappropriate access to students?** If not, fix governance.

# 1322. Final AI question

Is it more useful because it understands authorized university context? If it behaves like a generic chatbot, improve the context rather than adding decorative AI.

# 1323. Final differentiation question

What can Semester do **because it connects systems** that a standalone app cannot? Invest there.

# 1324. Final complexity question

Of every screen: can this be simpler?

# 1325. Final implementation priority

**Do not build the entire specification before pursuing pilots.** Build enough to prove adoption, institutional value, integration, security and repeatability.

# 1326. Final execution command

**Execution mode. Do not return another high-level plan as the primary output.**

```
AUDIT → STABILIZE → SECURE → BUILD CORE → CONNECT CORE → AI V1
→ MULTI-TENANT → ADMIN → INTEGRATIONS → PILOT HARDENING
→ UNIVERSITY PILOT → ITERATE → SCALE
```

# 1327. After each session

Update `SEMESTER_IMPLEMENTATION_STATUS.md` and `SEMESTER_MARKET_READINESS.md` with **actual** changes.

# 1328. Each session report

`COMPLETED`, `TESTED`, `BLOCKED`, `NEXT` — with specific files and features.

# 1329. Never claim completion without testing

If it is not tested the status is `TESTING`, not `COMPLETE`.

# 1330. Never claim an integration connected without a connection

An adapter with no credentials is `IMPLEMENTED` and `BLOCKED_EXTERNAL`. It is not `CONNECTED`.

# 1331. Never claim a university partnership without a contract

**A public tenant is not a customer.**

# 1332. Never claim a security certification without an audit

Architecture readiness is not certification.

# 1333. Never claim accessibility conformance without evidence

Track what was actually tested.

# 1334. Never claim AI accuracy without a benchmark

Measure it.

# 1335. Never claim scale without a load test

Measure it.

# 1336. Never claim backup safety without a restore test

**A backup nobody has restored is not a backup.**

# 1337. Never claim a data migration complete without reconciliation

Compare source and destination.

# 1338. Never claim a transaction succeeded without an authoritative result

Payments, registration, email, applications, reservations, submissions.

# 1339. Final build philosophy

```
TRUST → RELIABILITY → USABILITY → CONNECTED FUNCTIONALITY → INTELLIGENCE → SCALE
```

**Do not reverse it.**

# 1340. Final product statement

A student understands, organizes, navigates and acts across their entire university experience from one trusted interface; a university deploys a modern student experience and AI layer over existing systems **without a high-risk replacement of its core infrastructure.**

# 1341. Begin

Inspect the repository. Establish the actual current state. Fix the most critical issue first. Then continue by dependency and priority until Semester is pilot-ready and contract-ready.
