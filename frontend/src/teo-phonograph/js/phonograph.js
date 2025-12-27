// 全局变量
let audioElement = null;
let audioFile = null;
let isPlaying = false;
let animationId = null;
let currentRotation = 0; // 当前旋转角度
let lastAnimationTime = 0; // 上一次动画更新时间
let emiliaServiceHealthy = false; // Emilia服务健康状态

// 旋转拖拽相关变量
let isDragging = false;
let isRotating = false;
let startY = 0;
let startRotation = 0; // 开始拖拽时的角度

// 音量控制相关变量
let isAdjustingVolume = false;
let currentVolume = 0.75;

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
    uploadBtn: null,
    submitBtn: null,
    audioFileInput: null,
    playIcon: null,
    pauseIcon: null,
    toastUniversal: null
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

    // 禁用播放和提交按钮
    elements.playBtn.disabled = true;
    elements.submitBtn.disabled = true;

    // 初始化音量显示
    updateVolumeUI(currentVolume);

    // 设置播放按钮默认文本
    if (elements.playBtnText) {
        elements.playBtnText.textContent = '播放';
    }
}

function bindEvents() {
    // 上传按钮
    elements.uploadBtn.addEventListener('click', handleUpload);

    // 文件输入
    elements.audioFileInput.addEventListener('change', handleFileSelect);

    // 播放按钮
    elements.playBtn.addEventListener('click', handlePlayPause);

    // 提交按钮
    elements.submitBtn.addEventListener('click', handleSubmit);

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

    // 音频事件
    if (elements.audioFileInput) {
        elements.audioFileInput.addEventListener('loadedmetadata', () => {
            if (audioElement) {
                elements.totalTime.textContent = formatTime(audioElement.duration);
            }
        });

        elements.audioFileInput.addEventListener('timeupdate', updateProgress);

        elements.audioFileInput.addEventListener('ended', handleAudioEnded);
    }
}

function handleUpload() {
    elements.audioFileInput.click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('audio/')) {
        showToast('请选择音频文件（MP3、WAV、OGG格式）', 'error');
        return;
    }

    audioFile = file;

    // 显示加载状态
    elements.statusText.textContent = '正在加载...';

    // 创建音频元素
    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }

    audioElement = new Audio();
    audioElement.src = URL.createObjectURL(file);
    audioElement.volume = currentVolume; // 设置初始音量

    // 更新黑胶标签显示文件名
    const fileName = file.name.replace(/\.[^/.]+$/, ''); // 移除文件扩展名
    elements.labelText.textContent = fileName;

    audioElement.addEventListener('loadedmetadata', () => {
        elements.totalTime.textContent = formatTime(audioElement.duration);
        elements.trackNumber.textContent = '01';
        elements.playBtn.disabled = false;
        // 根据Emilia服务状态决定是否启用提交按钮
        elements.submitBtn.disabled = !emiliaServiceHealthy;
        elements.statusText.textContent = '加载完成';

        // 显示拖拽提示箭头
        if (elements.dragHint) {
            elements.dragHint.classList.add('visible');
        }
    });

    audioElement.addEventListener('error', () => {
        elements.statusText.textContent = 'ERROR';
        showToast('音频文件加载失败，请重试', 'error');
    });

    audioElement.addEventListener('timeupdate', updateProgress);
    audioElement.addEventListener('ended', handleAudioEnded);
}

function handlePlayPause() {
    if (!audioElement) return;

    if (isPlaying) {
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

        // 停止手动动画
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
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

    // 每秒旋转180度（2秒一圈）
    const rotationSpeed = 180; // 度/秒
    currentRotation += (rotationSpeed * deltaTime) / 1000;

    // 应用旋转（保持居中）
    elements.vinylRecord.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;

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
    if (!audioFile) {
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

    // 显示提交状态
    elements.statusText.textContent = '正在提交...';
    elements.submitBtn.disabled = true;

    // 创建 FormData
    const formData = new FormData();
    formData.append('audio', audioFile);

    try {

        const response = await fetch(`${KeyManager.API_BASE_URL}/api/upload-material`, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey
            },
            body: formData
        });

        // 处理401/403未授权错误
        if (KeyManager && typeof KeyManager.handleApiResponse === 'function') {
            await KeyManager.handleApiResponse(response);
        }

        if (response.status === 401 || response.status === 403) {
            elements.statusText.textContent = '密钥已失效';
            elements.submitBtn.disabled = false;
            showToast('密钥已失效，请重新配置', 'error');
            return;
        }

        const result = await response.json();

        if (response.ok && result.success) {
            elements.statusText.textContent = '提交完成';
            showToast(`音频素材上传成功！文件ID: ${result.id}`, 'success');
        } else {
            elements.statusText.textContent = '提交失败';
            showToast(`上传失败：${result.error || '未知错误'}`, 'error');
            // 提交失败后重新查询服务状态
            checkEmiliaHealth();
        }
    } catch (error) {
        console.error('Upload error:', error);
        elements.statusText.textContent = '提交失败';
        showToast(`上传失败：${error.message}`, 'error');
        // 提交失败后重新查询服务状态
        checkEmiliaHealth();
    } finally {
        elements.submitBtn.disabled = false;
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
    isDragging = true;

    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    startY = clientY;
    startRotation = currentRotation; // 记录当前角度

    // 停止正在播放的动画
    if (isPlaying) {
        isRotating = true;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // 添加拖拽类，禁用CSS动画
    elements.vinylRecord.classList.add('dragging');

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

    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const deltaY = clientY - startY; // 向下拖动为正

    // Y轴移动距离直接转换为角度：每100px = 360度（一圈）
    const pixelsPerRotation = 100;
    const angleDelta = (deltaY / pixelsPerRotation) * 360;

    // 计算新角度
    const newRotation = startRotation + angleDelta;
    currentRotation = newRotation;
    elements.vinylRecord.style.transform = `translate(-50%, -50%) rotate(${newRotation}deg)`;

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

    // 移除拖拽类
    elements.vinylRecord.classList.remove('dragging');

    // 如果之前在播放，恢复播放和手动动画
    if (isRotating && isPlaying) {
        lastAnimationTime = performance.now();
        animateVinyl();
        audioElement.play();
        isRotating = false;
    }

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
    updateVolumeFromEvent(event);
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
