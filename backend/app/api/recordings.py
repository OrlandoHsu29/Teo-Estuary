"""录音管理蓝图"""
import os
from datetime import datetime, timedelta
from pathlib import Path
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

import logging
from flask import current_app
from app import db
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app.utils.decorators import admin_required, get_client_ip
from app.utils.helpers import generate_id, get_next_audio_name, move_audio_file
from app.teo_g2p.translation_service import translation_service

recordings_bp = Blueprint('recordings', __name__)
logger = logging.getLogger(__name__)


@recordings_bp.route('/api/upload', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=300, daily_limit=750)
def api_upload(key_obj):
    """上传录音文件
    限制：
    - 每小时最多300次上传
    - 每天最多750次上传
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '没有音频文件'}), 400

        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        text = request.form.get('text', '').strip()
        if not text:
            return jsonify({'error': '没有文本内容'}), 400

        if len(text) > current_app.config['MAX_TEXT_LENGTH']:
            return jsonify({'error': f'文本长度不能超过 {current_app.config["MAX_TEXT_LENGTH"]} 字符'}), 400

        recording_id = generate_id()
        file_extension = Path(file.filename).suffix or '.webm'
        safe_filename = f"{recording_id}{file_extension}"

        file_path = os.path.join(current_app.config['DATA_FOLDER'], 'uploads', safe_filename)
        file.save(file_path)

        # 翻译普通话参考文本
        actual_content = translation_service.translate_to_oral(text, auto_split=True)
        # actual_content = current_app.teochew_converter.to_oral(text, auto_split=True)

        from app.models import Recording

        # 获取上传类型参数 (必须传递)
        upload_type = request.form.get('upload_type', type=int)
        if upload_type is None:
            return jsonify({
                'success': False,
                'error': '缺少upload_type参数，必须传递0(录音上传)或1(素材提取)'
            }), 400

        if upload_type not in [0, 1]:
            return jsonify({
                'success': False,
                'error': 'upload_type参数值错误，必须是0(录音上传)或1(素材提取)'
            }), 400

        # 获取录音时长
        duration = request.form.get('duration', 0, type=int)

        # 在数据库中存储相对于data目录的路径
        recording = Recording(
            id=recording_id,
            file_path=os.path.join('uploads', safe_filename).replace('\\', '/'),
            original_text=text,
            actual_content=actual_content,
            ip_address=get_client_ip(),
            user_agent=request.headers.get('User-Agent', '')[:500],
            file_size=os.path.getsize(file_path),
            duration=duration,
            upload_type=upload_type
        )

        db.session.add(recording)
        db.session.commit()

        logger.info(f"Successfully uploaded recording: {recording_id}")

        return jsonify({
            'success': True,
            'id': recording_id,
            'message': '上传成功'
        })

    except Exception as e:
        logger.error(f"Upload error: {e}")
        db.session.rollback()
        return jsonify({
            'error': '上传失败，请重试'
        }), 500


@recordings_bp.route('/api/recordings')
def api_recordings():
    """获取录音列表（管理用）"""
    try:
        from app.models import Recording

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', '')
        upload_type = request.args.get('upload_type', '', type=str)
        search = request.args.get('search', '', type=str)

        # 限制每页最大数量，避免性能问题
        per_page = min(per_page, 100)

        query = Recording.query

        if status:
            query = query.filter_by(status=status)

        # upload_type筛选
        if upload_type.isdigit():
            query = query.filter_by(upload_type=int(upload_type))

        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                (Recording.original_text.like(search_pattern)) |
                (Recording.actual_content.like(search_pattern))
            )

        # 优化：只选择必要的字段
        recordings = query.order_by(Recording.upload_time.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'success': True,
            'recordings': [rec.to_dict() for rec in recordings.items],
            'total': recordings.total,
            'pages': recordings.pages,
            'current_page': page,
            'per_page': per_page
        })

    except Exception as e:
        logger.error(f"Get recordings error: {e}")
        return jsonify({'error': '获取录音列表失败'}), 500


@recordings_bp.route('/api/recording/<recording_id>', methods=['PUT'])
def api_update_recording(recording_id):
    """更新录音信息（管理用）"""
    try:
        from app.models import Recording

        recording = Recording.query.get_or_404(recording_id)
        data = request.get_json()
        old_status = recording.status

        if 'actual_content' in data:
            recording.actual_content = data['actual_content']

        if 'original_text' in data:
            recording.original_text = data['original_text']

        if 'status' in data:
            new_status = data['status']

            if new_status in ['approved', 'rejected'] and old_status != new_status:
                if not recording.actual_content:
                    return jsonify({
                        'success': False,
                        'error': '请先填写音频实际内容后再进行审核'
                    }), 400

                # 获取当前文件信息
                current_filename = os.path.basename(recording.file_path)
                # 将相对与data的路径转换为绝对路径
                current_path = f'{current_app.config["DATA_FOLDER"]}/' + recording.file_path

                # 检查源文件是否存在
                if not os.path.exists(current_path):
                    logger.error(f"Source file not found: {current_path}")
                    return jsonify({
                        'success': False,
                        'error': '源文件不存在，无法移动'
                    }), 404

                audio_name = get_next_audio_name(new_status, exclude_id=recording_id)
                new_filename = f"{audio_name}.webm"
                source_path = current_path

                target_path = move_audio_file(source_path, audio_name, new_status, current_app.config['DATA_FOLDER'])

                if target_path:
                    # 存储相对于data目录的路径
                    base_dir = 'good' if new_status == 'approved' else 'bad'
                    s_part = audio_name[:4]  # S001
                    f_part = audio_name[4:8]  # F001
                    recording.status = new_status
                    # 构建相对于data根目录的路径: good/S001/F001/S001F001C001.webm
                    relative_path = os.path.join(base_dir, s_part, f_part, new_filename).replace('\\', '/')
                    recording.file_path = relative_path

                    logger.info(f"{old_status} → {new_status}: Moved recording {recording_id} to {relative_path}")
                else:
                    return jsonify({
                        'success': False,
                        'error': '文件移动失败，请重试'
                    }), 500

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '更新成功'
        })

    except Exception as e:
        logger.error(f"Update recording error: {e}")
        db.session.rollback()
        return jsonify({'error': '更新失败'}), 500


@recordings_bp.route('/admin/api/recordings/<recording_id>', methods=['DELETE'])
@admin_required
def api_delete_recording(recording_id):
    """删除录音文件和数据库记录"""
    try:
        from app.models import Recording

        recording = Recording.query.get_or_404(recording_id)

        # 将相对路径转换为绝对路径
        if recording.file_path:
            file_path = current_app.config['DATA_FOLDER'] + '/' + recording.file_path if not os.path.isabs(recording.file_path) else recording.file_path
        else:
            file_path = None
        filename = os.path.basename(file_path) if file_path else None

        logger.info(f"Deleting recording {recording_id}: {filename}")

        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted audio file: {file_path}")
            else:
                logger.warning(f"Audio file not found: {file_path}")
        except Exception as file_error:
            logger.error(f"Failed to delete audio file {file_path}: {file_error}")

        db.session.delete(recording)
        db.session.commit()

        logger.info(f"Successfully deleted recording {recording_id}")
        return jsonify({
            'success': True,
            'message': '录音删除成功'
        })

    except Exception as e:
        logger.error(f"Delete recording error: {e}")
        db.session.rollback()
        return jsonify({'error': '删除录音失败'}), 500


@recordings_bp.route('/admin/api/download/<recording_id>', methods=['GET', 'HEAD', 'OPTIONS'])
@admin_required
def admin_download_recording(recording_id):
    """管理员下载/访问录音文件"""
    try:
        from app.models import Recording

        # Handle OPTIONS requests for CORS
        if request.method == 'OPTIONS':
            response = Response()
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Range'
            return response

        recording = Recording.query.get_or_404(recording_id)

        # 将相对路径转换为绝对路径
        if recording.file_path:
            file_path = current_app.config['DATA_FOLDER'] + '/' + recording.file_path
        else:
            file_path = None

        if file_path and os.path.exists(file_path):
            logger.info(f"Audio file exists: {file_path}")
            directory = os.path.dirname(file_path)
            filename = os.path.basename(file_path)
        else:
            logger.error(f"Audio file not found: {file_path} (exists: {os.path.exists(file_path) if file_path else 'None'})")
            return jsonify({'error': '音频文件不存在'}), 404

        is_download = request.args.get('download', 'true').lower() == 'true'

        # 检查文件扩展名
        file_ext = os.path.splitext(file_path)[1].lower()
        logger.info(f"Audio file extension: {file_ext} for recording {recording_id}")

        # 根据文件扩展名确定MIME类型
        if file_ext == '.webm':
            mime_type = 'audio/webm'
        elif file_ext == '.mp3':
            mime_type = 'audio/mpeg'
        elif file_ext == '.wav':
            mime_type = 'audio/wav'
        elif file_ext == '.ogg':
            mime_type = 'audio/ogg'
        else:
            mime_type = 'audio/webm'  # 默认
            logger.warning(f"Unknown audio format {file_ext}, using audio/webm")

        # Handle HEAD requests (for audio URL accessibility testing)
        if request.method == 'HEAD':
            from flask import Response
            response = Response()
            response.headers['Content-Type'] = mime_type
            response.headers['Content-Length'] = os.path.getsize(file_path)
            response.headers['Accept-Ranges'] = 'bytes'
            response.headers['Cache-Control'] = 'public, max-age=3600'
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Range'
            return response

        if is_download:
            download_name = f"{recording.id}{file_ext}"
            return send_from_directory(directory, filename, download_name=download_name, as_attachment=True)
        else:
            # 为HTML5 audio设置正确的MIME类型
            from flask import Response
            try:
                logger.info(f"Serving audio file for recording {recording_id}: {file_path}")

                with open(file_path, 'rb') as f:
                    audio_data = f.read()

                # 设置正确的MIME类型和响应头
                response = Response(audio_data)
                response.headers['Content-Type'] = mime_type
                response.headers['Content-Length'] = len(audio_data)
                response.headers['Accept-Ranges'] = 'bytes'
                response.headers['Cache-Control'] = 'public, max-age=3600'
                response.headers['Access-Control-Allow-Origin'] = '*'
                response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Range'

                logger.info(f"Serving audio file: {recording_id}, size: {len(audio_data)} bytes")
                return response
            except Exception as e:
                logger.error(f"Error serving audio file: {e}")
                return jsonify({'error': '读取音频文件失败'}), 500

    except Exception as e:
        logger.error(f"Download recording error: {e}")
        return jsonify({'error': '下载失败'}), 500


@recordings_bp.route('/api/stats')
def api_stats():
    """获取统计信息"""
    try:
        from app.models import Recording

        total_recordings = Recording.query.count()
        pending_recordings = Recording.query.filter_by(status='pending').count()
        approved_recordings = Recording.query.filter_by(status='approved').count()
        rejected_recordings = Recording.query.filter_by(status='rejected').count()

        yesterday = datetime.now() - timedelta(days=1)  # 使用中国时间
        recent_uploads = Recording.query.filter(
            Recording.upload_time >= yesterday
        ).count()

        return jsonify({
            'success': True,
            'stats': {
                'total': total_recordings,
                'pending': pending_recordings,
                'approved': approved_recordings,
                'rejected': rejected_recordings,
                'recent_uploads': recent_uploads
            }
        })

    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({'error': '获取统计信息失败'}), 500