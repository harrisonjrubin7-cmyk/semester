# Ethical AI governance board

The AI evaluation harness, the classification gate, course policy precedence and the kill switch are technical
controls. In higher education, AI governance increasingly needs **institutional structures** as well: a board with
standing, a charter and published decisions, not just a list of rules for tools. See also
[AI_GOVERNANCE.md](../market-readiness/AI_GOVERNANCE.md) for the enforcement boundaries already in code.

## Membership

| Seat | Why |
| --- | --- |
| Product (chair until an independent chair is appointed) | Owns the roadmap the board constrains |
| Engineering/AI | Knows what the system actually does |
| Privacy/legal | Data-use and regulatory boundary |
| Accessibility | AI output is content; it has to be accessible |
| Academic affairs/faculty | Academic integrity and pedagogy |
| Library/research | Sources, citation and research integrity |
| Student representative | The people it is used on |
| Student success | Support and equity impact |
| Security | Provider and prompt-injection risk |
| Institutional partner representative, where appropriate | A tenant's view on high-risk changes |

Quorum is five members, and it must include privacy/legal and a student or faculty seat.

## Responsibilities

- Approve new AI use cases (each one needs a charter and a scorecard; see
  [PORTFOLIO-GOVERNANCE.md](PORTFOLIO-GOVERNANCE.md)), and pass them through the G0–G5 gates in
  [AI-LIFECYCLE-GATES.md](AI-LIFECYCLE-GATES.md).
- Review high-risk changes: a new data class reaching a model, a new destination, or anything touching assessment.
- Approve provider changes, including a model version change behind the gateway.
- Review evaluation results each quarter, and any evaluation failure as it happens.
- Review fairness and accessibility impacts.
- Approve incident responses for AI quality incidents (the board chair is a named approver in `incident-comms.ts`).
- Review academic-integrity boundaries, including the integrity modes (explain, hint, practice, review, draft).
- Publish a plain-language governance summary each term.

## Decision rules

- **Fixed floors.** The board can't approve sending T3 or above to a consumer model, or sending T4 or above anywhere.
  Those are platform floors in `classification.ts`, not board decisions.
- **Decision rule.** A use case with any scorecard zero is not approved. It goes back for redesign.
- **Kill switch.** Any single member can ask operations to engage `kill.ai_generation` during an incident. The board
  reviews the decision afterwards and does not approve it beforehand.
- **Records.** Every decision goes in `DECISIONS.md` with the dissent recorded.

## Cadence

Quarterly, plus an ad hoc meeting within five business days for a high-risk change or an AI quality incident.
