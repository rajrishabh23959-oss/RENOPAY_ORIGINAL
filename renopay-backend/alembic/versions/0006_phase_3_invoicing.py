"""phase 3 invoicing

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create the invoice_status enum
    sa.Enum('PENDING', 'PAID', 'CANCELLED', name='invoice_status').create(op.get_bind())
    
    op.create_table(
        'invoices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('invoice_no', sa.String(length=40), nullable=False),
        sa.Column('customer_name', sa.String(length=120), nullable=False),
        sa.Column('amount_paise', sa.BigInteger(), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'PAID', 'CANCELLED', name='invoice_status', create_type=False), nullable=False),
        sa.Column('creation_journal_id', sa.UUID(), nullable=True),
        sa.Column('payment_journal_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['creation_journal_id'], ['journal_entries.id'], ),
        sa.ForeignKeyConstraint(['payment_journal_id'], ['journal_entries.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoices_account_id'), 'invoices', ['account_id'], unique=False)
    op.create_index(op.f('ix_invoices_invoice_no'), 'invoices', ['invoice_no'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_invoices_invoice_no'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_account_id'), table_name='invoices')
    op.drop_table('invoices')
    sa.Enum(name='invoice_status').drop(op.get_bind())
