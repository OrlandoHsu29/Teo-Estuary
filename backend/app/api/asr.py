"""ASR语音识别转发蓝图"""
import os
import requests
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import logging
from app.models import APIKey
from app import db
from functools import wraps

asr_bp = Blueprint('asr', __name__)
logger = logging.getLogger(__name__)

# ASR服务地址
ASR_SERVICE_URL = os.getenv('ASR_SERVICE_URL', 'http://localhost:5026')


def verify_api_key(f):
    """API密钥验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 从请求头或表单中获取API密钥
        api_key = request.headers.get('X-API-Key') or request.form.get('api_key')

        if not api_key:
            return jsonify({
                'status': 'error',
                'message': '缺少API密钥'
            }), 401

        # 查询数据库验证密钥
        key_obj = APIKey.query.filter_by(key=api_key).first()

        if not key_obj:
            return jsonify({
                'status': 'error',
                'message': '无效的API密钥'
            }), 401

        if not key_obj.is_active:
            return jsonify({
                'status': 'error',
                'message': 'API密钥已被禁用'
            }), 403

        # 更新最后使用时间
        from datetime import datetime
        key_obj.last_used_at = datetime.utcnow()
        db.session.commit()

        # 将密钥对象传递给视图函数
        return f(key_obj=key_obj, *args, **kwargs)

    return decorated_function


@asr_bp.route('/api/asr/offline', methods=['POST'])
@verify_api_key
def asr_offline(key_obj):
    """
    转发非实时ASR潮汕话翻译接口

    请求方式: POST
    Content-Type: multipart/form-data

    参数:
    - file: 音频文件 (支持 wav, mp3, m4a 等格式)

    返回:
    {
        "status": "success",
        "text": "识别的文本内容",
        "duration": 音频时长(秒),
        "filename": "文件名"
    }
    """
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'message': '未找到上传的音频文件'
            }), 400

        file = request.files['file']

        # 检查文件名是否为空
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': '文件名为空'
            }), 400

        # 准备转发请求
        url = f'{ASR_SERVICE_URL}/asr/offline'

        # 准备文件和数据
        files = {'file': (file.filename, file.stream, file.content_type)}

        logger.info(f"转发ASR请求到: {url}, 文件: {file.filename}")

        # 转发请求到ASR服务
        response = requests.post(
            url,
            files=files,
            timeout=60  # 60秒超时，因为音频处理可能需要较长时间
        )

        # 返回ASR服务的结果
        return jsonify(response.json()), response.status_code

    except requests.exceptions.Timeout:
        logger.error(f"ASR服务请求超时: {url}")
        return jsonify({
            'status': 'error',
            'message': 'ASR服务请求超时，请稍后重试'
        }), 504
    except requests.exceptions.ConnectionError:
        logger.error(f"无法连接到ASR服务: {url}")
        return jsonify({
            'status': 'error',
            'message': '无法连接到ASR服务，请确认服务是否正常运行'
        }), 503
    except Exception as e:
        logger.error(f"ASR转发请求失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'识别失败: {str(e)}'
        }), 500


@asr_bp.route('/api/asr/health', methods=['GET'])
@verify_api_key
def asr_health(key_obj):
    """
    转发ASR服务状态检查接口

    请求方式: GET

    返回:
    {
        "status": "healthy" | "unhealthy",
        "model_loaded": true | false,
        "model_paths_valid": true | false,
        "active_clients": 活跃客户端数量,
        "model_info": {
            "asr_model": "ASR模型路径",
            "vad_model": "VAD模型路径",
            "punc_model": "标点模型路径"
        }
    }
    """
    try:
        url = f'{ASR_SERVICE_URL}/health'

        logger.info(f"转发ASR健康检查请求到: {url}")

        # 转发请求到ASR服务
        response = requests.get(
            url,
            timeout=10  # 10秒超时
        )

        # 返回ASR服务的结果
        return jsonify(response.json()), response.status_code

    except requests.exceptions.Timeout:
        logger.error(f"ASR健康检查请求超时: {url}")
        return jsonify({
            'status': 'error',
            'message': 'ASR服务健康检查超时'
        }), 504
    except requests.exceptions.ConnectionError:
        logger.error(f"无法连接到ASR服务: {url}")
        return jsonify({
            'status': 'unhealthy',
            'message': '无法连接到ASR服务'
        }), 503
    except Exception as e:
        logger.error(f"ASR健康检查失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'健康检查失败: {str(e)}'
        }), 500
