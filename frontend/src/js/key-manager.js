/**
 * 提供统一的密钥配置弹窗和状态管理
 */

// 获取密钥状态
function getApiKeyStatus() {
    return localStorage.getItem('apiKey') || null;
}

// 验证密钥是否有效
async function validateApiKey() {
    const apiKey = getApiKeyStatus();
    if (!apiKey) {
        return { valid: false, exists: false };
    }

    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/validate-key`, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            return { valid: true, exists: true };
        } else if (response.status === 401 || response.status === 403) {
            return { valid: false, exists: true, expired: true };
        } else {
            return { valid: false, exists: true };
        }
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('无法验证密钥:', error);

        // 判断是超时还是其他网络错误
        if (error.name === 'AbortError') {
            showToast('连接超时，无法连接到服务器', 'error');
        } else {
            showToast('网络错误，无法连接到服务器', 'error');
        }

        // 网络错误时返回无效状态，显示红色
        return { valid: false, exists: true, networkError: true };
    }
}

// 更新密钥按钮状态
function updateKeyButtonState(validationResult = null) {
    const keyBtn = document.getElementById('keyConfigBtn');
    if (!keyBtn) return;

    // 如果提供了验证结果，根据验证结果设置状态
    if (validationResult) {
        if (!validationResult.exists) {
            // 没有密钥 - 红色
            keyBtn.classList.remove('configured');
            keyBtn.classList.add('unconfigured');
        } else if (validationResult.expired || validationResult.valid === false || validationResult.networkError) {
            // 密钥已失效、无效或网络错误 - 红色
            keyBtn.classList.remove('configured');
            keyBtn.classList.add('unconfigured');
        } else if (validationResult.valid === true) {
            // 密钥有效 - 绿色
            keyBtn.classList.add('configured');
            keyBtn.classList.remove('unconfigured');
        } else {
            // 其他未知状态 - 检查本地是否有密钥
            const savedKey = getApiKeyStatus();
            if (!savedKey) {
                keyBtn.classList.remove('configured');
                keyBtn.classList.add('unconfigured');
            } else {
                // 有密钥但状态未知 - 保持默认暗色
                keyBtn.classList.remove('configured');
                keyBtn.classList.remove('unconfigured');
            }
        }
    } else {
        // 没有提供验证结果，检查本地是否有密钥
        const savedKey = getApiKeyStatus();
        if (!savedKey) {
            // 没有密钥 - 红色
            keyBtn.classList.remove('configured');
            keyBtn.classList.add('unconfigured');
        } else {
            // 有密钥但还未验证 - 保持默认暗色
            keyBtn.classList.remove('configured');
            keyBtn.classList.remove('unconfigured');
        }
    }
}

// 显示密钥配置询问弹窗
function showKeyConfigPrompt() {
    const overlay = document.createElement('div');
    overlay.className = 'key-config-prompt-overlay';
    overlay.id = 'keyConfigPromptOverlay';

    overlay.innerHTML = `
        <div class="key-config-prompt-modal">
            <div class="key-config-prompt-header">
                <h3>API 密钥配置</h3>
            </div>
            <div class="key-config-prompt-content">
                <p>需要跳转到主页面进行密钥配置</p>
                <p class="prompt-detail">是否跳转到主页面？</p>
                <div class="key-config-prompt-actions">
                    <button class="btn-cancel" onclick="KeyManager.closeKeyConfigPrompt()">取消</button>
                    <button class="btn-confirm" onclick="KeyManager.confirmGoToKeyConfig()">前往配置</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 触发动画
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);

    return overlay;
}

// 关闭密钥配置询问弹窗
function closeKeyConfigPrompt() {
    const overlay = document.getElementById('keyConfigPromptOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

// 确认跳转到密钥配置页面
function confirmGoToKeyConfig() {
    closeKeyConfigPrompt();
    window.location.href = '../index.html?openKeyConfig=true';
}

// 跳转到主页密钥配置（通过询问弹窗）
function goToKeyConfig() {
    showKeyConfigPrompt();
}

// 密钥配置按钮点击事件（如果元素存在）
document.addEventListener('DOMContentLoaded', function() {
    // 初始化密钥按钮状态
    updateKeyButtonState();

    // 监听 storage 变化，当密钥在其他页面更新时同步状态
    window.addEventListener('storage', function(e) {
        if (e.key === 'apiKey') {
            updateKeyButtonState();
        }
    });
});

// 通用 Toast 提示函数
function showToast(message, type = 'info') {
    const toast = document.getElementById('toastUniversal');
    if (!toast) return;

    // 移除所有类型类
    toast.classList.remove('success', 'error', 'warning', 'info', 'show');

    // 设置消息内容
    toast.textContent = message;

    // 添加新类型类
    toast.classList.add(type);

    // 触发动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 3秒后自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}


// 处理API响应中的401/403错误，自动更新密钥按钮状态
async function handleApiResponse(response) {
    // 处理401/403未授权错误
    if (response.status === 401 || response.status === 403) {
        // 密钥已失效，更新按钮状态为红色
        updateKeyButtonState({ valid: false, exists: true, expired: true });
    }
    return response;
}

// 导出函数供全局使用
window.KeyManager = {
    API_BASE_URL: window.API_BASE_URL,
    getApiKeyStatus,
    validateApiKey,
    updateKeyButtonState,
    showKeyConfigPrompt,
    closeKeyConfigPrompt,
    confirmGoToKeyConfig,
    goToKeyConfig,
    handleApiResponse,
    showToast
};
