#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库访问对象 (DAO)
提供数据库的增删改查操作，并记录修改日志
"""

import json
import logging
import os
from typing import Optional, List, Dict
from sqlalchemy import and_, desc, func
from app.teo_g2p.models import TranslationDict
from app.teo_g2p.database import get_db
from app.utils.datetime_utils import now_utc_isoformat

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
            logs_dir = os.path.join(current_dir, 'logs')
            os.makedirs(logs_dir, exist_ok=True)
            log_file_path = os.path.join(logs_dir, 'database_changes.log')

        self.log_file_path = log_file_path
        self.sync_log_file_path = log_file_path.replace('.log', '_sync.log')

    def log_change(self, operation: str, identifier: Dict = None,
                   old_data: Dict = None, new_data: Dict = None,
                   user: str = "system", reason: str = "") -> bool:
        """
        记录数据库修改日志

        Args:
            operation: 操作类型 (add/update/delete/activate/deactivate)
            identifier: 词条唯一标识 (mandarin_text, variant)
            old_data: 修改前的完整数据
            new_data: 修改后的完整数据
            user: 操作用户
            reason: 修改原因

        Returns:
            是否记录成功
        """
        try:
            log_entry = {
                "timestamp": now_utc_isoformat(),
                "operation": operation,
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

            identifier_str = f"{identifier.get('mandarin_text', 'unknown')}"
            if identifier.get('variant'):
                identifier_str += f" (variant: {identifier['variant']})"
            logger.info(f"记录修改日志: {operation} - {identifier_str}")
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

    def _normalize_log_entry(self, log_entry: Dict) -> Dict:
        """
        标准化日志条目格式

        Args:
            log_entry: 原始日志条目

        Returns:
            标准化后的日志条目
        """
        # 如果已经是新格式（有identifier字段），直接返回
        if 'identifier' in log_entry:
            return log_entry

        # 转换旧格式为新格式（如果存在）
        if 'mandarin_text' in log_entry:
            old_data = log_entry.get('old_data')
            new_data = log_entry.get('new_data')

            # 从字段中提取identifier信息
            identifier = {
                'mandarin_text': log_entry.get('mandarin_text')
            }

            # 优先使用新字段名
            if 'variant_mandarin' in log_entry:
                identifier['variant_mandarin'] = log_entry.get('variant_mandarin')

            # 清理identifier中的None值
            identifier = {k: v for k, v in identifier.items() if v is not None}

            # 转换为新格式
            normalized = {
                'timestamp': log_entry['timestamp'],
                'operation': log_entry['operation'],
                'identifier': identifier,
                'changes': {
                    'old': old_data,
                    'new': new_data
                },
                'user': log_entry.get('user', 'system'),
                'reason': log_entry.get('reason', '')
            }

            return normalized

        return log_entry

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
                            # 标准化日志格式
                            normalized_log = self._normalize_log_entry(change_log)
                            unsynced_changes.append(normalized_log)
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

    def add_translation(self, mandarin_text: str, teochew_text: str,
                       variant_mandarin: int = 1, variant_teochew: int = None,
                       teochew_priority: int = None, user: str = "system", reason: str = "") -> bool:
        """
        添加新的翻译条目

        Args:
            mandarin_text: 普通话词语
            teochew_text: 潮州话翻译
            variant_mandarin: 普通话方向的变体编号
            variant_teochew: 潮州话方向的变体编号（可选，默认自动计算）
            teochew_priority: 潮州话翻译优先级 1-10整数
            user: 操作用户
            reason: 添加原因

        Returns:
            是否添加成功
        """
        db = next(get_db())

        try:
            # 检查是否已存在（按mandarin_text和teochew_text的组合检查）
            existing = db.query(TranslationDict).filter(
                and_(
                    TranslationDict.mandarin_text == mandarin_text,
                    TranslationDict.teochew_text == teochew_text
                )
            ).first()

            if existing:
                logger.warning(f"翻译条目已存在: {mandarin_text} -> {teochew_text}")
                return False
            else:
                # 如果没有指定variant_mandarin，自动计算
                # 查找相同mandarin_text的最大variant_mandarin值
                max_mandarin_variant = db.query(func.max(TranslationDict.variant_mandarin)).filter(
                    TranslationDict.mandarin_text == mandarin_text
                ).scalar()
                variant_mandarin = (max_mandarin_variant or 0) + 1

                # 如果没有指定variant_teochew，自动计算
                # 查找相同teochew_text的最大variant_teochew值
                max_teochew_variant = db.query(func.max(TranslationDict.variant_teochew)).filter(
                    TranslationDict.teochew_text == teochew_text
                ).scalar()
                variant_teochew = (max_teochew_variant or 0) + 1

                # 创建新记录
                translation = TranslationDict(
                    mandarin_text=mandarin_text,
                    teochew_text=teochew_text,
                    variant_mandarin=variant_mandarin,
                    variant_teochew=variant_teochew,
                    teochew_priority=teochew_priority,
                    is_active=1
                )
                db.add(translation)

                new_data = {
                    "mandarin_text": mandarin_text,
                    "teochew_text": teochew_text,
                    "variant_mandarin": variant_mandarin,
                    "variant_teochew": variant_teochew,
                    "teochew_priority": teochew_priority,
                    "is_active": 1
                }

                self.change_logger.log_change(
                    operation="add",
                    identifier={"mandarin_text": mandarin_text, "variant_mandarin": variant_mandarin},
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

    def update_translation(self, mandarin_text: str = None, entry_id: int = None,
                          teochew_text: str = None, variant_mandarin: int = None,
                          variant_teochew: int = None, teochew_priority: int = None,
                          is_active: bool = None,
                          user: str = "system", reason: str = "") -> bool:
        """
        更新翻译条目（支持更新内容和状态）

        Args:
            mandarin_text: 普通话词语（通过mandarin_text查找记录）
            entry_id: 词条ID（通过ID查找记录，优先级高于mandarin_text）
            teochew_text: 新的潮州话翻译
            variant_mandarin: 新的普通话方向变体编号
            variant_teochew: 新的潮州话方向变体编号
            teochew_priority: 新的潮州话翻译优先级 1-10整数
            is_active: 新的状态（None表示不更新状态）
            user: 操作用户
            reason: 修改原因

        Returns:
            是否更新成功
        """
        db = next(get_db())

        try:
            # 查找要更新的记录
            if entry_id is not None:
                translation = db.query(TranslationDict).filter(TranslationDict.id == entry_id).first()
                if not translation:
                    logger.warning(f"未找到要更新的翻译条目 (ID): {entry_id}")
                    return False
                translations = [translation]
            elif mandarin_text is not None:
                query = db.query(TranslationDict).filter(
                    TranslationDict.mandarin_text == mandarin_text
                )

                if variant_mandarin is not None:
                    query = query.filter(TranslationDict.variant_mandarin == variant_mandarin)

                translations = query.all()

                if not translations:
                    logger.warning(f"未找到要更新的翻译条目: {mandarin_text}")
                    return False
            else:
                logger.warning("必须提供mandarin_text或entry_id参数")
                return False

            # 更新每条记录
            for translation in translations:
                old_priority = getattr(translation, 'teochew_priority', None)

                old_data = {
                    "mandarin_text": translation.mandarin_text,
                    "teochew_text": translation.teochew_text,
                    "variant_mandarin": translation.variant_mandarin,
                    "variant_teochew": translation.variant_teochew,
                    "teochew_priority": old_priority,
                    "is_active": translation.is_active
                }

                # 更新内容字段
                if mandarin_text is not None:
                    translation.mandarin_text = mandarin_text
                if teochew_text is not None:
                    translation.teochew_text = teochew_text
                if variant_mandarin is not None:
                    translation.variant_mandarin = variant_mandarin
                if variant_teochew is not None:
                    translation.variant_teochew = variant_teochew
                if teochew_priority is not None:
                    translation.teochew_priority = teochew_priority
                if is_active is not None:
                    translation.is_active = is_active

                new_data = {
                    "mandarin_text": translation.mandarin_text,
                    "teochew_text": translation.teochew_text,
                    "variant_mandarin": translation.variant_mandarin,
                    "variant_teochew": translation.variant_teochew,
                    "teochew_priority": translation.teochew_priority,
                    "is_active": translation.is_active
                }

                # 根据更新内容确定操作类型
                operation = "update"
                if all(x is None for x in [teochew_text, variant_mandarin, variant_teochew]) and is_active is not None:
                    operation = "status_update"

                self.change_logger.log_change(
                    operation=operation,
                    identifier={"mandarin_text": translation.mandarin_text, "variant_mandarin": translation.variant_mandarin},
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

    def delete_translation(self, mandarin_text: str, variant_mandarin: int = None,
                          user: str = "system", reason: str = "") -> bool:
        """
        删除翻译条目（直接删除）

        Args:
            mandarin_text: 普通话词语
            variant_mandarin: 变体编号，如果为None则删除所有变体
            user: 操作用户
            reason: 删除原因

        Returns:
            是否删除成功
        """
        db = next(get_db())

        try:
            # 查找要删除的记录（包括已禁用的词条）
            query = db.query(TranslationDict).filter(
                TranslationDict.mandarin_text == mandarin_text
            )

            if variant_mandarin is not None:
                query = query.filter(TranslationDict.variant_mandarin == variant_mandarin)

            translations = query.all()

            if not translations:
                logger.warning(f"未找到要删除的翻译条目: {mandarin_text}")
                return False

            # 统一删除：直接删除记录
            for translation in translations:
                old_data = {
                    "mandarin_text": translation.mandarin_text,
                    "teochew_text": translation.teochew_text,
                    "variant_mandarin": translation.variant_mandarin,
                    "variant_teochew": translation.variant_teochew,
                    "teochew_priority": translation.teochew_priority,
                    "is_active": translation.is_active
                }

                # 直接删除记录
                db.delete(translation)
                new_data = {
                    "is_active": translation.is_active,
                    "deleted": True
                }

                self.change_logger.log_change(
                    operation="delete",
                    identifier={"mandarin_text": mandarin_text, "variant_mandarin": translation.variant_mandarin},
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

    def get_translation(self, mandarin_text: str, variant_mandarin: int = None) -> Optional[TranslationDict]:
        """
        获取翻译条目

        Args:
            mandarin_text: 普通话词语
            variant_mandarin: 变体编号

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

            if variant_mandarin is not None:
                query = query.filter(TranslationDict.variant_mandarin == variant_mandarin)

            return query.first()

        except Exception as e:
            logger.error(f"获取翻译条目失败: {e}")
            return None
        finally:
            db.close()

    def get_translation_by_id(self, entry_id: int) -> Optional[TranslationDict]:
        """
        根据ID获取翻译条目

        Args:
            entry_id: 词条ID

        Returns:
            翻译条目或None
        """
        db = next(get_db())

        try:
            return db.query(TranslationDict).filter(TranslationDict.id == entry_id).first()
        except Exception as e:
            logger.error(f"根据ID获取翻译条目失败: {e}")
            return None
        finally:
            db.close()

    def update_translation_status(self, entry_id: int, is_active: bool, user: str = "system", reason: str = "") -> bool:
        """
        更新翻译条目的状态

        Args:
            entry_id: 词条ID
            is_active: 是否激活
            user: 操作用户
            reason: 修改原因

        Returns:
            是否更新成功
        """
        db = next(get_db())

        try:
            translation = db.query(TranslationDict).filter(TranslationDict.id == entry_id).first()
            if not translation:
                logger.warning(f"未找到要更新的翻译条目: {entry_id}")
                return False

            old_data = {
                "mandarin_text": translation.mandarin_text,
                "is_active": translation.is_active
            }

            translation.is_active = 1 if is_active else 0

            new_data = {
                "mandarin_text": translation.mandarin_text,
                "is_active": translation.is_active
            }

            self.change_logger.log_change(
                operation="status_update",
                identifier={"mandarin_text": translation.mandarin_text, "variant_mandarin": translation.variant_mandarin},
                old_data=old_data,
                new_data=new_data,
                user=user,
                reason=reason
            )

            db.commit()
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"更新翻译条目状态失败: {e}")
            return False
        finally:
            db.close()

    def list_translations(self, keyword: str = None, limit: int = 100, include_inactive: bool = True) -> List[TranslationDict]:
        """
        列出翻译条目，只支持普通话搜索

        Args:
            keyword: 搜索关键词，只支持普通话 (可选)
            limit: 返回数量限制
            include_inactive: 是否包含已禁用的词条（默认为True，因为主要用于管理界面）

        Returns:
            翻译条目列表
        """
        db = next(get_db())

        try:
            # 根据include_inactive参数决定是否过滤已禁用词条
            if include_inactive:
                # 管理员界面：显示所有词条（包括已禁用的）
                query = db.query(TranslationDict)
            else:
                # 其他界面：只显示启用的词条
                query = db.query(TranslationDict).filter(TranslationDict.is_active == 1)

            if keyword:
                # 只支持普通话搜索
                query = query.filter(TranslationDict.mandarin_text.like(f'%{keyword}%'))

            # 按优先级降序排序（优先级高的在前）
            return query.order_by(desc(TranslationDict.teochew_priority)).limit(limit).all()

        except Exception as e:
            logger.error(f"列出翻译条目失败: {e}")
            return []
        finally:
            db.close()