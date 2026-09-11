"""
Replaces the mock frontend's `setInterval(...,1000)` polling pattern.
Instead of every screen re-fetching balance every second, the payment
engine (and mandate scheduler) push an event the instant something
changes, to every socket open for that user_id.
"""
import json
import uuid

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of active WebSocket connections
        self._connections: dict[uuid.UUID, list[WebSocket]] = {}
        self.MAX_CONNECTIONS_PER_USER = 5

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        user_id_str = str(user_id)
        if user_id_str not in self._connections:
            self._connections[user_id_str] = []
        
        if len(self._connections[user_id_str]) >= self.MAX_CONNECTIONS_PER_USER:
            oldest = self._connections[user_id_str].pop(0)
            await oldest.close(code=1008, reason="Too many connections")
            
        self._connections[user_id_str].append(websocket)

    def disconnect(self, user_id: uuid.UUID, ws: WebSocket):
        conns = self._connections.get(str(user_id), [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(str(user_id), None)

    async def push(self, user_id: uuid.UUID, event_type: str, data: dict):
        conns = self._connections.get(str(user_id), [])
        payload = json.dumps({"type": event_type, "data": data}, default=str)
        dead = []
        for ws in conns:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)


manager = ConnectionManager()
