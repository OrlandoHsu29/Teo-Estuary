// 全局变量定义 - 必须最先加载

// 录音数据状态
let recordingsData = [];
let currentRecordIndex = 0;
let currentPage = 1;
let totalPages = 1;
let currentSection = 'review';
let currentStatusFilter = 'pending'; // 当前状态筛选

// 滑动窗口分页变量
let windowStartPage = 1;        // 当前窗口的起始页
let windowEndPage = 1;          // 当前窗口的结束页
let absoluteRecordIndex = 0;    // 绝对记录索引（相对于总数据）
let isLoadingNextPage = false;  // 是否正在加载下一页

// UI状态
let currentView = 'device'; // 'device' or 'list'

// 搜索计时器
let listSearchTimer = null;

// 详细视图状态保存
let deviceViewActiveStatus = 'pending'; // 保存详细视图当前的激活状态

// 搜索状态
let currentSearchQuery = ''; // 当前搜索关键词