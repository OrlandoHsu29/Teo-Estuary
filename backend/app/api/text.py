"""文本生成蓝图"""
from flask import Blueprint, jsonify, current_app
import logging
from app.utils.combined_decorators import api_key_required_with_rate_limit

text_bp = Blueprint('text', __name__)
logger = logging.getLogger(__name__)


@text_bp.route('/api/generate-text', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=500, daily_limit=1000)
def api_generate_text(key_obj):
    """生成新的练习文本"""
    try:
        text_generator = current_app.text_generator
        MAX_TEXT_LENGTH = current_app.config['MAX_TEXT_LENGTH']

        text = text_generator.generate_text(use_api_first=bool(current_app.config.get('SILICONFLOW_API_KEY')))

        if text is None:
            logger.error("AI text generation returned None")
            return jsonify({
                'success': False,
                'error': '文本生成失败，请联系管理员检查AI配置'
            }), 500

        if len(text) > MAX_TEXT_LENGTH:
            text = text[:MAX_TEXT_LENGTH]

        logger.info(f"Generated AI text: {text}")

        return jsonify({
            'success': True,
            'text': text
        })
    except Exception as e:
        logger.error(f"Generate text error: {e}")
        return jsonify({
            'success': False,
            'error': '生成文本失败，请重试'
        }), 500