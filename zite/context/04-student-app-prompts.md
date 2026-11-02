# Student app build prompts 1–10

> Source: same document, section 8. Run in order; each inherits the master command.
> Text extracted from the PDF with its layout kept; read it as the governing brief, not as proof that anything exists.

```text
8. Exact coding prompts for the student app
Paste the master context first. Then run these prompts sequentially.

Prompt 1 — Foundation and onboarding

 Implement Semester's student application foundation.

 Preserve existing code and design assets.
 Inspect the current architecture before editing.

 Build:
 - authenticated session
 - personal workspace
 - verified institutional memberships
 - workspace switcher
 - onboarding
 - Today / My Path / Search / Plan / Me navigation
 - responsive desktop rail and mobile tabs
 - system context bar
 - source and freshness components
 - global error and permission boundaries

 Do not permit self-assigned staff roles.
 Do not use frontend state as authorization.
 Use synthetic data until backend permissions are verified.

 Acceptance:
 two students cannot access each other's private data;
 two institutions cannot access each other's records;
 revoked memberships lose access;
 onboarding resumes without duplicating records;
 all navigation works by keyboard.


Prompt 2 — Today and Action Center

 Implement Today as a real permission-scoped read model.

 Show:
 next actions, deadlines, blockers, appointments,
 recent work, relevant notices, and source freshness.

 For every action include:
 title, reason, source, updated time,
 state, permitted action, and recovery path.

 Use deterministic priority rules.
 Do not invent AI urgency scores.

 Actions must link to working flows.
 Official handoffs must be labelled as handoffs.
 Do not claim completion until confirmation exists.

 Test loading, empty, stale, error, restricted,
 duplicate events, and delayed projection updates.

Prompt 3 — Plan, calendar, and tasks

 Implement persistent tasks, plans, and calendar events.

 Support:
 create, edit, complete, cancel, filter,
 due dates, time zones, linked course resources,
 calendar connections, and conflict visibility.

 Distinguish personal events from imported official events.
 Do not let editing a personal copy silently modify the official source.

 Implement concurrency checks and retry-safe mutations.
 For offline work, queue only approved personal edits.
 Do not queue financial or academic-record actions offline.

 Test daylight-saving transitions, all-day dates,
 concurrent edits, duplicate retries, and reconnect behavior.


Prompt 4 — Courses and Course Studio

 Implement the student's course workspace.

 Include:
 course list, section details, teaching team,
 syllabus references, assignments, deadlines,
 course materials, study links, notes,
 course AI policy, and official LMS links.

 Use the authorized course/enrollment model.
 Preserve source authority and sync freshness.

 If the integration is read-only,
 do not display submission or grade-edit actions
 as operational capabilities.

 Test unenrolled access, changed enrollment,
 restricted material, stale deadlines,
 missing source data, and integration failure.


Prompt 5 — Study and productivity

 Implement private study and productivity tools.

 Build:
 notes, documents, study sets, practice items,
 study sessions, source references, version history,
 export, and explicit sharing.

 Keep private by default.
 Reuse the shared resource and consent model.

 AI-generated study content may use only approved sources.
 Do not send institutional student records to a provider.

 Show generated content as AI-assisted.
 Preserve citations and allow reporting incorrect content.

 Test sharing expiry, revocation, version conflicts,
 deletion, export, and cross-workspace access.


Prompt 6 — My Path and registration readiness

 Implement My Path with goals, milestones,
 program requirements, degree-progress views,
 and registration readiness.

 Distinguish:
 official institutional facts,
 Semester-derived evaluations,
 student-entered plans,
 and estimates.

 Readiness must use versioned deterministic rules.
 Show which requirement produced each result.

 Do not imply a readiness result guarantees enrollment.
 Do not write to institutional records without an approved workflow.

 Test missing records, stale holds,
 conflicting requirements, policy version changes,
 incorrect mappings, and institutional handoff failure.


Prompt 7 — Search and Ask Semester

 Implement permission-aware Search and Ask Semester.

 Search:
 filter by authorization before returning titles,
 counts, snippets, files, or source content.

 AI:
 all requests go through a server-side gateway.
 Allow only approved source classes.
 Block student-record egress.
 Treat retrieved text as untrusted.

 Responses show:
 AI-assisted label, source citations,
 scope, policy, and limitations.

 Consequential actions require an impact preview
 and a separately authorized command.

 Test prompt injection, unauthorized retrieval,

 cross-tenant search, revoked sharing,
 provider outage, and unsupported answers.


Prompt 8 — Services, support, and delegated sharing

 Implement service discovery, appointment requests,
 support intake, and guardian/supporter sharing.

 Support:
 route to the correct owning office;
 show hours, expected next step, and status;
 avoid student-record content in ordinary support tickets.

 Sharing:
 preview exact payload, recipient, purpose, expiry;
 support revocation and access history.

 Do not infer guardian rights.
 Do not expose protected service reasons to instructors.
 Do not retain emergency report content without an approved requirement.

 Test expired delegation, revoked consent,
 wrong institution routing, restricted service categories,
 and inaccessible appointments.



Prompt 9 — Campus, community, career, and marketplace

 Implement these as connected domain modules,
 not decorative pages.

 Campus:
 events, organizations, maps, service discovery.

 Community:
 opt-in discoverability, groups, posts,
 membership, moderation, reporting.

 Career:
 opportunities, applications, portfolio evidence,
 appointments, employer access controls.

 Marketplace:
 listings, order states, payment adapter boundary,
 disputes, seller controls, approved app installation.

 Marketplace partners must not receive student records.

 Enable modules separately with verified permissions,
 working persistence, operational ownership,
 and complete failure states.

Prompt 10 — Student-app acceptance and hardening

 Audit the complete student application.

 Verify:
 authentication, tenant isolation, personal privacy,
 role boundaries, sharing revocation, source labels,
 freshness, accessibility, responsive behavior,
 offline limits, integration recovery,
 billing entitlement boundaries, and AI policy.

 Produce:
 route inventory,
 entity inventory,
 permission matrix,
 end-to-end journey results,
 unresolved defects,
 actual commands run,
 evidence references,
 launch blockers.

 Do not declare completion from screenshots.
 Do not claim tests passed unless executed.
 Do not deploy production.



```
