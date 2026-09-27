# Code Studio and sandbox

**Status: not built. `codeExecution` is hard-wired `off`** in `lib/toolkit/flags.ts`
whatever the environment says, and a test pins it. The catalog lists *Code Studio*
as *Not built yet* and the defensive security sandbox as *Needs review before use*.

The reason is not caution for its own sake. Running student code needs an isolation
boundary that does not exist in this app today, and a flag that claimed otherwise
would be a false statement about the product.

## What a sandbox must meet before the flag can be unpinned

- No host filesystem, credentials, environment variables or internal service access.
- No outbound network except an explicit allowlist (package mirror, if any).
- CPU, memory, wall-clock and output-size limits; killed on breach.
- No privileged syscalls; unprivileged user; read-only base image.
- Fresh environment per run; nothing persists between students.
- Package and environment metadata recorded with each run (reproducibility).
- An audit log of runs, without the code's content where the code is the student's
  unsubmitted work.
- A threat-model review recorded in [AI-TOOLKIT-THREAT-MODEL.md](AI-TOOLKIT-THREAT-MODEL.md).

In-browser execution (a WebAssembly Python, say) is the likely first candidate
because it keeps untrusted code off Semester's servers entirely; it still needs the
network and resource limits above.

## Cyber boundary

Defensive learning only. No live targets, credential collection, malware, or
bypassing school systems (`NEVER` in `catalog.ts`, which no approval list can enable).
