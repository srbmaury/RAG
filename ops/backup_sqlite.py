"""Consistent local SQLite backup with integrity validation.

Stop Atlas before restoring; never replace a live database.
Usage: python ops/backup_sqlite.py data/atlas.db backups/atlas-2026-11-01.db
"""

import argparse
import sqlite3
from pathlib import Path


def backup(source: Path, destination: Path) -> None:
    source = source.resolve()
    destination = destination.resolve()
    if source == destination:
        raise ValueError('Backup must be a different path.')
    if not source.is_file():
        raise FileNotFoundError(source)
    if destination.exists():
        raise FileExistsError(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as original:
            with sqlite3.connect(destination) as saved:
                original.backup(saved)
                if saved.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                    raise RuntimeError('SQLite backup failed integrity check.')
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    backup(args.source, args.destination)
    print(f'Verified SQLite backup: {args.destination}')


if __name__ == '__main__':
    main()
