"""辅助函数模块"""
import os
import uuid
import re
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


def generate_id():
    """生成固定长度的唯一ID"""
    return ''.join(str(uuid.uuid4()).split('-'))[:16].upper()


def generate_api_key():
    """生成API密钥"""
    return ''.join(str(uuid.uuid4()).split('-')) + ''.join(str(uuid.uuid4()).split('-'))


def get_next_audio_name(target_status: str, exclude_id=None):
    """
    获取下一个音频文件名
    命名规则: S{series:03d}F{folder:03d}C{clip:03d}
    例如: S001F001C001
    """
    try:
        from app.models import Recording

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


def move_audio_file(source_path, audio_name, status, data_folder):
    """
    将审核后的音频移动到相应的data目录
    """
    try:
        if status == 'approved':
            base_dir = f'{data_folder}/good'
        elif status == 'rejected':
            base_dir = f'{data_folder}/bad'
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