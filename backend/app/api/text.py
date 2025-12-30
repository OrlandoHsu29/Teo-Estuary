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


@text_bp.route('/api/validate-key', methods=['GET'])
@api_key_required_with_rate_limit(hourly_limit=500, daily_limit=5000)
def api_validate_key(key_obj):
    """验证API密钥是否有效"""
    try:
        # 如果能到这里，说明密钥已经通过验证（装饰器已验证）
        return jsonify({
            'success': True,
            'valid': True,
            'message': '密钥有效'
        }), 200
    except Exception as e:
        logger.error(f"Validate key error: {e}")
        return jsonify({
            'success': False,
            'valid': False,
            'message': '密钥验证失败'
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


@text_bp.route('/api/translate', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=500, daily_limit=2000)
def api_translate(key_obj):
    """双向翻译接口（需要API密钥）"""
    try:
        data = request.get_json()

        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'teochew')  # 'teochew' 或 'mandarin'
        preserve_markers = data.get('preserve_markers', True)  # 是否保留翻译标记

        if not text:
            return jsonify({
                'success': False,
                'error': '文本不能为空'
            }), 400

        # 验证 target_lang 参数
        if target_lang not in ['teochew', 'mandarin']:
            return jsonify({
                'success': False,
                'error': 'target_lang 参数必须是 teochew 或 mandarin'
            }), 400

        # 调用翻译服务
        translated_text = translation_service.translate(
            text=text,
            auto_split=True,
            use_cache=True,
            target_lang=target_lang,
            preserve_markers=preserve_markers
        )

        logger.info(f"API translate: {target_lang}, preserve_markers={preserve_markers}, text={text}")

        return jsonify({
            'success': True,
            'original_text': text,
            'translated_text': translated_text,
            'target_lang': target_lang,
            'preserve_markers': preserve_markers
        })
    except Exception as e:
        logger.error(f"Translate error: {e}")
        return jsonify({
            'success': False,
            'error': '翻译失败，请重试'
        }), 500


@text_bp.route('/admin/api/translate', methods=['POST'])
@admin_required
def admin_api_translate():
    """管理员双向翻译接口（无需API密钥）"""
    try:
        data = request.get_json()

        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'teochew')  # 'teochew' 或 'mandarin'
        preserve_markers = data.get('preserve_markers', True)  # 是否保留翻译标记

        if not text:
            return jsonify({
                'success': False,
                'error': '文本不能为空'
            }), 400

        # 验证 target_lang 参数
        if target_lang not in ['teochew', 'mandarin']:
            return jsonify({
                'success': False,
                'error': 'target_lang 参数必须是 teochew 或 mandarin'
            }), 400

        # 调用翻译服务
        translated_text = translation_service.translate(
            text=text,
            auto_split=True,
            use_cache=True,
            target_lang=target_lang,
            preserve_markers=preserve_markers
        )

        logger.info(f"Admin API translate: {target_lang}, preserve_markers={preserve_markers}, text={text}")

        return jsonify({
            'success': True,
            'original_text': text,
            'translated_text': translated_text,
            'target_lang': target_lang,
            'preserve_markers': preserve_markers
        })
    except Exception as e:
        logger.error(f"Admin translate error: {e}")
        return jsonify({
            'success': False,
            'error': '翻译失败，请重试'
        }), 500