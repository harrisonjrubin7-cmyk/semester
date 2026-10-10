"""Represent unmeasured extraction confidence explicitly.

Revision ID: 0002_review_first_confidence
Revises: 0001_initial
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_review_first_confidence"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("source_chunks") as batch_op:
        batch_op.alter_column(
            "confidence",
            existing_type=sa.Float(),
            nullable=True,
        )


def downgrade() -> None:
    unknown_count = op.get_bind().execute(
        sa.text("SELECT count(*) FROM source_chunks WHERE confidence IS NULL")
    ).scalar_one()
    if unknown_count:
        raise RuntimeError(
            "Cannot restore NOT NULL confidence while unmeasured chunks exist; "
            "delete or explicitly measure them before downgrade."
        )
    with op.batch_alter_table("source_chunks") as batch_op:
        batch_op.alter_column(
            "confidence",
            existing_type=sa.Float(),
            nullable=False,
        )
