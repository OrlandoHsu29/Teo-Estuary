"""jieba同步API蓝图"""
import os
import json
import logging
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.teo_g2p.jieba_temp_manager import JiebaTempManager
from app.utils.enhanced_change_logger import EnhancedChangeLogger
from app.teo_g2p.unsynced_logs_service import UnsyncedLogsService

jieba_sync_bp = Blueprint('jieba_sync', __name__)
logger = logging.getLogger(__name__)

# 初始化jieba管理器、日志记录器和未同步日志服务
jieba_manager = JiebaTempManager()
change_logger = EnhancedChangeLogger()
unsynced_service = UnsyncedLogsService()


@jieba_sync_bp.route('/api/jieba/sync', methods=['POST'])
@admin_required
def sync_jieba():
    """
    同步jieba词典
    将jieba_cut_temp.txt和jieba_cut_original.txt合并成jieba_cut.txt
    """
    try:
        # 获取变更信息
        changes = jieba_manager.get_word_changes()

        # 执行合并
        success = jieba_manager.merge_files()

        if success:
            # 记录同步操作日志
            sync_items = []

            # 记录新增的词语
            for word in changes['added']:
                sync_items.append({
                    "operation": "add",
                    "word": word,
                    "freq": "100000",
                    "timestamp": datetime.now().isoformat()
                })

            # 记录修改的词语
            for word in changes['modified']:
                sync_items.append({
                    "operation": "update",
                    "word": word,
                    "freq": "100000",
                    "timestamp": datetime.now().isoformat()
                })

            # 记录删除的词语
            for word in changes['deleted']:
                sync_items.append({
                    "operation": "delete",
                    "word": word,
                    "timestamp": datetime.now().isoformat()
                })

            # 记录同步日志
            change_logger.log_sync_operation(
                sync_type="merge",
                items=sync_items,
                status="success"
            )

            # 注释：不清空临时文件，保留数据用于后续同步
            # jieba_manager.clear_temp_file()

            logger.info(f"jieba同步成功: 新增{len(changes['added'])}, 修改{len(changes['modified'])}, 删除{len(changes['deleted'])}")

            return jsonify({
                'success': True,
                'message': 'jieba词典同步成功',
                'stats': {
                    'added': len(changes['added']),
                    'modified': len(changes['modified']),
                    'deleted': len(changes['deleted']),
                    'total_changes': len(sync_items)
                }
            })
        else:
            # 记录失败日志
            change_logger.log_sync_operation(
                sync_type="merge",
                items=[],
                status="failed",
                error_msg="合并文件失败"
            )

            return jsonify({
                'success': False,
                'error': 'jieba词典同步失败'
            }), 500

    except Exception as e:
        logger.error(f"jieba同步错误: {e}")

        # 记录失败日志
        change_logger.log_sync_operation(
            sync_type="merge",
            items=[],
            status="failed",
            error_msg=str(e)
        )

        return jsonify({
            'success': False,
            'error': '同步过程中发生错误'
        }), 500


@jieba_sync_bp.route('/api/jieba/sync/status', methods=['GET'])
@admin_required
def get_sync_status():
    """
    获取同步状态
    检查是否有未同步的更改
    """
    try:
        # 使用新的同步状态判断逻辑
        is_sync_needed = unsynced_service.is_sync_needed()
        latest_sync_time = unsynced_service.get_latest_sync_time()

        # 获取排除属性更新后的未同步操作日志数量
        unsynced_count = unsynced_service.get_unsynced_count()

        # 获取临时文件的变更统计（仅作为参考）
        changes = jieba_manager.get_word_changes()

        return jsonify({
            'success': True,
            'sync_needed': is_sync_needed,
            'latest_sync_time': latest_sync_time.isoformat() if latest_sync_time != datetime.min else None,
            'unsynced_logs_count': unsynced_count,
            'pending_changes': {
                'added': len(changes['added']),
                'modified': len(changes['modified']),
                'deleted': len(changes['deleted']),
                'total': len(changes['added']) + len(changes['modified']) + len(changes['deleted'])
            }
        })

    except Exception as e:
        logger.error(f"获取同步状态错误: {e}")
        return jsonify({
            'success': False,
            'error': '获取同步状态失败'
        }), 500


@jieba_sync_bp.route('/api/jieba/changes', methods=['GET'])
@admin_required
def get_pending_changes():
    """
    获取待同步的变更详情
    返回所有比最新同步时间晚的数据库变更记录（排除属性更新）
    """
    try:
        # 获取未同步的操作日志（排除属性更新）
        unsynced_logs = unsynced_service.get_unsynced_logs(exclude_property_updates=True)

        return jsonify({
            'success': True,
            'logs': unsynced_logs,
            'total_changes': len(unsynced_logs)
        })

    except Exception as e:
        logger.error(f"获取待同步变更错误: {e}")
        return jsonify({
            'success': False,
            'error': '获取待同步变更失败'
        }), 500


@jieba_sync_bp.route('/api/jieba/temp/words', methods=['GET'])
@admin_required
def get_temp_words():
    """
    获取临时文件中的词语列表
    """
    try:
        words = jieba_manager.load_temp_words()

        return jsonify({
            'success': True,
            'words': words,
            'count': len(words)
        })

    except Exception as e:
        logger.error(f"获取临时文件词语错误: {e}")
        return jsonify({
            'success': False,
            'error': '获取临时文件词语失败'
        }), 500


@jieba_sync_bp.route('/api/jieba/temp/clear', methods=['POST'])
@admin_required
def clear_temp_file():
    """
    清空临时文件
    """
    try:
        success = jieba_manager.clear_temp_file()

        if success:
            # 记录清空操作日志
            change_logger.log_sync_operation(
                sync_type="clear",
                items=[],
                status="success"
            )

            return jsonify({
                'success': True,
                'message': '临时文件已清空'
            })
        else:
            # 记录失败日志
            change_logger.log_sync_operation(
                sync_type="clear",
                items=[],
                status="failed",
                error_msg="清空临时文件失败"
            )

            return jsonify({
                'success': False,
                'error': '清空临时文件失败'
            }), 500

    except Exception as e:
        logger.error(f"清空临时文件错误: {e}")

        # 记录失败日志
        change_logger.log_sync_operation(
            sync_type="clear",
            items=[],
            status="failed",
            error_msg=str(e)
        )

        return jsonify({
            'success': False,
            'error': '清空临时文件时发生错误'
        }), 500


@jieba_sync_bp.route('/api/jieba/logs', methods=['GET'])
@admin_required
def get_all_logs():
    """
    获取完整的操作日志（支持分页）

    Query Parameters:
    - page: 页码（从1开始，默认1）
    - per_page: 每页数量（默认50，最大200）

    Returns:
        分页的操作日志列表
    """
    try:
        # 获取分页参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        # 限制每页最大数量
        per_page = min(per_page, 200)

        # 读取日志文件
        log_file_path = change_logger.log_file_path
        all_logs = []

        if os.path.exists(log_file_path):
            try:
                with open(log_file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if line.strip():
                            try:
                                log_entry = json.loads(line.strip())
                                # 添加行号便于定位
                                log_entry['line_number'] = line_num
                                all_logs.append(log_entry)
                            except json.JSONDecodeError as e:
                                logger.warning(f"解析日志第{line_num}行失败: {e}")
                                continue
            except Exception as e:
                logger.error(f"读取日志文件失败: {e}")
                return jsonify({
                    'success': False,
                    'error': '读取日志文件失败'
                }), 500

        # 按时间戳倒序排列（最新的在上面）
        all_logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        # 计算分页
        total_logs = len(all_logs)
        total_pages = (total_logs + per_page - 1) // per_page

        # 确保页码在有效范围内
        page = max(1, min(page, max(1, total_pages)))

        # 计算当前页的起始和结束索引
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        current_page_logs = all_logs[start_index:end_index]

        return jsonify({
            'success': True,
            'logs': current_page_logs,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_logs': total_logs,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            }
        })

    except Exception as e:
        logger.error(f"获取操作日志错误: {e}")
        return jsonify({
            'success': False,
            'error': '获取操作日志失败'
        }), 500