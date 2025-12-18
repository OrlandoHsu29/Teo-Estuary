// 工具函数

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

// Toast通知
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    // 设置消息和样式
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    // 设置图标
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠'
    };
    toastIcon.textContent = icons[type] || icons.success;

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 模拟翻页音效（可选）
function playFlipSound() {
    try {
        // 创建一个简单的点击音效来模拟机械翻页声
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // 忽略音频错误，不影响翻页功能
        console.log('Audio feedback not available');
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        showToast('复制失败', 'error');
    });
}