"""组合装饰器模块"""
from functools import wraps
from flask import jsonify
import logging
from app.utils.decorators import verify_api_key
from app.utils.api_key_limiter import api_key_rate_limit, _api_key_usage
from app.utils.timezone import now
from datetime import timedelta

logger = logging.getLogger(__name__)


def api_key_required_with_rate_limit(hourly_limit=300, daily_limit=750):
    """API密钥验证 + 速率限制组合装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app import db

            # 1. 验证API密钥
            from flask import request
            key_obj, error = verify_api_key(request)
            if error:
                return jsonify({'success': False, 'error': error['error']}), 401

            api_key = key_obj.key
            current_time = now()

            # 2. 应用速率限制
            # 获取或初始化该API密钥的使用记录
            if api_key not in _api_key_usage:
                _api_key_usage[api_key] = {
                    'requests': [],
                    'last_reset': current_time
                }

            usage = _api_key_usage[api_key]

            # 清理过期的请求记录（超过1小时的）
            one_hour_ago = current_time - timedelta(hours=1)
            usage['requests'] = [
                req_time for req_time in usage['requests']
                if req_time > one_hour_ago
            ]

            # 检查小时限制
            if len(usage['requests']) >= hourly_limit:
                logger.warning(f"API key {api_key} exceeded hourly limit: {len(usage['requests'])}/{hourly_limit}")
                return jsonify({
                    'success': False,
                    'error': f'API密钥已达到每小时请求限制（{hourly_limit}次/小时）',
                    'retry_after': 3600
                }), 429

            # 检查每日限制
            one_day_ago = current_time - timedelta(days=1)
            daily_requests = len([
                req_time for req_time in usage['requests']
                if req_time > one_day_ago
            ])

            if daily_requests >= daily_limit:
                logger.warning(f"API key {api_key} exceeded daily limit: {daily_requests}/{daily_limit}")
                return jsonify({
                    'success': False,
                    'error': f'API密钥已达到每日请求限制（{daily_limit}次/天）',
                    'retry_after': 86400
                }), 429

            # 检查API密钥的每日限制（数据库中的max_requests）
            if key_obj.usage_count >= key_obj.max_requests:
                return jsonify({
                    'success': False,
                    'error': f'API密钥今日使用次数已用尽 ({key_obj.max_requests}次/天)',
                    'retry_after': 86400
                }), 429

            # 3. 记录当前请求和更新数据库
            usage['requests'].append(current_time)
            key_obj.last_used = now()  # 使用中国时间
            key_obj.usage_count += 1
            db.session.commit()

            logger.info(f"API key {api_key} usage: {len(usage['requests'])}/{hourly_limit} (hourly), {daily_requests}/{daily_limit} (daily), total: {key_obj.usage_count}/{key_obj.max_requests}")

            # 4. 调用原函数，传入key_obj作为第一个参数
            return f(key_obj, *args, **kwargs)
        return decorated_function
    return decorator