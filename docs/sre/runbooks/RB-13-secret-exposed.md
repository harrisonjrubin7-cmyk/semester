# RB-13 · Secret exposed or provider key compromised

Class C0 · role security · alerts `security:secret-exposed` · the long form is [SECURITY.md](../../../SECURITY.md); the inventory is [SECRETS.md](../../../SECRETS.md).

## Symptom

gitleaks fails, a provider reports a leaked key, or a secret appears somewhere it should not.

## Impact

Potentially every student's data if the service-role key is involved; money if a payment key is; cost if an AI key is. Treat the first as P0.

## Diagnose

1. Which secret, where did it appear, since when? SECRETS.md lists the four stores and what each secret is worth to a stranger.
2. Was it ever used by someone else? Provider logs and the audit tables are the evidence; read them before rotating if you can do so quickly, never instead of rotating.
3. Is the repository history affected? Removing it from a later commit does not remove it from history.

## Mitigate

1. Stop it before you understand it: rotate or revoke at the provider first (SECURITY.md, *Rotate*). Close the gate if access was gained (*Close the gate*).
2. Update the new value in the correct store, redeploy only what reads it, and add a line to the rotation log in SECRETS.md.
3. Engage a relevant kill switch while rotating if the secret fronts a feature (`kill.ai_generation` for the AI key).

## Escalate

Today the owner is also the only responder, so there is nobody to escalate *to*: say so in the incident record rather than implying a second line exists. When a backup is named in the role holders table, page them after 15 minutes without a mitigation. P0 (data exposed, cross-tenant access, destructive loss) goes straight to [SECURITY.md](../../../SECURITY.md) and counsel via `LEGAL-REVIEW-QUEUE.md`. Legal conclusions about notification duties go to qualified counsel; this page does not make them.

## Verify

- The old secret no longer works at the provider.
- The service using the new secret passes its probe.
- The rotation log has an entry with the date and who did it.

## After

Open a postmortem from [the template](../POSTMORTEM-TEMPLATE.md) if this was P0 or P1, or if it burned more than 10% of any journey's monthly budget. Record the one-line result in `CHANGELOG.md`, including that it was fine.
