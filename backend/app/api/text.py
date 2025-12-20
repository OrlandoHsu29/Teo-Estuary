"""文本生成蓝图"""
from flask import Blueprint, jsonify, current_app, request
import logging
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app.utils.decorators import admin_required
from app.teo_g2p.translation_service import translation_service

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


@text_bp.route('/api/word-variants/<word>', methods=['GET'])
@api_key_required_with_rate_limit(hourly_limit=1000, daily_limit=5000)
def api_get_word_variants(key_obj, word):
    """获取词的所有变体翻译"""
    try:
        variants = translation_service.get_word_variants(word)

        return jsonify({
            'success': True,
            'word': word,
            'variants': variants
        })
    except Exception as e:
        logger.error(f"Get word variants error: {e}")
        return jsonify({
            'success': False,
            'error': '获取变体翻译失败，请重试'
        }), 500


@text_bp.route('/admin/api/word-variants', methods=['POST'])
@admin_required
def admin_api_get_word_variants():
    """管理员获取词的所有变体翻译（无需API密钥）"""
    try:
        data = request.get_json()

        word = data.get('word', '').strip()
        lang = data.get('lang', '').strip()
        variants = translation_service.get_word_variants(word, lang)

        return jsonify({
            'success': True,
            'word': word,
            'variants': variants
        })
    except Exception as e:
        logger.error(f"Get word variants error: {e}")
        return jsonify({
            'success': False,
            'error': '获取变体翻译失败，请重试'
        }), 500