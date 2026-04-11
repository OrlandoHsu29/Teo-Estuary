/**
 * 常用词列表功能
 * - 点击词块复制到剪贴板
 * - 拖拽排序
 */

// 复制词条到剪贴板
function cwCopyWord(teochewText) {
    if (!teochewText) return;
    copyToClipboard(teochewText);
}

// 初始化常用词列表
function initCommonWords() {
    const cwList = document.getElementById('cwList');
    if (!cwList) return;

    const items = cwList.querySelectorAll('.cw-item');

    items.forEach(item => {
        // 点击复制
        item.addEventListener('click', function(e) {
            if (this.classList.contains('dragging')) return;
            const teochew = this.getAttribute('data-teochew');
            cwCopyWord(teochew);
        });

        // 拖拽事件
        item.addEventListener('dragstart', handleCwDragStart);
        item.addEventListener('dragend', handleCwDragEnd);
        item.addEventListener('dragover', handleCwDragOver);
        item.addEventListener('dragleave', handleCwDragLeave);
        item.addEventListener('drop', handleCwDrop);
    });

    // 按钮事件（后续后端实现）
    const addBtn = document.getElementById('cwAddBtn');
    const deleteBtn = document.getElementById('cwDeleteBtn');

    if (addBtn) {
        addBtn.addEventListener('click', function() {
            showToast('新增词功能开发中', 'info');
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            showToast('删除词功能开发中', 'info');
        });
    }
}

// 拖拽状态
let cwDraggedItem = null;
let cwDraggedIndex = -1;

function handleCwDragStart(e) {
    cwDraggedItem = this;
    const parent = cwDraggedItem.parentNode;
    const allItems = Array.from(parent.children).filter(item => item.classList.contains('cw-item'));
    cwDraggedIndex = allItems.indexOf(cwDraggedItem);
    cwDraggedItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cwDraggedIndex);
}

function handleCwDragEnd(e) {
    if (cwDraggedItem) {
        cwDraggedItem.classList.remove('dragging');
    }
    // 移除所有拖拽指示器
    document.querySelectorAll('.cw-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    cwDraggedItem = null;
    cwDraggedIndex = -1;
}

function handleCwDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this === cwDraggedItem) return;

    // 移除其他指示器
    document.querySelectorAll('.cw-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    // 计算鼠标在元素的上半部分还是下半部分
    const rect = this.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
        this.classList.add('drag-over-top');
    } else {
        this.classList.add('drag-over-bottom');
    }
}

function handleCwDragLeave(e) {
    this.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleCwDrop(e) {
    e.preventDefault();

    if (this === cwDraggedItem) return;

    const parent = cwDraggedItem.parentNode;
    const allItems = Array.from(parent.children).filter(item => item.classList.contains('cw-item'));

    const rect = this.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const dropIndex = allItems.indexOf(this);

    // 计算实际插入位置
    let insertIndex = e.clientY < midpoint ? dropIndex : dropIndex + 1;

    // 如果是向后拖拽到自身后面，插入索引需要调整
    if (cwDraggedIndex < dropIndex && e.clientY >= midpoint) {
        insertIndex = dropIndex + 1;
    } else if (cwDraggedIndex > dropIndex && e.clientY < midpoint) {
        insertIndex = dropIndex;
    }

    // 从原始位置移除
    parent.removeChild(cwDraggedItem);

    // 插入到新位置
    if (insertIndex >= allItems.length) {
        parent.appendChild(cwDraggedItem);
    } else {
        // 找到目标位置对应的 cw-item
        const targetItem = allItems[insertIndex];
        parent.insertBefore(cwDraggedItem, targetItem);
    }

    // 重新初始化拖拽事件（因为 DOM 结构变了）
    initCommonWords();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initCommonWords);
