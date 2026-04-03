// 工具函数

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化时间为中国北京时间（UTC+8）
function formatDateTime(isoString) {
    if (!isoString) return '-';

    try {
        // 检查是否包含时区信息（+或Z）
        let normalizedString = isoString;
        if (!isoString.includes('+') && !isoString.includes('Z')) {
            // 数据库存储时丢失了时区信息，添加UTC时区
            normalizedString = isoString + '+00:00';
        }

        const date = new Date(normalizedString);

        // 如果日期无效，返回原字符串
        if (isNaN(date.getTime())) {
            return isoString;
        }

        // 转换为中国时区格式
        return date.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return isoString;
    }
}

// 格式化时间为简短格式（用于列表显示）
function formatDateTimeShort(isoString) {
    if (!isoString) return '-';

    try {
        // 检查是否包含时区信息（+或Z）
        let normalizedString = isoString;
        if (!isoString.includes('+') && !isoString.includes('Z')) {
            // 数据库存储时丢失了时区信息，添加UTC时区
            normalizedString = isoString + '+00:00';
        }

        const date = new Date(normalizedString);

        if (isNaN(date.getTime())) {
            return isoString;
        }

        return date.toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return isoString;
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

// Toast通知
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    if (!toast || !toastMessage || !toastIcon) {
        return;
    }

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