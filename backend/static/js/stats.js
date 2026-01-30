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
            updateStatNumber('stat-reference', stats.reference_count || 0);
            updateDurationDisplay(stats.total_approved_duration || 0);
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
            updateStatNumber('stat-reference', stats.reference_count || 0);
            updateDurationDisplay(stats.total_approved_duration || 0);

            // 更新 Emilia 服务状态
            updateEmiliaStatus(stats.emilia);

            // 更新参考文本生成任务状态
            updateGenerationTaskStatus(stats.processing_task);

        } else {
            console.error('统计数据错误:', data.error);
            showToast(data.error || '更新统计数据失败', 'error');
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showToast('网络错误，无法更新统计数据', 'error');
    }
}

// 更新 Emilia 服务状态
function updateEmiliaStatus(emilia) {
    const healthDot = document.getElementById("emiliaHealthDot");
    const pendingNumber = document.getElementById("emiliaPendingNumber");
    const importBtn = document.getElementById("emiliaImportBtn");
    const importText = document.getElementById("emiliaImportText");

    if (!healthDot || !pendingNumber) return;

    if (emilia && emilia.status === "healthy") {
        // 服务健康 - 绿色
        healthDot.className = "health-dot online";

        // 待处理素材
        const pendingCount = emilia.pending_count || 0;
        pendingNumber.textContent = pendingCount;

        if (pendingCount > 0) {
            pendingNumber.style.color = "#D7AD59";
        } else {
            pendingNumber.style.color = "#5EE11E";
        }

        // 检查批处理任务状态
        const batchTask = emilia.batch_task;

        if (batchTask && importBtn && importText) {
            if (batchTask.status === 'processing' || batchTask.status === 'pending') {
                // 任务正在处理中
                importBtn.disabled = true;
                const processed = batchTask.processed_files || 0;
                const total = batchTask.total_files || 0;
                importText.textContent = total > 0 ? `转录中 ${processed}/${total}` : "转录中...";
            } else if (batchTask.status === 'completed') {
                // 任务完成
                importBtn.disabled = pendingCount === 0;
                importText.textContent = "数据转录";
            } else if (batchTask.status === 'failed') {
                // 任务失败
                importBtn.disabled = pendingCount === 0;
                importText.textContent = "转录失败";
                setTimeout(() => {
                    importText.textContent = "数据转录";
                }, 3000);
            } else {
                // 无任务或其他状态
                importBtn.disabled = pendingCount === 0;
                if (importText.textContent.includes("转录中")) {
                    importText.textContent = "数据转录";
                }
            }
        } else if (importBtn && importText) {
            // 没有批处理任务
            importBtn.disabled = pendingCount === 0;
            if (importText.textContent.includes("转录中")) {
                importText.textContent = "数据转录";
            }
        }
    } else {
        // 服务异常 - 红色
        healthDot.className = "health-dot offline";
        pendingNumber.textContent = "X";
        pendingNumber.style.color = "#FF4D4F";
    }
}

// 更新参考文本生成任务状态
function updateGenerationTaskStatus(task) {
    const generateBtn = document.getElementById("referenceGenerateBtn");
    const generateText = document.getElementById("referenceGenerateText");

    if (!generateBtn || !generateText) return;

    if (!task) {
        // 没有正在处理的任务
        if (generateText.textContent.includes("生成中")) {
            generateBtn.disabled = false;
            generateText.textContent = "生成文本";
        }
        return;
    }

    if (task.status === 'processing') {
        // 任务正在处理中
        generateBtn.disabled = true;
        generateText.textContent = "生成中...";
    } else if (task.status === 'completed') {
        // 任务完成
        generateBtn.disabled = false;
        generateText.textContent = "生成文本";
        showToast(`参考文本生成完成，任务ID: ${task.id}`, "success");
    } else if (task.status === 'failed') {
        // 任务失败
        generateBtn.disabled = false;
        generateText.textContent = "生成失败";
        showToast(`参考文本生成失败: ${task.error_message || '未知错误'}`, "error");
        setTimeout(() => {
            generateText.textContent = "生成文本";
        }, 3000);
    }
}

// 页面加载时初始化自动轮询
document.addEventListener("DOMContentLoaded", function() {
    // 延迟1秒后开始轮询，避免影响页面加载
    setTimeout(() => {
        // 立即执行一次
        loadStats();

        // 每5秒轮询一次统计数据和任务状态
        setInterval(loadStats, 5000);
    }, 1000);
});

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

    // 参考文本数量特殊颜色处理
    if (elementId === 'stat-reference') {
        if (newValue <= 20) {
            element.style.color = '#ff4d4f'; // 红色
        } else if (newValue <= 100) {
            element.style.color = '#FBC55B'; // 黄色
        } else {
            element.style.color = '#00ffff'; // 主题色
        }
    }
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

// 更新有效时长显示
function updateDurationDisplay(totalSeconds) {
    const element = document.getElementById('stat-duration');
    if (!element) return;

    // 转换为小时（整数）
    const totalHours = Math.floor(totalSeconds / 3600);

    // 更新显示
    element.textContent = totalHours + "h";

    // 设置title属性，鼠标悬停时显示三位小数
    const totalHoursPrecise = (totalSeconds / 3600).toFixed(3);
    element.parentElement.title = `总有效时长: ${totalHoursPrecise} 小时`;
}
