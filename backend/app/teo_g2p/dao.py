#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库访问对象 (DAO)
提供数据库的增删改查操作，并记录修改日志
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from models import TranslationDict
from database import get_db

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChangeLog:
    """修改日志记录类"""

    def __init__(self, log_file_path: str = None):
        """
        初始化日志记录器

        Args:
            log_file_path: 日志文件路径，如果为None则使用默认路径
        """
        if log_file_path is None:
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            log_file_path = os.path.join(current_dir, 'database_changes.log')

        self.log_file_path = log_file_path
        self.sync_log_file_path = log_file_path.replace('.log', '_sync.log')

    def log_change(self, operation: str, mandarin_text: str, teochew_text: str = None,
                   variant: int = None, old_data: Dict = None, new_data: Dict = None,
                   user: str = "system", reason: str = "") -> bool:
        """
        记录数据库修改日志

        Args:
            operation: 操作类型 (add/update/delete/activate/deactivate)
            mandarin_text: 普通话词语
            teochew_text: 潮州话翻译
            variant: 变体编号
            old_data: 修改前的数据
            new_data: 修改后的数据
            user: 操作用户
            reason: 修改原因

        Returns:
            是否记录成功
        """
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "operation": operation,
                "mandarin_text": mandarin_text,
                "teochew_text": teochew_text,
                "variant": variant,
                "old_data": old_data,
                "new_data": new_data,
                "user": user,
                "reason": reason
            }

            # 写入日志文件
            with open(self.log_file_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

            logger.info(f"记录修改日志: {operation} - {mandarin_text}")
            return True

        except Exception as e:
            logger.error(f"记录修改日志失败: {e}")
            return False

    def log_sync(self, sync_type: str, items: List[Dict], status: str = "success",
                 error_msg: str = "") -> bool:
        """
        记录同步操作日志

        Args:
            sync_type: 同步类型 (add/update/delete)
            items: 同步的项目列表
            status: 同步状态 (success/failed)
            error_msg: 错误信息

        Returns:
            是否记录成功
        """
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
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

    def get_unsynced_changes(self) -> List[Dict]:
        """
        获取未同步的修改记录

        Returns:
            未同步的修改记录列表
        """
        synced_ids = set()
        unsynced_changes = []

        # 读取已同步的记录ID
        try:
            if os.path.exists(self.sync_log_file_path):
                with open(self.sync_log_file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            sync_log = json.loads(line.strip())
                            if sync_log.get('status') == 'success':
                                for item in sync_log.get('items', []):
                                    if 'timestamp' in item:
                                        synced_ids.add(item['timestamp'])
        except Exception as e:
            logger.error(f"读取同步日志失败: {e}")

        # 读取所有修改记录，筛选出未同步的
        try:
            with open(self.log_file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        change_log = json.loads(line.strip())
                        if change_log['timestamp'] not in synced_ids:
                            unsynced_changes.append(change_log)
        except Exception as e:
            logger.error(f"读取修改日志失败: {e}")

        return unsynced_changes

class TranslationDictDAO:
    """翻译词典数据访问对象"""

    def __init__(self, change_logger: ChangeLog = None):
        """
        初始化DAO

        Args:
            change_logger: 修改日志记录器
        """
        self.change_logger = change_logger or ChangeLog()

    def add_translation(self, mandarin_text: str, teochew_text: str, variant: int = 1,
                       priority: float = 1.0, user: str = "system", reason: str = "") -> bool:
        """
        添加新的翻译条目

        Args:
            mandarin_text: 普通话词语
            teochew_text: 潮州话翻译
            variant: 变体编号
            priority: 优先级
            user: 操作用户
            reason: 添加原因

        Returns:
            是否添加成功
        """
        db = next(get_db())

        try:
            # 检查是否已存在
            existing = db.query(TranslationDict).filter(
                and_(
                    TranslationDict.mandarin_text == mandarin_text,
                    TranslationDict.variant == variant
                )
            ).first()

            if existing:
                if existing.is_active == 1:
                    logger.warning(f"翻译条目已存在: {mandarin_text} (变体: {variant})")
                    return False
                else:
                    # 重新激活已禁用的条目
                    old_data = {
                        "teochew_text": existing.teochew_text,
                        "priority": existing.priority,
                        "is_active": 0
                    }

                    existing.teochew_text = teochew_text
                    existing.priority = priority
                    existing.word_length = len(mandarin_text)
                    existing.is_active = 1

                    new_data = {
                        "teochew_text": teochew_text,
                        "priority": priority,
                        "is_active": 1
                    }

                    self.change_logger.log_change(
                        operation="reactivate",
                        mandarin_text=mandarin_text,
                        teochew_text=teochew_text,
                        variant=variant,
                        old_data=old_data,
                        new_data=new_data,
                        user=user,
                        reason=reason
                    )
            else:
                # 创建新记录
                translation = TranslationDict(
                    mandarin_text=mandarin_text,
                    teochew_text=teochew_text,
                    variant=variant,
                    priority=priority,
                    word_length=len(mandarin_text),
                    is_active=1
                )
                db.add(translation)

                new_data = {
                    "teochew_text": teochew_text,
                    "priority": priority,
                    "is_active": 1
                }

                self.change_logger.log_change(
                    operation="add",
                    mandarin_text=mandarin_text,
                    teochew_text=teochew_text,
                    variant=variant,
                    new_data=new_data,
                    user=user,
                    reason=reason
                )

            db.commit()
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"添加翻译条目失败: {e}")
            return False
        finally:
            db.close()

    def update_translation(self, mandarin_text: str, teochew_text: str = None,
                          variant: int = None, priority: float = None,
                          user: str = "system", reason: str = "") -> bool:
        """
        更新翻译条目

        Args:
            mandarin_text: 普通话词语
            teochew_text: 新的潮州话翻译
            variant: 新的变体编号
            priority: 新的优先级
            user: 操作用户
            reason: 修改原因

        Returns:
            是否更新成功
        """
        db = next(get_db())

        try:
            # 查找要更新的记录
            query = db.query(TranslationDict).filter(
                TranslationDict.mandarin_text == mandarin_text,
                TranslationDict.is_active == 1
            )

            if variant is not None:
                query = query.filter(TranslationDict.variant == variant)

            translations = query.all()

            if not translations:
                logger.warning(f"未找到要更新的翻译条目: {mandarin_text}")
                return False

            # 更新每条记录
            for translation in translations:
                old_data = {
                    "teochew_text": translation.teochew_text,
                    "variant": translation.variant,
                    "priority": translation.priority
                }

                if teochew_text is not None:
                    translation.teochew_text = teochew_text
                if variant is not None:
                    translation.variant = variant
                if priority is not None:
                    translation.priority = priority

                new_data = {
                    "teochew_text": translation.teochew_text,
                    "variant": translation.variant,
                    "priority": translation.priority
                }

                self.change_logger.log_change(
                    operation="update",
                    mandarin_text=mandarin_text,
                    teochew_text=translation.teochew_text,
                    variant=translation.variant,
                    old_data=old_data,
                    new_data=new_data,
                    user=user,
                    reason=reason
                )

            db.commit()
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"更新翻译条目失败: {e}")
            return False
        finally:
            db.close()

    def delete_translation(self, mandarin_text: str, variant: int = None,
                          user: str = "system", reason: str = "") -> bool:
        """
        删除翻译条目（软删除，设置为不活跃）

        Args:
            mandarin_text: 普通话词语
            variant: 变体编号，如果为None则删除所有变体
            user: 操作用户
            reason: 删除原因

        Returns:
            是否删除成功
        """
        db = next(get_db())

        try:
            # 查找要删除的记录
            query = db.query(TranslationDict).filter(
                and_(
                    TranslationDict.mandarin_text == mandarin_text,
                    TranslationDict.is_active == 1
                )
            )

            if variant is not None:
                query = query.filter(TranslationDict.variant == variant)

            translations = query.all()

            if not translations:
                logger.warning(f"未找到要删除的翻译条目: {mandarin_text}")
                return False

            # 软删除：设置为不活跃
            for translation in translations:
                old_data = {
                    "teochew_text": translation.teochew_text,
                    "variant": translation.variant,
                    "priority": translation.priority,
                    "is_active": 1
                }

                translation.is_active = 0

                new_data = {
                    "is_active": 0
                }

                self.change_logger.log_change(
                    operation="delete",
                    mandarin_text=mandarin_text,
                    teochew_text=translation.teochew_text,
                    variant=translation.variant,
                    old_data=old_data,
                    new_data=new_data,
                    user=user,
                    reason=reason
                )

            db.commit()
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"删除翻译条目失败: {e}")
            return False
        finally:
            db.close()

    def get_translation(self, mandarin_text: str, variant: int = None) -> Optional[TranslationDict]:
        """
        获取翻译条目

        Args:
            mandarin_text: 普通话词语
            variant: 变体编号

        Returns:
            翻译条目或None
        """
        db = next(get_db())

        try:
            query = db.query(TranslationDict).filter(
                and_(
                    TranslationDict.mandarin_text == mandarin_text,
                    TranslationDict.is_active == 1
                )
            )

            if variant is not None:
                query = query.filter(TranslationDict.variant == variant)

            return query.first()

        except Exception as e:
            logger.error(f"获取翻译条目失败: {e}")
            return None
        finally:
            db.close()

    def list_translations(self, mandarin_text: str = None, limit: int = 100) -> List[TranslationDict]:
        """
        列出翻译条目

        Args:
            mandarin_text: 普通话词语过滤
            limit: 返回数量限制

        Returns:
            翻译条目列表
        """
        db = next(get_db())

        try:
            query = db.query(TranslationDict).filter(TranslationDict.is_active == 1)

            if mandarin_text:
                query = query.filter(TranslationDict.mandarin_text.like(f'%{mandarin_text}%'))

            return query.order_by(desc(TranslationDict.priority)).limit(limit).all()

        except Exception as e:
            logger.error(f"列出翻译条目失败: {e}")
            return []
        finally:
            db.close()