// 字典管理模块

// 全局变量
let dictionaryResults = [];
let currentDictIndex = 0;
let currentDictEntry = null;

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

        const response = await fetch(`/api/dictionary/search?keyword=${encodeURIComponent(keyword)}`);
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
    document.getElementById('dictResultCount').textContent = '0 条词条';
    document.getElementById('dictCurrentDisplay').textContent = '未查询';
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
    document.getElementById('dictResultCount').textContent = '搜索中...';
    document.getElementById('dictCurrentDisplay').textContent = '搜索中';
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
    document.getElementById('dictResultCount').textContent = '0 条词条';
    document.getElementById('dictCurrentDisplay').textContent = '未找到';
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
    document.getElementById('dictResultCount').textContent = `${totalCount} 条词条`;

    if (currentDictEntry) {
        document.getElementById('dictCurrentDisplay').textContent = `${currentDictEntry.mandarin_text} → ${currentDictEntry.teochew_text}`;
    }

    // 更新导航按钮状态
    document.getElementById('dictPrevBtn').disabled = currentDictIndex <= 0;
    document.getElementById('dictNextBtn').disabled = currentDictIndex >= totalCount - 1;
}

// 显示词条详情
function displayDictEntry(entry) {
    currentDictEntry = entry;

    // 切换显示状态
    document.getElementById('dictEmptyWord').style.display = 'none';
    document.getElementById('dictWordContent').style.display = 'block';

    // 更新词汇显示
    document.getElementById('displayTeochew').textContent = entry.teochew_text;
    document.getElementById('displayMandarin').textContent = entry.mandarin_text;

    // 更新元数据
    document.getElementById('displayVariant').textContent = entry.variant.toString();
    document.getElementById('displayPriority').textContent = entry.priority.toString();
    document.getElementById('displayStatus').textContent = entry.is_active ? '启用' : '禁用';
    document.getElementById('displayStatus').style.color = entry.is_active ? '#00ff88' : '#ff4757';
    document.getElementById('displayId').textContent = entry.id.toString();

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
    document.getElementById('dictVariant').value = '1';
    document.getElementById('dictPriority').value = '1.0';
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

    // 填充表单
    document.getElementById('dictId').value = currentDictEntry.id;
    document.getElementById('dictMandarin').value = currentDictEntry.mandarin_text;
    document.getElementById('dictTeochew').value = currentDictEntry.teochew_text;
    document.getElementById('dictVariant').value = currentDictEntry.variant;
    document.getElementById('dictPriority').value = currentDictEntry.priority;
    document.getElementById('dictActive').checked = currentDictEntry.is_active;
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
    const variant = parseInt(document.getElementById('dictVariant').value);
    const priority = parseFloat(document.getElementById('dictPriority').value);
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

    if (isNaN(variant) || variant < 1) {
        showToast('变体编号必须是大于0的整数', 'warning');
        return;
    }

    if (isNaN(priority) || priority < 0) {
        showToast('优先级必须是非负数', 'warning');
        return;
    }

    try {
        const url = id ? `/api/dictionary/${id}` : '/api/dictionary';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mandarin_text: mandarinText,
                teochew_text: teochewText,
                variant: variant,
                priority: priority,
                is_active: isActive,
                user: 'admin',
                reason: id ? '通过管理界面编辑' : '通过管理界面添加'
            })
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
                currentDictEntry.variant = variant;
                currentDictEntry.priority = priority;
                currentDictEntry.is_active = isActive;

                displayDictEntry(currentDictEntry);
            } else if (!id) {
                // 如果是添加操作，重新搜索显示
                searchDictionary();
            }
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

    // 点击模态框外部关闭
    const modal = document.getElementById('dictModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeDictModal();
            }
        });
    }
});