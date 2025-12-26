/**
 * 密钥管理共享模块
 * 提供统一的密钥配置弹窗和状态管理
 */

// API配置（统一的API地址）
const API_BASE_URL = 'https://your-domain.com';

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

    try {
        const response = await fetch(`${API_BASE_URL}/api/validate-key`, {
            method: 'GET',
            headers: {
                'X-API-Key': apiKey
            }
        });

        if (response.ok) {
            return { valid: true, exists: true };
        } else if (response.status === 401 || response.status === 403) {
            return { valid: false, exists: true, expired: true };
        } else {
            return { valid: false, exists: true };
        }
    } catch (error) {
        console.warn('无法验证密钥:', error);
        // 网络错误时返回未知状态，但不阻止使用
        return { valid: null, exists: true, networkError: true };
    }
}

// 更新密钥按钮状态
function updateKeyButtonState() {
    const keyBtn = document.getElementById('keyConfigBtn');
    if (!keyBtn) return;

    const savedKey = getApiKeyStatus();

    if (savedKey) {
        keyBtn.classList.add('configured');
        keyBtn.classList.remove('unconfigured');
    } else {
        keyBtn.classList.remove('configured');
        keyBtn.classList.add('unconfigured');
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

// 导出函数供全局使用
window.KeyManager = {
    getApiKeyStatus,
    validateApiKey,
    updateKeyButtonState,
    showKeyConfigPrompt,
    closeKeyConfigPrompt,
    confirmGoToKeyConfig,
    goToKeyConfig
};
