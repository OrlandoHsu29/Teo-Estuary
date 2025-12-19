// 全局变量定义 - 必须最先加载

// 录音数据状态
let recordingsData = [];
let currentRecordIndex = 0;
let currentPage = 1;
let totalPages = 1;
let currentSection = 'review';
let currentStatusFilter = 'pending'; // 当前状态筛选

// UI状态
let currentView = 'device'; // 'device' or 'list'

// 搜索计时器
let listSearchTimer = null;

// 详细视图状态保存
let deviceViewActiveStatus = 'pending'; // 保存详细视图当前的激活状态