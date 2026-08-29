"""
Iceberg time-travel console (Week 4): lists the table's snapshot history and
lets the dashboard query the exact state of the data as of any snapshot —
e.g. rolling back to "before the anomaly" without touching the live stream.
"""
from fastapi import APIRouter, HTTPException
from ..services import iceberg_client

router = APIRouter(prefix="/api/iceberg", tags=["iceberg"])


@router.get("/history")
def history():
    try:
        return iceberg_client.get_history()
    except Exception as e:
        raise HTTPException(503, f"iceberg table not ready yet: {e}")


@router.get("/scan")
def scan(snapshot_id: int | None = None, limit: int = 200):
    try:
        if snapshot_id is None:
            return iceberg_client.scan_latest(limit=limit)
        return iceberg_client.scan_snapshot(snapshot_id, limit=limit)
    except Exception as e:
        raise HTTPException(503, f"iceberg scan failed: {e}")
