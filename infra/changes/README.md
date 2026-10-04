# Change records

One file per infrastructure pull request: `CC-<pull request number>.md`,
numbered by the pull request for the same reason decisions are
([`docs/decisions/README.md`](../../docs/decisions/README.md)) — the number is
unique before anything is written, so two open pull requests cannot collide.

A record is **required** when a pull request touches `infra/terraform/`,
`infra/policy/`, `.github/rulesets/`, or the infra/deploy workflows
(`scripts/infra/check-change-record.sh` decides, and fails the pull request if
the record is missing). It is **checked** by the test suite
(`app/src/lib/ops/infrastructure.test.ts`): header fields, sections, a real
approver for anything `approved`.

`infra-apply.yml` reads the header: it applies only a record whose `Status` is
`approved` and whose `Roots` includes the root being applied. Destroys of
protected resources must be named in `Approved-destroys`.

| Status | Meaning |
| --- | --- |
| `draft` | being written; cannot authorise an apply |
| `approved` | the approver below accepted the change and its rollback |
| `applied` | applied; `Applied` holds the run URL and the converge check result |
| `rejected` / `superseded` | kept, never deleted |

`Kind: emergency` is for adopting a change already made to production by hand.
It is written within one business day and says why the pipeline could not be
used. Emergencies are counted in the monthly review; more than two a quarter is
a finding about the pipeline, not about the person.

Copy [`TEMPLATE.md`](TEMPLATE.md).
