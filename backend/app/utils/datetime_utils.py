#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
时间工具函数
统一处理时间戳（使用UTC时间）
"""

from datetime import datetime, timezone, timedelta


def now_utc() -> datetime:
    """
    获取当前UTC时间

    Returns:
        UTC时间的datetime对象
    """
    return datetime.now(timezone.utc)


def now_utc_isoformat() -> str:
    """
    获取当前UTC时间的ISO格式字符串

    Returns:
        ISO格式的UTC时间字符串，如：2026-01-31T06:45:03+00:00
    """
    return now_utc().isoformat()


def now_beijing() -> datetime:
    """
    获取当前北京时间（UTC+8）

    Returns:
        北京时间的datetime对象
    """
    return now_utc() + timedelta(hours=8)


def now_beijing_str() -> str:
    """
    获取当前北京时间的格式化字符串（用于文件名）

    Returns:
        格式化的北京时间字符串，如：20260131_172420
    """
    return now_beijing().strftime("%Y%m%d_%H%M%S")
