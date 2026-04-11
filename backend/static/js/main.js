// 新版管理后台JavaScript - 主入口文件
// 全局变量已在 global-vars.js 中定义

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 确保DOM元素存在
    const deviceView = document.getElementById('deviceView');
    const reviewDevice = document.getElementById('reviewDevice');
    const listView = document.getElementById('listView');

    // 初始化各个模块
    initializeNavigation();
    initializeStatusFilters();
    initializeStats(); // 初始化统计数据（只执行一次）

    // 默认使用详细视图
    currentView = 'device';

    // 确保列表视图隐藏（HTML中已经设置了详细视图显示）
    if (listView) listView.style.display = 'none';

    // 隐藏空状态，因为reviewDevice现在默认显示
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }

    // 根据实际视图状态加载数据
    if (currentView === 'list') {
        loadListView();
    } else {
        loadRecordings();
    }

    initializeKeyboardShortcuts();
    updateShortcutHintsVisibility();

    // 初始化搜索功能
    initializeSearch();

    // 状态筛选事件监听
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            currentPage = 1;

            // 在切换状态前，确保关闭所有编辑模式
            if (typeof exitAllEditModes === 'function') {
                exitAllEditModes();
            }

            // 获取筛选器选择的值
            const selectedStatus = this.value;

            // 同步更新状态筛选按钮
            const filterButtons = document.querySelectorAll('.status-filter-btn');
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.status === selectedStatus) {
                    btn.classList.add('active');
                }
            });

            // 更新全局状态筛选变量
            currentStatusFilter = selectedStatus;

            // 根据当前视图加载对应数据
            if (currentView === 'list') {
                loadListView();
            } else {
                loadRecordings();
            }
        });
    }
});

// 下载当前录音
function downloadCurrentRecording() {
    if (!recordingsData.length || currentRecordIndex >= recordingsData.length) return;

    const recording = recordingsData[currentRecordIndex];

    // 检查是否有文件路径
    if (!recording.file_path) {
        showToast('该记录没有音频文件', 'error');
        return;
    }

    // 构造下载URL - 使用正确的后端路径
    const downloadUrl = `/admin/api/download/${recording.id}`;
    const filename = `recording_${recording.id}.webm`;

    // 创建下载链接
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);

    // 使用fetch检查文件是否存在
    fetch(downloadUrl, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                // 文件存在，执行下载
                a.click();
                document.body.removeChild(a);

                // 延迟显示成功消息
                setTimeout(() => {
                    showToast(`下载成功: ${filename}`, 'success');
                }, 200);
            } else {
                document.body.removeChild(a);
                showToast('文件不存在或无法访问', 'error');
            }
        })
        .catch(error => {
            document.body.removeChild(a);
            showToast('下载失败，请检查网络连接', 'error');
        });
}

function deleteCurrentRecording() {
    if (!recordingsData.length || currentRecordIndex >= recordingsData.length) return;

    const recording = recordingsData[currentRecordIndex];

    if (confirm(`确定要删除这条录音吗？\n${recording.mandarin_text || '无标题'}`)) {
        // 调用删除API
        fetch(`/admin/api/recordings/${recording.id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('删除成功', 'success');
                // 从数组中移除
                recordingsData.splice(currentRecordIndex, 1);

                // 注意：currentRecordIndex和absoluteRecordIndex保持不变
                // 因为数组删除后下一个元素自动补位到当前索引位置

                // 调整索引
                if (recordingsData.length === 0) {
                    // 没有更多记录，重新加载
                    loadRecordings();
                } else if (currentRecordIndex >= recordingsData.length) {
                    // 当前索引超出范围，回到最后一条
                    currentRecordIndex = recordingsData.length - 1;
                    // 同步更新absoluteRecordIndex
                    absoluteRecordIndex = (windowStartPage - 1) * 50 + currentRecordIndex;
                    displayCurrentRecord();
                    updateNavigationButtons();
                } else {
                    // 显示当前索引的记录
                    displayCurrentRecord();
                    updateNavigationButtons();
                }

                // 立即更新当前筛选状态的总数和计数器
                if (window.totalDataCount && window.totalDataCount > 0) {
                    window.totalDataCount--;
                    // 如果删除的是最后一条，需要调整absoluteRecordIndex
                    if (absoluteRecordIndex >= window.totalDataCount) {
                        absoluteRecordIndex = window.totalDataCount - 1;
                    }
                }
                updateReviewCounter(); // 立即更新计数器显示
                updateNavigationButtons(); // 再次更新导航按钮状态

                // 异步更新统计面板（不影响当前的计数器显示）
                loadStats();
            } else {
                showToast('删除失败: ' + (data.error || '未知错误'), 'error');
            }
        })
        .catch(error => {
            console.error('删除失败:', error);
            showToast('删除失败: ' + error.message, 'error');
        });
    }
}

// ==================== Emilia 服务控制台功能 ====================

// 数据转录功能
async function importEmiliaData() {
    const importBtn = document.getElementById("emiliaImportBtn");
    const importText = document.getElementById("emiliaImportText");

    if (!importBtn || !importText) return;

    // 检查是否正在处理中
    if (importBtn.disabled) {
        showToast("任务正在处理中，请稍候", "warning");
        return;
    }

    // 禁用按钮，显示状态
    importBtn.disabled = true;
    importText.textContent = "启动中...";

    try {
        const response = await fetch("/admin/api/emilia/batch-import", {
            method: "POST"
        });

        if (response.status === 409) {
            // 任务已在处理中（409 Conflict）
            importText.textContent = "任务处理中";
            // 立即检查一次状态获取最新信息
            setTimeout(() => {
                checkEmiliaHealth();
            }, 500);
            return;
        }

        if (response.status === 202) {
            // 任务已接受，正在处理中（202 Accepted）
            importText.textContent = "转录中...";
            showToast("批处理任务已启动", "success");
            // 立即检查一次状态获取最新进度
            setTimeout(() => {
                checkEmiliaHealth();
            }, 1000);
            return;
        }

        // 如果立即返回200，刷新统计数据
        if (response.status === 200) {
            const result = await response.json();
            importBtn.disabled = false;
            importText.textContent = "数据转录";
            showToast(result.message || "数据转录完成", "success");
            // 刷新统计数据
            if (typeof loadStats === 'function') {
                loadStats();
            }
            return;
        }

        // 其他错误情况
        const result = await response.json();
        importText.textContent = "启动失败";
        importBtn.disabled = false;
        setTimeout(() => {
            importText.textContent = "数据转录";
        }, 2000);
        showToast(result.error || "数据转录失败", "error");

    } catch (error) {
        console.error("数据转录失败:", error);
        importText.textContent = "网络错误";
        importBtn.disabled = false;
        setTimeout(() => {
            importText.textContent = "数据转录";
        }, 2000);
        showToast("数据转录失败: " + error.message, "error");
    }
}

// ==================== 参考文本生成功能 ====================

// 生成参考文本功能
async function generateReferenceText() {
    const generateBtn = document.getElementById("referenceGenerateBtn");
    const generateText = document.getElementById("referenceGenerateText");

    if (!generateBtn || !generateText) return;

    // 检查是否正在处理中
    if (generateBtn.disabled) {
        showToast("任务正在处理中，请稍候", "warning");
        return;
    }

    // 禁用按钮，显示状态
    generateBtn.disabled = true;
    generateText.textContent = "启动中...";

    try {
        const response = await fetch("/api/reference-text/generate", {
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            generateText.textContent = "生成中...";
            showToast(result.message || "参考文本生成任务已启动", "success");
            // 立即检查一次状态获取最新信息
            setTimeout(() => {
                if (typeof loadStats === 'function') {
                    loadStats();
                }
            }, 1000);
        } else {
            throw new Error(result.error || "生成失败");
        }

    } catch (error) {
        console.error("生成参考文本失败:", error);
        generateText.textContent = "失败";
        generateBtn.disabled = false;
        setTimeout(() => {
            generateText.textContent = "生成文本";
        }, 2000);
        showToast("生成参考文本失败: " + error.message, "error");
    }
}

