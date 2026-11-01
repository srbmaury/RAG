"""Persist source permission-check outcomes without storing source content.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    if 'source_health_checks' in inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'source_health_checks',
        sa.Column(
            'workspace_id',
            sa.String(),
            sa.ForeignKey('workspaces.id', ondelete='CASCADE'),
            primary_key=True,
        ),
        sa.Column('provider', sa.String(), primary_key=True),
        sa.Column('checked_at', sa.Float(), nullable=False),
        sa.Column('healthy', sa.Boolean(), nullable=False),
        sa.Column('matches', sa.Integer(), nullable=True),
        sa.Column('error', sa.String(length=500), nullable=True),
    )


def downgrade():
    if 'source_health_checks' in inspect(op.get_bind()).get_table_names():
        op.drop_table('source_health_checks')
