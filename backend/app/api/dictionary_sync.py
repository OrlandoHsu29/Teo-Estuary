"""
字典同步API蓝图
提供jieba字典同步功能
"""

from flask import Blueprint, request, jsonify
import logging
import traceback
from app.teo_g2p.dao import ChangeLog

# 创建全局实例
_change_logger = ChangeLog()

# 创建蓝图
dictionary_sync_bp = Blueprint('dictionary_sync', __name__, url_prefix='/api/dictionary')

logger = logging.getLogger(__name__)

@dictionary_sync_bp.route('/sync-jieba/<sync_type>', methods=['POST'])
def api_sync_jieba_dictionary(sync_type):
    """
    Jieba字典同步API
    :param sync_type: 同步类型 - 'full' 全量同步, 'incremental' 增量同步
    :return: 同步结果
    """
    try:
        # 验证同步类型
        if sync_type not in ['full', 'incremental']:
            return jsonify({
                'success': False,
                'error': f'无效的同步类型: {sync_type}'
            }), 400

        # 延迟导入以避免循环依赖
        from app.teo_g2p.jieba_sync_service import JiebaSyncService

        # 创建同步服务实例
        sync_service = JiebaSyncService()

        # 执行同步
        if sync_type == 'full':
            logger.info("开始执行jieba字典全量同步")
            result = sync_service.sync_all()
        else:
            logger.info("开始执行jieba字典增量同步")
            result = sync_service.sync_incremental()

        # 记录同步结果
        logger.info(f"Jieba字典{sync_type}同步完成: {result}")

        return jsonify({
            'success': True,
            'sync_type': sync_type,
            'added': result.get('added', 0),
            'updated': result.get('updated', 0),
            'deleted': result.get('deleted', 0),
            'total': result.get('total', 0),
            'message': f'{sync_type}同步成功'
        })

    except ImportError as e:
        logger.error(f"导入jieba同步服务失败: {e}")
        return jsonify({
            'success': False,
            'error': 'jieba同步服务不可用'
        }), 500

    except Exception as e:
        error_msg = f"Jieba字典{sync_type}同步失败: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500

@dictionary_sync_bp.route('/sync-status', methods=['GET'])
def api_get_sync_status():
    """
    获取同步状态
    :return: 当前同步状态信息
    """
    try:
        # 延迟导入
        from app.teo_g2p.jieba_sync_service import JiebaSyncService

        sync_service = JiebaSyncService()
        status = sync_service.validate_sync()

        return jsonify({
            'success': True,
            'sync_status': status
        })

    except ImportError as e:
        logger.error(f"导入jieba同步服务失败: {e}")
        return jsonify({
            'success': False,
            'error': 'jieba同步服务不可用'
        }), 500

    except Exception as e:
        error_msg = f"获取同步状态失败: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500
    
# 测试同步API
@dictionary_sync_bp.route('/test', methods=['GET'])
def api_test_sync():
    """测试同步API"""
    try:
        return jsonify({
            'success': True,
            'message': '同步API正常工作',
            'change_logger_exists': _change_logger is not None,
            'log_file_path': getattr(_change_logger, 'log_file_path', 'N/A')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# 获取未同步的操作日志
@dictionary_sync_bp.route('/unsynced-logs', methods=['GET'])
def api_get_unsynced_logs():
    try:
        raw_logs = _change_logger.get_unsynced_changes()

        # 把logs处理成json格式
        processed_logs = []
        for log in raw_logs:
            # log是字典，不是对象，所以直接访问键
            log_data = {
                'operation': log.get('operation', 'unknown'),
                'timestamp': log.get('timestamp', ''),
                'identifier': log.get('identifier', {}),
                'changes': log.get('changes', {}),
                'variant': log.get('variant', 1)
            }

            processed_logs.append(log_data)

        return jsonify({
            'success': True,
            'logs': processed_logs
        })

    except Exception as e:
        error_msg = f"获取未同步日志失败: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")

        # 如果出现错误，返回空列表而不是失败状态
        return jsonify({
            'success': True,
            'logs': [],
            'message': f'日志读取遇到问题，但系统正常运行: {str(e)}'
        })