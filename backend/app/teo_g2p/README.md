# 潮州话翻译管理系统

本模块提供潮州话翻译的完整解决方案，包括数据库管理、缓存系统、jieba词典同步等功能。

## 主要功能

### 1. 数据库管理
- **TranslationDict 表**：存储普通话到潮州话的翻译映射
- 支持变体（同一词语的多种翻译）
- 支持优先级管理
- 完整的增删改查操作

### 2. 翻译服务
- 基于 jieba 分词的智能翻译
- 支持多义词变体处理
- 多层缓存系统提升性能

### 3. 数据库编辑接口
- 完整的 CRUD 操作
- 修改日志记录
- 批量操作支持

### 4. jieba 词典同步
- 自动同步数据库修改到 jieba_cut.txt
- 防重复同步机制
- 支持全量和增量同步

### 5. 缓存系统
- **内存缓存**：默认，适用于开发环境
- **Redis缓存**：生产环境推荐
- **文件缓存**：适用于单机部署
- 自动缓存管理，支持TTL过期

## 使用方法

### 1. 基本翻译功能

```python
from app.teo_g2p.translation_service import translation_service

# 基本翻译
text = "这是我的朋友"
result = translation_service.translate_to_oral(text)
print(result)  # 输出: 衹#是#我#个#朋友#

# 获取词语的所有变体
variants = translation_service.get_word_variants("这样")
print(variants)  # 输出: [(1, '按照'), (2, '恁样')]
```

### 2. 数据库编辑操作

```python
from app.teo_g2p.teo_dict_edit import (
    add_translation, update_translation, delete_translation,
    get_translation, search_translations
)

# 添加新翻译
add_translation("编程", "拍程序", user="admin", reason="新增IT词汇")

# 更新翻译
update_translation("编程", teochew_text="写程序", user="admin", reason="修正翻译")

# 查询翻译
item = get_translation("编程")
print(item.teochew_text)

# 搜索翻译
results = search_translations("程序", limit=10)
```

### 3. 批量操作

```python
from app.teo_g2p.teo_dict_edit import add_translations_batch, delete_translations_batch

# 批量添加
words = [
    {"mandarin": "Python", "teochew": "派森"},
    {"mandarin": "Java", "teochew": "爪哇"}
]
result = add_translations_batch(words, user="admin", reason="添加编程语言")

# 批量删除
words_to_delete = ["旧词1", "旧词2"]
result = delete_translations_batch(words_to_delete)
```

### 4. jieba词典同步

```python
from app.teo_g2p.teo_dict_edit import sync_to_jieba, validate_sync_status

# 增量同步（只同步未同步的修改）
result = sync_to_jieba(full_sync=False)

# 全量同步
result = sync_to_jieba(full_sync=True)

# 验证同步状态
status = validate_sync_status()
if not status["in_sync"]:
    print("需要同步")
```

### 5. 缓存配置

#### 使用Redis缓存（生产环境推荐）

```bash
# 设置环境变量
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
```

#### 使用文件缓存

```bash
export USE_FILE_CACHE=true
export CACHE_DIR=./cache/teo_g2p
```

## 数据库结构

### TranslationDict 表
- `id`: 主键
- `mandarin_text`: 普通话词语
- `teochew_text`: 潮州话翻译
- `variant`: 变体编号（区分同一词语的不同翻译）
- `priority`: 优先级（数值越大优先级越高）
- `word_length`: 词语长度（用于优化查询）
- `is_active`: 是否启用（1启用，0禁用）

## 日志系统

所有修改操作都会自动记录到日志：
- **修改日志**：`database_changes.log`
- **同步日志**：`database_changes_sync.log`

日志包含：时间戳、操作类型、修改前后的数据、操作用户、修改原因等信息。

## 注意事项

1. 数据库文件默认创建在 `backend/instance` 目录：`backend/instance/teo_g2p.db`
2. jieba词典文件位置：`backend/app/teochew_g2p/dict_data/word_dict/jieba_cut.txt`
3. 建议定期执行同步操作，保持数据库和jieba词典的一致性
4. 首次部署时需要导入初始词典数据

## 文件结构

```
teo_g2p/
├── __init__.py              # 模块初始化
├── models.py               # 数据库模型定义
├── database.py             # 数据库连接管理
├── dao.py                  # 数据访问对象（DAO层）
├── translation_service.py  # 翻译服务核心逻辑
├── teo_dict_edit.py          # 数据库编辑接口（API层）
├── jieba_sync_service.py   # jieba词典同步服务
├── cache_manager.py        # 缓存管理器
├── example.py              # 使用示例
└── README.md               # 本说明文档

word_dict/                  # 词典数据目录
```

## 集成到Flask应用

```python
from app.teo_g2p.teo_dict_edit import (
    add_translation, update_translation, delete_translation,
    sync_to_jieba
)

@app.route('/api/translation/add', methods=['POST'])
def add_translation_api():
    data = request.json
    success = add_translation(
        mandarin_text=data['mandarin'],
        teochew_text=data['teochew'],
        user=data.get('user', 'api'),
        reason=data.get('reason', '')
    )
    return jsonify({"success": success})

@app.route('/api/translation/sync', methods=['POST'])
def sync_jieba_api():
    result = sync_to_jieba()
    return jsonify(result)
```