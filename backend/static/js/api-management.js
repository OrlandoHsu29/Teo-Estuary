// API密钥管理模块

// 密钥格式化：中间字符用**省略（更短的版本）
function formatApiKey(key) {
    if (!key || key.length < 12) return key;

    const start = key.substring(0, 4);
    const end = key.substring(key.length - 3);
    const middle = '*'.repeat(Math.max(4, key.length - 7));

    return `${start}${middle}${end}`;
}

// 加载API密钥
let isLoadingApiKeys = false; // 防止重复加载的标志

async function loadApiKeys(forceRefresh = false) {
    // 防止重复加载，但允许强制刷新
    if (isLoadingApiKeys && !forceRefresh) {
        console.log('API密钥正在加载中，跳过重复调用');
        return;
    }

    // 如果是强制刷新，重置加载标志
    if (forceRefresh) {
        isLoadingApiKeys = false;
    }

    isLoadingApiKeys = true;
    try {
        const response = await fetch('/api/keys');
        const data = await response.json();

        const keysGrid = document.getElementById('keysGrid');

        if (!data.success || data.keys.length === 0) {
            keysGrid.innerHTML = `
                <div class="empty-state">
                    <h3>暂无API密钥</h3>
                    <p>点击"创建新密钥"按钮添加第一个API密钥</p>
                </div>
            `;
            return;
        }

        // 添加创建新密钥按钮
        const createKeyCard = `
            <div class="add-card" onclick="showCreateKeyModal()">
                <i class="fas fa-plus"></i>
                <span>创建新密钥</span>
            </div>
        `;

        const keyCards = data.keys.map(key => `
            <div class="key-card">
                <div class="card-content">
                    <div class="key-info">
                        <div class="key-header">
                            <h3 class="key-name">${key.name}</h3>
                            <span class="status-badge ${key.is_active ? 'active' : 'inactive'}">${key.is_active ? '启用' : '禁用'}</span>
                        </div>
                        ${key.description ? `<div class="key-description">${key.description}</div>` : ''}
                        <div class="key-value">
                            <code title="${key.key}">${formatApiKey(key.key)}</code>
                            <button class="copy-btn" onclick="copyToClipboard('${key.key}')" title="复制完整密钥">
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="key-stats">
                            <div class="stat">
                                <span class="stat-value">${key.usage_count || 0}</span>
                                <span class="stat-label">使用次数</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">${key.max_requests || 1000}</span>
                                <span class="stat-label">每日限额</span>
                            </div>
                            <div class="key-actions">
                                <button class="reset-btn action-btn square-btn" onclick="resetKeyUsage(${key.id})" title="重置使用次数">
                                    <i class="fas fa-redo"></i>
                                </button>
                                <button class="edit-btn action-btn square-btn" onclick="editKey(${key.id})" title="编辑密钥">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="toggle-btn action-btn square-btn ${key.is_active ? 'active' : 'inactive'}" onclick="toggleKey(${key.id})" title="${key.is_active ? '禁用密钥' : '启用密钥'}">
                                    ${key.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'}
                                </button>
                                <button class="delete-btn action-btn square-btn" onclick="deleteKey(${key.id})" title="删除密钥">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        keysGrid.innerHTML = createKeyCard + keyCards;

    } catch (error) {
        console.error('加载API密钥失败:', error);
        showToast('加载API密钥失败', 'error');
    }
}

// 显示创建密钥模态框
function showCreateKeyModal() {
    document.getElementById('createKeyModal').style.display = 'block';
}

// 关闭创建密钥模态框
function closeCreateKeyModal() {
    document.getElementById('createKeyModal').style.display = 'none';
    document.getElementById('keyName').value = '';
    document.getElementById('keyDescription').value = '';
    document.getElementById('maxRequests').value = '1000';
}

// 创建API密钥
async function createKey() {
    const name = document.getElementById('keyName').value.trim();
    const description = document.getElementById('keyDescription').value.trim();
    const maxRequests = document.getElementById('maxRequests').value;

    if (!name) {
        showToast('请输入密钥名称', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                max_requests: parseInt(maxRequests)
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('创建成功', 'success');
            closeCreateKeyModal();
            loadApiKeys(true); // 强制刷新
        } else {
            showToast(data.error || '创建失败', 'error');
        }
    } catch (error) {
        console.error('创建API密钥失败:', error);
        showToast('创建失败', 'error');
    }
}

// 重置API密钥使用次数
async function resetKeyUsage(id) {
    if (confirm('确定要重置这个API密钥的使用次数吗？')) {
        try {
            const response = await fetch(`/api/keys/${id}/reset-usage`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                showToast(data.message || '重置成功', 'success');
                loadApiKeys(true); // 强制刷新
            } else {
                showToast(data.error || '重置失败', 'error');
            }
        } catch (error) {
            console.error('重置API密钥使用次数失败:', error);
            showToast('重置失败', 'error');
        }
    }
}

// 显示编辑密钥模态框
async function editKey(id) {
    try {
        // 先获取当前密钥信息
        const response = await fetch(`/api/keys`);
        const data = await response.json();

        if (!data.success) {
            showToast('获取密钥信息失败', 'error');
            return;
        }

        // 找到要编辑的密钥
        const key = data.keys.find(k => k.id === id);
        if (!key) {
            showToast('未找到指定的密钥', 'error');
            return;
        }

        // 填充表单数据
        document.getElementById('editKeyId').value = key.id;
        document.getElementById('editKeyName').value = key.name || '';
        document.getElementById('editKeyDescription').value = key.description || '';
        document.getElementById('editMaxRequests').value = key.max_requests || 1000;

        // 显示模态框
        document.getElementById('editKeyModal').style.display = 'block';

    } catch (error) {
        console.error('获取密钥信息失败:', error);
        showToast('获取密钥信息失败', 'error');
    }
}

// 关闭编辑密钥模态框
function closeEditKeyModal() {
    document.getElementById('editKeyModal').style.display = 'none';
    // 清空表单
    document.getElementById('editKeyId').value = '';
    document.getElementById('editKeyName').value = '';
    document.getElementById('editKeyDescription').value = '';
    document.getElementById('editMaxRequests').value = '1000';
}

// 更新API密钥
async function updateKey() {
    const id = document.getElementById('editKeyId').value;
    const name = document.getElementById('editKeyName').value.trim();
    const description = document.getElementById('editKeyDescription').value.trim();
    const maxRequests = document.getElementById('editMaxRequests').value;

    if (!name) {
        showToast('请输入密钥名称', 'warning');
        return;
    }

    if (!id) {
        showToast('密钥ID无效', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/keys/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                max_requests: parseInt(maxRequests)
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('更新成功', 'success');
            closeEditKeyModal();
            loadApiKeys(true); // 强制刷新
        } else {
            showToast(data.error || '更新失败', 'error');
        }
    } catch (error) {
        console.error('更新API密钥失败:', error);
        showToast('更新失败', 'error');
    }
}

// 切换API密钥状态
async function toggleKey(id) {
    try {
        const response = await fetch(`/api/keys/${id}/toggle`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message || '状态切换成功', 'success');
            loadApiKeys(true); // 强制刷新
        } else {
            showToast(data.error || '切换失败', 'error');
        }
    } catch (error) {
        console.error('切换API密钥状态失败:', error);
        showToast('切换失败', 'error');
    }
}

// 删除API密钥
async function deleteKey(id) {
    if (confirm('确定要删除这个API密钥吗？')) {
        try {
            const response = await fetch(`/api/keys/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                showToast('删除成功', 'success');
                loadApiKeys(true); // 强制刷新
            } else {
                showToast(data.error || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除API密钥失败:', error);
            showToast('删除失败', 'error');
        }
    }
}

// 模态框事件监听
document.addEventListener('DOMContentLoaded', function() {
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCreateKeyModal();
            closeEditKeyModal();
        }
    });

    // 点击模态框外部关闭
    document.getElementById('createKeyModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeCreateKeyModal();
        }
    });

    document.getElementById('editKeyModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditKeyModal();
        }
    });
});