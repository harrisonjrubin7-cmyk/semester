# GitHub Pages production rollback drill

**Produced:** 2026-10-02
**Owner:** Harrison Rubin
**Production URL:** `https://harrisonjrubin7-cmyk.github.io/semester/`

## Result

The production Pages path was rolled back to the immediately preceding
successful main release, verified live, restored to current main, and verified
live again.

| Phase | Commit | GitHub evidence | Duration | Result |
| --- | --- | --- | ---: | --- |
| Protected-path control | `7675b99b151cf9450a3139520b1c8e26289976a4` via tag | [run 37014543257](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/37014543257) | 4s | Correctly rejected before deployment: production permits the protected main ref, not a tag |
| Roll back | `7675b99b151cf9450a3139520b1c8e26289976a4` | [run 36950752026, attempt 2](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/36950752026/attempts/2) | 1m 03s total; deploy 55s | Success |
| Restore current main | `3d87884cb64684054d2c27c07423af51c9c90460` | [run 36953148517, attempt 2](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/36953148517/attempts/2) | 1m 18s total; deploy 1m 10s | Success |

The supported rollback path was **Re-run all jobs** on the prior successful
main deployment. This keeps the deployment associated with the protected main
environment while using that run's pinned commit and artifact lineage. The
earlier runbook instruction to dispatch a tag was contradicted by the live
environment protection rule and has been corrected.

## Live verification

After the rollback and again after restoration, the repository's public
production smoke probe returned:

- frontend HTML: 200;
- deployed module asset: 200;
- deployed stylesheet asset: 200; and
- production Supabase PostgREST: 200 with the expected JSON array.

No database migration, function deployment or data mutation was part of this
exercise. Current main was restored before the drill closed.
