// 统计数据管理

// 初始化统计数据（只执行一次）
async function initializeStats() {
    try {
        const response = await fetch('/api/stats');

        if (!response.ok) {
            // 处理HTTP错误
            const errorText = await response.text();
            console.error('HTTP错误:', response.status, errorText);
            showToast('获取统计数据失败，服务器错误', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
            const stats = data.stats;

            // 更新全局所有数据总量（用于统计面板）
            if (stats.total !== undefined) {
                window.allDataCount = stats.total;
            }

            // 只更新数字，因为HTML中已经有了默认结构
            updateStatNumber('stat-pending', stats.pending || 0);
            updateStatNumber('stat-approved', stats.approved || 0);
            updateStatNumber('stat-rejected', stats.rejected || 0);
            updateStatNumber('stat-total', stats.total || 0);
            updateStatNumber('stat-transcribed', stats.transcribed || 0);
        } else {
            // 处理业务逻辑错误
            console.error('统计数据错误:', data.error);
            showToast(data.error || '获取统计数据失败', 'error');
        }
    } catch (error) {
        console.error('初始化统计数据失败:', error);
        showToast('网络错误，无法获取统计数据', 'error');
    }
}

// 更新统计数据（只更新数字，不重新渲染）
async function loadStats() {
    try {
        const response = await fetch('/api/stats');

        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP错误:', response.status, errorText);
            showToast('更新统计数据失败，服务器错误', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
            const stats = data.stats;

            // 更新全局所有数据总量（用于统计面板）
            if (stats.total !== undefined) {
                window.allDataCount = stats.total;
            }

            // 只更新数字，避免重新渲染
            updateStatNumber('stat-pending', stats.pending || 0);
            updateStatNumber('stat-approved', stats.approved || 0);
            updateStatNumber('stat-rejected', stats.rejected || 0);
            updateStatNumber('stat-total', stats.total || 0);
            updateStatNumber('stat-transcribed', stats.transcribed || 0);
        } else {
            console.error('统计数据错误:', data.error);
            showToast(data.error || '更新统计数据失败', 'error');
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showToast('网络错误，无法更新统计数据', 'error');
    }
}

// 简洁数字更新动画
function updateStatNumber(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const currentValue = parseInt(element.textContent) || 0;

    // 如果数字没有变化，不执行任何操作
    if (currentValue === newValue) return;

    // 添加更新动画类
    element.classList.add('updating');

    // 在动画中段更新数字
    setTimeout(() => {
        element.textContent = newValue;
    }, 150);

    // 移除动画类
    setTimeout(() => {
        element.classList.remove('updating');
    }, 300);
}

// 更新记录计数器
function updateReviewCounter() {
    const currentIndexElement = document.getElementById('currentIndex');
    const totalRecordsElement = document.getElementById('totalRecords');

    // 如果没有数据，分子清零
    if (recordingsData.length === 0) {
        if (currentIndexElement) {
            currentIndexElement.textContent = '0';
        }
        if (totalRecordsElement) {
            totalRecordsElement.textContent = window.totalDataCount || '0';
        }
        return;
    }

    // 显示当前索引和总数
    if (currentIndexElement) {
        // 显示绝对索引（相对于总数据量）
        currentIndexElement.textContent = absoluteRecordIndex + 1;
    }

    if (totalRecordsElement) {
        // 优先显示总数据量，如果没有则显示当前页数据量
        totalRecordsElement.textContent = window.totalDataCount || recordingsData.length;
    }
}