import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .routers import kpi, lineage, rules, incidents, dlq, alerts, timetravel
from .services import kafka_listener
from .websocket_manager import manager
from .state import state

app = FastAPI(title="IceStream API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (kpi, lineage, rules, incidents, dlq, alerts, timetravel):
    app.include_router(r.router)


@app.on_event("startup")
async def on_startup():
    loop = asyncio.get_event_loop()
    kafka_listener.start(loop)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """
    Single live channel for the whole dashboard. Messages are tagged by
    `channel` (lineage | alert | dlq | circuit_breaker); the frontend
    dispatches on that field. On connect we push a full snapshot so a
    freshly opened tab isn't blank until the next Kafka event arrives.
    """
    await manager.connect(websocket)
    await websocket.send_json({"channel": "snapshot", "state": state.snapshot()})
    try:
        while True:
            # dashboard doesn't send anything up this channel today; just
            # keep the connection alive and detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
