"""Add fenced background-job leases.

Revision ID: 0004_background_job_leases
Revises: 0003_upload_completion
"""

import sqlalchemy as sa
from alembic import op


revision = "0004_background_job_leases"
down_revision = "0003_upload_completion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("background_jobs", sa.Column("target_id", sa.Uuid(), nullable=True))
    op.add_column("background_jobs", sa.Column("lease_owner", sa.String(255), nullable=True))
    op.add_column(
        "background_jobs",
        sa.Column("lease_generation", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("background_jobs", sa.Column("lease_expires_at", sa.DateTime(timezone=True)))
    op.add_column("background_jobs", sa.Column("heartbeat_at", sa.DateTime(timezone=True)))
    op.add_column(
        "background_jobs",
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("background_jobs", sa.Column("revoked_at", sa.DateTime(timezone=True)))
    op.create_index(op.f("ix_background_jobs_target_id"), "background_jobs", ["target_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_background_jobs_target_id"), table_name="background_jobs")
    for column in (
        "revoked_at",
        "attempt_count",
        "heartbeat_at",
        "lease_expires_at",
        "lease_generation",
        "lease_owner",
        "target_id",
    ):
        op.drop_column("background_jobs", column)
