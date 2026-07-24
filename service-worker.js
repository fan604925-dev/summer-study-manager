/**
 * 暑假学习管家 - Service Worker
 * PWA 离线缓存
 *
 * 策略说明（v6）：
 * 为了让家长在手机浏览器上每次刷新都能拿到最新代码，
 * 所有 HTML / JS / CSS / manifest 统一走「网络优先」（network-first），
 * 仅当完全离线时才回退到缓存。图标走缓存优先（离线可缺失）。
 * 这样彻底避免「刷新后还是旧界面」的问题。
 */
const CACHE_NAME = 'ssm-v7';

// 仅预缓存图标等静态资源（不预缓存会频繁变动的 JS/CSS/HTML）
const PRECACHE_FILES = [
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.json'
];

// 安装：缓存核心静态文件
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isNavigate = e.request.mode === 'navigate' || e.request.destination === 'document';

  // 图标等静态资源：缓存优先（离线友好）
  if (/\/icons\//.test(url.pathname) || url.pathname.endsWith('.png')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok && isSameOrigin) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached);
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML / JS / CSS / manifest：网络优先，离线回退到缓存
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok && isSameOrigin) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => {
        // 离线或网络失败：回退缓存
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (isNavigate) return caches.match('index.html');
          return new Response('离线状态，请联网后重试', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
  );
});
