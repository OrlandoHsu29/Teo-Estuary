// 审核操作模块

// 编辑潮汕话文本
let isEditingTeochew = false;
let originalTeochewContent = '';

// 编辑普通话文本
let isEditingMandarin = false;
let originalMandarinContent = '';

function enableTeochewTextEdit() {
    if (isEditingTeochew) return;

    // 检查是否有记录数据
    if (recordingsData.length === 0 || currentRecordIndex >= recordingsData.length) {
        showToast('没有可编辑的记录', 'warning');
        return;
    }

    const textElement = document.getElementById('teochewText');
    const editElement = document.getElementById('teochewTextEdit');
    const editActions = document.getElementById('teochewEditActions');
    const mandarinTextDisplay = textElement.closest('.content-row').querySelector('.text-column .text-display:first-child');
    const textColumn = textElement.closest('.text-column');

    isEditingTeochew = true;
    originalTeochewContent = textElement.textContent;

    editElement.value = originalTeochewContent;
    textElement.style.display = 'none';
    editElement.style.display = 'block';
    editActions.style.display = 'flex';

    // 隐藏普通话文本为编辑预留更多空间
    if (mandarinTextDisplay) {
        mandarinTextDisplay.style.display = 'none';
    }

    // 添加编辑状态类
    if (textColumn) {
        textColumn.classList.add('editing');
    }

    editElement.focus();
}

function saveTeochewTextEdit() {
    if (recordingsData.length === 0) return;

    const editElement = document.getElementById('teochewTextEdit');
    const newContent = editElement.value.trim();

    if (newContent && newContent !== originalTeochewContent) {
        // 更新本地数据
        recordingsData[currentRecordIndex].actual_content = newContent;

        // 使用字词按钮重新渲染内容
        const convertedTextElement = document.getElementById('convertedText');
        const teochewTextElement = document.getElementById('teochewText');

        if (typeof renderWordButtons === 'function') {
            // 优先使用convertedText，如果不存在则使用teochewText
            const targetElement = convertedTextElement || teochewTextElement;
            if (targetElement) {
                renderWordButtons(targetElement, newContent);
            }
        } else {
            // 降级处理：直接设置文本内容
            if (convertedTextElement) {
                convertedTextElement.textContent = newContent;
            } else if (teochewTextElement) {
                teochewTextElement.textContent = newContent;
            }
        }

        // 保存到后端
        updateRecordingContent(recordingsData[currentRecordIndex].id, newContent);
    }

    cancelTeochewTextEdit(); // cancelTeochewTextEdit会移除编辑状态类
}

function cancelTeochewTextEdit() {
    const textElement = document.getElementById('teochewText');
    const editElement = document.getElementById('teochewTextEdit');
    const editActions = document.getElementById('teochewEditActions');
    const mandarinTextDisplay = textElement.closest('.content-row').querySelector('.text-column .text-display:first-child');
    const textColumn = textElement.closest('.text-column');

    isEditingTeochew = false;

    textElement.style.display = 'block';
    editElement.style.display = 'none';
    editActions.style.display = 'none';

    // 恢复普通话文本显示
    if (mandarinTextDisplay) {
        mandarinTextDisplay.style.display = 'block';
    }

    // 移除编辑状态类
    if (textColumn) {
        textColumn.classList.remove('editing');
    }

    // 重新渲染字词按钮以恢复原始内容
    if (recordingsData.length > 0 && currentRecordIndex < recordingsData.length) {
        const currentContent = recordingsData[currentRecordIndex].actual_content;
        if (typeof renderWordButtons === 'function') {
            renderWordButtons(textElement, currentContent);
        }
    }
}

// 编辑原始文本功能
function enableMandarinTextEdit() {
    if (isEditingMandarin) return;

    // 检查是否有记录数据
    if (recordingsData.length === 0 || currentRecordIndex >= recordingsData.length) {
        showToast('没有可编辑的记录', 'warning');
        return;
    }

    const textElement = document.getElementById('mandarinText');
    const editElement = document.getElementById('mandarinTextEdit');
    const editActions = document.getElementById('mandarinEditActions');
    const teochewTextDisplay = textElement.closest('.content-row').querySelector('.text-column .text-display:last-child');
    const textColumn = textElement.closest('.text-column');

    isEditingMandarin = true;
    originalMandarinContent = textElement.textContent;

    editElement.value = originalMandarinContent;
    textElement.style.display = 'none';
    editElement.style.display = 'block';
    editActions.style.display = 'flex';

    // 隐藏潮汕话文本为编辑预留更多空间
    if (teochewTextDisplay) {
        teochewTextDisplay.style.display = 'none';
    }

    // 添加编辑状态类
    if (textColumn) {
        textColumn.classList.add('editing-mandarin');
    }

    editElement.focus();
}

function saveMandarinTextEdit() {
    if (recordingsData.length === 0) return;

    const editElement = document.getElementById('mandarinTextEdit');
    const newContent = editElement.value.trim();

    if (newContent && newContent !== originalMandarinContent) {
        // 更新本地数据
        recordingsData[currentRecordIndex].original_text = newContent;

        // 使用字词按钮重新渲染内容
        const mandarinTextElement = document.getElementById('mandarinText');
        if (typeof renderWordButtons === 'function') {
            renderWordButtons(mandarinTextElement, newContent);
        } else {
            mandarinTextElement.textContent = newContent;
        }

        // 保存到后端
        updateRecordingOriginalText(recordingsData[currentRecordIndex].id, newContent);
    }

    cancelMandarinTextEdit();
}

function cancelMandarinTextEdit() {
    const textElement = document.getElementById('mandarinText');
    const editElement = document.getElementById('mandarinTextEdit');
    const editActions = document.getElementById('mandarinEditActions');
    const teochewTextDisplay = textElement.closest('.content-row').querySelector('.text-column .text-display:last-child');
    const textColumn = textElement.closest('.text-column');

    isEditingMandarin = false;

    textElement.style.display = 'block';
    editElement.style.display = 'none';
    editActions.style.display = 'none';

    // 恢复潮汕话文本显示
    if (teochewTextDisplay) {
        teochewTextDisplay.style.display = 'block';
    }

    // 移除编辑状态类
    if (textColumn) {
        textColumn.classList.remove('editing-mandarin');
    }

    // 重新渲染字词按钮以恢复原始内容
    if (recordingsData.length > 0 && currentRecordIndex < recordingsData.length) {
        const currentContent = recordingsData[currentRecordIndex].original_text;
        if (typeof renderWordButtons === 'function') {
            renderWordButtons(textElement, currentContent);
        }
    }
}

// 更新记录内容
async function updateRecordingContent(id, actualContent) {
    try {
        const response = await fetch(`/api/recording/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ actual_content: actualContent })
        });

        const data = await response.json();

        if (data.success) {
            showToast('保存成功', 'success');
        } else {
            showToast(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败', 'error');
    }
}

// 更新记录原始文本
async function updateRecordingOriginalText(id, originalText) {
    try {
        const response = await fetch(`/api/recording/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ original_text: originalText })
        });

        const data = await response.json();

        if (data.success) {
            showToast('保存成功', 'success');
        } else {
            showToast(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败', 'error');
    }
}

// 更新记录状态
async function updateRecordingStatus(id, status) {
    try {
        const response = await fetch(`/api/recording/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: status })
        });

        // 检查响应是否为HTML（错误页面）
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('API返回HTML而非JSON:', text.substring(0, 200));
            showToast('服务器错误，请检查API配置', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
            // 显示审核操作动画反馈
            showProgressAnimation(status);

            // 审核成功时不显示Toast，保持界面清洁
            // showToast(status === 'approved' ? '审核通过成功' : '拒绝成功', 'success');

            // 更新本地数据
            const recording = recordingsData.find(r => r.id == id);
            if (recording) {
                recording.status = status;
                // 移到下一条记录
                if (currentRecordIndex < recordingsData.length - 1) {
                    currentRecordIndex++;
                    displayCurrentRecord();
                    updateNavigationButtons();
                } else if (recordingsData.length > 1) {
                    // 最后一条记录，回到前一条
                    currentRecordIndex = Math.max(0, currentRecordIndex - 1);
                    displayCurrentRecord();
                    updateNavigationButtons();
                } else {
                    // 没有更多记录，重新加载
                    loadRecordings();
                }
            }
            // 更新统计
            loadStats();
        } else {
            showToast(data.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('操作失败:', error);
        showToast('操作失败: ' + error.message, 'error');
    }
}

// 审核通过
async function approveCurrent() {
    if (recordingsData.length === 0) return;

    const record = recordingsData[currentRecordIndex];

    // 检查是否有实际内容
    if (!record.actual_content && !record.original_text) {
        showToast('请先填写音频实际内容后再进行审核', 'error');
        return;
    }

    // 自动合并分词按钮为完整句子（同步进行）
    if (typeof autoMergeAllTextsOnApprove === 'function') {
        // 先启动气泡动画
        autoMergeAllTextsOnApprove();
    }

    // 短暂延迟后同时开始进度条动画
    setTimeout(async () => {
        // 显示进度条动画
        showProgressAnimation('approved');
        // 更新内容（如果需要）然后更新状态
        try {
            // 使用可能已经合并的最新数据
            const actualContent = record.actual_content || record.original_text;

            const response = await fetch(`/api/recording/${record.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'approved',
                    actual_content: actualContent
                })
            });

        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('API返回HTML而非JSON:', text.substring(0, 200));
            showToast('服务器错误，请检查API配置', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
                // 显示绿色通过动画（与气泡动画同时开始）
                showProgressAnimation('approved');

                // 等待气泡动画完成后立即移除记录（200ms后）
                setTimeout(() => {
                    // 从本地数据中移除已审核的记录
                    recordingsData.splice(currentRecordIndex, 1);

                    // 注意：currentRecordIndex保持不变，因为数组删除后下一个元素自动补位到当前索引
                    // absoluteRecordIndex也保持不变，因为我们在全局位置中的位置没有变化

                // 更新当前索引
                if (recordingsData.length === 0) {
                    // 没有更多记录，重新加载
                    loadRecordings();
                } else if (currentRecordIndex >= recordingsData.length) {
                    // 当前索引超出范围，回到最后一条
                    currentRecordIndex = recordingsData.length - 1;
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
                }
                updateReviewCounter(); // 立即更新计数器显示

                // 异步更新统计面板（不影响当前的计数器显示）
                loadStats();
            }); // 立即执行，不等待进度条动画
            } else {
                showToast(data.error || '审核失败', 'error');
            }
        } catch (error) {
            console.error('审核失败:', error);
            showToast('审核失败: ' + error.message, 'error');
        }
    }, 0); // 立即启动动画
}

// 审核拒绝
async function rejectCurrent() {
    if (recordingsData.length === 0) return;

    const record = recordingsData[currentRecordIndex];

    // 检查是否有实际内容
    if (!record.actual_content && !record.original_text) {
        showToast('请先填写音频实际内容后再进行审核', 'error');
        return;
    }

    try {
        const actualContent = record.actual_content || record.original_text;

        const response = await fetch(`/api/recording/${record.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'rejected',
                actual_content: actualContent
            })
        });

        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('API返回HTML而非JSON:', text.substring(0, 200));
            showToast('服务器错误，请检查API配置', 'error');
            return;
        }

        const data = await response.json();

        if (data.success) {
            // 显示红色拒绝动画
            showProgressAnimation('rejected');

            // 从本地数据中移除已审核的记录
            recordingsData.splice(currentRecordIndex, 1);

            // 注意：currentRecordIndex保持不变，因为数组删除后下一个元素自动补位到当前索引
            // absoluteRecordIndex也保持不变，因为我们在全局位置中的位置没有变化

            // 更新当前索引
            if (recordingsData.length === 0) {
                // 没有更多记录，重新加载
                loadRecordings();
            } else if (currentRecordIndex >= recordingsData.length) {
                // 当前索引超出范围，回到最后一条
                currentRecordIndex = recordingsData.length - 1;
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
            }
            updateReviewCounter(); // 立即更新计数器显示

            // 异步更新统计面板（不影响当前的计数器显示）
            loadStats();
        } else {
            showToast(data.error || '拒绝失败', 'error');
        }
    } catch (error) {
        console.error('拒绝失败:', error);
        showToast('拒绝失败: ' + error.message, 'error');
    }
}

// 从列表审核
async function approveFromList(id, isCurrent) {
    // 显示审核成功动画
    showProgressAnimation('approved');

    // 自动合并分词按钮（为列表视图中的记录）
    if (typeof autoMergeForListApprove === 'function') {
        // 先执行合并，再更新状态
        await autoMergeForListApprove(id);
    }

    await updateRecordingStatus(id, 'approved');
    if (isCurrent && currentView === 'device') {
        recordingsData.splice(currentRecordIndex, 1);

        // 注意：currentRecordIndex和absoluteRecordIndex都保持不变
        // 因为删除后后面的元素自动补位到当前索引位置

        if (recordingsData.length === 0) {
            loadRecordings();
        } else if (currentRecordIndex >= recordingsData.length) {
            currentRecordIndex = recordingsData.length - 1;
            displayCurrentRecord();
        } else {
            displayCurrentRecord();
        }
        updateNavigationButtons();
    }
    loadListView();
    loadStats();
}

async function rejectFromList(id, isCurrent) {
    // 拒绝成功动画
    showProgressAnimation('rejected');
    await updateRecordingStatus(id, 'rejected');
    if (isCurrent && currentView === 'device') {
        recordingsData.splice(currentRecordIndex, 1);

        // 注意：currentRecordIndex和absoluteRecordIndex都保持不变
        // 因为删除后后面的元素自动补位到当前索引位置

        if (recordingsData.length === 0) {
            loadRecordings();
        } else if (currentRecordIndex >= recordingsData.length) {
            currentRecordIndex = recordingsData.length - 1;
            displayCurrentRecord();
        } else {
            displayCurrentRecord();
        }
        updateNavigationButtons();
    }
    loadListView();
    loadStats();
}

async function deleteFromList(id, isCurrent) {
    if (!confirm('确定要删除这个记录吗？')) return;

    try {
        const response = await fetch(`/admin/api/recordings/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('删除成功', 'success');
            if (isCurrent && currentView === 'device') {
                recordingsData.splice(currentRecordIndex, 1);

                // 注意：currentRecordIndex和absoluteRecordIndex都保持不变
                // 因为删除后后面的元素自动补位到当前索引位置

                if (recordingsData.length === 0) {
                    loadRecordings();
                } else if (currentRecordIndex >= recordingsData.length) {
                    currentRecordIndex = recordingsData.length - 1;
                    displayCurrentRecord();
                } else {
                    displayCurrentRecord();
                }
                updateNavigationButtons();
            }
            loadListView();
            loadStats();
        } else {
            showToast(data.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败', 'error');
    }
}

// 显示审核操作动画反馈
function showProgressAnimation(status) {
    const reviewAnimationOverlay = document.getElementById('reviewAnimationOverlay');
    const audioPlayer = document.getElementById('audioPlayer');

    if (!reviewAnimationOverlay) return;

    // 停止当前音频播放并重置播放时间
    if (audioPlayer && !audioPlayer.paused) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0; // 重置播放时间
        // 重置播放图标
        const playIcon = document.getElementById('playIcon');
        if (playIcon) {
            playIcon.className = 'fas fa-play';
        }
    }

    // 清除之前的状态类
    reviewAnimationOverlay.classList.remove('approved', 'rejected');

    // 短暂延迟后开始动画
    setTimeout(() => {
        // 添加对应的状态类，触发CSS动画
        reviewAnimationOverlay.classList.add(status);

        // 保持充分展示时间后再开始收起
        setTimeout(() => {
            // 直接移除状态类，触发收起动画
            reviewAnimationOverlay.classList.remove(status);
        }, status === 'approved' ? 300 : 350); // 更快的保持时间
    }, 20);
}

// 更新控制按钮状态
function updateControlButtonsByStatus() {
    const hasData = recordingsData.length > 0;
    const currentRecording = hasData ? recordingsData[currentRecordIndex] : null;

    if (!hasData || !currentRecording) {
        updateControlButtons(); // 没有数据时使用原有逻辑
        return;
    }

    const approveBtn = document.querySelector('.approve-btn');
    const rejectBtn = document.querySelector('.reject-btn');
    const downloadBtn = document.querySelector('.download-btn');
    const deleteBtn = document.querySelector('.discard-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const editBtn = document.querySelector('.edit-btn');
    const volumeSlider = document.getElementById('volumeSlider');


    // 根据状态禁用相应的审核按钮
    const isApproved = currentRecording.status === 'approved';
    const isRejected = currentRecording.status === 'rejected';
    const isPending = currentRecording.status === 'pending';

    // 审核按钮逻辑
    if (approveBtn) {
        approveBtn.disabled = isApproved; // 已通过的记录不能再通过
        // 更新按钮视觉状态
        if (isApproved) {
            approveBtn.classList.add('disabled-by-status');
        } else {
            approveBtn.classList.remove('disabled-by-status');
        }
    }

    if (rejectBtn) {
        rejectBtn.disabled = isRejected; // 已拒绝的记录不能再拒绝
        // 更新按钮视觉状态
        if (isRejected) {
            rejectBtn.classList.add('disabled-by-status');
        } else {
            rejectBtn.classList.remove('disabled-by-status');
        }
    }

    // 判空禁用
    if (editBtn) editBtn.disabled = !hasData || !currentRecording;
    if (deleteBtn) deleteBtn.disabled = !hasData || !currentRecording;

    null_status = !hasData || !currentRecording || !currentRecording.file_path;

    if (downloadBtn) downloadBtn.disabled = null_status;
    if (playPauseBtn) playPauseBtn.disabled = null_status;
    if (volumeSlider) volumeSlider.disabled = null_status;



}

// 更新控制按钮状态
function updateControlButtons() {
    const hasData = recordingsData.length > 0;
    const currentRecording = hasData ? recordingsData[currentRecordIndex] : null;

    // 启用/禁用各种控制按钮
    const approveBtn = document.querySelector('.approve-btn');
    const rejectBtn = document.querySelector('.reject-btn');
    const downloadBtn = document.querySelector('.download-btn');
    const deleteBtn = document.querySelector('.discard-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const editBtn = document.querySelector('.edit-btn');
    const volumeSlider = document.getElementById('volumeSlider');

    if (approveBtn) approveBtn.disabled = !hasData || !currentRecording;
    if (rejectBtn) rejectBtn.disabled = !hasData || !currentRecording;
    if (downloadBtn) downloadBtn.disabled = !hasData || !currentRecording;
    if (deleteBtn) deleteBtn.disabled = !hasData || !currentRecording;
    if (playPauseBtn) playPauseBtn.disabled = !hasData || !currentRecording;
    if (editBtn) editBtn.disabled = !hasData || !currentRecording;
    if (volumeSlider) volumeSlider.disabled = !hasData || !currentRecording;
}