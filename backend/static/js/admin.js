// 录音管理后台JavaScript文件

let currentPage = 1;
const perPage = 20;
let currentFilter = '';

// 当前播放的音频和录音ID
let currentAudio = null;
let currentPlayingId = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadRecordings();
    loadApiKeys();

    // 状态筛选变化时重新加载
    document.getElementById('statusFilter').addEventListener('change', function() {
        currentFilter = this.value;
        currentPage = 1;
        loadRecordings();
    });
});

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">总录音数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.pending}</div>
                    <div class="stat-label">待审核</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.approved}</div>
                    <div class="stat-label">已通过</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.rejected}</div>
                    <div class="stat-label">已拒绝</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.recent_uploads}</div>
                    <div class="stat-label">24小时内</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 加载录音列表
async function loadRecordings() {
    try {
        const recordingsGrid = document.getElementById('recordingsGrid');
        recordingsGrid.innerHTML = '<div class="loading">正在加载录音数据...</div>';

        const params = new URLSearchParams({
            page: currentPage,
            per_page: perPage
        });

        if (currentFilter) {
            params.append('status', currentFilter);
        }

        const response = await fetch(`/api/recordings?${params}`);
        const data = await response.json();

        if (data.success) {
            renderRecordings(data.recordings);
            renderPagination(data.total, data.pages);
            updateTotalCount(data.total);
        } else {
            throw new Error(data.error || '加载数据失败');
        }
    } catch (error) {
        console.error('加载录音列表失败:', error);
        document.getElementById('recordingsGrid').innerHTML = `
            <div class="empty-state">
                <h3>加载失败</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// 渲染录音列表
function renderRecordings(recordings) {
    const recordingsGrid = document.getElementById('recordingsGrid');

    if (recordings.length === 0) {
        recordingsGrid.innerHTML = `
            <div class="empty-state">
                <h3>暂无录音数据</h3>
                <p>还没有录音上传记录</p>
            </div>
        `;
        return;
    }

    recordingsGrid.innerHTML = recordings.map(recording => `
        <div class="recording-item" id="recording-${recording.id}">
            <div class="recording-header">
                <div class="recording-id">
                    ID: ${recording.id}
                    <svg class="play-icon" onclick="playRecording('${recording.id}')" viewBox="0 0 24 24" fill="#ffffff" title="播放录音">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <div class="playing-indicator" id="playing-${recording.id}">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                </div>
                <div class="recording-status status-${recording.status}">
                    ${getStatusText(recording.status)}
                </div>
            </div>

            <div class="recording-content">
                <div class="content-section">
                    <div class="content-label">原文本</div>
                    <div class="content-text">${recording.original_text}</div>
                </div>
                <div class="content-section">
                    <div class="content-label">实际内容</div>
                    <textarea
                        class="actual-content-input"
                        id="actual-${recording.id}"
                        placeholder="输入实际听到的内容..."
                    >${recording.actual_content || ''}</textarea>
                </div>
            </div>

            <div class="recording-meta">
                <div class="meta-info">
                    <div class="meta-item">
                         ${formatDate(recording.upload_time)}
                    </div>
                    <div class="meta-item">
                        📁 ${formatFileSize(recording.file_size)}
                    </div>
                    <div class="meta-item">
                        🔗 ${recording.ip_address}
                    </div>
                </div>
                <div class="recording-actions">
                    <button class="btn-small btn-save" onclick="saveActualContent('${recording.id}')">
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
                            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                        </svg>
                        保存
                    </button>
                    <div class="action-divider"></div>
                    <button class="btn-small btn-approve" onclick="updateStatus('${recording.id}', 'approved')" title="通过">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button class="btn-small btn-reject" onclick="updateStatus('${recording.id}', 'rejected')" title="拒绝">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    <div class="three-dots-menu">
                        <button class="three-dots-btn" onclick="toggleDropdown('${recording.id}')">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2"/>
                                <circle cx="12" cy="12" r="2"/>
                                <circle cx="12" cy="19" r="2"/>
                            </svg>
                        </button>
                        <div class="dropdown-menu" id="dropdown-${recording.id}">
                            <button class="dropdown-item" onclick="downloadRecording('${recording.id}')">
                                下载音频
                            </button>
                            <button class="dropdown-item" onclick="deleteRecording('${recording.id}', '${recording.filename}')">
                                删除录音
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 渲染分页
function renderPagination(total, pages) {
    const pagination = document.getElementById('pagination');

    if (pages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // 上一页按钮
    paginationHTML += `
        <button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            上一页
        </button>
    `;

    // 页码按钮
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(pages, currentPage + 2);

    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button ${i === currentPage ? 'class="current-page"' : ''} onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }

    if (endPage < pages) {
        if (endPage < pages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button onclick="changePage(${pages})">${pages}</button>`;
    }

    // 下一页按钮
    paginationHTML += `
        <button ${currentPage === pages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            下一页
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

// 更新总数显示
function updateTotalCount(total) {
    document.getElementById('totalCount').textContent = `总计: ${total} 条`;
}

// 切换页面
function changePage(page) {
    currentPage = page;
    loadRecordings();
}

// 播放录音
async function playRecording(recordingId) {
    // 如果正在播放同一个录音，停止播放
    if (currentPlayingId === recordingId && currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        currentAudio = null;
        currentPlayingId = null;
        hidePlayingIndicator(recordingId);
        return;
    }

    // 如果正在播放其他录音，停止它
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        hidePlayingIndicator(currentPlayingId);
    }

    // 隐藏所有播放指示器
    document.querySelectorAll('.playing-indicator').forEach(indicator => {
        indicator.classList.remove('active');
    });

    // 显示当前播放指示器
    showPlayingIndicator(recordingId);

    try {
        // 统一使用下载接口，后端会自动判断文件位置
        const audioUrl = `/admin/api/download/${recordingId}?download=false`;

        // 创建新的音频对象
        const audio = new Audio(audioUrl);

        audio.addEventListener('ended', () => {
            hidePlayingIndicator(recordingId);
            currentAudio = null;
            currentPlayingId = null;
        });

        audio.addEventListener('error', (error) => {
            console.error('播放失败:', error);
            hidePlayingIndicator(recordingId);
            alert('播放失败，可能音频文件不存在');
            currentAudio = null;
            currentPlayingId = null;
        });

        currentAudio = audio;
        currentPlayingId = recordingId;
        await audio.play();

    } catch (error) {
        console.error('播放失败:', error);
        hidePlayingIndicator(recordingId);
        alert('播放失败: ' + error.message);
        currentAudio = null;
        currentPlayingId = null;
    }
}

function showPlayingIndicator(recordingId) {
    const indicator = document.getElementById(`playing-${recordingId}`);
    if (indicator) {
        indicator.classList.add('active');
    }
}

function hidePlayingIndicator(recordingId) {
    const indicator = document.getElementById(`playing-${recordingId}`);
    if (indicator) {
        indicator.classList.remove('active');
    }
}

// 保存录音内容
async function saveRecording(recordingId) {
    try {
        const actualContent = document.getElementById(`actual-${recordingId}`).value;

        const response = await fetch(`/api/recording/${recordingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                actual_content: actualContent
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('保存成功');
        } else {
            throw new Error(data.error || '保存失败');
        }
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 保存实际内容
async function saveActualContent(recordingId) {
    try {
        const actualContent = document.getElementById(`actual-${recordingId}`).value;

        const response = await fetch(`/api/recording/${recordingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                actual_content: actualContent
            })
        });

        const data = await response.json();

        if (data.success) {
            // 显示保存成功提示
            const saveBtn = document.querySelector(`#recording-${recordingId} .btn-save`);
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>已保存';
            saveBtn.style.background = 'linear-gradient(145deg, #00C851, #00A846)';

            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.background = '';
            }, 2000);
        } else {
            throw new Error(data.error || '保存失败');
        }
    } catch (error) {
        console.error('保存实际内容失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 更新状态
async function updateStatus(recordingId, status) {
    try {
        // 获取实际内容
        const actualContent = document.getElementById(`actual-${recordingId}`).value;

        const response = await fetch(`/api/recording/${recordingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: status,
                actual_content: actualContent
            })
        });

        const data = await response.json();

        if (data.success) {
            // 更新状态显示
            const statusElement = document.querySelector(`#recording-${recordingId} .recording-status`);
            statusElement.className = `recording-status status-${status}`;
            statusElement.textContent = getStatusText(status);

            // 重新加载统计信息
            loadStats();
        } else {
            throw new Error(data.error || '更新失败');
        }
    } catch (error) {
        console.error('更新状态失败:', error);
        alert('更新失败: ' + error.message);
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待审核',
        'approved': '已通过',
        'rejected': '已拒绝'
    };
    return statusMap[status] || status;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// API密钥管理功能
function loadApiKeys() {
    fetch('/api/keys')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderApiKeys(data.keys);
            } else {
                throw new Error(data.error || '加载密钥失败');
            }
        })
        .catch(error => {
            console.error('Load API keys error:', error);
            document.getElementById('keysGrid').innerHTML = `
                <div class="empty-state">
                    <h3>加载失败</h3>
                    <p>${error.message}</p>
                </div>
            `;
        });
}

function renderApiKeys(keys) {
    const keysGrid = document.getElementById('keysGrid');

    if (keys.length === 0) {
        keysGrid.innerHTML = `
            <div class="empty-state">
                <h3>暂无API密钥</h3>
                <p>点击"创建新密钥"按钮创建您的第一个API密钥</p>
            </div>
        `;
        return;
    }

    keysGrid.innerHTML = keys.map(key => `
        <div class="key-item">
            <div class="key-header">
                <div class="key-info">
                    <h4>${key.name}</h4>
                    <span class="key-status ${key.is_active ? 'active' : 'inactive'}">
                        ${key.is_active ? '激活' : '禁用'}
                    </span>
                </div>
                <div class="key-actions">
                    <button class="btn-small ${key.is_active ? 'btn-warn' : 'btn-success'}"
                            onclick="toggleKeyStatus(${key.id}, ${!key.is_active})">
                        ${key.is_active ? '禁用' : '启用'}
                    </button>
                    <button class="btn-small btn-info" onclick="copyKey('${key.key}')">复制</button>
                    <button class="btn-small btn-warn" onclick="resetKeyUsage(${key.id})">重置</button>
                    <button class="btn-small btn-danger" onclick="deleteKey(${key.id})">删除</button>
                </div>
            </div>
            <div class="key-details">
                <div class="key-field">
                    <label>密钥:</label>
                    <code>${key.key.substring(0, 20)}...</code>
                </div>
                <div class="key-field">
                    <label>描述:</label>
                    <span>${key.description || '无描述'}</span>
                </div>
                <div class="key-field">
                    <label>创建时间:</label>
                    <span>${formatDate(key.created_time)}</span>
                </div>
                <div class="key-field">
                    <label>最后使用:</label>
                    <span>${key.last_used ? formatDate(key.last_used) : '从未使用'}</span>
                </div>
                <div class="key-field">
                    <label>使用次数:</label>
                    <span>${key.usage_count} / ${key.max_requests}</span>
                </div>
                <div class="usage-bar">
                    <div class="usage-fill" style="width: ${(key.usage_count / key.max_requests * 100).toFixed(1)}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function showCreateKeyModal() {
    document.getElementById('createKeyModal').style.display = 'flex';
}

function closeCreateKeyModal() {
    document.getElementById('createKeyModal').style.display = 'none';
    // 清空表单
    document.getElementById('keyName').value = '';
    document.getElementById('keyDescription').value = '';
    document.getElementById('maxRequests').value = '1000';
}

function createKey() {
    const name = document.getElementById('keyName').value.trim();
    const description = document.getElementById('keyDescription').value.trim();
    const maxRequests = parseInt(document.getElementById('maxRequests').value);

    if (!name) {
        alert('请输入密钥名称');
        return;
    }

    fetch('/api/keys', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            description: description,
            max_requests: maxRequests
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`API密钥创建成功！\n\n密钥: ${data.key.key}\n\n请妥善保管此密钥！`);
            closeCreateKeyModal();
            loadApiKeys();
        } else {
            throw new Error(data.error || '创建密钥失败');
        }
    })
    .catch(error => {
        console.error('Create key error:', error);
        alert('创建密钥失败: ' + error.message);
    });
}

function toggleKeyStatus(keyId, isActive) {
    fetch(`/api/keys/${keyId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            is_active: isActive
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadApiKeys();
        } else {
            throw new Error(data.error || '更新密钥状态失败');
        }
    })
    .catch(error => {
        console.error('Toggle key status error:', error);
        alert('更新密钥状态失败: ' + error.message);
    });
}

function copyKey(key) {
    console.log('Attempting to copy key, checking clipboard support...');

    // 方法1: 尝试使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log('Clipboard API is supported, trying to write text...');
        navigator.clipboard.writeText(key).then(() => {
            console.log('Clipboard API succeeded');
            showToast('API密钥已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('Clipboard API failed:', err);
            console.log('Falling back to execCommand method...');
            // 降级到方法2
            fallbackCopyTextToClipboard(key);
        });
    } else {
        console.log('Clipboard API not supported, using fallback method...');
        // 直接降级到方法2
        fallbackCopyTextToClipboard(key);
    }
}

function fallbackCopyTextToClipboard(text) {
    console.log('Trying fallback execCommand method...');

    // 方法2: 使用传统 document.execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // 避免滚动到底部
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        console.log('execCommand result:', successful);
        if (successful) {
            showToast('API密钥已复制到剪贴板', 'success');
        } else {
            console.log('execCommand failed, using modal method...');
            // 降级到方法3
            showKeyInModal(text);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        console.log('Using modal method as last resort...');
        // 降级到方法3
        showKeyInModal(text);
    }

    document.body.removeChild(textArea);
}

function showKeyInModal(text) {
    // 方法3: 显示密钥在弹窗中供用户手动复制
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
            text-align: center;
        ">
            <h3 style="margin: 0 0 20px 0; color: #333;">手动复制API密钥</h3>
            <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                请选中下面的密钥并复制 (Ctrl+C 或 Cmd+C):
            </p>
            <div style="
                background: #f8f9fa;
                border: 2px solid #e9ecef;
                border-radius: 5px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                word-break: break-all;
                margin: 0 0 20px 0;
                cursor: pointer;
                user-select: all;
            " onclick="this.select();">
                ${text}
            </div>
            <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            ">关闭</button>
        </div>
    `;

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    document.body.appendChild(modal);

    // 自动选中密钥文本
    setTimeout(() => {
        const keyElement = modal.querySelector('div[onclick*="select"]');
        if (keyElement) {
            const range = document.createRange();
            range.selectNodeContents(keyElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }, 100);

    showToast('请在弹窗中手动复制密钥', 'info');
}

function resetKeyUsage(keyId) {
    if (confirm('确定要重置此密钥的使用次数吗？')) {
        fetch(`/api/keys/${keyId}/reset`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
            showToast('使用次数已重置', 'success');
            loadApiKeys();
            } else {
                throw new Error(data.error || '重置使用次数失败');
            }
        })
        .catch(error => {
            console.error('Reset key usage error:', error);
            showToast('重置使用次数失败: ' + error.message, 'error');
        });
    }
}

function deleteKey(keyId) {
    if (confirm('确定要删除此API密钥吗？此操作不可恢复！')) {
        fetch(`/api/keys/${keyId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('API密钥已删除', 'success');
                loadApiKeys();
            } else {
                throw new Error(data.error || '删除密钥失败');
            }
        })
        .catch(error => {
            console.error('Delete key error:', error);
            showToast('删除密钥失败: ' + error.message, 'error');
        });
    }
}

// 三点菜单功能
function toggleDropdown(recordingId) {
    const dropdown = document.getElementById(`dropdown-${recordingId}`);

    // 关闭所有其他下拉菜单
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `dropdown-${recordingId}`) {
            menu.classList.remove('show');
        }
    });

    // 切换当前下拉菜单
    dropdown.classList.toggle('show');
}

// 点击页面其他地方关闭下拉菜单
document.addEventListener('click', function(event) {
    if (!event.target.closest('.three-dots-menu')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

// 下载录音
function downloadRecording(recordingId) {
    const downloadUrl = `/admin/api/download/${recordingId}?download=true`;

    // 创建隐藏的a标签来下载文件
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = ''; // 让服务器设置文件名
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 关闭下拉菜单
    document.getElementById(`dropdown-${recordingId}`).classList.remove('show');
}

// 删除录音确认
function deleteRecording(id, filename) {
    if (confirm(`确定要删除这条录音吗？\n文件名: ${filename}`)) {
        fetch(`/admin/api/recordings/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('录音删除成功', 'success');

                // 移除被删除的录音元素，而不是刷新整个页面
                const recordingElement = document.getElementById(`recording-${id}`);
                if (recordingElement) {
                    // 添加淡出动画
                    recordingElement.style.transition = 'opacity 0.3s ease-out';
                    recordingElement.style.opacity = '0';

                    setTimeout(() => {
                        recordingElement.remove();

                        // 检查是否需要重新加载页面数据（如果当前页没有数据了）
                        const remainingRecordings = document.querySelectorAll('.recording-item');
                        if (remainingRecordings.length === 0) {
                            // 如果没有录音了，重新加载数据
                            loadRecordings();
                        } else {
                            // 更新统计信息
                            loadStats();
                            // 更新总数显示
                            const currentTotal = parseInt(document.getElementById('totalCount').textContent.match(/\d+/)[0]);
                            document.getElementById('totalCount').textContent = `总计: ${currentTotal - 1} 条`;
                        }
                    }, 300);
                }
            } else {
                showToast('删除失败: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('删除出错:', error);
            showToast('删除失败，请重试', 'error');
        });
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // 获取类型特定的样式
    const typeStyles = getTypeSpecificStyles(type);
    const borderColors = {
        'success': 'rgba(0, 255, 136, 0.3)',
        'error': 'rgba(255, 51, 51, 0.3)',
        'warning': 'rgba(255, 170, 0, 0.3)',
        'info': 'rgba(59, 130, 246, 0.3)'
    };

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 12px;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        opacity: 0;
        transform: translateX(120%);
        transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.5px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 2px solid transparent;
        background-clip: padding-box;
        ${typeStyles}
    `;

    document.body.appendChild(toast);

    // 触发滑入动画
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
        toast.style.borderColor = borderColors[type] || borderColors['info'];
    });

    // 触发滑出动画
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

function getTypeSpecificStyles(type) {
    const styles = {
        'success': {
            background: 'linear-gradient(135deg, #0a4f3c 0%, #0f766e 100%)',
            color: '#ffffff',
            textShadow: '0 0 10px rgba(0, 255, 136, 0.3)'
        },
        'error': {
            background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
            color: '#ffffff',
            textShadow: '0 0 10px rgba(255, 51, 51, 0.3)'
        },
        'warning': {
            background: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)',
            color: '#ffffff',
            textShadow: '0 0 10px rgba(255, 170, 0, 0.3)'
        },
        'info': {
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
            color: '#ffffff',
            textShadow: '0 0 10px rgba(59, 130, 246, 0.3)'
        }
    };

    const style = styles[type] || styles['info'];
    return `
        background: ${style.background};
        color: ${style.color};
        text-shadow: ${style.textShadow};
    `;
}

// 定期刷新统计信息（每30秒）
setInterval(loadStats, 30000);