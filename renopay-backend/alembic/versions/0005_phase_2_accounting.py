"""phase 2 accounting

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('chart_of_accounts', sa.Column('hsn_sac_code', sa.String(length=20), nullable=True))

def downgrade() -> None:
    op.drop_column('chart_of_accounts', 'hsn_sac_code')
