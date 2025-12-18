// 音频播放器控制

// 音频播放器控制
function toggleAudio() {
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');

    if (!audioPlayer || !playPauseBtn) return;

    if (audioPlayer.paused) {
        audioPlayer.play().catch(error => {
            console.error('Audio play failed:', error);
            showToast('播放失败', 'error');
        });
        if (playIcon) {
            playIcon.className = 'fas fa-pause';
        }
    } else {
        audioPlayer.pause();
        if (playIcon) {
            playIcon.className = 'fas fa-play';
        }
    }
}

// 设置音量
function setVolume(value) {
    const audioPlayer = document.getElementById('audioPlayer');
    const volumeBar = document.getElementById('volumeBar');

    if (audioPlayer) {
        audioPlayer.volume = value / 100;
    }

    if (volumeBar) {
        volumeBar.style.width = value + '%';
    }
}

// 更新状态灯
function updateStatusLight(index, active) {
    const lights = document.querySelectorAll('.indicator.light');
    if (lights[index]) {
        if (active) {
            lights[index].classList.add('active');
        } else {
            lights[index].classList.remove('active');
        }
    }
}

// 初始化音频播放器
function initAudioPlayer() {
    const audioPlayer = document.getElementById('audioPlayer');
    const volumeSlider = document.getElementById('volumeSlider');
    const screenProgress = document.getElementById('screenProgress');
    const progressFillScreen = document.getElementById('progressFillScreen');
    const thinProgressTrack = document.querySelector('.thin-progress-track');

    if (!audioPlayer) return;

    // 初始化音量
    audioPlayer.volume = 0.7;

    // 音量事件监听
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            audioPlayer.volume = e.target.value / 100;
        });
    }

    // 播放状态事件监听
    audioPlayer.addEventListener('play', () => {
        const playIcon = document.getElementById('playIcon');
        if (playIcon) {
            playIcon.className = 'fas fa-pause';
        }
    });

    audioPlayer.addEventListener('pause', () => {
        const playIcon = document.getElementById('playIcon');
        if (playIcon) {
            playIcon.className = 'fas fa-play';
        }
    });

    audioPlayer.addEventListener('ended', () => {
        const playIcon = document.getElementById('playIcon');
        if (playIcon) {
            playIcon.className = 'fas fa-play';
        }
        // 重置进度条
        if (progressFillScreen) {
            progressFillScreen.style.width = '0%';
        }
    });

    // 屏幕底部进度条事件监听
    if (screenProgress && progressFillScreen && thinProgressTrack) {
        audioPlayer.addEventListener('loadedmetadata', () => {
            // 音频加载完成时显示进度条
            if (audioPlayer.duration > 0) {
                screenProgress.style.display = 'block';
            }
        });

        audioPlayer.addEventListener('timeupdate', () => {
            updateScreenProgress(audioPlayer.currentTime, audioPlayer.duration);
        });

        // 点击进度条跳转播放位置
        thinProgressTrack.addEventListener('click', (e) => {
            const rect = thinProgressTrack.getBoundingClientRect();
            const progress = (e.clientX - rect.left) / rect.width;
            audioPlayer.currentTime = progress * audioPlayer.duration;
        });
    }
}

function updateTimeDisplay() {
    const audioPlayer = document.getElementById('audioPlayer');
    const timeDisplay = document.getElementById('timeDisplay');

    if (!audioPlayer || !timeDisplay) return;

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentTime = formatTime(audioPlayer.currentTime || 0);
    const duration = formatTime(audioPlayer.duration || 0);
    timeDisplay.textContent = `${currentTime} / ${duration}`;
}

// 更新屏幕进度条显示
function updateScreenProgress(currentTime, duration) {
    const screenProgress = document.getElementById('screenProgress');
    const progressFillScreen = document.getElementById('progressFillScreen');

    if (screenProgress && progressFillScreen) {
        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            progressFillScreen.style.width = percentage + '%';
            screenProgress.style.display = 'block';
        } else {
            screenProgress.style.display = 'none';
        }
    }
}

// 更新进度条显示（保留用于兼容性）
function updateBottomProgress(currentTime, duration) {
    const bottomProgress = document.getElementById('bottomProgress');
    const progressFillBottom = document.getElementById('progressFillBottom');
    const progressTime = document.getElementById('progressTime');

    if (bottomProgress && progressFillBottom && progressTime) {
        if (duration > 0) {
            const percentage = (currentTime / duration) * 100;
            progressFillBottom.style.width = percentage + '%';

            const formatTime = (time) => {
                const minutes = Math.floor(time / 60);
                const seconds = Math.floor(time % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            };

            progressTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
            bottomProgress.style.display = 'block';
        } else {
            bottomProgress.style.display = 'none';
        }
    }
}