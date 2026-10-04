# RB-16 · Infrastructure drift detected, or the governed apply will not run

Class C1 · role security · alerts `infra:drift-detected` · components `pipeline:drift`, `pipeline:infra-apply`, `pipeline:infra`. The procedure and its rules are [CHANGE-CONTROL.md](../../infrastructure/CHANGE-CONTROL.md); this page is the order to do things in.

## Symptom

The daily `Infrastructure drift` run fails or opens an `infra-drift` issue, or `Infrastructure apply` is needed and will not run, or a console change was made by hand.

## Impact

Production differs from what the repository says it is, or cannot be made to match it by the governed route. A protective control (a branch protection, a WAF rule, an allow-list) may have been loosened, and nothing in the product shows it. Students see no effect until it matters.

## Diagnose

1. Read the drift plan output: which Terraform root, which object, what changed.
2. Was it deliberate? Check the break-glass log and the open change records in `infra/changes`. A change made by a person with a console is drift whatever the reason.
3. Did a protective control weaken (a policy, a gate, a TLS or allow-list setting)? If so treat it as P0 and go to [SECURITY.md](../../../SECURITY.md) first.
4. If the run did not happen at all, check the schedule and the environment credentials before assuming there is no drift: a silent drift check proves nothing.

## Mitigate

1. **Revert**: run `Infrastructure apply` for that root under a `standard` change record, so the live system is made to match `main` again.
2. **Adopt**: if the live change was right, open a pull request changing the Terraform to match, with a change record marked `Kind: emergency`.
3. Never close the issue, loosen the policy to make the plan pass, or add a policy exception without a record and an expiry.

## Escalate

Today the owner is also the only reviewer the apply environment asks for, so there is nobody to escalate *to*: say so in the incident record. A weakened protective control or an unexplained change goes straight to the security path and, for any legal question, to counsel through `LEGAL-REVIEW-QUEUE.md`.

## Verify

- A fresh drift run produces an empty plan for the root.
- The change record or emergency pull request exists and is linked from the issue.
- The break-glass log in CHANGE-CONTROL.md has an entry if a console was used.

## After

Postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if a protective control was weakened or the cause was unexplained. Record the one-line result in `CHANGELOG.md`, including that it was fine.
