"""Persist self-graded study-session results.

Revision ID: 0006_study_session_results
Revises: 0005_active_extraction_guard
"""

import sqlalchemy as sa
from alembic import op


revision = "0006_study_session_results"
down_revision = "0005_active_extraction_guard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("study_sessions")}
    if "result" in columns:
        return
    op.add_column(
        "study_sessions",
        sa.Column("result", sa.JSON(), server_default=sa.text("'{}'"), nullable=False),
    )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("study_sessions")}
    if "result" in columns:
        op.drop_column("study_sessions", "result")
