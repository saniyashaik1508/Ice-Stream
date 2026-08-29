"""
Incident log: every circuit-breaker state transition, with the reason and
the error rate that triggered it — "exactly why a pipeline was paused and
when it resumed" (Week 4 UI requirement).
"""
from fastapi import APIRouter
from ..state import state

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("")
def list_incidents(limit: int = 50):
    return list(state.incidents)[:limit]
