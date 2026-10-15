# Curriculum portal commit candidate — how it fits (14 Oct)

Uploaded "tested commit candidate", filed here with its two JSON reports. Its own report: 6 harness tests, Week 3 visible cases, syntax and static build passed locally; **Docker, browser, the product test suite, CI and deployment were not run.** Nothing was run here either.

## Fixed before commit (same bugs as the grading harness)
1. **0/1 passed true/false cases** → type-strict `same()`.
2. **Expected answers were sent into the learner process** → the worker now gets the function name and inputs only; comparison stays in the trusted parent.
3. **Learner `print()` shared the result channel** → worker keeps a private stdout; learner output goes to stderr (still capped at 64 KiB, so the output-limit test still holds).
4. **Results with extra keys counted** → a result must be exactly `{"value": …}` or an exception record.

Two tests added to `test_runner.py` (now 8): `test_int_is_not_bool`, `test_forged_stdout_ignored`. Run `python3 test_runner.py` — expect 8 OK.

`curriculum-portal/build.mjs` and `portal.js` are stored as `build.mjs.txt` and `portal.js.txt` so the design-system bundler skips Node-only code — rename both back before committing (index.html loads portal.js).

## Check before merging
- **Action pin.** The workflow pins `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`. I couldn't verify that SHA from here. Confirm it with `gh api repos/actions/checkout/commits/3d3c42e5aac5ba805825da76410c181273ba90b1`, or regenerate it with `handoff/grading-ci-harness/tools/pin_actions.sh`.
- **Product CI only builds and self-tests the harness;** learner grading stays out of product CI (correct). Real grading runs from `handoff/grading-ci-harness` (gVisor, hidden tests, instructor-dispatched).
- **Its own vercel.json** is for a separate preview project — don't let it replace the root one.
- Run the existing product suite (`npm run release:check`) on the same commit before merging; the candidate's report says it wasn't.
