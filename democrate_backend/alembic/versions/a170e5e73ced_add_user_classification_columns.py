"""Add user classification columns

Revision ID: a170e5e73ced
Revises: de7b9d244683
Create Date: 2026-09-04 23:08:40.563921

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a170e5e73ced'
down_revision: Union[str, Sequence[str], None] = 'de7b9d244683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as b:
        b.add_column(sa.Column('class_name', sa.String(), nullable=False, server_default='NA'))
        b.add_column(sa.Column('section_name', sa.String(), nullable=False, server_default='NA'))
        b.add_column(sa.Column('subject', sa.String(), nullable=False, server_default='NA'))
        b.add_column(sa.Column('is_class_teacher', sa.Boolean(), nullable=False, server_default='0'))
        b.drop_column('details')

def downgrade() -> None:
    with op.batch_alter_table('users') as b:
        b.add_column(sa.Column('details', sa.String(), nullable=True))
        b.drop_column('is_class_teacher')
        b.drop_column('subject')
        b.drop_column('section_name')
        b.drop_column('class_name')
