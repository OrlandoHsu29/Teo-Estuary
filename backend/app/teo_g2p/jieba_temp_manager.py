#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
管理jieba_cut_temp.txt文件的服务
处理recordings表中潮汕话文本翻译结果的增删改操作
"""

import os
import logging
from typing import List, Dict, Optional, Set
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class JiebaTempManager:
    """jieba_cut_temp.txt文件管理器"""

    def __init__(self, temp_file_path: str = None, original_file_path: str = None):
        """
        初始化管理器

        Args:
            temp_file_path: jieba_cut_temp.txt文件路径
            original_file_path: jieba_cut_original.txt文件路径
        """
        if temp_file_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            temp_file_path = os.path.join(
                current_dir, 'word_dict', 'jieba_cut_temp.txt'
            )

        if original_file_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            original_file_path = os.path.join(
                current_dir, 'word_dict', 'jieba_cut_original.txt'
            )

        self.temp_file_path = os.path.normpath(temp_file_path)
        self.original_file_path = os.path.normpath(original_file_path)

        # 确保目录存在
        os.makedirs(os.path.dirname(self.temp_file_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.original_file_path), exist_ok=True)

        # 确保文件存在
        self._ensure_files_exist()

    def _ensure_files_exist(self):
        """确保必要文件存在"""
        if not os.path.exists(self.temp_file_path):
            with open(self.temp_file_path, 'w', encoding='utf-8') as f:
                f.write('')
            logger.info(f"创建临时文件: {self.temp_file_path}")

        if not os.path.exists(self.original_file_path):
            # 如果原始文件不存在，尝试从现有的jieba_cut.txt复制
            jieba_cut_path = os.path.join(
                os.path.dirname(self.temp_file_path), 'jieba_cut.txt'
            )
            if os.path.exists(jieba_cut_path):
                import shutil
                shutil.copy2(jieba_cut_path, self.original_file_path)
                logger.info(f"从jieba_cut.txt复制到原始文件: {self.original_file_path}")
            else:
                with open(self.original_file_path, 'w', encoding='utf-8') as f:
                    f.write('')
                logger.info(f"创建原始文件: {self.original_file_path}")

    def load_temp_words(self) -> Dict[str, str]:
        """
        加载临时文件中的词语

        Returns:
            {词语: 词频} 的字典
        """
        words = {}
        try:
            if os.path.exists(self.temp_file_path):
                with open(self.temp_file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if line:
                            parts = line.split()
                            if len(parts) >= 2:
                                word = parts[0]
                                freq = parts[1]
                                words[word] = freq
                            else:
                                logger.warning(f"临时文件第{line_num}行格式不正确: {line}")
        except Exception as e:
            logger.error(f"加载临时文件失败: {e}")

        return words

    def load_original_words(self) -> Dict[str, str]:
        """
        加载原始文件中的词语

        Returns:
            {词语: 词频} 的字典
        """
        words = {}
        try:
            if os.path.exists(self.original_file_path):
                with open(self.original_file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if line:
                            parts = line.split()
                            if len(parts) >= 2:
                                word = parts[0]
                                freq = parts[1]
                                words[word] = freq
                            else:
                                logger.warning(f"原始文件第{line_num}行格式不正确: {line}")
        except Exception as e:
            logger.error(f"加载原始文件失败: {e}")

        return words

    def save_temp_words(self, words: Dict[str, str]) -> bool:
        """
        保存词语到临时文件

        Args:
            words: 词语字典

        Returns:
            是否保存成功
        """
        try:
            # 按词语排序
            sorted_words = sorted(words.items(), key=lambda x: x[0])

            with open(self.temp_file_path, 'w', encoding='utf-8') as f:
                for word, freq in sorted_words:
                    f.write(f"{word} {freq}\n")

            return True
        except Exception as e:
            logger.error(f"保存临时文件失败: {e}")
            return False

    def add_word(self, word: str, freq: str = "100000") -> bool:
        """
        添加词语到临时文件

        Args:
            word: 要添加的词语
            freq: 词频，默认为100000

        Returns:
            是否添加成功
        """
        try:
            words = self.load_temp_words()

            if word not in words:
                words[word] = freq
                return self.save_temp_words(words)
            else:
                logger.info(f"词语已存在于临时文件中: {word}")
                return True
        except Exception as e:
            logger.error(f"添加词语到临时文件失败: {e}")
            return False

    def update_word(self, old_word: str, new_word: str, freq: str = "100000") -> bool:
        """
        更新临时文件中的词语

        Args:
            old_word: 旧词语
            new_word: 新词语
            freq: 词频

        Returns:
            是否更新成功
        """
        try:
            words = self.load_temp_words()

            if old_word in words:
                del words[old_word]
                words[new_word] = freq
                return self.save_temp_words(words)
            else:
                logger.warning(f"临时文件中未找到要更新的词语: {old_word}")
                return False
        except Exception as e:
            logger.error(f"更新临时文件中的词语失败: {e}")
            return False

    def delete_word(self, word: str) -> bool:
        """
        从临时文件中删除词语

        Args:
            word: 要删除的词语

        Returns:
            是否删除成功
        """
        try:
            words = self.load_temp_words()

            if word in words:
                del words[word]
                return self.save_temp_words(words)
            else:
                logger.warning(f"临时文件中未找到要删除的词语: {word}")
                return False
        except Exception as e:
            logger.error(f"从临时文件中删除词语失败: {e}")
            return False

    def merge_files(self, output_file_path: str = None) -> bool:
        """
        合并临时文件和原始文件到jieba_cut.txt

        Args:
            output_file_path: 输出文件路径，如果为None则默认为jieba_cut.txt

        Returns:
            是否合并成功
        """
        try:
            if output_file_path is None:
                output_file_path = os.path.join(
                    os.path.dirname(self.temp_file_path), 'jieba_cut.txt'
                )

            # 加载两个文件的内容
            temp_words = self.load_temp_words()
            original_words = self.load_original_words()

            # 合并词语，临时文件的优先级更高
            merged_words = original_words.copy()
            merged_words.update(temp_words)

            # 按词语排序
            sorted_words = sorted(merged_words.items(), key=lambda x: x[0])

            # 写入输出文件
            with open(output_file_path, 'w', encoding='utf-8') as f:
                for word, freq in sorted_words:
                    f.write(f"{word} {freq}\n")

            logger.info(f"成功合并文件到: {output_file_path}")
            return True

        except Exception as e:
            logger.error(f"合并文件失败: {e}")
            return False

    def clear_temp_file(self) -> bool:
        """
        清空临时文件

        Returns:
            是否清空成功
        """
        try:
            with open(self.temp_file_path, 'w', encoding='utf-8') as f:
                f.write('')
            return True
        except Exception as e:
            logger.error(f"清空临时文件失败: {e}")
            return False

    def get_word_changes(self) -> Dict[str, List[str]]:
        """
        获取基于数据库变更日志的词语变更

        Returns:
            {"added": [新增词语], "deleted": [删除词语], "modified": [修改词语]}
        """
        from app.teo_g2p.unsynced_logs_service import UnsyncedLogsService

        # 获取未同步的数据库变更日志（排除属性更新）
        unsynced_service = UnsyncedLogsService()
        unsynced_logs = unsynced_service.get_unsynced_logs(exclude_property_updates=True)

        # 收集所有变更的词语
        added_words = set()
        deleted_words = set()
        modified_words = set()

        for log_entry in unsynced_logs:
            operation = log_entry.get('operation', '')
            changes = log_entry.get('changes', {})
            identifier = log_entry.get('identifier', {})
            old_data = changes.get('old', {})
            new_data = changes.get('new', {})

            if operation == 'add':
                # 添加操作：从新数据中提取潮汕话词语
                teochew_text = new_data.get('teochew_text', '') or identifier.get('teochew_words', [])
                if isinstance(teochew_text, str):
                    teochew_words = [w.strip() for w in teochew_text.split() if w.strip()]
                elif isinstance(teochew_text, list):
                    teochew_words = teochew_text
                else:
                    teochew_words = []

                added_words.update(teochew_words)

            elif operation == 'delete':
                # 删除操作：从旧数据中提取潮汕话词语
                teochew_text = old_data.get('teochew_text', '') or identifier.get('teochew_words', [])
                if isinstance(teochew_text, str):
                    teochew_words = [w.strip() for w in teochew_text.split() if w.strip()]
                elif isinstance(teochew_text, list):
                    teochew_words = teochew_text
                else:
                    teochew_words = []

                deleted_words.update(teochew_words)

            elif operation == 'update':
                # 更新操作：比较新旧数据中的潮汕话词语变化
                old_teochew = old_data.get('teochew_text', '')
                new_teochew = new_data.get('teochew_text', '')

                if isinstance(old_teochew, str):
                    old_words = set([w.strip() for w in old_teochew.split() if w.strip()])
                else:
                    old_words = set()

                if isinstance(new_teochew, str):
                    new_words = set([w.strip() for w in new_teochew.split() if w.strip()])
                else:
                    new_words = set()

                # 新增的词语
                added_in_update = new_words - old_words
                # 删除的词语
                deleted_in_update = old_words - new_words
                # 保持不变的词语（从新数据中取，因为可能词频有变化）
                unchanged_in_update = new_words & old_words

                added_words.update(added_in_update)
                deleted_words.update(deleted_in_update)
                modified_words.update(unchanged_in_update)

        return {
            "added": list(added_words),
            "deleted": list(deleted_words),
            "modified": list(modified_words)
        }