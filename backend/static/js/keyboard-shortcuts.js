// 键盘快捷键模块

// 键盘快捷键
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // 只在审核界面生效
        if (currentSection !== 'review' || recordingsData.length === 0) return;

        // 空格：播放/暂停
        if (e.key === ' ') {
            e.preventDefault();
            if (typeof toggleAudio === 'function') {
                toggleAudio();
            }
            return;
        }

        // Ctrl + 方向键：调整音频进度
        if (e.ctrlKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            seekAudio(-1);
        } else if (e.ctrlKey && e.key === 'ArrowRight') {
            e.preventDefault();
            seekAudio(1);
        }

        // Ctrl + 上/下箭头：翻译（全文编辑/词块编辑过程中禁用）
        if (!isEditingMandarin && !isEditingTeochew && !tmpMandarinText && !tmpTeochewText) {
            if (e.ctrlKey && e.key === 'ArrowUp') {
                e.preventDefault();
                const btn = document.getElementById('translateToMandarinBtn');
                if (btn && !btn.disabled) {
                    translateTo('mandarin');
                }
            } else if (e.ctrlKey && e.key === 'ArrowDown') {
                e.preventDefault();
                const btn = document.getElementById('translateToTeochewBtn');
                if (btn && !btn.disabled) {
                    translateTo('teochew');
                }
            }
        }

        // Ctrl + S：保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();

            // 全文编辑框处理
            const mandarinEdit = document.getElementById('mandarinTextEdit');
            const teochewEdit = document.getElementById('teochewTextEdit');

            if (mandarinEdit && mandarinEdit.style.display !== 'none') {
                handleSave('mandarin');
            } else if (teochewEdit && teochewEdit.style.display !== 'none') {
                handleSave('teochew');
            } else if (tmpMandarinText || tmpTeochewText) {
                // 词块编辑完成后有待保存内容，保存整个文本
                if (tmpMandarinText) handleSave('mandarin');
                else handleSave('teochew');
            } else if (isEditingMandarin || isEditingTeochew) {
                // 全文编辑模式
                if (isEditingMandarin) handleSave('mandarin');
                else handleSave('teochew');
            }
        }

        // Escape：取消
        if (e.key === 'Escape') {
            // 词块编辑的输入框自己处理Escape，不要干扰
            if (e.target.classList.contains('word-edit-input')) return;

            // 全文编辑模式取消
            if (isEditingMandarin) {
                e.preventDefault();
                handleCancel('mandarin');
            } else if (isEditingTeochew) {
                e.preventDefault();
                handleCancel('teochew');
            } else if (tmpMandarinText || tmpTeochewText) {
                // 词块编辑完成后有待保存内容，取消
                e.preventDefault();
                if (tmpMandarinText) handleCancel('mandarin');
                else handleCancel('teochew');
            }
        }
    }, { capture: true });  // 使用捕获阶段，优先于编辑器
}

// 调整音频进度
function seekAudio(seconds) {
    const audioPlayer = document.getElementById('audioPlayer');
    if (!audioPlayer || !audioPlayer.src || audioPlayer.src === '') return;

    const duration = audioPlayer.duration;
    if (!duration || !isFinite(duration)) return;

    const newTime = Math.max(0, Math.min(audioPlayer.currentTime + seconds, duration));
    audioPlayer.currentTime = newTime;
}

// 更新快捷键提示可见性
function updateShortcutHintsVisibility() {
    const hints = document.getElementById('shortcutHints');
    if (!hints) return;

    if (currentSection === 'review' && currentView === 'device') {
        hints.style.display = 'flex';
    } else {
        hints.style.display = 'none';
    }
}

// 更新筛选控件位置（相对于content-section居中）
function updateFilterControlsPosition() {
    const filterControls = document.getElementById('filterControls');
    const contentSection = document.getElementById('review-section');
    if (!filterControls || !contentSection) return;

    if (filterControls.style.display === 'none') return;

    const contentRect = contentSection.getBoundingClientRect();
    const left = contentRect.left + contentRect.width / 2;
    filterControls.style.left = left + 'px';
}

// 监听窗口大小变化
window.addEventListener('resize', updateFilterControlsPosition);
