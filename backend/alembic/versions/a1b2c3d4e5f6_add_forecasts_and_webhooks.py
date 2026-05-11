"""add forecasts and webhooks tables

Revision ID: a1b2c3d4e5f6
Revises: fac6385cda6e
Create Date: 2025-05-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'a1b2c3d4e5f6'
down_revision = 'fac6385cda6e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── forecasts ──────────────────────────────────────────────────────────────
    op.create_table(
        'forecasts',
        sa.Column('id',           UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id',   UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('base_year',    sa.Integer(), nullable=False),
        sa.Column('horizon',      sa.Integer(), nullable=False, server_default='3'),
        sa.Column('method',       sa.String(50), nullable=False, server_default='linear_regression'),
        sa.Column('data_points',  sa.Integer(), nullable=False, server_default='0'),
        sa.Column('predictions',  JSONB, nullable=True),
        sa.Column('historical_summary', JSONB, nullable=True),
        sa.Column('revenue_r_squared', sa.Numeric(6, 4), nullable=True),
        sa.Column('revenue_cagr',      sa.Numeric(8, 4), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_forecasts_company_id', 'forecasts', ['company_id'])

    # ── webhooks ───────────────────────────────────────────────────────────────
    op.create_table(
        'webhooks',
        sa.Column('id',         UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id',     UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url',        sa.String(2048), nullable=False),
        sa.Column('secret',     sa.String(255), nullable=False),
        sa.Column('events',     JSONB, nullable=False, server_default='[]'),
        sa.Column('is_active',  sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('last_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failure_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_webhooks_org_id', 'webhooks', ['org_id'])


def downgrade() -> None:
    op.drop_table('webhooks')
    op.drop_table('forecasts')
