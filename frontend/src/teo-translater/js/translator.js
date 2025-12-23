// Teo Translater - 潮汕话翻译器 JavaScript
class TeoTranslator {
    constructor() {
        this.currentMode = 'mandarin-to-teochew'; // 默认普通话转潮汕话
        this.isTranslating = false;
        this.typewriterTimer = null; // 打字机效果定时器
        this.displayDebounceTimer = null; // 防抖定时器
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
        this.startAnimations();
        console.log('Teo Translater 初始化完成');
    }

    bindEvents() {
        // 文本输入事件
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.addEventListener('input', (e) => this.handleTextInput(e));
            textInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
            // 禁止粘贴非中文内容
            textInput.addEventListener('paste', (e) => this.handlePaste(e));
        }

        // 页面加载完成后初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.updateCharCounter();
                this.simulateStartup();
            });
        } else {
            this.updateCharCounter();
            this.simulateStartup();
        }
    }

    // 处理文本输入
    handleTextInput(event) {
        const text = event.target.value;

        // 清除之前的防抖定时器
        if (this.displayDebounceTimer) {
            clearTimeout(this.displayDebounceTimer);
        }

        // 防抖延迟 500ms 更新屏幕和计数器
        this.displayDebounceTimer = setTimeout(() => {
            // 如果正在翻译，不更新屏幕
            if (this.isTranslating) {
                return;
            }

            // 更新字符计数器
            this.updateCharCounter();

            // 如果输入内容，更新屏幕显示
            if (text.length > 0) {
                this.updateDisplay(`输入: ${text.substring(0, 25)}${text.length > 25 ? '...' : ''}`);
            } else {
                this.updateDisplay('等待输入...');
            }
        }, 500);
    }

    // 处理键盘事件
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.translate();
        } else if (event.key === 'Escape') {
            this.clearAll();
        }
    }

    // 处理粘贴事件
    handlePaste(event) {
        // 不再阻止粘贴，允许粘贴任何内容
        // 粘贴后会自动触发 input 事件，由 handleTextInput 处理
        setTimeout(() => {
            const textInput = event.target;
            // 立即更新计数器和屏幕
            this.updateCharCounter();
            this.updateDisplay(`输入: ${textInput.value.substring(0, 25)}${textInput.value.length > 25 ? '...' : ''}`);
        }, 10);
    }

    // 更新字符计数器
    updateCharCounter() {
        const textInput = document.getElementById('textInput');
        const charCount = document.getElementById('charCount');
        if (textInput && charCount) {
            const count = textInput.value.length;
            charCount.textContent = count;

            // 超过90个字符时改变颜色警告
            if (count > 90) {
                charCount.style.color = '#ff5252';
            } else if (count > 75) {
                charCount.style.color = '#ff9800';
            } else {
                charCount.style.color = '#333333';
            }
        }
    }

    // 更新显示内容
    updateDisplay(text) {
        const displayText = document.getElementById('displayText');
        if (displayText) {
            // 取消之前的打字机效果
            if (this.typewriterTimer) {
                clearTimeout(this.typewriterTimer);
                this.typewriterTimer = null;
            }
            this.typewriterEffect(displayText, text, 30);
        }
    }

    // 打字机效果
    typewriterEffect(element, text, speed = 50) {
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

    // 切换翻译模式
    toggleMode() {
        this.currentMode = this.currentMode === 'mandarin-to-teochew'
            ? 'teochew-to-mandarin'
            : 'mandarin-to-teochew';

        this.updateUI();
        this.animateModeSwitch();
    }

    // 更新UI状态
    updateUI() {
        const modeText = document.getElementById('modeText');
        const textInput = document.getElementById('textInput');
        const translateBtnText = document.getElementById('translateBtnText');

        if (this.currentMode === 'mandarin-to-teochew') {
            if (modeText) modeText.textContent = '普通话→潮汕';
            if (textInput) textInput.placeholder = '输入普通话文本...';
            if (translateBtnText) translateBtnText.textContent = '潮';
        } else {
            if (modeText) modeText.textContent = '潮汕→普通话';
            if (textInput) textInput.placeholder = '输入潮汕话文本...';
            if (translateBtnText) translateBtnText.textContent = '普';
        }
    }

    // 模式切换动画
    animateModeSwitch() {
        const lcdGlass = document.querySelector('.lcd-glass');
        if (lcdGlass) {
            lcdGlass.style.animation = 'modeSwitch 0.5s ease';
            setTimeout(() => {
                lcdGlass.style.animation = '';
            }, 500);
        }
    }

    // 翻译功能
    async translate() {
        const textInput = document.getElementById('textInput');
        const text = textInput.value.trim();

        if (!text) {
            this.updateDisplay('请输入要翻译的文本');
            return;
        }

        if (this.isTranslating) {
            return;
        }

        // 清除防抖定时器，避免被覆盖
        if (this.displayDebounceTimer) {
            clearTimeout(this.displayDebounceTimer);
            this.displayDebounceTimer = null;
        }

        this.isTranslating = true;

        // 在屏幕显示"翻译中..."
        this.updateDisplay('翻译中...');

        try {
            // 模拟延迟
            await new Promise(resolve => setTimeout(resolve, 800));

            // 显示开发中提示
            this.updateDisplay('翻译功能正在开发中，敬请期待...');

            // 震动反馈（如果支持）
            this.vibrateDevice();

        } catch (error) {
            console.error('翻译错误:', error);
            this.updateDisplay('翻译功能正在开发中，敬请期待...');
        } finally {
            this.isTranslating = false;
        }
    }

    // 模拟翻译API调用
    simulateTranslation(text) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // 这里是模拟翻译结果
                // 实际应用中应该调用真实的翻译API
                let translation = '';

                if (this.currentMode === 'mandarin-to-teochew') {
                    translation = this.mandarinToTeochew(text);
                } else {
                    translation = this.teochewToMandarin(text);
                }

                resolve(translation);
            }, 1200 + Math.random() * 800); // 1.2-2秒的随机延迟
        });
    }

    // 模拟普通话转潮汕话
    mandarinToTeochew(text) {
        // 简单的模拟翻译规则
        const translations = {
            '你好': '你好',
            '世界': '世界',
            '谢谢': '多谢',
            '再见': '再会',
            '吃饭': '食饭',
            '睡觉': '睏觉',
            '我爱你': '我爱你',
            '早上好': '早晨',
            '晚上好': '暗昼好',
            '是什么': '是乜个',
            '这个': '这个',
            '那个': '许个',
            '我们': '阮',
            '你们': '恁',
            '他们': '伊人'
        };

        let result = text;
        for (const [mandarin, teochew] of Object.entries(translations)) {
            result = result.replace(new RegExp(mandarin, 'g'), teochew);
        }

        // 如果没有找到对应翻译，添加后缀表示
        if (result === text) {
            result = text + ' (潮汕话)';
        }

        return result;
    }

    // 模拟潮汕话转普通话
    teochewToMandarin(text) {
        // 简单的模拟翻译规则
        const translations = {
            '你好': '你好',
            '世界': '世界',
            '多谢': '谢谢',
            '再会': '再见',
            '食饭': '吃饭',
            '睏觉': '睡觉',
            '早晨': '早上好',
            '暗昼好': '晚上好',
            '是乜个': '是什么',
            '阮': '我们',
            '恁': '你们',
            '伊人': '他们'
        };

        let result = text;
        for (const [teochew, mandarin] of Object.entries(translations)) {
            result = result.replace(new RegExp(teochew, 'g'), mandarin);
        }

        // 如果没有找到对应翻译，添加后缀表示
        if (result === text) {
            result = text + ' (普通话)';
        }

        return result;
    }

    // 显示翻译结果
    displayTranslation(inputText, outputText) {
        this.updateDisplay(`结果: ${outputText}`);
        this.playSuccessSound();
    }

    // 清除所有内容
    clearAll() {
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.value = '';
        }

        this.updateCharCounter();
        this.updateDisplay('等待输入...');
    }

    // 显示加载动画
    showLoading(show) {
        const loadingLayer = document.getElementById('loadingLayer');
        if (loadingLayer) {
            if (show) {
                loadingLayer.classList.add('active');
            } else {
                loadingLayer.classList.remove('active');
            }
        }
    }

    // 模拟设备震动
    vibrateDevice() {
        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }
    }

    // 模拟成功音效
    playSuccessSound() {
        // 创建简单的音频反馈
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    // 模拟启动过程
    simulateStartup() {
        // 显示启动消息
        setTimeout(() => {
            this.updateDisplay('系统就绪');
        }, 1000);
    }

    // 开始动画效果
    startAnimations() {
        // 添加CSS动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes modeSwitch {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;

        if (!document.querySelector('style[data-translator-animations]')) {
            style.setAttribute('data-translator-animations', 'true');
            document.head.appendChild(style);
        }
    }
}

// 全局函数，供HTML调用
function toggleMode() {
    if (window.translator) {
        window.translator.toggleMode();
    }
}

function handleTranslateClick() {
    if (window.translator) {
        window.translator.translate();
    }
}

function clearAll() {
    if (window.translator) {
        window.translator.clearAll();
    }
}

// 返回主页函数
function goBack() {
    // 如果正在翻译，不强制中断，直接返回
    // 翻译器没有录音状态，所以直接返回即可
    window.location.href = '../index.html';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.translator = new TeoTranslator();

    // 添加键盘快捷键提示
    console.log('Teo Translater 快捷键:');
    console.log('Enter - 翻译文本');
    console.log('Escape - 清除文本');
});
