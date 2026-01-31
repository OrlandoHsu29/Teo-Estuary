#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
增强的修改日志记录器
支持更细化的记录类型，包括潮汕话文本更新和属性更新
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from app.utils.datetime_utils import now_utc_isoformat

logger = logging.getLogger(__name__)

class EnhancedChangeLogger:
    """增强的修改日志记录器"""

    def __init__(self, log_file_path: str = None):
        """
        初始化日志记录器

        Args:
            log_file_path: 日志文件路径，如果为None则使用默认路径
        """
        if log_file_path is None:
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            logs_dir = os.path.join(current_dir, '..', 'teo_g2p', 'logs')
            os.makedirs(logs_dir, exist_ok=True)
            log_file_path = os.path.join(logs_dir, 'database_changes.log')

        self.log_file_path = log_file_path
        self.sync_log_file_path = log_file_path.replace('.log', '_sync.log')

    def log_recording_change(self, operation: str, recording_id: str,
                           identifier: Dict = None, old_data: Dict = None,
                           new_data: Dict = None, user: str = "system",
                           reason: str = "", change_type: str = "general") -> bool:
        """
        记录录音数据的修改日志

        Args:
            operation: 操作类型 (add/update/delete)
            recording_id: 录音ID
            identifier: 词条唯一标识 (针对潮汕话文本)
            old_data: 修改前的数据
            new_data: 修改后的数据
            user: 操作用户
            reason: 修改原因
            change_type: 变更类型 ("teochew_text_update", "property_update", "general")

        Returns:
            是否记录成功
        """
        try:
            log_entry = {
                "timestamp": now_utc_isoformat(),
                "operation": operation,
                "recording_id": recording_id,
                "change_type": change_type,
                "identifier": identifier or {},
                "changes": {
                    "old": old_data,
                    "new": new_data
                },
                "user": user,
                "reason": reason
            }

            # 写入日志文件
            with open(self.log_file_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

            # 根据变更类型记录不同的日志信息
            if change_type == "teochew_text_update":
                logger.info(f"记录潮汕话文本更新日志: {recording_id} - {operation}")
            elif change_type == "property_update":
                logger.info(f"记录属性更新日志: {recording_id} - {operation}")
            else:
                logger.info(f"记录通用修改日志: {recording_id} - {operation}")

            return True

        except Exception as e:
            logger.error(f"记录修改日志失败: {e}")
            return False

    def log_sync_operation(self, sync_type: str, items: List[Dict],
                          status: str = "success", error_msg: str = "") -> bool:
        """
        记录同步操作日志

        Args:
            sync_type: 同步类型 (merge/clear等)
            items: 同步的项目列表
            status: 同步状态 (success/failed)
            error_msg: 错误信息

        Returns:
            是否记录成功
        """
        try:
            log_entry = {
                "timestamp": now_utc_isoformat(),
                "operation": "sync",
                "sync_type": sync_type,
                "items_count": len(items),
                "items": items,
                "status": status,
                "error_message": error_msg
            }

            # 写入同步日志文件
            with open(self.sync_log_file_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

            logger.info(f"记录同步日志: {sync_type} - {len(items)} 项")
            return True

        except Exception as e:
            logger.error(f"记录同步日志失败: {e}")
            return False

    def get_latest_teochew_text_update_time(self) -> Optional[datetime]:
        """
        获取最新的潮汕话文本更新时间

        Returns:
            最新的潮汕话文本更新时间，如果没有则返回None
        """
        latest_time = None

        try:
            if os.path.exists(self.log_file_path):
                with open(self.log_file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            log_entry = json.loads(line.strip())
                            # 只关注潮汕话文本相关的更新
                            if log_entry.get('change_type') in ['teochew_text_update', 'add', 'delete']:
                                timestamp = log_entry.get('timestamp')
                                if timestamp:
                                    current_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                    if latest_time is None or current_time > latest_time:
                                        latest_time = current_time
        except Exception as e:
            logger.error(f"获取最新潮汕话文本更新时间失败: {e}")

        return latest_time

    def get_latest_sync_time(self) -> Optional[datetime]:
        """
        获取最新的同步操作时间

        Returns:
            最新的同步操作时间，如果没有则返回None
        """
        latest_time = None

        try:
            if os.path.exists(self.sync_log_file_path):
                with open(self.sync_log_file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            log_entry = json.loads(line.strip())
                            # 只关注成功的同步操作
                            if log_entry.get('status') == 'success':
                                timestamp = log_entry.get('timestamp')
                                if timestamp:
                                    current_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                    if latest_time is None or current_time > latest_time:
                                        latest_time = current_time
        except Exception as e:
            logger.error(f"获取最新同步时间失败: {e}")

        return latest_time

    def is_sync_needed(self) -> bool:
        """
        检查是否需要同步

        Returns:
            是否需要同步（True表示有未同步的更改）
        """
        latest_update_time = self.get_latest_teochew_text_update_time()
        latest_sync_time = self.get_latest_sync_time()

        # 如果没有同步记录，或者有更新的更改未同步，则需要同步
        if latest_sync_time is None:
            return latest_update_time is not None
        else:
            return latest_update_time is not None and latest_update_time > latest_sync_time