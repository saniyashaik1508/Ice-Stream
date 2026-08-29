from fastapi import APIRouter
from ..state import state

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


@router.get("")
def get_kpis():
    snap = state.snapshot()
    total = snap["counters"].get("raw", 0) or 1
    dlq = snap["counters"].get("dlq", 0)
    return {
        "throughput_per_sec": snap["throughput"],
        "total_events": snap["counters"].get("raw", 0),
        "total_quarantined": dlq,
        "quarantine_rate": round(dlq / total, 4),
        "circuit_state": snap["circuit_state"],
        "rolling_error_rate": snap["error_rate"],
        "total_alerts": snap["counters"].get("alerts", 0),
    }
