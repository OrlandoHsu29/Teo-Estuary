// 导出数据管理模块

// 导出Jieba潮汕话适配版词库
async function exportJiebaDict() {
    try {
        showToast('正在准备下载...', 'info');

        // 创建一个隐藏的a标签来触发下载
        const link = document.createElement('a');
        link.href = '/admin/api/export/jieba-dict';
        link.download = 'jieba_cut.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('下载已开始', 'success');
    } catch (error) {
        console.error('导出Jieba词库失败:', error);
        showToast('导出失败', 'error');
    }
}

// 导出模型训练数据集
async function exportTrainDataset() {
    try {
        showToast('正在准备下载...', 'info');

        // 创建一个隐藏的a标签来触发下载
        const link = document.createElement('a');
        link.href = '/admin/api/export/train-dataset';
        link.download = 'train_dataset.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('下载已开始', 'success');
    } catch (error) {
        console.error('导出训练数据集失败:', error);
        showToast('导出失败', 'error');
    }
}

// 导出数据库SQL备份
async function exportDatabaseSQL() {
    try {
        showToast('正在生成SQL文件...', 'info');

        // 创建一个隐藏的a标签来触发下载
        const link = document.createElement('a');
        link.href = '/admin/api/export/database-sql';
        link.download = `teo_estuary_backup_${new Date().toISOString().slice(0,10)}.sql`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('SQL文件导出成功', 'success');
    } catch (error) {
        console.error('导出数据库SQL失败:', error);
        showToast('导出失败', 'error');
    }
}
