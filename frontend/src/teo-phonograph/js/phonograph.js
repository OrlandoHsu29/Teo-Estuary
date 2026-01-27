// 全局变量
let audioElement = null;
let audioFile = null;
let audioPlaylist = []; // 播放列表
let currentAudioIndex = 0; // 当前播放的音频索引
let isPlaying = false;
let animationId = null;
let currentRotation = 0; // 当前旋转角度
let lastAnimationTime = 0; // 上一次动画更新时间
let emiliaServiceHealthy = false; // Emilia服务健康状态
let isPlaylistVisible = false; // 播放列表是否可见

// 旋转拖拽相关变量
let isDragging = false;
let isRotating = false;
let startY = 0;
let startRotation = 0; // 开始拖拽时的角度
let rotateFrameId = null; // 旋转节流用
let volumeFrameId = null; // 音量节流用
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); // 移动端检测

// 音量控制相关变量
let isAdjustingVolume = false;
let currentVolume = 0.75;

// 进度条相关变量
let uploadProgressInterval = null;
let isUploading = false; // 是否正在上传
let uploadControllers = []; // 存储上传请求的AbortController

// DOM 元素
const elements = {
    vinylRecord: null,
    tonearm: null,
    powerLight: null,
    serverLight: null,
    trackNumber: null,
    currentTime: null,
    totalTime: null,
    statusText: null,
    playBtn: null,
    playBtnText: null,
    prevBtn: null,
    nextBtn: null,
    uploadBtn: null,
    submitBtn: null,
    audioFileInput: null,
    playIcon: null,
    pauseIcon: null,
    dragHint: null,
    volumeSlider: null,
    volumeFill: null,
    volumeKnob: null,
    labelText: null,
    toastUniversal: null,
    screenProgress: null,
    progressLabel: null,
    progressFill: null,
    progressPercent: null,
    playlistView: null,
    playlistItems: null,
    playerView: null,
    playlistToggleBtn: null,
    displayScreen: null
};

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化 DOM 元素
    initializeElements();

    // 绑定事件
    bindEvents();

    // 默认关机状态
    setPowerState(false);

    // 验证密钥并更新按钮状态
    if (window.KeyManager) {
        try {
            const result = await window.KeyManager.validateApiKey();
            window.KeyManager.updateKeyButtonState(result);

            // 根据验证结果设置设备电源状态
            if (result.valid === true) {
                // 密钥有效 - 开机
                setPowerState(true);
                // 开机时检查Emilia服务健康状态
                elements.statusText.textContent = '正在查询服务启动状态...';
                checkEmiliaHealth();
            }
            // 其他所有情况(密钥无效、已过期、不存在、网络错误等)都保持关机状态
        } catch (error) {
            console.error('密钥验证失败:', error);
            // 验证出错时，根据是否有密钥来设置状态
            const hasKey = window.KeyManager.getApiKeyStatus();
            if (!hasKey) {
                window.KeyManager.updateKeyButtonState({ exists: false });
            } else {
                // 有密钥但验证出错（可能是网络错误或密钥失效）- 显示红色
                window.KeyManager.updateKeyButtonState({ valid: false, exists: true, networkError: true });
            }
        }
    }
});

function initializeElements() {
    elements.vinylRecord = document.getElementById('vinylRecord');
    elements.tonearm = document.getElementById('tonearm');
    elements.powerLight = document.getElementById('powerLight');
    elements.serverLight = document.getElementById('serverLight');
    elements.trackNumber = document.getElementById('trackNumber');
    elements.currentTime = document.getElementById('currentTime');
    elements.totalTime = document.getElementById('totalTime');
    elements.statusText = document.getElementById('statusText');
    elements.playBtn = document.getElementById('playBtn');
    elements.playBtnText = elements.playBtn?.querySelector('.btn-text');
    elements.prevBtn = document.getElementById('prevBtn');
    elements.nextBtn = document.getElementById('nextBtn');
    elements.uploadBtn = document.getElementById('uploadBtn');
    elements.submitBtn = document.getElementById('submitBtn');
    elements.audioFileInput = document.getElementById('audioFileInput');
    elements.playIcon = document.querySelector('.play-icon');
    elements.pauseIcon = document.querySelector('.pause-icon');
    elements.dragHint = document.getElementById('dragHint');
    elements.volumeSlider = document.getElementById('volumeSlider');
    elements.volumeFill = document.getElementById('volumeFill');
    elements.volumeKnob = document.getElementById('volumeKnob');
    elements.labelText = document.getElementById('labelText');
    elements.toastUniversal = document.getElementById('toastUniversal');
    elements.screenProgress = document.getElementById('screenProgress');
    elements.progressLabel = document.getElementById('progressLabel');
    elements.progressFill = document.getElementById('progressFill');
    elements.progressPercent = document.getElementById('progressPercent');
    elements.playlistView = document.getElementById('playlistView');
    elements.playlistItems = document.getElementById('playlistItems');
    elements.playerView = document.getElementById('playerView');
    elements.playlistToggleBtn = document.getElementById('playlistToggleBtn');
    elements.displayScreen = document.getElementById('displayScreen');

    // 禁用播放控制按钮
    elements.playBtn.disabled = true;
    elements.prevBtn.disabled = true;
    elements.nextBtn.disabled = true;
    elements.playlistToggleBtn.disabled = true;
    elements.submitBtn.disabled = true;

    // 初始化音量显示
    updateVolumeUI(currentVolume);
}

function bindEvents() {
    // 上传按钮
    elements.uploadBtn.addEventListener('click', handleUpload);

    // 文件输入
    elements.audioFileInput.addEventListener('change', handleFileSelect);

    // 播放控制按钮
    elements.playBtn.addEventListener('click', handlePlayPause);
    elements.prevBtn.addEventListener('click', handlePrevTrack);
    elements.nextBtn.addEventListener('click', handleNextTrack);
    elements.playlistToggleBtn.addEventListener('click', togglePlaylist);

    // 提交按钮（根据状态决定是提交还是取消）
    elements.submitBtn.addEventListener('click', () => {
        if (isUploading) {
            cancelUpload();
        } else {
            handleSubmit();
        }
    });

    // 使用说明切换
    const manualToggle = document.getElementById('manualToggle');
    const manualContent = document.getElementById('manualContent');
    manualToggle.addEventListener('click', () => {
        manualContent.classList.toggle('expanded');
    });

    // 黑胶旋转拖拽事件
    elements.vinylRecord.addEventListener('mousedown', handleRotateStart);
    document.addEventListener('mousemove', handleRotateMove);
    document.addEventListener('mouseup', handleRotateEnd);

    // 触摸事件支持
    elements.vinylRecord.addEventListener('touchstart', handleRotateStart, { passive: false });
    document.addEventListener('touchmove', handleRotateMove, { passive: false });
    document.addEventListener('touchend', handleRotateEnd);

    // 音量控制事件
    elements.volumeSlider.addEventListener('mousedown', handleVolumeStart);
    elements.volumeKnob.addEventListener('mousedown', handleVolumeStart);
    document.addEventListener('mousemove', handleVolumeMove);
    document.addEventListener('mouseup', handleVolumeEnd);
}

// 上一个音频
function handlePrevTrack() {
    if (audioPlaylist.length === 0) return;
    const newIndex = currentAudioIndex - 1;
    if (newIndex >= 0) {
        loadAudioByIndex(newIndex);
    }
}

// 下一个音频
function handleNextTrack() {
    if (audioPlaylist.length === 0) return;
    const newIndex = currentAudioIndex + 1;
    if (newIndex < audioPlaylist.length) {
        loadAudioByIndex(newIndex);
    }
}

function handleUpload() {
    elements.audioFileInput.click();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // 检查文件数量
    if (files.length > 10) {
        showToast('最多只能上传10个音频文件', 'warning');
        return;
    }

    // 检查文件类型
    const invalidFiles = files.filter(file => !file.type.startsWith('audio/'));
    if (invalidFiles.length > 0) {
        showToast('请选择音频文件（MP3、WAV、OGG格式）', 'error');
        return;
    }

    // 清空之前的播放列表
    audioPlaylist = [];
    currentAudioIndex = 0;

    // 显示加载状态
    elements.statusText.textContent = `正在加载 ${files.length} 个文件...`;

    // 加载所有音频文件到播放列表
    files.forEach((file, index) => {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // 移除文件扩展名
        audioPlaylist.push({
            file: file,
            name: fileName,
            url: URL.createObjectURL(file)
        });
    });

    // 加载第一个音频
    loadAudioByIndex(0);

    // 更新播放列表UI
    updatePlaylistUI();

    // 启用/禁用相关按钮
    updateNavigationButtons();

    showToast(`已加载 ${files.length} 个音频文件`, 'success');
}

// 更新导航按钮状态
function updateNavigationButtons() {
    const hasMultipleFiles = audioPlaylist.length > 1;

    // 启用播放按钮
    elements.playBtn.disabled = false;
    // 根据Emilia服务状态决定是否启用提交按钮
    elements.submitBtn.disabled = !emiliaServiceHealthy;

    // 播放列表按钮始终启用（只要有音频）
    elements.playlistToggleBtn.disabled = false;

    // 启用/禁用翻页按钮
    if (hasMultipleFiles) {
        elements.prevBtn.disabled = false;
        elements.nextBtn.disabled = false;
    } else {
        elements.prevBtn.disabled = true;
        elements.nextBtn.disabled = true;
    }
}

// 加载指定索引的音频
function loadAudioByIndex(index) {
    if (index < 0 || index >= audioPlaylist.length) return;

    currentAudioIndex = index;
    const audioData = audioPlaylist[index];

    // 停止当前播放
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }

    // 重置播放状态
    isPlaying = false;
    currentRotation = 0;

    // 停止动画
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 重置黑胶旋转角度
    if (elements.vinylRecord) {
        elements.vinylRecord.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }

    // 重置tonearm位置
    if (elements.tonearm) {
        elements.tonearm.querySelector('.tonearm-arm').classList.remove('playing');
    }

    // 更新播放/暂停按钮图标
    if (elements.playIcon && elements.pauseIcon) {
        elements.playIcon.style.display = 'block';
        elements.pauseIcon.style.display = 'none';
    }

    // 创建新的音频元素
    audioElement = new Audio();
    audioElement.src = audioData.url;
    audioElement.volume = currentVolume;

    // 更新黑胶标签显示文件名（最多显示5个字符，超出加...）
    const displayName = audioData.name.length > 5
        ? audioData.name.substring(0, 5) + '...'
        : audioData.name;
    elements.labelText.textContent = displayName;
    elements.labelText.title = audioData.name; // 悬停显示完整名称

    // 显示加载状态
    elements.statusText.textContent = '加载中...';

    audioElement.addEventListener('loadedmetadata', () => {
        elements.totalTime.textContent = formatTime(audioElement.duration);

        // 更新track info显示（单个或多个音频）
        if (audioPlaylist.length > 1) {
            elements.trackNumber.textContent = `${String(index + 1).padStart(2, '0')} / ${String(audioPlaylist.length).padStart(2, '0')}`;
        } else {
            elements.trackNumber.textContent = String(index + 1).padStart(2, '0');
        }

        elements.statusText.textContent = '准备就绪';

        // 显示拖拽提示箭头
        if (elements.dragHint) {
            elements.dragHint.classList.add('visible');
        }

        // 更新播放列表的高亮状态
        updatePlaylistUI();
    });

    audioElement.addEventListener('error', () => {
        elements.statusText.textContent = 'ERROR';
        showToast('音频文件加载失败，请重试', 'error');
    });

    audioElement.addEventListener('timeupdate', updateProgress);
    audioElement.addEventListener('ended', handleAudioEnded);
}

// 更新播放列表UI
function updatePlaylistUI() {
    if (!elements.playlistItems) return;

    elements.playlistItems.innerHTML = '';

    audioPlaylist.forEach((audioData, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentAudioIndex) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <span class="playlist-item-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="playlist-item-title" title="${audioData.name}">${audioData.name}</span>
        `;

        item.addEventListener('click', () => {
            loadAudioByIndex(index);
            // 延迟返回播放器视图，让用户看到点击效果
            setTimeout(() => {
                hidePlaylist();
            }, 150);
        });

        elements.playlistItems.appendChild(item);
    });
}

// 切换播放列表视图
function togglePlaylist() {
    if (isPlaylistVisible) {
        hidePlaylist();
    } else {
        showPlaylist();
    }
}

// 显示播放列表视图（带滑动动画）
function showPlaylist() {
    if (!elements.playlistView || !elements.playerView) return;

    isPlaylistVisible = true;
    elements.playlistView.style.display = 'flex';
    elements.playlistView.classList.add('active');
    elements.playerView.classList.add('hidden');

    // 更新播放列表的高亮状态
    updatePlaylistUI();
}

// 隐藏播放列表视图（带渐隐动画）
function hidePlaylist() {
    if (!elements.playlistView || !elements.playerView) return;

    isPlaylistVisible = false;
    elements.playlistView.classList.remove('active');
    elements.playerView.classList.remove('hidden');

    // 等待动画完成后再隐藏元素
    setTimeout(() => {
        if (!isPlaylistVisible) {
            elements.playlistView.style.display = 'none';
        }
    }, 300); // 与CSS动画时长一致
}

// 保留旧函数名以兼容
function showPlaylistView() {
    showPlaylist();
}

// 显示播放器视图
function showPlayerView() {
    hidePlaylist();
}

function handlePlayPause() {
    if (!audioElement) return;

    if (isPlaying) {
        // 先停止动画帧，防止暂停后再执行一次旋转
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        // 暂停
        audioElement.pause();
        isPlaying = false;
        elements.vinylRecord.classList.remove('playing');
        document.querySelector('.tonearm-arm').classList.remove('playing');
        elements.statusText.textContent = '已暂停';
        elements.playIcon.style.display = 'block';
        elements.pauseIcon.style.display = 'none';

        // 更新按钮文本为"播放"
        if (elements.playBtnText) {
            elements.playBtnText.textContent = '播放';
        }
    } else {
        // 播放
        audioElement.play()
            .then(() => {
                isPlaying = true;
                document.querySelector('.tonearm-arm').classList.add('playing');
                elements.statusText.textContent = '正在播放';
                elements.playIcon.style.display = 'none';
                elements.pauseIcon.style.display = 'block';

                // 更新按钮文本为"暂停"
                if (elements.playBtnText) {
                    elements.playBtnText.textContent = '暂停';
                }

                // 启动手动动画
                lastAnimationTime = performance.now();
                animateVinyl();
            })
            .catch(error => {
                console.error('播放失败:', error);
                showToast('播放失败，请重试', 'error');
            });
    }
}

// 手动控制黑胶旋转动画
function animateVinyl() {
    if (!isPlaying) return;

    const now = performance.now();
    const deltaTime = now - lastAnimationTime;
    lastAnimationTime = now;

    // 每秒旋转60度（6秒一圈）
    const rotationSpeed = 60; // 度/秒
    currentRotation += (rotationSpeed * deltaTime) / 1000;

    // 应用旋转（保持居中）
    // 移动端优化：使用整数角度减少重绘
    const displayRotation = isMobile ? Math.round(currentRotation) : currentRotation;
    elements.vinylRecord.style.transform = `translate(-50%, -50%) rotate(${displayRotation}deg)`;

    // 继续动画
    animationId = requestAnimationFrame(animateVinyl);
}

function updateProgress() {
    if (!audioElement) return;

    const current = audioElement.currentTime;
    elements.currentTime.textContent = formatTime(current);
}

function handleAudioEnded() {
    isPlaying = false;
    elements.vinylRecord.classList.remove('playing');
    document.querySelector('.tonearm-arm').classList.remove('playing');
    elements.statusText.textContent = '播放完成';
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';

    // 更新按钮文本为"播放"
    if (elements.playBtnText) {
        elements.playBtnText.textContent = '播放';
    }

    // 停止手动动画
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 重置到开头
    if (audioElement) {
        audioElement.currentTime = 0;
        elements.currentTime.textContent = '0:00';
        currentRotation = 0;
        elements.vinylRecord.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }
}

async function handleSubmit() {
    if (audioPlaylist.length === 0) {
        showToast('请先上传音频文件', 'warning');
        return;
    }

    // 检查 Emilia 服务状态
    if (!emiliaServiceHealthy) {
        showToast('Emilia服务未启动，无法提交', 'error');
        elements.statusText.textContent = '服务未启动';
        // 重新查询服务状态
        checkEmiliaHealth();
        return;
    }

    // 检查 API key
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        showToast('请先配置 API 密钥', 'error');
        elements.statusText.textContent = 'NEED KEY';
        KeyManager.goToKeyConfig();
        return;
    }

    // 显示提交状态和进度条
    isUploading = true;
    uploadControllers = []; // 清空之前的controllers
    elements.submitBtn.disabled = false;
    elements.submitBtn.classList.add('cancel-mode');

    // 更新按钮文本为"取消"
    const submitBtnText = elements.submitBtn.querySelector('.btn-text');
    if (submitBtnText) {
        submitBtnText.textContent = '取消';
    }

    // 显示进度条，隐藏status-text
    if (elements.statusText) {
        elements.statusText.style.display = 'none';
    }
    if (elements.screenProgress) {
        elements.screenProgress.style.display = 'flex';
        elements.progressLabel.textContent = '正在上传...';
        elements.progressFill.style.width = '0%';
        elements.progressPercent.textContent = '0%';
    }

    let successCount = 0;
    let failedCount = 0;
    const totalFiles = audioPlaylist.length;
    const results = [];

    try {
        // 逐个上传文件
        for (let i = 0; i < audioPlaylist.length; i++) {
            // 检查是否被取消
            if (!isUploading) {
                console.log('Upload cancelled by user');
                elements.progressLabel.textContent = '已取消';

                // 隐藏进度条
                if (elements.screenProgress) {
                    elements.screenProgress.style.display = 'none';
                }

                // 恢复status-text显示
                setTimeout(() => {
                    if (elements.statusText) {
                        elements.statusText.style.display = 'block';
                        elements.statusText.textContent = '上传已取消';
                    }
                }, 100);

                showToast('上传已取消', 'warning');
                resetSubmitButton();
                return;
            }

            const audioData = audioPlaylist[i];

            // 更新进度标签
            elements.progressLabel.textContent = `正在上传...`;

            // 创建 FormData，单个上传
            const formData = new FormData();
            formData.append('audio', audioData.file);

            // 添加超时控制（单个文件3分钟超时）
            const controller = new AbortController();
            uploadControllers.push(controller); // 存储controller以便取消
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟

            try {
                const response = await fetch(`${KeyManager.API_BASE_URL}/api/upload-material`, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': apiKey
                    },
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // 检查是否被取消
                if (!isUploading) {
                    console.log('Upload cancelled after request completed');
                    break; // 退出循环
                }

                console.log(`Upload file ${i + 1}/${totalFiles} response status:`, response.status);

                // 处理401/403未授权错误
                if (response.status === 401 || response.status === 403) {
                    showToast('密钥已失效，请重新配置', 'error');

                    // 立即隐藏进度条
                    if (elements.screenProgress) {
                        elements.screenProgress.style.display = 'none';
                    }

                    // 恢复status-text显示
                    setTimeout(() => {
                        if (elements.statusText) {
                            elements.statusText.style.display = 'block';
                            elements.statusText.textContent = '密钥已失效';
                        }
                    }, 100);

                    resetSubmitButton();
                    return;
                }

                const result = await response.json();

                if (response.ok && result.success) {
                    successCount++;
                    results.push({
                        filename: audioData.file.name,
                        success: true
                    });
                } else {
                    failedCount++;
                    results.push({
                        filename: audioData.file.name,
                        success: false,
                        error: result.error
                    });
                }

                // 更新进度条
                const progress = ((i + 1) / totalFiles) * 100;
                if (elements.progressFill && elements.progressPercent) {
                    elements.progressFill.style.width = `${progress}%`;
                    elements.progressPercent.textContent = `${Math.round(progress)}%`;
                }

            } catch (error) {
                console.error(`Upload file ${i + 1}/${totalFiles} error:`, error);

                // 检查是否是用户取消
                if (!isUploading) {
                    console.log('Upload cancelled during error handling');
                    break; // 退出循环
                }

                failedCount++;
                results.push({
                    filename: audioData.file.name,
                    success: false,
                    error: error.name === 'AbortError' ? '上传超时或已取消' : error.message
                });

                // 更新进度条
                const progress = ((i + 1) / totalFiles) * 100;
                if (elements.progressFill && elements.progressPercent) {
                    elements.progressFill.style.width = `${progress}%`;
                    elements.progressPercent.textContent = `${Math.round(progress)}%`;
                }

                // 如果是超时错误，继续上传下一个
                if (error.name === 'AbortError') {
                    showToast(`文件 ${audioData.file.name} 上传超时，跳过`, 'error');
                }
            }
        }

        // 所有文件上传完成
        if (elements.progressLabel) {
            elements.progressLabel.textContent = '上传完成';
        }

        // 如果只有一个文件，播放完整的进度动画
        if (totalFiles === 1) {
            // 动画从当前进度推进到100%
            const currentProgress = 100;
            if (elements.progressFill && elements.progressPercent) {
                elements.progressFill.style.width = '100%';
                elements.progressPercent.textContent = '100%';
            }

            // 等待动画完成后隐藏进度条
            setTimeout(() => {
                if (elements.screenProgress) {
                    elements.screenProgress.style.display = 'none';
                }

                // 恢复status-text显示
                setTimeout(() => {
                    if (elements.statusText) {
                        elements.statusText.style.display = 'block';
                    }
                    if (successCount === totalFiles) {
                        elements.statusText.textContent = '音频提交完成';
                        showToast(`成功提交 ${successCount} 个音频文件`, 'success');
                    } else if (successCount > 0) {
                        elements.statusText.textContent = '部分提交完成';
                        showToast(`成功提交 ${successCount} 个，失败 ${failedCount} 个`, 'warning');
                    } else {
                        elements.statusText.textContent = '提交失败';
                        showToast(`上传失败：文件提交失败`, 'error');
                        checkEmiliaHealth();
                    }
                }, 100);
            }, 500); // 500ms动画时间
        } else {
            // 多个文件，立即隐藏进度条
            if (elements.screenProgress) {
                elements.screenProgress.style.display = 'none';
            }

            // 恢复status-text显示
            setTimeout(() => {
                if (elements.statusText) {
                    elements.statusText.style.display = 'block';
                }
                if (successCount === totalFiles) {
                    elements.statusText.textContent = '所有音频提交完成';
                    showToast(`成功提交 ${successCount} 个音频文件`, 'success');
                } else if (successCount > 0) {
                    elements.statusText.textContent = '部分音频提交完成';
                    showToast(`成功提交 ${successCount} 个，失败 ${failedCount} 个`, 'warning');
                } else {
                    elements.statusText.textContent = '提交失败';
                    showToast(`上传失败：文件均提交失败`, 'error');
                    checkEmiliaHealth();
                }
            }, 100);
        }

    } catch (error) {
        console.error('Upload error:', error);

        // 立即隐藏进度条
        if (elements.screenProgress) {
            elements.screenProgress.style.display = 'none';
        }

        // 恢复status-text显示
        setTimeout(() => {
            if (elements.statusText) {
                elements.statusText.style.display = 'block';
                elements.statusText.textContent = '提交失败';
            }
        }, 100);

        showToast(`上传失败：${error.message}`, 'error');
        checkEmiliaHealth();
    } finally {
        resetSubmitButton();
    }
}

// 重置提交按钮状态
function resetSubmitButton() {
    isUploading = false;
    uploadControllers = [];

    if (elements.submitBtn) {
        elements.submitBtn.classList.remove('cancel-mode');
        elements.submitBtn.disabled = true;

        // 恢复按钮文本为"提交"
        const submitBtnText = elements.submitBtn.querySelector('.btn-text');
        if (submitBtnText) {
            submitBtnText.textContent = '提交';
        }
    }
}

// 取消上传
function cancelUpload() {
    if (isUploading) {
        isUploading = false;

        // 取消所有正在进行的请求
        uploadControllers.forEach(controller => {
            if (controller) {
                controller.abort();
            }
        });
        uploadControllers = [];

        console.log('Upload cancelled');
        showToast('正在取消上传...', 'warning');
    }
}

function resetPlayer() {
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }

    audioFile = null;
    isPlaying = false;

    elements.vinylRecord.classList.remove('playing');
    elements.tonearm.classList.remove('playing');

    elements.trackNumber.textContent = '--';
    elements.currentTime.textContent = '0:00';
    elements.totalTime.textContent = '0:00';
    elements.statusText.textContent = '准备就绪';
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';

    // 重置播放按钮文本
    if (elements.playBtnText) {
        elements.playBtnText.textContent = '播放';
    }

    elements.playBtn.disabled = true;
    elements.submitBtn.disabled = true;

    elements.audioFileInput.value = '';
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !elements.playBtn.disabled) {
        e.preventDefault();
        handlePlayPause();
    }
});

// 旋转相关函数
function handleRotateStart(event) {
    if (!audioElement) return;

    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const rect = elements.vinylRecord.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const radius = rect.width / 2;

    // 只响应中心右侧一个半径宽度的垂直条带区域
    if (clientX < centerX || clientX > centerX + radius) return;

    event.preventDefault();

    // 先添加拖拽类禁用CSS动画，防止跳变
    elements.vinylRecord.classList.add('dragging');

    // 停止正在播放的动画
    if (isPlaying) {
        isRotating = true;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    isDragging = true;

    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    startY = clientY;
    startRotation = currentRotation; // 记录当前角度（在禁用transition后）

    // 隐藏提示箭头
    if (elements.dragHint) {
        elements.dragHint.classList.remove('visible');
    }

    // 暂停音频
    audioElement.pause();

    // 更改光标样式
    elements.vinylRecord.style.cursor = 'ns-resize';
}

function handleRotateMove(event) {
    if (!isDragging || !audioElement) return;

    event.preventDefault();

    // 移动端节流优化：使用 requestAnimationFrame
    if (isMobile) {
        if (rotateFrameId) return;
        rotateFrameId = requestAnimationFrame(() => {
            performRotate(event);
            rotateFrameId = null;
        });
    } else {
        performRotate(event);
    }
}

function performRotate(event) {
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const deltaY = clientY - startY; // 向下拖动为正

    // Y轴移动距离直接转换为角度：每100px = 360度（一圈）
    const pixelsPerRotation = 100;
    const angleDelta = (deltaY / pixelsPerRotation) * 360;

    // 计算新角度
    const newRotation = startRotation + angleDelta;
    currentRotation = newRotation;

    // 移动端优化：使用整数角度减少重绘
    const displayRotation = isMobile ? Math.round(newRotation) : newRotation;
    elements.vinylRecord.style.transform = `translate(-50%, -50%) rotate(${displayRotation}deg)`;

    // 将角度转换为播放进度（0-1）
    let normalizedRotation = newRotation % 360;
    if (normalizedRotation < 0) normalizedRotation += 360;

    const newProgress = normalizedRotation / 360;

    // 更新音频时间
    audioElement.currentTime = newProgress * audioElement.duration;

    // 更新显示时间
    elements.currentTime.textContent = formatTime(audioElement.currentTime);
}

function handleRotateEnd(event) {
    if (!isDragging) return;

    isDragging = false;

    // 如果之前在播放，恢复播放和手动动画（在移除dragging类之前）
    if (isRotating && isPlaying) {
        lastAnimationTime = performance.now();
        animateVinyl();
        audioElement.play();
        isRotating = false;
    }

    // 移除拖拽类（在恢复动画后）
    elements.vinylRecord.classList.remove('dragging');

    // 恢复光标样式
    elements.vinylRecord.style.cursor = 'grab';

    // 重新显示提示箭头
    if (elements.dragHint) {
        elements.dragHint.classList.add('visible');
    }
}

// 音量控制函数
function handleVolumeStart(event) {
    event.preventDefault();
    isAdjustingVolume = true;
    updateVolumeFromEvent(event);
}

function handleVolumeMove(event) {
    if (!isAdjustingVolume) return;
    event.preventDefault();

    // 移动端节流优化：使用 requestAnimationFrame
    if (isMobile) {
        if (volumeFrameId) return;
        volumeFrameId = requestAnimationFrame(() => {
            updateVolumeFromEvent(event);
            volumeFrameId = null;
        });
    } else {
        updateVolumeFromEvent(event);
    }
}

function handleVolumeEnd(event) {
    isAdjustingVolume = false;
}

function updateVolumeFromEvent(event) {
    const rect = elements.volumeSlider.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;

    // 计算音量（0-1）
    let volume = (clientX - rect.left) / rect.width;
    volume = Math.max(0, Math.min(1, volume));

    currentVolume = volume;
    updateVolumeUI(volume);

    // 更新音频音量
    if (audioElement) {
        audioElement.volume = volume;
    }
}

function updateVolumeUI(volume) {
    // 更新填充宽度
    elements.volumeFill.style.width = (volume * 100) + '%';
    // 更新按钮位置（按钮宽度14px，所以需要减去7px居中）
    elements.volumeKnob.style.left = `calc(${volume * 100}% - 7px)`;
}

// 返回主页函数
function goBack() {
    // 如果正在播放，先停止
    if (isPlaying) {
        audioElement.pause();
        isPlaying = false;
    }

    // 返回主页
    window.location.href = '../index.html';
}

// 通用 Toast 提示函数
function showToast(message, type = 'info') {
    if (!elements.toastUniversal) return;

    // 移除所有类型类
    elements.toastUniversal.classList.remove('success', 'error', 'warning', 'info', 'show');

    // 设置消息内容
    elements.toastUniversal.textContent = message;

    // 添加新类型类
    elements.toastUniversal.classList.add(type);

    // 触发动画
    setTimeout(() => {
        elements.toastUniversal.classList.add('show');
    }, 10);

    // 3秒后自动隐藏
    setTimeout(() => {
        elements.toastUniversal.classList.remove('show');
    }, 3000);
}

// 检查Emilia服务健康状态
async function checkEmiliaHealth() {
    // 发起查询前显示黄色（checking状态）
    elements.serverLight.classList.remove('active', 'error');
    elements.serverLight.classList.add('checking');

    try {
        const response = await fetch(`${KeyManager.API_BASE_URL}/teo_emilia_health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            // 检查status是否为healthy且emilia_service状态为ok
            const isHealthy = data.status === 'healthy' && data.emilia_service === 'ok';

            console.log('Emilia health check:', data, 'isHealthy:', isHealthy);
            updateEmiliaStatus(isHealthy);
        } else {
            // 接口返回错误状态
            console.log('Emilia health check failed with status:', response.status);
            updateEmiliaStatus(false);
        }
    } catch (error) {
        console.error('Emilia health check error:', error);
        // 请求失败，更新为不健康状态
        updateEmiliaStatus(false);
    }
}

// 更新Emilia服务状态UI - 现在更新 SERVER 灯
function updateEmiliaStatus(isHealthy) {
    // 使用 serverLight
    const lightIndicator = elements.serverLight;

    console.log('Updating Emilia status, isHealthy:', isHealthy, 'lightIndicator:', lightIndicator);

    if (isHealthy) {
        // 服务健康 - 绿色
        emiliaServiceHealthy = true;
        lightIndicator.classList.remove('error', 'checking');
        lightIndicator.classList.add('active');

        // 只有在没有上传文件时才显示READY状态
        if (!audioFile) {
            elements.statusText.textContent = '准备就绪';
        }

        // 启用提交按钮（如果有音频文件）
        if (audioFile) {
            elements.submitBtn.disabled = false;
        }
    } else {
        // 服务不健康 - 红色
        emiliaServiceHealthy = false;
        lightIndicator.classList.remove('active', 'checking');
        lightIndicator.classList.add('error');

        // 显示服务未启动状态
        if (!audioFile) {
            elements.statusText.textContent = '服务离线，音频暂时无法提交';
        }

        // 禁用提交按钮
        elements.submitBtn.disabled = true;
    }
}

// 设置电源状态
function setPowerState(powerOn) {
    if (!powerOn) {
        // 关机状态（API key不通过）
        document.body.classList.remove('power-on');
        // powerLight 亮红色（error状态）
        elements.powerLight.classList.remove('active');
        elements.powerLight.classList.add('error');
        // serverLight 暗色（移除所有状态）
        elements.serverLight.classList.remove('active', 'error', 'checking');
        elements.statusText.textContent = '请配置API密钥';
        elements.uploadBtn.disabled = true;
    } else {
        // 开机状态（API key通过）
        document.body.classList.add('power-on');
        // powerLight 亮绿色（active状态）
        elements.powerLight.classList.remove('error');
        elements.powerLight.classList.add('active');
        // serverLight 会在 checkEmiliaHealth 时更新状态
        elements.statusText.textContent = '准备就绪';
        elements.uploadBtn.disabled = false;
    }
}
