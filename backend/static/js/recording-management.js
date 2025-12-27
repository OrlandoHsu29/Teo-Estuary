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
    const mandarinTextElement = document.getElementById('mandarinText');
    const teochewTextElement = document.getElementById('teochewText');
    if (mandarinTextElement) mandarinTextElement.textContent = '加载中...';
    if (teochewTextElement) teochewTextElement.textContent = '加载中...';

    // 设置默认元信息
    const ipAddressElement = document.getElementById('ipAddress');
    const uploadTimeElement = document.getElementById('uploadTime');
    const fileSizeElement = document.getElementById('fileSize');

    if (ipAddressElement) ipAddressElement.textContent = '-';
    if (uploadTimeElement) uploadTimeElement.textContent = '-';
    if (fileSizeElement) fileSizeElement.textContent = '-';

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
        // 确保退出所有编辑模式
        if (typeof exitAllEditModes === 'function') {
            exitAllEditModes();
        }

        // 使用传入的状态参数，如果没有则使用当前筛选状态
        const filterStatus = status || currentStatusFilter || 'pending';

        console.log('正在加载记录，状态:', filterStatus); // 调试信息

        // 显示加载动画
        showDataLoading('正在加载记录...', `状态: ${getStatusText(filterStatus)}`);

        // API期望字符串状态，不需要映射
        const response = await fetch(`/api/recordings?status=${filterStatus}&page=${currentPage}&per_page=50`);

        if (!response.ok) {
            // 处理HTTP错误
            const errorText = await response.text();
            console.error('HTTP错误:', response.status, errorText);
            showToast('获取录音数据失败，服务器错误', 'error');
            hideDataLoading();
            return;
        }

        const data = await response.json();

        console.log('API响应:', data); // 调试信息

        // 隐藏加载动画
        hideDataLoading();

        if (data.success) {
            // 如果是追加加载下一页，则合并数据
            if (isLoadingNextPage && data.current_page === windowEndPage + 1) {
                recordingsData = [...recordingsData, ...(data.recordings || [])];
                windowEndPage = data.current_page;
                currentPage = data.current_page;
                totalPages = data.pages || 1;
                isLoadingNextPage = false;

                // 计算新的绝对索引
                absoluteRecordIndex = (windowStartPage - 1) * 50 + currentRecordIndex;
            } else {
                // 正常加载（新窗口）
                recordingsData = data.recordings || [];
                totalPages = data.pages || 1;
                currentPage = data.current_page;
                windowStartPage = data.current_page;
                windowEndPage = data.current_page;
                absoluteRecordIndex = 0;
                currentRecordIndex = 0;
            }

            // 保存总数据量到全局变量
            if (data.total !== undefined) {
                window.totalDataCount = data.total;
            }

            // 确保详细视图显示
            const deviceView = document.getElementById('deviceView');
            const reviewDevice = document.getElementById('reviewDevice');
            const emptyState = document.getElementById('emptyState');

            if (deviceView) deviceView.style.display = 'block';
            if (reviewDevice) reviewDevice.style.display = 'block';
            if (emptyState) emptyState.style.display = 'none';

            if (recordingsData.length === 0) {
                displayEmptyRecordState();

                // 即使没有记录也要确保进度条容器显示
                const screenProgress = document.getElementById('screenProgress');
                if (screenProgress) {
                    screenProgress.style.display = 'block';
                }
            } else {
                currentRecordIndex = 0;
                absoluteRecordIndex = (windowStartPage - 1) * 50 + currentRecordIndex;
                displayCurrentRecord();
            }

            updateNavigationButtons();
            updateReviewCounter();
        } else {
            // 处理业务逻辑错误
            console.error('录音数据错误:', data.error);
            showToast(data.error || '获取录音数据失败', 'error');
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
        reviewTitleElement.textContent = '暂无待审核音频记录';
    }

    // 更新计数器
    const currentIndexElement = document.getElementById('currentIndex');
    const totalRecordsElement = document.getElementById('totalRecords');
    if (currentIndexElement) currentIndexElement.textContent = '0';
    if (totalRecordsElement) totalRecordsElement.textContent = '0';

    // 清空文本内容显示
    const mandarinTextElement = document.getElementById('mandarinText');
    const teochewTextElement = document.getElementById('teochewText');
    if (mandarinTextElement) renderWordButtons(mandarinTextElement, '-');
    if (teochewTextElement) renderWordButtons(teochewTextElement, '-');

    // 清空元信息显示
    const metaValues = document.getElementsByClassName('meta-value');

    for (let i = 0; i < metaValues.length; i++) {
        metaValues[i].textContent = '-';
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

    // 确保进度条容器始终显示
    const screenProgress = document.getElementById('screenProgress');
    if (screenProgress) {
        screenProgress.style.display = 'block';
    }
}

// 显示当前记录
function displayCurrentRecord() {
    if (recordingsData.length === 0) return;

    // 确保退出所有编辑模式
    if (typeof exitAllEditModes === 'function') {
        exitAllEditModes();
    }

    // 确保加载动画被隐藏
    hideDataLoading();

    // 恢复可能被隐藏的分词容器（之前的动画可能有残留）
    const hiddenContainers = document.querySelectorAll('.word-buttons-container[style*="display: none"]');
    hiddenContainers.forEach(container => container.style.display = '');

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
        reviewTitleElement.textContent = `音频记录 #${record.id}`;
    }

    // 更新文本内容
    const mandarinTextElement = document.getElementById('mandarinText');
    if (mandarinTextElement) {
        // 使用字词按钮显示普通话文本
        renderWordButtons(mandarinTextElement, record.mandarin_text || '-');
    }

    const teochewTextElement = document.getElementById('teochewText');
    if (teochewTextElement) {
        // 使用字词按钮显示潮汕话文本
        renderWordButtons(teochewTextElement, record.teochew_text || '-');
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

    // 更新上传途径
    const uploadTypeElement = document.getElementById('uploadType');
    if (uploadTypeElement) {
        const uploadType = record.upload_type || 0;
        uploadTypeElement.textContent = uploadType === 1 ? '素材提取' : '录音上传';
        uploadTypeElement.className = 'meta-value ' + (uploadType === 1 ? 'upload-type-extracted' : 'upload-type-recorded');
    }

    // 更新音频播放器 - 懒加载模式
    if (audioPlayer && record.file_path) {
        // 清除之前的src，不再立即下载
        audioPlayer.src = '';
        audioPlayer.style.display = 'none'; // 保持隐藏，使用自定义控制

        // 在音频播放器元素上记录当前记录ID，用于懒加载
        audioPlayer.dataset.recordId = record.id;
        // 添加download=false参数来获取音频流而不是文件下载
        audioPlayer.dataset.audioUrl = `/admin/api/download/${record.id}?download=false`;

        // 延迟初始化自定义音频播放器（但不加载音频）
        setTimeout(() => {
            initAudioPlayer();
        }, 100);
    } else if (audioPlayer) {
        audioPlayer.style.display = 'none';
        delete audioPlayer.dataset.recordId;
        delete audioPlayer.dataset.audioUrl;
    }

    // 确保进度条容器始终可见（无论是否有音频）
    const screenProgress = document.getElementById('screenProgress');
    if (screenProgress) {
        screenProgress.style.display = 'block';
    }

    updateControlButtonsByStatus();
}

// 更新导航按钮状态
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        // 禁用第一条记录的上一条按钮
        prevBtn.disabled = absoluteRecordIndex <= 0;
    }

    if (nextBtn) {
        // 禁用最后一条记录的下一条按钮
        if (window.totalDataCount) {
            nextBtn.disabled = absoluteRecordIndex >= window.totalDataCount - 1;
        } else {
            // 如果没有总数据量，则基于当前页判断
            nextBtn.disabled = (absoluteRecordIndex >= recordingsData.length - 1) &&
                             (windowEndPage >= totalPages);
        }
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
async function navigateRecord(direction) {
    const newAbsoluteIndex = absoluteRecordIndex + direction;

    // 检查是否超出当前窗口范围
    if (newAbsoluteIndex < 0) {
        // 超出范围，不执行导航
        return;
    }

    // 检查是否超出总数据范围
    if (window.totalDataCount && newAbsoluteIndex >= window.totalDataCount) {
        showToast('已经是最后一条记录', 'info');
        return;
    }

    // 如果是向下一条导航且超出当前窗口，需要加载下一页
    if (direction > 0 && currentRecordIndex >= recordingsData.length - 1) {
        await loadNextPage();
        return;
    }

    // 如果是向上一条导航且超出当前窗口开头，需要加载上一页
    if (direction < 0 && currentRecordIndex <= 0) {
        await loadPreviousPage();
        return;
    }

    // 正常导航
    currentRecordIndex += direction;
    absoluteRecordIndex = newAbsoluteIndex;
    displayCurrentRecord();
    updateNavigationButtons();
    updateReviewCounter();

    // 添加切换动画效果
    const device = document.getElementById('reviewDevice');
    if (device) {
        device.style.transform = 'scale(0.98)';
        setTimeout(() => {
            device.style.transform = 'scale(1)';
        }, 150);
    }
}

// 加载下一页
async function loadNextPage() {
    if (isLoadingNextPage || windowEndPage >= totalPages) {
        showToast('已经是最后一条记录', 'info');
        return;
    }

    if (windowStartPage > 1) {
        // 滑动窗口：移除第一页，添加新页
        const nextPage = windowEndPage + 1;
        isLoadingNextPage = true;

        try {
            showDataLoading('正在加载下一页...', '');
            const response = await fetch(`/api/recordings?status=${currentStatusFilter}&page=${nextPage}&per_page=50`);
            const data = await response.json();

            if (data.success) {
                // 移除第一页的50条数据
                recordingsData.splice(0, 50);

                // 添加新页数据
                recordingsData.push(...(data.recordings || []));

                windowStartPage++;
                windowEndPage = nextPage;
                currentPage = nextPage;

                // 更新绝对索引
                absoluteRecordIndex++;
                currentRecordIndex = 0; // 重置到新加载页的第一条

                displayCurrentRecord();
                updateNavigationButtons();
                updateReviewCounter();
            } else {
                showToast('加载下一页失败', 'error');
            }
        } catch (error) {
            console.error('加载下一页失败:', error);
            showToast('加载下一页失败', 'error');
        } finally {
            isLoadingNextPage = false;
            hideDataLoading();
        }
    } else {
        // 第一页扩展：直接追加下一页数据
        const nextPage = windowEndPage + 1;
        isLoadingNextPage = true;

        try {
            showDataLoading('正在加载下一页...', '');
            const response = await fetch(`/api/recordings?status=${currentStatusFilter}&page=${nextPage}&per_page=50`);
            const data = await response.json();

            if (data.success) {
                recordingsData.push(...(data.recordings || []));
                windowEndPage = nextPage;
                currentPage = nextPage;

                // 更新绝对索引
                absoluteRecordIndex++;
                currentRecordIndex++;

                displayCurrentRecord();
                updateNavigationButtons();
                updateReviewCounter();
            } else {
                showToast('加载下一页失败', 'error');
            }
        } catch (error) {
            console.error('加载下一页失败:', error);
            showToast('加载下一页失败', 'error');
        } finally {
            isLoadingNextPage = false;
            hideDataLoading();
        }
    }
}

// 加载上一页
async function loadPreviousPage() {
    if (isLoadingNextPage || windowStartPage <= 1) {
        return; // 没有上一页
    }

    const prevPage = windowStartPage - 1;
    isLoadingNextPage = true;

    try {
        showDataLoading('正在加载上一页...', '');
        const response = await fetch(`/api/recordings?status=${currentStatusFilter}&page=${prevPage}&per_page=50`);
        const data = await response.json();

        if (data.success) {
            // 移除最后一页的50条数据
            recordingsData.splice(-50, 50);

            // 在前面添加新页数据
            recordingsData.unshift(...(data.recordings || []));

            windowStartPage--;
            windowEndPage--;
            currentPage = prevPage;

            // 更新绝对索引和当前索引
            absoluteRecordIndex--;
            currentRecordIndex = 49; // 上一页的最后一条（现在是当前页的第一条）

            displayCurrentRecord();
            updateNavigationButtons();
            updateReviewCounter();
            showToast('已加载上一页数据', 'success');
        } else {
            showToast('加载上一页失败', 'error');
        }
    } catch (error) {
        console.error('加载上一页失败:', error);
        showToast('加载上一页失败', 'error');
    } finally {
        isLoadingNextPage = false;
        hideDataLoading();
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

// 字词按钮相关功能
let wordVariantCache = new Map(); // 缓存变体数据

// 渲染字词按钮
function renderWordButtons(container, text) {
    if (!text || text === '-') {
        container.textContent = text || '-';
        return;
    }

    // 如果是编辑模式，显示纯文本
    const textColumn = container.closest('.text-column');
    if (textColumn?.classList.contains('editing') || textColumn?.classList.contains('editing-original')) {
        container.textContent = text;
        return;
    }

    // 清空容器并创建字词按钮容器
    container.innerHTML = '';
    const wordButtonsContainer = document.createElement('div');
    wordButtonsContainer.className = 'word-buttons-container';

    // 分词：按空格分割，保留标记符
    const words = text.split(' ').filter(word => word.length > 0);

    words.forEach((word, index) => {
        const button = createWordButton(word, index);
        wordButtonsContainer.appendChild(button);
    });

    container.appendChild(wordButtonsContainer);
}

// 创建单个字词按钮
function createWordButton(word, index) {
    const button = document.createElement('div');
    button.className = 'word-button';
    button.dataset.index = index;
    button.dataset.originalWord = word;

    // 解析变体词格式：翻译$[原词]
    let displayText = word;
    let baseWord = '';
    let isVariant = false;

    // 检查是否是变体词格式：翻译$[原词]
    const variantMatch = word.match(/^(.+)\$\[(.+)\]$/);
    if (variantMatch) {
        displayText = variantMatch[1]; // 显示的翻译文本
        baseWord = variantMatch[2]; // 用于查询变体的原词
        isVariant = true;
    } else if (word.endsWith('$')) {
        // 兼容旧格式：翻译$
        displayText = word.slice(0, -1);
        baseWord = word.slice(0, -1);
        isVariant = true;
    } else if (word.endsWith('#')) {
        button.classList.add('completed');
        displayText = word.slice(0, -1);
        isVariant = false;
    }

    // 判断词的类型并设置样式
    if (isVariant) {
        button.classList.add('variant');
        button.textContent = displayText;
        button.dataset.isVariant = 'true';
        button.dataset.baseWord = baseWord;
        button.dataset.currentVariant = 1; // 当前变体编号

        // 为变体词添加点击事件（切换变体），但延迟执行以等待双击
        let clickTimer = null;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            // 如果已经有定时器，说明在等待双击，不执行单击
            if (clickTimer) return;

            // 延迟300ms执行单击，等待双击
            clickTimer = setTimeout(() => {
                handleVariantClick(button);
                clickTimer = null;
            }, 300);
        });

        // 双击进入编辑模式（针对变体词）
        button.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            // 取消单击事件
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            // 进入编辑模式
            handleWordEdit(button);
        });
    } else if (word.endsWith('#')) {
        button.classList.add('completed');
        button.textContent = displayText;
        button.dataset.isVariant = 'false';
        // 为已完成的词添加点击事件（编辑词内容）
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleWordEdit(button);
        });
    } else {
        // 未翻译的词
        button.textContent = displayText;
        button.dataset.isVariant = 'false';
        // 为普通词添加点击事件（编辑词内容）
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleWordEdit(button);
        });
    }

    // 双击进入编辑模式（针对非变体词）
    if (!isVariant) {
        button.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            handleWordEdit(button);
        });
    }

    return button;
}

// 处理变体词点击
async function handleVariantClick(button) {
    const baseWord = button.dataset.baseWord;
    const currentVariant = parseInt(button.dataset.currentVariant);

    // 添加切换动画
    button.classList.add('switching');

    try {
        // 获取所有变体
        const variants = await getWordVariants(baseWord);

        if (variants && variants.length > 1) {
            // 计算下一个变体
            const nextVariantIndex = variants.findIndex(v => v[0] === currentVariant) + 1;
            const nextVariant = variants[nextVariantIndex % variants.length];

            // 更新按钮显示
            button.textContent = nextVariant[1];
            button.dataset.currentVariant = nextVariant[0];

            // 更新记录数据 - 使用新格式：翻译$[原词]
            updateRecordWithNewVariant(button.dataset.index, nextVariant[1] + '$[' + baseWord + ']', button);

            // 显示提示
            showToast(`切换到变体 ${nextVariant[0]}: ${nextVariant[1]}`, 'success');
        } else {
            showToast('该词没有其他变体', 'warning');
        }
    } catch (error) {
        console.error('获取变体失败:', error);
        showToast('获取变体失败，请重试', 'error');
    } finally {
        // 移除动画
        setTimeout(() => {
            button.classList.remove('switching');
        }, 300);
    }
}

// 获取词的所有变体
async function getWordVariants(word) {
    // 检查缓存
    if (wordVariantCache.has(word)) {
        return wordVariantCache.get(word);
    }

    try {
        // 使用管理员API端点，无需API密钥
        const response = await fetch(`/admin/api/word-variants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                word: word,
                lang: 'mandarin'
            })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            // 缓存结果
            wordVariantCache.set(word, data.variants);
            return data.variants;
        } else {
            throw new Error(data.error || '获取变体失败');
        }
    } catch (error) {
        console.error('获取变体失败:', error);
        return null;
    }
}

// 处理字词编辑
function handleWordEdit(button) {
    // 如果点击的按钮已经在编辑模式，不重复处理
    if (button.classList.contains('editing')) return;

    // 如果有其他按钮正在编辑，先完成编辑（恢复原状）
    const currentEditing = document.querySelector('.word-button.editing');
    if (currentEditing && currentEditing !== button) {
        const originalText = currentEditing.dataset.originalText || '';
        currentEditing.textContent = originalText;
        currentEditing.classList.remove('editing');
        delete currentEditing.dataset.isEditing;
        delete currentEditing.dataset.originalText;
    }

    const originalText = button.textContent;
    const buttonIndex = parseInt(button.dataset.index);

    // 保存原始文本到数据属性
    button.dataset.originalText = originalText;

    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'word-edit-input';

    // 清空按钮并添加输入框
    button.innerHTML = '';
    button.appendChild(input);
    button.classList.add('editing');

    // 保存当前编辑状态
    button.dataset.isEditing = 'true';

    // 聚焦并选中全部文本
    input.focus();
    input.select();

    // 绑定事件处理
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText !== originalText) {
            updateWordInText(buttonIndex, newText, button);
        } else {
            // 恢复原始文本
            button.textContent = originalText;
            button.classList.remove('editing');
            delete button.dataset.isEditing;
            delete button.dataset.originalText;
        }
    };

    const cancelEdit = () => {
        button.textContent = originalText;
        button.classList.remove('editing');
        delete button.dataset.isEditing;
        delete button.dataset.originalText;
    };

    // 保存编辑
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
        }
    });

    // 防止点击事件冒泡
    input.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// 更新文本中的单个词
function updateWordInText(wordIndex, newWord, buttonElement) {
    if (recordingsData.length === 0 || currentRecordIndex >= recordingsData.length) {
        return;
    }

    const record = recordingsData[currentRecordIndex];
    const isOriginalText = buttonElement?.closest('#originalText');

    let newContent;
    let originalWord = ''; // 保存原始词的完整信息

    if (isOriginalText) {
        // 更新原始文本
        const words = record.mandarin_text.split(' ');
        originalWord = words[wordIndex];

        // 如果新内容为空，移除这个词
        if (!newWord || newWord.trim() === '') {
            words.splice(wordIndex, 1);
            newContent = words.join(' ');
            record.mandarin_text = newContent;

            // 移除按钮元素
            buttonElement.remove();

            // 更新数据库
            updateRecordingOriginalText(record.id, newContent);

            // 重新渲染所有按钮以更新索引
            const originalTextElement = document.getElementById('originalText');
            if (originalTextElement) {
                renderWordButtons(originalTextElement, newContent || (newContent === '' ? '' : '-'));
            }
        } else {
            // 判断原始词的格式并保持相应的格式
            const variantMatch = originalWord.match(/^(.+)\$\[(.+)\]$/);
            if (variantMatch) {
                // 新格式：翻译$[原词] -> 翻译$[原词]
                words[wordIndex] = newWord + '$[' + variantMatch[2] + ']';
            } else if (originalWord.endsWith('$')) {
                // 旧格式：翻译$ -> 翻译$
                words[wordIndex] = newWord + '$';
            } else if (originalWord.endsWith('#')) {
                // 完成词：翻译# -> 翻译#
                words[wordIndex] = newWord + '#';
            } else {
                // 普通词：翻译 -> 翻译
                words[wordIndex] = newWord;
            }

            newContent = words.join(' ');
            record.mandarin_text = newContent;

            // 更新按钮数据
            buttonElement.dataset.originalWord = words[wordIndex];
            buttonElement.textContent = newWord;

            // 更新数据库
            updateRecordingOriginalText(record.id, newContent);
        }
    } else {
        // 更新转换文本
        const words = record.teochew_text.split(' ');
        originalWord = words[wordIndex];

        // 如果新内容为空，移除这个词
        if (!newWord || newWord.trim() === '') {
            words.splice(wordIndex, 1);
            newContent = words.join(' ');
            record.teochew_text = newContent;

            // 移除按钮元素
            buttonElement.remove();

            // 更新数据库
            updateRecordingContent(record.id, newContent);

            // 重新渲染所有按钮以更新索引
            const convertedTextElement = document.getElementById('convertedText');
            if (convertedTextElement) {
                renderWordButtons(convertedTextElement, newContent || (newContent === '' ? '' : '-'));
            }
        } else {
            // 判断原始词的格式并保持相应的格式
            const variantMatch = originalWord.match(/^(.+)\$\[(.+)\]$/);
            if (variantMatch) {
                // 新格式：翻译$[原词] -> 翻译$[原词]
                words[wordIndex] = newWord + '$[' + variantMatch[2] + ']';
            } else if (originalWord.endsWith('$')) {
                // 旧格式：翻译$ -> 翻译$
                words[wordIndex] = newWord + '$';
            } else if (originalWord.endsWith('#')) {
                // 完成词：翻译# -> 翻译#
                words[wordIndex] = newWord + '#';
            } else {
                // 普通词：翻译 -> 翻译
                words[wordIndex] = newWord;
            }

            newContent = words.join(' ');
            record.teochew_text = newContent;

            // 更新按钮数据
            buttonElement.dataset.originalWord = words[wordIndex];
            buttonElement.textContent = newWord;

            // 更新数据库
            updateRecordingContent(record.id, newContent);
        }
    }

    // 只有在按钮元素还存在时才移除编辑状态
    if (buttonElement && buttonElement.parentNode) {
        buttonElement.classList.remove('editing');
        delete buttonElement.dataset.isEditing;
        delete buttonElement.dataset.originalText;
    }

}

// 更新记录中的变体词
function updateRecordWithNewVariant(wordIndex, newWord, buttonElement) {
    if (recordingsData.length === 0 || currentRecordIndex >= recordingsData.length) {
        return;
    }

    const record = recordingsData[currentRecordIndex];
    const isOriginalText = buttonElement?.closest('#originalText');

    let newContent;

    if (isOriginalText) {
        // 更新原始文本
        const words = record.mandarin_text.split(' ');
        words[wordIndex] = newWord;
        newContent = words.join(' ');
        record.mandarin_text = newContent;

        // 更新按钮数据
        buttonElement.dataset.originalWord = newWord;

        // 更新数据库
        updateRecordingOriginalText(record.id, newContent);
    } else {
        // 更新转换文本
        const words = record.teochew_text.split(' ');
        words[wordIndex] = newWord;
        newContent = words.join(' ');
        record.teochew_text = newContent;

        // 更新按钮数据
        buttonElement.dataset.originalWord = newWord;

        // 更新数据库
        updateRecordingContent(record.id, newContent);
    }
}

// 检查是否需要合并分词按钮
function needsMerging(text) {
    if (!text || text === '-') return false;

    // 分词检测：如果有空格分隔，说明有多个分词
    const words = text.split(' ');

    // 如果只有一个词，不需要合并
    if (words.length <= 1) return false;

    // 如果有多个词，需要合并
    return true;
}

// 合并分词按钮为完整句子
function mergeWordsToSentence(text) {
    if (!text || text === '-') return text;

    // 移除所有分词标记，合并成完整句子
    const words = text.split(' ');
    const cleanWords = words.map(word => {
        // 处理新格式：翻译$[原词] 和旧格式：翻译$ 以及完成词：翻译#
        const variantMatch = word.match(/^(.+)\$\[(.+)\]$/);
        if (variantMatch) {
            return variantMatch[1]; // 返回翻译文本
        } else {
            // 移除 $ 和 # 标记，保留纯文本
            return word.replace(/[\$#]$/, '');
        }
    });

    return cleanWords.join('');
}

// 自动合并文本中的分词按钮
function autoMergeText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const record = recordingsData[currentRecordIndex];
    if (!record) return null;

    let currentText;
    let updateFunction;

    if (elementId === 'originalText') {
        currentText = record.mandarin_text;
        updateFunction = updateRecordingOriginalText;
    } else {
        currentText = record.teochew_text;
        updateFunction = updateRecordingContent;
    }

    // 检查是否需要合并
    if (!needsMerging(currentText)) {
        return null; // 不需要合并
    }

    // 合并分词
    const mergedText = mergeWordsToSentence(currentText);

    // 更新本地数据
    if (elementId === 'originalText') {
        record.mandarin_text = mergedText;
    } else {
        record.teochew_text = mergedText;
    }

    // 重新渲染为单个按钮
    renderWordButtons(element, mergedText);

    // 更新数据库
    updateFunction(record.id, mergedText);

    return mergedText;
}

// 自动合并所有文本（在审核通过时调用）
function autoMergeAllTextsOnApprove() {
    const record = recordingsData[currentRecordIndex];
    if (!record) return;

    let originalMerged = null;
    let convertedMerged = null;

    // 合并普通话文本（如果需要）
    if (needsMerging(record.mandarin_text)) {
        // 添加合并动画
        const mandarinTextElement = document.getElementById('mandarinText');
        const originalContainer = mandarinTextElement?.querySelector('.word-buttons-container');
        if (originalContainer) {
            originalContainer.classList.add('merging');
            const wordButtons = originalContainer.querySelectorAll('.word-button');
            wordButtons.forEach(btn => btn.classList.add('merging'));

            // 立即计算合并后的文本并更新记录对象（同步操作）
            const mergedText = mergeWordsToSentence(record.mandarin_text);

            // 立即更新内存中的记录对象，确保后续API调用使用合并后的数据
            originalMerged = mergedText;
            record.mandarin_text = mergedText;

            // 异步更新数据库（不影响动画）
            updateRecordingOriginalText(record.id, mergedText);
        }
    }

    // 合并潮汕话文本（如果需要）
    if (needsMerging(record.teochew_text)) {
        // 添加合并动画
        const teochewTextElement = document.getElementById('teochewText');
        const convertedContainer = teochewTextElement?.querySelector('.word-buttons-container');
        if (convertedContainer) {
            convertedContainer.classList.add('merging');
            const wordButtons = convertedContainer.querySelectorAll('.word-button');
            wordButtons.forEach(btn => btn.classList.add('merging'));

            // 立即计算合并后的文本并更新记录对象（同步操作）
            const mergedText = mergeWordsToSentence(record.teochew_text);

            // 立即更新内存中的记录对象，确保后续API调用使用合并后的数据
            convertedMerged = mergedText;
            record.teochew_text = mergedText;

            // 异步更新数据库（不影响动画）
            updateRecordingContent(record.id, mergedText);
        }
    }

    // 不显示合并信息toast提示
    // 合并信息仅在需要时记录到控制台，不显示给用户
}

// 为列表视图中的记录进行自动合并
async function autoMergeForListApprove(recordId) {
    try {
        // 获取记录的详细信息
        const response = await fetch(`/api/recordings?per_page=200`);
        const data = await response.json();

        if (!data.success) {
            return;
        }

        const record = data.recordings.find(r => r.id === recordId);
        if (!record) {
            return;
        }

        let updateData = {};

        // 检查并合并原始文本
        if (needsMerging(record.mandarin_text)) {
            updateData.mandarin_text = mergeWordsToSentence(record.mandarin_text);
        }

        // 检查并合并转换文本
        if (needsMerging(record.teochew_text)) {
            updateData.teochew_text = mergeWordsToSentence(record.teochew_text);
        }

        // 如果有需要合并的内容，更新到后端
        if (Object.keys(updateData).length > 0) {
            await fetch(`/api/recording/${recordId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            // 显示合并信息
            const messages = [];
            if (updateData.mandarin_text) messages.push('原始文本已合并');
            if (updateData.teochew_text) messages.push('转换文本已合并');

            if (messages.length > 0) {
                showToast(`记录 ${recordId} - ${messages.join('，')}`, 'success');
            }
        }
    } catch (error) {
        console.error('列表合并操作失败:', error);
    }
}

// 更新recording-management.js中的saveTextEdit函数，确保它与字词按钮兼容
function syncWordButtonsWithEdit() {
    const convertedTextElement = document.getElementById('convertedText');
    const editElement = document.getElementById('convertedTextEdit');

    if (convertedTextElement && editElement) {
        // 同步编辑框的内容到字词按钮
        const newContent = editElement.value.trim();
        if (newContent) {
            renderWordButtons(convertedTextElement, newContent);
        }
    }
}