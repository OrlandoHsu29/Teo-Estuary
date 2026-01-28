"""录音管理蓝图"""
import io
import os
import zipfile
import requests
from datetime import datetime, timedelta
from pathlib import Path
from flask import Blueprint, request, jsonify, send_from_directory, Response, current_app
from werkzeug.utils import secure_filename

import logging
from app import db
from app.utils.combined_decorators import api_key_required_with_rate_limit
from app.utils.decorators import admin_required, get_client_ip
from app.utils.helpers import generate_id, get_next_audio_name, move_audio_file
from app.utils.timezone import now
from app.teo_g2p.translation_service import translation_service

recordings_bp = Blueprint('recordings', __name__)
logger = logging.getLogger(__name__)

# 内网穿透到本机的 Emilia 服务端口
# 从环境变量读取，支持 Docker 环境 (host.docker.internal) 和本地环境 (localhost)
emilia_service_host = os.getenv('EMILIA_SERVICE_URL', 'http://localhost:5029')


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
        teochew_text = translation_service.translate(text, auto_split=True, target_lang='teochew')
        # teochew_text = current_app.teochew_converter.to_oral(text, auto_split=True)

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
            mandarin_text=text,
            teochew_text=teochew_text,
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
                (Recording.mandarin_text.like(search_pattern)) |
                (Recording.teochew_text.like(search_pattern))
            )

        # 根据状态选择排序字段
        # 待审核：按上传时间倒序
        # 已通过/已拒绝：按操作时间倒序（最新操作的在最前面）
        if status in ['approved', 'rejected']:
            order_field = Recording.reviewed_at.desc()
        else:
            order_field = Recording.upload_time.desc()

        recordings = query.order_by(order_field)\
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
    """更新录音基本信息（管理用）
    仅支持更新 teochew_text、mandarin_text、file_path 等基本信息
    不处理状态变更和文件移动
    """
    try:
        from app.models import Recording

        recording = Recording.query.get_or_404(recording_id)
        data = request.get_json()

        # 仅更新基本信息字段
        if 'teochew_text' in data:
            recording.teochew_text = data['teochew_text']

        if 'mandarin_text' in data:
            recording.mandarin_text = data['mandarin_text']

        if 'file_path' in data:
            recording.file_path = data['file_path']

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '更新成功'
        })

    except Exception as e:
        logger.error(f"Update recording error: {e}")
        db.session.rollback()
        return jsonify({'error': '更新失败'}), 500


@recordings_bp.route('/api/recording/<recording_id>/review', methods=['PUT'])
def api_review_recording(recording_id):
    """审核录音（更新状态并移动文件）
    专门用于将录音状态更改为 approved 或 rejected，并相应移动文件
    """
    try:
        from app.models import Recording

        recording = Recording.query.get_or_404(recording_id)
        data = request.get_json()

        # 获取新状态
        new_status = data.get('status')
        if not new_status:
            return jsonify({
                'success': False,
                'error': '缺少status参数'
            }), 400

        # 验证状态值
        if new_status not in ['approved', 'rejected']:
            return jsonify({
                'success': False,
                'error': 'status参数必须是approved或rejected'
            }), 400

        old_status = recording.status

        # 如果状态没有变化，直接返回成功
        if old_status == new_status:
            return jsonify({
                'success': True,
                'message': '状态未变化'
            })

        # 检查是否有潮汕话文本
        if not recording.teochew_text:
            return jsonify({
                'success': False,
                'error': '请先填写音频实际内容后再进行审核'
            }), 400

        # 如果请求中包含 teochew_text，先更新
        if 'teochew_text' in data:
            recording.teochew_text = data['teochew_text']

        # 检查 file_path 是否来自 Emilia 服务
        if recording.file_path and recording.upload_type == 1:
            # 调用 Emilia 服务的 move_audio 接口
            emilia_url = f'{emilia_service_host}/move_audio'

            try:
                response = requests.post(
                    emilia_url,
                    data={
                        'recording_id': recording_id,
                        'status': new_status
                    },
                    timeout=30
                )

                if response.status_code == 200:
                    # Emilia 服务移动成功，更新状态和操作时间
                    recording.status = new_status
                    recording.reviewed_at = now()
                    logger.info(f"{old_status} → {new_status}: Emilia recording {recording_id} moved via Emilia service")
                else:
                    logger.error(f"Emilia move_audio returned error: {response.status_code} - {response.text}")
                    return jsonify({
                        'success': False,
                        'error': f'Emilia 服务返回错误: {response.status_code}'
                    }), response.status_code

            except requests.exceptions.Timeout:
                logger.error("Timeout calling Emilia move_audio")
                return jsonify({'success': False, 'error': 'Emilia 服务响应超时'}), 504
            except requests.exceptions.ConnectionError:
                logger.error("Cannot connect to Emilia service")
                return jsonify({'success': False, 'error': '无法连接到 Emilia 服务'}), 503
            except Exception as e:
                logger.error(f"Error calling Emilia move_audio: {e}")
                return jsonify({'success': False, 'error': f'调用 Emilia 服务失败: {str(e)}'}), 500

        else:
            # 本地文件处理逻辑
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
            source_path = current_path

            target_path = move_audio_file(source_path, audio_name, new_status, current_app.config['DATA_FOLDER'])

            if target_path:
                recording.status = new_status
                recording.reviewed_at = now()
                # 转化为相对于data根目录的路径: good/S001/F001/S001F001C001.webm
                relative_path = os.path.relpath(target_path, current_app.config['DATA_FOLDER'])

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
            'message': '审核成功'
        })

    except Exception as e:
        logger.error(f"Review recording error: {e}")
        db.session.rollback()
        return jsonify({'error': '审核失败'}), 500


@recordings_bp.route('/admin/api/recordings/<recording_id>', methods=['DELETE'])
@admin_required
def api_delete_recording(recording_id):
    """删除录音文件和数据库记录"""
    try:
        from app.models import Recording

        recording = Recording.query.get_or_404(recording_id)

        # 检查 file_path 是否来自 Emilia 服务
        if recording.file_path and recording.upload_type == 1:
            # 调用 Emilia 服务的删除接口
            emilia_url = f'{emilia_service_host}/audio/{recording_id}'

            try:
                response = requests.delete(emilia_url, timeout=30)

                if response.status_code == 200:
                    logger.info(f"Deleted audio file from Emilia: {recording_id}")
                else:
                    logger.error(f"Emilia delete returned error: {response.status_code} - {response.text}")
                    return jsonify({
                        'success': False,
                        'error': f'Emilia 服务删除失败: {response.status_code}'
                    }), response.status_code

            except requests.exceptions.Timeout:
                logger.error("Timeout calling Emilia delete")
                return jsonify({'success': False, 'error': 'Emilia 服务响应超时'}), 504
            except requests.exceptions.ConnectionError:
                logger.error("Cannot connect to Emilia service")
                return jsonify({'success': False, 'error': '无法连接到 Emilia 服务'}), 503
            except Exception as e:
                logger.error(f"Error calling Emilia delete: {e}")
                return jsonify({'success': False, 'error': f'调用 Emilia 服务失败: {str(e)}'}), 500

        else:
            # 本地文件删除逻辑
            # 将相对路径转换为绝对路径
            if recording.file_path:
                file_path = current_app.config['DATA_FOLDER'] + '/' + recording.file_path if not os.path.isabs(recording.file_path) else recording.file_path
            else:
                file_path = None
            filename = os.path.basename(file_path) if file_path else None

            logger.info(f"Deleting recording {recording_id}: {filename}")

            try:
                if file_path and os.path.exists(file_path):
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

        # 检查 file_path 是否来自 Emilia 服务
        if recording.upload_type == 1:
            # 调用 Emilia 服务的获取音频接口
            emilia_url = f'{emilia_service_host}/audio/{recording_id}'

            try:
                if request.method == 'HEAD':
                    # HEAD 请求：获取文件信息
                    response = requests.head(emilia_url, timeout=30)
                    if response.status_code == 200:
                        proxy_response = Response()
                        proxy_response.headers['Content-Type'] = response.headers.get('Content-Type', 'audio/mpeg')
                        proxy_response.headers['Content-Length'] = response.headers.get('Content-Length', '0')
                        proxy_response.headers['Accept-Ranges'] = 'bytes'
                        proxy_response.headers['Cache-Control'] = 'public, max-age=3600'
                        proxy_response.headers['Access-Control-Allow-Origin'] = '*'
                        proxy_response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
                        proxy_response.headers['Access-Control-Allow-Headers'] = 'Range'
                        return proxy_response
                    else:
                        return jsonify({'error': '音频文件不存在'}), 404

                # GET 请求：转发音频数据
                is_download = request.args.get('download', 'true').lower() == 'true'

                emilia_response = requests.get(emilia_url, timeout=30, stream=True)

                if emilia_response.status_code == 200:
                    # 转发响应
                    response = Response(
                        emilia_response.iter_content(chunk_size=8192),
                        headers={
                            'Content-Type': emilia_response.headers.get('Content-Type', 'audio/mpeg'),
                            'Content-Length': emilia_response.headers.get('Content-Length', ''),
                            'Accept-Ranges': 'bytes',
                            'Cache-Control': 'public, max-age=3600',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                            'Access-Control-Allow-Headers': 'Range'
                        }
                    )

                    if is_download:
                        response.headers['Content-Disposition'] = f'attachment; filename={recording_id}.mp3'

                    logger.info(f"Serving audio from Emilia: {recording_id}")
                    return response
                else:
                    logger.error(f"Emilia audio returned error: {emilia_response.status_code}")
                    return jsonify({'error': '音频文件不存在'}), 404

            except requests.exceptions.Timeout:
                logger.error("Timeout calling Emilia audio")
                return jsonify({'error': 'Emilia 服务响应超时'}), 504
            except requests.exceptions.ConnectionError:
                logger.error("Cannot connect to Emilia service")
                return jsonify({'error': '无法连接到 Emilia 服务'}), 503
            except Exception as e:
                logger.error(f"Error calling Emilia audio: {e}")
                return jsonify({'error': f'获取音频失败: {str(e)}'}), 500

        else:
            # 本地文件处理逻辑
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


@recordings_bp.route('/api/upload-material', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=500, daily_limit=2000)
def api_upload_material(key_obj):
    """上传音频素材到 Emilia 服务（单文件）
    接收音频文件并转发到 localhost:5029/upload_audio
    限制：
    - 每小时最多500次上传
    - 每天最多2000次上传
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '没有音频文件'}), 400

        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 检查文件类型
        if not file.content_type or not file.content_type.startswith('audio/'):
            return jsonify({'error': '文件类型错误，请上传音频文件'}), 400

        # 转发到 Emilia 服务
        emilia_url = f'{emilia_service_host}/upload_audio'

        try:
            # 准备转发文件和数据
            files = {'file': (file.filename, file.stream, file.content_type)}
            data = {'ip_address': get_client_ip()}

            # 发送请求到 Emilia 服务
            response = requests.post(
                emilia_url,
                files=files,
                data=data,
                timeout=60  # 1分钟超时
            )

            # 检查 Emilia 服务响应
            if response.status_code == 201:
                result = response.json()
                logger.info(f"Successfully forwarded audio to Emilia: {result.get('id')}")

                return jsonify({
                    'success': True,
                    'id': result.get('id'),
                    'file_path': result.get('file_path'),
                    'status': result.get('status'),
                    'message': '音频素材上传成功'
                }), 201
            else:
                logger.error(f"Emilia service returned error: {response.status_code} - {response.text}")
                return jsonify({
                    'error': f'Emilia 服务返回错误: {response.status_code}'
                }), response.status_code

        except requests.exceptions.Timeout:
            logger.error("Timeout forwarding audio to Emilia service")
            return jsonify({'error': 'Emilia 服务响应超时，请稍后重试'}), 504
        except requests.exceptions.ConnectionError:
            logger.error(f"Cannot connect to Emilia service at {emilia_service_host}")
            return jsonify({'error': '无法连接到 Emilia 服务，请确认服务已启动'}), 503
        except Exception as e:
            logger.error(f"Error forwarding to Emilia: {e}")
            return jsonify({'error': f'转发失败: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Upload material error: {e}")
        return jsonify({'error': '上传失败，请重试'}), 500


@recordings_bp.route('/teo_emilia_health', methods=['GET'])
def teo_emilia_health():
    """转发 Emilia 服务的健康检查接口"""
    try:
        emilia_url = f'{emilia_service_host}/health'

        response = requests.get(emilia_url, timeout=10)

        if response.status_code == 200:
            result = response.json()
            return jsonify({
                'status': 'healthy',
                'emilia_service': result.get('status', 'ok'),
                'pending_count': result.get('pending_count', 0),
                'batch_task': result.get('batch_task')  # 转发批处理任务状态
            }), 200
        else:
            return jsonify({
                'status': 'unhealthy',
                'error': f'Emilia service returned: {response.status_code}'
            }), response.status_code

    except requests.exceptions.Timeout:
        logger.error("Timeout calling Emilia health check")
        return jsonify({
            'status': 'unhealthy',
            'error': 'Emilia 服务响应超时'
        }), 504
    except requests.exceptions.ConnectionError:
        logger.error("Cannot connect to Emilia service")
        return jsonify({
            'status': 'unhealthy',
            'error': 'Emilia 服务未启动或无法连接'
        }), 503
    except Exception as e:
        logger.error(f"Emilia health check error: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500


@recordings_bp.route('/admin/api/emilia/batch-import', methods=['POST'])
@admin_required
def admin_batch_import_emilia():
    """触发 Emilia 批处理任务
    只负责调用 Emilia 的 /batch_process 接口并返回任务状态
    """
    try:
        # 调用 Emilia 的 batch_process 接口
        emilia_url = f'{emilia_service_host}/batch_process'

        try:
            response = requests.post(emilia_url, timeout=120)  # 2分钟超时

            # 202 Accepted: 任务已接受，正在处理中（长时任务）
            if response.status_code == 202:
                result = response.json()
                return jsonify({
                    'success': True,
                    'task_id': result.get('task_id'),
                    'message': '批处理任务已启动，正在处理中'
                }), 202

            # 409 Conflict: 任务已在处理中
            if response.status_code == 409:
                result = response.json()
                return jsonify({
                    'success': False,
                    'error': result.get('error', 'A batch process is already running'),
                    'task_id': result.get('task_id')
                }), 409

            result = response.json()

            if not result.get('success'):
                return jsonify({
                    'success': False,
                    'error': result.get('error', 'Emilia 处理失败')
                }), 500

            data_list = result.get('data', [])
            if not data_list:
                return jsonify({
                    'success': True,
                    'message': '没有需要导入的数据',
                    'imported_count': 0
                }), 200

        except requests.exceptions.Timeout:
            logger.error("Timeout calling Emilia batch_process")
            return jsonify({'success': False, 'error': 'Emilia 服务响应超时'}), 504
        except requests.exceptions.ConnectionError:
            logger.error("Cannot connect to Emilia service")
            return jsonify({'success': False, 'error': '无法连接到 Emilia 服务'}), 503
        except Exception as e:
            logger.error(f"Error calling Emilia batch_process: {e}")
            return jsonify({'success': False, 'error': f'调用 Emilia 服务失败: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Batch import error: {e}")
        return jsonify({'error': '批量导入失败'}), 500


@recordings_bp.route('/admin/api/emilia/batch-result', methods=['POST'])
@admin_required
def admin_batch_import_result():
    """接收 Emilia 处理完成的数据并存入数据库
    Emilia 服务处理完 batch_process 后调用此接口
    请求体格式：{
        "data": [
            {
                "id": "recording_id",
                "file_path": "文件路径",
                "teochew_text": "潮州话文本",
                "ip_address": "IP地址",
                "file_size": 12345,
                "duration": 10
            }
        ]
    }
    """
    try:
        from app.models import Recording

        # 获取JSON数据
        request_data = request.get_json()
        if not request_data:
            return jsonify({'error': '没有提供JSON数据'}), 400

        data_list = request_data.get('data', [])
        if not data_list:
            return jsonify({
                'success': True,
                'message': '没有需要导入的数据',
                'imported_count': 0
            }), 200

        # 处理返回的数据
        imported_count = 0
        skipped_count = 0
        failed_count = 0
        errors = []

        for item in data_list:
            try:
                recording_id = item.get('id')
                teochew_text = item.get('teochew_text', '').strip()

                if not recording_id or not teochew_text:
                    failed_count += 1
                    errors.append(f"缺少 id 或 teochew_text: {item}")
                    continue

                # 检查 recording_id 是否已存在
                existing = Recording.query.get(recording_id)
                if existing:
                    logger.info(f"Recording {recording_id} already exists, skipping")
                    skipped_count += 1
                    continue

                # 检查 teochew_text 是否已存在
                existing_teochew = Recording.query.filter_by(teochew_text=teochew_text).first()
                if existing_teochew:
                    logger.info(f"Teochew text already exists: {teochew_text[:30]}..., skipping")
                    skipped_count += 1
                    continue

                # 将潮州话翻译为普通话
                try:
                    mandarin_text = translation_service.translate(
                        teochew_text,
                        auto_split=True,
                        target_lang='mandarin'
                    )
                except Exception as e:
                    logger.error(f"Translation failed for {recording_id}: {e}")
                    # 翻译失败时使用空字符串
                    mandarin_text = ''

                # 检查 mandarin_text 是否已存在
                if mandarin_text:
                    existing_mandarin = Recording.query.filter_by(mandarin_text=mandarin_text).first()
                    if existing_mandarin:
                        logger.info(f"Mandarin text already exists: {mandarin_text[:30]}..., skipping")
                        skipped_count += 1
                        continue

                # 创建 Recording 记录
                recording = Recording(
                    id=recording_id,
                    file_path=item.get('file_path', ''),
                    mandarin_text=mandarin_text,
                    teochew_text=teochew_text,
                    ip_address=item.get('ip_address', ''),
                    file_size=item.get('file_size', 0),
                    duration=item.get('duration', 0),
                    status='pending',
                    upload_type=1
                )

                db.session.add(recording)
                db.session.flush()  # 立即执行以捕获唯一约束冲突
                imported_count += 1
                logger.info(f"Imported recording {recording_id}: {teochew_text[:30]}...")

            except Exception as e:
                db.session.rollback()
                failed_count += 1
                errors.append(f"{recording_id}: {str(e)}")
                logger.error(f"Failed to import {recording_id}: {e}")
                continue

        # 提交所有更改
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Database commit failed: {e}")
            return jsonify({
                'success': False,
                'error': f'数据库提交失败: {str(e)}'
            }), 500

        return jsonify({
            'success': True,
            'message': f'批量导入完成：成功{imported_count}条，跳过{skipped_count}条重复，失败{failed_count}条',
            'imported_count': imported_count,
            'skipped_count': skipped_count,
            'failed_count': failed_count,
            'errors': errors[:10] if errors else []  # 最多返回10个错误
        }), 200

    except Exception as e:
        logger.error(f"Batch import result error: {e}")
        db.session.rollback()
        return jsonify({'error': '批量导入失败'}), 500


@recordings_bp.route('/api/batch-update-text', methods=['POST'])
@api_key_required_with_rate_limit(hourly_limit=100, daily_limit=500)
def api_batch_update_text(key_obj):
    """批量更新录音的潮州话文本
    请求体格式：
    [
        {
            "id": "FCC8B093F79148C7",
            "text": "你是否应该总是联系在球娘上的每一个位置发球 标准中一个点",
            "start": 8.13,
            "end": 15.20,
            "dnsmos": 3.26
        }
    ]
    限制：
    - 每小时最多100次请求
    - 每天最多500次请求
    """
    try:
        from app.models import Recording

        # 获取JSON数据
        data = request.get_json()
        if not data:
            return jsonify({'error': '没有提供JSON数据'}), 400

        if not isinstance(data, list):
            return jsonify({'error': '数据格式错误，应该是JSON数组'}), 400

        # 处理结果统计
        results = {
            'success': 0,
            'updated': 0,
            'created': 0,
            'failed': 0,
            'errors': []
        }

        for item in data:
            try:
                # 验证必需字段
                if 'id' not in item or 'text' not in item:
                    results['failed'] += 1
                    results['errors'].append({
                        'item': item,
                        'error': '缺少id或text字段'
                    })
                    continue

                recording_id = item['id']
                teochew_text = item['text'].strip()

                if not teochew_text:
                    results['failed'] += 1
                    results['errors'].append({
                        'id': recording_id,
                        'error': 'text字段为空'
                    })
                    continue

                # 查找或创建记录
                recording = Recording.query.get(recording_id)

                if recording:
                    # 更新现有记录
                    recording.teochew_text = teochew_text
                    results['updated'] += 1
                    logger.info(f"Updated recording {recording_id} teochew_text")
                else:
                    # 创建新记录
                    recording = Recording(
                        id=recording_id,
                        file_path='',  # 空路径，因为没有实际文件
                        mandarin_text='',
                        teochew_text=teochew_text,
                        upload_type=1,  # 默认为素材提取
                        status='pending'
                    )
                    db.session.add(recording)
                    results['created'] += 1
                    logger.info(f"Created new recording {recording_id}")

                results['success'] += 1

            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'item': item,
                    'error': str(e)
                })
                logger.error(f"Error processing item {item}: {e}")
                continue

        # 提交所有更改
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'处理完成：成功{results["success"]}条，更新{results["updated"]}条，创建{results["created"]}条，失败{results["failed"]}条',
            'results': results
        })

    except Exception as e:
        logger.error(f"Batch update error: {e}")
        db.session.rollback()
        return jsonify({'error': '批量更新失败'}), 500


@recordings_bp.route('/api/stats')
def api_stats():
    """获取统计信息"""
    try:
        from app.models import Recording

        total_recordings = Recording.query.count()
        pending_recordings = Recording.query.filter_by(status='pending').count()
        approved_recordings = Recording.query.filter_by(status='approved').count()
        rejected_recordings = Recording.query.filter_by(status='rejected').count()
        transcribed_recordings = Recording.query.filter_by(upload_type=1).count()

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
                'transcribed': transcribed_recordings,
                'recent_uploads': recent_uploads
            }
        })

    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({'error': '获取统计信息失败'}), 500


@recordings_bp.route('/admin/api/export/train-dataset', methods=['GET'])
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


@recordings_bp.route('/admin/api/export/jieba-dict', methods=['GET'])
@admin_required
def export_jieba_dict():
    """导出Jieba潮汕话适配版词库"""
    try:
        # jieba_cut.txt文件路径
        jieba_dict_path = os.path.join(
            os.path.dirname(__file__),
            '..', 'teo_g2p', 'word_dict', 'jieba_cut.txt'
        )

        # 规范化路径
        jieba_dict_path = os.path.abspath(jieba_dict_path)

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