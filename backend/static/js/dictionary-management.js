// 字典管理模块

// 全局变量
let dictionaryResults = [];
let currentDictIndex = 0;
let currentDictEntry = null;
let currentSearchType = 'mandarin';  // 'mandarin' 或 'teochew'

// 搜索字典词条
async function searchDictionary() {
    const keyword = document.getElementById('dictSearchInput').value.trim();

    if (!keyword) {
        clearDictionaryDisplay();
        return;
    }

    try {
        // 显示加载状态
        showSearchLoading();

        const response = await fetch(`/api/dictionary/search?keyword=${encodeURIComponent(keyword)}&search_type=${currentSearchType}`);
        const data = await response.json();

        if (data.success) {
            dictionaryResults = data.translations;
            currentDictIndex = 0;

            // 更新UI显示
            updateDictionaryInfo();

            if (dictionaryResults.length > 0) {
                // 短暂延迟后显示结果，让用户看到动画效果
                setTimeout(() => {
                    hideSearchLoading();
                    displayDictEntry(dictionaryResults[0]);
                }, 300);
            } else {
                setTimeout(() => {
                    hideSearchLoading();
                    showNoResults();
                }, 300);
            }
        } else {
            hideSearchLoading();
            showToast(data.error || '搜索失败', 'error');
        }
    } catch (error) {
        console.error('Search dictionary error:', error);
        hideSearchLoading();
        showToast('搜索失败，请检查网络连接', 'error');
    }
}

// 清空字典显示
function clearDictionaryDisplay() {
    document.getElementById('dictEmptyWord').style.display = 'block';
    document.getElementById('dictWordContent').style.display = 'none';
    document.getElementById('dictCurrentIndex').textContent = '0';
    document.getElementById('dictTotalResults').textContent = '0';
    document.getElementById('dictProgressFill').style.width = '0%';
    document.getElementById('dictCurrentDisplay').textContent = '未查询';
    document.getElementById('dictNotesDisplay').textContent = '暂无备注';

    // 重置变体状态指示器
    const statusElement = document.getElementById('dictEntryVariantStatus');
    const statusTextElement = document.getElementById('dictEntryVariantStatusText');
    if (statusElement && statusTextElement) {
        statusElement.classList.remove('has-variant', 'no-variant');
        statusTextElement.textContent = '-';
    }

    dictionaryResults = [];
    currentDictEntry = null;
    currentDictIndex = 0;
}

// 显示加载动画
function showSearchLoading() {
    const emptyWord = document.getElementById('dictEmptyWord');
    const wordContent = document.getElementById('dictWordContent');

    // 隐藏词汇内容
    wordContent.style.display = 'none';

    // 显示加载状态
    emptyWord.style.display = 'block';
    emptyWord.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div class="loading-container" style="
                display: inline-block;
                position: relative;
                margin: 0 auto 20px;
            ">
                <div class="loading-spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-top: 3px solid #00ff88;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <div class="loading-dots" style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    display: flex;
                    gap: 3px;
                ">
                    <div class="dot" style="
                        width: 4px;
                        height: 4px;
                        background: #00ff88;
                        border-radius: 50%;
                        animation: dotPulse 1.4s ease-in-out infinite both;
                    "></div>
                    <div class="dot" style="
                        width: 4px;
                        height: 4px;
                        background: #00ff88;
                        border-radius: 50%;
                        animation: dotPulse 1.4s ease-in-out infinite both;
                        animation-delay: 0.2s;
                    "></div>
                    <div class="dot" style="
                        width: 4px;
                        height: 4px;
                        background: #00ff88;
                        border-radius: 50%;
                        animation: dotPulse 1.4s ease-in-out infinite both;
                        animation-delay: 0.4s;
                    "></div>
                </div>
            </div>
            <div class="loading-text" style="
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
                animation: loadingPulse 1.5s ease-in-out infinite;
            ">正在搜索词条<span class="loading-ellipsis">...</span></div>
        </div>
    `;

    // 更新状态信息
    document.getElementById('dictCurrentIndex').textContent = '0';
    document.getElementById('dictTotalResults').textContent = '0';
    document.getElementById('dictProgressFill').style.width = '0%';
    document.getElementById('dictCurrentDisplay').textContent = '搜索中';
    document.getElementById('dictNotesDisplay').textContent = '暂无备注';
}

// 隐藏加载动画
function hideSearchLoading() {
    // 恢复空词条显示的原始内容
    const emptyWord = document.getElementById('dictEmptyWord');
    emptyWord.innerHTML = `
        <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
        </div>
        <p>输入普通话或潮汕话词汇开始搜索</p>
    `;
}

// 显示无结果
function showNoResults() {
    const emptyWord = document.getElementById('dictEmptyWord');

    // 隐藏词汇内容
    document.getElementById('dictWordContent').style.display = 'none';

    // 显示无结果状态
    emptyWord.style.display = 'block';
    emptyWord.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div class="no-results-icon" style="
                margin-bottom: 16px;
                opacity: 0.5;
            ">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
            </div>
            <div class="no-results-text" style="
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
            ">未找到相关词条</div>
        </div>
    `;

    // 更新状态信息
    document.getElementById('dictCurrentIndex').textContent = '0';
    document.getElementById('dictTotalResults').textContent = '0';
    document.getElementById('dictProgressFill').style.width = '0%';
    document.getElementById('dictCurrentDisplay').textContent = '未找到';
    document.getElementById('dictNotesDisplay').textContent = '暂无备注';
    currentDictEntry = null;
}

// 更新字典信息
function updateDictionaryInfo() {
    const totalCount = dictionaryResults.length;
    const currentIndex = currentDictIndex + 1;
    const progressPercent = totalCount > 0 ? (currentIndex / totalCount) * 100 : 0;

    document.getElementById('dictCurrentIndex').textContent = currentIndex.toString();
    document.getElementById('dictTotalResults').textContent = totalCount.toString();
    document.getElementById('dictProgressFill').style.width = `${progressPercent}%`;

    if (currentDictEntry) {
        document.getElementById('dictCurrentDisplay').textContent = `${currentDictEntry.mandarin_text} → ${currentDictEntry.teochew_text}`;
        // 更新备注显示
        const notes = currentDictEntry.notes || '暂无备注';
        document.getElementById('dictNotesDisplay').textContent = notes;
    }

    // 更新导航按钮状态
    document.getElementById('dictPrevBtn').disabled = currentDictIndex <= 0;
    document.getElementById('dictNextBtn').disabled = currentDictIndex >= totalCount - 1;
}

// 切换搜索的语言类型
function toggleSearchType() {
    // 切换搜索的语言类型
    currentSearchType = currentSearchType === 'mandarin' ? 'teochew' : 'mandarin';

    // 更新按钮显示和状态
    const btn = document.getElementById('dictSearchTypeBtn');
    const btnLabel = document.getElementById('dictSearchTypeLabel');
    const searchInput = document.getElementById('dictSearchInput');

    // 移除旧的状态类
    btn.classList.remove('mandarin-mode', 'teochew-mode');

    if (currentSearchType === 'mandarin') {
        btnLabel.textContent = '普';
        btn.classList.add('mandarin-mode');
        searchInput.placeholder = '输入普通话词汇进行查询...';
    } else {
        btnLabel.textContent = '潮';
        btn.classList.add('teochew-mode');
        searchInput.placeholder = '输入潮汕话词汇进行查询...';
    }

    // 如果有搜索内容，重新搜索
    const keyword = searchInput.value.trim();
    if (keyword) {
        searchDictionary();
    } else {
        // 清空显示
        clearDictionaryDisplay();
    }
}

// 显示词条详情
function displayDictEntry(entry) {
    currentDictEntry = entry;

    // 切换显示状态
    document.getElementById('dictEmptyWord').style.display = 'none';
    document.getElementById('dictWordContent').style.display = 'block';

    // 根据搜索类型决定显示内容
    if (currentSearchType === 'mandarin') {
        // 搜索普通话时：显示普通话→潮汕话
        document.getElementById('displayTeochew').textContent = entry.teochew_text;
        document.getElementById('displayMandarin').textContent = entry.mandarin_text;

        // 更新标签文本
        document.getElementById('dictMandarinLabel').textContent = '普通话词条';
        document.getElementById('dictTeochewLabel').textContent = '潮汕话对应';

        // 显示普通话方向的变体编号
        document.getElementById('displayVariant').textContent = `M${entry.variant_mandarin}`;
    } else {
        // 搜索潮汕话时：显示潮汕话→普通话
        document.getElementById('displayTeochew').textContent = entry.mandarin_text;
        document.getElementById('displayMandarin').textContent = entry.teochew_text;

        // 更新标签文本
        document.getElementById('dictMandarinLabel').textContent = '潮汕话词条';
        document.getElementById('dictTeochewLabel').textContent = '普通话对应';

        // 显示潮汕话方向的变体编号
        const variantTeochew = entry.variant_teochew !== undefined ? entry.variant_teochew : 1;
        document.getElementById('displayVariant').textContent = `T${variantTeochew}`;
    }

    // 优先级
    const priority = entry.teochew_priority !== undefined ? entry.teochew_priority : 1;
    document.getElementById('displayPriority').textContent = priority.toString();

    // 状态
    const isActive = entry.is_active !== undefined ? entry.is_active : (entry.is_active !== 0);
    document.getElementById('displayStatus').textContent = isActive ? '启用' : '禁用';
    document.getElementById('displayStatus').style.color = isActive ? '#00ff88' : '#ff4757';

    // 词条ID
    document.getElementById('displayId').textContent = entry.id.toString();

    // 更新变体状态指示器（基于整个搜索结果）
    updateVariantStatusForEntry(entry, dictionaryResults);

    updateDictionaryInfo();
}

// 导航到下一个/上一个词条
function navigateDictEntry(direction) {
    if (dictionaryResults.length === 0) return;

    const newIndex = currentDictIndex + direction;
    if (newIndex >= 0 && newIndex < dictionaryResults.length) {
        currentDictIndex = newIndex;
        displayDictEntry(dictionaryResults[newIndex]);
    }
}

// 显示添加词条模态框
function showAddDictModal() {
    document.getElementById('dictModalTitleText').textContent = '添加词条';
    document.getElementById('dictModal').style.display = 'block';

    // 清空表单
    document.getElementById('dictId').value = '';
    document.getElementById('dictMandarin').value = '';
    document.getElementById('dictTeochew').value = '';
    document.getElementById('dictVariantMandarin').value = '';  // 留空则自动计算
    document.getElementById('dictVariantTeochew').value = '';
    document.getElementById('dictTeochewPriority').value = '';  // 留空则自动计算
    document.getElementById('dictNotes').value = '';
    document.getElementById('dictActive').checked = true;
}

// 编辑当前词条
function editCurrentDictEntry() {
    if (!currentDictEntry) {
        showToast('没有选择要编辑的词条', 'warning');
        return;
    }

    document.getElementById('dictModalTitleText').textContent = '编辑词条';
    document.getElementById('dictModal').style.display = 'block';

    // 填充表单 - 支持新旧字段格式
    document.getElementById('dictId').value = currentDictEntry.id;
    document.getElementById('dictMandarin').value = currentDictEntry.mandarin_text;
    document.getElementById('dictTeochew').value = currentDictEntry.teochew_text;

    // 变体编号
    document.getElementById('dictVariantMandarin').value = currentDictEntry.variant_mandarin;
    document.getElementById('dictVariantTeochew').value = currentDictEntry.variant_teochew || '';

    // 优先级
    const priority = currentDictEntry.teochew_priority !== undefined ? currentDictEntry.teochew_priority : 1;
    document.getElementById('dictTeochewPriority').value = priority;

    // 备注 - 显示原始值，如果是"暂无备注"则显示为空
    const notes = currentDictEntry.notes || '';
    document.getElementById('dictNotes').value = notes === '暂无备注' ? '' : notes;

    // 状态
    const isActive = currentDictEntry.is_active !== undefined ? currentDictEntry.is_active : (currentDictEntry.is_active !== 0);
    document.getElementById('dictActive').checked = isActive;
}

// 删除当前词条
async function deleteCurrentDictEntry() {
    if (!currentDictEntry) {
        showToast('没有选择要删除的词条', 'warning');
        return;
    }

    if (!confirm(`确定要删除词条"${currentDictEntry.mandarin_text} → ${currentDictEntry.teochew_text}"吗？`)) {
        return;
    }

    try {
        const response = await fetch(`/api/dictionary/${currentDictEntry.id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('词条删除成功', 'success');

            // 从结果列表中移除
            dictionaryResults.splice(currentDictIndex, 1);

            // 重新显示
            if (dictionaryResults.length > 0) {
                if (currentDictIndex >= dictionaryResults.length) {
                    currentDictIndex = dictionaryResults.length - 1;
                }
                displayDictEntry(dictionaryResults[currentDictIndex]);
            } else {
                showNoResults();
            }

            // 刷新同步日志和状态
            setTimeout(() => {
                loadUnsyncedLogs();
                updateSyncStatus();
            }, 1000);
        } else {
            showToast(data.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('Delete dictionary entry error:', error);
        showToast('删除失败，请检查网络连接', 'error');
    }
}

// 保存词条
async function saveDictEntry() {
    const id = document.getElementById('dictId').value;
    const mandarinText = document.getElementById('dictMandarin').value.trim();
    const teochewText = document.getElementById('dictTeochew').value.trim();
    const variantMandarinInput = document.getElementById('dictVariantMandarin');
    const variantTeochewInput = document.getElementById('dictVariantTeochew');
    const teochewPriorityInput = document.getElementById('dictTeochewPriority');
    const notesInput = document.getElementById('dictNotes');

    // 处理变体：如果为空则传null，让后端自动计算
    const variantMandarin = variantMandarinInput && variantMandarinInput.value ?
        parseInt(variantMandarinInput.value) : null;
    const variantTeochew = variantTeochewInput && variantTeochewInput.value ?
        parseInt(variantTeochewInput.value) : null;

    // 处理优先级：如果为空则传null，让后端自动计算
    const teochewPriority = teochewPriorityInput && teochewPriorityInput.value ?
        parseInt(teochewPriorityInput.value) : null;

    const isActive = document.getElementById('dictActive').checked;

    // 验证表单
    if (!mandarinText) {
        showToast('请输入普通话词汇', 'warning');
        return;
    }

    if (!teochewText) {
        showToast('请输入潮语词汇', 'warning');
        return;
    }

    // 验证变体编号（如果提供了的话）
    if (variantMandarin !== null && (isNaN(variantMandarin) || variantMandarin < 1)) {
        showToast('普通话变体编号必须是大于0的整数', 'warning');
        return;
    }

    if (variantTeochew !== null && (isNaN(variantTeochew) || variantTeochew < 1)) {
        showToast('潮州话变体编号必须是大于0的整数', 'warning');
        return;
    }

    // 验证优先级（如果提供了的话）
    if (teochewPriority !== null && (isNaN(teochewPriority) || teochewPriority < 1 || teochewPriority > 10)) {
        showToast('潮语优先级必须是1-10之间的整数', 'warning');
        return;
    }

    try {
        const url = id ? `/api/dictionary/${id}` : '/api/dictionary';
        const method = id ? 'PUT' : 'POST';

        const payload = {
            mandarin_text: mandarinText,
            teochew_text: teochewText,
            is_active: isActive,
            user: 'admin',
            reason: id ? '通过管理界面编辑' : '通过管理界面添加'
        };

        // 处理备注字段
        const notesValue = notesInput.value.trim();
        if (id) {
            // 编辑模式：总是发送 notes 字段
            // 如果用户清空了备注，发送空字符串；有内容则发送内容
            payload.notes = notesValue || "";
        } else {
            // 新增模式：备注为空则不发送 notes 字段
            if (notesValue) {
                payload.notes = notesValue;
            }
        }

        // 只有当提供了值时才添加到payload
        if (variantMandarin !== null) {
            payload.variant_mandarin = variantMandarin;
        }
        if (variantTeochew !== null) {
            payload.variant_teochew = variantTeochew;
        }
        if (teochewPriority !== null) {
            payload.teochew_priority = teochewPriority;
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast(id ? '词条更新成功' : '词条添加成功', 'success');
            closeDictModal();

            // 如果是编辑操作，更新当前显示
            if (id && currentDictEntry && currentDictEntry.id == id) {
                // 更新当前词条的数据
                currentDictEntry.mandarin_text = mandarinText;
                currentDictEntry.teochew_text = teochewText;
                if (variantMandarin !== null) {
                    currentDictEntry.variant_mandarin = variantMandarin;
                }
                if (variantTeochew !== null) {
                    currentDictEntry.variant_teochew = variantTeochew;
                }
                if (teochewPriority !== null) {
                    currentDictEntry.teochew_priority = teochewPriority;
                }
                // 只有当 payload 中有 notes 时才更新
                if (payload.notes !== undefined) {
                    currentDictEntry.notes = payload.notes;
                }
                currentDictEntry.is_active = isActive;

                displayDictEntry(currentDictEntry);
            } else if (!id) {
                // 如果是添加操作，重新搜索显示
                searchDictionary();
            }

            // 刷新同步日志和状态
            setTimeout(() => {
                loadUnsyncedLogs();
                updateSyncStatus();
            }, 1000);
        } else {
            showToast(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('Save dictionary entry error:', error);
        showToast('保存失败，请检查网络连接', 'error');
    }
}

// 关闭字典模态框
function closeDictModal() {
    document.getElementById('dictModal').style.display = 'none';
}

// 刷新字典数据
function refreshDictionaryData() {
    if (currentDictEntry) {
        // 如果当前有词条显示，重新搜索
        const keyword = document.getElementById('dictSearchInput').value.trim();
        if (keyword) {
            searchDictionary();
        }
    } else {
        showToast('请先输入搜索关键词', 'info');
    }
}

// 更新变体状态指示器
function updateVariantStatus(variant) {
    const statusElement = document.getElementById('dictEntryVariantStatus');
    const statusTextElement = document.getElementById('dictEntryVariantStatusText');

    if (!statusElement || !statusTextElement) return;

    // 移除所有状态类
    statusElement.classList.remove('has-variant', 'no-variant');

    if (variant && variant > 1) {
        // 有变体（变体编号大于1）
        statusElement.classList.add('has-variant');
        statusTextElement.textContent = '有变体';
    } else {
        // 无变体（变体编号为1或空）
        statusElement.classList.add('no-variant');
        statusTextElement.textContent = '无变体';
    }
}

// 更新变体状态指示器（基于当前词条和整个搜索结果）
function updateVariantStatusForEntry(currentEntry, allResults) {
    const statusElement = document.getElementById('dictEntryVariantStatus');
    const statusTextElement = document.getElementById('dictEntryVariantStatusText');

    if (!statusElement || !statusTextElement || !currentEntry) return;

    // 移除所有状态类
    statusElement.classList.remove('has-variant', 'no-variant');

    let hasVariants = false;
    let isVariantItself = false;

    if (currentSearchType === 'mandarin') {
        // 搜索普通话时：检查普通话方向的变体
        const currentMandarin = currentEntry.mandarin_text;
        const currentVariantMandarin = currentEntry.variant_mandarin;

        // 检查当前词条是否有其他普通话方向的变体
        hasVariants = allResults.some(result => {
            return result.mandarin_text === currentMandarin &&
                result.variant_mandarin !== currentVariantMandarin;
        });

        // 或者当前词条本身变体编号不为1
        isVariantItself = currentVariantMandarin > 1;
    } else {
        // 搜索潮汕话时：检查潮汕话方向的变体
        const currentTeochew = currentEntry.teochew_text;
        const currentVariantTeochew = currentEntry.variant_teochew !== undefined ?
            currentEntry.variant_teochew : 1;

        // 检查当前词条是否有其他潮汕话方向的变体
        hasVariants = allResults.some(result => {
            const resultVariantTeochew = result.variant_teochew !== undefined ?
                result.variant_teochew : 1;
            return result.teochew_text === currentTeochew &&
                resultVariantTeochew !== currentVariantTeochew;
        });

        // 或者当前词条本身变体编号不为1
        isVariantItself = currentVariantTeochew > 1;
    }

    if (hasVariants || isVariantItself) {
        // 有变体
        statusElement.classList.add('has-variant');
        statusTextElement.textContent = '有变体';
    } else {
        // 无变体
        statusElement.classList.add('no-variant');
        statusTextElement.textContent = '唯一';
    }
}

// 加载日志（根据复选框状态决定加载待同步日志或完整日志）
async function loadUnsyncedLogs() {
    try {
        // 获取复选框状态
        const onlyPendingSync = document.getElementById('onlyPendingSync').checked;
        const apiUrl = onlyPendingSync ? '/api/jieba/changes' : '/api/jieba/logs?page=1&per_page=100';

        // 显示加载动画（选中和取消选中都要获取数据）
        const logContent = document.getElementById('syncLogContent');
        const loadingText = onlyPendingSync ? '正在加载待同步日志...' : '正在加载操作日志...';
        logContent.innerHTML = `
            <div class="sync-loading-logs">
                <div class="sync-loading-spinner">
                    <svg fill="currentColor" viewBox="0 0 20 20" class="animate-spin">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <p>${loadingText}</p>
            </div>
        `;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success || !data.logs || data.logs.length === 0) {
            let message = onlyPendingSync ? '暂无未同步日志' : '暂无操作日志';
            if (data.error) {
                message = data.error; // 显示错误消息而不是默认消息
            }

            logContent.innerHTML = `
                <div class="sync-empty-logs">
                    <div class="sync-empty-icon">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        // 显示日志内容
        let logsHtml = '';
        const logs = data.logs;

        logs.forEach(log => {
            const timestamp = log.timestamp ? formatDateTime(log.timestamp) : '未知时间';
            const identifier = log.identifier || {};
            const changes = log.changes || {};
            const operation = log.operation || 'unknown';

            let operationText = operation;
            let operationColor = 'sync-log-operation';

            if (operation === 'add') {
                operationText = '添加';
                operationColor = 'sync-log-operation sync-log-add';
            } else if (operation === 'update') {
                operationText = '更新';
                operationColor = 'sync-log-operation sync-log-update';
            } else if (operation === 'delete') {
                operationText = '删除';
                operationColor = 'sync-log-operation sync-log-delete';
            }

            // 格式化日志详情
            let detailsHtml = '';

            if (operation === 'add' || operation === 'delete') {
                // 添加和删除操作显示："普通话"（变体） - "潮汕话"
                const mandarin = identifier.mandarin_text || changes.new?.mandarin_text || changes.old?.mandarin_text || '未知词条';
                const teochew = identifier.teochew_text || changes.new?.teochew_text || changes.old?.teochew_text || '未知潮汕话';
                const variantMandarin = identifier.variant_mandarin || changes.new?.variant_mandarin || changes.old?.variant_mandarin || 1;

                detailsHtml = `「普」"${mandarin}"${variantMandarin > 1 ? `(变体${variantMandarin})` : ''}  · 「潮」"${teochew}"`;
            } else if (operation === 'update') {
                // 修改操作显示："old_data"->"new_data"（相同数据不显示）
                const oldData = changes.old || {};
                const newData = changes.new || {};

                // 获取字词信息用于操作列显示
                const mandarin = newData.mandarin_text || oldData.mandarin_text || '未知词条';
                const teochew = newData.teochew_text || oldData.teochew_text || '未知词条';

                // 更新操作列显示，字词信息使用不显眼的样式
                operationText = `更新:<span class="sync-log-word-info">「普」"${mandarin}" · 「潮」"${teochew}"</span>`;

                const changesArray = [];

                // 检查每个字段的变化
                if (oldData.mandarin_text !== newData.mandarin_text) {
                    changesArray.push(`「普」 "${oldData.mandarin_text || '空'}"（旧） → "${newData.mandarin_text || '空'}"（新）`);
                }

                if (oldData.teochew_text !== newData.teochew_text) {
                    changesArray.push(`「潮」 "${oldData.teochew_text || '空'}"（旧） → "${newData.teochew_text || '空'}"（新）`);
                }

                if (oldData.variant_mandarin !== newData.variant_mandarin) {
                    const oldVariant = oldData.variant_mandarin || 1;
                    const newVariant = newData.variant_mandarin || 1;
                    changesArray.push(`「普通话变体」 M${oldVariant} → M${newVariant}`);
                }

                if (oldData.variant_teochew !== newData.variant_teochew) {
                    const oldVariant = oldData.variant_teochew || 1;
                    const newVariant = newData.variant_teochew || 1;
                    changesArray.push(`「潮州话变体」 T${oldVariant} → T${newVariant}`);
                }

                // 优先级变化
                const oldPriority = oldData.teochew_priority !== undefined ? oldData.teochew_priority : 1;
                const newPriority = newData.teochew_priority !== undefined ? newData.teochew_priority : 1;
                if (oldPriority !== newPriority) {
                    changesArray.push(`「优先级」 ${oldPriority} → ${newPriority}`);
                }

                // 状态判断，处理数字和布尔值的转换
                const oldStatus = oldData.is_active;
                const newStatus = newData.is_active;

                // 将状态转换为布尔值进行比较（处理0/1, true/false, "true"/"false"等情况）
                const normalizeStatus = (status) => {
                    if (status === true || status === 1 || status === "1" || status === "true") {
                        return true;
                    }
                    if (status === false || status === 0 || status === "0" || status === "false") {
                        return false;
                    }
                    return null; // 其他值
                };

                const normalizedOld = normalizeStatus(oldStatus);
                const normalizedNew = normalizeStatus(newStatus);

                // 只有在规范化后的值真正不同时才显示变化
                if (normalizedOld !== normalizedNew && normalizedOld !== null && normalizedNew !== null) {
                    const oldStatusText = normalizedOld ? '启用' : '禁用';
                    const newStatusText = normalizedNew ? '启用' : '禁用';
                    changesArray.push(`「状态」 ${oldStatusText} → ${newStatusText}`);
                }

                // 备注变化
                const oldNotes = oldData.notes;
                const newNotes = newData.notes;

                // 判断是否变化（分别处理，避免 null 被转换为 '暂无备注' 后无法区分）
                const hasChanged = (oldNotes !== newNotes);

                if (hasChanged) {
                    // 截断显示，最多5个字符
                    const truncateNotes = (text) => {
                        if (text === null || text === undefined || text === '暂无备注') return '无备注';
                        if (text.length <= 5) return `"${text}"`;
                        return `"${text.substring(0, 5)}..."`;
                    };
                    changesArray.push(`「备注」 ${truncateNotes(oldNotes)} → ${truncateNotes(newNotes)}`);
                }

                // 如果没有变化，显示基本信息
                if (changesArray.length === 0) {
                    const variantMandarin = newData.variant_mandarin || oldData.variant_mandarin || 1;
                    detailsHtml = `"${mandarin}"${variantMandarin > 1 ? `(变体${variantMandarin})` : ''} -- 元数据更新`;
                } else {
                    detailsHtml = `${changesArray.join(' ; ')}`;
                }
            } else {
                // 其他操作类型
                detailsHtml = `未知操作类型`;
            }

            logsHtml += `
                <div class="sync-log-item">
                    <div class="sync-log-timestamp">${timestamp}</div>
                    <div class="${operationColor}">${operationText}</div>
                    <div class="sync-log-details">${detailsHtml}</div>
                </div>
            `;
        });

        logContent.innerHTML = logsHtml;

    } catch (error) {
        console.error('Load unsynced logs error:', error);
        const logContent = document.getElementById('syncLogContent');

        // 显示更详细的错误信息
        const errorMessage = error.message || '未知错误';
        logContent.innerHTML = `
            <div class="sync-empty-logs">
                <div class="sync-empty-icon">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <p>加载日志失败: ${errorMessage}</p>
            </div>
        `;
    }
}

// 更新同步状态指示器
async function updateSyncStatus() {
    try {
        const response = await fetch('/api/jieba/sync/status');
        const data = await response.json();

        const statusLight = document.getElementById('syncStatusLight');
        const statusText = statusLight.querySelector('.status-text');

        if (!data.success) {
            statusLight.className = 'sync-status-light error';
            statusText.textContent = '连接失败';
            return;
        }

        const syncNeeded = data.sync_needed;
        const unsyncedCount = data.unsynced_logs_count || 0;

        if (syncNeeded && unsyncedCount > 0) {
            statusLight.className = 'sync-status-light syncing';
            statusText.textContent = `待同步 (${unsyncedCount}条)`;
        } else {
            statusLight.className = 'sync-status-light connected';
            statusText.textContent = '已同步';
        }

    } catch (error) {
        console.error('Update sync status error:', error);
        const statusLight = document.getElementById('syncStatusLight');
        const statusText = statusLight.querySelector('.status-text');
        statusLight.className = 'sync-status-light error';
        statusText.textContent = '未连接';
    }
}

// Jieba字典同步功能
async function syncJiebaDictionary() {
    const syncBtn = document.querySelector('.dict-sync-btn');

    if (!syncBtn) return;

    try {
        // 设置加载状态
        syncBtn.classList.add('loading');
        syncBtn.disabled = true;

        // 更新状态指示器为同步中
        const statusLight = document.getElementById('syncStatusLight');
        const statusText = statusLight.querySelector('.status-text');
        statusLight.className = 'sync-status-light syncing';
        statusText.textContent = '同步中...';

        const response = await fetch('/api/jieba/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            const stats = data.stats || {};
            const message = `Jieba同步完成\n` +
                          `新增: ${stats.added || 0} 条\n` +
                          `更新: ${stats.modified || 0} 条\n` +
                          `删除: ${stats.deleted || 0} 条\n` +
                          `总计: ${stats.total_changes || 0} 条`;
            showToast(message, 'success', 5000);

            // 同步完成后刷新日志和状态
            setTimeout(() => {
                loadUnsyncedLogs();
                updateSyncStatus();
            }, 1000);
        } else {
            statusLight.className = 'sync-status-light error';
            statusText.textContent = '同步失败';
            showToast(data.error || 'Jieba同步失败', 'error');
        }
    } catch (error) {
        console.error('Jieba sync error:', error);
        const statusLight = document.getElementById('syncStatusLight');
        const statusText = statusLight.querySelector('.status-text');
        statusLight.className = 'sync-status-light error';
        statusText.textContent = '连接失败';
        showToast('同步失败，请检查网络连接', 'error');
    } finally {
        // 移除加载状态
        syncBtn.classList.remove('loading');
        syncBtn.disabled = false;
    }
}

// 监听回车键搜索
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('dictSearchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchDictionary();
            }
        });
    }

    // 监听ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDictModal();
        }
    });

    // 添加复选框事件监听器
    const onlyPendingSyncCheckbox = document.getElementById('onlyPendingSync');

    if (onlyPendingSyncCheckbox) {
        onlyPendingSyncCheckbox.addEventListener('change', function() {

            // 重新加载日志
            loadUnsyncedLogs();
        });
    }

    // 初始化同步界面
    loadUnsyncedLogs();
    updateSyncStatus();

    // 定期更新同步状态
    setInterval(updateSyncStatus, 30000); // 每30秒更新一次
});