"""initial schema — users, accounts, ledger, and all feature module tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ---------- users & devices ----------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone_number", sa.String(15), nullable=False),
        sa.Column("email", sa.String(120)),
        sa.Column("pin_hash", sa.String(255), nullable=False),
        sa.Column("pin_failed_attempts", sa.Integer, server_default="0"),
        sa.Column("pin_locked_until", sa.DateTime(timezone=True)),
        sa.Column("kyc_status", sa.Enum("pending", "verified", "rejected", name="kyc_status"), nullable=False,
                  server_default="pending"),
        sa.Column("aadhaar_ref_encrypted", sa.String(512)),
        sa.Column("pan_number", sa.String(10)),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_lat", sa.Float),
        sa.Column("last_lng", sa.Float),
        sa.Column("last_city", sa.String(80)),
        sa.Column("last_location_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("phone_number", name="uq_users_phone"),
    )
    op.create_index("ix_users_phone_number", "users", ["phone_number"])

    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("device_fingerprint", sa.String(255), nullable=False),
        sa.Column("device_label", sa.String(120)),
        sa.Column("trusted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])
    op.create_index("ix_devices_fingerprint", "devices", ["device_fingerprint"])

    # ---------- accounts ----------
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("virtual_acc_no", sa.String(20), nullable=False, unique=True),
        sa.Column("ifsc_code", sa.String(11), server_default="RAZR0000001"),
        sa.Column("vpa", sa.String(80), nullable=False, unique=True),
        sa.Column("linked_bank_name", sa.String(120), server_default="RenoPay Virtual Bank"),
        sa.Column("current_balance_paise", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("upi_lite_balance_paise", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("digital_gold_paise", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("round_up_enabled", sa.Boolean, server_default="false"),
        sa.CheckConstraint("current_balance_paise >= 0", name="ck_balance_non_negative"),
        sa.CheckConstraint("upi_lite_balance_paise >= 0", name="ck_lite_balance_non_negative"),
        sa.CheckConstraint("digital_gold_paise >= 0", name="ck_gold_non_negative"),
    )
    op.create_index("ix_accounts_vpa", "accounts", ["vpa"])
    op.create_index("ix_accounts_virtual_acc_no", "accounts", ["virtual_acc_no"])

    # ---------- transactions (ledger) & fraud events ----------
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("txn_group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("txn_ref", sa.String(40), nullable=False, unique=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("counterparty_vpa", sa.String(80), nullable=False),
        sa.Column("counterparty_name", sa.String(120)),
        sa.Column("type", sa.Enum("debit", "credit", name="txn_type"), nullable=False),
        sa.Column("status", sa.Enum("success", "failed", "pending", name="txn_status"),
                  server_default="success"),
        sa.Column("category", sa.Enum(
            "Food", "Shopping", "Transport", "Entertainment", "Bills", "Health",
            "Education", "Income", "Other", name="txn_category"), server_default="Other"),
        sa.Column("amount_paise", sa.BigInteger, nullable=False),
        sa.Column("round_up_paise", sa.BigInteger, server_default="0"),
        sa.Column("description", sa.String(255)),
        sa.Column("trust_score", sa.Integer, server_default="95"),
        sa.Column("is_upi_lite", sa.Boolean, server_default="false"),
        sa.Column("lat", sa.Float),
        sa.Column("lng", sa.Float),
        sa.Column("city", sa.String(80)),
    )
    op.create_index("ix_transactions_txn_group_id", "transactions", ["txn_group_id"])
    op.create_index("ix_transactions_txn_ref", "transactions", ["txn_ref"])
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"])
    # Critical composite index: this is the query pattern for "get my transaction history"
    op.create_index("ix_transactions_account_created", "transactions", ["account_id", "created_at"])

    op.create_table(
        "fraud_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("txn_group_id", postgresql.UUID(as_uuid=True)),
        sa.Column("risk_level", sa.String(10)),
        sa.Column("risk_flags", sa.String(500)),
        sa.Column("explanations", sa.String(1000)),
        sa.Column("trust_score", sa.Integer),
        sa.Column("blocked", sa.Boolean, server_default="false"),
        sa.Column("amount_paise", sa.BigInteger),
    )
    op.create_index("ix_fraud_events_user_id", "fraud_events", ["user_id"])

    # ---------- money requests ----------
    op.create_table(
        "money_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("from_vpa", sa.String(80), nullable=False),
        sa.Column("to_vpa", sa.String(80), nullable=False),
        sa.Column("amount_paise", sa.BigInteger, nullable=False),
        sa.Column("note", sa.String(255)),
        sa.Column("status", sa.Enum("pending", "paid", "declined", name="request_status"),
                  server_default="pending"),
        sa.Column("split_group_id", postgresql.UUID(as_uuid=True)),
    )
    op.create_index("ix_money_requests_from_vpa", "money_requests", ["from_vpa"])
    op.create_index("ix_money_requests_to_vpa", "money_requests", ["to_vpa"])
    op.create_index("ix_money_requests_split_group_id", "money_requests", ["split_group_id"])

    # ---------- mandates ----------
    op.create_table(
        "mandates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("icon", sa.String(10), server_default="📦"),
        sa.Column("merchant_vpa", sa.String(80), nullable=False),
        sa.Column("amount_paise", sa.BigInteger, nullable=False),
        sa.Column("max_limit_paise", sa.BigInteger, nullable=False),
        sa.Column("frequency", sa.Enum("monthly", "quarterly", "yearly", name="mandate_frequency"),
                  nullable=False),
        sa.Column("status", sa.Enum("active", "paused", "cancelled", name="mandate_status"),
                  server_default="active"),
        sa.Column("next_payment_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("category", sa.String(40), server_default="Bills"),
    )
    op.create_index("ix_mandates_user_id", "mandates", ["user_id"])
    # This index is what makes the scheduler's "find due mandates" query fast
    op.create_index("ix_mandates_status_next_payment", "mandates", ["status", "next_payment_at"])

    # ---------- scratch cards ----------
    op.create_table(
        "scratch_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("scratched", sa.Boolean, server_default="false"),
        sa.Column("reward_type", sa.Enum("cashback", "gold", name="reward_type"), nullable=False),
        sa.Column("reward_amount_paise", sa.BigInteger, nullable=False),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("source_txn_group_id", postgresql.UUID(as_uuid=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_scratch_cards_user_id", "scratch_cards", ["user_id"])

    # ---------- savings goals & shared vaults ----------
    op.create_table(
        "savings_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("icon", sa.String(10), server_default="🎯"),
        sa.Column("target_paise", sa.BigInteger, nullable=False),
        sa.Column("saved_paise", sa.BigInteger, server_default="0"),
        sa.Column("milestones_paise", postgresql.ARRAY(sa.BigInteger), server_default="{}"),
    )
    op.create_index("ix_savings_goals_user_id", "savings_goals", ["user_id"])

    op.create_table(
        "shared_vaults",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("icon", sa.String(10), server_default="🏖️"),
        sa.Column("target_paise", sa.BigInteger, nullable=False),
        sa.Column("balance_paise", sa.BigInteger, server_default="0"),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
    )

    op.create_table(
        "shared_vault_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("vault_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shared_vaults.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
    )
    op.create_index("ix_vault_members_vault_id", "shared_vault_members", ["vault_id"])
    op.create_index("ix_vault_members_user_id", "shared_vault_members", ["user_id"])
    op.create_unique_constraint("uq_vault_member", "shared_vault_members", ["vault_id", "user_id"])

    op.create_table(
        "shared_vault_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("vault_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shared_vaults.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount_paise", sa.BigInteger, nullable=False),
        sa.Column("log_type", sa.String(20), server_default="contribution"),
    )
    op.create_index("ix_vault_logs_vault_id", "shared_vault_logs", ["vault_id"])

    # ---------- auth: refresh tokens & OTP ----------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("device_fingerprint", sa.String(255)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, server_default="false"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])

    op.create_table(
        "otp_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("phone_number", sa.String(15), nullable=False),
        sa.Column("otp_hash", sa.String(255), nullable=False),
        sa.Column("purpose", sa.String(30), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean, server_default="false"),
    )
    op.create_index("ix_otp_challenges_phone_number", "otp_challenges", ["phone_number"])


def downgrade() -> None:
    op.drop_table("otp_challenges")
    op.drop_table("refresh_tokens")
    op.drop_table("shared_vault_logs")
    op.drop_table("shared_vault_members")
    op.drop_table("shared_vaults")
    op.drop_table("savings_goals")
    op.drop_table("scratch_cards")
    op.drop_table("mandates")
    op.drop_table("money_requests")
    op.drop_table("fraud_events")
    op.drop_table("transactions")
    op.drop_table("accounts")
    op.drop_table("devices")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS reward_type")
    op.execute("DROP TYPE IF EXISTS mandate_status")
    op.execute("DROP TYPE IF EXISTS mandate_frequency")
    op.execute("DROP TYPE IF EXISTS request_status")
    op.execute("DROP TYPE IF EXISTS txn_category")
    op.execute("DROP TYPE IF EXISTS txn_status")
    op.execute("DROP TYPE IF EXISTS txn_type")
    op.execute("DROP TYPE IF EXISTS kyc_status")
