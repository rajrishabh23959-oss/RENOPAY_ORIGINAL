"""make pin_hash nullable

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column('users', 'pin_hash',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'pin_hash',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
