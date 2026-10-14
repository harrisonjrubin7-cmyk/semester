# Registrar schema suite setup additions
Overlay these files at the root of the prior schema-hardening package, alongside registrar_schema_checks.py and test_registrar_schemas.py. Those two files are prerequisites, not included in this add-on. No GitHub or production changes have been made.

macOS/Linux:
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.lock
python -m pip check
python -m unittest -v test_registrar_schemas.py

Windows PowerShell:
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python -m pip check
python -m unittest -v test_registrar_schemas.py

Docker:
docker build -t semester-registrar-schema:test .
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=64m semester-registrar-schema:test

CI assumes package files at repository root. Adapt paths and cache path together if integrating into a subdirectory; do not copy over Semester root requirements blindly. Workflow is generated, not run on GitHub. Docker image is not built here. Actions tags and image tag are mutable: replace with reviewed commit/image digests before stricter release use. requirements.lock pins versions present in the authoring environment, not artifact hashes; resolver compatibility and target installation must still be verified. No streamlit, requests, OpenAPI validator or PostgreSQL driver needed for this suite.

Expected suite: 22 methods with four valid-operation subcases. Exit zero means local test success, not registrar readiness or full OAS compliance. Test logs remain in GitHub job output; no upload artifact step included. No secrets, external endpoint access, DB migration or deploy job.
