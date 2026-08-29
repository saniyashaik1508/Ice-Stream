"""
Read-only Iceberg access for the backend. Kept as its own small module
(rather than importing stream_processor's `iceberg_sink.py` across a Docker
build-context boundary) so the backend and the stream processor stay
independently deployable services that only share the catalog + warehouse,
never Python code.
"""
import os
from pyiceberg.catalog.sql import SqlCatalog

CATALOG_URI = os.getenv("CATALOG_URI", "postgresql+psycopg2://iceberg:iceberg@localhost:5432/iceberg_catalog")
WAREHOUSE = os.getenv("ICEBERG_WAREHOUSE", "s3://icestream-warehouse/warehouse")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
TABLE_NAME = "lakehouse.transactions"


def _catalog() -> SqlCatalog:
    return SqlCatalog(
        "icestream",
        **{
            "uri": CATALOG_URI,
            "warehouse": WAREHOUSE,
            "s3.endpoint": S3_ENDPOINT,
            "s3.access-key-id": S3_ACCESS_KEY,
            "s3.secret-access-key": S3_SECRET_KEY,
            "s3.path-style-access": "true",
        },
    )


def _table():
    catalog = _catalog()
    return catalog.load_table(TABLE_NAME)


def get_history():
    table = _table()
    return [
        {
            "snapshot_id": s.snapshot_id,
            "timestamp_ms": s.timestamp_ms,
            "operation": s.summary.get("operation", "append") if s.summary else "append",
            "record_count": s.summary.get("total-records") if s.summary else None,
        }
        for s in table.history()
    ]


def scan_snapshot(snapshot_id: int, limit: int = 200):
    table = _table()
    scan = table.scan(snapshot_id=snapshot_id, limit=limit)
    return scan.to_arrow().to_pylist()


def scan_latest(limit: int = 200):
    table = _table()
    scan = table.scan(limit=limit)
    return scan.to_arrow().to_pylist()
