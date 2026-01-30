"""数据管理蓝图（导入/导出）"""
import io
import os
import zipfile
from datetime import datetime
from flask import Blueprint, jsonify, Response, current_app, request, send_from_directory

import logging
from app.utils.decorators import admin_required
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
    """导出翻译词典数据库"""
    try:
        # translation_dict.db 文件路径
        translation_dict_path = os.path.join(
            current_app.instance_path,
            'translation_dict.db'
        )

        # 规范化路径
        translation_dict_path = os.path.abspath(translation_dict_path)

        if not os.path.exists(translation_dict_path):
            logger.error(f"Translation dict file not found: {translation_dict_path}")
            return jsonify({'error': '词典文件不存在'}), 404

        # 获取目录和文件名
        directory = os.path.dirname(translation_dict_path)
        filename = os.path.basename(translation_dict_path)

        logger.info(f"Exporting translation dict: {translation_dict_path}")

        return send_from_directory(
            directory,
            filename,
            download_name='translation_dict.db',
            as_attachment=True
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
                'Content-Disposition': f'attachment; filename=dict_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
            }
        )

    except Exception as e:
        logger.error(f"Export dict logs error: {e}", exc_info=True)
        return jsonify({'error': f'导出失败: {str(e)}'}), 500


@data_management_bp.route('/admin/api/export/database-sql', methods=['GET'])
@admin_required
def export_database_sql():
    """导出数据库所有数据为SQL文件"""
    try:
        from app.models import Recording, ReferenceText, APIKey, GenerationTask
        from sqlalchemy import inspect

        sql_lines = []
        sql_lines.append("-- Teo Estuary Database Export")
        sql_lines.append(f"-- Export Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        sql_lines.append("-- This file contains all data from the database")
        sql_lines.append("-- Execute this file to restore/import the data")
        sql_lines.append("")
        sql_lines.append("SET FOREIGN_KEY_CHECKS = 0;")
        sql_lines.append("")

        # 导出 recordings 表
        sql_lines.append("-- ============================================")
        sql_lines.append("-- Table: recordings")
        sql_lines.append("-- ============================================")
        recordings = Recording.query.all()
        if recordings:
            for r in recordings:
                # 转义单引号
                mandarin_text_escaped = r.mandarin_text.replace("'", "''") if r.mandarin_text else ''
                teochew_text_escaped = r.teochew_text.replace("'", "''") if r.teochew_text else None
                file_path_escaped = r.file_path.replace("'", "''") if r.file_path else ''
                user_agent_escaped = r.user_agent.replace("'", "''") if r.user_agent else None

                teochew_sql = f"NULL" if teochew_text_escaped is None else f"'{teochew_text_escaped}'"
                user_agent_sql = f"NULL" if user_agent_escaped is None else f"'{user_agent_escaped}'"
                reviewed_at_sql = f"'{r.reviewed_at.isoformat()}'" if r.reviewed_at else 'NULL'
                ip_address_sql = r.ip_address if r.ip_address else ''

                sql_lines.append(f"INSERT INTO recordings (id, file_path, mandarin_text, teochew_text, upload_time, ip_address, user_agent, file_size, duration, status, upload_type, reviewed_at) VALUES ('{r.id}', '{file_path_escaped}', '{mandarin_text_escaped}', {teochew_sql}, '{r.upload_time.isoformat()}', '{ip_address_sql}', {user_agent_sql}, {r.file_size}, {r.duration}, '{r.status}', {r.upload_type}, {reviewed_at_sql});")

        sql_lines.append("")

        # 导出 reference_text 表
        sql_lines.append("-- ============================================")
        sql_lines.append("-- Table: reference_text")
        sql_lines.append("-- ============================================")
        refs = ReferenceText.query.all()
        if refs:
            for ref in refs:
                discourse_escaped = ref.discourse.replace("'", "''")
                sql_lines.append(f"INSERT INTO reference_text (id, discourse, created_time) VALUES ({ref.id}, '{discourse_escaped}', '{ref.created_time.isoformat()}');")

        sql_lines.append("")

        # 导出 api_keys 表
        sql_lines.append("-- ============================================")
        sql_lines.append("-- Table: api_keys")
        sql_lines.append("-- ============================================")
        api_keys = APIKey.query.all()
        if api_keys:
            for key in api_keys:
                name_escaped = key.name.replace("'", "''")
                description_escaped = key.description.replace("'", "''") if key.description else None
                description_sql = f"NULL" if description_escaped is None else f"'{description_escaped}'"
                is_active_sql = 1 if key.is_active else 0
                last_used_sql = f"'{key.last_used.isoformat()}'" if key.last_used else 'NULL'

                sql_lines.append(f"INSERT INTO api_keys (id, name, key, description, is_active, created_time, last_used, usage_count, max_requests) VALUES ({key.id}, '{name_escaped}', '{key.key}', {description_sql}, {is_active_sql}, '{key.created_time.isoformat()}', {last_used_sql}, {key.usage_count}, {key.max_requests});")

        sql_lines.append("")

        # 导出 generation_tasks 表
        sql_lines.append("-- ============================================")
        sql_lines.append("-- Table: generation_tasks")
        sql_lines.append("-- ============================================")
        tasks = GenerationTask.query.all()
        if tasks:
            for task in tasks:
                result_escaped = task.result.replace("'", "''") if task.result else None
                error_escaped = task.error_message.replace("'", "''") if task.error_message else None

                result_sql = f"NULL" if result_escaped is None else f"'{result_escaped}'"
                error_sql = f"NULL" if error_escaped is None else f"'{error_escaped}'"
                completed_time_sql = f"'{task.completed_time.isoformat()}'" if task.completed_time else 'NULL'

                sql_lines.append(f"INSERT INTO generation_tasks (id, status, result, error_message, created_time, updated_time, completed_time) VALUES ({task.id}, '{task.status}', {result_sql}, {error_sql}, '{task.created_time.isoformat()}', '{task.updated_time.isoformat()}', {completed_time_sql});")

        sql_lines.append("")
        sql_lines.append("SET FOREIGN_KEY_CHECKS = 1;")

        # 生成SQL内容
        sql_content = '\n'.join(sql_lines)

        logger.info(f"Exported database SQL: {len(recordings)} recordings, {len(refs)} reference texts, {len(api_keys)} API keys, {len(tasks)} tasks")

        return Response(
            sql_content,
            mimetype='text/plain',
            headers={
                'Content-Disposition': f'attachment; filename=teo_estuary_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.sql'
            }
        )

    except Exception as e:
        logger.error(f"Export database SQL error: {e}")
        return jsonify({'error': '导出失败'}), 500


@data_management_bp.route('/admin/api/import/dict-logs', methods=['POST'])
@admin_required
def import_dict_logs():
    """导入词典操作日志"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 获取日志类型参数
        log_type = request.form.get('type', 'changes')  # 'changes' 或 'sync'

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

        # 处理日志内容
        imported, skipped, errors = _process_log_content(log_content, target_file)

        log_type_name = '修改日志' if log_type == 'changes' else '同步日志'
        logger.info(f"Imported {log_type_name}: {imported} imported, {skipped} skipped")

        return jsonify({
            'success': True,
            'message': f'导入完成：成功{imported}条，跳过{skipped}条',
            'imported_count': imported,
            'skipped_count': skipped,
            'errors': errors[:10] if errors else []
        })

    except Exception as e:
        logger.error(f"Import dict logs error: {e}", exc_info=True)
        return jsonify({'error': f'导入失败: {str(e)}'}), 500


def _process_log_content(content, target_file_path):
    """处理日志内容并追加到目标文件"""
    import json

    imported_count = 0
    skipped_count = 0
    error_lines = []

    # 确保目标目录存在
    os.makedirs(os.path.dirname(target_file_path), exist_ok=True)

    # 追加模式写入日志文件
    with open(target_file_path, 'a', encoding='utf-8') as f:
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

