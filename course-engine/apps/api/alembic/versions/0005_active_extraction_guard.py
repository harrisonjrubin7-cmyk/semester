"""Enforce one active extraction per source document.

Revision ID: 0005_active_extraction_guard
Revises: 0004_background_job_leases
"""

from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision = "0005_active_extraction_guard"
down_revision = "0004_background_job_leases"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_background_jobs_active_extract_document"
ACTIVE_PREDICATE = (
    "document_id IS NOT NULL AND job_type = 'extract' "
    "AND status IN ('queued', 'running') AND revoked_at IS NULL"
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if INDEX_NAME in {index["name"] for index in inspector.get_indexes("background_jobs")}:
        return

    jobs = sa.Table(
        "background_jobs",
        sa.MetaData(),
        autoload_with=bind,
    )
    active = bind.execute(
        sa.select(jobs.c.id, jobs.c.document_id)
        .where(
            jobs.c.document_id.is_not(None),
            jobs.c.job_type == "extract",
            jobs.c.status.in_(("queued", "running")),
            jobs.c.revoked_at.is_(None),
        )
        .order_by(jobs.c.document_id, jobs.c.created_at.desc(), jobs.c.id.desc())
    ).all()
    seen_documents = set()
    superseded_ids = []
    for row in active:
        if row.document_id in seen_documents:
            superseded_ids.append(row.id)
        else:
            seen_documents.add(row.document_id)
    if superseded_ids:
        bind.execute(
            sa.update(jobs)
            .where(jobs.c.id.in_(superseded_ids))
            .values(
                status="failed",
                error="Superseded while enforcing one active extraction per document",
                revoked_at=datetime.now(UTC),
            )
        )

    dialect_options = {
        "postgresql_where": sa.text(ACTIVE_PREDICATE),
        "sqlite_where": sa.text(ACTIVE_PREDICATE),
    }
    op.create_index(
        INDEX_NAME,
        "background_jobs",
        ["document_id"],
        unique=True,
        **dialect_options,
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="background_jobs")
