"""project member roles and project archived flag

Revision ID: 8f6a0b0f9c1a
Revises: 5c1c1a4f6c6f
Create Date: 2025-11-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f6a0b0f9c1a"
down_revision: Union[str, None] = "5c1c1a4f6c6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PROJECT_MEMBER_ROLE_ENUM = sa.Enum("owner", "manager", "member", name="project_member_role")


def upgrade() -> None:
    op.add_column(
        "project_member",
        sa.Column("role", PROJECT_MEMBER_ROLE_ENUM, nullable=False, server_default="member"),
    )

    op.add_column(
        "project",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    op.execute("UPDATE project_member SET role = 'member' WHERE role IS NULL")
    op.execute(
        """
        UPDATE project_member pm
        JOIN project p ON pm.project_id = p.id AND pm.user_id = p.owner_id
        SET pm.role = 'owner'
        """
    )
    op.execute("UPDATE project SET archived = 0 WHERE archived IS NULL")

    op.alter_column("project_member", "role", server_default=None)
    op.alter_column("project", "archived", server_default=None)


def downgrade() -> None:
    op.drop_column("project", "archived")
    op.drop_column("project_member", "role")
    PROJECT_MEMBER_ROLE_ENUM.drop(op.get_bind(), checkfirst=False)
