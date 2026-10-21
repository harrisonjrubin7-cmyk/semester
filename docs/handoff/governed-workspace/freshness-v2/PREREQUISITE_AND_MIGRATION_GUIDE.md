# Prerequisite mapping and migration notes

Status: proposed relational design; SQL is dependent on reviewed shared workspace foundation and has not been executed.

Map canonical course identity separately from section/term. Keep resource nodes and typed edges in the shared graph. Prerequisite_rules holds the institutional target, catalog version, authoritative fact and effective interval. Expressions holds nested operators and typed leaves. Student evidence and evaluation histories remain private, versioned and non-provider. Resources retain content location, ownership, rights, source version and linked/owned-copy/license mode.

The five-row expression CSV is fictional: ALL(ANY(CS 101 completion, approved placement), MATH 120 concurrent policy). Aliases must be resolved to generated IDs and actual authorized source/course records; they are not production identifiers.

Evaluation: ALL is false if any false, true if all true, otherwise unknown; ANY is true if any true, false if all false, otherwise unknown. Grade policies are institution-defined, not alphabetic. A stale/missing equivalency is unknown. Permission/waiver is separately scoped authorized evidence. Eligibility is not capacity/hold/window/registration approval.

The SQL enforces parent references within a tenant/rule and at most one root, plus sibling positions. Approval still requires root existence, valid leaf/group arity, connectedness, acyclicity and no ambiguous effective rule. Do not discard co-requisite cases as ordinary directed prerequisite cycles without institutional semantics.

Notion relation exports become text URLs and cannot be automatically reimported to re-establish database relationships. [web:183] Obsidian properties are structured YAML and its internal links can update on renames under the documented setting. [web:185][web:184] External moves, ambiguous names and unsupported plugin-derived logic require explicit reconciliation. Google export includes documented categories such as current files, Keep-forever versions and comments; do not incorrectly assume exports always exclude those, or guarantee all revision/editor semantics. Inventory actual chosen export results. [web:182]

Safe migration: authorize scope → preserve manifest/source IDs/paths/digests → stage → map explicit relationships → quarantine ambiguity → compare content/relationships/rights/calculations → approve bounded switch → retain portable export/recovery. None of these tools' note/database links are automatically approved academic requirements. Source authority and freshness apply to imported facts just as native ones. [file:109]
