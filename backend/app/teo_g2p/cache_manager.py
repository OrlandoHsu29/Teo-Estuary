"""
缓存管理器
支持多种缓存后端：内存缓存、Redis、文件缓存
"""

import os
import json
import time
import pickle
import hashlib
from typing import Optional, Any, Dict
from abc import ABC, abstractmethod

class CacheBackend(ABC):
    """缓存后端抽象基类"""

    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        pass

    @abstractmethod
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置缓存值"""
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """删除缓存"""
        pass

    @abstractmethod
    def clear(self) -> bool:
        """清空所有缓存"""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        pass


class MemoryCache(CacheBackend):
    """内存缓存实现"""

    def __init__(self, max_size: int = 10000, default_ttl: int = 3600):
        self.cache: Dict[str, Dict] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if key in self.cache:
            item = self.cache[key]
            if item['expires_at'] and time.time() > item['expires_at']:
                del self.cache[key]
                return None
            return item['value']
        return None

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置缓存值"""
        try:
            # 如果缓存已满，删除最旧的项
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.cache.keys(),
                               key=lambda k: self.cache[k]['created_at'])
                del self.cache[oldest_key]

            ttl = ttl or self.default_ttl
            expires_at = time.time() + ttl if ttl > 0 else None

            self.cache[key] = {
                'value': value,
                'created_at': time.time(),
                'expires_at': expires_at,
                'hit_count': 0
            }
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        """删除缓存"""
        if key in self.cache:
            del self.cache[key]
            return True
        return False

    def clear(self) -> bool:
        """清空所有缓存"""
        try:
            self.cache.clear()
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        return key in self.cache and (
            not self.cache[key]['expires_at'] or
            time.time() <= self.cache[key]['expires_at']
        )


class RedisCache(CacheBackend):
    """Redis缓存实现"""

    def __init__(self, redis_client=None, key_prefix: str = "teo_g2p:", default_ttl: int = 3600):
        try:
            import redis
            self.redis = redis_client or redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                db=int(os.getenv('REDIS_DB', 0)),
                decode_responses=False  # 使用bytes来支持pickle
            )
            self.key_prefix = key_prefix
            self.default_ttl = default_ttl
            self.available = True
        except ImportError:
            print("Warning: redis not installed. Redis cache not available.")
            self.available = False
        except Exception as e:
            print(f"Warning: Cannot connect to Redis: {e}")
            self.available = False

    def _make_key(self, key: str) -> str:
        """生成带前缀的键"""
        return f"{self.key_prefix}{key}"

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        if not self.available:
            return None

        try:
            value = self.redis.get(self._make_key(key))
            if value:
                return pickle.loads(value)
            return None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置缓存值"""
        if not self.available:
            return False

        try:
            ttl = ttl or self.default_ttl
            serialized = pickle.dumps(value)
            return self.redis.setex(
                self._make_key(key),
                ttl,
                serialized
            )
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self.available:
            return False

        try:
            return bool(self.redis.delete(self._make_key(key)))
        except Exception:
            return False

    def clear(self) -> bool:
        """清空所有缓存"""
        if not self.available:
            return False

        try:
            pattern = f"{self.key_prefix}*"
            keys = self.redis.keys(pattern)
            if keys:
                return bool(self.redis.delete(*keys))
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self.available:
            return False

        try:
            return bool(self.redis.exists(self._make_key(key)))
        except Exception:
            return False


class FileCache(CacheBackend):
    """文件缓存实现"""

    def __init__(self, cache_dir: str = "./cache", default_ttl: int = 3600):
        self.cache_dir = cache_dir
        self.default_ttl = default_ttl
        os.makedirs(cache_dir, exist_ok=True)

    def _get_file_path(self, key: str) -> str:
        """获取缓存文件路径"""
        # 使用MD5哈希作为文件名，避免特殊字符问题
        safe_key = hashlib.md5(key.encode('utf-8')).hexdigest()
        return os.path.join(self.cache_dir, f"{safe_key}.cache")

    def _is_expired(self, file_path: str) -> bool:
        """检查缓存是否过期"""
        try:
            with open(file_path, 'rb') as f:
                data = pickle.load(f)
            return data['expires_at'] and time.time() > data['expires_at']
        except Exception:
            return True

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        file_path = self._get_file_path(key)
        try:
            if os.path.exists(file_path) and not self._is_expired(file_path):
                with open(file_path, 'rb') as f:
                    data = pickle.load(f)
                return data['value']
            else:
                # 如果文件存在但已过期，删除它
                if os.path.exists(file_path):
                    os.remove(file_path)
                return None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置缓存值"""
        try:
            ttl = ttl or self.default_ttl
            expires_at = time.time() + ttl if ttl > 0 else None

            cache_data = {
                'value': value,
                'created_at': time.time(),
                'expires_at': expires_at
            }

            file_path = self._get_file_path(key)
            with open(file_path, 'wb') as f:
                pickle.dump(cache_data, f)

            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        """删除缓存"""
        file_path = self._get_file_path(key)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            return True
        except Exception:
            return False

    def clear(self) -> bool:
        """清空所有缓存"""
        try:
            for filename in os.listdir(self.cache_dir):
                if filename.endswith('.cache'):
                    os.remove(os.path.join(self.cache_dir, filename))
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        file_path = self._get_file_path(key)
        return os.path.exists(file_path) and not self._is_expired(file_path)


class CacheManager:
    """缓存管理器"""

    def __init__(self, backend: CacheBackend = None):
        if backend is None:
            # 优先使用Redis缓存
            self.backend = self._detect_best_cache()
        else:
            self.backend = backend

        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0
        }

    def _detect_best_cache(self) -> CacheBackend:
        """自动检测最佳缓存后端"""
        # 1. 检查环境变量
        if os.getenv('REDIS_HOST'):
            return RedisCache()

        # 2. 尝试连接本地Redis
        try:
            import redis
            redis_client = redis.Redis(
                host='localhost',
                port=int(os.getenv('REDIS_PORT', 6379)),
                db=int(os.getenv('REDIS_DB', 0)),
                decode_responses=False
            )
            redis_client.ping()  # 测试连接
            print("[SUCCESS] 已连接到本地Redis服务器")
            return RedisCache(redis_client=redis_client)
        except Exception:
            pass

        # 3. 检查是否指定文件缓存
        if os.getenv('USE_FILE_CACHE', 'false').lower() == 'true':
            cache_dir = os.getenv('CACHE_DIR', './cache/teo_g2p')
            os.makedirs(cache_dir, exist_ok=True)
            print(f"[INFO] 使用文件缓存: {cache_dir}")
            return FileCache(cache_dir=cache_dir)

        # 4. 最后使用内存缓存
        print("[INFO] 使用内存缓存")
        return MemoryCache()

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        value = self.backend.get(key)
        if value is not None:
            self.stats['hits'] += 1
        else:
            self.stats['misses'] += 1
        return value

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """设置缓存值"""
        success = self.backend.set(key, value, ttl)
        if success:
            self.stats['sets'] += 1
        return success

    def delete(self, key: str) -> bool:
        """删除缓存"""
        success = self.backend.delete(key)
        if success:
            self.stats['deletes'] += 1
        return success

    def clear(self) -> bool:
        """清空所有缓存"""
        return self.backend.clear()

    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        return self.backend.exists(key)

    def get_stats(self) -> Dict[str, int]:
        """获取缓存统计信息"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = self.stats['hits'] / total_requests if total_requests > 0 else 0

        return {
            **self.stats,
            'hit_rate': hit_rate,
            'total_requests': total_requests
        }

    def reset_stats(self):
        """重置统计信息"""
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0
        }


# 创建全局缓存管理器实例
cache_manager = CacheManager()