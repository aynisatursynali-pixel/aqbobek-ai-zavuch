import json
import sqlite3
from pathlib import Path
from typing import Any

from config import DATA_DIR


DB_PATH = DATA_DIR / "aqbobek.db"
COLLECTION_TABLES = {
    "attendance_reports.json": "attendance_reports",
    "incidents.json": "incidents",
    "tasks.json": "tasks",
    "substitutions.json": "substitutions",
    "notifications.json": "notifications",
}


def _connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _json_export_path(filename: str) -> Path:
    return DATA_DIR / filename


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS collection_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_name TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                payload TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_sort
            ON collection_records(collection_name, sort_order);

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                event_type TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                payload TEXT
            );
            """
        )


def _load_json_file(path: Path, default=None):
    if not path.exists():
        return [] if default is None else default
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _export_collection(filename: str, records: list[dict[str, Any]]):
    path = _json_export_path(filename)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(records, handle, ensure_ascii=False, indent=2)


def _table_for(filename: str):
    return COLLECTION_TABLES.get(filename)


def load_collection(filename: str, default=None):
    init_db()
    table_name = _table_for(filename)
    if not table_name:
        return _load_json_file(_json_export_path(filename), default)

    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT payload
            FROM collection_records
            WHERE collection_name = ?
            ORDER BY sort_order ASC
            """,
            (table_name,),
        ).fetchall()

    if not rows:
        records = _load_json_file(_json_export_path(filename), default)
        if records:
            save_collection(filename, records)
        return records

    return [json.loads(row["payload"]) for row in rows]


def save_collection(filename: str, data):
    init_db()
    table_name = _table_for(filename)
    if not table_name:
        _export_collection(filename, data)
        return

    with _connect() as connection:
        connection.execute("DELETE FROM collection_records WHERE collection_name = ?", (table_name,))
        for sort_order, record in enumerate(data):
            connection.execute(
                """
                INSERT INTO collection_records(collection_name, sort_order, payload)
                VALUES (?, ?, ?)
                """,
                (table_name, sort_order, json.dumps(record, ensure_ascii=False)),
            )

    _export_collection(filename, data)


def append_notification(notification: dict[str, Any]):
    notifications = load_collection("notifications.json", [])
    notifications.insert(0, notification)
    save_collection("notifications.json", notifications[:200])
    return notification


def load_notifications(limit=50):
    notifications = load_collection("notifications.json", [])
    return notifications[:limit]


def append_audit_log(event_type: str, entity_type: str, summary: str, payload: dict[str, Any] | None = None, *, created_at: str):
    init_db()
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO audit_log(created_at, event_type, entity_type, summary, payload)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                created_at,
                event_type,
                entity_type,
                summary,
                json.dumps(payload or {}, ensure_ascii=False),
            ),
        )


def load_audit_log(limit=100):
    init_db()
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT created_at, event_type, entity_type, summary, payload
            FROM audit_log
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "created_at": row["created_at"],
            "event_type": row["event_type"],
            "entity_type": row["entity_type"],
            "summary": row["summary"],
            "payload": json.loads(row["payload"] or "{}"),
        }
        for row in rows
    ]
