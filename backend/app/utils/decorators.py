"""装饰器模块"""
from functools import wraps
from flask import session, request, jsonify, redirect, url_for
from datetime import datetime
from app.utils.datetime_utils import now_utc
import logging

logger = logging.getLogger(__name__)


def admin_required(f):
    """管理员权限验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            if request.is_json:
                return jsonify({'error': '需要管理员权限', 'redirect': url_for('auth.admin_login')}), 401
            else:
                return redirect(url_for('auth.admin_login'))
        return f(*args, **kwargs)
    return decorated_function


def verify_api_key(request):
    """验证API密钥"""
    from app.models import APIKey

    api_key = request.headers.get('X-API-Key') or request.args.get('api_key')

    if not api_key:
        return None, {'error': '缺少API密钥'}

    key_obj = APIKey.query.filter_by(key=api_key, is_active=True).first()
    if not key_obj:
        return None, {'error': '无效的API密钥'}

    if key_obj.usage_count >= key_obj.max_requests:
        return None, {'error': 'API密钥今日使用次数已用尽'}

    return key_obj, None


def api_key_required(f):
    """API密钥验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from app import db

        key_obj, error = verify_api_key(request)
        if error:
            return jsonify({'success': False, 'error': error['error']}), 401

        key_obj.last_used = now_utc()
        key_obj.usage_count += 1
        db.session.commit()

        return f(key_obj, *args, **kwargs)
    return decorated_function


def api_key_and_rate_limit(f):
    """API密钥验证 + 基础速率限制装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from app import db
        from app.utils.api_key_limiter import api_key_rate_limit

        # 应用API密钥验证
        key_obj, error = verify_api_key(request)
        if error:
            return jsonify({'success': False, 'error': error['error']}), 401

        # 检查API密钥的每日限制
        if key_obj.usage_count >= key_obj.max_requests:
            return jsonify({
                'success': False,
                'error': f'API密钥今日使用次数已用尽 ({key_obj.max_requests}次/天)',
                'retry_after': 86400  # 24小时后重试
            }), 429

        # 更新使用记录
        key_obj.last_used = now_utc()
        key_obj.usage_count += 1
        db.session.commit()

        return f(key_obj, *args, **kwargs)
    return decorated_function


def get_client_ip():
    """获取客户端真实IP（仅用于日志记录）"""
    if request.headers.getlist("X-Forwarded-For"):
        ip = request.headers.getlist("X-Forwarded-For")[0]
    elif request.headers.get("X-Real-IP"):
        ip = request.headers.get("X-Real-IP")
    else:
        ip = request.remote_addr
    return ip