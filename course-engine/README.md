# Course Engine

Course Engine is a citation-first course workspace. It preserves original uploads, extracts page/slide/cell/timestamp chunks, routes uncertainty into review, publishes only confirmed calendar data, and renders versioned study assets from stored evidence.

## Run locally

Prerequisites: Docker Desktop with Compose v2.

```bash
cd course-engine
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build -d
docker compose -f infra/docker-compose.yml exec api alembic upgrade head
docker compose -f infra/docker-compose.yml exec api python /scripts/seed_demo_course.py
```

The web app is at <http://localhost:3000>, and interactive API documentation is at <http://localhost:8000/docs>. The seed command prints the demo course URL and credentials.

## Verify

```bash
docker compose -f infra/docker-compose.yml exec api pytest -q
docker compose -f infra/docker-compose.yml exec web npm run typecheck
docker compose -f infra/docker-compose.yml exec api python /scripts/benchmark_document_renderers.py --runs 1
```

For direct backend development:

```bash
cd apps/api
python3.12 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

## Trust contract

- Generated factual sections require stored citation IDs.
- Missing times stay all-day and explicitly `time_unspecified`; 11:59 PM is never assumed.
- Conflicting dates create open conflicts and do not export to ICS until resolved and confirmed.
- Original files and generated assets can be deleted; asset edits increment versions.
- pgvector is reserved for source retrieval. It is not the record of truth.

See [architecture.md](docs/architecture.md), [api.md](docs/api.md), [local-development.md](docs/local-development.md), the [production activation checklist](docs/production-activation.md), [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md), and the repository-level [Course Engine implementation audit](../docs/audit/course-engine/CURRENT_STATE.md).
