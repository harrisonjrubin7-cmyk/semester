# Data classification and tool governance

## The gate

`gate(tier, action, courseAllowsAi)` in `lib/toolkit/classification.ts`. Actions:
`store`, `ai`, `share`, `export`, `external`.

| Tier | Store on device | AI | Share | Export | External tool |
| --- | --- | --- | --- | --- | --- |
| T0 Public | ✓ | if course permits | ✓ | ✓ | ✗ no connector |
| T1 Course-authorized | ✓ | if course permits | same course only | ✓ | ✗ |
| T2 Own academic work | ✓ | if course permits | ✓ | ✓ | ✗ |
| T3 Education records | ✓ device only | ✗ | ✗ | ✗ | ✗ |
| T4 Regulated / sensitive | ✗ | ✗ | ✗ | ✗ | ✗ |
| T5 Restricted research / IP | ✗ | ✗ | ✗ | ✗ | ✗ |
| T6 Highly restricted | ✗ | ✗ | ✗ | ✗ | ✗ |
| *Unclassified* | treated as T3 | ✗ | ✗ | ✗ | ✗ |

Every refusal carries a route: an institution-approved workflow for T3, the research,
compliance or security office for T4–T6.

**The gate is a lookup, not a classifier.** It does not read data to guess its tier —
that would be wrong in both directions and would require reading the very data it
protects. The student (or, later, course configuration) states the tier.

**It never widens a course policy.** T0 material still cannot go to AI where the
course forbids AI.

## Where it runs in this slice

- Data Studio import (`importCsv`): unclassified and T4+ refused.
- Stored data projects claiming T4+ are refused on read.
- The AI-use declaration only offers T0–T2 as the kind of material given to a tool.

Nothing in this slice sends data to an AI service, so the `ai` action is exercised by
tests and by the policy card, not by a live call. The phase that adds generation must
call the gate on the server.

## Tool governance

Tool states: *Opens in Semester*, *In the toolkit*, *Needs review before use*, *Not
built yet*, *Not permitted* (see [SUBJECT-WORKBENCH-CATALOG.md](SUBJECT-WORKBENCH-CATALOG.md)).
There are no tenant-approved external tools, because no connector exists; the
`externalConnectors` flag is hard-wired off.

The brief's governance tables (`tool_catalog`, `tool_entitlements`, `tool_licenses`,
`tool_data_classification_rules`, `course_tool_policies`, `tool_usage_audits`) are
specified in [AI-TOOLKIT-PERMISSION-MATRIX.md](AI-TOOLKIT-PERMISSION-MATRIX.md) for the
server phase; today the catalog is code and the approval list is empty.
