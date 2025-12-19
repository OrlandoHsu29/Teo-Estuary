#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
潮州话翻译管理接口
提供简单的增删改函数，方便在Flask后端中调用
"""

from typing import List, Dict, Optional, Tuple
from app.teo_g2p.models import TranslationDict
from app.teo_g2p.dao import TranslationDictDAO, ChangeLog
from app.teo_g2p.jieba_sync_service import JiebaSyncService

# 创建全局实例
_change_logger = ChangeLog()
_dao = TranslationDictDAO(_change_logger)
_sync_service = JiebaSyncService(change_logger=_change_logger)

def add_translation(mandarin_text: str, teochew_text: str, variant: int = 1,
                   priority: float = 1.0, user: str = "system", reason: str = "") -> bool:
    """
    添加新的翻译条目

    Args:
        mandarin_text: 普通话词语
        teochew_text: 潮州话翻译
        variant: 变体编号 (默认1)
        priority: 优先级 (默认1.0)
        user: 操作用户 (默认"system")
        reason: 添加原因 (可选)

    Returns:
        bool: 是否添加成功
    """
    return _dao.add_translation(
        mandarin_text=mandarin_text,
        teochew_text=teochew_text,
        variant=variant,
        priority=priority,
        user=user,
        reason=reason
    )

def update_translation(mandarin_text: str = None, entry_id: int = None,
                      teochew_text: str = None, variant: int = None,
                      priority: float = None, is_active: bool = None,
                      user: str = "system", reason: str = "") -> bool:
    """
    更新翻译条目（支持更新内容和状态）

    Args:
        mandarin_text: 普通话词语（可选）
        entry_id: 词条ID（可选，优先级高于mandarin_text）
        teochew_text: 新的潮州话翻译 (可选)
        variant: 新的变体编号 (可选)
        priority: 新的优先级 (可选)
        is_active: 新的状态 (可选)
        user: 操作用户 (默认"system")
        reason: 更新原因 (可选)

    Returns:
        bool: 是否更新成功
    """
    return _dao.update_translation(
        mandarin_text=mandarin_text,
        entry_id=entry_id,
        teochew_text=teochew_text,
        variant=variant,
        priority=priority,
        is_active=is_active,
        user=user,
        reason=reason
    )

def update_translation_status(entry_id: int, is_active: bool,
                            user: str = "system", reason: str = "") -> bool:
    """
    更新翻译条目的状态（向后兼容函数）

    Args:
        entry_id: 词条ID
        is_active: 是否激活
        user: 操作用户 (默认"system")
        reason: 更新原因 (可选)

    Returns:
        bool: 是否更新成功
    """
    return _dao.update_translation_status(entry_id, is_active, user, reason)

def delete_translation(mandarin_text: str, variant: int = None,
                      user: str = "system", reason: str = "") -> bool:
    """
    删除翻译条目（软删除，设置为不活跃）

    Args:
        mandarin_text: 普通话词语
        variant: 变体编号，如果为None则删除所有变体
        user: 操作用户 (默认"system")
        reason: 删除原因 (可选)

    Returns:
        bool: 是否删除成功
    """
    return _dao.delete_translation(
        mandarin_text=mandarin_text,
        variant=variant,
        user=user,
        reason=reason
    )

def get_translation(mandarin_text: str, variant: int = None) -> Optional[TranslationDict]:
    """
    获取翻译条目（常规搜索，无缓存）

    Args:
        mandarin_text: 普通话词语
        variant: 变体编号 (可选)

    Returns:
        TranslationDict: 翻译条目，如果不存在则返回None
    """
    return _dao.get_translation(mandarin_text, variant)

def search_translations(keyword: str = "", limit: int = 100, include_inactive: bool = True) -> List[TranslationDict]:
    """
    搜索翻译条目，只支持普通话搜索

    Args:
        keyword: 搜索关键词 (可选)
        limit: 返回数量限制 (默认100)
        include_inactive: 是否包含已禁用的词条 (默认为True，因为主要用于管理界面)

    Returns:
        List[TranslationDict]: 翻译条目列表
    """
    return _dao.list_translations(keyword, limit, include_inactive)

def get_translation_variants(mandarin_text: str) -> List[Tuple[int, str]]:
    """
    获取词语的所有变体翻译

    Args:
        mandarin_text: 普通话词语

    Returns:
        List[Tuple[int, str]]: [(变体编号, 潮州话翻译), ...] 的列表
    """
    from translation_service import translation_service
    return translation_service.get_word_variants(mandarin_text)

def sync_to_jieba(full_sync: bool = False) -> Dict[str, int]:
    """
    同步数据库修改到jieba_cut.txt文件

    Args:
        full_sync: 是否进行全量同步 (默认False，只进行增量同步)

    Returns:
        Dict[str, int]: 同步结果统计 {"added": 添加数量, "updated": 更新数量, "deleted": 删除数量}
    """
    if full_sync:
        return _sync_service.sync_all(force=True)
    else:
        return _sync_service.sync_incremental()

def validate_sync_status() -> Dict[str, any]:
    """
    验证数据库和jieba_cut.txt的同步状态

    Returns:
        Dict[str, any]: 验证结果 {
            "in_sync": 是否同步,
            "missing_in_jieba": 数据库有但jieba没有的词语,
            "extra_in_jieba": jieba有但数据库没有的词语,
            "db_count": 数据库词语数量,
            "jieba_count": jieba词语数量
        }
    """
    return _sync_service.validate_sync_status()

def backup_jieba_dict(backup_path: str = None) -> bool:
    """
    备份jieba_cut.txt文件

    Args:
        backup_path: 备份文件路径 (可选，默认使用时间戳命名)

    Returns:
        bool: 是否备份成功
    """
    return _sync_service.backup_jieba_dict(backup_path)

def get_change_history(limit: int = 100) -> List[Dict]:
    """
    获取数据库修改历史记录

    Args:
        limit: 返回数量限制 (默认100)

    Returns:
        List[Dict]: 修改历史记录列表
    """
    # 获取所有未同步的修改记录
    unsynced = _change_logger.get_unsynced_changes()
    # 返回最近的记录
    return unsynced[-limit:] if len(unsynced) > limit else unsynced

def add_translations_batch(words: List[Dict], user: str = "system", reason: str = "批量添加") -> Dict[str, int]:
    """
    批量添加翻译条目

    Args:
        words: 词语列表 [{"mandarin": "...", "teochew": "...", "variant": 1, "priority": 1.0}, ...]
        user: 操作用户 (默认"system")
        reason: 添加原因 (默认"批量添加")

    Returns:
        Dict[str, int]: 添加结果统计 {"success": 成功数量, "failed": 失败数量}
    """
    success_count = 0
    failed_count = 0

    for word_data in words:
        mandarin = word_data.get("mandarin", "")
        teochew = word_data.get("teochew", "")
        variant = word_data.get("variant", 1)
        priority = word_data.get("priority", 1.0)

        if add_translation(mandarin, teochew, variant, priority, user, reason):
            success_count += 1
        else:
            failed_count += 1

    return {"success": success_count, "failed": failed_count}

def delete_translations_batch(words: List[str], user: str = "system", reason: str = "批量删除") -> Dict[str, int]:
    """
    批量删除翻译条目

    Args:
        words: 要删除的普通话词语列表
        user: 操作用户 (默认"system")
        reason: 删除原因 (默认"批量删除")

    Returns:
        Dict[str, int]: 删除结果统计 {"success": 成功数量, "failed": 失败数量}
    """
    success_count = 0
    failed_count = 0

    for mandarin in words:
        if delete_translation(mandarin, user=user, reason=reason):
            success_count += 1
        else:
            failed_count += 1

    return {"success": success_count, "failed": failed_count}