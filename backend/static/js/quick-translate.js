/**
 * 快捷翻译设备 - 独立模块
 * 在音频审核页面提供快速的潮汕话↔普通话翻译查询
 */

// 状态
let qtResults = [];
let qtIndex = 0;
let qtSearchType = 'mandarin'; // 'mandarin' | 'teochew'

/**
 * 检测当前词条是否有多个变体
 * 规则：搜索普通话时检查普通话是否有多条潮汕话；搜索潮汕话时检查潮汕话是否有多条普通话
 * @param {Object} entry - 当前词条
 * @returns {boolean} - 是否有多变体
 */
function qtHasVariants(entry) {
    if (qtSearchType === 'mandarin') {
        // 搜索普通话：检查同一个普通话是否有多条潮汕话
        const currentMandarin = entry.mandarin_text;
        return qtResults.some(r =>
            r.mandarin_text === currentMandarin &&
            r.teochew_text !== entry.teochew_text
        );
    } else {
        // 搜索潮汕话：检查同一个潮汕话是否有多条普通话
        const currentTeochew = entry.teochew_text;
        return qtResults.some(r =>
            r.teochew_text === currentTeochew &&
            r.mandarin_text !== entry.mandarin_text
        );
    }
}

/**
 * 切换搜索语言模式
 */
function qtToggleLang() {
    qtSearchType = qtSearchType === 'mandarin' ? 'teochew' : 'mandarin';
    const btn = document.getElementById('qtLangToggle');
    const label = document.getElementById('qtLangLabel');
    const input = document.getElementById('qtSearchInput');

    if (qtSearchType === 'teochew') {
        btn.classList.add('teochew-mode');
        label.textContent = '潮';
        input.placeholder = '输入潮汕话...';
        // 立即互换结果卡片标签
        document.getElementById('qtLabel1').textContent = '潮汕话';
        document.getElementById('qtLabel2').textContent = '普通话';
    } else {
        btn.classList.remove('teochew-mode');
        label.textContent = '普';
        input.placeholder = '输入普通话...';
        // 立即互换结果卡片标签
        document.getElementById('qtLabel1').textContent = '普通话';
        document.getElementById('qtLabel2').textContent = '潮汕话';
    }

    // 自动重新搜索当前关键词
    const keyword = input.value.trim();
    if (keyword) qtSearch();
}

/**
 * 搜索词条
 */
async function qtSearch() {
    const keyword = document.getElementById('qtSearchInput').value.trim();
    if (!keyword) return;

    // 显示加载状态
    document.getElementById('qtLoadingIndicator').classList.add('active');

    try {
        const resp = await fetch(
            `/api/dictionary/search?keyword=${encodeURIComponent(keyword)}&search_type=${qtSearchType}`
        );
        const data = await resp.json();

        document.getElementById('qtLoadingIndicator').classList.remove('active');

        if (data.success) {
            qtResults = data.translations || [];
            qtIndex = 0;
            qtUpdateDisplay();
        } else {
            showToast(data.error || '搜索失败', 'error');
            qtClearDisplay();
        }
    } catch (err) {
        document.getElementById('qtLoadingIndicator').classList.remove('active');
        showToast('搜索失败，请检查网络连接', 'error');
        qtClearDisplay();
    }
}

/**
 * 清空显示
 */
function qtClearDisplay() {
    document.getElementById('qtText1').textContent = '—';
    document.getElementById('qtText2').textContent = '—';
    document.getElementById('qtCounter').textContent = '0/0';
    document.getElementById('qtPrevBtn').disabled = true;
    document.getElementById('qtNextBtn').disabled = true;
    document.getElementById('qtCard1Content').classList.remove('has-variants');
    document.getElementById('qtCard2Content').classList.remove('has-variants');
}

/**
 * 更新显示区域（直接操作已有元素）
 */
function qtUpdateDisplay() {
    if (qtResults.length === 0) {
        // 不调用 qtClearDisplay，避免覆盖标签（标签由 qtToggleLang 管理）
        document.getElementById('qtText1').textContent = '无结果';
        document.getElementById('qtText2').textContent = '无结果';
        document.getElementById('qtCounter').textContent = '0/0';
        document.getElementById('qtPrevBtn').disabled = true;
        document.getElementById('qtNextBtn').disabled = true;
        document.getElementById('qtCard1Content').classList.remove('has-variants');
        document.getElementById('qtCard2Content').classList.remove('has-variants');
        return;
    }

    const entry = qtResults[qtIndex];
    const isMandarinSearch = qtSearchType === 'mandarin';
    const sourceText = isMandarinSearch ? entry.mandarin_text : entry.teochew_text;
    const targetText = isMandarinSearch ? entry.teochew_text : entry.mandarin_text;

    // 检测变体：高亮目标语言卡片（卡2）
    const hasVariants = qtHasVariants(entry);

    // 更新卡片1（源语言）：不变黄
    const card1 = document.getElementById('qtCard1Content');
    document.getElementById('qtText1').textContent = sourceText;
    card1.classList.remove('has-variants');

    // 更新卡片2（目标语言）
    const card2 = document.getElementById('qtCard2Content');
    document.getElementById('qtText2').textContent = targetText;
    card2.classList.toggle('has-variants', hasVariants);

    // 更新计数器
    document.getElementById('qtCounter').textContent = `${qtIndex + 1}/${qtResults.length}`;
    document.getElementById('qtPrevBtn').disabled = qtIndex <= 0;
    document.getElementById('qtNextBtn').disabled = qtIndex >= qtResults.length - 1;
}

/**
 * 导航结果
 * @param {number} direction - 方向，-1 上一条，1 下一条
 */
function qtNavigate(direction) {
    const newIndex = qtIndex + direction;
    if (newIndex >= 0 && newIndex < qtResults.length) {
        qtIndex = newIndex;
        qtUpdateDisplay();
    }
}

/**
 * 复制当前翻译结果
 */
function qtCopyResult() {
    if (qtResults.length === 0) return;
    const entry = qtResults[qtIndex];
    const isMandarinSearch = qtSearchType === 'mandarin';
    const text = isMandarinSearch
        ? `${entry.teochew_text}`
        : `${entry.mandarin_text}`;
    copyToClipboard(text);
}

// 键盘事件：回车搜索
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('qtSearchInput');
    if (input) {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') qtSearch();
        });
    }
});
