// 音频播放器控制

// 音频缓存管理
const audioCache = {
    maxSize: 5, // 最多缓存5个音频文件
    cache: new Map(), // key: recordId, value: { url, timestamp }

    add(recordId, url) {
        // 如果缓存已满，删除最旧的缓存
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(recordId, { url, timestamp: Date.now() });
    },

    get(recordId) {
        const cached = this.cache.get(recordId);
        if (cached) {
            // 更新访问时间
            cached.timestamp = Date.now();
            return cached.url;
        }
        return null;
    },

    clear() {
        this.cache.clear();
    },

    // 预加载下一首（如果有缓存的话）
    preloadNext(nextRecordId, nextUrl) {
        if (this.cache.size < this.maxSize && !this.cache.has(nextRecordId)) {
            // 静默创建一个audio元素来预加载
            const tempAudio = new Audio();
            tempAudio.src = nextUrl;
            tempAudio.preload = 'auto';

            tempAudio.addEventListener('canplay', () => {
                this.add(nextRecordId, nextUrl);
                // 清理临时audio元素
                tempAudio.src = '';
            }, { once: true });

            tempAudio.addEventListener('error', () => {
                // 预加载失败，不影响主流程
                tempAudio.src = '';
            }, { once: true });
        }
    }
};

// 音频播放器控制 - 懒加载实现
function toggleAudio() {
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = document.getElementById('playIcon');

    if (!audioPlayer || !playPauseBtn) return;

    if (audioPlayer.paused) {
        // 懒加载：只有播放时才开始下载音频
        if (!audioPlayer.src || audioPlayer.src === '') {
            const recordId = audioPlayer.dataset.recordId;
            const audioUrl = audioPlayer.dataset.audioUrl;

            if (!recordId || !audioUrl) {
                showToast('音频文件不可用', 'warning');
                return;
            }

            // 显示加载状态
            if (playIcon) {
                playIcon.className = 'fas fa-spinner fa-spin';
            }

            // 测试音频URL是否可访问
            fetch(audioUrl, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        audioPlayer.src = audioUrl;

                        // 添加到缓存（使用原始URL）
                        audioCache.add(recordId, audioUrl);

                        // 音频加载完成后自动播放
                        const handleCanPlay = () => {
                            audioPlayer.removeEventListener('canplay', handleCanPlay);
                            audioPlayer.removeEventListener('error', handleError);

                            audioPlayer.play().then(() => {
                                if (playIcon) {
                                    playIcon.className = 'fas fa-pause';
                                }
                                // 显示音频播放器
                                audioPlayer.style.display = 'block';
                            }).catch(error => {
                                console.error('Audio play failed:', error);
                                if (playIcon) {
                                    playIcon.className = 'fas fa-play';
                                }
                            });
                        };

                        const handleError = (error) => {
                            audioPlayer.removeEventListener('canplay', handleCanPlay);
                            audioPlayer.removeEventListener('error', handleError);
                            console.error('Audio loading error:', error);
                            console.error('Audio error:', audioPlayer.error);

                            // 显示更详细的错误信息
                            let errorMessage = '音频加载失败';
                            if (audioPlayer.error) {
                                switch (audioPlayer.error.code) {
                                    case audioPlayer.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                                        errorMessage = '音频格式不支持';
                                        break;
                                    case audioPlayer.error.MEDIA_ERR_NETWORK:
                                        errorMessage = '网络错误，请检查连接';
                                        break;
                                    case audioPlayer.error.MEDIA_ERR_DECODE:
                                        errorMessage = '音频解码失败';
                                        break;
                                    default:
                                        errorMessage = `音频加载失败 (${audioPlayer.error.code})`;
                                }
                            }

                            showToast(errorMessage, 'error');
                            if (playIcon) {
                                playIcon.className = 'fas fa-play';
                            }
                        };

                        audioPlayer.addEventListener('canplay', handleCanPlay, { once: true });
                        audioPlayer.addEventListener('error', handleError, { once: true });

                        // 手动触发音频加载
                        audioPlayer.load();
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                })
                .catch(error => {
                    console.error('Audio URL accessibility test failed:', error);
                    showToast('音频文件无法访问', 'error');
                    if (playIcon) {
                        playIcon.className = 'fas fa-play';
                    }
                    return;
                });

            // 预加载下一首音频
            preloadNextAudio();
        } else {
            // 音频已加载，检查URL是否正确
            const expectedUrl = audioPlayer.dataset.audioUrl;
            const currentSrc = audioPlayer.src;

            // 如果src不是我们期望的URL，重新设置
            if (!currentSrc.endsWith(expectedUrl) || audioPlayer.readyState === 0) {
                audioPlayer.src = expectedUrl;
                audioPlayer.load(); // 重新加载

                // 等待加载完成后播放
                const handleCanPlay = () => {
                    audioPlayer.removeEventListener('canplay', handleCanPlay);
                    audioPlayer.play().then(() => {
                        if (playIcon) {
                            playIcon.className = 'fas fa-pause';
                        }
                    }).catch(error => {
                        console.error('Audio play failed after reload:', error);
                        showToast('播放失败', 'error');
                        if (playIcon) {
                            playIcon.className = 'fas fa-play';
                        }
                    });
                };

                audioPlayer.addEventListener('canplay', handleCanPlay, { once: true });
            } else {
                // src正确，直接播放
                audioPlayer.play().catch(error => {
                    console.error('Audio play failed:', error);
                    showToast('播放失败', 'error');
                    if (playIcon) {
                        playIcon.className = 'fas fa-play';
                    }
                });
                if (playIcon) {
                    playIcon.className = 'fas fa-pause';
                }
            }
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
        }
        // 始终显示进度条容器，不隐藏
        screenProgress.style.display = 'block';
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

// 预加载下一首音频
function preloadNextAudio() {
    // 获取下一首记录的信息
    if (recordingsData.length === 0 || currentRecordIndex >= recordingsData.length - 1) {
        return; // 没有下一首
    }

    const nextRecord = recordingsData[currentRecordIndex + 1];
    if (!nextRecord || !nextRecord.file_path) {
        return; // 下一首没有音频
    }

    const nextUrl = `/admin/api/download/${nextRecord.id}?download=false`;
    audioCache.preloadNext(nextRecord.id.toString(), nextUrl);
}