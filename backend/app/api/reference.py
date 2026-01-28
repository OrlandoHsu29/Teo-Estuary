"""参考话语API蓝图"""
from flask import Blueprint, jsonify, request
import logging
from sqlalchemy.exc import IntegrityError
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app import db
from app.models import ReferenceText

reference_bp = Blueprint('reference', __name__)
logger = logging.getLogger(__name__)


@reference_bp.route('/api/reference-text', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=5, daily_limit=10)
def api_add_reference_text(key_obj):
    """接收话语数组并逐条存入数据库

    请求体示例:
    {
        "discourse": [
            "我说胖子，你昨晚是不是又把闹钟按掉了？",
            "哎呀瘦子，我那是给它放个假，它天天响也累啊。"
        ]
    }

    返回:
    {
        "success": true,
        "message": "成功添加N条话语",
        "count": 2,
        "total_count": 150  # 数据库中总话语数
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'error': '请求体不能为空'
            }), 400

        discourse_list = data.get('discourse', [])

        if not isinstance(discourse_list, list):
            return jsonify({
                'success': False,
                'error': 'discourse字段必须是数组'
            }), 400

        if not discourse_list:
            return jsonify({
                'success': False,
                'error': 'discourse数组不能为空'
            }), 400

        # 逐条添加话语到数据库
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

            # 检查是否已存在（避免重复）
            exists = ReferenceText.query.filter_by(discourse=discourse).first()
            if exists:
                logger.info(f"话语已存在，跳过: {discourse}")
                skipped_count += 1
                continue

            # 创建新记录
            try:
                ref_text = ReferenceText(discourse=discourse)
                db.session.add(ref_text)
                db.session.flush()  # 立即执行以捕获唯一约束冲突
                added_count += 1
            except IntegrityError:
                # 并发情况下可能被其他请求插入，跳过即可
                db.session.rollback()
                logger.info(f"话语重复，跳过: {discourse}")
                skipped_count += 1
                continue

        # 提交数据库事务
        db.session.commit()

        # 获取数据库中总话语数
        total_count = ReferenceText.query.count()

        logger.info(f"成功添加 {added_count} 条话语，跳过 {skipped_count} 条，总计 {total_count} 条")

        return jsonify({
            'success': True,
            'message': f'成功添加{added_count}条话语，跳过{skipped_count}条重复',
            'count': added_count,
            'skipped': skipped_count,
            'total_count': total_count
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"添加参考话语失败: {e}")
        return jsonify({
            'success': False,
            'error': '添加话语失败，请重试'
        }), 500


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
    """随机获取一条参考话语

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

        # 使用随机偏移量获取随机记录
        total = ReferenceText.query.count()
        if total == 0:
            return jsonify({
                'success': True,
                'data': [],
                'message': '数据库中暂无话语数据'
            })

        results = []
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

        return jsonify({
            'success': True,
            'data': results
        })

    except Exception as e:
        logger.error(f"获取随机参考话语失败: {e}")
        return jsonify({
            'success': False,
            'error': '获取随机话语失败，请重试'
        }), 500
