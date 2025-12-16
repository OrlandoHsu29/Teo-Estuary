#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teo G2P 使用示例
演示如何使用潮州话翻译功能
"""

import sys

# Windows编码处理
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from translation_service import translation_service

def basic_example():
    """基本翻译示例"""
    print("=== 基本翻译 ===")

    text = "这是我的朋友"
    result = translation_service.translate_to_oral(text)
    print(f"普通话: {text}")
    print(f"潮州话: {result}")
    print()

def variants_example():
    """多义词变体示例"""
    print("=== 多义词变体 ===")

    word = "这样"
    variants = translation_service.get_word_variants(word)

    print(f"'{word}' 的不同翻译:")
    for variant_num, teochew in variants:
        print(f"  变体{variant_num}: {teochew}")

    text = "这样就好"
    print(f"'{text}' 的含变体翻译:")
    res = translation_service.translate_to_oral(text, True)
    print(f"{res}")
    
    print()

def custom_translation_example():
    """自定义翻译示例"""
    print("=== 自定义翻译 ===")

    # 添加新的翻译
    translation_service.add_translation("编程", "拍程序")
    translation_service.add_translation("程序员", "拍程序个")

    # 测试自定义翻译
    text = "我是程序员"
    result = translation_service.translate_to_oral(text)
    print(f"普通话: {text}")
    print(f"潮州话: {result}")
    print()

def batch_translate_example():
    """批量翻译示例"""
    print("=== 批量翻译 ===")

    texts = [
        "你好",
        "谢谢",
        "再见",
        "不用客气",
        "慢慢来"
    ]

    print("普通话 -> 潮州话")
    for text in texts:
        result = translation_service.translate_to_oral(text)
        print(f"{text} -> {result}")
    print()

def long_text_example():
    """长文本翻译示例"""
    print("=== 长文本翻译 ===")

    text = "这里是我的家，欢迎来玩。我们会准备一些吃的，不用担心。"
    result = translation_service.translate_to_oral(text)

    print(f"原文: {text}")
    print(f"译文: {result}")
    print()

# 主函数
def main():
    """运行所有示例"""
    print("===== Teo G2P 使用示例 =====\n")

    basic_example()
    variants_example()
    custom_translation_example()
    batch_translate_example()
    long_text_example()

if __name__ == "__main__":
    main()