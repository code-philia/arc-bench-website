from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="web")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    test_runner: Mapped[str] = mapped_column(String(64), nullable=False, default="playwright")
    requirements_path: Mapped[str] = mapped_column(String(512), nullable=False)
    prerequisites_path: Mapped[str] = mapped_column(String(512), nullable=False)
    tests_path: Mapped[str] = mapped_column(String(512), nullable=False)
    assets_path: Mapped[str] = mapped_column(String(512), nullable=False)
    references_path: Mapped[str] = mapped_column(String(512), nullable=False)
    total_tests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    module_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
