"""sign-in browser nonce

Revision ID: c41e7b2d9a10
Revises: 8586d38dba20
Create Date: 2026-11-15 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c41e7b2d9a10'
down_revision: Union[str, Sequence[str], None] = '8586d38dba20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Pending states and codes from before this change get an empty hash, which never matches
    # a real nonce, so they simply expire. The default is dropped right after.
    for table in ('oauth_states', 'login_codes'):
        op.add_column(
            table,
            sa.Column('nonce_hash', sa.String(length=64), nullable=False, server_default=''),
        )
        op.alter_column(table, 'nonce_hash', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('login_codes', 'nonce_hash')
    op.drop_column('oauth_states', 'nonce_hash')
