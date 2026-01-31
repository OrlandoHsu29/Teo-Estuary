// 导入数据管理

let selectedDictLogFile = null;
let selectedLogType = null; // 'changes' 或 'sync'

let selectedTranslationDictFile = null;
let selectedDatabaseFile = null;

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

    // 隐藏描述和原始上传按钮
    document.getElementById('dictLogDescription').style.display = 'none';
    document.getElementById('dictLogUploadButtons').style.display = 'none';

    // 显示预览区域
    const previewDiv = document.getElementById('importPreview');
    const fileNameSpan = document.getElementById('previewFileName');

    const typeName = type === 'changes' ? '修改日志' : '同步日志';
    fileNameSpan.textContent = `已选择${typeName}: ${file.name} (${formatFileSize(file.size)})`;
    previewDiv.style.display = 'block';

    // 隐藏不需要的重新上传按钮
    const reuploadButtons = document.querySelectorAll('.dictLog-reupload');
    reuploadButtons.forEach(btn => {
        btn.style.display = 'none';
    });
    // 显示对应的重新上传按钮
    if (type === 'changes') {
        reuploadButtons[0].style.display = 'inline-flex';
    } else {
        reuploadButtons[1].style.display = 'inline-flex';
    }

    // 重置导入模式为增量追加
    document.querySelector('input[name="importMode"][value="append"]').checked = true;

    showToast('文件已选择，请选择导入模式后点击"确认导入"', 'info');
}

// 导入词典操作日志
async function importDictLogs() {
    if (!selectedDictLogFile || !selectedLogType) {
        showToast('请先选择要导入的日志文件', 'error');
        return;
    }

    // 获取选择的导入模式
    const importMode = document.querySelector('input[name="importMode"]:checked').value;

    try {
        const formData = new FormData();
        formData.append('file', selectedDictLogFile);
        formData.append('type', selectedLogType); // 传递日志类型
        formData.append('mode', importMode); // 传递导入模式：append 或 overwrite

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

            // 恢复描述和原始上传按钮
            document.getElementById('dictLogDescription').style.display = 'block';
            document.getElementById('dictLogUploadButtons').style.display = 'flex';

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

// 预览翻译词典数据库文件
function previewTranslationDictFile() {
    const fileInput = document.getElementById('translationDictFile');
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    selectedTranslationDictFile = file;

    // 隐藏描述和原始上传按钮
    document.getElementById('translationDictDescription').style.display = 'none';
    document.getElementById('translationDictUploadButton').style.display = 'none';

    // 显示预览区域
    const previewDiv = document.getElementById('translationDictPreview');
    const fileNameSpan = document.getElementById('translationDictFileName');

    fileNameSpan.textContent = `已选择翻译词典: ${file.name} (${formatFileSize(file.size)})`;
    previewDiv.style.display = 'block';

    // 重置导入模式为增量追加
    document.querySelector('input[name="translationDictImportMode"][value="append"]').checked = true;

    showToast('文件已选择，请选择导入模式后点击"确认导入"', 'info');
}

// 导入翻译词典数据库
async function importTranslationDict() {
    if (!selectedTranslationDictFile) {
        showToast('请先选择要导入的翻译词典JSON文件', 'error');
        return;
    }

    // 获取选择的导入模式
    const importMode = document.querySelector('input[name="translationDictImportMode"]:checked').value;

    try {
        const formData = new FormData();
        formData.append('file', selectedTranslationDictFile);
        formData.append('mode', importMode); // 传递导入模式：append 或 overwrite

        showToast('正在导入翻译词典...', 'info');

        const response = await fetch('/admin/api/import/translation-dict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');

            // 重置选择
            document.getElementById('translationDictFile').value = '';
            document.getElementById('translationDictPreview').style.display = 'none';
            selectedTranslationDictFile = null;

            // 恢复描述和原始上传按钮
            document.getElementById('translationDictDescription').style.display = 'block';
            document.getElementById('translationDictUploadButton').style.display = 'block';
        } else {
            showToast(data.error || '导入失败', 'error');
        }

    } catch (error) {
        console.error('Import translation dict error:', error);
        showToast('导入失败，请重试', 'error');
    }
}

// 预览主数据库文件
function previewDatabaseFile() {
    const fileInput = document.getElementById('databaseFile');
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    selectedDatabaseFile = file;

    // 隐藏描述和原始上传按钮
    document.getElementById('databaseDescription').style.display = 'none';
    document.getElementById('databaseUploadButton').style.display = 'none';

    // 显示预览区域
    const previewDiv = document.getElementById('databasePreview');
    const fileNameSpan = document.getElementById('databaseFileName');

    fileNameSpan.textContent = `已选择主数据库: ${file.name} (${formatFileSize(file.size)})`;
    previewDiv.style.display = 'block';

    // 重置导入模式为增量追加
    document.querySelector('input[name="databaseImportMode"][value="append"]').checked = true;

    showToast('文件已选择，请选择导入模式后点击"确认导入"', 'info');
}

// 导入主数据库
async function importDatabase() {
    if (!selectedDatabaseFile) {
        showToast('请先选择要导入的主数据库JSON文件', 'error');
        return;
    }

    // 获取选择的导入模式
    const importMode = document.querySelector('input[name="databaseImportMode"]:checked').value;

    try {
        const formData = new FormData();
        formData.append('file', selectedDatabaseFile);
        formData.append('mode', importMode); // 传递导入模式：append 或 overwrite

        showToast('正在导入主数据库...', 'info');

        const response = await fetch('/admin/api/import/database', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');

            // 重置选择
            document.getElementById('databaseFile').value = '';
            document.getElementById('databasePreview').style.display = 'none';
            selectedDatabaseFile = null;

            // 恢复描述和原始上传按钮
            document.getElementById('databaseDescription').style.display = 'block';
            document.getElementById('databaseUploadButton').style.display = 'block';
        } else {
            showToast(data.error || '导入失败', 'error');
        }

    } catch (error) {
        console.error('Import database error:', error);
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
