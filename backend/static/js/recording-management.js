// 录音数据管理

// 初始化reviewDevice的默认显示状态
function initializeReviewDeviceDisplay() {
    // 更新标题显示加载信息
    const reviewTitleElement = document.getElementById('reviewTitle');
    if (reviewTitleElement) {
        reviewTitleElement.textContent = '正在初始化...';
    }

    // 更新计数器
    const currentIndexElement = document.getElementById('currentIndex');
    const totalRecordsElement = document.getElementById('totalRecords');
    if (currentIndexElement) currentIndexElement.textContent = '0';
    if (totalRecordsElement) totalRecordsElement.textContent = '0';

    // 设置默认文本内容
    const originalTextElement = document.getElementById('originalText');
    const convertedTextElement = document.getElementById('convertedText');
    if (originalTextElement) originalTextElement.textContent = '加载中...';
    if (convertedTextElement) convertedTextElement.textContent = '加载中...';

    // 设置默认元信息
    const ipAddressElement = document.getElementById('ipAddress');
    const uploadTimeElement = document.getElementById('uploadTime');
    const fileSizeElement = document.getElementById('fileSize');
    const userAgentElement = document.getElementById('userAgent');

    if (ipAddressElement) ipAddressElement.textContent = '-';
    if (uploadTimeElement) uploadTimeElement.textContent = '-';
    if (fileSizeElement) fileSizeElement.textContent = '-';
    if (userAgentElement) {
        const userAgentValue = userAgentElement.querySelector('.meta-value');
        if (userAgentValue) {
            userAgentValue.textContent = '-';
        }
        userAgentElement.title = '-';
    }

    // 禁用所有控制按钮
    updateControlButtonsByStatus();
}

// 显示数据加载动画
function showDataLoading(message = '正在加载数据...', subtitle = '请稍候') {
    const overlay = document.getElementById('dataLoadingOverlay');
    if (overlay) {
        const loadingText = overlay.querySelector('.loading-text');
        const loadingSubtitle = overlay.querySelector('.loading-subtitle');

        if (loadingText) loadingText.textContent = message;
        if (loadingSubtitle) loadingSubtitle.textContent = subtitle;

        overlay.classList.add('active');
    }
}

// 隐藏数据加载动画
function hideDataLoading() {
    const overlay = document.getElementById('dataLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// 加载录音数据
async function loadRecordings(status = null) {
    try {
        // 使用传入的状态参数，如果没有则使用当前筛选状态
        const filterStatus = status || currentStatusFilter || 'pending';

        console.log('正在加载录音数据，状态:', filterStatus); // 调试信息

        // 显示加载动画
        showDataLoading('正在加载录音数据...', `状态: ${getStatusText(filterStatus)}`);

        // API期望字符串状态，不需要映射
        const response = await fetch(`/api/recordings?status=${filterStatus}&page=${currentPage}&per_page=50`);
        const data = await response.json();

        console.log('API响应:', data); // 调试信息

        // 隐藏加载动画
        hideDataLoading();

        if (data.success) {
            recordingsData = data.recordings || [];
            totalPages = data.pages || 1;

            // 确保详细视图显示
            const deviceView = document.getElementById('deviceView');
            const reviewDevice = document.getElementById('reviewDevice');
            const emptyState = document.getElementById('emptyState');

            if (deviceView) deviceView.style.display = 'block';
            if (reviewDevice) reviewDevice.style.display = 'block';
            if (emptyState) emptyState.style.display = 'none';

            if (recordingsData.length === 0) {
                displayEmptyRecordState();
            } else {
                currentRecordIndex = 0;
                displayCurrentRecord();
            }

            updateNavigationButtons();
            updateReviewCounter();
        }
    } catch (error) {
        console.error('加载录音数据失败:', error);
        hideDataLoading(); // 确保在错误时也隐藏加载动画
        showToast('加载数据失败', 'error');
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待审核',
        'approved': '已通过',
        'rejected': '已拒绝',
        'all': '全部'
    };
    return statusMap[status] || status;
}

// 显示空记录状态
function displayEmptyRecordState() {
    // 确保加载动画被隐藏
    hideDataLoading();

    // 更新标题显示无记录信息
    const reviewTitleElement = document.getElementById('reviewTitle');
    if (reviewTitleElement) {
        reviewTitleElement.textContent = '暂无待审核记录';
    }

    // 更新计数器
    const currentIndexElement = document.getElementById('currentIndex');
    const totalRecordsElement = document.getElementById('totalRecords');
    if (currentIndexElement) currentIndexElement.textContent = '0';
    if (totalRecordsElement) totalRecordsElement.textContent = '0';

    // 清空文本内容显示
    const originalTextElement = document.getElementById('originalText');
    const convertedTextElement = document.getElementById('convertedText');
    if (originalTextElement) originalTextElement.textContent = '-';
    if (convertedTextElement) convertedTextElement.textContent = '-';

    // 清空元信息显示
    const ipAddressElement = document.getElementById('ipAddress');
    const uploadTimeElement = document.getElementById('uploadTime');
    const fileSizeElement = document.getElementById('fileSize');
    const userAgentElement = document.getElementById('userAgent');

    if (ipAddressElement) ipAddressElement.textContent = '-';
    if (uploadTimeElement) uploadTimeElement.textContent = '-';
    if (fileSizeElement) fileSizeElement.textContent = '-';
    if (userAgentElement) {
        const userAgentValue = userAgentElement.querySelector('.meta-value');
        if (userAgentValue) {
            userAgentValue.textContent = '-';
        }
        userAgentElement.title = '-';
    }

    // 隐藏音频播放器
    const audioPlayer = document.getElementById('audioPlayer');
    const progressFillScreen = document.getElementById('progressFillScreen');
    const playIcon = document.getElementById('playIcon');

    if (audioPlayer) {
        audioPlayer.style.display = 'none';
        audioPlayer.src = '';
    }
    if (progressFillScreen) {
        progressFillScreen.style.width = '0%';
    }
    if (playIcon) {
        playIcon.className = 'fas fa-play';
    }

    // 禁用所有控制按钮
    updateControlButtonsByStatus();
}

// 显示当前记录
function displayCurrentRecord() {
    if (recordingsData.length === 0) return;

    // 确保加载动画被隐藏
    hideDataLoading();

    const record = recordingsData[currentRecordIndex];

    // 停止当前播放并重置进度条
    const audioPlayer = document.getElementById('audioPlayer');
    const progressFillScreen = document.getElementById('progressFillScreen');
    const playIcon = document.getElementById('playIcon');

    if (audioPlayer && !audioPlayer.paused) {
        audioPlayer.pause();
    }

    if (progressFillScreen) {
        progressFillScreen.style.width = '0%';
    }

    if (playIcon) {
        playIcon.className = 'fas fa-play';
    }

    // 更新标题
    const reviewTitleElement = document.getElementById('reviewTitle');
    if (reviewTitleElement) {
        reviewTitleElement.textContent = `记录 #${record.id}`;
    }

    // 更新文本内容
    const originalTextElement = document.getElementById('originalText');
    if (originalTextElement) {
        originalTextElement.textContent = record.original_text || '-';
    }

    const convertedTextElement = document.getElementById('convertedText');
    if (convertedTextElement) {
        convertedTextElement.textContent = record.actual_content || '-';
    }

    // 更新元信息
    const ipAddressElement = document.getElementById('ipAddress');
    if (ipAddressElement) {
        ipAddressElement.textContent = record.ip_address || '-';
    }

    const uploadTimeElement = document.getElementById('uploadTime');
    if (uploadTimeElement) {
        uploadTimeElement.textContent = record.upload_time ? new Date(record.upload_time).toLocaleString() : '-';
    }

    const fileSizeElement = document.getElementById('fileSize');
    if (fileSizeElement) {
        fileSizeElement.textContent = record.file_size ? formatFileSize(record.file_size) : '-';
    }

    const userAgent = record.user_agent || '-';
    const userAgentElement = document.getElementById('userAgent');
    if (userAgentElement) {
        const userAgentValue = userAgentElement.querySelector('.meta-value');
        if (userAgentValue) {
            userAgentValue.textContent = userAgent;
        }
        userAgentElement.title = userAgent;
    }

    // 更新音频播放器
    if (audioPlayer && record.file_path) {
        audioPlayer.src = `/admin/api/download/${record.id}`;
        audioPlayer.style.display = 'none'; // 保持隐藏，使用自定义控制
        // 延迟初始化自定义音频播放器
        setTimeout(() => {
            initAudioPlayer();
        }, 100);
    } else if (audioPlayer) {
        audioPlayer.style.display = 'none';
    }

    updateReviewCounter();
    updateControlButtonsByStatus();
}

// 更新导航按钮状态
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.disabled = currentRecordIndex === 0;
    }

    if (nextBtn) {
        nextBtn.disabled = currentRecordIndex === recordingsData.length - 1;
    }

    // 如果没有记录，禁用所有导航按钮
    if (recordingsData.length === 0) {
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
    }

    // 更新控制按钮状态
    updateControlButtonsByStatus();
}

// 导航到上一条/下一条记录
function navigateRecord(direction) {
    const newIndex = currentRecordIndex + direction;

    if (newIndex >= 0 && newIndex < recordingsData.length) {
        currentRecordIndex = newIndex;
        displayCurrentRecord();
        updateNavigationButtons();

        // 添加切换动画效果
        const device = document.getElementById('reviewDevice');
        if (device) {
            device.style.transform = 'scale(0.98)';
            setTimeout(() => {
                device.style.transform = 'scale(1)';
            }, 150);
        }
    }
}

// 下载录音
function downloadCurrent() {
    if (recordingsData.length === 0) return;
    const record = recordingsData[currentRecordIndex];
    downloadRecording(record.id);
}

function downloadRecording(id) {
    const link = document.createElement('a');
    link.href = `/admin/api/download/${id}`;
    link.download = `recording_${id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 删除当前记录
async function deleteCurrent() {
    if (recordingsData.length === 0) return;
    const record = recordingsData[currentRecordIndex];
    await deleteFromList(record.id, true);
}