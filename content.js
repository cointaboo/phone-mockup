/* 手机截图模拟器 v2 —— 页面覆盖层（IIFE，可重复执行，幂等） */
(function () {
  if (window.__pmInject) {
    try { window.__pmInject(window.__pmCfg || {}); } catch (e) {}
    return;
  }

  var DEFAULTS = {
    enabled: true,
    time: '',
    carrier: '中国移动',
    signal: 4,
    battery: 78,
    showPct: true,
    net: '5G',          // 5G / 4G / LTE / 隐藏
    netAuto: true,      // 连 WiFi 时自动隐藏制式（真机行为）
    wifi: true,
    charging: false,
    style: 'island',    // island / notch / punch / none
    theme: 'light',     // light=白字 / dark=黑字
    frame: true,        // 圆角遮罩
    dim: true,          // 外围压暗
    barBg: true,
    nav: 'ios',         // ios=home 条 / android=三键
    platform: 'ios',    // ios / android —— 决定状态栏尺寸规范
    radius: 44,
    barH: 0             // 0 = 按平台自动（iOS 54 / Android 32）
  };

  var cfg = Object.assign({}, DEFAULTS);
  var timer = null;
  var root = null;

  var WIFI_SVG = '<svg class="pm-wifi" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M12 20.5a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zm0-6.1c1.6 0 3.1.6 4.2 1.6l1.6-1.7a9 9 0 0 0-11.6 0l1.6 1.7c1.1-1 2.6-1.6 4.2-1.6zm0-5.1c2.9 0 5.6 1.1 7.6 2.9l1.6-1.7A13 13 0 0 0 12 6.6a13 13 0 0 0-9.2 3.9l1.6 1.7c2-1.8 4.7-2.9 7.6-2.9z"/></svg>';

  var BOLT_SVG = '<svg class="pm-bolt" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/></svg>';

  function h(tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  }

  function nowText() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function build() {
    root = h('div');
    root.id = 'pm-root';
    root.innerHTML =
      '<div class="pm-bar-bg"></div>' +
      '<div class="pm-frame"></div>' +
      '<div class="pm-status">' +
        '<div class="pm-left"><span class="pm-time">9:41</span></div>' +
        '<div class="pm-right">' +
          '<span class="pm-net"></span>' +
          '<span class="pm-bars"><i></i><i></i><i></i><i></i></span>' +
          WIFI_SVG +
          '<span class="pm-pct">78%</span>' +
          '<span class="pm-batt"><b></b>' + BOLT_SVG + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="pm-island"></div>' +
      '<div class="pm-notch"></div>' +
      '<div class="pm-punch"></div>' +
      '<div class="pm-home"><i></i><i></i><i></i></div>';
    document.documentElement.appendChild(root);
  }

  function paint() {
    if (!root) return;
    var tEl = root.querySelector('.pm-time');
    var netEl = root.querySelector('.pm-net');
    var bars = root.querySelectorAll('.pm-bars i');
    var barsWrap = root.querySelector('.pm-bars');
    var wifi = root.querySelector('.pm-wifi');
    var batt = root.querySelector('.pm-batt');
    var battFill = batt.querySelector('b');
    var pct = root.querySelector('.pm-pct');
    var island = root.querySelector('.pm-island');
    var notch = root.querySelector('.pm-notch');
    var punch = root.querySelector('.pm-punch');

    root.classList.toggle('pm-dark-text', cfg.theme === 'dark');
    root.classList.toggle('pm-bar-bg-on', !!cfg.barBg);
    root.classList.toggle('pm-no-frame', !cfg.frame);
    root.classList.toggle('pm-no-dim', !cfg.dim);
    root.classList.toggle('pm-android-nav', cfg.nav === 'android');
    var isAndroid = cfg.platform === 'android';
    root.classList.toggle('pm-android', isAndroid);
    root.style.setProperty('--pm-radius', (cfg.radius || 44) + 'px');
    var autoBar = isAndroid ? 32 : 54;
    root.style.setProperty('--pm-bar-h', (cfg.barH > 0 ? cfg.barH : autoBar) + 'px');

    tEl.textContent = (cfg.time || '').trim() || nowText();

    // 网络制式：连了 WiFi 就藏起来（真机就是这样，也避免灵动岛遮挡）
    var net = String(cfg.net || '').trim();
    var hideByWifi = cfg.netAuto !== false && cfg.wifi && net && net !== '隐藏';
    var showNet = net && net !== '隐藏' && !hideByWifi;
    netEl.textContent = showNet ? net : '';
    netEl.style.display = showNet ? '' : 'none';

    // 信号
    var n = Math.max(0, Math.min(4, parseInt(cfg.signal, 10) || 0));
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < n);
    barsWrap.style.display = n === 0 ? 'none' : '';

    // WiFi
    wifi.style.display = cfg.wifi ? '' : 'none';

    // 电量
    var b = Math.max(0, Math.min(100, parseInt(cfg.battery, 10)));
    if (isNaN(b)) b = 0;
    // 让填充在「电池总宽」上等于 b%：内容区宽 = 总宽 - 2×边框(1.3) - 2×内缩(1.4)
    var battW = batt.clientWidth || 24;
    var innerW = Math.max(4, battW - 2.6);
    // offsetWidth 含边框；目标视觉宽度 = 总宽 × 电量%，再扣掉两侧内缩
    var battTotal = batt.offsetWidth || 24;
    var target = battTotal * (b / 100);
    battFill.style.width = Math.max(1, Math.round(target - 2.0)) + 'px';
    batt.classList.toggle('low', b <= 20 && !cfg.charging);
    batt.classList.toggle('charging', !!cfg.charging);
    pct.textContent = b + '%';
    pct.style.display = cfg.showPct ? '' : 'none';

    // 刘海样式
    island.style.display = cfg.style === 'island' ? '' : 'none';
    notch.style.display = cfg.style === 'notch' ? '' : 'none';
    punch.style.display = cfg.style === 'punch' ? '' : 'none';
  }

  function tick() {
    if (timer) clearInterval(timer);
    if (cfg.time && cfg.time.trim()) return;
    timer = setInterval(function () {
      if (!root) return;
      var t = root.querySelector('.pm-time');
      if (t && !(cfg.time || '').trim()) t.textContent = nowText();
    }, 10000);
  }

  function apply(next) {
    cfg = Object.assign({}, DEFAULTS, next || {});
    if (!cfg.enabled) { destroy(); return; }
    if (!root || !document.documentElement.contains(root)) build();
    paint();
    tick();
  }

  function destroy() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function toast(msg) {
    var old = document.getElementById('pm-toast');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'pm-toast';
    d.textContent = msg;
    document.documentElement.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2300);
  }

  window.__pmInject = apply;
  window.__pmDestroy = destroy;
  window.__pmToast = toast;
  window.__pmCfg = cfg;

  try {
    chrome.storage.local.get(['pmCfg'], function (r) {
      var saved = (r && r.pmCfg) || {};
      window.__pmCfg = saved;
      apply(saved);
    });
  } catch (e) {
    apply({});
  }
})();
