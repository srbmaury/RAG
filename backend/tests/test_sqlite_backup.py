import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[2] / "ops"))
from backup_sqlite import backup


def test_live_sqlite_backup_includes_committed_data(tmp_path):
    source = tmp_path / "source.db"
    target = tmp_path / "backup.db"
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE notes (value TEXT)")
        db.execute("INSERT INTO notes VALUES ('present')")
    backup(source, target)
    with sqlite3.connect(target) as saved:
        assert saved.execute("SELECT value FROM notes").fetchone()[0] == "present"
    with pytest.raises(FileExistsError):
        backup(source, target)


def test_backup_rejects_same_path_and_missing_source(tmp_path):
    source = tmp_path / "missing.db"
    with pytest.raises(ValueError):
        backup(source, source)
    with pytest.raises(FileNotFoundError):
        backup(source, tmp_path / "backup.db")
