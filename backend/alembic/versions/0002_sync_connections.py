"""Sync connections, and ``apple_health`` as a measurement source.

Revision ID: 0002_sync_connections
Revises: 0001_initial
Create Date: 2026-10-07

Two changes, both additive on upgrade -- no existing row is rewritten or removed:

* a new ``sync_connections`` table, holding the SHA-256 of each sync token;
* ``measurements.source`` widened from 6 to 12 characters and its check constraint extended to
  admit ``apple_health``. Every existing ``manual`` and ``csv`` row satisfies the new
  constraint unchanged.

The ``measurements`` change goes through ``batch_alter_table`` because SQLite, which the test
suite runs on, cannot alter a column type or drop a constraint in place. On Postgres the same
block is three ordinary ``ALTER TABLE`` statements, and widening a ``varchar`` rewrites no
rows.

Constraint names are written here exactly as ``0001_initial`` wrote them. The migration
environment applies the models' naming convention on top, so the check constraint this
migration drops and recreates is, in a migrated database, the same
``ck_measurements_ck_measurements_source`` that ``0001_initial`` created -- the two revisions
agree with each other, which is what dropping it by name depends on.

Written out in full rather than importing anything from ``app.persistence.models``, for the
reason given in ``0001_initial``.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_sync_connections"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _utc() -> sa.DateTime:
    """Return a timezone-aware datetime column type."""
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    """Create ``sync_connections`` and admit ``apple_health`` measurements."""
    op.create_table(
        "sync_connections",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("source", sa.String(12), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", _utc(), nullable=False),
        sa.Column("last_used_at", _utc(), nullable=True),
        sa.CheckConstraint("source IN ('apple_health')", name="ck_sync_connections_source"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_sync_connections_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sync_connections"),
        sa.UniqueConstraint("token_hash", name="uq_sync_connections_token_hash"),
    )
    op.create_index("ix_sync_connections_user_id", "sync_connections", ["user_id"])

    with op.batch_alter_table("measurements") as batch:
        batch.drop_constraint("ck_measurements_source", type_="check")
        batch.alter_column(
            "source", existing_type=sa.String(6), type_=sa.String(12), existing_nullable=False
        )
        batch.create_check_constraint(
            "ck_measurements_source", "source IN ('manual', 'csv', 'apple_health')"
        )


def downgrade() -> None:
    """Drop ``sync_connections`` and narrow ``measurements.source`` again.

    The narrower column cannot hold ``apple_health``. Rather than delete those measurements,
    they are relabelled ``manual`` first: the weigh-ins survive and only their provenance is
    lost. Every sync token stops working, because the table holding their hashes is gone.
    """
    op.execute("UPDATE measurements SET source = 'manual' WHERE source = 'apple_health'")
    with op.batch_alter_table("measurements") as batch:
        batch.drop_constraint("ck_measurements_source", type_="check")
        batch.alter_column(
            "source", existing_type=sa.String(12), type_=sa.String(6), existing_nullable=False
        )
        batch.create_check_constraint("ck_measurements_source", "source IN ('manual', 'csv')")

    op.drop_index("ix_sync_connections_user_id", table_name="sync_connections")
    op.drop_table("sync_connections")
