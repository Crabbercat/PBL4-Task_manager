import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parents[1] / "test_api.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

db_url = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["DATABASE_URL"] = db_url

from backend.db.database import Base, engine  # noqa: E402
from backend.db import db_structure  # noqa: E402,F401

Base.metadata.create_all(bind=engine)
