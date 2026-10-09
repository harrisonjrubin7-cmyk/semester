# Course Engine CI

`.github/workflows/course-engine.yml` is the blocking source gate for changes under
`course-engine/`. It runs without production credentials or provider access.

The API matrix installs `course-engine/apps/api` with its `dev` extra, runs Ruff over the
API, tests, and worker, then runs the complete Pytest suite against both SQLite and a
PostgreSQL 17 service. `tests/test_migrations.py` performs real Alembic upgrade and downgrade
cycles. It verifies that measured confidence and linked citations survive, unknown confidence
blocks the lossy downgrade, and SQLite foreign-key enforcement is restored after its required
batch-table rebuild.

The web job installs the committed pnpm lockfile, then runs tests, TypeScript checking, and the
production build:

```bash
cd course-engine/apps/web
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run build
```

The equivalent API commands are:

```bash
cd course-engine/apps/api
python3 -m venv /tmp/course-engine-venv
/tmp/course-engine-venv/bin/python -m pip install -e '.[dev]'
/tmp/course-engine-venv/bin/ruff check app tests ../worker/tasks.py
MIGRATION_TEST_DATABASE_URL=sqlite:////tmp/course-engine-migrations.db \
  /tmp/course-engine-venv/bin/pytest -q
```

A green source gate does not apply the migration, enable providers, or authorize deployment.
Production migration rehearsal, atomic worker leases, native tenant RLS, and capability
approval remain separate release requirements.
