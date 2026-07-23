/**
 * 暑假学习管家 - 数据管理层 (Store)
 * ============================================================
 * 核心：管理 localStorage 中的所有数据，包括孩子信息、固定活动、
 *       任务模板、每日任务实例、积分、奖励库和设置。
 *
 * 数据存储 key：
 *   ssm_children       — 孩子数据
 *   ssm_activities     — 固定活动
 *   ssm_taskTemplates  — 任务模板
 *   ssm_taskInstances  — 每日任务实例（以日期为 key 组织）
 *   ssm_points         — 积分记录
 *   ssm_rewards        — 奖励库
 *   ssm_settings       — 设置
 *   ssm_progressLog    — 进度日志
 * ============================================================
 */
(function (global) {
  'use strict';

  /* ========================================================
   * 一、常量定义
   * ====================================================== */

  // localStorage 存储 key 前缀
  const STORAGE_KEYS = {
    VERSION: 'ssm_data_version',
    CHILDREN: 'ssm_children',
    ACTIVITIES: 'ssm_activities',
    TASK_TEMPLATES: 'ssm_taskTemplates',
    TASK_INSTANCES: 'ssm_taskInstances',
    POINTS: 'ssm_points',
    REWARDS: 'ssm_rewards',
    SETTINGS: 'ssm_settings',
    PROGRESS_LOG: 'ssm_progressLog',
    DELETED_TEMPLATES: 'ssm_deletedTemplates',
    CASHABLE_POINTS: 'ssm_cashablePoints'
  };

  // 数据版本号（修改默认数据时递增，触发自动修复）
  const DATA_VERSION = '18';

  // 已知家务任务名称关键词（用于把用户自定义的家务模板也识别为 cashable）
  const KNOWN_CHORE_NAMES = ['洗碗', '扫地', '拖地', '洗衣服'];

  // 任务状态枚举
  const TASK_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    PARTIAL: 'partial',
    SKIPPED: 'skipped'
  };

  // 任务频率类型
  const TASK_FREQUENCY = {
    DAILY: 'daily',
    ONE_TIME: 'oneTime',
    WEEKLY: 'weekly',
    MILESTONE: 'milestone',
    DATE_RANGE: 'dateRange'
  };

  // 时间段（4 节点）
  const TIME_SLOTS = {
    MORNING: 'morning',   // 上午
    NOON: 'noon',         // 中午
    AFTERNOON: 'afternoon', // 下午
    EVENING: 'evening'    // 晚上
  };

  /* ========================================================
   * 二、默认数据
   * ====================================================== */

  /**
   * 默认孩子数据
   */
  const DEFAULT_CHILDREN = [
    {
      id: 'brother',
      name: '哥哥',
      age: 12,
      grade: '6升7',
      examDate: '2026-08-24',
      weakSubject: 'math',
      interests: ['游戏', '篮球', '出去玩', '吃好吃的', '机动游戏', '看电影']
    },
    {
      id: 'little',
      name: '弟弟',
      age: 8,
      grade: '2升3',
      interests: ['阅读', '画画', '爬山', '逛商场', '吃好吃的', '小高思维']
    }
  ];

  /**
   * 默认固定活动
   */
  const DEFAULT_ACTIVITIES = [
    {
      id: 'basketball',
      childId: 'brother',
      name: '篮球课',
      startTime: '10:45',
      endTime: '12:15',
      days: [1, 2, 4, 5],
      dateRange: ['2026-07-20', '2026-08-07']
    },
    {
      id: 'swimming',
      childId: 'little',
      name: '游泳课',
      startTime: '14:00',
      endTime: '15:30',
      days: [1, 2, 4, 5]
    },
    {
      id: 'math_yuan',
      childId: 'brother',
      name: '猿辅导数学预习',
      startTime: '18:50',
      endTime: '20:50',
      dateRange: ['2026-07-16', '2026-07-27']
    },
    {
      id: 'chinese_yuan',
      childId: 'brother',
      name: '猿辅导语文预习',
      startTime: '18:50',
      endTime: '20:50',
      dateRange: ['2026-07-30', '2026-08-10']
    },
    {
      id: 'english_yuan_morning',
      childId: 'brother',
      name: '猿辅导英语预习(上午)',
      startTime: '09:30',
      endTime: '11:20',
      dateRange: ['2026-07-30', '2026-08-10'],
      note: '7/30-8/10篮球暂停'
    },
    {
      id: 'english_yuan',
      childId: 'brother',
      name: '猿辅导英语预习',
      startTime: '18:50',
      endTime: '20:50',
      dateRange: ['2026-07-30', '2026-08-10']
    },
    {
      id: 'night_english',
      childId: 'both',
      name: '晚间英语(妈妈带)',
      startTime: '20:00',
      endTime: '20:20'
    },
    {
      id: 'xiaogao_math',
      childId: 'little',
      name: '小高数学思维课',
      startTime: '19:00',
      endTime: '19:20',
      note: '爸爸带，妈妈回家后随时',
      flexible: true
    },
    {
      id: 'calligraphy',
      childId: 'little',
      name: '书法课程',
      startTime: '19:30',
      endTime: '19:50',
      note: '妈妈回家后随时',
      flexible: true
    }
  ];

  /**
   * 默认任务模板（v8 版完整清单）
   * 频率类型：daily / oneTime / weekly / milestone / dateRange
   * 字段说明：
   *   id            — 模板唯一 id
   *   childId       — 所属孩子（'both' 表示两个孩子都适用）
   *   subject       — 学科分类
   *   name          — 任务名称
   *   frequency     — 频率
   *   duration      — 预计时长（分钟）
   *   points        — 完成可得积分
   *   phase         — 阶段标记（phase1 / phase2）
   *   hardToStart   — 难启动任务
   *   dependsOn     — 依赖任务 id
   *   dateRange     — 日期范围（dateRange 类型专用）
   *   flexible      — 时间灵活
   *   needMomGuide  — 需要妈妈指导
   *   easyToForget  — 容易遗忘
   *   repeatCount   — 重复次数（oneTime×N 专用）
   */
  const DEFAULT_TASK_TEMPLATES = [
    // ========== 哥哥任务 ==========

    // --- 语文 ---
    { id: 'xi_reading', childId: 'brother', subject: 'chinese', name: '《西游记》阅读', frequency: 'daily', duration: 30, points: 6, phase: 'phase1' },
    { id: 'xi_bookmark_1', childId: 'brother', subject: 'chinese', name: '西游记书签#1-唐僧', frequency: 'oneTime', duration: 30, points: 12, phase: 'phase1' },
    { id: 'xi_bookmark_2', childId: 'brother', subject: 'chinese', name: '西游记书签#2-悟空', frequency: 'oneTime', duration: 30, points: 12, phase: 'phase1' },
    { id: 'xi_bookmark_3', childId: 'brother', subject: 'chinese', name: '西游记书签#3-八戒', frequency: 'oneTime', duration: 30, points: 12, phase: 'phase1' },
    { id: 'xi_bookmark_4', childId: 'brother', subject: 'chinese', name: '西游记书签#4-沙僧', frequency: 'oneTime', duration: 30, points: 12, phase: 'phase1' },
    { id: 'chao_reading', childId: 'brother', subject: 'chinese', name: '《朝花夕拾》阅读', frequency: 'daily', duration: 30, points: 10, phase: 'phase2', hardToStart: true },
    { id: 'chao_poems', childId: 'brother', subject: 'chinese', name: '改过十篇古诗', frequency: 'oneTime', duration: 15, points: 8, dependsOn: 'chao_reading', repeatCount: 10 },
    { id: 'chao_summary', childId: 'brother', subject: 'chinese', name: '概括《朝花夕拾》十篇文章情节和人物形象', frequency: 'oneTime', duration: 40, points: 10, dependsOn: 'chao_reading', repeatCount: 10, hardToStart: true },
    { id: 'chinese_exercise', childId: 'brother', subject: 'chinese', name: '一本牌语文暑假练习册', frequency: 'daily', duration: 30, points: 8 },
    { id: 'chinese_yuan_preview', childId: 'brother', subject: 'chinese', name: '猿辅导语文预习', frequency: 'dateRange', dateRange: ['2026-07-30', '2026-08-10'], duration: 120, points: 8 },
    { id: 'chinese_yuan_notes', childId: 'brother', subject: 'chinese', name: '猿辅导语文笔记整理', frequency: 'dateRange', dateRange: ['2026-07-30', '2026-08-10'], duration: 15, points: 12, hardToStart: true },
    { id: 'chinese_handwriting', childId: 'brother', subject: 'chinese', name: '硬笔书法练习', frequency: 'daily', duration: 15, points: 5 },

    // --- 数学 ---
    { id: 'math_sprint', childId: 'brother', subject: 'math', name: '分班考冲刺专项(AI家教)', frequency: 'daily', duration: 30, points: 15, hardToStart: true },
    { id: 'math_exercise', childId: 'brother', subject: 'math', name: '一本牌数学暑假练习册', frequency: 'daily', duration: 30, points: 10, hardToStart: true },
    { id: 'math_calc', childId: 'brother', subject: 'math', name: '猿辅导天天练数学计算题', frequency: 'daily', duration: 15, points: 8 },
    { id: 'math_yuan_preview', childId: 'brother', subject: 'math', name: '猿辅导数学预习', frequency: 'dateRange', dateRange: ['2026-07-16', '2026-07-27'], duration: 120, points: 10 },
    { id: 'math_yuan_notes', childId: 'brother', subject: 'math', name: '猿辅导数学笔记整理', frequency: 'dateRange', dateRange: ['2026-07-16', '2026-07-27'], duration: 15, points: 12, hardToStart: true },
    { id: 'math_explain', childId: 'brother', subject: 'math', name: '讲一道数学解题思路', frequency: 'weekly', duration: 15, points: 8 },
    { id: 'math_game', childId: 'brother', subject: 'math', name: '24点/数独/七巧板', frequency: 'daily', duration: 10, points: 4 },

    // --- 英语 ---
    { id: 'english_exercise', childId: 'brother', subject: 'english', name: '一本牌英语暑假练习册', frequency: 'daily', duration: 30, points: 8 },
    { id: 'english_words', childId: 'brother', subject: 'english', name: '英语单词背诵', frequency: 'daily', duration: 15, points: 8 },
    { id: 'english_yuan_preview', childId: 'brother', subject: 'english', name: '猿辅导英语预习', frequency: 'dateRange', dateRange: ['2026-07-30', '2026-08-10'], duration: 110, points: 8 },
    { id: 'english_yuan_notes', childId: 'brother', subject: 'english', name: '猿辅导英语笔记整理', frequency: 'dateRange', dateRange: ['2026-07-30', '2026-08-10'], duration: 15, points: 12, hardToStart: true },
    { id: 'english_song', childId: 'brother', subject: 'english', name: '学唱英文歌曲', frequency: 'milestone', points: 8 },
    { id: 'english_festivals', childId: 'brother', subject: 'english', name: '了解中国传统节日(英文)', frequency: 'milestone', points: 6 },
    { id: 'english_night', childId: 'both', subject: 'english', name: '晚间英语(妈妈带)', frequency: 'daily', duration: 15, points: 5 },

    // ========== 弟弟任务 ==========

    // --- 数学 ---
    { id: 'little_xiaogao_math', childId: 'little', subject: 'math', name: '小高数学思维课', frequency: 'daily', duration: 20, points: 12, hardToStart: true },
    { id: 'little_math_diary', childId: 'little', subject: 'math', name: '数学周记', frequency: 'weekly', duration: 30, points: 10, hardToStart: true },
    { id: 'little_math_exercise', childId: 'little', subject: 'math', name: '一本牌数学暑假作业', frequency: 'daily', duration: 15, points: 8 },
    { id: 'little_math_practice', childId: 'little', subject: 'math', name: '数学生活实践', frequency: 'weekly', duration: 20, points: 6, needMomGuide: true, easyToForget: true, repeatCount: 2 },
    { id: 'little_independent', childId: 'little', subject: 'math', name: '独立完成一件事并记录', frequency: 'weekly', duration: 20, points: 6, needMomGuide: true, easyToForget: true },

    // --- 语文 ---
    { id: 'little_chinese_exercise', childId: 'little', subject: 'chinese', name: '一本牌语文暑假作业', frequency: 'daily', duration: 20, points: 8 },
    { id: 'little_reading', childId: 'little', subject: 'chinese', name: '快乐书吧阅读', frequency: 'daily', duration: 30, points: 6 },
    { id: 'little_poems', childId: 'little', subject: 'chinese', name: '背诵古诗75首', frequency: 'daily', duration: 15, points: 6 },
    { id: 'little_handwriting', childId: 'little', subject: 'chinese', name: '硬笔书法练字', frequency: 'daily', duration: 15, points: 4 },
    { id: 'little_practice_record', childId: 'little', subject: 'chinese', name: '暑假实践记录表', frequency: 'oneTime', points: 10 },

    // --- 英语 ---
    { id: 'little_phonics', childId: 'little', subject: 'english', name: '音标复习+拼读单词', frequency: 'daily', duration: 10, points: 6 },
    { id: 'little_words', childId: 'little', subject: 'english', name: '三年级上册单词', frequency: 'daily', duration: 10, points: 6 },

    // --- 其他 ---
    { id: 'little_calligraphy', childId: 'little', subject: 'other', name: '书法课程', frequency: 'daily', duration: 20, points: 4, flexible: true },

    // ========== 家务劳动（可兑换零花钱，cashable） ==========
    // 哥哥家务
    { id: 'brother_chore_wash', childId: 'brother', subject: 'other', name: '洗碗', frequency: 'daily', duration: 15, points: 5, cashable: true, needMomGuide: false },
    { id: 'brother_chore_sweep', childId: 'brother', subject: 'other', name: '扫地', frequency: 'daily', duration: 10, points: 3, cashable: true },
    { id: 'brother_chore_mop', childId: 'brother', subject: 'other', name: '拖地', frequency: 'daily', duration: 15, points: 3, cashable: true },
    { id: 'brother_chore_laundry', childId: 'brother', subject: 'other', name: '洗衣服（自己的一批）', frequency: 'weekly', duration: 20, points: 8, cashable: true },

    // 弟弟家务
    { id: 'little_chore_wash', childId: 'little', subject: 'other', name: '洗碗', frequency: 'daily', duration: 15, points: 5, cashable: true },
    { id: 'little_chore_sweep', childId: 'little', subject: 'other', name: '扫地', frequency: 'daily', duration: 10, points: 3, cashable: true },
    { id: 'little_chore_mop', childId: 'little', subject: 'other', name: '拖地', frequency: 'daily', duration: 15, points: 3, cashable: true },
    { id: 'little_chore_laundry', childId: 'little', subject: 'other', name: '洗衣服（自己的一批）', frequency: 'weekly', duration: 20, points: 8, cashable: true }
  ];

  /**
   * 默认奖励库
   * 每个奖励：{ childId, name, cost, type, description }
   * type: privilege(特权) / small(小体验) / medium(中体验) / large(大体验) / xl(特大体验) / learning(学习型)
   */
  const DEFAULT_REWARDS = [
    // --- 哥哥奖励库 ---
    { childId: 'brother', name: '选周末活动', cost: 30, type: 'privilege', description: '可选周末活动' },
    { childId: 'brother', name: '晚睡30分钟', cost: 30, type: 'privilege', description: '晚上延迟30分钟睡觉' },
    { childId: 'brother', name: '免做1项小任务', cost: 30, type: 'privilege', description: '免除一项小任务' },
    { childId: 'brother', name: '一起吃烧烤', cost: 50, type: 'small', description: '家庭烧烤' },
    { childId: 'brother', name: '一起吃火锅', cost: 50, type: 'small', description: '家庭火锅' },
    { childId: 'brother', name: '一起喝奶茶', cost: 50, type: 'small', description: '一起喝奶茶' },
    { childId: 'brother', name: '看中国诗词大会1期', cost: 50, type: 'learning', description: '学习型：看中国诗词大会1期' },
    { childId: 'brother', name: '看典籍里的中国1期', cost: 50, type: 'learning', description: '学习型：看典籍里的中国1期' },
    { childId: 'brother', name: '看跟着书本去旅行1期', cost: 50, type: 'learning', description: '学习型：看跟着书本去旅行1期' },
    { childId: 'brother', name: '周末爬山+零食补给', cost: 80, type: 'medium', description: '周末爬山并带零食补给' },
    { childId: 'brother', name: '逛商场+选一件小东西', cost: 80, type: 'medium', description: '逛商场选小礼物' },
    { childId: 'brother', name: '看一部英文电影', cost: 80, type: 'learning', description: '学习型：看一部英文电影' },
    { childId: 'brother', name: '机动游戏', cost: 120, type: 'large', description: '玩机动游戏' },
    { childId: 'brother', name: '游乐场半天', cost: 120, type: 'large', description: '游乐场玩半天' },
    { childId: 'brother', name: '和同学约玩+请吃一顿', cost: 120, type: 'large', description: '和同学约玩并请吃饭' },
    { childId: 'brother', name: '一起吃大餐+看电影', cost: 200, type: 'xl', description: '大餐+电影' },
    { childId: 'brother', name: '周末自由一整天', cost: 200, type: 'xl', description: '周末自由安排一天' },

    // --- 弟弟奖励库 ---
    { childId: 'little', name: '选睡前故事', cost: 20, type: 'privilege', description: '选睡前故事' },
    { childId: 'little', name: '额外画画30分钟', cost: 20, type: 'privilege', description: '额外画画30分钟' },
    { childId: 'little', name: '和妈妈做手工', cost: 20, type: 'privilege', description: '和妈妈一起做手工' },
    { childId: 'little', name: '一起吃好吃的', cost: 40, type: 'small', description: '一起吃好吃的' },
    { childId: 'little', name: '买一本喜欢的书', cost: 40, type: 'small', description: '买一本喜欢的书' },
    { childId: 'little', name: '和妈妈看跟着书本去旅行1期', cost: 40, type: 'learning', description: '学习型：和妈妈看跟着书本去旅行1期' },
    { childId: 'little', name: '周末逛商场+买小画具/贴纸', cost: 60, type: 'medium', description: '逛商场买画具或贴纸' },
    { childId: 'little', name: '一起爬山', cost: 60, type: 'medium', description: '周末一起爬山' },
    { childId: 'little', name: '动物园', cost: 100, type: 'large', description: '去动物园' },
    { childId: 'little', name: '游乐场', cost: 100, type: 'large', description: '去游乐场' },
    { childId: 'little', name: '和妈妈一起做大手工', cost: 100, type: 'large', description: '和妈妈一起做大手工' },
    { childId: 'little', name: '一起吃大餐+逛书店买全套书', cost: 150, type: 'xl', description: '大餐+书店买全套书' },
    { childId: 'little', name: '周末自由一天', cost: 150, type: 'xl', description: '周末自由安排一天' },

    // --- 哥哥零花钱兑换（家务积分 → 钱，1元=10分） ---
    { childId: 'brother', name: '兑换5元零花钱', cost: 50, type: 'cash', description: '用家务积分换5元零花钱' },
    { childId: 'brother', name: '兑换10元零花钱', cost: 100, type: 'cash', description: '用家务积分换10元零花钱' },
    { childId: 'brother', name: '兑换20元零花钱', cost: 200, type: 'cash', description: '用家务积分换20元零花钱' },

    // --- 弟弟零花钱兑换（家务积分 → 钱，1元=10分） ---
    { childId: 'little', name: '兑换3元零花钱', cost: 30, type: 'cash', description: '用家务积分换3元零花钱' },
    { childId: 'little', name: '兑换5元零花钱', cost: 50, type: 'cash', description: '用家务积分换5元零花钱' },
    { childId: 'little', name: '兑换10元零花钱', cost: 100, type: 'cash', description: '用家务积分换10元零花钱' }
  ];

  /**
   * 默认设置
   */
  const DEFAULT_SETTINGS = {
    reminderTimes: ['07:00', '10:00', '12:00', '16:00'],
    completionBaseline: 0.6,
    pomodoroMinutes: 15,
    breakMinutes: 5
  };

  /**
   * 默认积分结构
   * current - 当前可用积分
   * total   - 累计获得积分
   * spent   - 已兑换消耗积分
   * history - 兑换历史
   */
  const DEFAULT_POINTS = {
    brother: { current: 0, total: 0, spent: 0, history: [] },
    little: { current: 0, total: 0, spent: 0, history: [] }
  };

  /**
   * 默认家务积分（可兑换零花钱，与学习积分分离，避免把学习"商品化"）
   * 仅 cashable:true 的任务会累加到这里
   */
  const DEFAULT_CASHABLE_POINTS = {
    brother: { current: 0, total: 0, spent: 0, history: [] },
    little: { current: 0, total: 0, spent: 0, history: [] }
  };

  /* ========================================================
   * 三、工具函数
   * ====================================================== */

  /**
   * 获取今天的日期字符串 (YYYY-MM-DD)
   * @returns {string}
   */
  function getTodayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 解析日期字符串为本地 Date 对象（避免时区偏移导致日期错误）
   */
  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    return new Date(dateStr + 'T00:00:00');
  }

  /**
   * 获取星期几（0=周日, 1=周一, ..., 6=周六）
   */
  function getDayOfWeek(dateStr) {
    return parseDate(dateStr).getDay();
  }

  /**
   * 将日期字符串加上/减去天数
   */
  function shiftDate(dateStr, offset) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 判断日期是否在范围内（含边界）
   * @param {string} dateStr
   * @param {Array<string>} range - [start, end]
   * @returns {boolean}
   */
  function isDateInRange(dateStr, range) {
    if (!range || range.length < 2) return false;
    return dateStr >= range[0] && dateStr <= range[1];
  }

  /**
   * 获取某日期所在周的周一日期
   */
  function getWeekStart(dateStr) {
    const d = parseDate(dateStr);
    const day = d.getDay();
    // 周日=0 转为 7，确保周一为 1
    const diff = (day === 0 ? 7 : day) - 1;
    return shiftDate(dateStr, -diff);
  }

  /**
   * 获取某日期所在周的每一天（周一到周日）
   * @param {string} dateStr
   * @returns {Array<string>}
   */
  function getWeekDates(dateStr) {
    const monday = getWeekStart(dateStr);
    return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  }

  /**
   * 判断模板是否属于该孩子（'both' 对两个孩子都适用）
   * @param {string} childId
   * @param {string} templateChildId
   * @returns {boolean}
   */
  function isTemplateForChild(childId, templateChildId) {
    return templateChildId === childId || templateChildId === 'both';
  }

  /* ========================================================
   * 3.5、IndexedDB 底层封装（冗余持久化，防止 localStorage 被清丢数据）
   * ====================================================== */
  const IDB_NAME = 'ssm-db-v1';
  const IDB_STORE = 'kv';
  const IDB_DATA_KEY = 'all';

  function _idbOpen() {
    return new Promise((resolve, reject) => {
      try {
        if (!global.indexedDB) { reject(new Error('no indexedDB')); return; }
        const req = global.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('idb open error'));
      } catch (e) { reject(e); }
    });
  }

  function _idbPut(key, value) {
    return _idbOpen().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => { try { db.close(); } catch (e) {} resolve(true); };
        tx.onerror = () => { try { db.close(); } catch (e) {} reject(tx.error); };
        tx.onabort = () => { try { db.close(); } catch (e) {} reject(tx.error || new Error('idb abort')); };
      } catch (e) { try { db.close(); } catch (e2) {} reject(e); }
    }));
  }

  function _idbGet(key) {
    return _idbOpen().then(db => new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => { try { db.close(); } catch (e) {} resolve(req.result); };
        req.onerror = () => { try { db.close(); } catch (e) {} reject(req.error); };
      } catch (e) { try { db.close(); } catch (e2) {} reject(e); }
    }));
  }

  /* ========================================================
   * 四、Store 类
   * ====================================================== */

  /**
   * Store - 核心数据管理类
   */
  class Store {
    constructor() {
      // 内存缓存
      this.children = [];
      this.activities = [];
      this.taskTemplates = [];
      this.taskInstances = {}; // { 'YYYY-MM-DD': [instance, ...] }
      this.points = JSON.parse(JSON.stringify(DEFAULT_POINTS));
      this.rewards = [];
      this.settings = {};
      this.progressLog = [];
      this.deletedTemplateIds = []; // 已删除的任务模板 id（防止默认任务被自动修复复活）
      this.cashablePoints = JSON.parse(JSON.stringify(DEFAULT_CASHABLE_POINTS)); // 家务积分（可兑换零花钱，与学习积分分离）
      this._lsAvailable = true; // localStorage 可用性标记（被浏览器/隐私模式禁用时置 false）
    }

    /* ----------------------------------------------------
     * 初始化
     * -------------------------------------------------- */

    /**
     * 初始化数据（首次使用时填充默认数据，旧数据自动修复升级）
     */
    init() {
      const hasData = localStorage.getItem(STORAGE_KEYS.CHILDREN);
      const savedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
      const needsRepair = !savedVersion || savedVersion !== DATA_VERSION;

      if (hasData && !needsRepair) {
        // 数据版本一致，直接加载
        this.load();
        // 即使版本一致，也要检查关键数据是否完整（防止之前保存了空数组）
        if (this._needsDataRepair()) {
          console.log('[Store] 关键数据不完整，自动修复...');
          this._repairData();
          this.save();
        }
      } else if (hasData && needsRepair) {
        // 有旧数据但版本不匹配：保留用户数据（积分、实例、日志），修复模板和奖励
        this.load();
        this._repairData();
        this.save();
      } else {
        // 首次使用，填充默认数据
        this._resetToDefaults();
      }

      // 启动 IndexedDB 冗余同步：备份当前数据，并在 localStorage 缺失时自动恢复
      this._syncIdb();
    }

    /**
     * 检查关键数据是否需要修复（children/taskTemplates/rewards 为空或损坏）
     * @returns {boolean}
     */
    _needsDataRepair() {
      const hasChildren = Array.isArray(this.children) && this.children.length > 0;
      const hasTemplates = Array.isArray(this.taskTemplates) && this.taskTemplates.length >= 3;
      const hasRewards = Array.isArray(this.rewards) && this.rewards.length > 0;
      const hasPoints = this.points && typeof this.points === 'object' &&
        this.points.brother && typeof this.points.brother === 'object';
      return !hasChildren || !hasTemplates || !hasRewards || !hasPoints;
    }

    /**
     * 重置为默认数据（首次使用或手动重置）
     */
    _resetToDefaults() {
      this.children = JSON.parse(JSON.stringify(DEFAULT_CHILDREN));
      this.activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
      this.taskTemplates = JSON.parse(JSON.stringify(DEFAULT_TASK_TEMPLATES));
      this.points = JSON.parse(JSON.stringify(DEFAULT_POINTS));
      this.rewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.taskInstances = {};
      this.progressLog = [];
      this.deletedTemplateIds = [];
      this.cashablePoints = JSON.parse(JSON.stringify(DEFAULT_CASHABLE_POINTS));
      localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
      this.save();
    }

    /**
     * 修复旧数据：保留积分、实例、日志，重新填充模板和奖励
     */
    _repairData() {
      console.log('[Store] 检测到数据版本变化，正在自动修复...');

      // 如果模板丢失/为空/或明显损坏（数量远少于默认），强制重新填充默认模板
      const defaultTemplateCount = DEFAULT_TASK_TEMPLATES.length;
      const hasValidTemplates = Array.isArray(this.taskTemplates) &&
        this.taskTemplates.length > 0 &&
        this.taskTemplates.length >= Math.max(3, Math.floor(defaultTemplateCount * 0.4));
      if (!hasValidTemplates) {
        console.log('[Store] 任务模板缺失或损坏，重新填充默认模板');
        this.taskTemplates = JSON.parse(JSON.stringify(DEFAULT_TASK_TEMPLATES));
      } else {
        // 合并：保留用户自定义任务(custom:true)，移除废弃默认模板，更新已有默认模板，补充新增默认模板
        const defaultTemplateIds = new Set(DEFAULT_TASK_TEMPLATES.map(t => t.id));
        const defaultTemplates = JSON.parse(JSON.stringify(DEFAULT_TASK_TEMPLATES));
        const defaultTemplatesMap = new Map(defaultTemplates.map(t => [t.id, t]));

        // 1) 移除已废弃的默认模板（不在默认列表中、且非用户自定义）
        this.taskTemplates = this.taskTemplates.filter(t => {
          if (t.custom) return true; // 用户手动添加的任务始终保留
          return defaultTemplateIds.has(t.id); // 保留仍在默认列表中的模板
        });

        // 2) 更新现有默认模板到最新属性（如 daily → dateRange、积分调整等）
        this.taskTemplates = this.taskTemplates.map(t => {
          if (t.custom) return t;
          const latest = defaultTemplatesMap.get(t.id);
          return latest ? JSON.parse(JSON.stringify(latest)) : t;
        });

        // 3) 补充默认模板中新增的（如合并后的 chao_summary）
        const existingIds = new Set(this.taskTemplates.map(t => t.id));
        defaultTemplates.forEach(t => {
          if (!existingIds.has(t.id)) {
            this.taskTemplates.push(t);
          }
        });

        // 4) 移除已被用户删除的默认模板（防止自动修复/版本升级时复活）
        if (this.deletedTemplateIds && this.deletedTemplateIds.length > 0) {
          const delSet = new Set(this.deletedTemplateIds);
          this.taskTemplates = this.taskTemplates.filter(t => !delSet.has(t.id));
        }
      }

      // 无论走哪个分支，最后都剔除已被用户删除的模板（防止整体重填时复活）
      if (this.deletedTemplateIds && this.deletedTemplateIds.length > 0) {
        const delSet = new Set(this.deletedTemplateIds);
        this.taskTemplates = this.taskTemplates.filter(t => !delSet.has(t.id));
      }

      // 5) 把用户自定义但名字属于已知家务的模板也标记为 cashable（兼容旧手动添加的家务任务）
      this.taskTemplates = this.taskTemplates.map(t => {
        if (t.cashable) return t;
        const isChoreName = KNOWN_CHORE_NAMES.some(name => (t.name || '').includes(name));
        if (isChoreName) {
          return { ...t, cashable: true };
        }
        return t;
      });

      // 如果奖励丢失/为空，重新填充默认奖励
      if (!this.rewards || this.rewards.length === 0) {
        console.log('[Store] 奖励库缺失，重新填充默认奖励');
        this.rewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
      } else {
        // 合并默认奖励
        const defaultRewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
        const existingRewardKeys = new Set(this.rewards.map(r => `${r.childId}_${r.name}`));
        defaultRewards.forEach(r => {
          if (!existingRewardKeys.has(`${r.childId}_${r.name}`)) {
            this.rewards.push(r);
          }
        });
      }

      // 确保设置包含所有默认字段
      const defaultSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.settings = Object.assign({}, defaultSettings, this.settings || {});

      // 确保积分结构正确（兼容旧版数字格式）
      if (!this.points || typeof this.points !== 'object') {
        this.points = JSON.parse(JSON.stringify(DEFAULT_POINTS));
      }
      // 旧版是 { brother: number, little: number }，迁移为对象结构
      ['brother', 'little'].forEach(cid => {
        if (typeof this.points[cid] === 'number') {
          const oldVal = this.points[cid] || 0;
          this.points[cid] = { current: oldVal, total: oldVal, spent: 0, history: [] };
        } else if (!this.points[cid] || typeof this.points[cid] !== 'object') {
          this.points[cid] = { current: 0, total: 0, spent: 0, history: [] };
        } else {
          this.points[cid].current = this.points[cid].current || 0;
          this.points[cid].total = this.points[cid].total || 0;
          this.points[cid].spent = this.points[cid].spent || 0;
          this.points[cid].history = this.points[cid].history || [];
        }
      });

      // 确保家务积分结构正确（与学习积分分离）
      if (!this.cashablePoints || typeof this.cashablePoints !== 'object') {
        this.cashablePoints = JSON.parse(JSON.stringify(DEFAULT_CASHABLE_POINTS));
      }
      ['brother', 'little'].forEach(cid => {
        if (typeof this.cashablePoints[cid] === 'number') {
          const oldVal = this.cashablePoints[cid] || 0;
          this.cashablePoints[cid] = { current: oldVal, total: oldVal, spent: 0, history: [] };
        } else if (!this.cashablePoints[cid] || typeof this.cashablePoints[cid] !== 'object') {
          this.cashablePoints[cid] = { current: 0, total: 0, spent: 0, history: [] };
        } else {
          this.cashablePoints[cid].current = this.cashablePoints[cid].current || 0;
          this.cashablePoints[cid].total = this.cashablePoints[cid].total || 0;
          this.cashablePoints[cid].spent = this.cashablePoints[cid].spent || 0;
          this.cashablePoints[cid].history = this.cashablePoints[cid].history || [];
        }
      });

      // 确保 children 完整且关键字段正确（如 examDate 可能被旧数据覆盖）
      if (!this.children || this.children.length === 0) {
        this.children = JSON.parse(JSON.stringify(DEFAULT_CHILDREN));
      } else {
        // 合并默认孩子数据：确保 examDate 等关键字段不会被清空
        const defaultChildren = JSON.parse(JSON.stringify(DEFAULT_CHILDREN));
        defaultChildren.forEach(dc => {
          const existing = this.children.find(c => c.id === dc.id);
          if (!existing) {
            this.children.push(dc);
          } else {
            // 如果现有数据缺少关键字段，用默认值补齐
            if (!existing.examDate) existing.examDate = dc.examDate;
            if (!existing.grade) existing.grade = dc.grade;
            if (!existing.age) existing.age = dc.age;
            if (!existing.name) existing.name = dc.name;
            if (!existing.interests || existing.interests.length === 0) existing.interests = dc.interests;
          }
        });
      }

      // 确保 activities 完整
      if (!this.activities || this.activities.length === 0) {
        this.activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
      }

      // 保留用户已有任务实例（勾选记录、自定义任务），不再一刀切清空
      if (!this.taskInstances || typeof this.taskInstances !== 'object') {
        this.taskInstances = {};
      }

      // 清理已不存在的模板对应的实例（如模板合并/删除后残留的 orphan 实例）
      const validTemplateIds = new Set(this.taskTemplates.map(t => t.id));
      Object.keys(this.taskInstances).forEach(dateStr => {
        this.taskInstances[dateStr] = this.taskInstances[dateStr].filter(inst => {
          return validTemplateIds.has(inst.templateId);
        });
      });

      // 同步所有实例的 cashable 标记（根据当前模板属性，避免旧实例走错积分池）
      Object.keys(this.taskInstances).forEach(dateStr => {
        this.taskInstances[dateStr].forEach(inst => {
          const tmpl = this.getTaskTemplateById(inst.templateId);
          if (tmpl) {
            inst.cashable = !!(tmpl.cashable || inst.cashable);
          }
        });
      });

      localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
      console.log('[Store] 数据修复完成');
    }

    /**
     * 清空所有数据并重新初始化
     */
    clearAllData() {
      this._resetToDefaults();
    }

    /* ----------------------------------------------------
     * localStorage 读写
     * -------------------------------------------------- */

    /**
     * 保存所有数据到 localStorage
     */
    save() {
      let lsOk = false;
      if (this._lsAvailable !== false) {
        try {
          localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
          localStorage.setItem(STORAGE_KEYS.CHILDREN, JSON.stringify(this.children));
          localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(this.activities));
          localStorage.setItem(STORAGE_KEYS.TASK_TEMPLATES, JSON.stringify(this.taskTemplates));
          localStorage.setItem(STORAGE_KEYS.TASK_INSTANCES, JSON.stringify(this.taskInstances));
          localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(this.points));
          localStorage.setItem(STORAGE_KEYS.REWARDS, JSON.stringify(this.rewards));
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
          localStorage.setItem(STORAGE_KEYS.PROGRESS_LOG, JSON.stringify(this.progressLog));
          localStorage.setItem(STORAGE_KEYS.DELETED_TEMPLATES, JSON.stringify(this.deletedTemplateIds));
          localStorage.setItem(STORAGE_KEYS.CASHABLE_POINTS, JSON.stringify(this.cashablePoints));
          lsOk = true;
        } catch (e) {
          // localStorage 被浏览器/隐私模式/WebView 禁用或写入失败时，标记为不可用
          console.warn('[Store] localStorage 不可用（可能被清除），已自动切换到 IndexedDB 持久化:', e);
          this._lsAvailable = false;
        }
      }
      // 异步冗余备份到 IndexedDB：比 localStorage 更可靠，能在被清时自动恢复
      this._backupToIdb();
      return lsOk;
    }

    /* ----------------------------------------------------
     * IndexedDB 冗余持久化（防止 localStorage 被清导致积分清零）
     * -------------------------------------------------- */

    /**
     * 序列化全部数据为单一对象
     */
    _serializeAll() {
      return {
        version: DATA_VERSION,
        children: this.children,
        activities: this.activities,
        taskTemplates: this.taskTemplates,
        taskInstances: this.taskInstances,
        points: this.points,
        rewards: this.rewards,
        settings: this.settings,
        progressLog: this.progressLog,
        deletedTemplateIds: this.deletedTemplateIds,
        cashablePoints: this.cashablePoints
      };
    }

    /**
     * 从序列化对象还原全部数据
     */
    _deserializeAll(data) {
      if (!data) return;
      this.children = data.children || [];
      this.activities = data.activities || [];
      this.taskTemplates = data.taskTemplates || [];
      this.taskInstances = data.taskInstances || {};
      this.points = data.points || JSON.parse(JSON.stringify(DEFAULT_POINTS));
      this.rewards = data.rewards || [];
      this.settings = data.settings || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.progressLog = data.progressLog || [];
      this.deletedTemplateIds = data.deletedTemplateIds || [];
      this.cashablePoints = data.cashablePoints || JSON.parse(JSON.stringify(DEFAULT_CASHABLE_POINTS));
    }

    /**
     * 异步备份到 IndexedDB（不阻塞 UI）
     */
    _backupToIdb() {
      _idbPut(IDB_DATA_KEY, this._serializeAll()).catch(e => {
        console.warn('[Store] IndexedDB 备份失败（可忽略）:', e);
      });
    }

    /**
     * 启动时的 IndexedDB 同步：
     * 1) 把当前内存数据（来自 localStorage）备份到 IDB，保证 IDB 始终是最新镜像
     * 2) 若 localStorage 没有数据（被清），从 IDB 恢复，避免「全新打开积分清零」
     */
    _syncIdb() {
      // 1) 始终先备份当前数据到 IDB（即使来自 localStorage，也确保 IDB 镜像最新）
      this._backupToIdb();

      // 2) localStorage 缺失或被标记为不可用时，尝试从 IDB 恢复
      const lsEmpty = this._lsAvailable === false || !localStorage.getItem(STORAGE_KEYS.CHILDREN);
      if (lsEmpty) {
        _idbGet(IDB_DATA_KEY).then(data => {
          if (data && Array.isArray(data.children) && data.children.length > 0) {
            console.log('[Store] 检测到 localStorage 数据缺失，正从 IndexedDB 恢复...');
            this._deserializeAll(data);
            const lsOk = this.save(); // 尝试写回 localStorage（若可用）
            if (lsOk) {
              // localStorage 可用：写回后一次性刷新页面，让所有页面用真实数据重新渲染
              if (!sessionStorage.getItem('ssm_idb_recovered')) {
                sessionStorage.setItem('ssm_idb_recovered', '1');
                setTimeout(() => { window.location.reload(); }, 80);
              } else {
                window.dispatchEvent(new Event('ssm:data-restored'));
              }
            } else {
              // localStorage 不可用：用内存中的恢复数据原地重渲染
              window.dispatchEvent(new Event('ssm:data-restored'));
            }
          }
        }).catch(() => {});
      }
    }

    /**
     * 从 localStorage 加载所有数据
     */
    load() {
      try {
        this.children = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHILDREN)) || [];
        this.activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || [];
        this.taskTemplates = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASK_TEMPLATES)) || [];
        this.taskInstances = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASK_INSTANCES)) || {};
        this.points = JSON.parse(localStorage.getItem(STORAGE_KEYS.POINTS)) || JSON.parse(JSON.stringify(DEFAULT_POINTS));
        this.rewards = JSON.parse(localStorage.getItem(STORAGE_KEYS.REWARDS)) || [];
        this.settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
        this.progressLog = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS_LOG)) || [];
        this.deletedTemplateIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_TEMPLATES)) || [];
        this.cashablePoints = JSON.parse(localStorage.getItem(STORAGE_KEYS.CASHABLE_POINTS)) || JSON.parse(JSON.stringify(DEFAULT_CASHABLE_POINTS));
        return true;
      } catch (e) {
        console.error('[Store] 加载失败:', e);
        return false;
      }
    }

    /* ----------------------------------------------------
     * 孩子相关方法
     * -------------------------------------------------- */

    /**
     * 获取孩子列表
     * @returns {Array}
     */
    getChildren() {
      return this.children;
    }

    /**
     * 根据 id 获取单个孩子
     * @param {string} id
     * @returns {Object|null}
     */
    getChildById(id) {
      return this.children.find(c => c.id === id) || null;
    }

    /* ----------------------------------------------------
     * 固定活动相关方法
     * -------------------------------------------------- */

    /**
     * 获取某天某孩子的固定活动
     * @param {string} childId - 孩子 id
     * @param {string} dateStr - 日期字符串 YYYY-MM-DD
     * @returns {Array}
     */
    getActivities(childId, dateStr) {
      if (!dateStr) dateStr = getTodayStr();
      const dayOfWeek = getDayOfWeek(dateStr);

      return this.activities.filter(activity => {
        // 判断活动是否属于该孩子（'both' 表示两个孩子都适用）
        if (activity.childId !== childId && activity.childId !== 'both') return false;

        // 日期范围判断（如果有 dateRange）
        if (activity.dateRange) {
          if (!isDateInRange(dateStr, activity.dateRange)) return false;
        }

        // 星期判断（如果有 days 数组）
        if (activity.days && activity.days.length > 0) {
          if (!activity.days.includes(dayOfWeek)) return false;
        }

        return true;
      });
    }

    /* ----------------------------------------------------
     * 任务模板相关方法
     * -------------------------------------------------- */

    /**
     * 获取某孩子的任务模板
     * @param {string} childId
     * @returns {Array}
     */
    getTaskTemplates(childId) {
      return this.taskTemplates.filter(t => isTemplateForChild(childId, t.childId));
    }

    /**
     * 根据 id 获取任务模板
     * @param {string} templateId
     * @returns {Object|null}
     */
    getTaskTemplateById(templateId) {
      return this.taskTemplates.find(t => t.id === templateId) || null;
    }

    /**
     * 删除任务模板（及其所有日期下的任务实例）
     * - 自定义任务：直接移除，不会复活
     * - 默认任务：加入 deletedTemplateIds，防止自动修复/版本升级时复活
     * 注意：已获得的积分不会被扣回（保护孩子已得成果）
     * @param {string} templateId
     * @returns {boolean}
     */
    deleteTaskTemplate(templateId) {
      const idx = this.taskTemplates.findIndex(t => t.id === templateId);
      if (idx === -1) return false;

      // 从模板列表移除
      this.taskTemplates.splice(idx, 1);

      // 记录删除，防止默认任务被 _repairData 复活
      if (!this.deletedTemplateIds) this.deletedTemplateIds = [];
      if (!this.deletedTemplateIds.includes(templateId)) {
        this.deletedTemplateIds.push(templateId);
      }

      // 删除所有日期下引用该模板的实例
      for (const dateStr in this.taskInstances) {
        const arr = this.taskInstances[dateStr];
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].templateId === templateId) arr.splice(i, 1);
        }
      }

      this.save();
      return true;
    }

    /* ----------------------------------------------------
     * 每日任务实例相关方法
     * -------------------------------------------------- */

    /**
     * 判断某模板在某日是否应该生成任务实例
     * @param {Object} template - 任务模板
     * @param {string} dateStr - 日期字符串
     * @returns {boolean}
     */
    _shouldGenerateOnDate(template, dateStr) {
      switch (template.frequency) {
        case TASK_FREQUENCY.DAILY:
          // 每日任务，暑假期间每天都生成
          return true;

        case TASK_FREQUENCY.ONE_TIME:
          // 一次性任务，不自动按日期生成（需手动创建）
          return false;

        case TASK_FREQUENCY.WEEKLY:
          // 周任务：在周一生成（用户可以在本周任意一天完成）
          return getDayOfWeek(dateStr) === 1;

        case TASK_FREQUENCY.DATE_RANGE:
          // 日期范围任务：在范围内每天生成
          return isDateInRange(dateStr, template.dateRange);

        case TASK_FREQUENCY.MILESTONE:
          // 里程碑任务：不自动生成
          return false;

        default:
          return false;
      }
    }

    /**
     * 检查依赖任务是否已完成
     * @param {string} childId
     * @param {string} dependsOnId - 依赖的任务模板 id
     * @returns {boolean} - 依赖任务是否已完成
     */
    _isDependencyCompleted(childId, dependsOnId) {
      if (!dependsOnId) return true;

      // 在所有日期的任务实例中查找依赖任务
      for (const dateStr in this.taskInstances) {
        const instances = this.taskInstances[dateStr];
        const depInstance = instances.find(
          inst => inst.templateId === dependsOnId &&
                  (inst.childId === childId || inst.childId === 'both')
        );
        if (depInstance && (depInstance.status === TASK_STATUS.COMPLETED || depInstance.status === TASK_STATUS.PARTIAL)) {
          return true;
        }
      }
      return false;
    }

    /**
     * 检查 oneTime 任务是否已完成（避免重复生成）
     * @param {string} templateId
     * @returns {boolean}
     */
    _isOneTimeTaskCompleted(templateId) {
      for (const dateStr in this.taskInstances) {
        const instances = this.taskInstances[dateStr];
        const inst = instances.find(i => i.templateId === templateId);
        if (inst && inst.status === TASK_STATUS.COMPLETED) {
          return true;
        }
      }
      return false;
    }

    /**
     * 确保某天的任务实例已生成
     * 包含顺延逻辑：检查昨日未完成的 daily 任务，自动添加到今日
     * @param {string} childId
     * @param {string} dateStr
     */
    _ensureInstancesForDate(childId, dateStr) {
      if (!this.taskInstances[dateStr]) {
        this.taskInstances[dateStr] = [];
      }

      const todayInstances = this.taskInstances[dateStr];
      const yesterdayStr = shiftDate(dateStr, -1);

      // 清理因模板调整而不应再出现的旧实例（保留自定义、已完成、顺延任务）
      for (let i = todayInstances.length - 1; i >= 0; i--) {
        const inst = todayInstances[i];
        // 只处理当前孩子的实例
        if (!isTemplateForChild(childId, inst.childId) && inst.childId !== childId) {
          continue;
        }
        // 已完成/部分完成的不清理；顺延任务不清理；自定义任务不清理
        if (inst.status === TASK_STATUS.COMPLETED || inst.status === TASK_STATUS.PARTIAL) continue;
        if (inst.carryOver) continue;

        const template = this.getTaskTemplateById(inst.templateId);
        // 模板已被删除，清理实例
        if (!template) {
          todayInstances.splice(i, 1);
          continue;
        }
        // 自定义模板始终保留
        if (template.custom) continue;
        // 模板今天按规则不应生成，清理
        if (!this._shouldGenerateOnDate(template, dateStr)) {
          todayInstances.splice(i, 1);
        }
      }

      // 检查昨日未完成的 daily 任务，顺延到今日
      if (this.taskInstances[yesterdayStr]) {
        const yesterdayInstances = this.taskInstances[yesterdayStr];
        yesterdayInstances.forEach(yInst => {
          if (!isTemplateForChild(childId, yInst.childId) && yInst.childId !== childId) {
            // 跳过不属于该孩子的任务
            // 注意 'both' 任务需要给两个孩子都生成
            if (yInst.childId !== 'both') return;
          }

          const template = this.getTaskTemplateById(yInst.templateId);
          if (!template) return;

          // 仅 daily 任务的未完成状态才顺延
          if (template.frequency === TASK_FREQUENCY.DAILY) {
            if (yInst.status === TASK_STATUS.PENDING || yInst.status === TASK_STATUS.PARTIAL) {
              // 检查今日是否已有该模板的顺延实例
              const exists = todayInstances.find(
                i => i.templateId === yInst.templateId &&
                     (i.childId === childId || i.childId === 'both' || yInst.childId === 'both')
              );
              if (!exists) {
                todayInstances.push({
                  id: `instance_${dateStr}_${yInst.templateId}`,
                  templateId: yInst.templateId,
                  childId: yInst.childId,
                  date: dateStr,
                  status: TASK_STATUS.PENDING,
                  completedPercentage: yInst.completedPercentage || 0,
                  pointsEarned: 0,
                  carryOver: true,
                  cashable: !!template.cashable,
                  note: '从昨日顺延'
                });
              }
            }
          }
        });
      }

      // 为今天应生成的任务创建实例
      const templates = this.getTaskTemplates(childId);
      templates.forEach(template => {
        if (!this._shouldGenerateOnDate(template, dateStr)) return;

        // 检查依赖：如果依赖任务未完成，不生成该任务
        if (template.dependsOn && !this._isDependencyCompleted(childId, template.dependsOn)) {
          return;
        }

        // oneTime 任务如果已完成，不再生成
        if (template.frequency === TASK_FREQUENCY.ONE_TIME && this._isOneTimeTaskCompleted(template.id)) {
          return;
        }

        // 检查今日是否已有该模板的实例
        const exists = todayInstances.find(i => i.templateId === template.id);
        if (!exists) {
          todayInstances.push({
            id: `instance_${dateStr}_${template.id}`,
            templateId: template.id,
            childId: template.childId,
            date: dateStr,
            status: TASK_STATUS.PENDING,
            completedPercentage: 0,
            pointsEarned: 0,
            carryOver: false,
            cashable: !!template.cashable,
            note: ''
          });
        }
      });

      this.save();
    }

    /**
     * 获取今天的任务实例（含顺延）
     * @param {string} childId
     * @returns {Array}
     */
    getTodayTasks(childId) {
      const todayStr = getTodayStr();
      this._ensureInstancesForDate(childId, todayStr);

      return this.taskInstances[todayStr].filter(inst => {
        if (!isTemplateForChild(childId, inst.childId) && inst.childId !== childId) {
          return false;
        }
        return true;
      });
    }

    /**
     * 获取某天某孩子的任务实例
     * @param {string} childId
     * @param {string} dateStr
     * @returns {Array}
     */
    getDateTasks(childId, dateStr) {
      this._ensureInstancesForDate(childId, dateStr);

      return (this.taskInstances[dateStr] || []).filter(inst => {
        return isTemplateForChild(childId, inst.childId);
      });
    }

    /**
     * 根据实例 id 获取任务实例
     * @param {string} instanceId
     * @returns {Object|null}
     */
    getTaskInstanceById(instanceId) {
      for (const dateStr in this.taskInstances) {
        const inst = this.taskInstances[dateStr].find(i => i.id === instanceId);
        if (inst) return inst;
      }
      return null;
    }

    /* ----------------------------------------------------
     * 任务完成相关方法
     * -------------------------------------------------- */

    /**
     * 标记任务完成
     * @param {string} taskInstanceId - 任务实例 id
     * @param {number} percentage - 完成百分比（1=完全完成, 0.5=部分完成）
     */
    markComplete(taskInstanceId, percentage = 1) {
      const instance = this.getTaskInstanceById(taskInstanceId);
      if (!instance) {
        console.error('[Store] 未找到任务实例:', taskInstanceId);
        return false;
      }

      const template = this.getTaskTemplateById(instance.templateId);
      if (!template) {
        console.error('[Store] 未找到任务模板:', instance.templateId);
        return false;
      }

      const wasCompleted = instance.status === TASK_STATUS.COMPLETED;
      const oldPoints = instance.pointsEarned || 0;

      if (percentage >= 1) {
        instance.status = TASK_STATUS.COMPLETED;
        instance.completedPercentage = 1;
        instance.pointsEarned = template.points;
      } else if (percentage > 0) {
        instance.status = TASK_STATUS.PARTIAL;
        instance.completedPercentage = percentage;
        instance.pointsEarned = Math.round(template.points * percentage);
      } else {
        // percentage = 0 视为未完成
        return this.markIncomplete(taskInstanceId);
      }

      // 积分调整：只增加增量（total/current 同时增加）
      // cashable 任务（家务）计入家务积分池，其余计入学习积分池
      const delta = instance.pointsEarned - oldPoints;
      const isCashable = instance.cashable ?? template.cashable;
      if (!wasCompleted && delta !== 0) {
        const targetChildren = instance.childId === 'both' ? ['brother', 'little'] : [instance.childId];
        targetChildren.forEach(cid => {
          if (isCashable) {
            this.earnCashablePoints(cid, delta);
          } else {
            this.earnPoints(cid, delta);
          }
        });
      }

      // 记录进度日志
      this._logProgress({
        type: 'task_complete',
        childId: instance.childId,
        instanceId: taskInstanceId,
        templateId: instance.templateId,
        taskName: template.name,
        percentage: instance.completedPercentage,
        points: instance.pointsEarned - oldPoints,
        date: getTodayStr(),
        timestamp: Date.now()
      });

      this.save();
      return true;
    }

    /**
     * 标记任务未完成（顺延到次日）
     * @param {string} taskInstanceId
     */
    markIncomplete(taskInstanceId) {
      const instance = this.getTaskInstanceById(taskInstanceId);
      if (!instance) {
        console.error('[Store] 未找到任务实例:', taskInstanceId);
        return false;
      }

      const template = this.getTaskTemplateById(instance.templateId);
      if (!template) return false;

      // 如果之前已完成，扣除积分（current 和 total 都回退）——按任务类型回退到对应积分池
      if (instance.status === TASK_STATUS.COMPLETED || instance.status === TASK_STATUS.PARTIAL) {
        const refund = instance.pointsEarned || 0;
        const isCashable = instance.cashable ?? template.cashable;
        if (refund > 0) {
          const targetChildren = instance.childId === 'both' ? ['brother', 'little'] : [instance.childId];
          targetChildren.forEach(cid => {
            const pool = isCashable ? this.cashablePoints : this.points;
            if (pool[cid]) {
              pool[cid].current -= refund;
              pool[cid].total -= refund;
              if (pool[cid].current < 0) pool[cid].current = 0;
              if (pool[cid].total < 0) pool[cid].total = 0;
            }
          });
        }
      }

      instance.status = TASK_STATUS.PENDING;
      instance.completedPercentage = 0;
      instance.pointsEarned = 0;

      // 记录进度日志
      this._logProgress({
        type: 'task_incomplete',
        childId: instance.childId,
        instanceId: taskInstanceId,
        templateId: instance.templateId,
        taskName: template.name,
        date: getTodayStr(),
        timestamp: Date.now()
      });

      this.save();
      return true;
    }

    /**
     * 跳过任务（不顺延）
     * @param {string} taskInstanceId
     */
    skipTask(taskInstanceId) {
      const instance = this.getTaskInstanceById(taskInstanceId);
      if (!instance) return false;

      const template = this.getTaskTemplateById(instance.templateId);
      if (!template) return false;

      instance.status = TASK_STATUS.SKIPPED;
      instance.completedPercentage = 0;
      instance.pointsEarned = 0;

      this._logProgress({
        type: 'task_skip',
        childId: instance.childId,
        instanceId: taskInstanceId,
        templateId: instance.templateId,
        taskName: template.name,
        date: getTodayStr(),
        timestamp: Date.now()
      });

      this.save();
      return true;
    }

    /* ----------------------------------------------------
     * 积分相关方法
     * -------------------------------------------------- */

    /**
     * 增加/扣减当前积分（不累计 total，用于手动调整）
     * @param {string} childId
     * @param {number} points - 可为负数（扣减）
     */
    addPoints(childId, points) {
      if (!this.points[childId] || typeof this.points[childId] !== 'object') {
        this.points[childId] = { current: 0, total: 0, spent: 0, history: [] };
      }
      this.points[childId].current += points;
      if (this.points[childId].current < 0) this.points[childId].current = 0;
      this.save();
    }

    /**
     * 赚取积分（完成任务）- 同时增加 current 和 total
     * @param {string} childId
     * @param {number} points
     */
    earnPoints(childId, points) {
      if (!this.points[childId] || typeof this.points[childId] !== 'object') {
        this.points[childId] = { current: 0, total: 0, spent: 0, history: [] };
      }
      this.points[childId].current += points;
      this.points[childId].total += points;
      if (this.points[childId].current < 0) this.points[childId].current = 0;
      if (this.points[childId].total < 0) this.points[childId].total = 0;
      this.save();
    }

    /**
     * 消费积分（兑换奖励）- 扣减 current，增加 spent 和历史记录
     * @param {string} childId
     * @param {number} cost
     * @param {string} description
     */
    spendPoints(childId, cost, description) {
      if (!this.points[childId] || typeof this.points[childId] !== 'object') {
        this.points[childId] = { current: 0, total: 0, spent: 0, history: [] };
      }
      this.points[childId].current -= cost;
      this.points[childId].spent += cost;
      if (this.points[childId].current < 0) this.points[childId].current = 0;
      this.points[childId].history.push({
        type: 'spend',
        description: description || '兑换奖励',
        amount: cost,
        date: getTodayStr(),
        timestamp: Date.now()
      });
      this.save();
    }

    /**
     * 获取当前可用积分
     * @param {string} childId
     * @returns {number}
     */
    getPoints(childId) {
      return (this.points[childId] && this.points[childId].current) || 0;
    }

    /**
     * 获取积分完整统计
     * @param {string} childId
     * @returns {{current:number, total:number, spent:number, history:Array}}
     */
    getPointsSummary(childId) {
      const p = this.points[childId] || { current: 0, total: 0, spent: 0, history: [] };
      return {
        current: p.current || 0,
        total: p.total || 0,
        spent: p.spent || 0,
        history: p.history || []
      };
    }

    /**
     * 累加家务积分（仅 cashable 任务调用）
     */
    earnCashablePoints(childId, points) {
      if (!this.cashablePoints[childId] || typeof this.cashablePoints[childId] !== 'object') {
        this.cashablePoints[childId] = { current: 0, total: 0, spent: 0, history: [] };
      }
      this.cashablePoints[childId].current += points;
      this.cashablePoints[childId].total += points;
      if (this.cashablePoints[childId].current < 0) this.cashablePoints[childId].current = 0;
      if (this.cashablePoints[childId].total < 0) this.cashablePoints[childId].total = 0;
      this.cashablePoints[childId].history.push({
        type: 'earn',
        description: '家务劳动',
        amount: points,
        date: getTodayStr(),
        timestamp: Date.now()
      });
      this.save();
    }

    /**
     * 消费家务积分（兑换零花钱）
     */
    spendCashablePoints(childId, cost, description) {
      if (!this.cashablePoints[childId] || typeof this.cashablePoints[childId] !== 'object') {
        this.cashablePoints[childId] = { current: 0, total: 0, spent: 0, history: [] };
      }
      this.cashablePoints[childId].current -= cost;
      this.cashablePoints[childId].spent += cost;
      if (this.cashablePoints[childId].current < 0) this.cashablePoints[childId].current = 0;
      this.cashablePoints[childId].history.push({
        type: 'spend',
        description: description || '兑换零花钱',
        amount: cost,
        date: getTodayStr(),
        timestamp: Date.now()
      });
      this.save();
    }

    /**
     * 获取当前可用家务积分
     */
    getCashablePoints(childId) {
      return (this.cashablePoints[childId] && this.cashablePoints[childId].current) || 0;
    }

    /**
     * 获取家务积分完整统计
     */
    getCashableSummary(childId) {
      const p = this.cashablePoints[childId] || { current: 0, total: 0, spent: 0, history: [] };
      return {
        current: p.current || 0,
        total: p.total || 0,
        spent: p.spent || 0,
        history: p.history || []
      };
    }

    /* ----------------------------------------------------
     * 统计相关方法
     * -------------------------------------------------- */

    /**
     * 获取本周统计
     * @param {string} childId
     * @returns {Object} { total, completed, partial, skipped, pending, completionRate, pointsEarned }
     */
    getWeeklyStats(childId) {
      const todayStr = getTodayStr();
      const weekDates = getWeekDates(todayStr);

      let total = 0;
      let completed = 0;
      let partial = 0;
      let skipped = 0;
      let pending = 0;
      let pointsEarned = 0;

      weekDates.forEach(dateStr => {
        const instances = this.getDateTasks(childId, dateStr);
        instances.forEach(inst => {
          total++;
          if (inst.status === TASK_STATUS.COMPLETED) {
            completed++;
            pointsEarned += inst.pointsEarned || 0;
          } else if (inst.status === TASK_STATUS.PARTIAL) {
            partial++;
            pointsEarned += inst.pointsEarned || 0;
          } else if (inst.status === TASK_STATUS.SKIPPED) {
            skipped++;
          } else {
            pending++;
          }
        });
      });

      const completionRate = total > 0 ? (completed + partial * 0.5) / total : 0;

      return {
        total,
        completed,
        partial,
        skipped,
        pending,
        completionRate,
        pointsEarned
      };
    }

    /**
     * 获取某天完成率
     * @param {string} childId
     * @param {string} dateStr
     * @returns {Object} { rate, total, completed, partial, pending, skipped }
     */
    getDailyCompletionRate(childId, dateStr) {
      if (!dateStr) dateStr = getTodayStr();
      const instances = this.getDateTasks(childId, dateStr);

      let total = instances.length;
      let completed = 0;
      let partial = 0;
      let skipped = 0;
      let pending = 0;

      instances.forEach(inst => {
        if (inst.status === TASK_STATUS.COMPLETED) {
          completed++;
        } else if (inst.status === TASK_STATUS.PARTIAL) {
          partial++;
        } else if (inst.status === TASK_STATUS.SKIPPED) {
          skipped++;
        } else {
          pending++;
        }
      });

      // 完成率：已完成 + 部分完成×0.5，跳过的不计入分母
      const effectiveTotal = total - skipped;
      const rate = effectiveTotal > 0 ? (completed + partial * 0.5) / effectiveTotal : 0;

      return { rate, total, completed, partial, pending, skipped };
    }

    /* ----------------------------------------------------
     * 奖励相关方法
     * -------------------------------------------------- */

    /**
     * 获取某孩子所有奖励
     * @param {string} childId
     * @returns {Array}
     */
    getRewards(childId) {
      return this.rewards.filter(r => r.childId === childId);
    }

    /**
     * 获取当前积分可兑换的奖励
     * @param {string} childId
     * @returns {Array}
     */
    getAvailableRewards(childId) {
      const currentPoints = this.getPoints(childId);
      return this.rewards
        .filter(r => r.childId === childId && r.cost <= currentPoints)
        .sort((a, b) => a.cost - b.cost);
    }

    /**
     * 兑换奖励
     * @param {string} childId
     * @param {number} rewardIndex - 奖励在列表中的索引
     * @returns {boolean}
     */
    redeemReward(childId, rewardIndex) {
      const childRewards = this.getRewards(childId);
      const reward = childRewards[rewardIndex];
      if (!reward) {
        console.error('[Store] 未找到奖励:', rewardIndex);
        return false;
      }

      // 零花钱奖励从家务积分池扣除，其余从学习积分池扣除
      const isCash = reward.type === 'cash';
      const currentPoints = isCash ? this.getCashablePoints(childId) : this.getPoints(childId);
      if (currentPoints < reward.cost) {
        console.error('[Store] 积分不足:', currentPoints, '/', reward.cost);
        return false;
      }

      if (isCash) {
        this.spendCashablePoints(childId, reward.cost, `兑换零花钱「${reward.name}」`);
      } else {
        this.spendPoints(childId, reward.cost, `兑换「${reward.name}」`);
      }

      // 记录进度日志
      this._logProgress({
        type: 'reward_redeem',
        childId,
        rewardName: reward.name,
        cost: reward.cost,
        isCash: isCash,
        date: getTodayStr(),
        timestamp: Date.now()
      });

      return true;
    }

    /* ----------------------------------------------------
     * 4 节点建议
     * -------------------------------------------------- */

    /**
     * 获取4节点选择建议
     * 根据时间段返回建议的任务
     * @param {string} childId
     * @param {string} timeSlot - morning/noon/afternoon/evening
     * @returns {Array}
     */
    getSuggestions(childId, timeSlot) {
      const todayStr = getTodayStr();
      const tasks = this.getTodayTasks(childId);
      const activities = this.getActivities(childId, todayStr);

      // 过滤出未完成的任务
      const pendingTasks = tasks.filter(t => t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.PARTIAL);

      // 时间段映射：根据任务时长和特性推荐
      // morning: 适合需要专注的任务（hardToStart 优先）
      // noon: 适合短任务
      // afternoon: 适合轻松任务
      // evening: 适合复习类任务

      const suggestions = [];

      pendingTasks.forEach(inst => {
        const template = this.getTaskTemplateById(inst.templateId);
        if (!template) return;

        let priority = 0;

        switch (timeSlot) {
          case TIME_SLOTS.MORNING:
            // 上午：优先难启动、高积分任务
            if (template.hardToStart) priority += 3;
            if (template.points >= 10) priority += 2;
            if (template.duration >= 30) priority += 1;
            break;
          case TIME_SLOTS.NOON:
            // 中午：优先短任务
            if (template.duration <= 15) priority += 3;
            if (template.points <= 8) priority += 1;
            break;
          case TIME_SLOTS.AFTERNOON:
            // 下午：优先轻松、游戏类任务
            if (template.flexible) priority += 2;
            if (template.duration <= 20) priority += 1;
            if (template.subject === 'other') priority += 1;
            break;
          case TIME_SLOTS.EVENING:
            // 晚上：优先复习、笔记类任务
            if (template.name.includes('笔记')) priority += 3;
            if (template.name.includes('英语')) priority += 2;
            if (template.name.includes('复习')) priority += 2;
            break;
        }

        // 检查是否与固定活动时间冲突
        const hasActivityConflict = activities.some(a => {
          // 简单判断：如果有固定活动占用了该时段
          if (timeSlot === TIME_SLOTS.MORNING && a.startTime < '12:00') return true;
          if (timeSlot === TIME_SLOTS.AFTERNOON && a.startTime >= '12:00' && a.startTime < '17:00') return true;
          if (timeSlot === TIME_SLOTS.EVENING && a.startTime >= '17:00') return true;
          return false;
        });

        if (hasActivityConflict && !template.flexible) {
          priority -= 1;
        }

        suggestions.push({
          instance: inst,
          template,
          priority
        });
      });

      // 按优先级排序
      suggestions.sort((a, b) => b.priority - a.priority);

      return suggestions;
    }

    /* ----------------------------------------------------
     * 进度日志
     * -------------------------------------------------- */

    /**
     * 记录进度日志（内部方法）
     * @param {Object} logEntry
     */
    _logProgress(logEntry) {
      this.progressLog.push(logEntry);
    }

    /**
     * 获取进度日志
     * @param {string} [childId] - 可选，按孩子筛选
     * @param {number} [limit] - 可选，限制条数
     * @returns {Array}
     */
    getProgressLog(childId, limit) {
      let logs = this.progressLog;
      if (childId) {
        logs = logs.filter(l => l.childId === childId);
      }
      if (limit) {
        logs = logs.slice(-limit);
      }
      return logs;
    }

    /* ----------------------------------------------------
     * 分班考倒计时
     * -------------------------------------------------- */

    /**
     * 获取分班考倒计时天数
     * @returns {number|null} - 天数（无考试日期返回 null）
     */
    getExamCountdown() {
      const brother = this.getChildById('brother');
      if (!brother || !brother.examDate) return null; // null = 未设置考试日期

      const examDate = parseDate(brother.examDate);
      const today = parseDate(getTodayStr());

      // 计算天数差
      const diffTime = examDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 返回正数（剩余天数）或 0（今天及已过期）
      return diffDays > 0 ? diffDays : 0;
    }

    /**
     * 设置哥哥分班考日期（可传空字符串关闭倒计时）
     * @param {string} dateStr - YYYY-MM-DD 或空
     */
    setExamDate(dateStr) {
      const brother = this.getChildById('brother');
      if (!brother) return false;
      brother.examDate = dateStr || '';
      this.save();
      return true;
    }

    /* ----------------------------------------------------
     * 数据导入导出
     * -------------------------------------------------- */

    /**
     * 导出全部数据为 JSON
     * @returns {Object}
     */
    exportData() {
      return {
        children: this.children,
        activities: this.activities,
        taskTemplates: this.taskTemplates,
        taskInstances: this.taskInstances,
        points: this.points,
        rewards: this.rewards,
        settings: this.settings,
        progressLog: this.progressLog,
        exportDate: new Date().toISOString(),
        version: 'v13'
      };
    }

    /**
     * 导入数据
     * @param {Object} data - 导入的数据
     * @returns {boolean}
     */
    importData(data) {
      try {
        if (data.children) this.children = data.children;
        if (data.activities) this.activities = data.activities;
        if (data.taskTemplates) this.taskTemplates = data.taskTemplates;
        if (data.taskInstances) this.taskInstances = data.taskInstances;
        if (data.points) this.points = data.points;
        if (data.rewards) this.rewards = data.rewards;
        if (data.settings) this.settings = data.settings;
        if (data.progressLog) this.progressLog = data.progressLog;
        this.save();
        return true;
      } catch (e) {
        console.error('[Store] 导入失败:', e);
        return false;
      }
    }

    /**
     * 清除全部数据
     */
    clearData() {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      this.children = [];
      this.activities = [];
      this.taskTemplates = [];
      this.taskInstances = {};
      this.points = { brother: 0, little: 0 };
      this.rewards = [];
      this.settings = {};
      this.progressLog = [];
      // 同步清空 IndexedDB 冗余备份，避免恢复出已清除的数据
      this.save();
    }

    /**
     * 重置为默认数据（保留配置，清除进度）
     */
    resetToDefault() {
      this.children = JSON.parse(JSON.stringify(DEFAULT_CHILDREN));
      this.activities = JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES));
      this.taskTemplates = JSON.parse(JSON.stringify(DEFAULT_TASK_TEMPLATES));
      this.points = JSON.parse(JSON.stringify(DEFAULT_POINTS));
      this.rewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      this.taskInstances = {};
      this.progressLog = [];
      this.save();
    }
  }

  /* ========================================================
   * 五、导出
   * ====================================================== */

  // 创建单例并立即初始化（确保各页面脚本读取前数据已就绪）
  const store = new Store();
  store.init();

  // 导出全局变量
  global.SSMStore = store;
  global.SSMStoreClass = Store;
  global.SSMConstants = {
    STORAGE_KEYS,
    TASK_STATUS,
    TASK_FREQUENCY,
    TIME_SLOTS
  };

})(typeof window !== 'undefined' ? window : globalThis);
