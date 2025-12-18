#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库-jieba词库同步服务
将数据库的修改批量同步到jieba_cut.txt文件
"""

import os
import json
import logging
from typing import List, Dict, Set, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.teo_g2p.models import TranslationDict
from app.teo_g2p.database import get_db
from app.teo_g2p.dao import ChangeLog

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JiebaSyncService:
    """jieba词典同步服务"""

    def __init__(self, jieba_file_path: str = None, change_logger: ChangeLog = None):
        """
        初始化同步服务

        Args:
            jieba_file_path: jieba_cut.txt文件路径
            change_logger: 修改日志记录器
        """
        if jieba_file_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            jieba_file_path = os.path.join(
                current_dir, '..', 'teochew_g2p', 'dict_data', 'word_dict', 'jieba_cut.txt'
            )
            jieba_file_path = os.path.normpath(jieba_file_path)

        self.jieba_file_path = jieba_file_path
        self.change_logger = change_logger or ChangeLog()

        # 确保jieba文件存在
        os.makedirs(os.path.dirname(self.jieba_file_path), exist_ok=True)
        if not os.path.exists(self.jieba_file_path):
            with open(self.jieba_file_path, 'w', encoding='utf-8') as f:
                f.write('')

    def load_current_jieba_dict(self) -> Dict[str, str]:
        """
        加载当前的jieba词典

        Returns:
            {词语: 词频} 的字典
        """
        jieba_dict = {}

        if not os.path.exists(self.jieba_file_path):
            return jieba_dict

        try:
            with open(self.jieba_file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        parts = line.split()
                        if len(parts) >= 2:
                            word = parts[0]
                            freq = parts[1]
                            jieba_dict[word] = freq
        except Exception as e:
            logger.error(f"加载jieba词典失败: {e}")

        return jieba_dict

    def save_jieba_dict(self, jieba_dict: Dict[str, str]) -> bool:
        """
        保存jieba词典到文件

        Args:
            jieba_dict: 词典字典

        Returns:
            是否保存成功
        """
        try:
            # 按词语排序
            sorted_words = sorted(jieba_dict.items(), key=lambda x: x[0])

            with open(self.jieba_file_path, 'w', encoding='utf-8') as f:
                for word, freq in sorted_words:
                    f.write(f"{word} {freq}\n")

            return True
        except Exception as e:
            logger.error(f"保存jieba词典失败: {e}")
            return False

    def get_active_translations(self) -> List[Tuple[str, str]]:
        """
        获取数据库中所有活跃的翻译条目

        Returns:
            [(普通话词语, 潮州话翻译), ...] 的列表
        """
        db = next(get_db())

        try:
            translations = db.query(TranslationDict).filter(
                TranslationDict.is_active == 1
            ).all()

            # 按优先级排序，取优先级最高的
            word_map = {}
            for t in translations:
                key = f"{t.mandarin_text}_{t.variant}"
                if key not in word_map or t.priority > word_map[key].priority:
                    word_map[key] = t

            return [(t.mandarin_text, t.teochew_text) for t in word_map.values()]

        except Exception as e:
            logger.error(f"获取活跃翻译条目失败: {e}")
            return []
        finally:
            db.close()

    def sync_all(self, force: bool = False) -> Dict[str, int]:
        """
        同步所有翻译条目到jieba词典

        Args:
            force: 是否强制同步所有条目

        Returns:
            同步结果统计 {"added": 添加数量, "updated": 更新数量, "deleted": 删除数量}
        """
        # 获取未同步的修改记录
        unsynced_changes = self.change_logger.get_unsynced_changes()

        if not force and not unsynced_changes:
            logger.info("没有需要同步的修改")
            return {"added": 0, "updated": 0, "deleted": 0}

        # 加载当前的jieba词典
        current_dict = self.load_current_jieba_dict()
        new_dict = current_dict.copy()

        # 获取数据库中的所有活跃翻译
        active_translations = self.get_active_translations()

        # 统计信息
        stats = {"added": 0, "updated": 0, "deleted": 0}
        synced_items = []

        # 处理添加和更新
        for mandarin, teochew in active_translations:
            # 使用普通话词语作为jieba词典的词
            word = mandarin
            freq = "100000"  # 默认词频

            if word in new_dict:
                # 更新现有条目
                if new_dict[word] != freq:
                    new_dict[word] = freq
                    stats["updated"] += 1
                    synced_items.append({
                        "operation": "update",
                        "word": word,
                        "freq": freq,
                        "timestamp": datetime.now().isoformat()
                    })
            else:
                # 添加新条目
                new_dict[word] = freq
                stats["added"] += 1
                synced_items.append({
                    "operation": "add",
                    "word": word,
                    "freq": freq,
                    "timestamp": datetime.now().isoformat()
                })

        # 处理删除（数据库中不存在的词语需要从jieba词典中删除）
        db_words = set(mandarin for mandarin, _ in active_translations)
        jieba_words = set(new_dict.keys())

        words_to_delete = jieba_words - db_words
        for word in words_to_delete:
            del new_dict[word]
            stats["deleted"] += 1
            synced_items.append({
                "operation": "delete",
                "word": word,
                "timestamp": datetime.now().isoformat()
            })

        # 保存更新后的词典
        if self.save_jieba_dict(new_dict):
            # 记录同步日志
            self.change_logger.log_sync(
                sync_type="full_sync",
                items=synced_items,
                status="success"
            )
            logger.info(f"同步完成: 添加{stats['added']}, 更新{stats['updated']}, 删除{stats['deleted']}")
        else:
            # 记录失败日志
            self.change_logger.log_sync(
                sync_type="full_sync",
                items=synced_items,
                status="failed",
                error_msg="保存jieba词典失败"
            )
            logger.error("同步失败: 无法保存jieba词典")
            return {"added": 0, "updated": 0, "deleted": 0}

        return stats

    def sync_incremental(self) -> Dict[str, int]:
        """
        增量同步：只同步未同步的修改

        Returns:
            同步结果统计
        """
        # 获取未同步的修改记录
        unsynced_changes = self.change_logger.get_unsynced_changes()

        if not unsynced_changes:
            logger.info("没有需要同步的修改")
            return {"added": 0, "updated": 0, "deleted": 0}

        # 加载当前的jieba词典
        current_dict = self.load_current_jieba_dict()
        new_dict = current_dict.copy()

        # 统计信息
        stats = {"added": 0, "updated": 0, "deleted": 0}
        synced_items = []

        # 按时间戳排序处理修改记录
        unsynced_changes.sort(key=lambda x: x['timestamp'])

        for change in unsynced_changes:
            operation = change['operation']
            mandarin_text = change['mandarin_text']
            timestamp = change['timestamp']

            word = mandarin_text
            freq = "100000"  # 默认词频

            if operation in ['add', 'reactivate']:
                # 添加新条目
                new_dict[word] = freq
                stats["added"] += 1
                synced_items.append({
                    "operation": "add",
                    "word": word,
                    "freq": freq,
                    "timestamp": timestamp
                })

            elif operation == 'update':
                # 更新现有条目
                if word in new_dict:
                    stats["updated"] += 1
                    synced_items.append({
                        "operation": "update",
                        "word": word,
                        "freq": freq,
                        "timestamp": timestamp
                    })

            elif operation == 'delete':
                # 删除条目
                if word in new_dict:
                    del new_dict[word]
                    stats["deleted"] += 1
                    synced_items.append({
                        "operation": "delete",
                        "word": word,
                        "timestamp": timestamp
                    })

        # 保存更新后的词典
        if self.save_jieba_dict(new_dict):
            # 记录同步日志
            self.change_logger.log_sync(
                sync_type="incremental",
                items=synced_items,
                status="success"
            )
            logger.info(f"增量同步完成: 添加{stats['added']}, 更新{stats['updated']}, 删除{stats['deleted']}")
        else:
            # 记录失败日志
            self.change_logger.log_sync(
                sync_type="incremental",
                items=synced_items,
                status="failed",
                error_msg="保存jieba词典失败"
            )
            logger.error("增量同步失败: 无法保存jieba词典")
            return {"added": 0, "updated": 0, "deleted": 0}

        return stats

    def validate_sync(self) -> Dict[str, any]:
        """
        验证同步状态

        Returns:
            验证结果 {"in_sync": 是否同步, "missing_in_jieba": 缺失的词语, "extra_in_jieba": 多余的词语}
        """
        # 获取数据库中的活跃翻译
        active_translations = self.get_active_translations()
        db_words = set(mandarin for mandarin, _ in active_translations)

        # 获取jieba词典中的词语
        jieba_dict = self.load_current_jieba_dict()
        jieba_words = set(jieba_dict.keys())

        # 计算差异
        missing_in_jieba = db_words - jieba_words
        extra_in_jieba = jieba_words - db_words

        in_sync = len(missing_in_jieba) == 0 and len(extra_in_jieba) == 0

        return {
            "in_sync": in_sync,
            "missing_in_jieba": list(missing_in_jieba),
            "extra_in_jieba": list(extra_in_jieba),
            "db_count": len(db_words),
            "jieba_count": len(jieba_words)
        }

    def backup_jieba_dict(self, backup_path: str = None) -> bool:
        """
        备份jieba词典

        Args:
            backup_path: 备份文件路径

        Returns:
            是否备份成功
        """
        if backup_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{self.jieba_file_path}.backup_{timestamp}"

        try:
            jieba_dict = self.load_current_jieba_dict()
            return self.save_jieba_dict_to_path(jieba_dict, backup_path)
        except Exception as e:
            logger.error(f"备份jieba词典失败: {e}")
            return False

    def save_jieba_dict_to_path(self, jieba_dict: Dict[str, str], file_path: str) -> bool:
        """
        保存jieba词典到指定路径

        Args:
            jieba_dict: 词典字典
            file_path: 保存路径

        Returns:
            是否保存成功
        """
        try:
            sorted_words = sorted(jieba_dict.items(), key=lambda x: x[0])

            with open(file_path, 'w', encoding='utf-8') as f:
                for word, freq in sorted_words:
                    f.write(f"{word} {freq}\n")

            return True
        except Exception as e:
            logger.error(f"保存jieba词典到指定路径失败: {e}")
            return False