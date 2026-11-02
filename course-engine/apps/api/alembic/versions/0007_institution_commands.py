"""Add the governed institutional command and transactional outbox backbone."""

from alembic import op

from app.models.entities import (
    CommandReceipt,
    Institution,
    OutboxEvent,
    TenantCapability,
    WorkspaceGrant,
)

revision = "0007_institution_commands"
down_revision = "0006_study_session_results"
branch_labels = None
depends_on = None

TABLES = [
    Institution.__table__,
    WorkspaceGrant.__table__,
    TenantCapability.__table__,
    CommandReceipt.__table__,
    OutboxEvent.__table__,
]


def upgrade() -> None:
    bind = op.get_bind()
    for table in TABLES:
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(TABLES):
        table.drop(bind=bind, checkfirst=True)
