// 键盘快捷键模块

// 键盘快捷键
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // 只在审核界面生效
        if (currentSection !== 'review' || recordingsData.length === 0) return;

        // 防止在输入框中触发
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (!document.getElementById('prevBtn').disabled) {
                    navigateRecord(-1);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (!document.getElementById('nextBtn').disabled) {
                    navigateRecord(1);
                }
                break;
            case ' ':
                e.preventDefault();
                if (typeof toggleAudio === 'function') {
                    toggleAudio();
                }
                break;
        }
    });
}