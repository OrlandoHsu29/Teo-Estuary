"""
TeoG2P 潮州话拼音和翻译模块
"""

from .database import init_db, get_db
from .models import TranslationDict
from .translation_service import TranslationService, translation_service
from .cache_manager import CacheManager, cache_manager

__version__ = "1.0.0"
__all__ = [
    'init_db',
    'get_db',
    'TranslationDict',
    'TranslationService',
    'translation_service',
    'CacheManager',
    'cache_manager'
]