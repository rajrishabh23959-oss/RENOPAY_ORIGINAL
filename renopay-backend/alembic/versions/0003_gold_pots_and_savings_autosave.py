"""add gold_pots, gold_ledger tables and savings autosave columns

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002_account_budget"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- user_gold_pots -------------------------------------------------------
    op.create_table(
        "user_gold_pots",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("balance_paise", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_accumulated_paise", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_gold_pots_user_id", "user_gold_pots", ["user_id"])

    # -- gold_ledger ----------------------------------------------------------
    op.create_table(
        "gold_ledger",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("pot_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_paise", sa.BigInteger(), nullable=False),
        sa.Column("grams_equivalent", sa.Numeric(10, 4), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="round_up"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["pot_id"], ["user_gold_pots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gold_ledger_pot_id", "gold_ledger", ["pot_id"])
    op.create_index("ix_gold_ledger_user_id", "gold_ledger", ["user_id"])

    # -- savings_goals: add autosave + milestone tracking columns ------------
    op.add_column("savings_goals", sa.Column("auto_save_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("savings_goals", sa.Column("auto_save_paise", sa.BigInteger(), nullable=False, server_default="0"))
    op.add_column("savings_goals", sa.Column("last_celebrated_pct", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("savings_goals", "last_celebrated_pct")
    op.drop_column("savings_goals", "auto_save_paise")
    op.drop_column("savings_goals", "auto_save_enabled")
    op.drop_index("ix_gold_ledger_user_id", table_name="gold_ledger")
    op.drop_index("ix_gold_ledger_pot_id", table_name="gold_ledger")
    op.drop_table("gold_ledger")
    op.drop_index("ix_user_gold_pots_user_id", table_name="user_gold_pots")
    op.drop_table("user_gold_pots")
