/* popup v2：机型预设 / 参数注入 / 截图美化 */
(function () {
  var $ = function (id) { return document.getElementById(id); };

  var DEFAULTS = {
    enabled: true,
    time: '',
    carrier: '中国移动',
    signal: 4,
    battery: 78,
    showPct: true,
    net: '5G',
    wifi: true,
    charging: false,
    style: 'island',
    theme: 'light',
    frame: true,
    dim: true,
    barBg: true,
    nav: 'ios',
    platform: 'ios',
    mobileView: false,
    mobileW: '390',
    beautify: true
  };

  var cfg = Object.assign({}, DEFAULTS);
  var saveTimer = null;

  /* ---------- 机型预设 ---------- */
  var PRESETS = {
    ip15: { platform: 'ios', style: 'island', nav: 'ios', theme: 'light', carrier: '中国移动', net: '5G', signal: 4, battery: 82, wifi: true, barBg: true, frame: true, dim: true },
    ip14: { platform: 'ios', style: 'notch', nav: 'ios', theme: 'light', carrier: '中国联通', net: '5G', signal: 3, battery: 46, wifi: true, barBg: true, frame: true, dim: true },
    ipse: { platform: 'ios', style: 'none', nav: 'ios', theme: 'light', carrier: '中国移动', net: '4G', signal: 3, battery: 64, wifi: false, barBg: true, frame: true, dim: true },
    s24:  { platform: 'android', style: 'punch', nav: 'android', theme: 'light', carrier: '中国电信', net: '5G', signal: 4, battery: 91, wifi: true, barBg: true, frame: true, dim: true },
    mi14: { platform: 'android', style: 'punch', nav: 'android', theme: 'light', carrier: '中国移动', net: '5G', signal: 4, battery: 73, wifi: true, barBg: true, frame: true, dim: true },
    plain:{ platform: 'ios', style: 'none', nav: 'ios', theme: 'light', carrier: '', net: '隐藏', signal: 4, battery: 100, wifi: false, barBg: true, frame: false, dim: false }
  };

  function bindSwitch(id, key, after) {
    $(id).addEventListener('click', function () {
      this.classList.toggle('on');
      cfg[key] = this.classList.contains('on');
      save();
      if (after) after();
    });
  }
  function setSwitch(id, on) {
    var el = $(id);
    if (el) el.classList.toggle('on', !!on);
  }

  function load() {
    chrome.storage.local.get(['pmCfg'], function (r) {
      cfg = Object.assign({}, DEFAULTS, (r && r.pmCfg) || {});
      paintForm();
    });
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { chrome.storage.local.set({ pmCfg: cfg }); }, 180);
  }

  function paintForm() {
    setSwitch('enabled', cfg.enabled);
    setSwitch('showPct', cfg.showPct);
    setSwitch('wifi', cfg.wifi);
    setSwitch('charging', cfg.charging);
    setSwitch('barBg', cfg.barBg);
    setSwitch('frame', cfg.frame);
    setSwitch('dim', cfg.dim);
    setSwitch('beautify', cfg.beautify);
    $('time').value = cfg.time || '';
    $('carrier').value = cfg.carrier || '';
    $('net').value = cfg.net;
    $('signal').value = cfg.signal; $('signalV').textContent = cfg.signal;
    $('battery').value = cfg.battery; $('batteryV').textContent = cfg.battery + '%';
    $('style').value = cfg.style;
    $('theme').value = cfg.theme;
    $('nav').value = cfg.nav;
    $('platform').value = cfg.platform || 'ios';
    setSwitch('mobileView', cfg.mobileView);
    $('mobileW').value = cfg.mobileW || '390';
  }

  /* ---------- 注入 ---------- */
  function inject(showToast) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) { $('status').textContent = '找不到当前标签页'; return; }
      if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(tab.url || '')) {
        $('status').textContent = '浏览器内部页不支持';
        return;
      }
      chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] }, function () {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }, function () {
          if (chrome.runtime.lastError) {
            $('status').textContent = '注入失败：' + chrome.runtime.lastError.message.slice(0, 38);
            return;
          }
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: function (c, toastOn) {
              if (window.__pmInject) window.__pmInject(c);
              if (toastOn && window.__pmToast) window.__pmToast('手机外壳已应用');
            },
            args: [cfg, !!showToast]
          }, function () {
            $('status').textContent = '已应用';
          });
        });
      });
    });
  }

  /* ---------- 手机视图：用 debugger 改设备指标 ---------- */
  var DV = '1.3';
  function applyMobileView(on) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) return;
      if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(tab.url || '')) {
        $('status').textContent = '内部页不支持手机视图';
        return;
      }
      var tid = tab.id;
      if (on) {
        chrome.debugger.attach({ tabId: tid }, DV, function () {
          if (chrome.runtime.lastError) {
            $('status').textContent = '手机视图失败：' + chrome.runtime.lastError.message.slice(0, 40);
            return;
          }
          chrome.debugger.sendCommand({ tabId: tid }, 'Emulation.setDeviceMetricsOverride', {
            width: parseInt(cfg.mobileW, 10) || 390,
            height: 900,
            deviceScaleFactor: 2,
            mobile: true,
            screenOrientation: { type: 'portraitPrimary', angle: 0 }
          }, function () {
            $('status').textContent = '手机视图已开启（' + (cfg.mobileW || 390) + 'px）';
            save();
          });
        });
      } else {
        chrome.debugger.sendCommand({ tabId: tid }, 'Emulation.clearDeviceMetricsOverride', function () {
          chrome.debugger.detach({ tabId: tid }, function () {
            // 忽略 detach 报错（可能已断开）
            void chrome.runtime.lastError;
            $('status').textContent = '已恢复桌面视图';
            save();
          });
        });
      }
    });
  }

  // 标签页关闭/跳转时自动 detach，避免 debugger 挂住
  if (chrome.debugger && chrome.debugger.onDetach) {
    chrome.debugger.onDetach.addListener(function (source, reason) {
      cfg.mobileView = false;
      setSwitch('mobileView', false);
      $('status').textContent = '手机视图已断开';
    });
  }

  /* ---------- 截图（可选美化） ---------- */
  function shoot() {
    $('status').textContent = '截图中…';
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) { $('status').textContent = '找不到标签页'; return; }
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, function (dataUrl) {
        if (chrome.runtime.lastError || !dataUrl) {
          $('status').textContent = '截图失败：' + (chrome.runtime.lastError ? chrome.runtime.lastError.message.slice(0, 30) : '无数据');
          return;
        }
        var name = 'phone-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.png';
        if (!cfg.beautify) { download(dataUrl, name); return; }

        beautify(dataUrl, function (out) {
          download(out || dataUrl, name);
        });
      });
    });
  }

  // 加外边距 + 圆角 + 阴影 + 深色背景，做出"展示图"效果
  function beautify(src, cb) {
    var img = new Image();
    img.onload = function () {
      try {
        var pad = Math.round(Math.min(img.width, img.height) * 0.06);
        var r = Math.round(Math.min(img.width, img.height) * 0.055);
        var W = img.width + pad * 2, H = img.height + pad * 2;

        var cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        var ctx = cv.getContext('2d');

        // 背景：竖向深色渐变
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1b2434');
        g.addColorStop(1, '#0a0d13');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 阴影 + 圆角裁剪
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = pad * 0.9;
        ctx.shadowOffsetY = pad * 0.35;
        roundRect(ctx, pad, pad, img.width, img.height, r);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundRect(ctx, pad, pad, img.width, img.height, r);
        ctx.clip();
        ctx.drawImage(img, pad, pad);
        ctx.restore();

        cb(cv.toDataURL('image/png'));
      } catch (e) {
        cb(null);
      }
    };
    img.onerror = function () { cb(null); };
    img.src = src;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function download(url, name) {
    chrome.downloads.download({ url: url, filename: name, saveAs: false }, function () {
      if (chrome.runtime.lastError) {
        $('status').textContent = '保存失败：' + chrome.runtime.lastError.message.slice(0, 30);
      } else {
        $('status').textContent = '已保存到下载目录';
      }
    });
  }

  /* ---------- 事件 ---------- */
  bindSwitch('enabled', 'enabled', function () { inject(false); });
  bindSwitch('showPct', 'showPct', function () { inject(false); });
  bindSwitch('wifi', 'wifi', function () { inject(false); });
  bindSwitch('charging', 'charging', function () { inject(false); });
  bindSwitch('barBg', 'barBg', function () { inject(false); });
  bindSwitch('frame', 'frame', function () { inject(false); });
  bindSwitch('dim', 'dim', function () { inject(false); });
  bindSwitch('beautify', 'beautify');

  $('time').addEventListener('input', function () { cfg.time = this.value; save(); });
  $('carrier').addEventListener('input', function () { cfg.carrier = this.value; save(); });
  $('net').addEventListener('change', function () { cfg.net = this.value; save(); });
  $('signal').addEventListener('input', function () {
    cfg.signal = parseInt(this.value, 10); $('signalV').textContent = cfg.signal; save();
  });
  $('battery').addEventListener('input', function () {
    cfg.battery = parseInt(this.value, 10); $('batteryV').textContent = cfg.battery + '%'; save();
  });
  $('style').addEventListener('change', function () { cfg.style = this.value; save(); });
  $('theme').addEventListener('change', function () { cfg.theme = this.value; save(); });
  $('nav').addEventListener('change', function () { cfg.nav = this.value; save(); });
  $('platform').addEventListener('change', function () {
    cfg.platform = this.value;
    // 切系统时同步常见搭配：Android 自动换三键 + 挖孔
    if (this.value === 'android' && cfg.nav === 'ios') { cfg.nav = 'android'; $('nav').value = 'android'; }
    if (this.value === 'ios' && cfg.nav === 'android') { cfg.nav = 'ios'; $('nav').value = 'ios'; }
    save(); inject(false);
  });

  $('mobileView').addEventListener('click', function () {
    var on = this.classList.toggle('on');
    cfg.mobileView = on;
    applyMobileView(on);
  });
  $('mobileW').addEventListener('change', function () {
    cfg.mobileW = this.value;
    save();
    if (cfg.mobileView) applyMobileView(true);   // 立刻按新宽度重设
  });

  $('apply').addEventListener('click', function () {
    // 滑块/下拉改完没点应用时，保证生效
    cfg.signal = parseInt($('signal').value, 10);
    cfg.battery = parseInt($('battery').value, 10);
    cfg.style = $('style').value;
    cfg.theme = $('theme').value;
    cfg.nav = $('nav').value;
    cfg.net = $('net').value;
    cfg.platform = $('platform').value;
    cfg.carrier = $('carrier').value;
    cfg.time = $('time').value;
    save();
    inject(true);
  });
  $('shot').addEventListener('click', shoot);

  Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
    b.addEventListener('click', function () {
      var p = PRESETS[b.getAttribute('data-preset')] || {};
      Object.assign(cfg, p);
      paintForm(); save(); inject(true);
    });
  });

  load();
  setTimeout(function () { if (cfg.enabled) inject(false); }, 250);
})();
