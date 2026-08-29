from fastapi import APIRouter
from ..state import state

router = APIRouter(prefix="/api/lineage", tags=["lineage"])


@router.get("")
def get_lineage():
    snap = state.snapshot()
    return {
        "status": snap["lineage_status"],
        "throughput": snap["throughput"],
        "circuit_state": snap["circuit_state"],
    }
