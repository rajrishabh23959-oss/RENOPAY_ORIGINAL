"""add monthly_budget_paise to accounts

Revision ID: 0002_account_budget
Revises: 0001_initial
Create Date: 2026-07-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0002_account_budget"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("monthly_budget_paise", sa.BigInteger, nullable=False, server_default="1500000"),
    )
    op.create_check_constraint("ck_budget_positive", "accounts", "monthly_budget_paise > 0")


def downgrade() -> None:
    op.drop_constraint("ck_budget_positive", "accounts", type_="check")
    op.drop_column("accounts", "monthly_budget_paise")
