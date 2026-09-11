import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    await websocket.accept()
    try:
        auth_msg = await websocket.receive_text()
        auth_data = json.loads(auth_msg)
        if auth_data.get("type") != "auth" or not auth_data.get("token"):
            await websocket.close(code=4401)
            return
        user_id = decode_access_token(auth_data["token"])
        if not user_id:
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    # User is authenticated, register the connection
    user_id_str = str(user_id)
    if user_id_str not in manager._connections:
        manager._connections[user_id_str] = []
    
    if len(manager._connections[user_id_str]) >= manager.MAX_CONNECTIONS_PER_USER:
        oldest = manager._connections[user_id_str].pop(0)
        await oldest.close(code=1008, reason="Too many connections")
        
    manager._connections[user_id_str].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
