# Design archive requirements matrix

**Audit snapshot:** `origin/main@7b7603e105847e4ac62aeba0097e0f6e0600d6d1`
**Currency note:** This ledger records that historical snapshot. The pull-request branch later incorporated `origin/main@32dd82410700680a4759174def31d0c5069f01eb`; repository-derived classifications and inventory counts must be refreshed against the reviewed tree before Phase 1 implementation.
**Archive:** `The Main Semester design system (2) copy 4.zip` at SHA-256 `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`
**Generated:** 2026-10-08
**Claim ceiling:** archive prototypes and documents are requirement evidence, not proof of production operation, approval, activation, accessibility, security, or institutional readiness.

## Ledger scope

This ledger contains 1,595 canonical requirements: 673 screens, 319 workflow steps, 82 document/control requirements, 75 component/API entries, 384 token entries, 13 themes, and 49 roles. It complements the per-file [archive manifest](ARCHIVE-MANIFEST.md). Narrative requirements inside the archive's 8,351 PDF pages and other documents remain source evidence and must be decomposed into additional atomic rows before the Phase 0 gate can pass.

## Status summary

| Status | Count |
| --- | ---: |
| existing/verified | 481 |
| existing/defective | 0 |
| partial | 561 |
| absent | 197 |
| ambiguous | 0 |
| conflict | 336 |
| externally blocked | 20 |
| not applicable | 0 |
| **Total requirements / scheduled requirement work items** | **1595** |

### Canonical status definitions

These definitions govern every shard and the aggregate counts above:

| Status | Reproducible classification rule |
| --- | --- |
| existing/verified | Concrete repository implementation evidence matches the requirement at the audited snapshot. This does not establish deployment, approval, activation, institutional operation, or completion of release gates. |
| existing/defective | A matching implementation exists, but a documented defect prevents the requirement from meeting its acceptance contract. |
| partial | Related implementation or documentation exists, but the requirement is incomplete, narrower than the archive concept, semantically unresolved, or lacks authority/approval evidence. |
| absent | No production-repository implementation or semantic equivalent was located at the audited snapshot. Archive-only prototypes and documents do not count as implementation. |
| ambiguous | Available evidence is insufficient or internally inconsistent, so no reproducible mapping or disposition can yet be assigned. |
| conflict | The archive requirement diverges from a current authoritative repository contract, value, selector, data/security rule, or product decision and requires an explicit reconciliation decision. |
| externally blocked | Completion depends on named external institution, provider, legal, security, accessibility, or operations evidence rather than repository implementation alone. |
| not applicable | An explicit, evidence-linked disposition places the requirement outside the product scope; the rationale and approving owner must be recorded. |

## Requirement shards

The canonical 1,595-row ledger is split into reviewable shards. Requirement IDs remain stable; aggregate validation must read every Markdown file under `requirements/`. No shard exceeds GitHub's 500 KB raw-diff review limit.

| Shard | Rows |
| --- | ---: |
| [Component and API requirements](requirements/components.md) | 75 |
| [Document and control requirements](requirements/documents.md) | 82 |
| [Role and persona requirements](requirements/roles.md) | 49 |
| [Screens A](requirements/screens-a.md) | 80 |
| [Screens B](requirements/screens-b.md) | 82 |
| [Screens C](requirements/screens-c.md) | 39 |
| [Screens D](requirements/screens-d.md) | 29 |
| [Screens E](requirements/screens-e.md) | 36 |
| [Screens F](requirements/screens-f.md) | 29 |
| [Screens G](requirements/screens-g.md) | 38 |
| [Screens H](requirements/screens-h.md) | 35 |
| [Screens I](requirements/screens-i.md) | 13 |
| [Screens J](requirements/screens-j.md) | 40 |
| [Screens K](requirements/screens-k.md) | 49 |
| [Screens L](requirements/screens-l.md) | 53 |
| [Screens M](requirements/screens-m.md) | 48 |
| [Screens N](requirements/screens-n.md) | 102 |
| [Theme requirements](requirements/themes.md) | 13 |
| [Tokens 001–192](requirements/tokens-001-192.md) | 192 |
| [Tokens 193–384](requirements/tokens-193-384.md) | 192 |
| [Workflows 001–080](requirements/workflows-001-080.md) | 80 |
| [Workflows 081–160](requirements/workflows-081-160.md) | 80 |
| [Workflows 161–240](requirements/workflows-161-240.md) | 80 |
| [Workflows 241–319](requirements/workflows-241-319.md) | 79 |
| **Total** | **1595** |
