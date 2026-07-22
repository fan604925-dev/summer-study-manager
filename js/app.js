/**
 * 暑假学习管家 - 全局应用逻辑
 * ============================================================
 * 负责初始化、导航、日期处理、UI 工具函数等全局功能
 * ============================================================
 */
(function (global) {
  'use strict';

  const App = {
    /**
     * 初始化应用
     */
    init() {
      // 初始化数据存储
      if (global.SSMStore) {
        global.SSMStore.init();
      }
      // 注册 Service Worker（PWA）
      this.registerSW();
      // 高亮当前导航
      this.highlightNav();
      // 检查是否首次使用
      this.checkFirstUse();
    },

    /**
     * 注册 Service Worker，并强制检查更新
     */
    registerSW() {
      if (!('serviceWorker' in navigator)) return;

      navigator.serviceWorker.register('service-worker.js')
        .then(reg => {
          console.log('[SW] 已注册，版本检查中...');
          // 主动检查更新
          reg.update();

          // 发现新版本 Worker
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('[SW] 新版本已激活，准备刷新');
                // 一个会话只自动刷新一次，避免循环
                if (sessionStorage.getItem('ssm_sw_reloaded')) return;
                sessionStorage.setItem('ssm_sw_reloaded', '1');
                window.location.reload();
              }
            });
          });
        })
        .catch(err => {
          console.warn('[SW] 注册失败:', err);
        });
    },

    /**
     * 清除 Service Worker 缓存并重新加载（解决旧缓存导致的不更新）
     */
    async clearCacheAndReload() {
      if (!('serviceWorker' in navigator)) {
        window.location.reload();
        return;
      }
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.log('[SW] 缓存已清除');
      } catch (e) {
        console.warn('[SW] 清除缓存失败:', e);
      }
      window.location.reload(true);
    },

    /**
     * 高亮底部导航
     */
    highlightNav() {
      const path = location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.bottom-nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === path) {
          a.classList.add('active');
        }
      });
    },

    /**
     * 首次使用检查
     */
    checkFirstUse() {
      const visited = localStorage.getItem('ssm_visited');
      if (!visited && global.SSMStore) {
        localStorage.setItem('ssm_visited', '1');
      }
    },

    /* ========== 日期工具 ========== */

    /**
     * 获取今天日期字符串 YYYY-MM-DD
     */
    todayStr() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    /**
     * 格式化日期为中文
     */
    formatDate(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      const week = ['日', '一', '二', '三', '四', '五', '六'];
      return `${d.getMonth() + 1}月${d.getDate()}日 周${week[d.getDay()]}`;
    },

    /**
     * 获取星期几（0=周日）
     */
    getDayOfWeek(dateStr) {
      return new Date(dateStr + 'T00:00:00').getDay();
    },

    /**
     * 计算两个日期相差天数
     */
    daysBetween(dateStr1, dateStr2) {
      const d1 = new Date(dateStr1 + 'T00:00:00');
      const d2 = new Date(dateStr2 + 'T00:00:00');
      return Math.ceil((d2 - d1) / 86400000);
    },

    /**
     * 获取当前时间段
     */
    currentTimeSlot() {
      const h = new Date().getHours();
      if (h < 9) return 'morning';
      if (h < 12) return 'noon';
      if (h < 14) return 'noon';
      if (h < 17) return 'afternoon';
      return 'evening';
    },

    /* ========== UI 工具 ========== */

    /**
     * 底部导航栏 HTML
     */
    navHTML() {
      return `
        <nav class="bottom-nav">
          <a href="index.html"><span class="nav-icon">🏠</span><span>首页</span></a>
          <a href="tasks.html"><span class="nav-icon">📋</span><span>任务</span></a>
          <a href="rewards.html"><span class="nav-icon">🎁</span><span>奖励</span></a>
          <a href="sprint.html"><span class="nav-icon">⚡</span><span>冲刺</span></a>
          <a href="stats.html"><span class="nav-icon">📊</span><span>统计</span></a>
        </nav>
      `;
    },

    /**
     * 注入底部导航
     */
    injectNav() {
      const nav = document.getElementById('bottom-nav');
      if (nav) nav.innerHTML = this.navHTML();
      this.highlightNav();
    },

    /**
     * 科目标签 HTML
     */
    subjectTag(subject) {
      const map = {
        math: { label: '数学', cls: 'tag-math' },
        chinese: { label: '语文', cls: 'tag-chinese' },
        english: { label: '英语', cls: 'tag-english' },
        other: { label: '其他', cls: 'tag-other' }
      };
      const s = map[subject] || map.other;
      return `<span class="tag ${s.cls}">${s.label}</span>`;
    },

    /**
     * 难度标签
     */
    hardTag(hardToStart) {
      return hardToStart
        ? '<span class="tag tag-hard">启动难</span>'
        : '';
    },

    /**
     * 灵活标签
     */
    flexibleTag(flexible) {
      return flexible
        ? '<span class="tag tag-flexible">灵活</span>'
        : '';
    },

    /**
     * 显示提示信息（Toast）
     */
    toast(msg, duration = 2000) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.style.cssText = `
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px;
          border-radius: 20px; font-size: 14px; z-index: 9999;
          transition: opacity 0.3s; opacity: 0;
        `;
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, duration);
    },

    /**
     * 积分弹出动画
     */
    pointsAnimation(element, points) {
      if (!element) return;
      const pop = document.createElement('div');
      pop.textContent = `+${points}`;
      pop.style.cssText = `
        position: absolute; color: #22c55e; font-weight: 800; font-size: 20px;
        animation: floatUp 1s ease forwards; pointer-events: none;
      `;
      const rect = element.getBoundingClientRect();
      pop.style.left = rect.left + rect.width / 2 + 'px';
      pop.style.top = rect.top + 'px';
      document.body.appendChild(pop);
      setTimeout(() => pop.remove(), 1000);
    },

    /**
     * 确认对话框
     */
    confirm(msg) {
      return window.confirm(msg);
    },

    /**
     * 获取任务模板名称
     */
    getTemplateName(templateId) {
      if (!global.SSMStore) return templateId;
      const t = global.SSMStore.getTaskTemplateById(templateId);
      return t ? t.name : templateId;
    },

    /**
     * 获取任务模板
     */
    getTemplate(templateId) {
      if (!global.SSMStore) return null;
      return global.SSMStore.getTaskTemplateById(templateId);
    },

    /**
     * 生成进度环 SVG
     */
    progressRingSVG(percentage, size = 60) {
      const stroke = 5;
      const radius = (size - stroke * 2) / 2;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference * (1 - percentage);
      const color = percentage >= 0.6 ? '#22c55e' : percentage >= 0.3 ? '#f59e0b' : '#ef4444';
      return `
        <div class="progress-ring" style="width:${size}px;height:${size}px;">
          <svg width="${size}" height="${size}">
            <circle class="progress-bg" cx="${size/2}" cy="${size/2}" r="${radius}"
              fill="none" stroke-width="${stroke}"/>
            <circle class="progress-fill" cx="${size/2}" cy="${size/2}" r="${radius}"
              fill="none" stroke="${color}" stroke-width="${stroke}"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              stroke-linecap="round"/>
          </svg>
          <div class="progress-text" style="color:${color};">${Math.round(percentage * 100)}%</div>
        </div>
      `;
    }
  };

  // 注入浮动动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes floatUp {
      0% { transform: translateY(0); opacity: 1; }
      100% { transform: translateY(-40px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  global.SSMApp = App;
  global.app = App; // 兼容内联 onclick 访问

  // DOM 加载后自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
