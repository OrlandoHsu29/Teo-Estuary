// 密钥配置共享模块
// API配置
const API_BASE_URL = 'http://localhost:5000';

// 更新密钥按钮状态
function updateKeyButtonState() {
    const keyBtn = document.getElementById('keyConfigBtn');
    if (!keyBtn) return;

    const savedKey = localStorage.getItem('apiKey');

    if (savedKey) {
        keyBtn.classList.add('configured');
        keyBtn.classList.remove('unconfigured');
    } else {
        keyBtn.classList.remove('configured');
        keyBtn.classList.add('unconfigured');
    }
}

// 打开密钥配置弹窗
function openKeyConfig() {
    const overlay = document.getElementById('keyConfigOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        const savedKey = localStorage.getItem('apiKey');
        if (savedKey) {
            const input = document.getElementById('apiKey');
            if (input) input.value = savedKey;
        }
    }
}

// 关闭密钥配置弹窗
function closeKeyConfig() {
    const overlay = document.getElementById('keyConfigOverlay');
    if (overlay) overlay.style.display = 'none';
}

// 清空密钥
function clearApiKey() {
    if (confirm('确定要清空API密钥吗？清空后需要重新配置才能使用功能。')) {
        localStorage.removeItem('apiKey');
        const input = document.getElementById('apiKey');
        if (input) input.value = '';
        closeKeyConfig();
        updateKeyButtonState();

        // 如果有录音机实例，更新状态
        if (window.recorder && window.recorder.setPoweredOffState) {
            window.recorder.setPoweredOffState();
            window.recorder.updateStatus('需要先配置API密钥才能使用', 'error');
            window.recorder.showToast('API密钥已清空，请重新配置', 'info');
        }
    }
}

// 保存密钥
function saveApiKey() {
    const input = document.getElementById('apiKey');
    const apiKey = input ? input.value.trim() : '';

    if (!apiKey) {
        alert('请输入API密钥');
        return;
    }

    // 先验证密钥，验证通过后再保存
    testApiKey(apiKey, true);
}

// 验证密钥
function testApiKey(apiKey, shouldSave = false) {
    fetch(`${API_BASE_URL}/api/apikey-verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (shouldSave) {
                localStorage.setItem('apiKey', apiKey);
            }
            updateKeyButtonState();
            closeKeyConfig();
            alert('API密钥配置成功！');

            // 更新录音机状态
            if (window.recorder && window.recorder.checkApiKeyStatus) {
                window.recorder.checkApiKeyStatus();
            }
        } else {
            alert('API密钥验证失败: ' + data.error);
            if (shouldSave) {
                localStorage.removeItem('apiKey');
            }
            updateKeyButtonState();
        }
    })
    .catch(error => {
        console.error('API密钥验证错误:', error);
        alert('API密钥验证失败，请检查网络连接');
        if (shouldSave) {
            localStorage.removeItem('apiKey');
        }
        updateKeyButtonState();
    });
}

// 跳转到主页密钥配置（如果需要）
function goToKeyConfig() {
    // 检查当前页面是否有密钥配置弹窗
    const overlay = document.getElementById('keyConfigOverlay');
    if (overlay) {
        // 当前页面有弹窗，直接打开
        openKeyConfig();
    } else {
        // 当前页面没有弹窗，跳转到主页
        window.location.href = '../index.html?openKeyConfig=true';
    }
}

// 关闭密钥过期弹窗
function closeKeyExpired() {
    const overlay = document.getElementById('keyExpiredOverlay');
    if (overlay) overlay.style.display = 'none';
}

// 显示密钥过期弹窗
function showKeyExpired() {
    const overlay = document.getElementById('keyExpiredOverlay');
    if (overlay) overlay.style.display = 'flex';
}

// 从过期弹窗跳转到密钥配置
function goToKeyConfigFromModal() {
    closeKeyExpired();

    // 检查当前页面是否有密钥配置弹窗
    const overlay = document.getElementById('keyConfigOverlay');
    if (overlay) {
        openKeyConfig();
    } else {
        window.location.href = '../index.html?openKeyConfig=true';
    }
}

// 初始化密钥配置功能
function initKeyConfig() {
    updateKeyButtonState();

    // 检查是否需要打开密钥配置（从URL参数）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openKeyConfig') === 'true') {
        setTimeout(() => {
            const overlay = document.getElementById('keyConfigOverlay');
            if (overlay) {
                openKeyConfig();
            }
            // 清除URL参数
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
}

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyConfig);
} else {
    initKeyConfig();
}
