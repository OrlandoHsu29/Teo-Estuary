// 全局变量
let audioElement = null;
let audioFile = null;
let isPlaying = false;
let animationId = null;
let currentRotation = 0; // 当前旋转角度
let lastAnimationTime = 0; // 上一次动画更新时间

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
    playLight: null,
    trackNumber: null,
    currentTime: null,
    totalTime: null,
    statusText: null,
    playBtn: null,
    uploadBtn: null,
    submitBtn: null,
    audioFileInput: null,
    playIcon: null,
    pauseIcon: null
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化 DOM 元素
    initializeElements();

    // 创建背景动画
    createBackgroundAnimations();

    // 绑定事件
    bindEvents();

    // 初始化状态灯
    elements.powerLight.classList.add('active');
    elements.statusText.textContent = 'READY';
});

function initializeElements() {
    elements.vinylRecord = document.getElementById('vinylRecord');
    elements.tonearm = document.getElementById('tonearm');
    elements.powerLight = document.getElementById('powerLight');
    elements.playLight = document.getElementById('playLight');
    elements.trackNumber = document.getElementById('trackNumber');
    elements.currentTime = document.getElementById('currentTime');
    elements.totalTime = document.getElementById('totalTime');
    elements.statusText = document.getElementById('statusText');
    elements.playBtn = document.getElementById('playBtn');
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

    // 禁用播放和提交按钮
    elements.playBtn.disabled = true;
    elements.submitBtn.disabled = true;

    // 初始化音量显示
    updateVolumeUI(currentVolume);
}

function createBackgroundAnimations() {
    // 创建漂浮粒子
    const particlesContainer = document.getElementById('musicParticles');
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'music-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = (Math.random() * 6) + 's';
        particle.style.animationDuration = (4 + Math.random() * 4) + 's';
        particlesContainer.appendChild(particle);
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
        alert('请选择音频文件（MP3、WAV、OGG格式）');
        return;
    }

    audioFile = file;

    // 显示加载状态
    elements.statusText.textContent = 'LOADING...';

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
        elements.submitBtn.disabled = false;
        elements.statusText.textContent = 'LOADED';

        // 显示拖拽提示箭头
        if (elements.dragHint) {
            elements.dragHint.classList.add('visible');
        }
    });

    audioElement.addEventListener('error', () => {
        elements.statusText.textContent = 'ERROR';
        alert('音频文件加载失败，请重试');
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
        elements.playLight.classList.remove('active');
        elements.statusText.textContent = 'PAUSED';
        elements.playIcon.style.display = 'block';
        elements.pauseIcon.style.display = 'none';

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
                elements.playLight.classList.add('active');
                elements.statusText.textContent = 'PLAYING';
                elements.playIcon.style.display = 'none';
                elements.pauseIcon.style.display = 'block';

                // 启动手动动画
                lastAnimationTime = performance.now();
                animateVinyl();
            })
            .catch(error => {
                console.error('播放失败:', error);
                alert('播放失败，请重试');
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

    // 应用旋转
    elements.vinylRecord.style.transform = `rotate(${currentRotation}deg)`;

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
    elements.playLight.classList.remove('active');
    elements.statusText.textContent = 'COMPLETED';
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';

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
        elements.vinylRecord.style.transform = 'rotate(0deg)';
    }
}

async function handleSubmit() {
    if (!audioFile) {
        alert('请先上传音频文件');
        return;
    }

    // 显示提交状态
    elements.statusText.textContent = 'SUBMITTING...';

    // 模拟延迟
    setTimeout(() => {
        elements.statusText.textContent = 'COMPLETED';
        alert('该功能还在开发中');
    }, 1000);
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
    elements.playLight.classList.remove('active');

    elements.trackNumber.textContent = '--';
    elements.currentTime.textContent = '0:00';
    elements.totalTime.textContent = '0:00';
    elements.statusText.textContent = 'READY';
    elements.playIcon.style.display = 'block';
    elements.pauseIcon.style.display = 'none';

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
    elements.vinylRecord.style.transform = `rotate(${newRotation}deg)`;

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
