# Semester build pack

Generated design and local prototype; no production deployment.

## Start
Open portal.html in a browser. It provides 16 weekly modules, search, starter downloads, local completion tracking, progress export/import, architecture guides, certification steps and API inspection. No server required. Browser-local persistence may vary for file URLs. Progress is personal convenience, not a grade.

## Labs
Python 3 required. Edit labs/week_01/starter.py. Run:
python grader.py --lab 1 --submission labs/week_01/starter.py --report result.json
Repeat for weeks 1-16. Templates intentionally fail until implemented. Visible tests are teaching feedback. Use an isolated runner for untrusted code.

## API
Developer-console OpenAPI 3.1 JSON: 68 proposed operations, 53 paths, 54 schemas. No API service is implemented. Run an approved OpenAPI validator and contract tests before release. Authentication URL is a reserved example placeholder.

## Verification
16 instructor reference implementations were tested through the grader: 40 visible cases passed. References are not included in the learner pack. Python syntax compiled; schema references and operation IDs checked. No browser end-to-end, full OpenAPI semantic validation, TypeScript capstone tests, production runner security or deployment verification performed.

## Files
portal.html, syllabus.md, labs/, grader.py, architecture-guides.md, partner-certification.md, developer-console.openapi.json and verification.json. PDF included in archive.
