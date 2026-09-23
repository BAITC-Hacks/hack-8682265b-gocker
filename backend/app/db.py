import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    pg_host = os.getenv("POSTGRES_HOST", "localhost")
    pg_port = os.getenv("POSTGRES_PORT", "5435")
    pg_user = os.getenv("POSTGRES_USER", "postgres")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "postgres")
    pg_db = os.getenv("POSTGRES_DB", "hackalem")
    DATABASE_URL = f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"


def get_sqlite_path() -> Path:
    if Path("/data/output").exists():
        out_dir = Path("/data/output")
    else:
        project_root = Path(__file__).resolve().parent.parent.parent
        out_dir = project_root / "data" / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / "case_reviews.db"


def _init_sqlite_db(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS case_reviews (
            gid INTEGER PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'unreviewed',
            note TEXT,
            reviewed_by TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()


def _get_pg_connection():
    if not psycopg:
        return None
    try:
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=2)
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS case_reviews (
                    gid BIGINT PRIMARY KEY,
                    status TEXT NOT NULL DEFAULT 'unreviewed',
                    note TEXT,
                    reviewed_by TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """)
            conn.commit()
        return conn
    except Exception:
        return None


def upsert_review(gid: int, status: str, note: Optional[str] = None, reviewed_by: Optional[str] = "analyst") -> Dict[str, Any]:
    pg_conn = _get_pg_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    if pg_conn:
        try:
            with pg_conn:
                with pg_conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO case_reviews (gid, status, note, reviewed_by, updated_at)
                        VALUES (%s, %s, %s, %s, now())
                        ON CONFLICT (gid) DO UPDATE SET
                            status = EXCLUDED.status,
                            note = COALESCE(EXCLUDED.note, case_reviews.note),
                            reviewed_by = EXCLUDED.reviewed_by,
                            updated_at = now()
                        RETURNING gid, status, note, reviewed_by, updated_at;
                    """, (gid, status, note, reviewed_by))
                    row = cur.fetchone()
                    return {
                        "gid": int(row["gid"]),
                        "status": row["status"],
                        "note": row["note"],
                        "reviewed_by": row["reviewed_by"],
                        "updated_at": row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"])
                    }
        finally:
            pg_conn.close()

    # SQLite fallback
    db_path = get_sqlite_path()
    with sqlite3.connect(db_path) as s_conn:
        _init_sqlite_db(s_conn)
        s_conn.row_factory = sqlite3.Row
        cur = s_conn.cursor()
        cur.execute("""
            INSERT INTO case_reviews (gid, status, note, reviewed_by, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (gid) DO UPDATE SET
                status = excluded.status,
                note = COALESCE(excluded.note, case_reviews.note),
                reviewed_by = excluded.reviewed_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING gid, status, note, reviewed_by, updated_at;
        """, (gid, status, note, reviewed_by))
        row = cur.fetchone()
        s_conn.commit()
        return {
            "gid": int(row["gid"]),
            "status": row["status"],
            "note": row["note"],
            "reviewed_by": row["reviewed_by"],
            "updated_at": str(row["updated_at"])
        }


def get_all_reviews() -> List[Dict[str, Any]]:
    pg_conn = _get_pg_connection()
    if pg_conn:
        try:
            with pg_conn:
                with pg_conn.cursor() as cur:
                    cur.execute("SELECT gid, status, note, reviewed_by, updated_at FROM case_reviews ORDER BY updated_at DESC;")
                    rows = cur.fetchall()
                    return [{
                        "gid": int(r["gid"]),
                        "status": r["status"],
                        "note": r["note"],
                        "reviewed_by": r["reviewed_by"],
                        "updated_at": r["updated_at"].isoformat() if hasattr(r["updated_at"], "isoformat") else str(r["updated_at"])
                    } for r in rows]
        finally:
            pg_conn.close()

    db_path = get_sqlite_path()
    if not db_path.exists():
        return []
    with sqlite3.connect(db_path) as s_conn:
        _init_sqlite_db(s_conn)
        s_conn.row_factory = sqlite3.Row
        cur = s_conn.cursor()
        cur.execute("SELECT gid, status, note, reviewed_by, updated_at FROM case_reviews ORDER BY updated_at DESC;")
        rows = cur.fetchall()
        return [{
            "gid": int(r["gid"]),
            "status": r["status"],
            "note": r["note"],
            "reviewed_by": r["reviewed_by"],
            "updated_at": str(r["updated_at"])
        } for r in rows]


def get_escalated_reviews() -> List[Dict[str, Any]]:
    reviews = get_all_reviews()
    return [r for r in reviews if r["status"] == "escalated"]
