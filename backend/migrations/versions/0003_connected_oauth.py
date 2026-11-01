"""OAuth state for read-only connected providers.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    if 'connected_oauth_states' in inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'connected_oauth_states',
        sa.Column('value', sa.String(), primary_key=True),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column(
            'user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column(
            'workspace_id',
            sa.String(),
            sa.ForeignKey('workspaces.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('verifier', sa.String(), nullable=False),
        sa.Column('expires', sa.Float(), nullable=False),
    )


def downgrade():
    if 'connected_oauth_states' in inspect(op.get_bind()).get_table_names():
        op.drop_table('connected_oauth_states')
