"""initial

Revision ID: fac6385cda6e
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'fac6385cda6e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # organizations
    op.create_table(
        'organizations',
        sa.Column('id',         UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name',       sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # users
    op.create_table(
        'users',
        sa.Column('id',              UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id',          UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email',           sa.String(255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role',            sa.String(50),  nullable=False, server_default='analyst'),
        sa.Column('is_active',       sa.Boolean(),   nullable=False, server_default=sa.text('true')),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_org_id', 'users', ['org_id'])

    # companies
    op.create_table(
        'companies',
        sa.Column('id',       UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id',   UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name',     sa.String(255), nullable=False),
        sa.Column('tax_id',   sa.String(50),  nullable=True),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('country',  sa.String(10),  nullable=False, server_default='BA'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_companies_org_id', 'companies', ['org_id'])

    # financial_reports
    op.create_table(
        'financial_reports',
        sa.Column('id',           UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id',   UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('uploaded_by',  UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('fiscal_year',  sa.Integer(), nullable=False),
        sa.Column('report_type',  sa.String(50), nullable=False, server_default='balance_sheet'),
        sa.Column('source_file',  sa.String(500), nullable=True),
        sa.Column('status',       sa.String(50), nullable=False, server_default='pending'),
        sa.Column('raw_data',     JSONB, nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('uploaded_at',  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_financial_reports_company_id', 'financial_reports', ['company_id'])

    # kpi_snapshots
    op.create_table(
        'kpi_snapshots',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id',  UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=False),
        # Liquidity
        sa.Column('current_ratio',  sa.Numeric(10, 4), nullable=True),
        sa.Column('quick_ratio',    sa.Numeric(10, 4), nullable=True),
        sa.Column('cash_ratio',     sa.Numeric(10, 4), nullable=True),
        # Profitability
        sa.Column('gross_margin',   sa.Numeric(10, 4), nullable=True),
        sa.Column('ebitda_margin',  sa.Numeric(10, 4), nullable=True),
        sa.Column('ebit_margin',    sa.Numeric(10, 4), nullable=True),
        sa.Column('net_margin',     sa.Numeric(10, 4), nullable=True),
        sa.Column('roe',            sa.Numeric(10, 4), nullable=True),
        sa.Column('roa',            sa.Numeric(10, 4), nullable=True),
        # Leverage
        sa.Column('debt_to_equity',    sa.Numeric(10, 4), nullable=True),
        sa.Column('interest_coverage', sa.Numeric(10, 4), nullable=True),
        sa.Column('debt_ratio',        sa.Numeric(10, 4), nullable=True),
        sa.Column('equity_ratio',      sa.Numeric(10, 4), nullable=True),
        # Growth
        sa.Column('revenue_growth',    sa.Numeric(10, 4), nullable=True),
        sa.Column('ebitda_growth',     sa.Numeric(10, 4), nullable=True),
        sa.Column('net_income_growth', sa.Numeric(10, 4), nullable=True),
        sa.Column('asset_growth',      sa.Numeric(10, 4), nullable=True),
        # Cash flow
        sa.Column('free_cash_flow',             sa.Numeric(20, 2), nullable=True),
        sa.Column('ocf_margin',                 sa.Numeric(10, 4), nullable=True),
        sa.Column('cash_to_debt',               sa.Numeric(10, 4), nullable=True),
        sa.Column('ocf_to_current_liabilities', sa.Numeric(10, 4), nullable=True),
        # Efficiency
        sa.Column('asset_turnover',             sa.Numeric(10, 4), nullable=True),
        sa.Column('receivables_turnover',       sa.Numeric(10, 4), nullable=True),
        sa.Column('days_sales_outstanding',     sa.Numeric(10, 2), nullable=True),
        sa.Column('inventory_turnover',         sa.Numeric(10, 4), nullable=True),
        sa.Column('days_inventory_outstanding', sa.Numeric(10, 2), nullable=True),
        sa.Column('raw_financials', JSONB, nullable=True),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_kpi_snapshots_company_id', 'kpi_snapshots', ['company_id'])
    op.create_unique_constraint('uq_kpi_company_year', 'kpi_snapshots', ['company_id', 'fiscal_year'])

    # company_scores
    op.create_table(
        'company_scores',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id',  UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=False),
        sa.Column('total_score', sa.Numeric(6, 2), nullable=False),
        sa.Column('risk_level',  sa.String(20), nullable=False),
        sa.Column('liquidity_score',     sa.Numeric(6, 2), nullable=True),
        sa.Column('profitability_score', sa.Numeric(6, 2), nullable=True),
        sa.Column('leverage_score',      sa.Numeric(6, 2), nullable=True),
        sa.Column('growth_score',        sa.Numeric(6, 2), nullable=True),
        sa.Column('cashflow_score',      sa.Numeric(6, 2), nullable=True),
        sa.Column('altman_data', JSONB, nullable=True),
        sa.Column('breakdown',   JSONB, nullable=True),
        sa.Column('score_version', sa.String(20), nullable=False, server_default='1.0'),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_company_scores_company_id', 'company_scores', ['company_id'])
    op.create_unique_constraint('uq_score_company_year', 'company_scores', ['company_id', 'fiscal_year'])

    # ai_reports
    op.create_table(
        'ai_reports',
        sa.Column('id',          UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id',  UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=False),
        sa.Column('status',      sa.String(20), nullable=False, server_default='pending'),
        sa.Column('summary',           sa.Text(), nullable=True),
        sa.Column('score_explanation', sa.Text(), nullable=True),
        sa.Column('risk_assessment',   sa.Text(), nullable=True),
        sa.Column('outlook',           sa.Text(), nullable=True),
        sa.Column('strengths',        JSONB, nullable=True),
        sa.Column('weaknesses',       JSONB, nullable=True),
        sa.Column('key_risks',        JSONB, nullable=True),
        sa.Column('recommendations',  JSONB, nullable=True),
        sa.Column('red_flags',        JSONB, nullable=True),
        sa.Column('model_used',   sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_ai_reports_company_id', 'ai_reports', ['company_id'])
    op.create_unique_constraint('uq_ai_report_company_year', 'ai_reports', ['company_id', 'fiscal_year'])


def downgrade() -> None:
    op.drop_table('ai_reports')
    op.drop_table('company_scores')
    op.drop_table('kpi_snapshots')
    op.drop_table('financial_reports')
    op.drop_table('companies')
    op.drop_table('users')
    op.drop_table('organizations')
