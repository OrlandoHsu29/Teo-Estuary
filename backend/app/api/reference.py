"""参考话语API蓝图"""
from flask import Blueprint, jsonify, request, current_app
import logging
import requests
import json
from sqlalchemy.exc import IntegrityError
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app.utils.decorators import admin_required
from app import db
from app.models import ReferenceText, GenerationTask

reference_bp = Blueprint('reference', __name__)
logger = logging.getLogger(__name__)


@reference_bp.route('/api/reference-text', methods=['GET'])
@api_key_required_with_rate_limit(hourly_limit=100, daily_limit=500)
def api_get_reference_text(key_obj):
    """获取参考话语列表

    查询参数:
    - limit: 返回数量限制，默认100
    - offset: 偏移量，默认0

    返回:
    {
        "success": true,
        "data": [...],
        "total": 150,
        "limit": 100,
        "offset": 0
    }
    """
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)

        # 限制最大返回数量
        limit = min(limit, 1000)

        # 查询话语
        query = ReferenceText.query.order_by(ReferenceText.id.desc())
        total = query.count()
        items = query.offset(offset).limit(limit).all()

        return jsonify({
            'success': True,
            'data': [item.to_dict() for item in items],
            'total': total,
            'limit': limit,
            'offset': offset
        })

    except Exception as e:
        logger.error(f"获取参考话语失败: {e}")
        return jsonify({
            'success': False,
            'error': '获取话语失败，请重试'
        }), 500


@reference_bp.route('/api/reference-text/random', methods=['GET'])
@api_key_required_with_rate_limit(hourly_limit=50, daily_limit=200)
def api_get_random_reference_text(key_obj):
    """随机获取一条参考话语（获取后自动删除，一次性使用）

    如果数据库中没有数据，会自动触发生成

    查询参数:
    - count: 获取数量，默认1，最多10条

    返回:
    {
        "success": true,
        "data": [...]
    }
    """
    try:
        import random

        count = request.args.get('count', 1, type=int)
        count = min(max(count, 1), 10)  # 限制在1-10之间

        # 检查数据库中是否有数据
        total = ReferenceText.query.count()

        # 如果没有数据，自动触发生成
        if total == 0:
            logger.info("数据库中暂无参考文本数据，自动触发生成")
            success, task, error_message = _trigger_dify_generation()

            if not success:
                return jsonify({
                    'success': False,
                    'error': f'数据库暂无数据，自动生成失败: {error_message}'
                }), 503  # 503 Service Unavailable

            return jsonify({
                'success': True,
                'data': [],
                'message': f'数据库中暂无参考文本数据，正在自动填充，请稍后再试',
                'task_id': task.id
            })

        # 使用随机偏移量获取随机记录
        results = []
        item_ids = []
        used_indices = set()

        for _ in range(count):
            if len(used_indices) >= total:
                break

            # 随机选择一个未使用的索引
            while True:
                random_offset = random.randint(0, total - 1)
                if random_offset not in used_indices:
                    used_indices.add(random_offset)
                    break

            item = ReferenceText.query.offset(random_offset).first()
            if item:
                results.append(item.to_dict())
                item_ids.append(item.id)

        # 删除已获取的记录（一次性使用）
        if item_ids:
            ReferenceText.query.filter(ReferenceText.id.in_(item_ids)).delete(synchronize_session=False)
            db.session.commit()
            logger.info(f"已删除 {len(item_ids)} 条已使用的参考话语")

        return jsonify({
            'success': True,
            'data': results
        })

    except Exception as e:
        logger.error(f"获取随机参考话语失败: {e}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': '获取随机话语失败，请重试'
        }), 500


def _trigger_dify_generation():
    """触发Dify生成参考文本的核心逻辑

    Returns:
        (success: bool, task: GenerationTask or None, error_message: str or None)
    """
    webhook_url = current_app.config.get('DIFY_WEBHOOK_URL')
    if not webhook_url:
        return False, None, 'Dify Webhook URL未配置'

    # 检查是否有正在处理中的任务
    processing_task = GenerationTask.query.filter_by(status='processing').first()
    if processing_task:
        logger.info(f"已有正在处理中的任务: {processing_task.id}")
        return True, processing_task, None

    # 创建新任务
    task = GenerationTask(status='processing')
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    # 同步调用Dify Webhook
    data = {
        'task_id': task_id
    }
    headers = {
        'Content-Type': 'application/json'
    }

    logger.info(f"触发Dify Webhook: {webhook_url}, 任务ID: {task_id}")

    try:
        response = requests.post(webhook_url, json=data, headers=headers, timeout=30)
        logger.info(f"Dify Webhook响应状态码: {response.status_code}, 任务ID: {task_id}")

        if response.status_code not in [200, 201]:
            # Dify调用失败，删除任务并返回错误
            db.session.delete(task)
            db.session.commit()
            logger.error(f"Dify Webhook调用失败: {response.status_code}")
            return False, None, f'Dify服务返回错误: HTTP {response.status_code}'

    except Exception as e:
        # Dify调用失败，删除任务并返回错误
        db.session.delete(task)
        db.session.commit()
        logger.error(f"Dify Webhook调用异常: {e}")
        return False, None, f'调用Dify服务失败: {str(e)}'

    logger.info(f"Dify Webhook触发成功, 任务ID: {task_id}")
    return True, task, None


@reference_bp.route('/api/reference-text/generate', methods=['GET'])
@admin_required
def api_generate_reference_text():
    """触发生成参考文本的异步任务（需要管理员权限）

    此接口会先调用Dify Webhook，成功后再创建任务

    如果存在正在处理中的任务，则不会创建新任务

    返回:
    {
        "success": true,
        "message": "正在生成参考文本",
        "task": {...}
    }
    """
    try:
        success, task, error_message = _trigger_dify_generation()

        if not success:
            return jsonify({
                'success': False,
                'error': error_message
            }), 500

        return jsonify({
            'success': True,
            'message': '正在生成参考文本',
            'task': task.to_dict()
        })

    except Exception as e:
        logger.error(f"生成参考文本失败: {e}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': '生成参考文本失败，请重试'
        }), 500


@reference_bp.route('/api/reference-text/task/<int:task_id>', methods=['GET'])
@api_key_required_with_rate_limit(hourly_limit=100, daily_limit=500)
def api_get_task_status(key_obj, task_id):
    """查询任务状态

    Args:
        task_id: 任务ID

    返回:
    {
        "success": true,
        "task": {...}
    }
    """
    try:
        task = GenerationTask.query.get(task_id)
        if not task:
            return jsonify({
                'success': False,
                'error': '任务不存在'
            }), 404

        return jsonify({
            'success': True,
            'task': task.to_dict()
        })

    except Exception as e:
        logger.error(f"查询任务状态失败: {e}")
        return jsonify({
            'success': False,
            'error': '查询任务状态失败，请重试'
        }), 500


@reference_bp.route('/api/reference-text/task/<int:task_id>', methods=['PUT'])
def api_update_task_status(task_id):
    """更新任务状态（Webhook接口，供Dify后端回调调用）

    Dify处理完参考文本生成后，会调用此接口更新任务状态

    请求头:
        X-Webhook-Key: your-webhook-key

    请求体:
    {
        "status": "completed",  // completed, failed
        "result": "...",  // 可选，生成结果
        "error_message": "..."  // 可选，错误信息
    }

    返回:
    {
        "success": true,
        "message": "任务状态已更新"
    }
    """
    try:
        # 验证webhook密钥（从请求头获取）
        webhook_key = request.headers.get('X-Webhook-Key', '')
        expected_key = current_app.config.get('WEBHOOK_KEY', '')

        if not expected_key:
            logger.error("WEBHOOK_KEY未配置")
            return jsonify({
                'success': False,
                'error': '服务器配置错误'
            }), 500

        if webhook_key != expected_key:
            logger.warning(f"Webhook密钥验证失败: {webhook_key}")
            return jsonify({
                'success': False,
                'error': '认证失败'
            }), 401

        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '请求体不能为空'
            }), 400

        # 查找任务
        task = GenerationTask.query.get(task_id)
        if not task:
            return jsonify({
                'success': False,
                'error': '任务不存在'
            }), 404

        # 只允许更新processing状态的任务
        if task.status != 'processing':
            return jsonify({
                'success': False,
                'error': f'任务状态为 {task.status}，无法更新'
            }), 400

        # 更新任务状态
        new_status = data.get('status', 'completed')
        if new_status not in ['completed', 'failed']:
            return jsonify({
                'success': False,
                'error': '状态必须是 completed 或 failed'
            }), 400

        task.status = new_status
        task.result = data.get('result', task.result)
        task.error_message = data.get('error_message', task.error_message)

        if new_status in ['completed', 'failed']:
            from app.utils.timezone import now
            task.completed_time = now()

        db.session.commit()

        # 如果任务完成且包含生成的话语，自动存入数据库
        if new_status == 'completed' and task.result:
            try:
                # 尝试解析result为话语数组
                discourse_list = None

                # 如果result是JSON字符串，尝试解析
                if isinstance(task.result, str):
                    try:
                        parsed = json.loads(task.result)
                        # 检查是否包含话语字段
                        if isinstance(parsed, dict):
                            discourse_list = parsed.get('discourse') or parsed.get('texts') or parsed.get('data')
                        elif isinstance(parsed, list):
                            discourse_list = parsed
                    except json.JSONDecodeError:
                        # 如果不是JSON，可能就是普通文本，按换行符分割
                        discourse_list = task.result.split('\n')

                # 处理话语列表
                if discourse_list and isinstance(discourse_list, list):
                    added_count = 0
                    skipped_count = 0

                    for discourse in discourse_list:
                        discourse = str(discourse).strip()

                        # 跳过空字符串
                        if not discourse:
                            skipped_count += 1
                            continue

                        # 限制长度为100字符
                        if len(discourse) > 100:
                            discourse = discourse[:100]
                            logger.warning(f"话语超过100字符，已截断: {discourse}")

                        # 检查是否已存在
                        exists = ReferenceText.query.filter_by(discourse=discourse).first()
                        if exists:
                            skipped_count += 1
                            continue

                        # 创建新记录
                        try:
                            ref_text = ReferenceText(discourse=discourse)
                            db.session.add(ref_text)
                            db.session.flush()
                            added_count += 1
                        except IntegrityError:
                            db.session.rollback()
                            skipped_count += 1
                            continue

                    db.session.commit()
                    logger.info(f"任务 {task_id} 完成，自动添加 {added_count} 条话语，跳过 {skipped_count} 条")

            except Exception as import_error:
                logger.error(f"导入话语到数据库失败: {import_error}")
                # 不影响任务状态的更新，只记录错误

        logger.info(f"任务 {task_id} 状态已更新为: {new_status}")

        return jsonify({
            'success': True,
            'message': '任务状态已更新',
            'task': task.to_dict()
        })

    except Exception as e:
        logger.error(f"更新任务状态失败: {e}")
        db.session.rollback()

        # 将任务标记为失败
        try:
            task = GenerationTask.query.get(task_id)
            if task and task.status == 'processing':
                task.status = 'failed'
                task.error_message = f"更新异常: {str(e)}"
                from app.utils.timezone import now
                task.completed_time = now()
                db.session.commit()
                logger.info(f"任务 {task_id} 已标记为失败")
        except Exception as update_error:
            logger.error(f"标记任务状态失败时出错: {update_error}")
            db.session.rollback()

        return jsonify({
            'success': False,
            'error': '更新任务状态失败，请重试'
        }), 500
