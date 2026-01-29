// API配置 - 已在 config.js 中定义
// 调试信息
console.log('API_BASE_URL:', API_BASE_URL);
console.log('当前页面URL:', window.location.href);

class DialectRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.audioUrl = null;
        this.stream = null;
        this.isRecording = false;
        this.currentText = '';
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.volumeCheckInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.javascriptNode = null;

        // 播放相关属性
        this.currentAudio = null;
        this.isPlaying = false;
        this.playbackTimer = null;

        // 录音时长跟踪
        this.recordingDuration = 0;
        this.isRecordingCompleted = false;

        // 播放进度跟踪
        this.playbackStartTime = 0;
        this.playbackProgressTimer = null;

        // 上传状态跟踪
        this.isUploading = false;
        this.uploadAbortController = null;

        // 录音状态跟踪
        this.isStartingRecording = false;

        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        // 获取所有DOM元素
        this.elements = {
            btnGetText: document.getElementById('btnGetText'),
            btnRecord: document.getElementById('btnRecord'),
            btnStop: document.getElementById('btnStop'),
            btnPlay: document.getElementById('btnPlay'),
            btnUpload: document.getElementById('btnUpload'),
            textDisplay: document.getElementById('textDisplay'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            timer: document.getElementById('timer'),
            progressFill: document.getElementById('progressFill'),
            toast: document.getElementById('toast'),
            volumeBars: document.querySelectorAll('.volume-bar')
        };
    }

    initEventListeners() {
        // 绑定按钮事件
        this.elements.btnGetText.addEventListener('click', () => this.getNewText());
        this.elements.btnRecord.addEventListener('click', this.startRecording.bind(this));
        this.elements.btnStop.addEventListener('click', () => this.stopRecording());
        this.elements.btnPlay.addEventListener('click', () => this.playRecording());
        this.elements.btnUpload.addEventListener('click', () => this.uploadRecording());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                if (this.isRecording) {
                    this.stopRecording();
                } else if (this.currentText) {
                    this.startRecording();
                }
            }
        });

        // 页面关闭时清理资源
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    async getNewText() {
        try {
            // 检查API密钥
            const apiKey = localStorage.getItem('apiKey');
            if (!apiKey) {
                showToast('请先配置API密钥', 'error');
                if (window.KeyManager) {
                    window.KeyManager.goToKeyConfig();
                }
                return;
            }

            // 禁用所有按钮并显示生成状态
            this.setAllButtonsDisabled(true);
            this.elements.textDisplay.textContent = '......';
            this.updateStatus('正在获取参考文本', 'processing');

            const response = await fetch(`${API_BASE_URL}/api/reference-text/random?count=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                }
            });

            // 处理401/403未授权错误
            if (window.KeyManager && typeof window.KeyManager.handleApiResponse === 'function') {
                await window.KeyManager.handleApiResponse(response);
            }

            if (!response.ok) {
                // 根据HTTP状态码处理不同错误
                if (response.status === 401 || response.status === 403) {
                    throw new Error('密钥已失效，请重新配置');
                } else if (response.status === 429) {
                    throw new Error('请求过于频繁，请稍后重试');
                } else {
                    throw new Error('获取新文本失败');
                }
            }

            const data = await response.json();

            // 检查返回的数据是否有效
            if (!data.success || !data.data || data.data.length === 0) {
                throw new Error('暂无可用的参考文本，请联系管理员添加');
            }

            this.currentText = data.data[0].discourse;
            this.elements.textDisplay.textContent = this.currentText;
            this.fullResetRecording(); // 使用完全重置

            // 在状态框显示提示信息
            this.updateStatus('已获取新文本', 'success');
            this.showTemporaryStatusMessages('开始录音后用潮汕话口语朗读文本(要口齿清晰！)','info');
        } catch (error) {
            console.error('获取文本失败:', error);
            const errorMessage = error.message || '获取新句子失败，请重试';
            showToast(errorMessage, 'error');
            this.updateStatus(errorMessage, 'error');
            this.elements.textDisplay.textContent = ''; // 清空显示屏
            // 注意：密钥失效的状态已经在handleApiResponse中处理，无需重复更新

        } finally {
            // 恢复按钮状态
            this.setAllButtonsDisabled(false);
            // 如果没有当前文本，显示默认提示
            if (!this.currentText) {
                this.elements.textDisplay.textContent = '点击「刷新」按钮获取跟读文本';
            }
        }
    }

    async startRecording() {
        // 防止重复点击和状态冲突
        if (this.isRecording || this.isStartingRecording) {
            showToast('正在录音或正在启动录音，请稍候...', 'warning');
            return;
        }

        if (!this.currentText) {
            showToast('请先获取要朗读的文本', 'warning');
            return;
        }

        // 设置启动录音状态
        this.isStartingRecording = true;

        try {
            // 禁用录音按钮，防止重复点击
            this.elements.btnRecord.disabled = true;

            // 获取麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            // 设置音频分析
            this.setupAudioAnalyser();

            // 配置录音
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            };

            // 检查浏览器支持的格式
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'audio/mp4';
                }
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.audioChunks = [];

            // 录音事件处理
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => this.processRecording();
            this.mediaRecorder.onerror = (event) => {
                console.error('录音错误:', event.error);
                showToast('录音出错，请重试', 'error');
                this.stopRecording();
            };

            // 开始录音
            this.mediaRecorder.start(100); // 每100ms收集一次数据
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // 重置录音状态和进度条
            this.recordingDuration = 0;
            this.isRecordingCompleted = false;
            this.elements.progressFill.style.background = ''; // 重置为默认蓝色
            this.elements.progressFill.style.width = '0%';

            // 重置启动状态（录音已成功开始）
            this.isStartingRecording = false;

            // 更新UI
            this.updateRecordingUI(true);
            this.startTimer();
            this.startVolumeMonitoring();

            this.updateStatus('录音中...', 'recording');

        } catch (error) {
            console.error('开始录音失败:', error);

            // 重置启动状态
            this.isStartingRecording = false;

            // 简化的错误处理
            let errorMessage = '录音失败，请检查麦克风权限和设备设置';

            // 针对权限问题的特殊提示
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = '请允许浏览器访问麦克风权限';
            }

            showToast(errorMessage, 'error');
            this.updateStatus('录音失败', 'error');
            this.elements.btnRecord.disabled = false;
        }
    }

    setupAudioAnalyser() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(this.stream);
        this.javascriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);

        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.fftSize = 1024;

        this.microphone.connect(this.analyser);
        this.analyser.connect(this.javascriptNode);
        this.javascriptNode.connect(this.audioContext.destination);

        this.javascriptNode.onaudioprocess = () => {
            const array = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(array);
            const values = array.reduce((a, b) => a + b, 0);
            const average = values / array.length;
            this.updateVolumeMeter(average);
        };
    }

    updateVolumeMeter(value) {
        const maxValue = 20; // 最大音量值
        const normalizedValue = Math.min(value / maxValue, 1);
        const activeBars = Math.ceil(normalizedValue * 5);

        this.elements.volumeBars.forEach((bar, index) => {
            if (index < activeBars) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        });
    }

    stopRecording() {
        if (!this.isRecording) return;

        try {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            this.isRecording = false;
            this.updateRecordingUI(false);

            // 保存录音时长并停止计时器
            const timerText = this.elements.timer.textContent;
            this.saveRecordingDuration(timerText);
            this.stopTimer();
            this.stopVolumeMonitoring();

            // 清理音频分析资源
            this.cleanupAudioAnalyser();

            this.updateStatus('录音完成', 'success');
        } catch (error) {
            console.error('停止录音失败:', error);
            showToast('停止录音时出错', 'error');
        }
    }

    cleanupAudioAnalyser() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.javascriptNode) {
            this.javascriptNode.disconnect();
            this.javascriptNode = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    processRecording() {
        if (this.audioChunks.length === 0) {
            showToast('录音数据为空', 'error');
            return;
        }

        this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioUrl = URL.createObjectURL(this.audioBlob);

        // 启用播放按钮
        this.elements.btnPlay.disabled = false;

        // 设置上传按钮状态（启用但不在上传中）
        this.setUploadButtonState(false);

        // 重置音量显示
        this.updateVolumeMeter(0);

        // 执行录音完成动画
        this.animateRecordingCompletion();
    }

    saveRecordingDuration(timerText) {
        // 解析时间文本 (MM:SS 格式)
        const parts = timerText.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            this.recordingDuration = minutes * 60 + seconds;
            this.isRecordingCompleted = true;
        }
    }

    animateRecordingCompletion() {
        // 清空进度条并设置为绿色
        this.elements.progressFill.style.width = '0%';
        this.elements.progressFill.style.background = '#00ff00'; // 绿色

        // 快速填充进度条到100% (缩短动画时间)
        setTimeout(() => {
            this.elements.progressFill.style.transition = 'width 0.5s ease-out'; // 从1s改为0.5s
            this.elements.progressFill.style.width = '100%';

            // 动画完成后移除过渡效果
            setTimeout(() => {
                this.elements.progressFill.style.transition = 'width 0.3s ease';
            }, 500); // 对应改为0.5s
        }, 100);
    }

    playRecording() {
        if (!this.audioUrl || this.isPlaying) return;

        // 停止当前播放的音频
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        this.currentAudio = new Audio(this.audioUrl);
        this.isPlaying = true;
        this.playbackStartTime = Date.now();

        // 重置进度条为播放状态
        this.elements.progressFill.style.width = '0%';
        this.elements.progressFill.style.background = '#FFD700'; // 黄色
        this.elements.timer.textContent = '00:00'; // 重置时间显示为0

        // 设置播放事件监听器
        this.currentAudio.addEventListener('loadedmetadata', () => {
            this.startUniformPlaybackProgress();
            this.updateStatus('正在播放', 'success');
        });

        this.currentAudio.addEventListener('ended', () => {
            this.stopPlayback();
        });

        this.currentAudio.addEventListener('error', (error) => {
            console.error('播放失败:', error);
            showToast('播放失败', 'error');
            this.stopPlayback();
        });

        // 开始播放
        this.currentAudio.play()
            .catch(error => {
                console.error('播放失败:', error);
                showToast('播放失败', 'error');
                this.stopPlayback();
            });

        // 更新UI状态
        this.elements.btnPlay.disabled = true;
        this.elements.btnRecord.disabled = true;
        this.elements.btnUpload.disabled = true;
    }

    startUniformPlaybackProgress() {
        // 停止之前的播放进度定时器
        if (this.playbackProgressTimer) {
            clearInterval(this.playbackProgressTimer);
        }

        // 匀速推进进度条，每秒更新一次
        this.playbackProgressTimer = setInterval(() => {
            if (this.isPlaying && this.recordingDuration > 0) {
                this.updateUniformPlaybackProgress();
            }
        }, 1000); // 每秒更新一次，与录音时保持一致
    }

    updateUniformPlaybackProgress() {
        if (!this.isPlaying || this.recordingDuration <= 0) return;

        // 计算播放开始后经过的时间
        const elapsedSeconds = Math.floor((Date.now() - this.playbackStartTime) / 1000);

        // 防止超过录制时长
        const displayTime = Math.min(elapsedSeconds, this.recordingDuration);

        // 更新时间显示（匀速递增）
        const minutes = Math.floor(displayTime / 60);
        const seconds = displayTime % 60;
        this.elements.timer.textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // 更新进度条（匀速推进）
        const progress = (displayTime / this.recordingDuration) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressFill.style.background = '#FFD700'; // 黄色

        // 如果播放时间达到录制时长，但音频还没结束，保持100%
        if (displayTime >= this.recordingDuration && this.currentAudio && !this.currentAudio.ended) {
            this.elements.progressFill.style.width = '100%';
        }
    }

    stopPlayback() {
        this.isPlaying = false;

        // 停止播放计时器
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }

        // 停止播放进度定时器
        if (this.playbackProgressTimer) {
            clearInterval(this.playbackProgressTimer);
            this.playbackProgressTimer = null;
        }

        // 停止音频
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }

        // 恢复UI状态
        this.elements.btnPlay.disabled = false;
        this.elements.btnRecord.disabled = false;
        this.elements.btnUpload.disabled = false;

        // 如果有录音完成，恢复为绿色并显示录制时长
        if (this.isRecordingCompleted) {
            this.elements.progressFill.style.background = '#00ff00'; // 绿色
            this.elements.progressFill.style.width = '100%'; // 保持100%

            // 显示录制时长
            const minutes = Math.floor(this.recordingDuration / 60);
            const seconds = this.recordingDuration % 60;
            this.elements.timer.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            // 没有录音时长时的默认状态
            this.elements.progressFill.style.background = '';
            this.elements.progressFill.style.width = '0%';
            this.elements.timer.textContent = '00:00';
        }

        this.updateStatus('播放完成', 'success');
    }

    animateUploadSuccess() {
        // 保存当前状态用于动画
        const currentRecordingDuration = this.recordingDuration;

        // 开始倒计时动画（1秒内完成）
        let countdownTime = currentRecordingDuration;
        const countdownStep = Math.ceil(currentRecordingDuration / 20); // 分20步，每步约50ms
        const countdownInterval = 1000 / 20; // 50ms间隔

        // 确保进度条在动画期间保持绿色
        this.elements.progressFill.style.background = '#00ff00'; // 绿色

        const countdownTimer = setInterval(() => {
            if (countdownTime > 0) {
                // 更新时间显示
                const minutes = Math.floor(countdownTime / 60);
                const seconds = countdownTime % 60;
                this.elements.timer.textContent =
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                // 更新进度条
                const progress = (countdownTime / currentRecordingDuration) * 100;
                this.elements.progressFill.style.width = `${progress}%`;

                countdownTime = Math.max(0, countdownTime - countdownStep);
            } else {
                // 动画完成
                clearInterval(countdownTimer);

                // 完全重置所有状态
                this.fullResetRecording();
                this.currentText = '';
                this.elements.textDisplay.textContent = '点击「刷新」按钮继续获取新句子';

                // 重置录音相关状态
                this.recordingDuration = 0;
                this.isRecordingCompleted = false;

                // 禁用录音按钮，等待获取新句子
                this.elements.btnRecord.disabled = true;
                this.elements.btnPlay.disabled = true;
                this.elements.btnUpload.disabled = true;
            }
        }, countdownInterval);
    }

    async uploadRecording() {
        // 检查是否正在上传中
        if (this.isUploading) {
            showToast('正在上传中，请稍候...', 'warning');
            return;
        }

        if (!this.audioBlob || !this.currentText) {
            showToast('没有可上传的录音', 'error');
            return;
        }

        try {
            // 设置上传状态
            this.isUploading = true;
            this.setUploadButtonState(); // 根据状态自动设置按钮

            // 检查API密钥
            const apiKey = localStorage.getItem('apiKey');
            if (!apiKey) {
                showToast('请先配置API密钥', 'error');
                if (window.KeyManager) {
                    window.KeyManager.goToKeyConfig();
                }
                return;
            }

            // 创建 AbortController 用于取消请求
            this.uploadAbortController = new AbortController();

            this.updateStatus('正在上传...', 'uploading');

            const formData = new FormData();
            formData.append('audio', this.audioBlob, 'recording.webm');
            formData.append('text', this.currentText);
            formData.append('upload_type', '0'); // 0: 录音上传
            formData.append('duration', this.recordingDuration); // 录音时长（秒）

            const response = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey
                },
                body: formData,
                signal: this.uploadAbortController.signal
            });

            // 处理401/403未授权错误
            if (window.KeyManager && typeof window.KeyManager.handleApiResponse === 'function') {
                await window.KeyManager.handleApiResponse(response);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '上传失败');
            }

            const result = await response.json();
            showToast(`录音上传成功！ID: ${result.id}`, 'success');
            this.updateStatus('上传成功', 'success');
            this.showTemporaryStatusMessages('继续录下一条音频吧~','info');

            // 执行上传成功动画
            this.animateUploadSuccess();

        } catch (error) {
            // 如果是用户取消的错误，不显示错误信息
            if (error.name !== 'AbortError') {
                console.error('上传失败:', error);
                showToast(`上传失败: ${error.message}`, 'error');
                this.updateStatus('上传失败', 'error');
            }
        } finally {
            // 重置上传状态
            this.isUploading = false;
            this.uploadAbortController = null;
            // 重新设置上传按钮状态
            this.setUploadButtonState();
        }
    }

    resetRecording() {
        // 停止正在进行的播放
        if (this.isPlaying) {
            this.stopPlayback();
        }

        // 清理音频资源
        if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
            this.audioUrl = null;
        }

        this.audioBlob = null;
        this.audioChunks = [];

        // 重置UI状态
        this.elements.btnPlay.disabled = true;
        this.elements.btnStop.disabled = true;
        // 只有在有文本时才启用录音按钮
        this.elements.btnRecord.disabled = !this.currentText;
        // 重置上传按钮状态
        this.setUploadButtonState(); // 根据状态自动设置按钮

        // 如果有录音完成状态，保持绿色和录制时长显示
        if (this.isRecordingCompleted) {
            this.elements.progressFill.style.background = '#00ff00'; // 绿色
            this.elements.progressFill.style.width = '100%'; // 保持100%

            // 显示录制时长
            const minutes = Math.floor(this.recordingDuration / 60);
            const seconds = this.recordingDuration % 60;
            this.elements.timer.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            // 没有录音时的默认状态
            this.elements.timer.textContent = '00:00';
            this.elements.progressFill.style.width = '0%';
            this.elements.progressFill.style.background = ''; // 重置进度条颜色
        }

        this.updateVolumeMeter(0);
    }

    // 完全重置所有状态（用于获取新文本时）
    fullResetRecording() {
        // 停止正在进行的播放
        if (this.isPlaying) {
            this.stopPlayback();
        }

        // 取消正在进行的上传
        if (this.isUploading && this.uploadAbortController) {
            this.uploadAbortController.abort();
        }

        // 清理音频资源
        if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
            this.audioUrl = null;
        }

        this.audioBlob = null;
        this.audioChunks = [];

        // 重置所有状态
        this.recordingDuration = 0;
        this.isRecordingCompleted = false;
        this.isUploading = false;
        this.uploadAbortController = null;
        this.isStartingRecording = false;

        // 重置UI状态
        this.setAllButtonsDisabled(false); // 使用统一的按钮状态管理
        this.elements.timer.textContent = '00:00';
        this.elements.progressFill.style.width = '0%';
        this.elements.progressFill.style.background = ''; // 重置进度条颜色
        this.updateVolumeMeter(0);

        // 重置上传按钮的视觉状态
        this.elements.btnUpload.classList.remove('uploading');
        this.elements.btnUpload.title = '上传录音';
    }

    updateRecordingUI(recording) {
        if (recording) {
            this.elements.btnRecord.disabled = true;
            this.elements.btnStop.disabled = false;
            this.elements.btnGetText.disabled = true;
            this.elements.btnPlay.disabled = true;
            this.elements.btnUpload.disabled = true;
            this.elements.statusDot.classList.add('recording');
        } else {
            this.elements.btnRecord.disabled = false;
            this.elements.btnStop.disabled = true;
            this.elements.btnGetText.disabled = false;
            this.elements.statusDot.classList.remove('recording');
        }
    }

    startTimer() {
        let seconds = 0;
        this.timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            this.elements.timer.textContent =
                `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            // 更新进度条（假设最长录音时间为60秒）
            const progress = Math.min((seconds / 30) * 100, 100);
            this.elements.progressFill.style.width = `${progress}%`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startVolumeMonitoring() {
        // 音量监控已在 setupAudioAnalyser 中设置
        // 添加音量检测逻辑
        this.zeroVolumeCount = 0;
        this.volumeCheckThreshold = 20; // 连续20次检测到0音量
        this.hasDetectedSound = false;

        this.volumeCheckInterval = setInterval(() => {
            if (!this.isRecording) return;

            // 检查音量条状态
            let hasActiveVolume = false;
            this.elements.volumeBars.forEach(bar => {
                if (bar.classList.contains('active')) {
                    hasActiveVolume = true;
                }
            });

            if (hasActiveVolume) {
                this.zeroVolumeCount = 0;
                this.hasDetectedSound = true;
            } else {
                this.zeroVolumeCount++;

                // 如果音量持续为0且录音时间超过3秒，提醒用户
                if (this.zeroVolumeCount >= this.volumeCheckThreshold &&
                    this.recordingDuration > 3 &&
                    !this.hasDetectedSound) {

                    showToast('检测不到麦克风声音，请检查麦克风是否已开启或权限是否允许', 'warning');
                    // 重置计数器，避免重复提醒
                    this.zeroVolumeCount = 0;
                }
            }
        }, 500); // 每0.5秒检查一次
    }

    stopVolumeMonitoring() {
        if (this.volumeCheckInterval) {
            clearInterval(this.volumeCheckInterval);
            this.volumeCheckInterval = null;
        }
        this.zeroVolumeCount = 0;
        this.hasDetectedSound = false;
        // 音量监控会在 cleanupAudioAnalyser 中清理
    }

    updateStatus(text, type = 'normal') {
        this.elements.statusText.textContent = text;

        // 更新状态点颜色
        this.elements.statusDot.classList.remove('recording');
        switch (type) {
            case 'success':
                this.elements.statusDot.style.background = '#00ff00';
                this.elements.statusDot.style.boxShadow = '0 0 10px #00ff00';
                break;
            case 'error':
                this.elements.statusDot.style.background = '#ff3333';
                this.elements.statusDot.style.boxShadow = '0 0 10px #ff3333';
                break;
            case 'recording':
                this.elements.statusDot.classList.add('recording');
                break;
            case 'processing':
                this.elements.statusDot.style.background = '#ffaa00';
                this.elements.statusDot.style.boxShadow = '0 0 10px #ffaa00';
                break;
            case 'info':
                this.elements.statusDot.style.background = '#0088ff';
                this.elements.statusDot.style.boxShadow = '0 0 10px #0088ff';
                break;
            default:
                this.elements.statusDot.style.background = '#00ff00';
                this.elements.statusDot.style.boxShadow = '0 0 10px #00ff00';
        }
    }

    setAllButtonsDisabled(disabled) {
        // 禁用或启用所有控制按钮
        this.elements.btnGetText.disabled = disabled;
        this.elements.btnRecord.disabled = disabled || !this.currentText; // 如果没有文本，录音按钮保持禁用
        this.elements.btnStop.disabled = disabled || !this.isRecording;   // 如果不在录音，停止按钮保持禁用
        this.elements.btnPlay.disabled = disabled || !this.audioBlob;      // 如果没有录音，播放按钮保持禁用
        this.elements.btnUpload.disabled = disabled || !this.audioBlob || this.isUploading;    // 如果没有录音或正在上传，上传按钮保持禁用
    }

    setPowerState(powerOn) {
        if (!powerOn) {
            // 关机状态（默认）
            this.elements.textDisplay.textContent = '';
            this.elements.textDisplay.classList.remove('power-on');
            this.elements.timer.classList.remove('power-on');
            document.body.classList.remove('power-on');
            this.updateStatus('请先配置API密钥', 'error');
            this.setAllButtonsDisabled(true);
        } else {
            // 开机状态
            this.elements.textDisplay.textContent = '点击「刷新」按钮获取句子后开始录音跟读';
            this.elements.textDisplay.classList.add('power-on');
            this.elements.timer.classList.add('power-on');
            document.body.classList.add('power-on');
            this.updateStatus('准备就绪', 'success');
            this.setAllButtonsDisabled(false);
        }
    }

    setUploadButtonState(forceDisabled = null) {
        // 如果没有强制设置，根据当前状态决定是否禁用
        const isDisabled = forceDisabled !== null ? forceDisabled : this.isUploading || !this.audioBlob;

        this.elements.btnUpload.disabled = isDisabled;

        // 添加上传中的视觉反馈
        if (this.isUploading) {
            this.elements.btnUpload.classList.add('uploading');
            // 更新按钮 title 属性
            this.elements.btnUpload.title = '正在上传中...';
        } else {
            this.elements.btnUpload.classList.remove('uploading');
            this.elements.btnUpload.title = '上传录音';
        }
    }

    showToast(message, type = 'info') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.add('show');

        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }

    showTemporaryStatusMessages(status_text,status_type) {
        // 2秒后显示第二个提示信息
        setTimeout(() => {
            this.updateStatus(status_text, status_type);
        }, 2000);
    }

    cleanup() {
        // 停止录音
        if (this.isRecording) {
            this.stopRecording();
        }

        // 取消正在进行的上传
        if (this.isUploading && this.uploadAbortController) {
            this.uploadAbortController.abort();
        }

        // 清理资源
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        this.cleanupAudioAnalyser();

        // 清理定时器
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        if (this.volumeCheckInterval) {
            clearInterval(this.volumeCheckInterval);
        }

        // 清理音频URL
        if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
        }

        // 停止播放并清理播放资源
        if (this.isPlaying) {
            this.stopPlayback();
        }
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }
        if (this.playbackProgressTimer) {
            clearInterval(this.playbackProgressTimer);
            this.playbackProgressTimer = null;
        }
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // 重置上传状态
        this.isUploading = false;
        this.uploadAbortController = null;
        this.isStartingRecording = false;
    }
}

// 页面加载完成后初始化录音机
document.addEventListener('DOMContentLoaded', async () => {
    window.recorder = new DialectRecorder();

    // 默认关机状态
    window.recorder.setPowerState(false);

    // 验证密钥并更新按钮状态
    if (window.KeyManager) {
        const result = await window.KeyManager.validateApiKey();
        window.KeyManager.updateKeyButtonState(result);

        // 根据验证结果设置设备电源状态
        if (result.valid === true) {
            // 密钥有效 - 开机
            window.recorder.setPowerState(true);
        }
        // 其他所有情况(密钥无效、已过期、不存在、网络错误等)都保持关机状态
    }

    // 监听页面可见性变化，页面隐藏时停止录音和播放
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (window.recorder.isRecording) {
                window.recorder.stopRecording();
                window.recorder.showToast('页面切换时自动停止了录音', 'warning');
            }
            if (window.recorder.isPlaying) {
                window.recorder.stopPlayback();
                window.recorder.showToast('页面切换时自动停止了播放', 'warning');
            }
        }
    });
});

// 返回主页函数
function goBack() {
    // 如果正在录音或播放，先停止
    if (window.recorder.isRecording) {
        window.recorder.stopRecording();
        window.recorder.showToast('页面切换时自动停止了录音', 'warning');
    }
    if (window.recorder.isPlaying) {
        window.recorder.stopPlayback();
        window.recorder.showToast('页面切换时自动停止了播放', 'warning');
    }

    // 返回主页
    window.location.href = '../index.html';
}