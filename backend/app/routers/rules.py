"""
Data quality rules CRUD. This is the dashboard-facing view of the rule set
the stream processor's `rules_engine.py` enforces in-stream; editing here
updates what the UI displays. To hot-reload rules into the running Flink
job itself, wire this router to publish a control message the job's
`open()` reads on interval — left as an extension point for a production
deployment.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..state import state

router = APIRouter(prefix="/api/rules", tags=["rules"])


class Rule(BaseModel):
    name: str
    column: str
    enabled: bool = True


@router.get("")
def list_rules():
    return state.rules


@router.post("")
def add_rule(rule: Rule):
    state.rules.append(rule.model_dump())
    return state.rules


@router.patch("/{index}")
def toggle_rule(index: int, rule: Rule):
    if index < 0 or index >= len(state.rules):
        raise HTTPException(404, "rule not found")
    state.rules[index] = rule.model_dump()
    return state.rules[index]


@router.delete("/{index}")
def delete_rule(index: int):
    if index < 0 or index >= len(state.rules):
        raise HTTPException(404, "rule not found")
    return state.rules.pop(index)
