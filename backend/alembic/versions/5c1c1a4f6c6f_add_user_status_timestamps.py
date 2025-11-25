"""add user status timestamps

Revision ID: 5c1c1a4f6c6f
Revises: 4f1f8f0ad99b
Create Date: 2025-11-19 01:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c1c1a4f6c6f"
down_revision: Union[str, None] = "4f1f8f0ad99b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "user",
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.add_column(
        "user",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.add_column(
        "user",
        sa.Column("last_login", sa.DateTime(), nullable=True),
    )

    op.execute("UPDATE `user` SET last_login = NULL WHERE last_login IS NOT NULL")

    op.alter_column("user", "is_active", server_default=None)
    op.alter_column("user", "created_at", server_default=None)
    op.alter_column("user", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_column("user", "last_login")
    op.drop_column("user", "updated_at")
    op.drop_column("user", "created_at")
    op.drop_column("user", "is_active")
