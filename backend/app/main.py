"""Pure FastAPI entry point; this process never imports rclpy."""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.app_state import alert_history, monitor_cache, monitor_consumer
from app.routers import alerts, monitor_proxy, monitor_websocket, monitoring, user_preferences
from app.settings import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    alert_history.start()
    monitor_consumer.start()
    try:
        yield
    finally:
        monitor_consumer.stop()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(monitoring.router)
app.include_router(alerts.router)
app.include_router(monitor_websocket.router)
app.include_router(user_preferences.router)
app.include_router(monitor_proxy.router)


@app.get('/health')
def health() -> dict[str, Any]:
    cache = monitor_cache.snapshot()
    return {
        'success': True,
        'data': {
            'status': 'running',
            'monitor_connected': cache['connected'],
            'monitor_last_updated': cache['updated_at'],
            'monitor_error': cache['error'],
        },
        'message': 'Backend is running',
    }
