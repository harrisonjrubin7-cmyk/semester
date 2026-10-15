# Backup, restore and rollback

Repository detail lives in RESTORE.md and ROLLBACK.md. This page sets the controls.

| Control | Target | Evidence |
|---|---|---|
| Point-in-time recovery enabled | RPO ≤ 15 min (proposed) | Supabase project settings screenshot, plus the restore drill |
| Restore drill | Quarterly, into an isolated project | Drill record: start, end, row counts, RLS re-check |
| Rollback | Every release names a rollback target | Release record |
| Migration rollback | Forward-fix by default; a down path for risky DDL | Migration review |
| Post-restore RLS validation | Rerun every pgTAP suite | CI link |
| Secret rotation drill | Quarterly | Rotation record |

After a restore, a degraded mode serves read-only official data, labelled with how fresh it is. It never shows stale data as current.
