# Grading CI harness — how it fits (14 Oct)

Uploaded pack, filed here. Its own VERIFICATION.json is honest: syntax, Week 3 local grader and static build passed; **Docker, CI, browser and deployment were never run**. That's still true — nothing was run here either.

## Fixes made to the pack
1. **`0` passed as `False` and `1` as `True`.** Python's `==` treats them as equal, so a function returning `0/1` passed boolean tests (Week 3 is all booleans). All three graders now use a type-strict `same()` that also recurses into lists and dicts.
2. **Returning the string `"!ValueError"` passed an exception case.** Local graders compared the return value to the sentinel. A value can no longer satisfy an exception case.
3. **`curriculum/grader.py` looked for `curriculum/curriculum/labs`.** It's a copy of the root grader that kept the root's path. It now reads `labs/` next to itself.
4. **Container output with extra keys counted.** The Docker grader now requires a result to be exactly `{"value": …}` or an exception record.

## Where it plugs in
- **Course Studio / faculty grading** (ui_kits/course-studio, faculty-grading): visible-case feedback only. Reports carry `final_grade: null` and `manual_points_available: 70`; the instructor sets the grade. Matches the gradebook rule that graded ≠ released.
- **Workflow lab** (ui_kits/workflow-lab): different thing — human-graded AI router benchmark. Don't merge or replace it, and don't touch the root vercel.json; the pack's vercel.json is for a separate synthetic preview project.
- **Live layer** (handoff/live-integration): learner code is never run in edge functions or on Vercel.

## Added (14 Oct): isolation, hidden tests, CI activation
- **Expected values never enter the sandbox.** The container gets the function name and inputs only; comparison happens outside. A learner who prints forged results has to print the correct answers — which is solving the lab.
- **Learner output can't reach the result channel.** worker.py keeps a private copy of stdout and points learner `print` at stderr.
- **gVisor.** `docker_grade.py --runtime runsc` (or `GRADER_RUNTIME=runsc`) runs the container under gVisor's user-space kernel. CI installs a reviewed, checksum-verified release from `vars.GVISOR_RELEASE`.
- **Hidden tests.** `--hidden <dir>` adds `week_NN/tests.json` from outside the candidate checkout; reports split visible and hidden scores. In CI the hidden job runs only on instructor dispatch, behind the `grading` environment (required reviewer), cloning a separate private repo with a read-only deploy key. Pull requests and forks never see it.
- **Pinned image.** `grader-image/Dockerfile`: standard library only, no pip, base pinned by digest. Build, push, then set `vars.GRADER_IMAGE` to the pushed `@sha256` digest.
- **Pinned actions.** `tools/pin_actions.sh` resolves `actions/checkout` and `actions/upload-artifact` tags to full commit SHAs (dereferencing annotated tags), writes `.github/workflows/curriculum-ci.yml`, and fails if any placeholder remains.

## Still yours to do (needs your accounts)
1. Build + push the image; paste both digests. 2. Create the private hidden-tests repo and deploy key; set `HIDDEN_TESTS_REPO` / `HIDDEN_TESTS_DEPLOY_KEY`. 3. Set `GVISOR_RELEASE`. 4. Create the `grading` environment with an instructor reviewer. 5. Run `tools/pin_actions.sh`, review, commit. Reports stay `final_grade: null`; the instructor publishes grades.
