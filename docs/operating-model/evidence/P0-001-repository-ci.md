# P0-001 repository and CI evidence

Status: verified for repository baseline and continuous integration only

Evidence commit: `ec618dea63b9395efdf0ca52332c558f950a36cd`

Observed: 2026-10-11

The evidence commit is an ancestor of the current mainline. Its retained GitHub check runs completed with these conclusions:

| Gate | Conclusion | Immutable run |
| --- | --- | --- |
| Build and repository verification | Success | [build job 114540634220](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/38163326607/job/114540634220) |
| Dynamic application security | Success | [HawkScan job 114540634365](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/38163326653/job/114540634365) |
| Secret scanning | Success | [secrets job 114540634397](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/38163326607/job/114540634397) |
| Static analysis | Success | [analysis job 114540634203](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/38163326659/job/114540634203) |
| Artifact attestation | Success | [attestation job 114540635167](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/38163326648/job/114540635167) |

The build job retained successful steps for platform-control validation and report-drift detection, the application tests and build, database-policy checks, production-shape deployment rehearsal, and backup/restore rehearsal.

This packet verifies P0-001's repository and CI baseline. It does not establish deployment, provider activation, named-institution acceptance, production operation, or pilot readiness. Those remain separate downstream gates.
