// 列表视图功能
// listSearchTimer 变量已移至 admin_new.js 全局定义

// 视图切换
function toggleView() {
    const deviceView = document.getElementById('deviceView');
    const listView = document.getElementById('listView');
    const toggleBtn = document.querySelector('.toggle-view-btn');

    if (currentView === 'device') {
        deviceView.style.display = 'none';
        listView.style.display = 'block';
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
            console.log('保存详细视图激活状态:', deviceViewActiveStatus);
        }

        // 获取当前激活的状态筛选按钮，并同步到列表视图的筛选器
        const statusFilter = document.getElementById('statusFilter');

        if (activeStatusBtn && statusFilter) {
            const statusValue = activeStatusBtn.getAttribute('data-status');
            statusFilter.value = statusValue;

            // 更新全局状态筛选变量
            currentStatusFilter = statusValue;
        }

        currentView = 'list';
        loadListView();
    } else {
        deviceView.style.display = 'block';
        listView.style.display = 'none';
        toggleBtn.innerHTML = `
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z"/>
            </svg>
            列表视图
        `;

        // 同步列表视图的筛选状态到详细视图
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            const filterValue = statusFilter.value;

            // 如果列表视图不是"所有状态"（即有具体状态），则同步状态
            if (filterValue && filterValue !== '') {
                currentStatusFilter = filterValue;

                // 更新详细视图的状态筛选按钮
                const filterButtons = document.querySelectorAll('.status-filter-btn');
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.status === currentStatusFilter) {
                        btn.classList.add('active');
                    }
                });

                // 加载对应状态的数据
                loadRecordings(currentStatusFilter);
            } else {
                // 如果列表视图是"所有状态"，则恢复详细视图之前保存的状态
                console.log('列表视图为所有状态，恢复详细视图之前的状态:', deviceViewActiveStatus);

                // 恢复激活按钮样式
                const filterButtons = document.querySelectorAll('.status-filter-btn');
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.status === deviceViewActiveStatus) {
                        btn.classList.add('active');
                    }
                });

                // 更新当前状态变量
                currentStatusFilter = deviceViewActiveStatus;

                // 不重新加载数据，因为数据应该还在内存中
            }
        }

        currentView = 'device';
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
    const highlightText = (text) => {
        if (!searchQuery || !text) return text || '-';
        const regex = new RegExp(`(${searchQuery})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    listContainer.innerHTML = recordings.map(record => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="id-section">
                    <span class="list-item-id clickable" onclick="jumpTodeviceView('${record.id}')" title="点击跳转到详细视图">记录 #${highlightText(record.id.toString())}</span>
                </div>
                <span class="list-item-status ${record.status}">${getStatusText(record.status)}</span>
            </div>

            <div class="list-item-content">
                <div class="text-display">
                    <label>原始文本</label>
                    <div class="original-text">
                        <p>${highlightText(record.original_text)}</p>
                    </div>
                </div>

                <div class="text-display">
                    <label>转换文本</label>
                    <div class="converted-text">
                        <p>${highlightText(record.actual_content)}</p>
                    </div>
                </div>
            </div>

            <div class="list-item-footer">
                <div class="list-item-meta">
                    <span class="meta-ip">IP: ${record.ip_address || '-'}</span>
                    <span class="meta-time">${record.upload_time ? new Date(record.upload_time).toLocaleString() : '-'}</span>
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
    `).join('');

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
async function jumpTodeviceView(recordId) {
    try {
        // 首先查找目标记录的状态
        const listResponse = await fetch(`/api/recordings?per_page=200`);
        const listData = await listResponse.json();

        if (!listData.success) {
            showToast('获取记录信息失败', 'error');
            return;
        }

        // 查找目标记录
        const targetRecord = listData.recordings.find(record => record.id === recordId);
        if (!targetRecord) {
            showToast('未找到该记录', 'error');
            return;
        }

        // 设置筛选条件为目标记录的状态
        const targetStatus = targetRecord.status;
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.value = targetStatus;
        }

        // 更新筛选按钮状态
        const filterButtons = document.querySelectorAll('.status-filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.status === targetStatus) {
                btn.classList.add('active');
            }
        });

        // 重新加载详细视图的数据（使用目标记录的状态筛选）
        const response = await fetch(`/api/recordings?status=${targetStatus}&page=1&per_page=50`);
        const data = await response.json();

        if (data.success) {
            recordingsData = data.recordings || [];

            // 查找指定ID的记录索引
            const targetIndex = recordingsData.findIndex(record => record.id === recordId);

            if (targetIndex === -1) {
                showToast('未找到该记录', 'error');
                return;
            }

            // 设置当前记录索引
            currentRecordIndex = targetIndex;

            // 切换到详细视图
            const deviceView = document.getElementById('deviceView');
            const listView = document.getElementById('listView');
            const toggleBtn = document.querySelector('.toggle-view-btn');

            if (currentView === 'list') {
                // 手动触发视图切换
                deviceView.style.display = 'block';
                listView.style.display = 'none';
                toggleBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z"/>
                    </svg>
                    列表视图
                `;
                currentView = 'device';
            }

            // 显示目标记录
            displayCurrentRecord();
            updateNavigationButtons();

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
                }
            }, 300); // 300ms延迟
        });

        // 回车键搜索
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(listSearchTimer);
                currentPage = 1;
                if (currentView === 'list') {
                    loadListView();
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
                currentPage = 1;
                if (currentView === 'list') {
                    loadListView();
                }
            }
        });
    }
}