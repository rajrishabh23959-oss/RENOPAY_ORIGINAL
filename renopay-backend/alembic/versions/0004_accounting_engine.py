"""accounting_engine

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
import datetime

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Accounts
    op.add_column('accounts', sa.Column('dev_mode_enabled', sa.Boolean(), server_default='false', nullable=False))

    # 2. Enums
    account_type_enum = sa.Enum('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', name='account_type')
    account_type_enum.create(op.get_bind())
    
    journal_source_enum = sa.Enum('AUTO_TXN', 'MANUAL', 'ADJUSTMENT', name='journal_source')
    journal_source_enum.create(op.get_bind())

    # 3. Tables
    op.create_table('chart_of_accounts',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('account_type', sa.Enum('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', name='account_type'), nullable=False),
        sa.Column('parent_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('account_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['chart_of_accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chart_of_accounts_account_id'), 'chart_of_accounts', ['account_id'], unique=False)
    op.create_index(op.f('ix_chart_of_accounts_code'), 'chart_of_accounts', ['code'], unique=True)
    
    op.create_table('journal_entries',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('entry_no', sa.String(length=40), nullable=False),
        sa.Column('account_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('txn_group_id', sa.UUID(as_uuid=True), nullable=True),
        sa.Column('narration', sa.String(length=255), nullable=False),
        sa.Column('source', sa.Enum('AUTO_TXN', 'MANUAL', 'ADJUSTMENT', name='journal_source'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_journal_entries_account_id'), 'journal_entries', ['account_id'], unique=False)
    op.create_index(op.f('ix_journal_entries_entry_no'), 'journal_entries', ['entry_no'], unique=False)
    op.create_index(op.f('ix_journal_entries_txn_group_id'), 'journal_entries', ['txn_group_id'], unique=False)
    
    op.create_table('journal_lines',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('journal_entry_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('chart_account_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('debit_paise', sa.BigInteger(), nullable=False),
        sa.Column('credit_paise', sa.BigInteger(), nullable=False),
        sa.Column('payee_vpa', sa.String(length=80), nullable=True),
        sa.Column('payee_name', sa.String(length=120), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('(debit_paise > 0 AND credit_paise = 0) OR (credit_paise > 0 AND debit_paise = 0) OR (debit_paise = 0 AND credit_paise = 0)', name='ck_journal_line_debit_credit'),
        sa.ForeignKeyConstraint(['chart_account_id'], ['chart_of_accounts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_journal_lines_chart_account_id'), 'journal_lines', ['chart_account_id'], unique=False)
    op.create_index(op.f('ix_journal_lines_journal_entry_id'), 'journal_lines', ['journal_entry_id'], unique=False)
    
    op.create_table('ledger_audit_logs',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('journal_entry_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('actor', sa.String(length=50), nullable=False),
        sa.Column('diff', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ledger_audit_logs_journal_entry_id'), 'ledger_audit_logs', ['journal_entry_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ledger_audit_logs_journal_entry_id'), table_name='ledger_audit_logs')
    op.drop_table('ledger_audit_logs')
    
    op.drop_index(op.f('ix_journal_lines_journal_entry_id'), table_name='journal_lines')
    op.drop_index(op.f('ix_journal_lines_chart_account_id'), table_name='journal_lines')
    op.drop_table('journal_lines')
    
    op.drop_index(op.f('ix_journal_entries_txn_group_id'), table_name='journal_entries')
    op.drop_index(op.f('ix_journal_entries_entry_no'), table_name='journal_entries')
    op.drop_index(op.f('ix_journal_entries_account_id'), table_name='journal_entries')
    op.drop_table('journal_entries')
    
    op.drop_index(op.f('ix_chart_of_accounts_code'), table_name='chart_of_accounts')
    op.drop_index(op.f('ix_chart_of_accounts_account_id'), table_name='chart_of_accounts')
    op.drop_table('chart_of_accounts')
    
    op.drop_column('accounts', 'dev_mode_enabled')
    
    sa.Enum('AUTO_TXN', 'MANUAL', 'ADJUSTMENT', name='journal_source').drop(op.get_bind())
    sa.Enum('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', name='account_type').drop(op.get_bind())
