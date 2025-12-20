// 新版管理后台JavaScript - 主入口文件
// 全局变量已在 global-vars.js 中定义

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面初始化开始...');

    // 确保DOM元素存在
    const deviceView = document.getElementById('deviceView');
    const reviewDevice = document.getElementById('reviewDevice');
    const listView = document.getElementById('listView');
    console.log('deviceView:', deviceView);
    console.log('reviewDevice:', reviewDevice);
    console.log('listView:', listView);

    // 初始化各个模块
    console.log('初始化导航模块...');
    initializeNavigation();

    console.log('初始化状态筛选...');
    initializeStatusFilters();

    console.log('初始化统计数据...');
    initializeStats(); // 初始化统计数据（只执行一次）

    console.log('初始化视图状态...');
    // 默认使用详细视图
    currentView = 'device';
    console.log('设置为详细视图');

    // 确保列表视图隐藏（HTML中已经设置了详细视图显示）
    if (listView) listView.style.display = 'none';

    // 隐藏空状态，因为reviewDevice现在默认显示
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }

    console.log('加载录音数据...');
    // 根据实际视图状态加载数据
    if (currentView === 'list') {
        loadListView();
    } else {
        loadRecordings();
    }

    console.log('API密钥将在导航到相应页面时加载');

    console.log('初始化键盘快捷键...');
    initializeKeyboardShortcuts();

    // 初始化搜索功能
    console.log('初始化搜索功能...');
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

    console.log('页面初始化完成');
});

// 兼容性函数 - 从list-view.js移动过来，因为HTML中可能有直接调用
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

    if (confirm(`确定要删除这条录音吗？\n${recording.original_text || '无标题'}`)) {
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

                // 调整索引
                if (currentRecordIndex >= recordingsData.length && currentRecordIndex > 0) {
                    currentRecordIndex--;
                }

                // 刷新显示
                displayCurrentRecord();
                updateNavigationButtons();
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