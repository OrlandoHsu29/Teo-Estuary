// 列表视图功能
// listSearchTimer 变量已移至 admin_new.js 全局定义

// 视图切换
function toggleView() {
    const deviceView = document.getElementById('deviceView');
    const listView = document.getElementById('listView');
    const toggleBtn = document.querySelector('.toggle-view-btn');

    if (currentView === 'device') {
        deviceView.style.display = 'none';
        document.getElementById('quickTranslateDevice').style.display = 'none';
        listView.style.display = 'block';
        document.getElementById('filterControls').style.display = 'flex';
        if (typeof updateFilterControlsPosition === 'function') {
            updateFilterControlsPosition();
        }
        toggleBtn.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            详细视图
        `;

        // 保存当前详细视图的激活状态
        const activeStatusBtn = document.querySelector('.status-filter-btn.active');
        if (activeStatusBtn) {
            deviceViewActiveStatus = activeStatusBtn.getAttribute('data-status') || 'pending';
        }

        // 获取当前激活的状态筛选按钮，并同步到列表视图的筛选器
        const statusFilter = document.getElementById('statusFilter');

        if (activeStatusBtn && statusFilter) {
            const statusValue = activeStatusBtn.getAttribute('data-status');

            // 如果是"所有状态"，则列表筛选器设为空字符串
            // 否则设为对应的状态值
            if (statusValue === 'all') {
                statusFilter.value = '';
            } else {
                statusFilter.value = statusValue;
            }

            // 更新全局状态筛选变量
            currentStatusFilter = statusValue;
        }

        currentView = 'list';
        loadListView();
        if (typeof updateShortcutHintsVisibility === 'function') {
            updateShortcutHintsVisibility();
        }
    } else {
        deviceView.style.display = 'block';
        document.getElementById('quickTranslateDevice').style.display = 'block';
        listView.style.display = 'none';
        document.getElementById('filterControls').style.display = 'none';
        toggleBtn.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z"/>
            </svg>
            列表视图
        `;

        // 同步列表视图的筛选状态到详细视图
        const statusFilter = document.getElementById('statusFilter');
        const searchInput = document.getElementById('searchInput');
        if (statusFilter) {
            const filterValue = statusFilter.value;
            const searchValue = searchInput ? searchInput.value.trim() : '';

            // 更新详细视图的状态筛选按钮
            const filterButtons = document.querySelectorAll('.status-filter-btn');
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // 确定目标状态
            if (filterValue && filterValue !== '') {
                // 列表视图是具体状态筛选
                currentStatusFilter = filterValue;

                // 只有在没有搜索条件时，才选中状态按钮
                if (!searchValue) {
                    filterButtons.forEach(btn => {
                        if (btn.dataset.status === currentStatusFilter) {
                            btn.classList.add('active');
                        }
                    });
                }

                // 加载对应状态的数据（保持搜索条件）
                currentSearchQuery = searchValue;
                loadRecordings(currentStatusFilter, searchValue);
            } else {
                // 列表视图是"所有状态"，详细视图也切换到"所有状态"
                currentStatusFilter = 'all';

                // 只有在没有搜索条件时，才选中状态按钮
                if (!searchValue) {
                    filterButtons.forEach(btn => {
                        if (btn.dataset.status === 'all') {
                            btn.classList.add('active');
                        }
                    });
                }

                // 加载所有状态的数据（保持搜索条件）
                currentSearchQuery = searchValue;
                loadRecordings('all', searchValue);

                // 更新保存的详细视图状态
                deviceViewActiveStatus = 'all';
            }
        }

        currentView = 'device';
        if (typeof updateShortcutHintsVisibility === 'function') {
            updateShortcutHintsVisibility();
        }
    }
}

// 加载列表视图
async function loadListView() {
    try {
        const status = document.getElementById('statusFilter').value || '';
        const searchQuery = document.getElementById('searchInput').value.trim();

        let url = `/api/recordings?page=${currentPage}&per_page=20`;

        // 添加状态筛选
        if (status) {
            url += `&status=${status}`;
        }

        // 添加搜索查询
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            renderListView(data.recordings || [], data.total || 0, data.current_page || 1, data.pages || 1);
        }
    } catch (error) {
        console.error('加载列表视图失败:', error);
        showToast('加载数据失败', 'error');
    }
}

// 渲染列表视图
function renderListView(recordings, total, current, pages) {
    const listContainer = document.getElementById('recordingsList');

    if (recordings.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <h3>暂无记录</h3>
                <p>没有找到符合条件的录音记录</p>
            </div>
        `;
        return;
    }

    // 获取搜索关键词用于高亮
    const searchQuery = document.getElementById('searchInput').value.trim();

    // 清理分词标记（用于列表显示）
    const cleanWordMarkers = (text) => {
        if (!text) return '-';
        // 移除分词相关的标记符：空格分隔符、$[原词]、#
        // 处理变体词：翻译$[原词] -> 翻译
        // 处理完成词：翻译# -> 翻译
        return text
            .replace(/\$\[([^\]]+)\]/g, '')  // 移除 $[原词]
            .replace(/#/g, '')                // 移除 #
            .replace(/\s+/g, '');              // 移除所有空格
    };

    const highlightText = (text) => {
        if (!text) return '-';

        // 先清理分词标记用于显示
        const cleanedText = cleanWordMarkers(text);

        // 如果有搜索关键词，在清理后的文本中进行高亮
        if (searchQuery) {
            const regex = new RegExp(`(${searchQuery})`, 'gi');
            return cleanedText.replace(regex, '<mark>$1</mark>');
        }

        // 没有搜索，直接返回清理后的文本
        return cleanedText;
    };

    // 获取当前筛选状态
    const currentStatusFilter = document.getElementById('statusFilter').value || '';

    // 为每条记录添加元数据：在当前列表中的索引和状态
    const recordIndexOffset = (current - 1) * 20; // 每页20条，计算全局偏移

    listContainer.innerHTML = recordings.map((record, index) => {
        // 计算这条记录在当前列表中的全局索引
        const globalListIndex = recordIndexOffset + index;

        return `
        <div class="list-item" data-record-id="${record.id}">
            <div class="list-item-header">
                <div class="id-section">
                    <span class="list-item-id clickable"
                          onclick="jumpToDetailView('${record.id}', ${globalListIndex}, ${current})"
                          title="点击跳转到详细视图">
                          记录 #${highlightText(record.id.toString())}
                    </span>
                </div>
                <span class="list-item-status ${record.status}">${getStatusText(record.status)}</span>
            </div>

            <div class="list-item-content">
                <div class="text-display">
                    <label>普通话文本</label>
                    <div class="mandarin-text">
                        <p>${highlightText(record.mandarin_text)}</p>
                    </div>
                </div>

                <div class="text-display">
                    <label>潮汕话文本</label>
                    <div class="teochew-text">
                        <p>${highlightText(record.teochew_text)}</p>
                    </div>
                </div>
            </div>

            <div class="list-item-footer">
                <div class="list-item-meta">
                    <span class="meta-ip">IP: ${record.ip_address || '-'}</span>
                    <span class="meta-time">${record.upload_time ? formatDateTimeShort(record.upload_time) : '-'}</span>
                    <span class="meta-size">${record.file_size ? formatFileSize(record.file_size) : '-'}</span>
                </div>

                <div class="list-item-actions">
                    <!-- 功能按钮组 -->
                    <div class="action-group">
                        ${record.file_path ? `<button class="action-btn download-btn" onclick="downloadRecording('${record.id}')" title="下载">⬇</button>` : ''}
                        <button class="action-btn delete-btn" onclick="deleteFromList('${record.id}', ${record === recordingsData[currentRecordIndex]})" title="删除"><i class="fas fa-trash"></i></button>
                    </div>

                    <!-- 分割线 -->
                    <div class="action-divider"></div>

                    <!-- 审核按钮组 -->
                    <div class="review-group">
                        <button class="action-btn reject-btn ${record.status === 'rejected' ? 'disabled-by-status' : ''}"
                                onclick="rejectFromList('${record.id}', ${record === recordingsData[currentRecordIndex]})"
                                title="${record.status === 'rejected' ? '已拒绝' : '拒绝'}"
                                ${record.status === 'rejected' ? 'disabled' : ''}>
                            <i class="fas fa-times"></i> 拒绝
                        </button>
                        <button class="action-btn approve-btn ${record.status === 'approved' ? 'disabled-by-status' : ''}"
                                onclick="approveFromList('${record.id}', ${record === recordingsData[currentRecordIndex]})"
                                title="${record.status === 'approved' ? '已通过' : '通过'}"
                                ${record.status === 'approved' ? 'disabled' : ''}>
                            <i class="fas fa-check"></i> 通过
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

    // 渲染分页
    renderPagination(current, pages);
}

// 渲染分页
function renderPagination(current, pages) {
    const paginationContainer = document.getElementById('listPagination');

    if (pages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = '<div class="pagination-controls">';

    // 上一页
    if (current > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${current - 1})">上一页</button>`;
    }

    // 页码
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(pages, current + 2);

    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) paginationHTML += '<span>...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === current ? 'active' : '';
        paginationHTML += `<button class="pagination-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < pages) {
        if (endPage < pages - 1) paginationHTML += '<span>...</span>';
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${pages})">${pages}</button>`;
    }

    // 下一页
    if (current < pages) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${current + 1})">下一页</button>`;
    }

    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
}

// 跳转到指定页面
function goToPage(page) {
    currentPage = page;
    loadListView();
}

// 从列表跳转到详细视图
// 参数：
// - recordId: 记录ID（用于验证）
// - listIndex: 记录在当前列表中的全局索引（从0开始）
// - listPage: 记录所在的列表页码（未使用，保留以便后续扩展）
async function jumpToDetailView(recordId, listIndex, listPage) {
    try {
        // 获取当前列表的筛选状态和搜索关键词
        const currentListFilter = document.getElementById('statusFilter').value || '';
        const searchQuery = document.getElementById('searchInput').value.trim();

        // 确定目标状态（用于详细视图筛选）
        // 如果列表是"所有状态"，则详细视图也切换到"所有状态"
        // 如果列表是具体状态，则详细视图也使用该状态
        const targetStatus = currentListFilter === '' ? 'all' : currentListFilter;

        // 计算目标页：索引 / 50 + 1
        const targetPage = Math.floor(listIndex / 50) + 1;

        // 构建API URL
        let apiUrl = `/api/recordings?page=${targetPage}&per_page=50`;
        if (targetStatus !== 'all') {
            apiUrl += `&status=${targetStatus}`;
        }
        // 添加搜索参数（如果有）
        if (searchQuery) {
            apiUrl += `&search=${encodeURIComponent(searchQuery)}`;
        }

        // 保存搜索状态到全局变量
        currentSearchQuery = searchQuery;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.success) {
            recordingsData = data.recordings || [];

            // 计算在当前页中的索引（0-49）
            const indexInPage = listIndex % 50;

            // 验证索引有效性
            if (indexInPage >= recordingsData.length) {
                showToast('未找到该记录', 'error');
                return;
            }

            // 设置分页相关变量
            windowStartPage = targetPage;
            windowEndPage = targetPage;
            currentPage = targetPage;
            totalPages = data.pages || 1;
            window.totalDataCount = data.total || 0;

            // 设置当前记录索引
            currentRecordIndex = indexInPage;
            absoluteRecordIndex = (windowStartPage - 1) * 50 + currentRecordIndex;
            currentStatusFilter = targetStatus;

            // 更新详细视图的筛选按钮状态
            // 如果有搜索条件，不选中任何状态按钮
            // 如果没有搜索条件，才选中对应的状态按钮
            const filterButtons = document.querySelectorAll('.status-filter-btn');
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // 只有在没有搜索条件时，才选中对应的状态按钮
            if (!searchQuery) {
                filterButtons.forEach(btn => {
                    if (btn.dataset.status === targetStatus) {
                        btn.classList.add('active');
                    }
                });
            }

            // 更新列表视图的筛选器和搜索框（保持同步）
            const statusFilter = document.getElementById('statusFilter');
            const searchInput = document.getElementById('searchInput');
            if (statusFilter) {
                statusFilter.value = currentListFilter;
            }
            if (searchInput) {
                searchInput.value = searchQuery;
            }

            // 切换到详细视图
            const deviceView = document.getElementById('deviceView');
            const listView = document.getElementById('listView');
            const toggleBtn = document.querySelector('.toggle-view-btn');
            const quickTranslateDevice = document.getElementById('quickTranslateDevice');
            const filterControls = document.getElementById('filterControls');

            if (currentView === 'list') {
                // 手动触发视图切换
                deviceView.style.display = 'block';
                listView.style.display = 'none';
                if (quickTranslateDevice) quickTranslateDevice.style.display = 'block';
                if (filterControls) filterControls.style.display = 'none';
                toggleBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z"/>
                    </svg>
                    列表视图
                `;
                currentView = 'device';
            }

            // 显示目标记录并更新所有状态
            displayCurrentRecord();
            updateNavigationButtons();
            updateReviewCounter();

            // 添加跳转动画效果
            const device = document.getElementById('reviewDevice');
            if (device) {
                device.style.transform = 'scale(0.95)';
                device.style.opacity = '0.7';
                setTimeout(() => {
                    device.style.transform = 'scale(1)';
                    device.style.opacity = '1';
                }, 200);
            }
        } else {
            showToast('加载记录失败', 'error');
        }
    } catch (error) {
        console.error('跳转到详细视图失败:', error);
        showToast('跳转失败', 'error');
    }
}


// 初始化搜索功能
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const searchContainer = document.querySelector('.search-container');

    if (searchInput) {
        // 输入时搜索
        searchInput.addEventListener('input', function() {
            clearTimeout(listSearchTimer);
            const searchValue = this.value.trim();

            // 更新全局搜索变量
            currentSearchQuery = searchValue;

            // 更新清除按钮显示状态
            if (searchValue) {
                searchContainer.classList.add('has-search');
            } else {
                searchContainer.classList.remove('has-search');
            }

            // 延迟搜索，避免频繁请求
            listSearchTimer = setTimeout(() => {
                currentPage = 1;
                if (currentView === 'list') {
                    loadListView();
                } else if (currentView === 'device') {
                    // 如果在详细视图,也需要重新加载数据
                    loadRecordings(currentStatusFilter, searchValue);
                }
            }, 300); // 300ms延迟
        });

        // 回车键搜索
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(listSearchTimer);
                const searchValue = this.value.trim();
                currentSearchQuery = searchValue; // 更新全局搜索变量
                currentPage = 1;
                if (currentView === 'list') {
                    loadListView();
                } else if (currentView === 'device') {
                    // 如果在详细视图,也需要重新加载数据
                    loadRecordings(currentStatusFilter, searchValue);
                }
            }
        });
    }

    // 清除搜索按钮
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) {
                searchInput.value = '';
                searchContainer.classList.remove('has-search');
                currentSearchQuery = ''; // 重置全局搜索变量
                currentPage = 1;
                if (currentView === 'list') {
                    loadListView();
                } else if (currentView === 'device') {
                    // 如果在详细视图，需要重新加载数据并恢复状态按钮
                    loadRecordings(currentStatusFilter, '');

                    // 恢复状态按钮的选中状态
                    const filterButtons = document.querySelectorAll('.status-filter-btn');
                    filterButtons.forEach(btn => {
                        btn.classList.remove('active');
                        if (btn.dataset.status === currentStatusFilter) {
                            btn.classList.add('active');
                        }
                    });
                }
            }
        });
    }
}