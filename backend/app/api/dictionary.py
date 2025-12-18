"""潮语字典管理API蓝图 - 直接使用主数据库"""
from flask import Blueprint, request, jsonify
import logging

# 创建蓝图
dictionary_bp = Blueprint('dictionary', __name__)
logger = logging.getLogger(__name__)


@dictionary_bp.route('/api/dictionary/test', methods=['GET'])
def api_test_dictionary():
    """测试接口"""
    return jsonify({
        'success': True,
        'message': '字典API正常工作'
    })


@dictionary_bp.route('/api/dictionary/search', methods=['GET'])
def api_search_dictionary():
    """搜索字典词条"""
    try:
        from app.teo_g2p.teo_dict_edit import search_translations

        keyword = request.args.get('keyword', '').strip()
        limit = int(request.args.get('limit', 100))

        if not keyword:
            return jsonify({
                'success': False,
                'error': '搜索关键词不能为空'
            }), 400

        # 使用teo_dict_edit的搜索功能，支持普通话和潮语双向搜索
        results = search_translations(keyword, limit)

        # 转换为字典格式
        translations = []
        for item in results:
            translations.append({
                'id': item.id,
                'mandarin_text': item.mandarin_text,
                'teochew_text': item.teochew_text,
                'variant': item.variant,
                'priority': item.priority,
                'word_length': item.word_length,
                'is_active': item.is_active
            })

        return jsonify({
            'success': True,
            'translations': translations,
            'count': len(translations),
            'keyword': keyword
        })

    except Exception as e:
        logger.error(f"Search dictionary error: {e}")
        return jsonify({
            'success': False,
            'error': f'搜索失败: {str(e)}'
        }), 500


@dictionary_bp.route('/api/dictionary', methods=['POST'])
def api_add_dictionary():
    """添加新词条"""
    try:
        from app.teo_g2p.teo_dict_edit import add_translation

        data = request.get_json()

        mandarin_text = data.get('mandarin_text', '').strip()
        teochew_text = data.get('teochew_text', '').strip()
        variant = data.get('variant', 1)
        priority = data.get('priority', 1.0)
        user = data.get('user', 'admin')
        reason = data.get('reason', '通过管理界面添加')

        # 验证必填字段
        if not mandarin_text:
            return jsonify({
                'success': False,
                'error': '普通话词语不能为空'
            }), 400

        if not teochew_text:
            return jsonify({
                'success': False,
                'error': '潮语词汇不能为空'
            }), 400

        # 使用teo_dict_edit的添加功能
        success = add_translation(
            mandarin_text=mandarin_text,
            teochew_text=teochew_text,
            variant=variant,
            priority=priority,
            user=user,
            reason=reason
        )

        if success:
            return jsonify({
                'success': True,
                'message': '词条添加成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '词条添加失败，可能已存在相同词语和变体'
            }), 400

    except Exception as e:
        logger.error(f"Add dictionary error: {e}")
        return jsonify({
            'success': False,
            'error': f'添加词条失败: {str(e)}'
        }), 500


@dictionary_bp.route('/api/dictionary/<int:entry_id>', methods=['PUT'])
def api_update_dictionary(entry_id):
    """更新词条"""
    try:
        from app.teo_g2p.teo_dict_edit import update_translation
        from app.teo_g2p.dao import TranslationDictDAO

        # 使用DAO模式获取现有词条信息
        dao = TranslationDictDAO()
        entry = dao.get_translation_by_id(entry_id)
        if not entry:
            return jsonify({
                'success': False,
                'error': '未找到指定词条'
            }), 404

        data = request.get_json()
        new_teochew_text = data.get('teochew_text', '').strip()
        new_variant = data.get('variant')
        new_priority = data.get('priority')
        new_is_active = data.get('is_active')
        user = data.get('user', 'admin')
        reason = data.get('reason', '通过管理界面编辑')

        # 使用teo_dict_edit的更新功能
        success = update_translation(
            mandarin_text=entry.mandarin_text,
            teochew_text=new_teochew_text if new_teochew_text else None,
            variant=new_variant,
            priority=new_priority,
            user=user,
            reason=reason
        )

        # 如果需要更新状态，使用DAO直接操作数据库
        if success and new_is_active is not None:
            success = dao.update_translation_status(entry_id, new_is_active, user, reason)

        if success:
            return jsonify({
                'success': True,
                'message': '词条更新成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '词条更新失败'
            }), 400

    except Exception as e:
        logger.error(f"Update dictionary error: {e}")
        return jsonify({
            'success': False,
            'error': f'更新词条失败: {str(e)}'
        }), 500


@dictionary_bp.route('/api/dictionary/<int:entry_id>', methods=['DELETE'])
def api_delete_dictionary(entry_id):
    """删除词条（软删除）"""
    try:
        from app.teo_g2p.teo_dict_edit import delete_translation
        from app.teo_g2p.dao import TranslationDictDAO

        # 使用DAO模式获取词条信息
        dao = TranslationDictDAO()
        entry = dao.get_translation_by_id(entry_id)
        if not entry:
            return jsonify({
                'success': False,
                'error': '未找到指定词条'
            }), 404

        user = request.args.get('user', 'admin')
        reason = request.args.get('reason', '通过管理界面删除')

        # 使用teo_dict_edit的删除功能（软删除）
        success = delete_translation(
            mandarin_text=entry.mandarin_text,
            variant=entry.variant,
            user=user,
            reason=reason
        )

        if success:
            return jsonify({
                'success': True,
                'message': '词条删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'error': '词条删除失败'
            }), 400

    except Exception as e:
        logger.error(f"Delete dictionary error: {e}")
        return jsonify({
            'success': False,
            'error': f'删除词条失败: {str(e)}'
        }), 500


@dictionary_bp.route('/api/dictionary/stats', methods=['GET'])
def api_get_stats():
    """获取字典统计信息"""
    try:
        from app.teo_g2p.dao import TranslationDictDAO
        from app.teo_g2p.models import TranslationDict
        from app.teo_g2p.database import get_db

        # 获取所有条目（包括激活和非激活的）来计算统计信息
        db = next(get_db())
        try:
            total_count = db.query(TranslationDict).count()
            active_count = db.query(TranslationDict).filter_by(is_active=1).count()
            inactive_count = total_count - active_count

            return jsonify({
                'success': True,
                'stats': {
                    'total_entries': total_count,
                    'active_entries': active_count,
                    'inactive_entries': inactive_count
                }
            })
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Get stats error: {e}")
        return jsonify({
            'success': False,
            'error': f'获取统计信息失败: {str(e)}'
        }), 500