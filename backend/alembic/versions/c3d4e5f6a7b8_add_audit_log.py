"""add audit_log table

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-05-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'c3d4e5f6a7b8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'audit_logs',
        sa.Column('id',            UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id',        UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',       UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action',        sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50),  nullable=True),
        sa.Column('resource_id',   sa.Text(),       nullable=True),
        sa.Column('details',       JSONB,           nullable=True),
        sa.Column('ip_address',    sa.String(45),  nullable=True),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_audit_logs_org_id',       'audit_logs', ['org_id'])
    op.create_index('ix_audit_logs_action',        'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    op.create_index('ix_audit_logs_created_at',    'audit_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('audit_logs')
