"""Trust-model upgrade: anonymity, moderation, integrity

Revision ID: b7e2f4a8c0d1
Revises: 52687feb94f6
Create Date: 2026-08-08 00:00:00.000000

Changes:
- complaints: add author_id (never serialized), verifier_teacher (assigned verifier,
  distinct from target_teacher = subject), is_false (admin-confirmed only),
  is_private (for fresh installs where migration #1 predates it), rename ai_category -> category.
- users: add is_active, is_banned, false_count.
- votes: UNIQUE(complaint_id, user_id) — duplicate-vote final authority.
- teacher_ratings: UNIQUE(teacher_id, student_id), CHECK(rating 1..5), add tags
  (for fresh installs).
- Data backfill: legacy rows conflated target_teacher with the verifier; copy it
  to verifier_teacher and clear the subject column. Dedupe existing duplicate ratings.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'b7e2f4a8c0d1'
down_revision: Union[str, Sequence[str], None] = '52687feb94f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    rows = bind.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    with op.batch_alter_table('users') as b:
        if not _has_column(bind, 'users', 'is_active'):
            b.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'))
        if not _has_column(bind, 'users', 'is_banned'):
            b.add_column(sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='0'))
        if not _has_column(bind, 'users', 'false_count'):
            b.add_column(sa.Column('false_count', sa.Integer(), nullable=False, server_default='0'))

    # ------------------------------------------------------------------
    # complaints
    # ------------------------------------------------------------------
    with op.batch_alter_table('complaints') as b:
        if not _has_column(bind, 'complaints', 'is_private'):
            b.add_column(sa.Column('is_private', sa.Boolean(), nullable=False, server_default='0'))
        b.add_column(sa.Column('author_id', sa.String(), nullable=True))
        b.add_column(sa.Column('verifier_teacher', sa.String(), nullable=True))
        b.add_column(sa.Column('is_false', sa.Boolean(), nullable=False, server_default='0'))
        b.alter_column('ai_category', new_column_name='category')
        b.create_foreign_key('fk_complaints_author', 'users', ['author_id'], ['id'])
        b.create_foreign_key('fk_complaints_verifier', 'users', ['verifier_teacher'], ['id'])

    # Backfill: legacy rows used target_teacher as the verifier.
    bind.execute(
        text("UPDATE complaints SET verifier_teacher = target_teacher WHERE verifier_teacher IS NULL")
    )
    # The subject column (who the complaint is ABOUT) is unknown for legacy rows.
    bind.execute(text("UPDATE complaints SET target_teacher = NULL"))

    # ------------------------------------------------------------------
    # votes
    # ------------------------------------------------------------------
    with op.batch_alter_table('votes') as b:
        b.create_unique_constraint('uq_vote_complaint_user', ['complaint_id', 'user_id'])

    # ------------------------------------------------------------------
    # teacher_ratings
    # ------------------------------------------------------------------
    with op.batch_alter_table('teacher_ratings') as b:
        if not _has_column(bind, 'teacher_ratings', 'tags'):
            b.add_column(sa.Column('tags', sa.String(), nullable=True))

    # Deduplicate any legacy duplicate ratings (keep the oldest row per pair).
    dupes = bind.execute(
        text("""
            SELECT teacher_id, student_id, MIN(id) AS keep_id
            FROM teacher_ratings
            GROUP BY teacher_id, student_id
            HAVING COUNT(*) > 1
        """)
    ).fetchall()
    for teacher_id, student_id, keep_id in dupes:
        bind.execute(
            text("""
                DELETE FROM teacher_ratings
                WHERE teacher_id = :t AND student_id = :s AND id != :k
            """),
            {"t": teacher_id, "s": student_id, "k": keep_id},
        )

    with op.batch_alter_table('teacher_ratings') as b:
        b.create_unique_constraint('uq_rating_teacher_student', ['teacher_id', 'student_id'])
        b.create_check_constraint('ck_rating_range', 'rating BETWEEN 1 AND 5')


def downgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table('teacher_ratings') as b:
        b.drop_constraint('uq_rating_teacher_student', type_='unique')
        b.drop_constraint('ck_rating_range', type_='check')
    with op.batch_alter_table('votes') as b:
        b.drop_constraint('uq_vote_complaint_user', type_='unique')
    with op.batch_alter_table('complaints') as b:
        b.drop_constraint('fk_complaints_verifier', type_='foreignkey')
        b.drop_constraint('fk_complaints_author', type_='foreignkey')
        b.alter_column('category', new_column_name='ai_category')
        b.drop_column('is_false')
        b.drop_column('verifier_teacher')
        b.drop_column('author_id')
    with op.batch_alter_table('users') as b:
        b.drop_column('false_count')
        b.drop_column('is_banned')
        b.drop_column('is_active')
