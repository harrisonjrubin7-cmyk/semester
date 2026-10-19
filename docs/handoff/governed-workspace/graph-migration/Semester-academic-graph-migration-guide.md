# Relational graph and migration guide

Status: proposed design, not SQL execution, actual migration, certified parity or production approval.

## Canonical architecture

Keep the shared tenant/node/fact/edge/scope/grant/source/freshness/audit foundation. Add typed course/section/prerequisite/resource projections rather than separate copies. Node identity and relationship semantics are independent from source-file representation. Every fact retains source authority, version, freshness and confidentiality; derived facts retain input lineage. [file:109][file:121]

## Prerequisite rules

Fictional example: CS 220 requires ALL(ANY(CS 101 completed under approved grade policy, approved placement), MATH 120 under concurrent-enrollment policy).
ALL: any false -> not_satisfied; all true -> satisfied; otherwise unknown.
ANY: any true -> satisfied; all false -> not_satisfied; otherwise unknown.
Missing, stale, unapproved or ambiguous evidence stays unknown. Preserve catalog/term/rule versions; use institution-defined grade ordering and approved transfer equivalencies. Waivers/permission are scoped dated institutional decisions, not note links. Concurrent eligibility is separate from completed credit. A satisfied prerequisite result alone does not authorize enrollment.

## Backlinks versus relations versus rules

Store one directed link and query its incoming edges for backlinks; do not duplicate inverse edges just to display a backlink. Unlinked mentions are candidate suggestions, not established relations. A typed relation has declared meaning, valid endpoint types and provenance. A prerequisite expression adds logical operators, timing, approved threshold policies and authoritative version. All reverse queries enforce node/edge/fact permission and cannot leak hidden note existence or titles.

## Tool trade-offs

Notion offers links/backlinks plus database relations/rollups; Obsidian offers local Markdown plus explicit note links, graph and linked/unlinked mentions. Notion is a strong source for structured team work; Obsidian for personal portable note relationships. Neither automatically supplies registrar authority or enforceable academic prerequisites. [web:170][web:164][web:172][web:152]
Google Workspace remains useful as collaborative authoring and institution-owned storage. File links need explicit academic mapping. Shared-drive ownership belongs to the organization and copying does not transfer institutional rights. [web:162]

## Migration gates

Authorize extraction and rights → preserve source ID/path/version and manifest → import to stage → map explicit links and relation definitions → quarantine unresolved identities/unsupported calculations → reconcile content, relationship endpoints/cardinality, permission intent and derived results → approve bounded workflow switch → retain source/recovery/export route. File count or CSV row count alone is not parity. Official replacement requires institution approval and reconciliation evidence. [file:108]

## SQL limits

The attached SQL is either the retained prior proposed consolidated draft or a dependent schema slice if the earlier artifact is unavailable. Read its header. It is not a tested migration and must be reconciled with the actual repository. Root uniqueness does not ensure root existence or cycle-free expressions. JSON/UUID metadata does not enforce policy semantics. Supply full auth/RLS/source/grant constraints, audited privileged paths and positive/negative CI tests before real data.
