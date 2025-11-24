# 潮汕话录音系统 - 后端API文档

## 基本信息

- **基础URL**: `https://server_domain_name:5001`
- **内容类型**: `application/json`
- **认证方式**: API密钥（Header: `X-API-Key` 或 Query: `api_key`）

## 响应格式

所有API响应都遵循统一格式：

```json
{
  "success": true/false,
  "message/data/error": "响应内容",
  "timestamp": "2025-11-24T15:00:00.000000"
}
```

---

## 1. 基础接口

### 1.1 API测试

**GET** `/api/test`

测试API是否正常工作。

**请求示例**：
```bash
curl -X GET https://server_domain_name:5001/api/test
```

**响应示例**：
```json
{
  "success": true,
  "message": "后端API正常工作",
  "timestamp": "2025-11-24T15:00:00.000000"
}
```

### 1.2 健康检查

**GET** `/health`

Docker健康检查端点，检查服务状态和数据库连接。

**请求示例**：
```bash
curl -X GET https://server_domain_name:5001/health
```

**响应示例**：
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T15:00:00.000000"
}
```

**响应状态码**：
- `200`: 服务健康
- `503`: 服务异常（数据库连接失败等）

---

## 2. API密钥管理

### 2.1 获取API密钥列表

**GET** `/api/keys`

获取所有API密钥列表。

**请求示例**：
```bash
curl -X GET https://server_domain_name:5001/api/keys
```

**响应示例**：
```json
{
  "success": true,
  "keys": [
    {
      "id": 1,
      "name": "测试应用",
      "key": "abc123...",
      "description": "用于测试的API密钥",
      "is_active": true,
      "created_time": "2025-11-24T15:00:00.000000",
      "last_used": "2025-11-24T15:30:00.000000",
      "usage_count": 5,
      "max_requests": 1000
    }
  ]
}
```

### 2.2 创建API密钥

**POST** `/api/keys`

创建新的API密钥。

**请求体**：
```json
{
  "name": "新应用",
  "description": "应用描述",
  "max_requests": 1000
}
```

**请求示例**：
```bash
curl -X POST https://server_domain_name:5001/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"新应用","description":"测试应用","max_requests":500}'
```

**响应示例**：
```json
{
  "success": true,
  "key": {
    "id": 2,
    "name": "新应用",
    "key": "def456...",
    "description": "测试应用",
    "is_active": true,
    "created_time": "2025-11-24T15:00:00.000000",
    "last_used": null,
    "usage_count": 0,
    "max_requests": 500
  }
}
```

### 2.3 更新API密钥

**PUT** `/api/keys/{key_id}`

更新指定API密钥的信息。

**请求体**：
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "max_requests": 2000,
  "is_active": false
}
```

**请求示例**：
```bash
curl -X PUT https://server_domain_name:5001/api/keys/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"更新的应用","max_requests":2000}'
```

### 2.4 删除API密钥

**DELETE** `/api/keys/{key_id}`

删除指定的API密钥。

**请求示例**：
```bash
curl -X DELETE https://server_domain_name:5001/api/keys/1
```

**响应示例**：
```json
{
  "success": true,
  "message": "密钥已删除"
}
```

### 2.5 重置API密钥使用次数

**POST** `/api/keys/{key_id}/reset`

重置指定API密钥的每日使用次数。

**请求示例**：
```bash
curl -X POST https://server_domain_name:5001/api/keys/1/reset
```

**响应示例**：
```json
{
  "success": true,
  "message": "使用次数已重置"
}
```

---

## 3. 文本生成接口

### 3.1 生成练习文本

**POST** `/api/generate-text` 🔒

生成潮汕话练习文本（需要API密钥认证）。

**请求头**：
```
X-API-Key: your-api-key
```

**请求示例**：
```bash
curl -X POST https://server_domain_name:5001/api/generate-text \
  -H "X-API-Key: abc123..."
```

**响应示例**：
```json
{
  "success": true,
  "text": "今日天气很好，我们一起去公园散步吧。"
}
```

**错误响应**：
```json
{
  "success": false,
  "error": "文本生成失败，请联系管理员检查AI配置"
}
```

---

## 4. 录音管理接口

### 4.1 上传录音

**POST** `/api/upload` 🔒

上传录音文件（需要API密钥认证）。

**请求头**：
```
X-API-Key: your-api-key
Content-Type: multipart/form-data
```

**请求参数**：
- `audio`: 音频文件（支持webm等格式，最大16MB）
- `text`: 对应的文本内容（最多500字符）

**请求示例**：
```bash
curl -X POST https://server_domain_name:5001/api/upload \
  -H "X-API-Key: abc123..." \
  -F "audio=@recording.webm" \
  -F "text=今天天气很好"
```

**响应示例**：
```json
{
  "success": true,
  "id": "ABC123DEF456",
  "message": "上传成功"
}
```

**速率限制**：
- 每小时最多30个文件
- 每天最多100个文件
- 冷却时间：6秒

### 4.2 获取录音列表

**GET** `/api/recordings`

获取录音列表（分页，支持状态过滤）。

**查询参数**：
- `page`: 页码（默认1）
- `per_page`: 每页数量（默认20，最大100）
- `status`: 状态过滤（pending/approved/rejected）

**请求示例**：
```bash
curl -X GET "https://server_domain_name:5001/api/recordings?page=1&per_page=10&status=pending"
```

**响应示例**：
```json
{
  "success": true,
  "recordings": [
    {
      "id": "ABC123DEF456",
      "filename": "recording.webm",
      "original_text": "今天天气很好",
      "actual_content": "今仔日天气很好",
      "upload_time": "2025-11-24T15:00:00.000000",
      "ip_address": "127.0.0.1",
      "file_size": 1024000,
      "duration": 5,
      "status": "pending"
    }
  ],
  "total": 50,
  "pages": 5,
  "current_page": 1
}
```

### 4.3 更新录音信息

**PUT** `/api/recording/{recording_id}`

更新录音的实际内容和状态（管理用）。

**请求体**：
```json
{
  "actual_content": "实际的音频内容",
  "status": "approved"
}
```

**响应示例**：
```json
{
  "success": true,
  "message": "更新成功"
}
```

**状态说明**：
- `pending`: 待审核
- `approved`: 已通过
- `rejected`: 已拒绝

### 4.4 删除录音

**DELETE** `/admin/api/recordings/{recording_id}` 🔒

删除指定录音（需要管理员权限）。

**请求示例**：
```bash
curl -X DELETE https://server_domain_name:5001/admin/api/recordings/ABC123DEF456
```

**响应示例**：
```json
{
  "success": true,
  "message": "录音删除成功"
}
```

### 4.5 下载录音

**GET** `/admin/api/download/{recording_id}` 🔒

下载指定录音文件（需要管理员权限）。

**查询参数**：
- `download`: 是否下载（true/false，默认true）

**请求示例**：
```bash
curl -X GET "https://server_domain_name:5001/admin/api/download/ABC123DEF456?download=true" \
  -o recording.webm
```

---

## 5. 统计信息接口

### 5.1 获取统计信息

**GET** `/api/stats`

获取系统使用统计信息。

**请求示例**：
```bash
curl -X GET https://server_domain_name:5001/api/stats
```

**响应示例**：
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "pending": 20,
    "approved": 70,
    "rejected": 10,
    "recent_uploads": 5
  }
}
```

**统计字段说明**：
- `total`: 总录音数
- `pending`: 待审核数
- `approved`: 已通过数
- `rejected`: 已拒绝数
- `recent_uploads`: 近24小时上传数

---

## 6. 管理界面接口

### 6.1 管理员登录

**GET/POST** `/admin/login`

管理员登录界面。

**POST请求体**：
```json
{
  "username": "admin_username",
  "password": "admin_password"
}
```

### 6.2 管理员登出

**GET** `/admin/logout`

管理员登出。

### 6.3 管理界面

**GET** `/admin` 🔒

管理主界面（需要管理员权限）。

---

## 错误代码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败或缺少API密钥 |
| 404 | 资源不存在 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用（数据库连接失败等） |

## 常见错误响应

### 认证错误
```json
{
  "success": false,
  "error": "缺少API密钥"
}
```

### 参数错误
```json
{
  "error": "文件太大，请选择小于16MB的文件"
}
```

### 频率限制
```json
{
  "error": "请等待 6 分钟后再试"
}
```

---

## 使用示例

### 完整的上传流程

```bash
# 1. 创建API密钥
curl -X POST https://server_domain_name:5001/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"我的应用","description":"潮汕话录音应用"}'

# 2. 生成练习文本
curl -X POST https://server_domain_name:5001/api/generate-text \
  -H "X-API-Key: your-api-key-here"

# 3. 上传录音文件
curl -X POST https://server_domain_name:5001/api/upload \
  -H "X-API-Key: your-api-key-here" \
  -F "audio=@recording.webm" \
  -F "text=今日天气很好"
```

---

## 开发注意事项

1. **文件上传限制**：单个文件最大16MB
2. **速率限制**：根据IP地址限制上传频率
3. **API密钥管理**：每个密钥有每日最大请求次数限制
4. **数据库**：使用SQLite，文件位于 `instance/dialect_recorder.db`
5. **日志记录**：所有操作都有详细日志记录
6. **文件存储**：录音文件按审核状态存储在不同目录

## 联系支持

如有问题或需要技术支持，请联系管理员。