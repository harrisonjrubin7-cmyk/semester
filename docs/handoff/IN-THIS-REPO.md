# The handoff, as kept in this repository

This is the `handoff/` folder of the Semester design-system export, kept unchanged except for the `preflight.sh` Node 22 fix (see `docs/execute/00-setup-report.md`). Its own files say `design/handoff/`; here it is `docs/handoff/`, so run its scripts with `SRC=docs/handoff`.

Where this repository's decisions differ from `BUILD.md`, [`D-1287`](../decisions/D-1287.md) wins:

- `install.sh` is **not** run as shipped. Stream 01 diffs the handoff against the repo first and applies nothing until that diff is reviewed.
- Branches are one per stream, but the name is whatever the session is assigned; the pull request records it.
- The rest of the design export (`ui_kits/`, `templates/`, fonts) is not here. Ask the founder to re-supply it when a UI stream starts.

Code files here end in `.txt`; strip the suffix when copying one into the app.
