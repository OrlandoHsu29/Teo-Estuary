// UI导航和控制模块

// 初始化导航功能
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            switchSection(section);
        });
    });
}

// 初始化状态筛选按钮
function initializeStatusFilters() {
    // 设置默认激活状态
    const pendingBtn = document.querySelector('[data-status="pending"]');
    if (pendingBtn) {
        pendingBtn.classList.add('active');
    }
}


// 切换功能区域
function switchSection(sectionName) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // 隐藏所有内容区域
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // 显示对应内容区域
    document.getElementById(`${sectionName}-section`).classList.add('active');

    currentSection = sectionName;

    // 更新快捷键提示可见性
    if (typeof updateShortcutHintsVisibility === 'function') {
        updateShortcutHintsVisibility();
    }

    // 如果切换到审核界面，确保视图状态正确
    if (sectionName === 'review') {
        const deviceView = document.getElementById('deviceView');
        const listView = document.getElementById('listView');
        const toggleBtn = document.querySelector('.toggle-view-btn');

        if (currentView === 'list') {
            // 如果当前是列表视图，但切换到了审核界面，需要重置为详细视图
            deviceView.style.display = 'block';
            listView.style.display = 'none';
            const quickTranslateDevice = document.getElementById('quickTranslateDevice');
            if (quickTranslateDevice) {
                quickTranslateDevice.style.display = 'block';
            }
            if (toggleBtn) {
                toggleBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 100 4h2a2 2 0 100-4h2a1 1 0 100-2 2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2H6z"/>
                    </svg>
                    列表视图
                `;
            }
            currentView = 'device';
            const filterControls = document.getElementById('filterControls');
            if (filterControls) {
                filterControls.style.display = 'none';
            }
            if (typeof updateShortcutHintsVisibility === 'function') {
                updateShortcutHintsVisibility();
            }
        }
    }

    // 加载对应数据
    switch(sectionName) {
        case 'review':
            // 只有在审核页面没有数据时才加载，避免切换页面时重置位置
            if (recordingsData.length === 0) {
                loadRecordings();
            } else {
                // 恢复显示当前记录（保持位置）
                displayCurrentRecord();
            }
            break;
        case 'apikeys':
            loadApiKeys();
            break;
        case 'dictionary':
            // 字典管理暂时只显示前端
            break;
    }
}

// 刷新所有数据
function refreshAllData() {
    // 显示刷新动画
    const refreshBtn = document.querySelector('.refresh-btn-title');
    if (refreshBtn) {
        refreshBtn.classList.add('spinning');
    }

    // 根据当前视图加载数据
    const loadDataPromises = [];

    if (currentView === 'list') {
        loadDataPromises.push(loadListView());
    } else {
        loadDataPromises.push(loadRecordings());
    }

    loadDataPromises.push(loadStats()); // 现在这个函数只更新数字，不会重新渲染

    // 刷新 Emilia 服务状态
    if (typeof checkEmiliaHealth === 'function') {
        loadDataPromises.push(checkEmiliaHealth());
    }

    // 只有当前在API管理页面时才加载API密钥
    if (currentSection === 'apikeys') {
        loadDataPromises.push(loadApiKeys());
    }

    Promise.all(loadDataPromises).then(() => {
        // 刷新完成后移除动画
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
            }
        }, 500);
    }).catch(error => {
        console.error('刷新数据失败:', error);
        // 即使出错也要移除动画
        setTimeout(() => {
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
            }
        }, 500);
    });
}

// 添加旋转动画
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// 状态筛选功能
function filterByStatus(status) {

    // 在切换状态前，确保关闭所有编辑模式
    exitAllEditModes();

    // 更新当前筛选状态
    currentStatusFilter = status;

    // 更新按钮状态
    const filterButtons = document.querySelectorAll('.status-filter-btn');
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        }
    });

    // 同步更新列表视图的筛选器下拉菜单
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        // 如果是"所有状态"，则设为空字符串
        statusFilter.value = status === 'all' ? '' : status;
    }

    // 清除搜索条件和搜索框
    currentSearchQuery = '';
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');
    if (searchInput) {
        searchInput.value = '';
    }
    if (searchContainer) {
        searchContainer.classList.remove('has-search');
    }

    // 保存详细视图状态（用于切换回列表视图时恢复）
    deviceViewActiveStatus = status;

    // 重置页码并重新加载录音数据（清除搜索条件）
    currentPage = 1;
    loadRecordings(status, '');
}

// 退出所有编辑模式的函数
function exitAllEditModes() {
    // 调用统一函数退出全文编辑模式
    if (typeof cancelFullTextEdit === 'function') {
        if (isEditingTeochew) {
            cancelFullTextEdit('teochew');
        }
        if (isEditingMandarin) {
            cancelFullTextEdit('mandarin');
        }
    }
    // 退出词块编辑模式
    if (typeof cancelMandarinChanges === 'function' && tmpMandarinText) {
        cancelMandarinChanges();
    }
    if (typeof cancelTeochewChanges === 'function' && tmpTeochewText) {
        cancelTeochewChanges();
    }
}

