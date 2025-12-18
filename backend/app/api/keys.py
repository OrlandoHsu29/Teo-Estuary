"""API密钥管理蓝图"""
from flask import Blueprint, request, jsonify
import logging
from app import db
from app.utils.helpers import generate_api_key

keys_bp = Blueprint('keys', __name__)
logger = logging.getLogger(__name__)


@keys_bp.route('/api/keys', methods=['GET'])
def api_list_keys():
    """获取API密钥列表"""
    try:
        from app.models import APIKey

        keys = APIKey.query.order_by(APIKey.created_time.desc()).all()
        return jsonify({
            'success': True,
            'keys': [key.to_dict() for key in keys]
        })
    except Exception as e:
        logger.error(f"List keys error: {e}")
        return jsonify({'error': '获取密钥列表失败'}), 500


@keys_bp.route('/api/keys', methods=['POST'])
def api_create_key():
    """创建新的API密钥"""
    try:
        from app.models import APIKey

        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        max_requests = data.get('max_requests', 1000)

        if not name:
            return jsonify({'error': '密钥名称不能为空'}), 400

        key = APIKey(
            name=name,
            key=generate_api_key(),
            description=description,
            max_requests=max_requests
        )

        db.session.add(key)
        db.session.commit()

        logger.info(f"Created new API key: {key.name}")
        return jsonify({
            'success': True,
            'key': key.to_dict()
        }), 201

    except Exception as e:
        logger.error(f"Create key error: {e}")
        db.session.rollback()
        return jsonify({'error': '创建密钥失败'}), 500


@keys_bp.route('/api/keys/<int:key_id>', methods=['PUT'])
def api_update_key(key_id):
    """更新API密钥"""
    try:
        from app.models import APIKey

        key = APIKey.query.get_or_404(key_id)
        data = request.get_json()

        if 'name' in data:
            key.name = data['name'].strip()
        if 'description' in data:
            key.description = data['description'].strip()
        if 'max_requests' in data:
            key.max_requests = data['max_requests']
        if 'is_active' in data:
            key.is_active = data['is_active']

        db.session.commit()
        return jsonify({
            'success': True,
            'key': key.to_dict()
        })

    except Exception as e:
        logger.error(f"Update key error: {e}")
        db.session.rollback()
        return jsonify({'error': '更新密钥失败'}), 500


@keys_bp.route('/api/keys/<int:key_id>', methods=['DELETE'])
def api_delete_key(key_id):
    """删除API密钥"""
    try:
        from app.models import APIKey

        key = APIKey.query.get_or_404(key_id)
        db.session.delete(key)
        db.session.commit()

        logger.info(f"Deleted API key: {key.name}")
        return jsonify({
            'success': True,
            'message': '密钥已删除'
        })

    except Exception as e:
        logger.error(f"Delete key error: {e}")
        db.session.rollback()
        return jsonify({'error': '删除密钥失败'}), 500


@keys_bp.route('/api/keys/<int:key_id>/toggle', methods=['POST'])
def api_toggle_key_status(key_id):
    """切换API密钥状态"""
    try:
        from app.models import APIKey

        key = APIKey.query.get_or_404(key_id)
        key.is_active = not key.is_active
        db.session.commit()

        status_text = "启用" if key.is_active else "禁用"
        return jsonify({
            'success': True,
            'message': f'密钥已{status_text}',
            'key': key.to_dict()
        })

    except Exception as e:
        logger.error(f"Toggle key status error: {e}")
        db.session.rollback()
        return jsonify({'error': '切换密钥状态失败'}), 500


@keys_bp.route('/api/keys/<int:key_id>/reset-usage', methods=['POST'])
def api_reset_key_usage(key_id):
    """重置API密钥使用次数"""
    try:
        from app.models import APIKey

        key = APIKey.query.get_or_404(key_id)
        key.usage_count = 0
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '使用次数已重置'
        })

    except Exception as e:
        logger.error(f"Reset key usage error: {e}")
        db.session.rollback()
        return jsonify({'error': '重置使用次数失败'}), 500