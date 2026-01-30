// 导入数据管理

let selectedDictLogFile = null;
let selectedLogType = null; // 'changes' 或 'sync'

// 预览词典操作日志文件
function previewDictLogFile(type) {
    const fileInputId = type === 'changes' ? 'dictLogFile_changes' : 'dictLogFile_sync';
    const fileInput = document.getElementById(fileInputId);
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    selectedDictLogFile = file;
    selectedLogType = type;

    // 显示预览区域
    const previewDiv = document.getElementById('importPreview');
    const fileNameSpan = document.getElementById('previewFileName');

    const typeName = type === 'changes' ? '修改日志' : '同步日志';
    fileNameSpan.textContent = `已选择${typeName}: ${file.name} (${formatFileSize(file.size)})`;
    previewDiv.style.display = 'block';

    showToast('文件已选择，请点击"确认导入"完成导入', 'info');
}

// 导入词典操作日志
async function importDictLogs() {
    if (!selectedDictLogFile || !selectedLogType) {
        showToast('请先选择要导入的日志文件', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', selectedDictLogFile);
        formData.append('type', selectedLogType); // 传递日志类型

        showToast('正在导入...', 'info');

        const response = await fetch('/admin/api/import/dict-logs', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');

            // 重置选择
            const fileInputId = selectedLogType === 'changes' ? 'dictLogFile_changes' : 'dictLogFile_sync';
            document.getElementById(fileInputId).value = '';
            document.getElementById('importPreview').style.display = 'none';
            selectedDictLogFile = null;
            selectedLogType = null;

            // 如果有错误，显示详情
            if (data.errors && data.errors.length > 0) {
                console.warn('导入时的跳过条目:', data.errors);
            }
        } else {
            showToast(data.error || '导入失败', 'error');
        }

    } catch (error) {
        console.error('Import dict logs error:', error);
        showToast('导入失败，请重试', 'error');
    }
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
