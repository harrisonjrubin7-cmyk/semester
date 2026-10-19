# The handoff, as kept in this repository

This is the `handoff/` folder of the Semester design-system export, kept unchanged except for the `preflight.sh` Node 22 fix (see `docs/execute/00-setup-report.md`). Its own files say `design/handoff/`; here it is `docs/handoff/`, so run its scripts with `SRC=docs/handoff`.

Two exports have been taken in:

- **6 October 2026** (stream 00, D-1287): 138 files, the `handoff/` folder only.
- **11 October 2026** (the archive `The_Main_Semester_design_system_2_copy_7.zip`, 644 files): 445 files added and 8 updated (`BUILD.md` gained its "Read this first" block; `execute/00-INDEX.md` gained streams 14–30; `execute/03-student-os.md` gained the Master plan contract; `manifest.json`, `README.md`, `semester-platform/README.md`, `.env.example.txt`, `.env.test.txt`). New folders: `action-center/`, `agent-suite/`, `api/`, `capability-blueprint/`, `completion-kit/`, `design_handoff_permissions_and_queues/`, `design_handoff_semester_launch/`, `developer-integration-pack/`, `governed-workspace/`, `launch-control-review/`, `mainframe/`, `master-deployment-package/`, `messaging-client/`, `production-integration-review/`, `prototype/` (the 281-route screen inventory, `screens.json`), `reference-slice/`, `registry/` (122 capabilities), `security-assurance/`, `slack-app/`, `specifications/`, `unified-platform-starter/`, `workflow-router-app/`. The 61 PDFs in the archive (27.6 MB) were **not** committed; most have a `.txt` twin beside them in the archive and the three specification PDFs the handoff says to copy to `docs/specifications/` were already there. The `.env.example.txt` and `.env.test.txt` files carry variable names only; the archive was scanned for key material before intake and none was found.

Where this repository's decisions differ from `BUILD.md`, [`D-1287`](../decisions/D-1287.md) wins:

- `install.sh` is **not** run as shipped. Stream 01 diffs the handoff against the repo first and applies nothing until that diff is reviewed.
- Branches are one per stream, but the name is whatever the session is assigned; the pull request records it.
- The rest of the design export (`ui_kits/`, `templates/`, fonts, the interactive prototype) is not here and was not in either archive. Ask the founder to re-supply it when a UI stream needs the running prototype; until then `prototype/SCREEN-INVENTORY.md` and `prototype/screens.json` are the acceptance list.

What the repository makes of this folder is in `docs/ecosystem/` (the coverage matrix over the 281 routes and 122 capabilities, generated and tested) and `docs/registry-status.json`.

Code files here end in `.txt`; strip the suffix when copying one into the app.
