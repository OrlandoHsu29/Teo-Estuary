"""API蓝图模块"""
from app.api.auth import auth_bp
from app.api.recordings import recordings_bp
from app.api.keys import keys_bp
from app.api.text import text_bp

__all__ = ['auth_bp', 'recordings_bp', 'keys_bp', 'text_bp']