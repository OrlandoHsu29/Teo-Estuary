import os
import uuid
import hashlib
import time
import logging
import random
import re
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import requests
from functools import wraps
from ai_generator import create_text_generator
from teochew_g2p.script.pyPengIm import pyPengIm 

# 初始化潮汕话转换器
teochew_converter = pyPengIm()


# 配置日志 - 使用相对路径（从app目录启动）
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 创建Flask应用 - 使用相对路径（从app目录启动）
app = Flask(__name__,
    template_folder='../templates',
    static_folder='../static'  # 启用静态文件服务
)

# 启用CORS支持 - 调试模式允许所有来源
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": "*"
    }
})

# 配置 - 使用相对路径
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
# 数据库路径：从app目录需要回退两层到backend，然后进入db
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///../../db/dialect_recorder.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# 上传目录：相对于app目录指向backend/data
app.config['DATA_FOLDER'] = '../data'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# 确保必要的目录存在 - 使用相对路径（从app目录启动）
os.makedirs('../logs', exist_ok=True)
os.makedirs('../db', exist_ok=True)
os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)
os.makedirs(f'{app.config['DATA_FOLDER']}/uploads', exist_ok=True)
os.makedirs(f'{app.config['DATA_FOLDER']}/good', exist_ok=True)
os.makedirs(f'{app.config['DATA_FOLDER']}/bad', exist_ok=True)

# 硅基流动API配置
SILICONFLOW_API_KEY = os.environ.get('SILICONFLOW_API_KEY', 'sk-dqfrbwdryedhuzxwtgdzfffxjstlkkjgenatmuwmembcdjhb')
SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'

# 管理员配置
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'your-admin-password')

# 初始化数据库
db = SQLAlchemy(app)

# 防止恶意上传的配置
RATE_LIMIT = {
    'max_uploads_per_hour': 30,  # 每小时最多上传30个文件
    'max_uploads_per_day': 100,  # 每天最多上传100个文件
    'cooldown_minutes': 0.1,       # 上传冷却时间（分钟）
    'max_text_length': 500       # 最大文本长度
}

# 数据库模型
class Recording(db.Model):
    __tablename__ = 'recordings'

    id = db.Column(db.String(32), primary_key=True)
    file_path = db.Column(db.String(500), nullable=False)
    original_text = db.Column(db.Text, nullable=False)
    actual_content = db.Column(db.Text)
    upload_time = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    file_size = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected

    def to_dict(self):
        return {
            'id': self.id,
            'filename': os.path.basename(self.file_path) if self.file_path else None,
            'file_path': self.file_path,
            'original_text': self.original_text,
            'actual_content': self.actual_content,
            'upload_time': self.upload_time.isoformat(),
            'ip_address': self.ip_address,
            'file_size': self.file_size,
            'duration': self.duration,
            'status': self.status
        }

class UploadRate(db.Model):
    __tablename__ = 'upload_rates'

    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(45), nullable=False)
    upload_time = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('idx_ip_time', 'ip_address', 'upload_time'),
    )

class APIKey(db.Model):
    __tablename__ = 'api_keys'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    key = db.Column(db.String(64), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_time = db.Column(db.DateTime, default=datetime.utcnow)
    last_used = db.Column(db.DateTime)
    usage_count = db.Column(db.Integer, default=0)
    max_requests = db.Column(db.Integer, default=1000)  # 每天最大请求次数

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'key': self.key,
            'description': self.description,
            'is_active': self.is_active,
            'created_time': self.created_time.isoformat(),
            'last_used': self.last_used.isoformat() if self.last_used else None,
            'usage_count': self.usage_count,
            'max_requests': self.max_requests
        }

# 初始化AI文本生成器
text_generator = create_text_generator(api_key=SILICONFLOW_API_KEY)

# 数据库表创建
with app.app_context():
    db.create_all()

def generate_id():
    """生成固定长度的唯一ID"""
    return ''.join(str(uuid.uuid4()).split('-'))[:16].upper()

def generate_api_key():
    """生成API密钥"""
    return ''.join(str(uuid.uuid4()).split('-')) + ''.join(str(uuid.uuid4()).split('-'))

def get_next_audio_name(target_status:str, exclude_id=None):
    """
    获取下一个音频文件名
    命名规则: S{series:03d}F{folder:03d}C{clip:03d}
    例如: S001F001C001
    """
    try:
        query = Recording.query.filter(
            Recording.status.in_([target_status])
        ).filter(
            Recording.file_path.like('%/S%F%C%')
        )

        if exclude_id:
            query = query.filter(Recording.id != exclude_id)

        latest_recording = query.order_by(Recording.file_path.desc()).first()

        if not latest_recording or not latest_recording.file_path:
            return "S001F001C001"

        filename = os.path.basename(latest_recording.file_path).replace('.webm', '')
        match = re.match(r'S(\d+)F(\d+)C(\d+)', filename)
        if not match:
            return "S001F001C001"

        current_s = int(match.group(1))
        current_f = int(match.group(2))
        current_c = int(match.group(3))

        current_c += 1
        if current_c > 50:
            current_c = 1
            current_f += 1
            if current_f > 20:
                current_f = 1
                current_s += 1

        return f"S{current_s:03d}F{current_f:03d}C{current_c:03d}"

    except Exception as e:
        logger.error(f"Error generating next audio name: {e}")
        return "S001F001C001"

def ensure_directory_structure(audio_name, base_dir=None):
    """
    根据文件名确保目录结构存在
    """

    s_part = audio_name[:4]  # S001
    f_part = audio_name[4:8]  # F001

    s_dir = os.path.join(base_dir, s_part)
    f_dir = os.path.join(s_dir, f_part)

    os.makedirs(s_dir, exist_ok=True)
    os.makedirs(f_dir, exist_ok=True)

    return f_dir

def move_audio_file(source_path, audio_name, status):
    """
    将审核后的音频移动到相应的data目录
    """
    try:
        if status == 'approved':
            base_dir = f'{app.config['DATA_FOLDER']}/good'
        elif status == 'rejected':
            base_dir = f'{app.config['DATA_FOLDER']}/bad'
        else:
            logger.error(f"Unknown status: {status}")
            return None

        target_dir = ensure_directory_structure(audio_name, base_dir)
        target_path = os.path.join(target_dir, f"{audio_name}.webm")

        import shutil
        shutil.move(source_path, target_path)

        logger.info(f"Moved {status} audio to: {target_path}")
        return target_path

    except Exception as e:
        logger.error(f"Failed to move {status} audio: {e}")
        return None


def verify_api_key(request):
    """验证API密钥"""
    api_key = request.headers.get('X-API-Key') or request.args.get('api_key')

    if not api_key:
        return None, {'error': '缺少API密钥'}

    key_obj = APIKey.query.filter_by(key=api_key, is_active=True).first()
    if not key_obj:
        return None, {'error': '无效的API密钥'}

    if key_obj.usage_count >= key_obj.max_requests:
        return None, {'error': 'API密钥今日使用次数已用尽'}

    return key_obj, None

def api_key_required(f):
    """API密钥验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        key_obj, error = verify_api_key(request)
        if error:
            return jsonify({'success': False, 'error': error['error']}), 401

        key_obj.last_used = datetime.utcnow()
        key_obj.usage_count += 1
        db.session.commit()

        return f(key_obj, *args, **kwargs)
    return decorated_function

def get_client_ip():
    """获取客户端真实IP"""
    if request.headers.getlist("X-Forwarded-For"):
        ip = request.headers.getlist("X-Forwarded-For")[0]
    elif request.headers.get("X-Real-IP"):
        ip = request.headers.get("X-Real-IP")
    else:
        ip = request.remote_addr
    return ip

def rate_limit_decorator(f):
    """速率限制装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = get_client_ip()
        current_time = datetime.utcnow()

        last_upload = UploadRate.query.filter_by(ip_address=client_ip)\
            .order_by(UploadRate.upload_time.desc())\
            .first()

        if last_upload:
            time_diff = current_time - last_upload.upload_time
            if time_diff.total_seconds() < RATE_LIMIT['cooldown_minutes'] * 60:
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return jsonify({
                    'error': f'请等待 {RATE_LIMIT["cooldown_minutes"]} 分钟后再试'
                }), 429

        hour_ago = current_time - timedelta(hours=1)
        hourly_count = UploadRate.query.filter(
            UploadRate.ip_address == client_ip,
            UploadRate.upload_time >= hour_ago
        ).count()

        if hourly_count >= RATE_LIMIT['max_uploads_per_hour']:
            logger.warning(f"Hourly rate limit exceeded for IP: {client_ip}")
            return jsonify({
                'error': f'每小时最多上传 {RATE_LIMIT["max_uploads_per_hour"]} 个文件'
            }), 429

        day_ago = current_time - timedelta(days=1)
        daily_count = UploadRate.query.filter(
            UploadRate.ip_address == client_ip,
            UploadRate.upload_time >= day_ago
        ).count()

        if daily_count >= RATE_LIMIT['max_uploads_per_day']:
            logger.warning(f"Daily rate limit exceeded for IP: {client_ip}")
            return jsonify({
                'error': f'每天最多上传 {RATE_LIMIT["max_uploads_per_day"]} 个文件'
            }), 429

        return f(*args, **kwargs)
    return decorated_function

def record_upload(client_ip):
    """记录上传行为"""
    upload = UploadRate(ip_address=client_ip)
    db.session.add(upload)
    db.session.commit()

def admin_required(f):
    """管理员权限验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            if request.is_json:
                return jsonify({'error': '需要管理员权限', 'redirect': url_for('admin_login')}), 401
            else:
                return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated_function

def generate_ai_text():
    """生成AI文本"""
    try:
        text = text_generator.generate_text(use_api_first=bool(SILICONFLOW_API_KEY))

        if text is None:
            logger.error("AI text generation returned None")
            return None

        if len(text) > RATE_LIMIT['max_text_length']:
            text = text[:RATE_LIMIT['max_text_length']]

        logger.info(f"Generated AI text: {text}")
        return text
    except Exception as e:
        logger.error(f"Failed to generate AI text: {e}")
        return None

# 路由定义
@app.route('/api/test', methods=['GET'])
def api_test():
    """测试API端点"""
    return jsonify({
        'success': True,
        'message': '后端API正常工作',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/generate-text', methods=['POST'])
@api_key_required
def api_generate_text(key_obj):
    """生成新的练习文本"""
    try:
        text = generate_ai_text()
        if text is None:
            return jsonify({
                'success': False,
                'error': '文本生成失败，请联系管理员检查AI配置'
            }), 500

        return jsonify({
            'success': True,
            'text': text
        })
    except Exception as e:
        logger.error(f"Generate text error: {e}")
        return jsonify({
            'success': False,
            'error': '生成文本失败，请重试'
        }), 500

@app.route('/api/upload', methods=['POST'])
@api_key_required
@rate_limit_decorator
def api_upload(key_obj):
    """上传录音文件"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '没有音频文件'}), 400

        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        text = request.form.get('text', '').strip()
        if not text:
            return jsonify({'error': '没有文本内容'}), 400

        if len(text) > RATE_LIMIT['max_text_length']:
            return jsonify({'error': f'文本长度不能超过 {RATE_LIMIT["max_text_length"]} 字符'}), 400

        recording_id = generate_id()
        file_extension = Path(file.filename).suffix or '.webm'
        safe_filename = f"{recording_id}{file_extension}"



        file_path = os.path.join(app.config['DATA_FOLDER'], 'uploads', safe_filename)
        file.save(file_path)

        actual_content = teochew_converter.to_oral(text,auto_split=True).replace(' ', '').replace('#', '')


        # 在数据库中存储相对于backend根目录的路径
        recording = Recording(
            id=recording_id,
            file_path=os.path.join('uploads', safe_filename).replace('\\', '/'),
            original_text=text,
            actual_content=actual_content,
            ip_address=get_client_ip(),
            user_agent=request.headers.get('User-Agent', '')[:500],
            file_size=os.path.getsize(file_path)
        )

        db.session.add(recording)
        db.session.commit()

        record_upload(get_client_ip())

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

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """管理员登录"""
    if request.method == 'GET':
        if session.get('admin_logged_in'):
            return redirect(url_for('admin'))
        return render_template('admin_login.html', error=None)

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()

    if not username or not password:
        return render_template('admin_login.html', error='请输入用户名和密码')

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        session['admin_logged_in'] = True
        session.permanent = True
        logger.info(f"Admin login successful for user: {username}")
        return redirect(url_for('admin'))
    else:
        logger.warning(f"Admin login failed for user: {username}")
        return render_template('admin_login.html', error='用户名或密码错误')

@app.route('/admin/logout')
def admin_logout():
    """管理员登出"""
    session.pop('admin_logged_in', None)
    logger.info("Admin logged out")
    return redirect(url_for('admin_login'))

@app.route('/admin')
@admin_required
def admin():
    """管理界面"""
    return render_template('admin.html')

# API密钥管理路由...
@app.route('/api/keys', methods=['GET'])
def api_list_keys():
    """获取API密钥列表"""
    try:
        keys = APIKey.query.order_by(APIKey.created_time.desc()).all()
        return jsonify({
            'success': True,
            'keys': [key.to_dict() for key in keys]
        })
    except Exception as e:
        logger.error(f"List keys error: {e}")
        return jsonify({'error': '获取密钥列表失败'}), 500

@app.route('/api/keys', methods=['POST'])
def api_create_key():
    """创建新的API密钥"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        max_requests = data.get('max_requests', 1000)

        if not name:
            return jsonify({'error': '密钥名称不能为空'}), 400

        key = APIKey(
            name=name,
            key=generate_api_key(),
            description=description,
            max_requests=max_requests
        )

        db.session.add(key)
        db.session.commit()

        logger.info(f"Created new API key: {key.name}")
        return jsonify({
            'success': True,
            'key': key.to_dict()
        }), 201

    except Exception as e:
        logger.error(f"Create key error: {e}")
        db.session.rollback()
        return jsonify({'error': '创建密钥失败'}), 500


@app.route('/api/keys/<int:key_id>', methods=['PUT'])
def api_update_key(key_id):
    """更新API密钥"""
    try:
        key = APIKey.query.get_or_404(key_id)
        data = request.get_json()

        if 'name' in data:
            key.name = data['name'].strip()
        if 'description' in data:
            key.description = data['description'].strip()
        if 'max_requests' in data:
            key.max_requests = data['max_requests']
        if 'is_active' in data:
            key.is_active = data['is_active']

        db.session.commit()
        return jsonify({
            'success': True,
            'key': key.to_dict()
        })

    except Exception as e:
        logger.error(f"Update key error: {e}")
        db.session.rollback()
        return jsonify({'error': '更新密钥失败'}), 500

@app.route('/api/keys/<int:key_id>', methods=['DELETE'])
def api_delete_key(key_id):
    """删除API密钥"""
    try:
        key = APIKey.query.get_or_404(key_id)
        db.session.delete(key)
        db.session.commit()

        logger.info(f"Deleted API key: {key.name}")
        return jsonify({
            'success': True,
            'message': '密钥已删除'
        })

    except Exception as e:
        logger.error(f"Delete key error: {e}")
        db.session.rollback()
        return jsonify({'error': '删除密钥失败'}), 500

@app.route('/api/keys/<int:key_id>/reset', methods=['POST'])
def api_reset_key_usage(key_id):
    """重置API密钥使用次数"""
    try:
        key = APIKey.query.get_or_404(key_id)
        key.usage_count = 0
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '使用次数已重置'
        })

    except Exception as e:
        logger.error(f"Reset key usage error: {e}")
        db.session.rollback()
        return jsonify({'error': '重置使用次数失败'}), 500

@app.route('/api/recordings')
def api_recordings():
    """获取录音列表（管理用）"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', '')

        query = Recording.query

        if status:
            query = query.filter_by(status=status)

        recordings = query.order_by(Recording.upload_time.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'success': True,
            'recordings': [rec.to_dict() for rec in recordings.items],
            'total': recordings.total,
            'pages': recordings.pages,
            'current_page': page
        })

    except Exception as e:
        logger.error(f"Get recordings error: {e}")
        return jsonify({'error': '获取录音列表失败'}), 500

@app.route('/api/recording/<recording_id>', methods=['PUT'])
def api_update_recording(recording_id):
    """更新录音信息（管理用）"""
    try:
        recording = Recording.query.get_or_404(recording_id)
        data = request.get_json()
        old_status = recording.status

        if 'actual_content' in data:
            recording.actual_content = data['actual_content']

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
                # 获取用于访问的文件路径
                current_path = f'{app.config['DATA_FOLDER']}/' + recording.file_path

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

                target_path = move_audio_file(source_path, audio_name, new_status)

                if target_path:
                    # 存储相对于backend根目录的路径
                    base_dir = 'good' if new_status == 'approved' else 'bad'
                    s_part = audio_name[:4]  # S001
                    f_part = audio_name[4:8]  # F001
                    recording.status = new_status
                    # 构建相对于backend/data目录的路径: good/S001/F001/S001F001C001.webm
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

@app.route('/admin/api/recordings/<recording_id>', methods=['DELETE'])
@admin_required
def api_delete_recording(recording_id):
    """删除录音文件和数据库记录"""
    try:
        recording = Recording.query.get_or_404(recording_id)

        file_path = f'{app.config['DATA_FOLDER']}/' + recording.file_path
        filename = os.path.basename(file_path)

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

@app.route('/admin/api/download/<recording_id>')
@admin_required
def admin_download_recording(recording_id):
    """管理员下载/访问录音文件"""
    try:
        recording = Recording.query.get_or_404(recording_id)

        file_path = f'{app.config['DATA_FOLDER']}/' + recording.file_path

        directory = os.path.dirname(file_path)
        filename = os.path.basename(file_path)

        if not directory or not filename:
            return jsonify({'error': '文件不存在'}), 404

        is_download = request.args.get('download', 'true').lower() == 'true'

        if is_download:
            download_name = f"{recording.id}_{filename}"
            return send_from_directory(directory, filename, download_name=download_name, as_attachment=True)
        else:
            return send_from_directory(directory, filename, as_attachment=False)

    except Exception as e:
        logger.error(f"Download recording error: {e}")
        return jsonify({'error': '下载失败'}), 500


@app.route('/api/stats')
def api_stats():
    """获取统计信息"""
    try:
        total_recordings = Recording.query.count()
        pending_recordings = Recording.query.filter_by(status='pending').count()
        approved_recordings = Recording.query.filter_by(status='approved').count()
        rejected_recordings = Recording.query.filter_by(status='rejected').count()

        yesterday = datetime.utcnow() - timedelta(days=1)
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

@app.errorhandler(413)
def too_large(e):
    """文件过大错误处理"""
    return jsonify({'error': '文件太大，请选择小于16MB的文件'}), 413

@app.errorhandler(404)
def not_found(e):
    """404错误处理"""
    return jsonify({'error': '页面不存在'}), 404

@app.errorhandler(500)
def internal_error(e):
    """500错误处理"""
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': '服务器内部错误'}), 500

def cleanup_old_records():
    """清理过期的速率限制记录"""
    try:
        week_ago = datetime.utcnow() - timedelta(days=7)
        UploadRate.query.filter(UploadRate.upload_time < week_ago).delete()
        db.session.commit()
        logger.info("Cleaned up old rate limit records")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        db.session.rollback()

def create_app():
    """创建Flask应用实例"""
    return app

if __name__ == '__main__':
    with app.app_context():
        cleanup_old_records()

    app.run(host='0.0.0.0', port=5000, debug=True)