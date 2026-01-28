"""API蓝图模块"""
from app.api.auth import auth_bp
from app.api.recordings import recordings_bp
from app.api.keys import keys_bp
from app.api.text import text_bp
from app.api.dictionary import dictionary_bp
from app.api.dictionary_sync import dictionary_sync_bp
from app.api.asr import asr_bp
from app.api.reference import reference_bp

__all__ = ['auth_bp', 'recordings_bp', 'keys_bp', 'text_bp', 'dictionary_bp', 'dictionary_sync_bp', 'asr_bp', 'reference_bp']