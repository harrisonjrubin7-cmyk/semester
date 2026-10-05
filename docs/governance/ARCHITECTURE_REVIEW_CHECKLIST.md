# Architecture review checklist

Use on any pull request that touches a watched path ([`FITNESS_FUNCTIONS.md`](FITNESS_FUNCTIONS.md)). Each item needs a citation, not a tick.

1. **ADR:** cites `ADR-nnnn` or `ADR-Exempt: <reason>`.
2. **Tenant:** where does the tenant/school come from? It must be derived from membership server-side; a client-supplied id is only compared, never trusted.
3. **Authorization:** which policy decision point call or RLS policy gates it? Which test shows it refusing?
4. **Forged input:** for any `SECURITY DEFINER` function, is there a test with a forged tenant, actor and target?
5. **Grants:** any new grant to `anon`/`authenticated`? Is it in [`database/GRANT_ALLOWLIST.md`](../../database/GRANT_ALLOWLIST.md)?
6. **Audit / outbox:** does a sensitive mutation write both in the same transaction?
7. **AI:** does every new model, retrieval or tool path evaluate effective policy before it runs, and log the decision?
8. **Data:** classification, owner, retention, export, deletion and legal-hold behaviour stated?
9. **Integration:** source precedence, reconciliation, degraded mode, pause stated?
10. **Accessibility / states:** loading, empty, error, offline, degraded, recovery.
11. **Operations:** SLO, alert, runbook, kill switch, rollback.
12. **Claims:** does any user-visible or public text claim compliance, security or readiness? Is it in the claims register with evidence?
13. **Proof:** did a guard go red against the reverted fix before it went green (CLAUDE.md)?
