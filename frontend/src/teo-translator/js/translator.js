// Teo translator - 潮汕话语音翻译器 JavaScript
class TeoTranslator {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioBlob = null;
        this.stream = null;
        this.isRecording = false;
        this.isProcessing = false;
        this.isIdle = true; // 是否处于空闲状态
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.javascriptNode = null;
        this.asrServiceHealthy = null; // null=未检查, true=健康, false=不健康
        this.typewriterTimer = null;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.elements = {};
        this.init();
    }

    init() {
        this.initElements();
        this.bindEvents();
        console.log('Teo translator 初始化完成');
    }

    initElements() {
        // 获取所有DOM元素
        this.elements = {
            lcdGlass: document.querySelector('.lcd-glass'),
            displayText: document.getElementById('displayText'),
            modeText: document.getElementById('modeText'),
            recordBtn: document.getElementById('recordBtn'),
            serviceDot: document.getElementById('serviceDot'),
            volumeBars: document.querySelectorAll('.bar'),
            signalBars: document.querySelector('.signal-bars'),
            modelInfo: document.getElementById('modelInfo'),
            modelName: document.getElementById('modelName'),
            modelVersion: document.getElementById('modelVersion'),
            modelDate: document.getElementById('modelDate')
        };
    }

    bindEvents() {
        // 录音按钮事件
        const recordBtn = this.elements.recordBtn;
        if (recordBtn) {
            // 鼠标事件
            recordBtn.addEventListener('mousedown', (e) => this.startRecording(e));
            recordBtn.addEventListener('mouseup', () => this.stopRecording());
            recordBtn.addEventListener('mouseleave', () => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            });

            // 触摸事件（移动端）
            recordBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startRecording(e);
            });
            recordBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopRecording();
            });
        }

        // 页面关闭时清理资源
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // 开始录音
    async startRecording(event) {
        if (this.isRecording || this.isProcessing) {
            return;
        }

        try {
            // 获取麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // 创建MediaRecorder
            const options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                options.mimeType = 'audio/mp4';
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

            // 开始录音
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.isIdle = false;
            this.recordingStartTime = Date.now();

            // 更新UI
            this.updateRecordingUI(true);
            this.startVolumeMonitoring();
            this.updateDisplay('松开按钮即可完成录音');
            this.updateStatusText('录音中');
            // 重置音量条状态
            this.resetVolumeBars();

            // 启动录音计时器和倒计时检查
            this.startRecordingTimer();

        } catch (error) {
            console.error('开始录音失败:', error);
            let errorMessage = '录音失败，请检查麦克风权限';

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = '请允许浏览器访问麦克风权限';
            }

            showToast(errorMessage, 'error');
            this.updateDisplay('录音失败');
        }
    }

    // 停止录音
    stopRecording() {
        if (!this.isRecording) {
            return;
        }

        this.isRecording = false;

        // 检查录音时长
        const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
        const MIN_RECORDING_DURATION = 1.0; // 最短录音时长1秒

        if (recordingDuration < MIN_RECORDING_DURATION) {
            // 录音时间太短，清理并提示
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.stopVolumeMonitoring();
            this.cleanupAudioResources();
            this.updateRecordingUI(false);
            this.updateDisplay('录音时间太短');
            this.updateStatusText('等待录音');
            // 重置音量条状态
            this.resetVolumeBars();
            this.isIdle = true;

            // 清理定时器
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }

            showToast('录音时间太短，请按住至少1秒', 'warning');
            return;
        }

        // 停止MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // 停止音量监听
        this.stopVolumeMonitoring();

        // 清理定时器
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }

        // 更新UI
        this.updateRecordingUI(false);
        this.updateDisplay('上传音频识别中...');
        this.updateStatusText('正在识别');
        // 重置音量条状态
        this.resetVolumeBars();
    }

    // 启动录音计时器
    startRecordingTimer() {
        const MAX_RECORDING_DURATION = 30; // 最大录音时长30秒

        this.recordingTimer = setInterval(() => {
            if (!this.isRecording || !this.recordingStartTime) {
                return;
            }

            const elapsed = (Date.now() - this.recordingStartTime) / 1000;

            // 最后10秒显示倒计时
            if (elapsed >= MAX_RECORDING_DURATION - 10 && elapsed < MAX_RECORDING_DURATION) {
                const remaining = Math.ceil(MAX_RECORDING_DURATION - elapsed);
                this.updateDisplay(`录音中... ${remaining}秒`);
            }

            // 达到最大时长，自动停止
            if (elapsed >= MAX_RECORDING_DURATION) {
                showToast('已达到最大录音时长', 'warning');
                this.stopRecording();
            }
        }, 100); // 每100ms检查一次
    }

    // 处理录音数据
    async processRecording() {
        if (this.audioChunks.length === 0) {
            showToast('未录制到音频', 'warning');
            this.updateDisplay('按住按钮开始录音...');
            this.updateStatusText('等待录音');
            return;
        }

        this.isProcessing = true;
        this.updateProcessingUI(true);

        try {
            // 创建音频Blob
            const mimeType = this.mediaRecorder ? this.mediaRecorder.mimeType : 'audio/webm';
            let audioBlob = new Blob(this.audioChunks, { type: mimeType });

            // 检查是否需要转换格式
            if (mimeType !== 'audio/wav' && mimeType !== 'audio/wave') {
                this.updateDisplay('正在转换音频格式...');
                this.updateStatusText('格式转换中');

                // 转换为WAV格式
                audioBlob = await this.convertToWav(audioBlob, this.stream);
            }

            this.audioBlob = audioBlob;

            // 转换完成，开始上传
            this.updateDisplay('音频识别中...');
            this.updateStatusText('正在识别');

            // 上传音频进行识别
            await this.uploadAudio();

        } catch (error) {
            console.error('音频处理失败:', error);
            showToast('音频处理失败: ' + error.message, 'error');
            this.updateDisplay('音频处理失败，等待一会儿后重试');
            this.updateStatusText('处理失败');
        } finally {
            this.isProcessing = false;
            this.updateProcessingUI(false);
        }
    }

    // 将音频转换为WAV格式
    async convertToWav(audioBlob, stream) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const arrayBuffer = reader.result;

                    // 解码音频数据
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    // 转换为WAV
                    const wavBlob = this.audioBufferToWav(audioBuffer);
                    resolve(wavBlob);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('读取音频数据失败'));
            reader.readAsArrayBuffer(audioBlob);
        });
    }

    // 将AudioBuffer转换为WAV Blob
    audioBufferToWav(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numberOfChannels * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        const channels = [];
        let offset = 0;

        // 写入WAV头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // RIFF标识符
        writeString(0, 'RIFF');
        view.setUint32(4, length - 8, true);
        writeString(8, 'WAVE');

        // fmt子块
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt块大小
        view.setUint16(20, 1, true); // 音频格式 (1 = PCM)
        view.setUint16(22, numberOfChannels, true); // 声道数
        view.setUint32(24, audioBuffer.sampleRate, true); // 采样率
        view.setUint32(28, audioBuffer.sampleRate * 2 * numberOfChannels, true); // 字节率
        view.setUint16(32, numberOfChannels * 2, true); // 块对齐
        view.setUint16(34, 16, true); // 位深度

        // data子块
        writeString(36, 'data');
        view.setUint32(40, length - 44, true);

        // 写入音频数据
        offset = 44;
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    // 上传音频到ASR服务
    async uploadAudio() {
        const apiKey = localStorage.getItem('apiKey');

        if (!apiKey) {
            showToast('请先配置API密钥', 'error');
            if (window.KeyManager) {
                window.KeyManager.goToKeyConfig();
            }
            this.updateDisplay('未配置密钥');
            this.updateStatusText('请先配置密钥');
            return;
        }

        try {
            // 创建FormData
            const formData = new FormData();
            formData.append('file', this.audioBlob, 'recording.wav');

            // 发送请求
            const response = await fetch(`${API_BASE_URL}/api/asr/offline`, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                if (result.text) {
                    // 识别成功
                    this.updateDisplay(`识别结果: ${result.text}`);
                } else {
                    this.updateDisplay(`未识别到内容`);
                }

                this.updateStatusText('潮汕话识别完成');
                this.resetVolumeBars();
                this.isIdle = true;

                // 震动反馈
                this.vibrateDevice();
            } else {
                // 识别失败
                const errorMsg = result.message || '识别失败';
                showToast(errorMsg, 'error');
                this.updateDisplay(`错误: ${errorMsg}`);
                this.updateStatusText('识别失败，请等待一会儿后重试');
                this.resetVolumeBars();
                this.isIdle = true;
            }

        } catch (error) {
            console.error('上传音频失败:', error);
            showToast('上传失败，请检查网络连接', 'error');
            this.updateDisplay('网络错误');
            this.updateStatusText('上传音频失败，等待一会儿后重试');
            this.resetVolumeBars();
            this.isIdle = true;
        } finally {
            // 清理音频资源
            this.cleanupAudioResources();
        }
    }

    // 清理音频资源
    cleanupAudioResources() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.audioChunks = [];
        this.audioBlob = null;
        this.mediaRecorder = null;
    }

    // 清理所有资源
    cleanup() {
        this.stopVolumeMonitoring();
        this.cleanupAudioResources();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // 清理定时器
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    // 更新录音UI状态
    updateRecordingUI(isRecording) {
        const recordBtn = this.elements.recordBtn;
        if (!recordBtn) return;

        if (isRecording) {
            recordBtn.classList.add('recording');
            recordBtn.classList.remove('processing');
            recordBtn.disabled = false;
        } else {
            recordBtn.classList.remove('recording');
        }
    }

    // 更新处理UI状态
    updateProcessingUI(isProcessing) {
        const recordBtn = this.elements.recordBtn;
        if (!recordBtn) return;

        if (isProcessing) {
            recordBtn.classList.add('processing');
            recordBtn.disabled = true;
        } else {
            recordBtn.classList.remove('processing');
            recordBtn.disabled = false;
        }
    }

    // 启动音量监听
    startVolumeMonitoring() {
        if (!this.stream) return;

        try {
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
        } catch (error) {
            console.error('音量监听启动失败:', error);
        }
    }

    // 停止音量监听
    stopVolumeMonitoring() {
        if (this.javascriptNode) {
            this.javascriptNode.onaudioprocess = null;
            this.javascriptNode.disconnect();
            this.javascriptNode = null;
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        // 重置音量显示
        this.updateVolumeMeter(0);
    }

    // 重置音量条到默认状态
    resetVolumeBars() {
        this.elements.volumeBars.forEach((bar) => {
            bar.style.transform = 'scaleY(0.33)';
        });
    }

    // 更新音量显示
    updateVolumeMeter(value) {
        const maxValue = 20;
        const normalizedValue = Math.min(value / maxValue, 1);

        // 每个bar的最大高度对应的 scale
        const maxScales = [1, 2, 3];

        this.elements.volumeBars.forEach((bar, index) => {
            const maxScale = maxScales[index];
            // 当音量超过该bar的阈值时才显示
            // 阈值：第1个bar=0.2, 第2个bar=0.4, 第3个bar=0.6
            const threshold = (index + 1) * 0.2;

            if (normalizedValue > threshold) {
                bar.style.transform = `scaleY(${maxScale})`;
            } else {
                // 没声音时显示最小高度
                bar.style.transform = 'scaleY(0.33)';
            }
        });
    }

    // 检查ASR服务状态
    async checkASRServiceHealth() {
        const apiKey = localStorage.getItem('apiKey');

        if (!apiKey) {
            this.updateServiceStatus(null);
            return;
        }

        // 显示检查中的状态
        this.updateServiceStatus(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/asr/health`, {
                method: 'GET',
                headers: {
                    'X-API-Key': apiKey
                }
            });

            if (response.ok) {
                const result = await response.json();
                const isHealthy = result.status === 'healthy';

                // 提取模型信息
                if (result.model_info) {
                    this.currentModelInfo = {
                        name: result.model_info.model_name || '',
                        version: result.model_info.version || '',
                        updateTime: result.model_info.Update_time || result.model_info.update_time || ''
                    };
                } else {
                    this.currentModelInfo = null;
                }

                this.updateServiceStatus(isHealthy);
                this.asrServiceHealthy = isHealthy;
            } else {
                this.updateServiceStatus(false);
                this.asrServiceHealthy = false;
                this.currentModelInfo = null;
            }
        } catch (error) {
            console.error('ASR服务健康检查失败:', error);
            this.updateServiceStatus(false);
            this.asrServiceHealthy = false;
            this.currentModelInfo = null;
        }
    }

    // 更新服务状态指示灯
    updateServiceStatus(isHealthy) {
        const serviceDot = this.elements.serviceDot;
        if (!serviceDot) return;

        // 移除所有状态类
        serviceDot.classList.remove('healthy', 'unhealthy');

        if (isHealthy === true) {
            serviceDot.classList.add('healthy');
            // 启用录音按钮
            if (this.elements.recordBtn) {
                this.elements.recordBtn.disabled = false;
            }
            // 显示模型信息
            this.updateModelInfo();
            // 清除错误提示
            if (this.isIdle) {
                this.updateDisplay('按住按钮开始录音...');
                this.updateStatusText('等待录音');
            }
        } else if (isHealthy === false) {
            serviceDot.classList.add('unhealthy');
            // 禁用录音按钮
            if (this.elements.recordBtn) {
                this.elements.recordBtn.disabled = true;
            }
            // 隐藏模型信息
            this.hideModelInfo();
            // 显示错误提示
            this.updateDisplay('ASR服务不可用');
            this.updateStatusText('ASR服务连接失败');
        } else {
            // null表示检查中或未检查
            // 隐藏模型信息
            this.hideModelInfo();
            // 只在开机状态时显示检查中提示
            const isPowerOn = document.body.classList.contains('power-on');
            if (isPowerOn && this.isIdle) {
                this.updateDisplay('正在检查ASR服务...');
                this.updateStatusText('等待ASR服务响应');
            }
        }
    }

    // 显示模型信息
    updateModelInfo() {
        const { modelInfo, modelName, modelVersion, modelDate } = this.elements;
        const info = this.currentModelInfo;

        if (modelInfo && modelName && modelVersion) {
            if (info && (info.name || info.version)) {
                modelName.textContent = info.name || '';
                modelVersion.textContent = info.version ? `\u00a0V${info.version}` : '';
                modelInfo.style.display = 'flex';
            } else {
                modelInfo.style.display = 'none';
            }
        }

        if (modelDate) {
            if (info && info.updateTime) {
                modelDate.textContent = `Model updated on ${info.updateTime}`;
                modelDate.style.visibility = 'visible';
            } else {
                modelDate.style.visibility = 'hidden';
            }
        }
    }

    // 隐藏模型信息
    hideModelInfo() {
        const { modelInfo, modelDate } = this.elements;
        if (modelInfo) modelInfo.style.display = 'none';
        if (modelDate) modelDate.style.visibility = 'hidden';
    }

    // 更新显示内容
    updateDisplay(text) {
        const displayText = this.elements.displayText;
        if (!displayText) return;

        // 取消之前的打字机效果
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }
        this.typewriterEffect(displayText, text, 30);
    }

    // 打字机效果
    typewriterEffect(element, text, speed = 30) {
        let i = 0;
        element.textContent = '';

        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                this.typewriterTimer = setTimeout(type, speed);
            }
        };

        type();
    }

    // 更新状态文本
    updateStatusText(text) {
        const modeText = this.elements.modeText;
        if (modeText) {
            modeText.textContent = text;
        }
    }

    // 模拟设备震动
    vibrateDevice() {
        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }
    }

    // 设置电源状态
    setPowerState(powerOn) {
        if (!powerOn) {
            // 关机状态
            if (this.elements.lcdGlass) {
                this.elements.lcdGlass.classList.remove('power-on');
            }
            document.body.classList.remove('power-on');

            // 禁用录音按钮
            if (this.elements.recordBtn) {
                this.elements.recordBtn.disabled = true;
            }

            // 清空显示区域
            if (this.elements.displayText) {
                this.elements.displayText.textContent = '';
            }

            // 在mode-text位置显示提示
            this.updateStatusText('先配置API密钥后才能使用');
            this.updateServiceStatus(null);
        } else {
            // 先检查密钥，有密钥才开机
            const apiKey = localStorage.getItem('apiKey');
            if (!apiKey) {
                // 没有密钥，保持关机状态
                this.updateStatusText('配置密钥');
                this.updateServiceStatus(null);
                return;
            }

            // 开机状态
            if (this.elements.lcdGlass) {
                this.elements.lcdGlass.classList.add('power-on');
            }
            document.body.classList.add('power-on');

            // 开机时先禁用录音按钮，等待ASR服务检查
            if (this.elements.recordBtn) {
                this.elements.recordBtn.disabled = true;
            }

            this.updateDisplay('按住录音按键即可开始录音...');
            this.updateStatusText('等待录音');

            // 检查ASR服务状态（会自动启用按钮如果服务健康）
            this.checkASRServiceHealth();

            // 每30秒检查一次服务状态
            setInterval(() => {
                if (document.body.classList.contains('power-on')) {
                    this.checkASRServiceHealth();
                }
            }, 30000);
        }
    }
}

// 全局函数，供HTML调用
function goBack() {
    if (window.translator) {
        // 如果正在录音或处理，不允许返回
        if (window.translator.isRecording || window.translator.isProcessing) {
            showToast('请等待录音或识别完成', 'warning');
            return;
        }
    }
    window.location.href = '../index.html';
}

// Toast提示函数
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastUniversal');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    window.translator = new TeoTranslator();

    // 默认关机状态
    window.translator.setPowerState(false);

    // 验证密钥并更新按钮状态
    if (window.KeyManager) {
        try {
            const result = await window.KeyManager.validateApiKey();
            window.KeyManager.updateKeyButtonState(result);

            // 根据验证结果设置设备电源状态
            if (result.valid === true) {
                // 密钥有效 - 开机
                window.translator.setPowerState(true);
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
