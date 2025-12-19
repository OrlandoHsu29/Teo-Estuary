"""素材提取API蓝图"""
from flask import Blueprint, request, jsonify, current_app
import logging
import os
from datetime import datetime
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app.utils.helpers import generate_id

material_bp = Blueprint('material', __name__)
logger = logging.getLogger(__name__)


@material_bp.route('/api/material/extract', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=100, daily_limit=500)
def api_extract_material(key_obj):
    """素材提取接口
    用于批量导入已有素材，标记为素材提取类型
    """
    try:
        data = request.get_json()

        if not data or 'materials' not in data:
            return jsonify({
                'success': False,
                'error': '缺少素材数据'
            }), 400

        materials = data['materials']
        if not isinstance(materials, list):
            return jsonify({
                'success': False,
                'error': '素材数据必须是数组格式'
            }), 400

        # 批量处理数量限制
        if len(materials) > 100:
            return jsonify({
                'success': False,
                'error': '单次最多处理100条素材'
            }), 400

        from app.models import Recording
        from app import db
        from app.teo_g2p.translation_service import translation_service

        results = []
        success_count = 0
        error_count = 0

        for material in materials:
            try:
                # 验证必填字段
                if 'file_path' not in material or 'text' not in material:
                    results.append({
                        'success': False,
                        'error': '缺少file_path或text字段',
                        'material': material
                    })
                    error_count += 1
                    continue

                file_path = material['file_path']
                original_text = material['text']

                # 验证文本长度
                if len(original_text) > current_app.config['MAX_TEXT_LENGTH']:
                    results.append({
                        'success': False,
                        'error': f'文本长度不能超过 {current_app.config["MAX_TEXT_LENGTH"]} 字符',
                        'material': material
                    })
                    error_count += 1
                    continue

                # 检查文件是否存在
                full_path = os.path.join(current_app.config['DATA_FOLDER'], file_path)
                if not os.path.exists(full_path):
                    results.append({
                        'success': False,
                        'error': f'文件不存在: {file_path}',
                        'material': material
                    })
                    error_count += 1
                    continue

                # 生成ID
                material_id = generate_id()

                # 翻译文本
                actual_content = translation_service.translate_to_oral(original_text, auto_split=True)

                # 创建记录
                recording = Recording(
                    id=material_id,
                    file_path=file_path,
                    original_text=original_text,
                    actual_content=actual_content,
                    upload_time=datetime.now(),
                    file_size=os.path.getsize(full_path),
                    status=material.get('status', 'pending'),  # 可指定状态，默认为pending
                    upload_type=1  # 标记为素材提取
                )

                db.session.add(recording)

                results.append({
                    'success': True,
                    'id': material_id,
                    'material': material
                })
                success_count += 1

            except Exception as e:
                logger.error(f"处理素材失败: {e}, 素材: {material}")
                results.append({
                    'success': False,
                    'error': str(e),
                    'material': material
                })
                error_count += 1

        # 批量提交
        if success_count > 0:
            db.session.commit()

        logger.info(f"素材提取完成: 成功 {success_count} 条, 失败 {error_count} 条")

        return jsonify({
            'success': True,
            'message': f'素材提取完成，成功 {success_count} 条，失败 {error_count} 条',
            'results': results,
            'statistics': {
                'total': len(materials),
                'success': success_count,
                'error': error_count
            }
        })

    except Exception as e:
        logger.error(f"素材提取错误: {e}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': '素材提取失败，请重试'
        }), 500