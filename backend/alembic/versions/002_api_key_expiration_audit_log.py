"""Add API key expiration/rotation and audit log table

Revision ID: 002
Revises: 001
Create Date: 2026-03-13 17:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add expires_at and rotated_from to api_keys
    op.add_column('api_keys', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('api_keys', sa.Column('rotated_from', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_api_keys_rotated_from',
        'api_keys', 'api_keys',
        ['rotated_from'], ['id'],
    )

    # Migrate existing keys: "ingest" -> "ingest:write" for backward compatibility
    op.execute("""
        UPDATE api_keys
        SET scopes = '["ingest:write"]'::jsonb
        WHERE scopes = '["ingest"]'::jsonb
    """)

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actor_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('actor_type', sa.String(20), nullable=False, server_default='user'),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', UUID(as_uuid=True), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    op.create_index('idx_audit_org_time', 'audit_logs', ['org_id', sa.text('created_at DESC')])
    op.create_index('idx_audit_actor', 'audit_logs', ['actor_id', sa.text('created_at DESC')])


def downgrade() -> None:
    op.drop_index('idx_audit_actor', table_name='audit_logs')
    op.drop_index('idx_audit_org_time', table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_constraint('fk_api_keys_rotated_from', 'api_keys', type_='foreignkey')
    op.drop_column('api_keys', 'rotated_from')
    op.drop_column('api_keys', 'expires_at')

    # Revert scope migration
    op.execute("""
        UPDATE api_keys
        SET scopes = '["ingest"]'::jsonb
        WHERE scopes = '["ingest:write"]'::jsonb
    """)
