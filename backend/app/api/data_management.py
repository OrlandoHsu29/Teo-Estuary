"""数据管理蓝图（导入/导出）"""
import io
import json
import os
import zipfile
from datetime import datetime
from flask import Blueprint, jsonify, Response, request, send_from_directory

import logging
from app.utils.decorators import admin_required
from app.utils.datetime_utils import now_utc, now_utc_isoformat, now_beijing_str
from app.teo_g2p.dao import ChangeLog
from app.teo_g2p.jieba_temp_manager import JiebaTempManager

data_management_bp = Blueprint('data_management', __name__)
logger = logging.getLogger(__name__)


@data_management_bp.route('/admin/api/export/train-dataset', methods=['GET'])
@admin_required
def export_train_dataset():
    """导出模型训练数据集（压缩包）"""
    try:
        from app.models import Recording

        # 查询所有approved状态的记录
        approved_recordings = Recording.query.filter_by(status='approved').all()

        if not approved_recordings:
            return jsonify({'error': '没有已通过审核的数据'}), 404

        # 在内存中创建压缩包
        memory_file = io.BytesIO()

        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 创建train_text.txt内容
            train_text_lines = []
            for recording in approved_recordings:
                if recording.teochew_text:
                    train_text_lines.append(f"{recording.id} {recording.teochew_text}")

            train_text_content = '\n'.join(train_text_lines)
            zf.writestr('train_text.txt', train_text_content)

            # 创建train_wav.txt内容
            train_wav_lines = []
            for recording in approved_recordings:
                if recording.file_path:
                    train_wav_lines.append(f"{recording.id} {recording.file_path}")

            train_wav_content = '\n'.join(train_wav_lines)
            zf.writestr('train_wav.txt', train_wav_content)

        memory_file.seek(0)

        logger.info(f"Exported train dataset: {len(approved_recordings)} approved recordings")

        return Response(
            memory_file.getvalue(),
            mimetype='application/zip',
            headers={
                'Content-Disposition': 'attachment; filename=train_dataset.zip'
            }
        )

    except Exception as e:
        logger.error(f"Export train dataset error: {e}")
        return jsonify({'error': '导出失败'}), 500


@data_management_bp.route('/admin/api/export/jieba-dict', methods=['GET'])
@admin_required
def export_jieba_dict():
    """导出Jieba潮汕话适配版词库"""
    try:
        # 使用 JiebaTempManager 获取词库目录
        temp_manager = JiebaTempManager()
        word_dict_dir = os.path.dirname(temp_manager.temp_file_path)
        jieba_dict_path = os.path.join(word_dict_dir, 'jieba_cut.txt')
        jieba_dict_path = os.path.normpath(jieba_dict_path)

        if not os.path.exists(jieba_dict_path):
            logger.error(f"Jieba dictionary file not found: {jieba_dict_path}")
            return jsonify({'error': '词库文件不存在'}), 404

        # 获取目录和文件名
        directory = os.path.dirname(jieba_dict_path)
        filename = os.path.basename(jieba_dict_path)

        logger.info(f"Exporting jieba dictionary: {jieba_dict_path}")

        return send_from_directory(
            directory,
            filename,
            download_name='jieba_cut.txt',
            as_attachment=True
        )

    except Exception as e:
        logger.error(f"Export jieba dictionary error: {e}")
        return jsonify({'error': '导出失败'}), 500


@data_management_bp.route('/admin/api/export/translation-dict', methods=['GET'])
@admin_required
def export_translation_dict():
    """导出翻译词典数据库为JSON格式"""
    try:
        from app.teo_g2p.models import TranslationDict
        from app.teo_g2p.database import get_db

        # 查询所有启用的词条
        db = next(get_db())
        try:
            translations = db.query(TranslationDict).filter_by(is_active=1).all()
        finally:
            db.close()

        # 构建JSON数据
        export_data = {
            'version': '1.0',
            'export_time': now_utc_isoformat(),
            'total_count': len(translations),
            'data': []
        }

        for t in translations:
            export_data['data'].append({
                'mandarin_text': t.mandarin_text,
                'teochew_text': t.teochew_text,
                'variant_mandarin': t.variant_mandarin,
                'variant_teochew': t.variant_teochew,
                'teochew_priority': t.teochew_priority,
                'is_active': t.is_active
            })

        # 生成JSON内容
        json_content = json.dumps(export_data, ensure_ascii=False, indent=2)

        logger.info(f"Exported translation dict: {len(translations)} entries")

        return Response(
            json_content,
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename=translation_dict_{now_beijing_str()}.json'
            }
        )

    except Exception as e:
        logger.error(f"Export translation dict error: {e}")
        return jsonify({'error': '导出失败'}), 500


@data_management_bp.route('/admin/api/export/dict-logs', methods=['GET'])
@admin_required
def export_dict_logs():
    """导出词典操作日志（包含修改日志和同步日志）"""
    try:
        # 使用 ChangeLog 获取日志文件路径
        change_log = ChangeLog()
        log_file_path = os.path.abspath(change_log.log_file_path)
        sync_log_file_path = os.path.abspath(change_log.sync_log_file_path)

        # 在内存中创建压缩包
        memory_file = io.BytesIO()

        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 添加修改日志
            if os.path.exists(log_file_path):
                zf.write(log_file_path, 'database_changes.log')
                logger.info(f"Added database_changes.log to export")
            else:
                # 如果文件不存在，创建空文件
                zf.writestr('database_changes.log', '')
                logger.info(f"Created empty database_changes.log in export")

            # 添加同步日志
            if os.path.exists(sync_log_file_path):
                zf.write(sync_log_file_path, 'database_changes_sync.log')
                logger.info(f"Added database_changes_sync.log to export")
            else:
                # 如果文件不存在，创建空文件
                zf.writestr('database_changes_sync.log', '')
                logger.info(f"Created empty database_changes_sync.log in export")

        memory_file.seek(0)

        logger.info("Exported dict logs package (changes + sync)")

        return Response(
            memory_file.getvalue(),
            mimetype='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename=dict_logs_{now_beijing_str()}.zip'
            }
        )

    except Exception as e:
        logger.error(f"Export dict logs error: {e}", exc_info=True)
        return jsonify({'error': f'导出失败: {str(e)}'}), 500


@data_management_bp.route('/admin/api/export/database-sql', methods=['GET'])
@admin_required
def export_database_json():
    """导出主数据库为JSON格式"""
    try:
        from app.models import Recording, ReferenceText, APIKey, GenerationTask

        # 构建JSON数据
        export_data = {
            'version': '1.0',
            'export_time': now_utc_isoformat(),
            'tables': {
                'recordings': {
                    'count': 0,
                    'data': []
                },
                'reference_text': {
                    'count': 0,
                    'data': []
                },
                'api_keys': {
                    'count': 0,
                    'data': []
                },
                'generation_tasks': {
                    'count': 0,
                    'data': []
                }
            }
        }

        # 导出 recordings 表
        recordings = Recording.query.all()
        export_data['tables']['recordings']['count'] = len(recordings)
        for r in recordings:
            export_data['tables']['recordings']['data'].append({
                'id': r.id,
                'file_path': r.file_path,
                'mandarin_text': r.mandarin_text,
                'teochew_text': r.teochew_text,
                'upload_time': r.upload_time.isoformat() if r.upload_time else None,
                'ip_address': r.ip_address,
                'user_agent': r.user_agent,
                'file_size': r.file_size,
                'duration': r.duration,
                'status': r.status,
                'upload_type': r.upload_type,
                'reviewed_at': r.reviewed_at.isoformat() if r.reviewed_at else None
            })

        # 导出 reference_text 表
        refs = ReferenceText.query.all()
        export_data['tables']['reference_text']['count'] = len(refs)
        for ref in refs:
            export_data['tables']['reference_text']['data'].append({
                'id': ref.id,
                'discourse': ref.discourse,
                'created_time': ref.created_time.isoformat() if ref.created_time else None
            })

        # 导出 api_keys 表
        api_keys = APIKey.query.all()
        export_data['tables']['api_keys']['count'] = len(api_keys)
        for key in api_keys:
            export_data['tables']['api_keys']['data'].append({
                'id': key.id,
                'name': key.name,
                'key': key.key,
                'description': key.description,
                'is_active': key.is_active,
                'created_time': key.created_time.isoformat() if key.created_time else None,
                'last_used': key.last_used.isoformat() if key.last_used else None,
                'usage_count': key.usage_count,
                'max_requests': key.max_requests
            })

        # 导出 generation_tasks 表
        tasks = GenerationTask.query.all()
        export_data['tables']['generation_tasks']['count'] = len(tasks)
        for task in tasks:
            export_data['tables']['generation_tasks']['data'].append({
                'id': task.id,
                'status': task.status,
                'source': task.source,
                'error_message': task.error_message,
                'created_time': task.created_time.isoformat() if task.created_time else None,
                'updated_time': task.updated_time.isoformat() if task.updated_time else None,
                'completed_time': task.completed_time.isoformat() if task.completed_time else None
            })

        # 生成JSON内容
        json_content = json.dumps(export_data, ensure_ascii=False, indent=2)

        logger.info(f"Exported database JSON: {len(recordings)} recordings, {len(refs)} reference texts, {len(api_keys)} API keys, {len(tasks)} tasks")

        return Response(
            json_content,
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename=teo_estuary_database_{now_beijing_str()}.json'
            }
        )

    except Exception as e:
        logger.error(f"Export database JSON error: {e}")
        return jsonify({'error': '导出失败'}), 500


@data_management_bp.route('/admin/api/import/dict-logs', methods=['POST'])
@admin_required
def import_dict_logs():
    """导入词典操作日志（支持增量追加或全量覆盖）"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 获取参数
        log_type = request.form.get('type', 'changes')  # 'changes' 或 'sync'
        import_mode = request.form.get('mode', 'append')  # 'append' 或 'overwrite'

        # 检查文件类型
        if not file.filename.endswith('.log'):
            return jsonify({'error': '只支持.log格式的文件'}), 400

        # 读取日志内容
        try:
            log_content = file.read().decode('utf-8')
        except UnicodeDecodeError:
            return jsonify({'error': '文件编码错误，请确保文件为UTF-8编码'}), 400

        # 使用 ChangeLog 获取日志文件路径
        change_log = ChangeLog()

        # 根据type参数选择目标文件
        target_file = change_log.log_file_path if log_type == 'changes' else change_log.sync_log_file_path

        # 确保目标目录存在
        os.makedirs(os.path.dirname(target_file), exist_ok=True)

        # 根据导入模式选择写入方式
        write_mode = 'w' if import_mode == 'overwrite' else 'a'

        # 处理日志内容
        imported, skipped, errors = _process_log_content(log_content, target_file, write_mode)

        log_type_name = '修改日志' if log_type == 'changes' else '同步日志'
        mode_name = '全量覆盖' if import_mode == 'overwrite' else '增量追加'
        logger.info(f"Imported {log_type_name} ({mode_name}): {imported} imported, {skipped} skipped")

        return jsonify({
            'success': True,
            'message': f'导入完成（{mode_name}）：成功{imported}条，跳过{skipped}条',
            'imported_count': imported,
            'skipped_count': skipped,
            'errors': errors[:10] if errors else []
        })

    except Exception as e:
        logger.error(f"Import dict logs error: {e}", exc_info=True)
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


def _process_log_content(content, target_file_path, write_mode='a'):
    """处理日志内容并写入目标文件

    Args:
        content: 日志内容
        target_file_path: 目标文件路径
        write_mode: 写入模式，'a'为追加（默认），'w'为覆盖
    """
    import json

    imported_count = 0
    skipped_count = 0
    error_lines = []

    # 确保目标目录存在
    os.makedirs(os.path.dirname(target_file_path), exist_ok=True)

    # 根据模式写入日志文件
    with open(target_file_path, write_mode, encoding='utf-8') as f:
        for line in content.strip().split('\n'):
            line = line.strip()
            if not line:
                continue

            try:
                # 验证是否为有效的JSON格式
                log_entry = json.loads(line)

                # 检查必要字段
                if 'timestamp' not in log_entry:
                    skipped_count += 1
                    error_lines.append(f"缺少timestamp字段: {line[:50]}...")
                    continue

                # 写入到日志文件
                f.write(line + '\n')
                imported_count += 1

            except json.JSONDecodeError:
                skipped_count += 1
                error_lines.append(f"JSON格式错误: {line[:50]}...")
                continue
            except Exception as e:
                skipped_count += 1
                error_lines.append(f"处理错误: {str(e)}")
                continue

    return imported_count, skipped_count, error_lines


@data_management_bp.route('/admin/api/import/translation-dict', methods=['POST'])
@admin_required
def import_translation_dict():
    """导入翻译词典JSON文件（支持增量追加或全量覆盖）"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 获取导入模式
        import_mode = request.form.get('mode', 'append')  # 'append' 或 'overwrite'

        # 检查文件类型
        if not file.filename.endswith('.json'):
            return jsonify({'error': '只支持.json格式的文件'}), 400

        # 读取JSON内容
        try:
            json_content = file.read().decode('utf-8')
            import_data = json.loads(json_content)
        except json.JSONDecodeError as e:
            return jsonify({'error': f'JSON格式错误: {str(e)}'}), 400
        except UnicodeDecodeError:
            return jsonify({'error': '文件编码错误，请确保文件为UTF-8编码'}), 400

        # 验证数据结构
        if 'data' not in import_data:
            return jsonify({'error': 'JSON文件格式错误：缺少data字段'}), 400

        from app.teo_g2p.models import TranslationDict
        from app.teo_g2p.database import get_db

        imported_count = 0
        skipped_count = 0
        error_count = 0

        # 获取 SQLite 数据库会话
        db = next(get_db())
        try:
            # 如果是全量覆盖模式，先删除所有现有数据
            if import_mode == 'overwrite':
                try:
                    db.query(TranslationDict).delete()
                    db.commit()
                    logger.info("Cleared all translation dict entries for overwrite import")
                except Exception as e:
                    db.rollback()
                    return jsonify({'error': f'清空现有数据失败: {str(e)}'}), 500

            # 导入数据
            for entry in import_data.get('data', []):
                try:
                    # 验证必填字段
                    if 'mandarin_text' not in entry or 'teochew_text' not in entry:
                        error_count += 1
                        continue

                    mandarin_text = entry['mandarin_text'].strip()
                    teochew_text = entry['teochew_text'].strip()

                    if not mandarin_text or not teochew_text:
                        error_count += 1
                        continue

                    # 检查是否已存在（仅增量模式需要）
                    if import_mode == 'append':
                        existing = db.query(TranslationDict).filter(
                            TranslationDict.mandarin_text == mandarin_text,
                            TranslationDict.teochew_text == teochew_text
                        ).first()

                        if existing:
                            skipped_count += 1
                            continue

                    # 创建新记录
                    new_entry = TranslationDict(
                        mandarin_text=mandarin_text,
                        teochew_text=teochew_text,
                        variant_mandarin=entry.get('variant_mandarin', 1),
                        variant_teochew=entry.get('variant_teochew', 1),
                        teochew_priority=entry.get('teochew_priority', len(teochew_text)),
                        is_active=entry.get('is_active', 1)
                    )

                    db.add(new_entry)
                    imported_count += 1

                except Exception as e:
                    error_count += 1
                    logger.error(f"Error importing translation entry: {e}")
                    continue

            # 提交事务
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Commit failed: {e}")
                return jsonify({'error': f'保存数据失败: {str(e)}'}), 500

            mode_name = '全量覆盖' if import_mode == 'overwrite' else '增量追加'
            logger.info(f"Imported translation dict ({mode_name}): {imported_count} imported, {skipped_count} skipped, {error_count} errors")

            return jsonify({
                'success': True,
                'message': f'导入完成（{mode_name}）：成功{imported_count}条，跳过{skipped_count}条，失败{error_count}条',
                'imported_count': imported_count,
                'skipped_count': skipped_count,
                'error_count': error_count
            })
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Import translation dict error: {e}", exc_info=True)
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


@data_management_bp.route('/admin/api/import/database', methods=['POST'])
@admin_required
def import_database():
    """导入主数据库JSON文件（支持增量追加或全量覆盖）"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 获取导入模式
        import_mode = request.form.get('mode', 'append')  # 'append' 或 'overwrite'

        # 检查文件类型
        if not file.filename.endswith('.json'):
            return jsonify({'error': '只支持.json格式的文件'}), 400

        # 读取JSON内容
        try:
            json_content = file.read().decode('utf-8')
            import_data = json.loads(json_content)
        except json.JSONDecodeError as e:
            return jsonify({'error': f'JSON格式错误: {str(e)}'}), 400
        except UnicodeDecodeError:
            return jsonify({'error': '文件编码错误，请确保文件为UTF-8编码'}), 400

        # 验证数据结构
        if 'tables' not in import_data:
            return jsonify({'error': 'JSON文件格式错误：缺少tables字段'}), 400

        from app.models import Recording, ReferenceText, APIKey, GenerationTask
        from app import db
        from datetime import datetime

        total_imported = 0
        total_skipped = 0
        total_errors = 0

        # 如果是全量覆盖模式，先删除所有现有数据
        if import_mode == 'overwrite':
            try:
                db.session.query(GenerationTask).delete()
                db.session.query(APIKey).delete()
                db.session.query(ReferenceText).delete()
                db.session.query(Recording).delete()
                db.session.commit()
                logger.info("Cleared all database tables for overwrite import")
            except Exception as e:
                db.session.rollback()
                return jsonify({'error': f'清空现有数据失败: {str(e)}'}), 500

        # 导入各个表的数据
        tables = import_data.get('tables', {})

        # 导入 recordings
        if 'recordings' in tables:
            for record in tables['recordings'].get('data', []):
                try:
                    # 检查是否已存在（仅增量模式需要）
                    if import_mode == 'append':
                        existing = db.session.query(Recording).filter_by(id=record['id']).first()
                        if existing:
                            total_skipped += 1
                            continue

                    # 解析日期时间
                    upload_time = datetime.fromisoformat(record['upload_time']) if record.get('upload_time') else None
                    reviewed_at = datetime.fromisoformat(record['reviewed_at']) if record.get('reviewed_at') else None

                    new_record = Recording(
                        id=record['id'],
                        file_path=record.get('file_path', ''),
                        mandarin_text=record.get('mandarin_text', ''),
                        teochew_text=record.get('teochew_text'),
                        upload_time=upload_time,
                        ip_address=record.get('ip_address', ''),
                        user_agent=record.get('user_agent'),
                        file_size=record.get('file_size', 0),
                        duration=record.get('duration', 0.0),
                        status=record.get('status', 'pending'),
                        upload_type=record.get('upload_type', 'single'),
                        reviewed_at=reviewed_at
                    )

                    db.session.add(new_record)
                    total_imported += 1

                except Exception as e:
                    total_errors += 1
                    logger.error(f"Error importing recording: {e}")
                    continue

        # 导入 reference_text
        if 'reference_text' in tables:
            for ref in tables['reference_text'].get('data', []):
                try:
                    if import_mode == 'append':
                        existing = db.session.query(ReferenceText).filter_by(id=ref['id']).first()
                        if existing:
                            total_skipped += 1
                            continue

                    created_time = datetime.fromisoformat(ref['created_time']) if ref.get('created_time') else None

                    new_ref = ReferenceText(
                        id=ref['id'],
                        discourse=ref.get('discourse', ''),
                        created_time=created_time
                    )

                    db.session.add(new_ref)
                    total_imported += 1

                except Exception as e:
                    total_errors += 1
                    logger.error(f"Error importing reference text: {e}")
                    continue

        # 导入 api_keys
        if 'api_keys' in tables:
            for key_data in tables['api_keys'].get('data', []):
                try:
                    if import_mode == 'append':
                        existing = db.session.query(APIKey).filter_by(id=key_data['id']).first()
                        if existing:
                            total_skipped += 1
                            continue

                    created_time = datetime.fromisoformat(key_data['created_time']) if key_data.get('created_time') else None
                    last_used = datetime.fromisoformat(key_data['last_used']) if key_data.get('last_used') else None

                    new_key = APIKey(
                        id=key_data['id'],
                        name=key_data.get('name', ''),
                        key=key_data.get('key', ''),
                        description=key_data.get('description'),
                        is_active=key_data.get('is_active', True),
                        created_time=created_time,
                        last_used=last_used,
                        usage_count=key_data.get('usage_count', 0),
                        max_requests=key_data.get('max_requests', 1000)
                    )

                    db.session.add(new_key)
                    total_imported += 1

                except Exception as e:
                    total_errors += 1
                    logger.error(f"Error importing API key: {e}")
                    continue

        # 导出 generation_tasks
        if 'generation_tasks' in tables:
            for task in tables['generation_tasks'].get('data', []):
                try:
                    if import_mode == 'append':
                        existing = db.session.query(GenerationTask).filter_by(id=task['id']).first()
                        if existing:
                            total_skipped += 1
                            continue

                    created_time = datetime.fromisoformat(task['created_time']) if task.get('created_time') else None
                    updated_time = datetime.fromisoformat(task['updated_time']) if task.get('updated_time') else None
                    completed_time = datetime.fromisoformat(task['completed_time']) if task.get('completed_time') else None

                    new_task = GenerationTask(
                        id=task['id'],
                        status=task.get('status', 'pending'),
                        source=task.get('source'),
                        error_message=task.get('error_message'),
                        created_time=created_time,
                        updated_time=updated_time,
                        completed_time=completed_time
                    )

                    db.session.add(new_task)
                    total_imported += 1

                except Exception as e:
                    total_errors += 1
                    logger.error(f"Error importing generation task: {e}")
                    continue

        # 提交事务
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Commit failed: {e}")
            return jsonify({'error': f'保存数据失败: {str(e)}'}), 500

        mode_name = '全量覆盖' if import_mode == 'overwrite' else '增量追加'
        logger.info(f"Imported database ({mode_name}): {total_imported} imported, {total_skipped} skipped, {total_errors} errors")

        return jsonify({
            'success': True,
            'message': f'导入完成（{mode_name}）：成功{total_imported}条，跳过{total_skipped}条，失败{total_errors}条',
            'imported_count': total_imported,
            'skipped_count': total_skipped,
            'error_count': total_errors
        })

    except Exception as e:
        logger.error(f"Import database error: {e}", exc_info=True)
        return jsonify({'error': f'导入失败: {str(e)}'}), 500
