# 暑假学习管家小程序 - 项目记忆

## 项目定位
- **家长专用**PWA Web应用（手机浏览器+桌面快捷方式），孩子完全不碰手机
- 核心解决：家长计划执行不到位、经常忘记、临时变卦的问题
- 给孩子选择权，家长只做监督和跟进

## 技术选型
- 轻量Web应用（HTML+CSS+JS原生）
- Tailwind CSS (CDN) + Chart.js (CDN)
- 数据存储：localStorage + IndexedDB 双持久化（防 localStorage 被清导致积分清零）
- PWA 可添加到手机桌面
- 部署到 GitHub Pages（永久免费，仓库 fan604925-dev/summer-study-manager）
- 4节点提醒用手机闹钟（7:00/10:00/12:00/16:00）

## 核心功能
1. 日程设置（固定活动→可用时间）
2. 任务管理（模板→每日实例）
3. 智能排程引擎（自动生成每日时间安排）
4. 4节点提醒系统（早间计划→选择建议→中午跟进→下午提醒）
5. 进度更新+自动顺延+60%底线
6. 选择建议引擎（给2-3选项让孩子自选）
7. 积分系统+智能奖励推荐引擎
8. 分班考冲刺专区（倒计时35天）
9. 引导型+易忘任务专项提醒
10. 灵活调整（暂停当天/假期模式）

## 用户背景
- 哥哥12岁6升7，数学最弱，8月24日分班考（语数英三科）
- 弟弟8岁2升3，成绩85-99
- 爸爸偶尔看进度，妈妈是主要操作者
- 哥哥篮球10:45-12:15（周一二四五），弟弟游泳14:00-15:30（周一二四五）
- 7/30-8/10暂停篮球课（英语上午网课9:30-11:20）
- 晚上猿辅导网课+妈妈辅导
- 猿辅导天天练数学计算题（哥哥）

## 哥哥关键任务修正（v8）
- 书签用西游记师徒四人（唐僧/悟空/八戒/沙僧），不是朝花夕拾
- 《朝花夕拾》拆成5个子任务：阅读+概括性作文+改过十篇古诗+主要人物形象+十篇故事情节概括
- 魔方移除（他随时自己玩，不给积分）
- 英文名著阅读移除（先完成英语练习册）
- 网课笔记拆成三科各自（语文/数学/英语笔记整理）
- 猿辅导天天练数学计算题（新增）
- 练习册统一叫"一本牌"

## 弟弟关键任务修正（v8）
- 《哪吒》练习册 → 一本牌语文暑假作业
- 口算20道+竖式5道 → 一本牌数学暑假作业
- 小高数学思维课12分（喜欢但畏难）
- 数学周记10分（启动难）
- 数学生活实践/独立完成一件事 → 妈妈引导型+易忘

## 与AI家教并行
- 小程序管"安排"（什么时候做什么）
- AI家教管"内容"（做什么练习卷/打印什么）
- 任务模板可标记 use_ai_material

## 奖励科学原则
- 奖励努力不奖励结果
- 用"庆祝"代替"交易"
- 不提前告诉孩子换什么（意外奖励增强内驱力）
- 电视节目/电影→奖励库（不是学习任务）
- 体验型奖励为主（爬山/逛商场/吃大餐/机动游戏）

## 开发周期
- 5天MVP
- Day1:骨架+首页+数据 Day2:任务+排程 Day3:积分+奖励 Day4:提醒+冲刺 Day5:设置+部署

## 方案演变
- v1: 双端小程序（孩子打卡）→ 放弃（给孩子玩手机的理由）
- v2: AI家教+纸质系统 → 保留为内容生成端
- v3: 家长专用管理小程序 → 用户提出核心是帮家长执行计划
- v4: 轻量Web应用PWA → 妈妈单端、不上架、零成本
- v5-v8: 持续修正任务清单、积分权重、奖励科学、排程细节
- v9-v10: 修复 localStorage/SW 缓存导致的刷新丢数据、积分对不上、icon 404
- v11-v12: **彻底解决"刷新仍是旧界面"**——SW 改完全网络优先、数据版本强升、_repairData 强制重填、考试日期可关闭
- v13: 弃用 CloudStudio，迁移到 **GitHub Pages**（永久免费、稳定固定链接 `https://fan604925-dev.github.io/summer-study-manager/`）
- v14: 修复**全新打开积分清零**——localStorage 在隐私模式/iOS主屏幕App(standalone)/部分WebView会被清；新增 IndexedDB 冗余持久化（save 双写）+ 启动自动恢复，彻底防丢
- v18: 修复**家务任务勾选后家务积分未增加**——实例持久化 `cashable` 标记、`_repairData` 同步旧实例、自定义家务名识别为 cashable、`childId='both'` 任务给两个孩子都加分

## 技术备忘（关键约束）
- localStorage key 前缀 `ssm_`，数据版本 `DATA_VERSION='18'`
- 积分结构：学习积分 `points[childId] = {current, total, spent, history}`；家务积分 `cashablePoints[childId]` 同结构（key `ssm_cashablePoints`）；旧版数字格式由 `_repairData` 自动迁移
- `_repairData` **不再** 清空 `taskInstances`；模板损坏（<40%）或奖励为空时强制重新填充默认
- `_ensureInstancesForDate` 会自动清理"因模板调整而不应再出现的旧实例"（保留自定义/已完成/顺延任务），保证模板 daily→dateRange 等调整后当天列表立即正确
- **任务删除(删减)功能**：`store.deleteTaskTemplate(id)` 删模板+所有实例；默认任务删后写入 `deletedTemplateIds`（`ssm_deletedTemplates`），`_repairData` 两条分支末尾都按 `deletedTemplateIds` 过滤 → 版本升级/修复不复活；已得积分不扣回；`tasks.html` 列表项🗑️+弹窗按钮双入口，删除前 `app.confirm` 确认
- **家务劳动+零花钱(v17/v18)**：洗碗/扫地/拖地(每日)+洗衣服(每周)，哥哥弟弟各一套，`cashable:true`；家务积分 `cashablePoints`（池 `ssm_cashablePoints`，与学习积分 `points` 分离）只累加 cashable 任务；`markComplete`/`markIncomplete` 优先按 `instance.cashable ?? template.cashable` 路由到对应池；`childId='both'` 任务完成时给哥哥、弟弟两个池都加分；奖励 `type:'cash'` 走 `spendCashablePoints`，与体验奖励（学习积分）互不串；兑换比例 **1元=10分（0.1元/分）**，零花钱奖励库 brother 50/100/200分、little 30/50/100分；`_repairData` 会把自定义但名字含“洗碗/扫地/拖地/洗衣服”的模板也识别为 cashable，并同步旧实例的 `cashable` 标记；DATA_VERSION 升 18 触发老用户 repair 修正
- Service Worker：`CACHE_NAME='ssm-v6'`，**HTML/JS/CSS/manifest 全部网络优先**（仅离线回退缓存），图标缓存优先
- 考试日期可关闭：设置页留空 `brother.examDate` → 倒计时显示"长期计划模式"（∞）
- 浏览器若仍显示旧界面：**首页「🛠️ 一键修复」按钮**（app.clearCacheAndReload）或设置页「清除缓存并刷新」或 DevTools 手动 unregister SW
- 验证脚本：`test_store.js`（Node）、`test_html_syntax.js`（Node）

### ⚠️ 数据存储双保险（v14 新增，核心约束）
- `save()` 同步写 localStorage + 异步写 IndexedDB（`_idbPut`，库名 `ssm-db-v1`/store `kv`/key `all`）
- `init()` 末尾 `_syncIdb()`：先备份内存数据到 IDB；若 localStorage 缺失（`_lsAvailable===false` 或 `ssm_children` 为空）则从 IDB 恢复，写回 localStorage 后一次性 `location.reload()`（`ssm_idb_recovered` sessionStorage 防循环）；localStorage 不可用时派发 `ssm:data-restored` 事件原地重渲染
- `clearData()` 末尾调 `save()`，同步清空 IDB 冗余备份
- **全新打开积分清零根因**：localStorage 在隐私模式 / iOS 主屏幕App(standalone) / 部分 WebView 关闭后会丢失；旧 `save()` 的 try/catch 静默吞掉写入失败 → 数据只在内存 → 关闭即丢。用户"点恢复网页才保留"正是旧内存进程存活现象
- **使用建议**：用普通浏览器标签页打开（不要隐私模式、不要"添加到主屏幕"当App）；设置页「导出数据」下载 JSON 作终极备份

### ⚠️ 部署方式（已变更）
- **当前固定链接**：`https://fan604925-dev.github.io/summer-study-manager/`（GitHub Pages，永久免费）
- CloudStudio 已弃用：旧链接 `https://3000-f04ca2954b5648959df5b175365fc2da.e2b.ap-beijing.sandbox.cloudstudio.club/` 与 `https://f04ca2954b5648959df5b175365fc2da.app.codebuddy.work` 均不再使用（CloudStudio 链接不稳、会休眠、换域名丢数据）
- 更新流程：本地改完 → `git add . && git commit && git push origin main` → GitHub Pages 自动重建（1-5 分钟）
- 设置页已有「导出数据」(下载JSON) + 「导入数据」(读JSON→store.importData) 供换机/迁移
