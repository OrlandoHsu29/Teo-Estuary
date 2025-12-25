import re
import jieba
import hashlib
import os
from typing import List, Dict, Tuple, Optional
from sqlalchemy import and_, desc, func
from app.teo_g2p.models import TranslationDict
from app.teo_g2p.database import get_db
from app.teo_g2p.cache_manager import cache_manager

class TranslationService:
    """
    潮州话翻译服务
    核心功能：
    1. 使用jieba进行分词（保持与原始to_oral一致）
    2. 支持多义词变体
    3. 智能缓存系统
    """

    def __init__(self):
        self.cache = cache_manager
        self._init_jieba()

    def _init_jieba(self):
        """初始化jieba分词"""
        # 获取正确的路径
        current_dir = os.path.dirname(os.path.abspath(__file__))
        jieba_path = os.path.join(current_dir, '..', 'teo_g2p', 'word_dict', 'jieba_cut.txt')
        jieba_path = os.path.normpath(jieba_path)

        if os.path.exists(jieba_path):
            jieba.load_userdict(jieba_path)
            jieba.cut('')  # 预热
        else:
            print(f"[WARNING] jieba词典未找到: {jieba_path}")

    def translate(self, text: str, auto_split: bool = True, use_cache: bool = True, cache_ttl: int = 3600, target_lang: str = 'teochew') -> str:
        """
        双向翻译功能：普通话<->潮州话

        Args:
            text: 要翻译的文本
            auto_split: 是否使用jieba自动分词
            use_cache: 是否使用缓存
            cache_ttl: 缓存生存时间（秒）
            target_lang: 目标语言 ('teochew'=普通话转潮州话, 'mandarin'=潮州话转普通话)

        Returns:
            翻译后的文本
        """
        # 生成缓存键
        cache_key = self._generate_cache_key(f"translate:{text}:{auto_split}:{target_lang}")

        if use_cache:
            cached = self.cache.get(cache_key)
            if cached:
                return cached

        # 分词逻辑（与原始to_oral一致）
        if auto_split:
            word_list = list(jieba.cut(text))
        else:
            word_list = text.split(' ')

        # 逐词翻译
        result = []
        for word in word_list:
            translations, has_multiple = self._get_word_translations(word, return_variant_info=True, target_lang=target_lang)
            if translations:
                # 根据变体数量选择标记
                if has_multiple:
                    result.append(translations[0] + f'$[{word}]')
                else:
                    result.append(translations[0] + '#')
            else:
                result.append(word)

        translated_text = ' '.join(result)

        # 缓存结果
        if use_cache:
            self.cache.set(cache_key, translated_text, ttl=cache_ttl)

        return translated_text

    def translate_with_variants(self, text: str, variant_selector: callable = None, use_cache: bool = True) -> str:
        """
        支持变体选择的翻译
        当一个词有多个翻译时，使用选择器函数决定使用哪个

        Args:
            text: 要翻译的文本
            variant_selector: 选择器函数，接收(词, 变体列表)，返回选择的翻译
            use_cache: 是否使用缓存

        Returns:
            翻译后的潮州话文本
        """
        # 默认选择器：选择优先级最高的
        if variant_selector is None:
            def default_selector(word, variants):
                return variants[0] if variants else None
            variant_selector = default_selector

        # 使用jieba分词
        word_list = list(jieba.cut(text))

        result = []
        for word in word_list:
            # 获取所有变体
            translations = self._get_word_translations(word)
            if translations:
                # 使用选择器函数
                selected = variant_selector(word, translations)
                if selected:
                    result.append(selected + '#')
                else:
                    result.append(word)
            else:
                result.append(word)

        return ' '.join(result)

    def get_word_variants(self, word: str, lang: str) -> List[Tuple[int, str]]:
        """
        获取词的所有变体翻译

        Args:
            word: 要查询的词
            lang: 语言类型（'mandarin' 或 'teochew'）

        Returns:
            [(variant_number, teochew_text), ...]
        """
        db = next(get_db())

        try:
            if lang == 'teochew':
                # 反向查询：通过潮州话获取所有变体
                translations = db.query(TranslationDict).filter(
                    and_(
                        TranslationDict.teochew_text == word,
                        TranslationDict.is_active == 1
                    )
                ).order_by(TranslationDict.variant).all()

                return [(t.variant, t.teochew_text) for t in translations]
            else:
                # 正向查询：通过普通话获取所有变体
                translations = db.query(TranslationDict).filter(
                    and_(
                        TranslationDict.mandarin_text == word,
                        TranslationDict.is_active == 1
                    )
                ).order_by(TranslationDict.variant).all()

                return [(t.variant, t.teochew_text) for t in translations]

        finally:
            db.close()

    def _get_word_translations(self, word: str, return_variant_info: bool = False, target_lang: str = 'teochew') -> List[str] | Tuple[List[str], bool]:
        """
        获取词的所有翻译，按优先级排序

        Args:
            word: 要查询的词
            return_variant_info: 是否返回变体信息
            target_lang: 目标语言 ('teochew'=普通话转潮州话, 'mandarin'=潮州话转普通话)

        Returns:
            如果return_variant_info=False: [翻译列表]
            如果return_variant_info=True: (翻译列表, 是否有多个变体)
        """
        # 生成缓存键
        cache_key = self._generate_cache_key(f"word_translations:{word}:{target_lang}")

        # 尝试从缓存获取
        cached = self.cache.get(cache_key)
        if cached:
            if return_variant_info:
                # cached是列表格式，需要判断变体数量
                return (cached, len(cached) > 1)
            return cached

        db = next(get_db())

        try:
            if target_lang == 'teochew':
                # 普通话转潮州话
                source_field = TranslationDict.mandarin_text
                target_field = TranslationDict.teochew_text
            else:
                # 潮州话转普通话
                source_field = TranslationDict.teochew_text
                target_field = TranslationDict.mandarin_text

            # 查询基础词（没有数字后缀的）
            base_query = db.query(TranslationDict).filter(
                and_(
                    source_field == word,
                    TranslationDict.is_active == 1
                )
            )

            # 如果词包含数字，也查询对应的基础词
            variant_match = re.match(r'^(.+?)(\d+)$', word)
            if variant_match:
                base_word, variant_num = variant_match.groups()
                variant_query = db.query(TranslationDict).filter(
                    and_(
                        source_field == base_word,
                        TranslationDict.variant == int(variant_num),
                        TranslationDict.is_active == 1
                    )
                )

                # 合并查询结果
                translations = base_query.union(variant_query).all()
            else:
                translations = base_query.all()

            # 按优先级和词语长度排序（优先级高的在前，长度长的在前）
            translations.sort(key=lambda x: (x.priority, x.word_length), reverse=True)

            result = [getattr(t, 'teochew_text' if target_lang == 'teochew' else 'mandarin_text') for t in translations]
            has_multiple = len(result) > 1

            # 缓存结果（单词翻译缓存时间更长）
            self.cache.set(cache_key, result, ttl=7200)  # 2小时

            if return_variant_info:
                return (result, has_multiple)
            return result

        finally:
            db.close()

    def _generate_cache_key(self, identifier: str) -> str:
        """
        生成缓存键
        使用MD5哈希确保键的长度一致和安全性
        """
        return hashlib.md5(identifier.encode('utf-8')).hexdigest()

    def _clear_word_cache(self, word: str):
        """清除特定词的缓存"""
        cache_key = self._generate_cache_key(f"word_translations:{word}")
        self.cache.delete(cache_key)

    def get_cache_stats(self) -> Dict[str, any]:
        """获取缓存统计信息"""
        return self.cache.get_stats()

    def clear_cache(self) -> bool:
        """清空所有缓存"""
        return self.cache.clear()


# 创建全局翻译服务实例
translation_service = TranslationService()