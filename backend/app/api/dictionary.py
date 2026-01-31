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
    """搜索字典词条（支持普通话和潮汕话双向搜索）"""
    try:
        from app.teo_g2p.teo_dict_edit import search_translations
        from app.teo_g2p.database import get_db
        from app.teo_g2p.models import TranslationDict
        from sqlalchemy import or_

        keyword = request.args.get('keyword', '').strip()
        limit = int(request.args.get('limit', 100))
        search_type = request.args.get('search_type', 'mandarin').strip()  # 'mandarin' or 'teochew'

        if not keyword:
            return jsonify({
                'success': False,
                'error': '搜索关键词不能为空'
            }), 400

        # 根据搜索类型执行不同的搜索
        db = next(get_db())

        try:
            if search_type == 'teochew':
                # 搜索潮汕话
                query = db.query(TranslationDict).filter(
                    TranslationDict.teochew_text.like(f'%{keyword}%')
                )
            else:
                # 搜索普通话（默认）
                query = db.query(TranslationDict).filter(
                    TranslationDict.mandarin_text.like(f'%{keyword}%')
                )

            # 显示所有词条（包括已禁用的）
            # 先获取所有结果，然后在Python中排序
            all_results = query.limit(limit * 2).all()  # 多取一些，因为后面会过滤

            # 在Python中进行多级排序
            # 1. 按搜索文本的匹配度排序（完全匹配 > 前缀匹配 > 包含匹配）
            # 2. 按普通话文本长度排序（从短到长）
            # 3. 按潮汕话优先级排序（从低到高）
            # 4. 按变体编号排序（从低到高）
            def sort_key(item):
                mandarin_text = item.mandarin_text
                teochew_text = item.teochew_text

                # 计算匹配度得分（越低越好）
                if search_type == 'teochew':
                    # 搜索潮汕话
                    if teochew_text == keyword:
                        match_score = 0  # 完全匹配
                    elif teochew_text.startswith(keyword):
                        match_score = 1  # 前缀匹配
                    else:
                        match_score = 2  # 包含匹配
                    search_text_length = len(teochew_text)
                    variant_number = getattr(item, 'variant_teochew', 1)
                else:
                    # 搜索普通话
                    if mandarin_text == keyword:
                        match_score = 0  # 完全匹配
                    elif mandarin_text.startswith(keyword):
                        match_score = 1  # 前缀匹配
                    else:
                        match_score = 2  # 包含匹配
                    search_text_length = len(mandarin_text)
                    variant_number = getattr(item, 'variant_mandarin', 1)

                return (
                    match_score,  # 匹配度（越小越好）
                    search_text_length,  # 文本长度（越短越好）
                    item.teochew_priority,  # 优先级（越低越好）
                    variant_number  # 变体编号（越小越好）
                )

            # 排序
            all_results.sort(key=sort_key)

            # 限制结果数量
            results = all_results[:limit]

            # 转换为字典格式
            translations = []
            for item in results:
                translations.append({
                    'id': item.id,
                    'mandarin_text': item.mandarin_text,
                    'teochew_text': item.teochew_text,
                    'variant_mandarin': getattr(item, 'variant_mandarin', 1),
                    'variant_teochew': getattr(item, 'variant_teochew', 1),
                    'teochew_priority': getattr(item, 'teochew_priority', 1),
                    'is_active': item.is_active
                })

            return jsonify({
                'success': True,
                'translations': translations,
                'count': len(translations),
                'keyword': keyword,
                'search_type': search_type
            })

        finally:
            db.close()

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
        from app.teo_g2p.dao import TranslationDictDAO
        from sqlalchemy import exc as sqlalchemy_exc

        data = request.get_json()

        mandarin_text = data.get('mandarin_text', '').strip()
        teochew_text = data.get('teochew_text', '').strip()
        variant_mandarin = data.get('variant_mandarin', 1)
        variant_teochew = data.get('variant_teochew')  # 可选，默认自动计算
        teochew_priority = data.get('teochew_priority')  # 可选，未提供则自动计算
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

        # 验证长度（字词最多10个字符）
        if len(mandarin_text) > 10:
            return jsonify({
                'success': False,
                'error': '普通话词语长度不能超过10个字符'
            }), 400

        if len(teochew_text) > 10:
            return jsonify({
                'success': False,
                'error': '潮语词汇长度不能超过10个字符'
            }), 400

        # 验证优先级（如果提供了的话）
        if teochew_priority is not None and (teochew_priority < 1 or teochew_priority > 10):
            return jsonify({
                'success': False,
                'error': '潮语优先级必须是1-10之间的整数'
            }), 400

        # 自动计算priority：如果未提供，根据潮汕话词语长度设置（1-10整数）
        if teochew_priority is None:
            word_len = len(teochew_text)
            teochew_priority = min(word_len, 10)  # 1字=1, 2字=2, ..., 10字=10，最大不超过10

        # 使用teo_dict_edit的添加功能
        try:
            success = add_translation(
                mandarin_text=mandarin_text,
                teochew_text=teochew_text,
                variant_mandarin=variant_mandarin,
                variant_teochew=variant_teochew,
                teochew_priority=teochew_priority,
                user=user,
                reason=reason
            )

            if success:
                return jsonify({
                    'success': True,
                    'message': '词条添加成功'
                })
            else:
                # 检查是否是已存在的错误
                from app import db
                from app.teo_g2p.models import TranslationDict

                existing = db.session.query(TranslationDict).filter(
                    TranslationDict.mandarin_text == mandarin_text,
                    TranslationDict.teochew_text == teochew_text
                ).first()

                if existing:
                    return jsonify({
                        'success': False,
                        'error': '该普通话和潮汕话组合已存在'
                    }), 400
                else:
                    return jsonify({
                        'success': False,
                        'error': '词条添加失败，请稍后重试'
                    }), 500

        except Exception as e:
            error_str = str(e)
            logger.error(f"Add dictionary error: {e}")

            # 检查是否是数据库只读错误
            if 'readonly database' in error_str.lower():
                return jsonify({
                    'success': False,
                    'error': '数据库只读，无法添加词条。请联系管理员检查数据库文件权限'
                }), 500

            # 检查是否是唯一约束冲突
            if isinstance(e, sqlalchemy_exc.IntegrityError):
                return jsonify({
                    'success': False,
                    'error': '该普通话和潮汕话组合已存在'
                }), 400

            # 其他错误
            return jsonify({
                'success': False,
                'error': f'添加词条失败: {error_str}'
            }), 500

    except Exception as e:
        logger.error(f"Add dictionary error: {e}")
        return jsonify({
            'success': False,
            'error': f'添加词条失败: {str(e)}'
        }), 500


@dictionary_bp.route('/api/dictionary/<int:entry_id>', methods=['PUT'])
def api_update_dictionary(entry_id):
    """更新词条（支持更新内容和状态）"""
    try:
        from app.teo_g2p.teo_dict_edit import update_translation

        data = request.get_json()
        new_mandarin_text = data.get('mandarin_text', '').strip()
        new_teochew_text = data.get('teochew_text', '').strip()
        new_variant_mandarin = data.get('variant_mandarin')
        new_variant_teochew = data.get('variant_teochew')
        new_teochew_priority = data.get('teochew_priority')
        new_is_active = data.get('is_active')
        user = data.get('user', 'admin')
        reason = data.get('reason', '通过管理界面编辑')

        # 验证普通话文本长度（字词最多10个字符）
        if new_mandarin_text and len(new_mandarin_text) > 10:
            return jsonify({
                'success': False,
                'error': '普通话词汇长度不能超过10个字符'
            }), 400

        # 验证潮语文本长度（字词最多10个字符）
        if new_teochew_text and len(new_teochew_text) > 10:
            return jsonify({
                'success': False,
                'error': '潮语词汇长度不能超过10个字符'
            }), 400

        # 验证优先级（如果提供了的话）
        if new_teochew_priority is not None and (new_teochew_priority < 1 or new_teochew_priority > 10):
            return jsonify({
                'success': False,
                'error': '潮语优先级必须是1-10之间的整数'
            }), 400

        # 自动计算priority：如果更新了潮汕话文本且未提供priority，则重新计算
        if new_teochew_text and new_teochew_priority is None:
            word_len = len(new_teochew_text)
            new_teochew_priority = min(word_len, 10)  # 1字=1, 2字=2, ..., 最大10

        # 使用合并后的更新功能，通过entry_id更新记录
        success = update_translation(
            entry_id=entry_id,
            mandarin_text=new_mandarin_text if new_mandarin_text else None,
            teochew_text=new_teochew_text if new_teochew_text else None,
            variant_mandarin=new_variant_mandarin,
            variant_teochew=new_variant_teochew,
            teochew_priority=new_teochew_priority,
            is_active=new_is_active,
            user=user,
            reason=reason
        )

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
            variant_mandarin=entry.variant_mandarin,
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