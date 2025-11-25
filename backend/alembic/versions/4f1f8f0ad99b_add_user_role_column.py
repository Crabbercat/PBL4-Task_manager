"""add user role column

Revision ID: 4f1f8f0ad99b
Revises: a03f754660d4
Create Date: 2025-11-19 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f1f8f0ad99b"
down_revision: Union[str, None] = "a03f754660d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
    )
    op.execute("UPDATE `user` SET role = 'user' WHERE role IS NULL")
    op.alter_column("user", "role", server_default=None)


def downgrade() -> None:
    op.drop_column("user", "role")
