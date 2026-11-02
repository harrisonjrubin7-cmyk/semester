# Workflow contract validation

Status: proposed schema and illustrative definition; not runtime authorization or proof of implementation.

Schema: JSON Schema Draft 2020-12. Python validation uses jsonschema with FormatChecker. Run the included validator with the schema and example documents as its two command-line arguments. The jsonschema dependency must be installed in the target environment.

Local checks: schema meta-validation, one accepted illustrative example, fourteen rejected negative cases. These are contract-validation tests, not registration integration or production tests.

Semantic checks supplement structural validation: state references, reachability and terminal paths, duplicate IDs, missing recovery codes, recovery test references, and prohibited official-write modes.

Remaining integration checks: resolve every proposed reference against the actual registry; verify signed approval scope, identity, grants, source freshness, policy versions, evidence integrity, deployment and authority at runtime. The example uses proposed: and illustrative identifiers deliberately; they do not denote existing paths, services or approvals. The schema does not execute jobs, enforce database isolation, or validate legal sufficiency.

Separate workflow definition, execution instance, authority grants, and immutable receipts in implementation. Idempotency keys and approval contents belong to execution instances; this definition describes their required policy. Standard student enrollment may operate under institution-delegated rules; human authority does not imply manual approval of every eligible enrollment. Exceptions require the institution-defined approval path.
