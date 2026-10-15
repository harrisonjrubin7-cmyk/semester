> **v2 changes in this design project (not yet run — no Python here):**
> - **Tests: 40 → 88 visible cases.** Several labs could be passed while ignoring a rule — e.g. week 6 never tested an inactive grant or a missing scope, week 8 had one case, week 13 never tested private, metadata (169.254.169.254), IPv6 loopback, credential or non-443 URLs. Each docstring rule now has a case that fails without it.
> - **Docstrings and ASSIGNMENT.md state each rule exactly**, including two that are new: week 1 raises ValueError for an unknown kind; matching is exact/case-sensitive where it matters (weeks 1, 6, 11).
> - **grader.py:** strict canonical-JSON comparison (the original's `==` let `1` pass for `True`); a learner's `print()` no longer zeroes the grade; per-case pass/fail and reason in the report; an expected ValueError now fails if the function returns normally.
> - **`verification.json` is from v1** (40 cases). Rerun the instructor references against the 88-case tests before the course uses them; some references will need the two new rules.

# Semester build pack

Generated design and local prototype; no production deployment.

## Start
Open portal.html in a browser. It provides 16 weekly modules, search, starter downloads, local completion tracking, progress export/import, architecture guides, certification steps and API inspection. No server required. Browser-local persistence may vary for file URLs. Progress is personal convenience, not a grade.

## Labs
Python 3 required. Edit labs/week_01/starter.py. Run:
python grader.py --lab 1 --submission labs/week_01/starter.py --report result.json
Repeat for weeks 1-16. Templates intentionally fail until implemented. Visible tests are teaching feedback. Use an isolated runner for untrusted code.

## API
Developer-console OpenAPI 3.1 JSON: 67 proposed operations, 53 paths, 54 schemas. No API service is implemented. Run an approved OpenAPI validator and contract tests before release. Authentication URL is a reserved example placeholder.

## Verification
16 instructor reference implementations were tested through the grader: 40 visible cases passed. References are not included in the learner pack. Python syntax compiled; schema references and operation IDs checked. No browser end-to-end, full OpenAPI semantic validation, TypeScript capstone tests, production runner security or deployment verification performed.

## Files
portal.html, syllabus.md, labs/, grader.py, architecture-guides.md, partner-certification.md, developer-console.openapi.json and verification.json. PDF included in archive.
