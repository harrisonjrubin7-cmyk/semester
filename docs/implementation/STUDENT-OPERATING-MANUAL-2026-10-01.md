# Student Operating Manual implementation

Source: the three October 1 uploaded student-operating-manual and remaining-capabilities PDFs.

## Delivered

Home links into Work → My operating manual. All private planning features run without an AI key. Opt-in preferences specify planning style, starter minutes, representation, preferred repair route, quiet presentation, suggestion boundaries, reminder preference, planning time and breaks. Term preferences require an expiration date; visit preferences and structure selections are not persisted.

Structure changes the visible planning list only: low = one, medium = three, high = all. It never modifies dates, course access, institutional records or underlying items. All-history access and exports retain completed and hidden items.

The private workflow editor supports daily outcomes, decisions and reflections, waiting/blocked states and owners, submitted and follow-up dates, before/during/after meeting records, projects and explicit dependency maps, selected evidence, editable playbooks, private group charters and service packets with official owner, source, review date and uncertainty. Twelve starter playbooks are editable and reusable. Pre-mortem obstacles and if–then responses are explicit student inputs.

Plan review is a deterministic omission/dependency checklist with a rationale per suggestion. It never evaluates capability or behavior. Context preview displays exactly the selected source text; it does not transmit it. Human handoffs and follow-ups are editable drafts exported for student review, with recipient shown and no send action.

Exports: separated JSON, formula-safe CSV, Markdown, ZIP; browser print/save PDF; reviewed ICS for one explicitly selected planning window. Browser speech synthesis offers read aloud/stop where supported. No source notes enter calendar exports.

The dedicated operatingWorkspace field participates in existing private account persistence, account backup/restore, privacy disclosure and deletion. It is separate from routine notes and routine AI context. Existing account sync uses the account's existing latest-remote setting semantics for this field; concurrent offline edits are not a per-item merge.

## Existing foundations reused

Global Quick Capture, task/calendar systems, official service navigation, institutional policy controls and recovery screens remain available. Group charter capture here is private preparation; Semester's existing group collaboration remains a separate capability with its own permissions.

## Explicit remaining scope

This increment does not activate a browser extension, native voice capture, LMS launch provisioning, live packet sharing with expiry/revocation, faculty aggregate clarity signals, automatic source-availability/deadline monitoring, or external email/official writes. Those require their respective deployment/access and privacy controls; they must not be represented as live by this change. Reminder preferences are saved but do not schedule reminders. No optional opportunities, analytics or automatic study-block prompts are generated in this workspace; boundaries do not silently override unrelated existing app settings.

No institutional access to this private data is introduced. No inferred student scores, automatic staff notifications, emotion inference, or automatic profile updates from reflections exist. Official actions stay with authorized humans and official systems.

## Verification

Production TypeScript/Vite build, repository lint, full Vitest suite, targeted export/persistence/privacy tests and interactive component tests. CI and the existing gated Pages workflow remain the deployment authority; build success alone is not evidence of a production deployment.

## Performance budget

The Work route now costs 44.0 KB compressed to open, including the private operating workflow editor, dependency map, and export controls. Its recorded measurement is updated to match the built route and its budget is recalculated using the repository’s standard 8 KB minimum headroom (53 KB total). The first-load and largest-file limits are unchanged and pass.
