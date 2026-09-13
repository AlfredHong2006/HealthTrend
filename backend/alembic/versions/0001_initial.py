"""Initial account schema: users, login codes, sessions, measurements, preferences, goals.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-13

Written out in full rather than importing anything from ``app.persistence.models``: a
migration is a frozen record of one schema change and must keep producing the same tables
after the models move on. ``tests/persistence/test_migrations.py`` asserts that upgrading to
head yields exactly the schema the current models describe.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _utc() -> sa.DateTime:
    """Return a timezone-aware datetime column type."""
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    """Create the six account tables."""
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("created_at", _utc(), nullable=False),
        sa.Column("last_login_at", _utc(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "login_codes",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("created_at", _utc(), nullable=False),
        sa.Column("expires_at", _utc(), nullable=False),
        sa.Column("consumed_at", _utc(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_login_codes"),
    )
    op.create_index("ix_login_codes_email_created_at", "login_codes", ["email", "created_at"])
    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("created_at", _utc(), nullable=False),
        sa.Column("expires_at", _utc(), nullable=False),
        sa.Column("last_seen_at", _utc(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sessions_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("token_hash", name="pk_sessions"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_table(
        "measurements",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("timestamp", _utc(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(2), nullable=False),
        sa.Column("source", sa.String(6), nullable=False),
        sa.Column("created_at", _utc(), nullable=False),
        sa.Column("updated_at", _utc(), nullable=False),
        sa.CheckConstraint("unit IN ('kg', 'lb')", name="ck_measurements_unit"),
        sa.CheckConstraint("source IN ('manual', 'csv')", name="ck_measurements_source"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_measurements_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_measurements"),
    )
    op.create_index("ix_measurements_user_id_timestamp", "measurements", ["user_id", "timestamp"])
    op.create_table(
        "preferences",
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("display_unit", sa.String(2), nullable=False),
        sa.Column("updated_at", _utc(), nullable=False),
        sa.CheckConstraint("display_unit IN ('kg', 'lb')", name="ck_preferences_display_unit"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_preferences_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", name="pk_preferences"),
    )
    op.create_table(
        "goals",
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("target_weight_kg", sa.Float(), nullable=True),
        sa.Column("target_weekly_rate_kg", sa.Float(), nullable=True),
        sa.Column("updated_at", _utc(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_goals_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", name="pk_goals"),
    )


def downgrade() -> None:
    """Drop the six account tables, dependants first."""
    op.drop_table("goals")
    op.drop_table("preferences")
    op.drop_index("ix_measurements_user_id_timestamp", table_name="measurements")
    op.drop_table("measurements")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_login_codes_email_created_at", table_name="login_codes")
    op.drop_table("login_codes")
    op.drop_table("users")
