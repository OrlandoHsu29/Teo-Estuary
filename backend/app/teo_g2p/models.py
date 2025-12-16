from sqlalchemy import Column, Integer, String, Float, Index, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import expression

Base = declarative_base()

class TranslationDict(Base):
    """
    潮州话翻译词典表
    支持优先级匹配和多义词处理
    """
    __tablename__ = 'translation_dict'

    id = Column(Integer, primary_key=True, autoincrement=True)
    mandarin_text = Column(String(255), nullable=False, comment='普通话词语')
    teochew_text = Column(String(255), nullable=False, comment='潮州话翻译')
    variant = Column(Integer, default=1, comment='变体编号，用于区分同一词语的不同翻译')
    priority = Column(Float, default=1.0, comment='匹配优先级，数值越大优先级越高')
    word_length = Column(Integer, nullable=False, comment='词语长度，用于优化查询')
    is_active = Column(Integer, default=1, comment='是否启用，1启用，0禁用')

    # 创建复合索引以优化查询性能
    __table_args__ = (
        Index('idx_mandarin_length_priority', 'mandarin_text', 'word_length', 'priority'),
        Index('idx_mandarin_variant', 'mandarin_text', 'variant'),
        UniqueConstraint('mandarin_text', 'variant', name='uq_mandarin_variant'),
    )

    def __repr__(self):
        return f"<TranslationDict(mandarin='{self.mandarin_text}', teochew='{self.teochew_text}', priority={self.priority})>"