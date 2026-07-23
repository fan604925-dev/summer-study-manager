/**
 * 简单 Node 测试：验证 store.js 逻辑与数据持久化（v12）
 */
const fs = require('fs');
const path = require('path');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem(key) { return storage[key] || null; },
  setItem(key, value) { storage[key] = String(value); },
  removeItem(key) { delete storage[key]; }
};
global.window = global;

// 加载 store.js
const storePath = path.join(__dirname, 'js', 'store.js');
eval(fs.readFileSync(storePath, 'utf8'));

const store = global.SSMStore;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('✓', msg);
}

// 1. 初始化
store.init();
assert(store.getChildren().length === 2, '有两个孩子');
assert(store.getTaskTemplates('brother').length > 0, '哥哥有任务模板');
assert(store.getTaskTemplates('little').length > 0, '弟弟有任务模板');

// 2. 今日任务生成
const brotherTasks = store.getTodayTasks('brother');
assert(brotherTasks.length > 0, '哥哥今天有任务（' + brotherTasks.length + '项）');
const littleTasks = store.getTodayTasks('little');
assert(littleTasks.length > 0, '弟弟今天有任务（' + littleTasks.length + '项）');

// 3. 积分结构
const broSummary = store.getPointsSummary('brother');
assert(typeof broSummary.current === 'number', '积分 summary 有 current');
assert(typeof broSummary.total === 'number', '积分 summary 有 total');
assert(typeof broSummary.spent === 'number', '积分 summary 有 spent');
assert(Array.isArray(broSummary.history), '积分 summary 有 history 数组');

// 4. 倒计时：默认 2026-08-24，今天应是正数（约33天）
const cd = store.getExamCountdown();
console.log('  ⏱ 倒计时天数 =', cd);
assert(typeof cd === 'number' && cd > 0, '默认考试日期倒计时为正数');

// 5. 关闭倒计时：setExamDate('') 后返回 null
store.setExamDate('');
assert(store.getExamCountdown() === null, '关闭考试日期后 getExamCountdown 返回 null');
store.setExamDate('2026-08-24'); // 恢复
assert(store.getExamCountdown() === cd, '恢复考试日期后倒计时恢复');

// 6. 完成任务获得积分
const task = brotherTasks[0];
const before = store.getPoints('brother');
store.markComplete(task.id, 1);
assert(store.getPoints('brother') > before, '完成任务后积分增加');
assert(store.getPointsSummary('brother').total > 0, '累计积分增加');

// 7. 兑换奖励
const rewards = store.getRewards('brother');
const affordReward = rewards.find(r => r.cost <= store.getPoints('brother'));
if (affordReward) {
  const idx = rewards.indexOf(affordReward);
  const beforeCurrent = store.getPoints('brother');
  const beforeSpent = store.getPointsSummary('brother').spent;
  store.redeemReward('brother', idx);
  assert(store.getPoints('brother') === beforeCurrent - affordReward.cost, '兑换后当前积分正确');
  assert(store.getPointsSummary('brother').spent === beforeSpent + affordReward.cost, '兑换后累计消费正确');
  assert(store.getPointsSummary('brother').history.length > 0, '兑换历史已记录');
}

// 8. 模拟刷新：重新加载 store，检查持久化
const store2 = new global.SSMStoreClass();
store2.init();
assert(store2.getTodayTasks('brother').length === brotherTasks.length, '刷新后任务数量一致');
assert(store2.getPoints('brother') === store.getPoints('brother'), '刷新后积分一致');
assert(store2.getPointsSummary('brother').spent === store.getPointsSummary('brother').spent, '刷新后累计消费一致');

// 9. _repairData 在模板损坏时恢复
// 模拟旧版本 + 破损/被清空的模板
storage['ssm_data_version'] = '11'; // 旧版本，触发 repair
storage['ssm_taskTemplates'] = JSON.stringify([]); // 模板被清空（损坏）
storage['ssm_rewards'] = JSON.stringify([]); // 奖励被清空
const storeRepair = new global.SSMStoreClass();
storeRepair.init();
assert(storeRepair.getTaskTemplates('brother').length > 0, '模板损坏后 _repairData 重新填充哥哥模板');
assert(storeRepair.getRewards('brother').length > 0, '奖励损坏后 _repairData 重新填充哥哥奖励');

// 10. 自定义任务持久化
const customTemplate = {
  id: 'custom_test_001',
  childId: 'brother',
  name: '测试自定义任务',
  subject: 'math',
  duration: 20,
  points: 5,
  frequency: 'daily'
};
store2.taskTemplates.push(customTemplate);
const todayStr = Object.keys(store2.taskInstances)[0];
if (todayStr) {
  store2.taskInstances[todayStr].push({
    id: 'instance_' + todayStr + '_custom_test_001',
    templateId: customTemplate.id,
    childId: 'brother',
    date: todayStr,
    status: 'pending',
    completedPercentage: 0,
    pointsEarned: 0,
    carryOver: false,
    note: '手动添加'
  });
}
store2.save();

const store3 = new global.SSMStoreClass();
store3.init();
const customTemplateLoaded = store3.taskTemplates.find(t => t.id === 'custom_test_001');
assert(!!customTemplateLoaded, '自定义模板刷新后仍存在');
const customTaskLoaded = store3.getTodayTasks('brother').find(t => t.templateId === 'custom_test_001');
assert(!!customTaskLoaded, '自定义任务实例刷新后仍存在');

// 11. 旧版积分数据迁移测试
storage['ssm_data_version'] = '8';
storage['ssm_points'] = JSON.stringify({ brother: 123, little: 45 });
const store4 = new global.SSMStoreClass();
store4.init();
assert(store4.getPoints('brother') === 123, '旧版 brother 积分迁移后 current 正确');
assert(store4.getPointsSummary('brother').total === 123, '旧版 brother 积分迁移后 total 正确');
assert(store4.getPoints('little') === 45, '旧版 little 积分迁移后 current 正确');

// 12. 版本一致但关键数据为空（模拟用户之前保存了空数组）
storage['ssm_data_version'] = '12';
storage['ssm_children'] = JSON.stringify([]);
storage['ssm_taskTemplates'] = JSON.stringify([]);
storage['ssm_rewards'] = JSON.stringify([]);
storage['ssm_points'] = JSON.stringify({});
const store5 = new global.SSMStoreClass();
store5.init();
assert(store5.getChildren().length === 2, '版本一致但 children 为空时自动修复为默认孩子');
assert(store5.getTaskTemplates('brother').length > 0, '版本一致但模板为空时自动修复为默认模板');
assert(store5.getRewards('brother').length > 0, '版本一致但奖励为空时自动修复为默认奖励');

// 13. 合并后清理废弃模板，保留自定义任务与积分（模拟用户从 v13 刷新到 v14）
const todayKey = '2026-07-22';
const oldChaoTemplates = [
  { id: 'chao_essay', childId: 'brother', subject: 'chinese', name: '《朝花夕拾》概括性作文', frequency: 'oneTime', duration: 60, points: 15 },
  { id: 'chao_characters', childId: 'brother', subject: 'chinese', name: '主要人物形象概括', frequency: 'oneTime', duration: 40, points: 12 },
  { id: 'chao_plots', childId: 'brother', subject: 'chinese', name: '十篇文章故事情节概括', frequency: 'oneTime', duration: 20, points: 8 }
];
const mergedTemplate = { id: 'chao_summary', childId: 'brother', subject: 'chinese', name: '概括《朝花夕拾》十篇文章情节和人物形象', frequency: 'oneTime', duration: 40, points: 10, repeatCount: 10 };
const customTemplate2 = { id: 'custom_my_001', childId: 'brother', subject: 'math', name: '我的自定义数学任务', frequency: 'daily', duration: 15, points: 5, custom: true };
storage['ssm_data_version'] = '13';
storage['ssm_children'] = JSON.stringify(global.SSMStore.getChildren());
storage['ssm_rewards'] = JSON.stringify(global.SSMStore.getRewards('brother').concat(global.SSMStore.getRewards('little')));
// 真实场景：默认模板全量 + 旧三个 chao 拆分任务 + 一个自定义任务
const realisticTemplates = global.SSMStore.getTaskTemplates('brother')
  .concat(global.SSMStore.getTaskTemplates('little'))
  .concat(oldChaoTemplates)
  .concat([customTemplate2]);
storage['ssm_taskTemplates'] = JSON.stringify(realisticTemplates);
storage['ssm_points'] = JSON.stringify({ brother: { current: 50, total: 50, spent: 0, history: [] }, little: { current: 0, total: 0, spent: 0, history: [] } });
storage['ssm_taskInstances'] = JSON.stringify({ [todayKey]: [
  { id: 'inst_' + todayKey + '_chao_essay', templateId: 'chao_essay', childId: 'brother', name: '《朝花夕拾》概括性作文', status: 'completed', pointsEarned: 15, date: todayKey }
]});

const store6 = new global.SSMStoreClass();
store6.init();
const broTpls = store6.getTaskTemplates('brother').map(t => t.id);
assert(!broTpls.includes('chao_essay'), '修复后废弃模板 chao_essay 被移除');
assert(!broTpls.includes('chao_characters'), '修复后废弃模板 chao_characters 被移除');
assert(!broTpls.includes('chao_plots'), '修复后废弃模板 chao_plots 被移除');
assert(broTpls.includes('chao_summary'), '修复后合并任务 chao_summary 保留');
assert(broTpls.includes('custom_my_001'), '修复后自定义任务保留');
assert(store6.getPoints('brother') === 50, '修复后哥哥积分(50)保留');
assert(store6.getPointsSummary('brother').total === 50, '修复后累计积分保留');
const todayTasks6 = store6.getTodayTasks('brother').map(t => t.templateId);
assert(!todayTasks6.includes('chao_essay'), '今天任务列表不再包含废弃的 chao_essay');

// 14. 已有默认模板属性更新测试（如 daily → dateRange）
const oldMathNotes = store6.getTaskTemplateById('math_yuan_notes');
assert(!!oldMathNotes, '数学笔记模板存在');
assert(oldMathNotes.frequency === 'dateRange', '数学笔记模板已更新为 dateRange');
assert(oldMathNotes.dateRange[0] === '2026-07-16' && oldMathNotes.dateRange[1] === '2026-07-27', '数学笔记日期范围正确');

const oldChineseNotes = store6.getTaskTemplateById('chinese_yuan_notes');
assert(!!oldChineseNotes, '语文笔记模板存在');
assert(oldChineseNotes.frequency === 'dateRange', '语文笔记模板已更新为 dateRange');

const oldEnglishNotes = store6.getTaskTemplateById('english_yuan_notes');
assert(!!oldEnglishNotes, '英语笔记模板存在');
assert(oldEnglishNotes.frequency === 'dateRange', '英语笔记模板已更新为 dateRange');

// 15. 任务删除功能（v17 新增删减）
// 15.1 删除自定义任务：模板与实例一并移除
const customTpl = {
  id: 'custom_del_test',
  childId: 'brother',
  name: '临时删除测试任务',
  subject: 'other',
  duration: 10,
  points: 5,
  frequency: 'daily',
  daily: true,
  custom: true
};
global.SSMStore.taskTemplates.push(customTpl);
const _d = new Date();
const delTodayStr = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0');
if (!global.SSMStore.taskInstances[delTodayStr]) global.SSMStore.taskInstances[delTodayStr] = [];
global.SSMStore.taskInstances[delTodayStr].push({
  id: 'instance_' + delTodayStr + '_custom_del_test',
  templateId: 'custom_del_test', childId: 'brother', date: todayStr,
  status: 'pending', completedPercentage: 0, pointsEarned: 0, carryOver: false, note: ''
});
global.SSMStore.save();
assert(!!global.SSMStore.getTaskTemplateById('custom_del_test'), '删除前自定义模板存在');
const delOk = global.SSMStore.deleteTaskTemplate('custom_del_test');
assert(delOk === true, 'deleteTaskTemplate 返回成功');
assert(!global.SSMStore.getTaskTemplateById('custom_del_test'), '删除后自定义模板已移除');
assert(!global.SSMStore.getTodayTasks('brother').some(t => t.templateId === 'custom_del_test'), '删除后今天不再有该任务实例');

// 15.2 删除默认任务后，_repairData 不应复活
const defaultTpl = global.SSMStore.getTaskTemplates('brother').find(t => !t.custom);
assert(!!defaultTpl, '能取到默认任务模板用于删除测试');
const defaultDelId = defaultTpl.id;
const beforeDelCount = global.SSMStore.getTaskTemplates('brother').length;
global.SSMStore.deleteTaskTemplate(defaultDelId);
assert(!global.SSMStore.getTaskTemplateById(defaultDelId), '默认模板删除后从列表移除');
assert(global.SSMStore.deletedTemplateIds.includes(defaultDelId), '默认模板删除后记入 deletedTemplateIds');
// 模拟版本修复
global.SSMStore._repairData();
assert(!global.SSMStore.getTaskTemplateById(defaultDelId), '修复(repair)后默认任务未复活');
assert(!global.SSMStore.getTaskTemplates('brother').some(t => t.id === defaultDelId), '修复后哥哥模板列表不含已删任务');

console.log('\n🎉 所有测试通过！');
