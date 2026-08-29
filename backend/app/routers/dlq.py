from fastapi import APIRouter
from ..state import state

router = APIRouter(prefix="/api/dlq", tags=["dlq"])


@router.get("")
def list_dlq(limit: int = 100):
    return list(state.dlq_records)[:limit]
