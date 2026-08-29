from fastapi import APIRouter
from ..state import state

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(limit: int = 100):
    return list(state.alerts)[:limit]
