# Per-change threat record

> Part of [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) §2. Copy into the pull
> request description (or `docs/decisions/D-<pull request number>.md` when the
> change is a decision) for any change that touches a trust boundary.
> `docs/trust/SECURE-DEVELOPMENT-LIFECYCLE.md` records "consistent per-change
> threat/privacy design records: absent". This is the record.

**When it is required.** The change adds or alters: a table, policy, RPC or
`SECURITY DEFINER` function; an Edge Function or gateway route; an integration
(LTI, SCIM, SSO, OAuth, webhook); anything the AI can read or do; an export,
share or deletion path; a role, capability or admin screen; storage; a header
or CSP; a new third party. A change that touches none of these says "no trust
boundary touched" in one line.

## The record

1. **What is new.** One sentence, plus the data classes involved
   ([`docs/trust/DATA-CLASSIFICATION-STANDARD.md`](../trust/DATA-CLASSIFICATION-STANDARD.md)).
2. **Who can reach it.** Anonymous / signed-in user / another tenant's member /
   staff / service role / a third party. Which of these should **not**?
3. **STRIDE, one line each, "n/a" allowed but not blank.**
   - Spoofing — can the caller claim to be someone or some tenant they are not?
   - Tampering — can they change what they should only read?
   - Repudiation — would the action be in an audit table that cannot be edited?
   - Information disclosure — what is the worst row or field that leaks?
   - Denial of service — what stops one tenant exhausting it for another?
   - Elevation — what grants more than the caller had?
4. **The tenant question.** Name the column or gate that makes this tenant-scoped,
   and the TI-nn case (or new one) that fails if it is removed.
5. **The AI question** (if any). What can the model read, what can it do, and
   where is the human confirmation?
6. **Abuse case that was tried.** What the author actually attempted as the
   attacker, and what happened. "None" is an answer a reviewer will ask about.
7. **Detection.** Which DET-nn sees misuse, or the new one required.
8. **Rollback and kill switch.** How it is turned off without a deploy.
9. **Residual risk and who accepted it.** Severity on the register's scale; a
   residual High or Critical is not merged on one person's acceptance when a
   second reviewer exists.

A reviewer who finds item 4 or 6 empty on a change that needed it sends it back.
