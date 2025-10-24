"""create base tables

Revision ID: 92d5ea581eda
Revises: 
Create Date: 2025-10-25 04:16:30.119736

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '92d5ea581eda'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role_enum = sa.Enum('admin', 'user', name='userrole')
    user_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', user_role_enum, nullable=False, server_default=sa.text("'user'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('type', sa.String(length=64), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_metrics_type', 'metrics', ['type'], unique=False)
    op.create_index('ix_metrics_ts', 'metrics', ['ts'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_metrics_ts', table_name='metrics')
    op.drop_index('ix_metrics_type', table_name='metrics')
    op.drop_table('metrics')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')

    user_role_enum = sa.Enum('admin', 'user', name='userrole')
    user_role_enum.drop(op.get_bind(), checkfirst=True)
