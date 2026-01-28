"""数据库模型"""
import os
from datetime import datetime
from app import db
from app.utils.timezone import now


class Recording(db.Model):
    __tablename__ = 'recordings'

    id = db.Column(db.String(32), primary_key=True)
    file_path = db.Column(db.String(500), nullable=False)
    mandarin_text = db.Column(db.String(300), nullable=False, unique=True)  # 普通话文本唯一
    teochew_text = db.Column(db.String(300), unique=True)  # 潮州话文本唯一
    upload_time = db.Column(db.DateTime, default=now)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(500))
    file_size = db.Column(db.Integer)
    duration = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    upload_type = db.Column(db.Integer, nullable=False)  # 0: 录音上传, 1: 素材提取 (不允许为空)
    reviewed_at = db.Column(db.DateTime)  # 审核操作时间（approved或rejected的时间）

    def to_dict(self):
        from app.utils.timezone import format_time
        return {
            'id': self.id,
            'filename': os.path.basename(self.file_path) if self.file_path else None,
            'file_path': self.file_path,
            'mandarin_text': self.mandarin_text,
            'teochew_text': self.teochew_text,
            'upload_time': self.upload_time.isoformat(),
            'upload_time_formatted': format_time(self.upload_time),
            'ip_address': self.ip_address,
            'file_size': self.file_size,
            'duration': self.duration,
            'status': self.status,
            'upload_type': self.upload_type,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None
        }


class APIKey(db.Model):
    __tablename__ = 'api_keys'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    key = db.Column(db.String(64), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_time = db.Column(db.DateTime, default=now)
    last_used = db.Column(db.DateTime)
    usage_count = db.Column(db.Integer, default=0)
    max_requests = db.Column(db.Integer, default=1000)  # 每天最大请求次数

    def to_dict(self):
        from app.utils.timezone import format_time
        return {
            'id': self.id,
            'name': self.name,
            'key': self.key,
            'description': self.description,
            'is_active': self.is_active,
            'created_time': self.created_time.isoformat(),
            'created_time_formatted': format_time(self.created_time),
            'last_used': self.last_used.isoformat() if self.last_used else None,
            'last_used_formatted': format_time(self.last_used) if self.last_used else None,
            'usage_count': self.usage_count,
            'max_requests': self.max_requests
        }


class ReferenceText(db.Model):
    """参考话语表 - 存储示例对话数据"""
    __tablename__ = 'reference_text'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    discourse = db.Column(db.String(100), nullable=False, unique=True)  # 话语内容，最多100字符，唯一
    created_time = db.Column(db.DateTime, default=now)  # 创建时间

    def to_dict(self):
        from app.utils.timezone import format_time
        return {
            'id': self.id,
            'discourse': self.discourse,
            'created_time': self.created_time.isoformat(),
            'created_time_formatted': format_time(self.created_time)
        }