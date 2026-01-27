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
from app.teo_g2p.jieba_temp_manager import JiebaTempManager

# 创建全局实例
_change_logger = ChangeLog()
_dao = TranslationDictDAO(_change_logger)
_sync_service = JiebaSyncService(change_logger=_change_logger)
_jieba_manager = JiebaTempManager()

def add_translation(mandarin_text: str, teochew_text: str,
                   teochew_priority: int = None, user: str = "system", reason: str = "",
                   variant_mandarin: int = None, variant_teochew: int = None) -> bool:
    """
    添加新的翻译条目

    Args:
        mandarin_text: 普通话词语
        teochew_text: 潮州话翻译
        teochew_priority: 潮州话翻译优先级 1-10整数 (可选，未提供则自动计算)
        user: 操作用户 (默认"system")
        reason: 添加原因 (可选)
        variant_mandarin: 普通话方向变体编号 (可选，默认使用variant值)
        variant_teochew: 潮州话方向变体编号 (可选，默认自动计算)

    Returns:
        bool: 是否添加成功
    """

    # 自动计算priority：如果未提供，根据潮汕话词语长度设置
    if teochew_priority is None:
        word_len = len(teochew_text)
        teochew_priority = min(word_len, 10)  # 1字=1, 2字=2, ..., 最大10

    success = _dao.add_translation(
        mandarin_text=mandarin_text,
        teochew_text=teochew_text,
        variant_mandarin=variant_mandarin,
        variant_teochew=variant_teochew,
        teochew_priority=teochew_priority,
        user=user,
        reason=reason
    )

    if success:
        # 将潮汕话翻译结果添加到jieba_cut_temp.txt
        if teochew_text:
            # 分词处理每个潮汕话词汇
            teochew_words = [word.strip() for word in teochew_text.split() if word.strip()]
            for word in teochew_words:
                _jieba_manager.add_word(word)

    return success

def update_translation(mandarin_text: str = None, entry_id: int = None,
                      teochew_text: str = None, variant: int = None,
                      teochew_priority: int = None, is_active: bool = None,
                      user: str = "system", reason: str = "",
                      variant_mandarin: int = None, variant_teochew: int = None) -> bool:
    """
    更新翻译条目（支持更新内容和状态）

    Args:
        mandarin_text: 普通话词语（可选）
        entry_id: 词条ID（可选，优先级高于mandarin_text）
        teochew_text: 新的潮州话翻译 (可选)
        variant: 新的变体编号 (可选，向后兼容)
        teochew_priority: 新的潮州话翻译优先级 1-10整数 (可选)
        is_active: 新的状态 (可选)
        user: 操作用户 (默认"system")
        reason: 更新原因 (可选)
        variant_mandarin: 普通话方向变体编号 (可选)
        variant_teochew: 潮州话方向变体编号 (可选)

    Returns:
        bool: 是否更新成功
    """
    # 如果要更新潮汕话文本且未提供priority，自动计算
    if teochew_text is not None and teochew_priority is None:
        word_len = len(teochew_text)
        teochew_priority = min(word_len, 10)  # 1字=1, 2字=2, ..., 最大10

    # 如果要更新潮汕话文本，先获取旧的文本
    old_teochew_texts = []
    if teochew_text is not None:
        if entry_id is not None:
            # 通过ID获取旧词条
            old_entry = _dao.get_translation_by_id(entry_id)
            if old_entry:
                old_teochew_texts.append(old_entry.teochew_text)
        elif mandarin_text is not None:
            # 通过普通话文本获取旧词条
            old_entries = _dao.list_translations(mandarin_text, limit=100, include_inactive=True)
            # 使用variant_mandarin进行筛选（向后兼容variant）
            filter_variant = variant_mandarin if variant_mandarin is not None else variant
            if filter_variant is not None:
                # 检查是否有variant_mandarin属性（迁移后的数据）
                old_entries = [e for e in old_entries if getattr(e, 'variant_mandarin', getattr(e, 'variant', None)) == filter_variant]
            old_teochew_texts = [e.teochew_text for e in old_entries]

    # 执行更新
    success = _dao.update_translation(
        mandarin_text=mandarin_text,
        entry_id=entry_id,
        teochew_text=teochew_text,
        variant=variant,  # 传递variant以保持向后兼容
        variant_mandarin=variant_mandarin,
        variant_teochew=variant_teochew,
        teochew_priority=teochew_priority,
        is_active=is_active,
        user=user,
        reason=reason
    )

    if success and teochew_text is not None:
        # 处理jieba_cut_temp.txt的同步
        # 删除旧词语
        for old_text in old_teochew_texts:
            if old_text:
                old_teochew_words = [word.strip() for word in old_text.split() if word.strip()]
                for word in old_teochew_words:
                    _jieba_manager.delete_word(word)

        # 添加新词语
        if teochew_text:
            new_teochew_words = [word.strip() for word in teochew_text.split() if word.strip()]
            for word in new_teochew_words:
                _jieba_manager.add_word(word)

    return success

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
                      user: str = "system", reason: str = "",
                      variant_mandarin: int = None) -> bool:
    """
    删除翻译条目（软删除，设置为不活跃）

    Args:
        mandarin_text: 普通话词语
        variant: 变体编号，如果为None则删除所有变体 (向后兼容)
        user: 操作用户 (默认"system")
        reason: 删除原因 (可选)
        variant_mandarin: 普通话方向变体编号 (可选)

    Returns:
        bool: 是否删除成功
    """
    # 先获取要删除的词条的潮汕话文本
    entries_to_delete = _dao.list_translations(mandarin_text, limit=100, include_inactive=True)
    filter_variant = variant_mandarin if variant_mandarin is not None else variant
    if filter_variant is not None:
        # 检查是否有variant_mandarin属性（迁移后的数据）
        entries_to_delete = [e for e in entries_to_delete if getattr(e, 'variant_mandarin', getattr(e, 'variant', None)) == filter_variant]

    teochew_texts_to_delete = [e.teochew_text for e in entries_to_delete]

    # 执行删除
    success = _dao.delete_translation(
        mandarin_text=mandarin_text,
        variant=variant,  # 传递variant以保持向后兼容
        variant_mandarin=variant_mandarin,
        user=user,
        reason=reason
    )

    if success:
        # 从jieba_temp.txt中删除相关的潮汕话词语
        for teochew_text in teochew_texts_to_delete:
            if teochew_text:
                teochew_words = [word.strip() for word in teochew_text.split() if word.strip()]
                for word in teochew_words:
                    _jieba_manager.delete_word(word)

    return success

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
        words: 词语列表 [{"mandarin": "...", "teochew": "...", "variant": 1, "teochew_priority": 1}, ...]
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
        teochew_priority = word_data.get("teochew_priority")  # 可选，未提供则自动计算

        if add_translation(mandarin, teochew, variant, teochew_priority, user, reason):
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