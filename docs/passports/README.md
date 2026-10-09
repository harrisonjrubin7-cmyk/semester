# Semester system passports

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

These twenty-five passports are the required design and governance boundary for
Semester's OS domains. They prevent a screen-first build from omitting system
authority, source of truth, workflows, events, evidence, ownership or rollback.

They are **planning contracts only**. A passport does not prove source code,
database migration, policy, test, deployment, provider connection, institution
approval or live operation. Capability and activation truth remain in the
rollout and governance registers.

The permitted relationship vocabulary is `native`, `connected`, `orchestrated`, `embedded`, `linked`.

| System | Relationship | Operational owner | Capability rows |
| --- | --- | --- | ---: |
| [Identity](./identity.md) | native, connected | Identity and security | 1 |
| [Authorization and Access](./authorization.md) | native, connected | Security and institutional administration | 1 |
| [Consent and Delegation](./consent.md) | native, orchestrated | Privacy | 1 |
| [Student Profile](./student-profile.md) | native, connected | Student experience and privacy | 3 |
| [Academic](./academic.md) | native, connected, orchestrated, embedded, linked | Academic platform | 5 |
| [Registration](./registration.md) | connected, orchestrated, embedded, linked | Registrar platform and integration operations | 1 |
| [Degree Planning](./degree.md) | native, connected, embedded, linked | Academic records and advising | 1 |
| [Learning](./learning.md) | native, connected | Learning experience and AI governance | 6 |
| [Grades](./grades.md) | native, connected, orchestrated | Academic operations | 1 |
| [Advising](./advising.md) | native, connected, orchestrated | Student success | 2 |
| [Calendar and Actions](./calendar-tasks.md) | native, connected, orchestrated | Academic experience | 8 |
| [Documents and Sources](./documents.md) | native, connected | Workspace platform and privacy | 10 |
| [Finance and Billing](./finance.md) | connected, orchestrated, embedded, linked | Finance operations | 1 |
| [Financial Aid](./financial-aid.md) | connected, orchestrated, embedded, linked | Financial-aid operations | 0 |
| [Campus Services](./campus.md) | native, connected, orchestrated, embedded, linked | Campus experience and partner operations | 5 |
| [Community and Communication](./community.md) | native, connected | Community trust and safety | 6 |
| [Career](./career.md) | native, connected, orchestrated, linked | Career platform | 4 |
| [Family and Supporters](./family.md) | native, connected, orchestrated | Privacy and institutional services | 1 |
| [Alumni](./alumni.md) | native, connected, linked | Lifecycle and career platform | 1 |
| [Institution Administration](./institution-admin.md) | native, connected, orchestrated | Institution platform and implementation | 2 |
| [Integrations](./integrations.md) | connected, orchestrated, embedded, linked | Integration operations | 1 |
| [AI Gateway](./ai-gateway.md) | native, connected, orchestrated | AI governance and platform engineering | 1 |
| [Operations](./operations.md) | native, connected, orchestrated | Operations and SRE | 2 |
| [Company OS](./company-os.md) | native, connected, orchestrated, linked | Company operations | 0 |
| [Developer Ecosystem](./developer-ecosystem.md) | native, connected | Platform engineering and security | 0 |

## Required implementation order

1. Use the machine-readable passport before designing a vertical slice.
2. Confirm existing repository truth and reuse the current shared primitives.
3. Implement records, policy, commands, events and workflow with tenant isolation.
4. Render authority, freshness and the complete state matrix on each screen.
5. Add audit, operational, accessibility, security and rollback evidence.
6. Keep external reads and writes disabled until their named gates are approved and verified.
