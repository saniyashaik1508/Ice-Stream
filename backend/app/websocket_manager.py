"""Broadcasts live events (KPI ticks, lineage status flips, new alerts, DLQ
records, incidents) to every connected dashboard over WebSocket."""
import asyncio
import orjson
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, payload: dict):
        data = orjson.dumps(payload)
        dead = []
        async with self._lock:
            targets = list(self._connections)
        for ws in targets:
            try:
                await ws.send_bytes(data)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)


manager = ConnectionManager()
