"""Add durable upload completion receipts.

Revision ID: 0003_upload_completion
Revises: 0002_review_first_confidence
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_upload_completion"
down_revision = "0002_review_first_confidence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The legacy 0001 migration builds from live metadata, so a brand-new
    # database may already contain this table. Existing databases at 0002 do not.
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("upload_completions"):
        expected_columns = {
            "id", "document_id", "course_id", "job_id", "payload_fingerprint",
            "verified_metadata", "dispatch_status", "dispatch_claimed_at",
            "dispatched_at", "created_at", "updated_at",
        }
        actual_columns = {
            column["name"] for column in inspector.get_columns("upload_completions")
        }
        actual_uniques = {
            tuple(constraint["column_names"])
            for constraint in inspector.get_unique_constraints("upload_completions")
        }
        if actual_columns != expected_columns or not {
            ("document_id",), ("job_id",)
        }.issubset(actual_uniques):
            raise RuntimeError("Existing upload_completions table has an incompatible schema")
        return
    op.create_table(
        "upload_completions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("payload_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("verified_metadata", sa.JSON(), nullable=False),
        sa.Column("dispatch_status", sa.String(length=24), nullable=False),
        sa.Column("dispatch_claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["source_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["background_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id"),
        sa.UniqueConstraint("job_id"),
    )
    op.create_index(
        op.f("ix_upload_completions_course_id"),
        "upload_completions",
        ["course_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_upload_completions_course_id"), table_name="upload_completions")
    op.drop_table("upload_completions")
