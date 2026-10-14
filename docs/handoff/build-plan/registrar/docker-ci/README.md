# Registrar schema tests — Docker + CI add-on (uploaded 14 Oct)

Overlay onto `../schema-hardening/` (it already has `registrar_schema_checks.py` and `test_registrar_schemas.py`, the 22-method suite). Nothing here has been built or run: `docker_built: false`, `github_workflow_executed: false`.

**Run locally (Python 3.12):**
```bash
cd handoff/build-plan/registrar/schema-hardening
cp -R ../docker-ci/. .
python3.12 -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements.lock && python -m pip check
python -m unittest -v test_registrar_schemas.py      # expect 22 tests OK
```
**Docker (no network, read-only):** `docker build -t semester-registrar-schema:test .` then the `docker run --rm --network none --read-only --cap-drop ALL …` line in SETUP.md.

**CI:** `.github/workflows/registrar-schema-tests.yml` assumes the files at the repo root — adjust paths if it lives under `handoff/`. Pin the Actions and base image to reviewed digests before relying on it.

Dependencies: jsonschema 4.23.0 and its four deps only — no network or database needed. Paste the unittest output here and it's recorded as evidence for the registrar contract schemas.
