"""中国时区时间处理工具模块"""
from datetime import datetime, timedelta, timezone

# 中国时区 (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))


def now():
    """获取当前中国时间（北京时间）"""
    return datetime.now(CHINA_TZ)


def format_time(dt, format_str="%Y-%m-%d %H:%M:%S"):
    """格式化时间为中国时间字符串"""
    return dt.strftime(format_str)


def get_yesterday():
    """获取昨天的开始时间"""
    return datetime.now(CHINA_TZ) - timedelta(days=1)


def get_today_start():
    """获取今天的开始时间"""
    return datetime.now(CHINA_TZ).replace(hour=0, minute=0, second=0, microsecond=0)


def get_hours_ago(hours):
    """获取N小时前的时间"""
    return datetime.now(CHINA_TZ) - timedelta(hours=hours)


def get_days_ago(days):
    """获取N天前的时间"""
    return datetime.now(CHINA_TZ) - timedelta(days=days)