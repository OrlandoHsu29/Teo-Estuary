#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
未同步操作日志服务
处理获取未同步的操作日志
"""

import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

# 定义中国时区 (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))

logger = logging.getLogger(__name__)

class UnsyncedLogsService:
    """未同步操作日志服务"""

    def __init__(self, log_file_path: str = None, sync_log_file_path: str = None):
        """
        初始化服务

        Args:
            log_file_path: database_changes.log文件路径
            sync_log_file_path: database_changes_sync.log文件路径
        """
        if log_file_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            logs_dir = os.path.join(current_dir, 'logs')
            os.makedirs(logs_dir, exist_ok=True)
            log_file_path = os.path.join(logs_dir, 'database_changes.log')

        if sync_log_file_path is None:
            sync_log_file_path = log_file_path.replace('.log', '_sync.log')

        self.log_file_path = log_file_path
        self.sync_log_file_path = sync_log_file_path

    def get_latest_sync_time(self) -> datetime:
        """
        获取最新的同步时间

        Returns:
            最新的同步时间，如果没有同步记录则返回带时区的最小时间
        """
        latest_time = datetime(1970, 1, 1, tzinfo=CHINA_TZ)

        try:
            if os.path.exists(self.sync_log_file_path):
                with open(self.sync_log_file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                log_entry = json.loads(line.strip())
                                # 只关注成功的同步操作
                                if log_entry.get('status') == 'success':
                                    timestamp = log_entry.get('timestamp')
                                    if timestamp:
                                        current_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                        if current_time > latest_time:
                                            latest_time = current_time
                            except json.JSONDecodeError as e:
                                logger.warning(f"解析同步日志条目失败: {e}")
                                continue
        except Exception as e:
            logger.error(f"获取最新同步时间失败: {e}")

        return latest_time

    def get_unsynced_logs(self, exclude_property_updates: bool = True) -> List[Dict]:
        """
        获取所有未同步的操作日志

        Args:
            exclude_property_updates: 是否排除属性更新记录（只修改priority、variant、is_active的update记录）

        Returns:
            未同步的操作日志列表
        """
        latest_sync_time = self.get_latest_sync_time()
        unsynced_logs = []

        try:
            if os.path.exists(self.log_file_path):
                with open(self.log_file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                log_entry = json.loads(line.strip())
                                timestamp = log_entry.get('timestamp')
                                if timestamp:
                                    current_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                    # 只返回比最新同步时间晚的记录
                                    if current_time > latest_sync_time:
                                        # 检查是否需要排除属性更新
                                        if exclude_property_updates:
                                            change_type = log_entry.get('change_type')
                                            operation = log_entry.get('operation')

                                            # 排除属性更新类型的记录
                                            if change_type == 'property_update' or (operation == 'update' and change_type != 'teochew_text_update'):
                                                continue

                                        unsynced_logs.append(log_entry)
                            except json.JSONDecodeError as e:
                                logger.warning(f"解析变更日志条目失败: {e}")
                                continue
        except Exception as e:
            logger.error(f"获取未同步日志失败: {e}")

        # 按时间倒序排列（最新的在上面）
        unsynced_logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

        return unsynced_logs

    def get_unsynced_count(self) -> int:
        """
        获取需要同步的操作数量（排除属性更新）

        Returns:
            需要同步的操作数量
        """
        unsynced_logs = self.get_unsynced_logs(exclude_property_updates=True)
        return len(unsynced_logs)

    def is_sync_needed(self) -> bool:
        """
        检查是否需要同步

        Returns:
            是否需要同步（True表示有未同步的更改）
        """
        latest_sync_time = self.get_latest_sync_time()
        # 获取未同步日志时排除属性更新
        unsynced_logs = self.get_unsynced_logs(exclude_property_updates=True)

        # 如果没有同步记录，或者有未同步的日志，则需要同步
        if latest_sync_time == datetime(1970, 1, 1, tzinfo=CHINA_TZ):
            return len(unsynced_logs) > 0
        else:
            return len(unsynced_logs) > 0