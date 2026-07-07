/* ============================================================
   三体 · 滚动线性动画引擎
   整页滚动条 = 时间轴。全屏 canvas 上的一切都是滚动进度 t 的
   确定性函数:向下滚是播放,向上滚是严格倒放。
   借鉴 Wallpaper Engine「三体实时演算」(SYKM):
   真实引力预演算 + 仪表盘 HUD。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 画布 ---------- */
  var cv = document.getElementById('stage');
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.width = Math.floor(innerWidth * DPR);
    H = cv.height = Math.floor(innerHeight * DPR);
    cv.style.width = innerWidth + 'px';
    cv.style.height = innerHeight + 'px';
    buildStars();
    measure();
  }

  /* ---------- 工具 ---------- */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  // 阶段进度:t 在 [a,b] 内 → 0..1
  function ph(t, a, b) { return clamp01((t - a) / (b - a)); }
  function easeIO(u) { return u * u * (3 - 2 * u); }

  /* ---------- 图片资源 ---------- */
  var IMGS = { nebula: 'assets/hero_nebula.png', chaos: 'assets/chaotic_era.png',
               coast: 'assets/red_coast.png', droplet: 'assets/droplet.png' };
  var img = {}, loaded = 0, total = Object.keys(IMGS).length;
  var loaderEl = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  Object.keys(IMGS).forEach(function (k) {
    img[k] = new Image();
    img[k].onload = img[k].onerror = function () {
      loaded++;
      if (loaderBar) loaderBar.style.width = (loaded / total * 100) + '%';
      if (loaded >= total && loaderEl) {
        loaderEl.classList.add('done');
        setTimeout(function () { loaderEl.remove(); }, 900);
      }
    };
    img[k].src = IMGS[k];
  });

  // 按 cover 规则画满屏图,带缩放中心偏移
  function drawCover(im, alpha, zoom, oy) {
    if (!im.complete || !im.naturalWidth || alpha <= 0) return;
    var iw = im.naturalWidth, ih = im.naturalHeight;
    var s = Math.max(W / iw, H / ih) * (zoom || 1);
    var dw = iw * s, dh = ih * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2 + (oy || 0) * H, dw, dh);
    ctx.globalAlpha = 1;
  }

  /* ---------- 三体轨迹预演算(确定性,可反复擦洗) ---------- */
  var SAMPLES = 2600, SUB = 4, DT = 0.004;
  var COLS = [
    { core: '#fff6e0', mid: '255,196,110', r: 11 },
    { core: '#ffefe6', mid: '255,132,84', r: 9 },
    { core: '#fffdf4', mid: '255,236,190', r: 13 }
  ];
  function integrate(kick) {
    var b = [
      { x: -0.97000436, y: 0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
      { x: 0.97000436, y: -0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
      { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 }
    ];
    if (kick) { // 固定扰动(确定性混沌)
      b[0].vx += 0.11; b[1].vy -= 0.09; b[2].vx -= 0.07;
    }
    var pl = { x: 1.7, y: 1.15, vx: -0.34, vy: 0.3 };
    var arr = new Float32Array(SAMPLES * 8); // 3太阳xy + 行星xy
    var era = new Uint8Array(SAMPLES);       // 0 恒纪元 / 1 乱纪元
    function acc(px, py, skip) {
      var ax = 0, ay = 0;
      for (var i = 0; i < 3; i++) {
        if (i === skip) continue;
        var dx = b[i].x - px, dy = b[i].y - py;
        var d2 = dx * dx + dy * dy + 0.004;
        var f = 1 / (d2 * Math.sqrt(d2));
        ax += f * dx; ay += f * dy;
      }
      return [ax, ay];
    }
    for (var s = 0; s < SAMPLES; s++) {
      for (var it = 0; it < SUB; it++) {
        for (var i = 0; i < 3; i++) {
          var a = acc(b[i].x, b[i].y, i);
          b[i].vx += a[0] * DT; b[i].vy += a[1] * DT;
        }
        for (var j = 0; j < 3; j++) { b[j].x += b[j].vx * DT; b[j].y += b[j].vy * DT; }
        var pa = acc(pl.x, pl.y, -1);
        pl.vx += pa[0] * DT; pl.vy += pa[1] * DT;
        pl.x += pl.vx * DT; pl.y += pl.vy * DT;
        if (pl.x * pl.x + pl.y * pl.y > 60) { pl.x = 1.7; pl.y = -1.2; pl.vx = -0.3; pl.vy = 0.34; }
      }
      for (var k = 0; k < 3; k++) { arr[s * 8 + k * 2] = b[k].x; arr[s * 8 + k * 2 + 1] = b[k].y; }
      arr[s * 8 + 6] = pl.x; arr[s * 8 + 7] = pl.y;
      var ds = [];
      for (var q = 0; q < 3; q++) {
        var dx2 = b[q].x - pl.x, dy2 = b[q].y - pl.y;
        ds.push(Math.sqrt(dx2 * dx2 + dy2 * dy2));
      }
      ds.sort(function (m, n) { return m - n; });
      era[s] = ds[0] < ds[1] * 0.45 ? 0 : 1;
    }
    return { pos: arr, era: era };
  }
  var TRAJ_ORDER = integrate(false);
  var TRAJ_CHAOS = integrate(true);
  var useChaos = false;

  /* ---------- 星空(带宇宙闪烁与降维塌缩) ---------- */
  var stars = [];
  function buildStars() {
    stars = [];
    var n = Math.floor(W * H / (5200 * DPR));
    for (var i = 0; i < n; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H,
        r: (Math.random() * 1.1 + 0.25) * DPR, p: Math.random() * 7, s: Math.random() * 0.8 + 0.3 });
    }
  }
  var flick = 0, lastFlick = 0;
  function drawStars(now, alpha, collapse) {
    if (alpha <= 0) return;
    if (now - lastFlick > 9000) { flick = 1; lastFlick = now; }
    var g = 1;
    if (flick > 0) { g = 0.25 + 0.75 * Math.abs(Math.cos(flick * Math.PI * 2)); flick -= 0.008; }
    document.documentElement.style.setProperty('--flick', flick > 0 ? '1' : '0');
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var tw = 0.4 + 0.45 * Math.abs(Math.sin(now / 1500 * st.s + st.p));
      var y = collapse > 0 ? lerp(st.y, H * 0.5, easeIO(collapse)) : st.y;
      ctx.globalAlpha = alpha * tw * g;
      ctx.fillStyle = (i % 11 === 0) ? '#d8c9b8' : '#eae6dd';
      ctx.beginPath(); ctx.arc(st.x, y, st.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 恒星系统渲染(擦洗到第 idx 帧) ---------- */
  function drawSystem(alpha, idx) {
    if (alpha <= 0) return;
    var T = useChaos ? TRAJ_CHAOS : TRAJ_ORDER;
    var cx = W / 2, cy = H * 0.46;
    var sc = Math.min(W, H) / 3.8;
    var tail = 150;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var col = useChaos ? '224,64,52' : COLS[i].mid;
      for (var j = Math.max(1, idx - tail); j <= idx; j++) {
        var a = (1 - (idx - j) / tail);
        var x1 = cx + T.pos[(j - 1) * 8 + i * 2] * sc, y1 = cy + T.pos[(j - 1) * 8 + i * 2 + 1] * sc;
        var x2 = cx + T.pos[j * 8 + i * 2] * sc, y2 = cy + T.pos[j * 8 + i * 2 + 1] * sc;
        ctx.strokeStyle = 'rgba(' + col + ',' + (a * 0.09 * alpha).toFixed(3) + ')';
        ctx.lineWidth = 5 * DPR;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + col + ',' + (a * 0.5 * alpha).toFixed(3) + ')';
        ctx.lineWidth = 1.4 * DPR;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    for (var k = 0; k < 3; k++) {
      var px = cx + T.pos[idx * 8 + k * 2] * sc, py = cy + T.pos[idx * 8 + k * 2 + 1] * sc;
      var R = COLS[k].r * DPR;
      var mid = useChaos ? '224,64,52' : COLS[k].mid;
      var g1 = ctx.createRadialGradient(px, py, 0, px, py, R * 9);
      g1.addColorStop(0, 'rgba(' + mid + ',' + 0.3 * alpha + ')');
      g1.addColorStop(0.4, 'rgba(' + mid + ',' + 0.1 * alpha + ')');
      g1.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(px, py, R * 9, 0, 7); ctx.fill();
      var g2 = ctx.createRadialGradient(px, py, 0, px, py, R * 3.2);
      g2.addColorStop(0, 'rgba(' + mid + ',' + 0.85 * alpha + ')');
      g2.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, R * 3.2, 0, 7); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLS[k].core;
      ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      var sp = ctx.createLinearGradient(px - R * 7, py, px + R * 7, py);
      sp.addColorStop(0, 'rgba(' + mid + ',0)');
      sp.addColorStop(0.5, 'rgba(' + mid + ',' + 0.32 * alpha + ')');
      sp.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = sp; ctx.fillRect(px - R * 7, py - DPR, R * 14, 2 * DPR);
    }
    // 行星
    var ppx = cx + T.pos[idx * 8 + 6] * sc, ppy = cy + T.pos[idx * 8 + 7] * sc;
    var pg = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 13 * DPR);
    pg.addColorStop(0, 'rgba(150,170,190,' + 0.5 * alpha + ')');
    pg.addColorStop(1, 'rgba(150,170,190,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(ppx, ppy, 13 * DPR, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#9db2c4';
    ctx.beginPath(); ctx.arc(ppx, ppy, 4 * DPR, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ---------- 水滴 ---------- */
  function drawDroplet(alpha, u) {
    var im = img.droplet;
    if (!im.complete || !im.naturalWidth || alpha <= 0) return;
    var s = lerp(0.05, 0.95, u * u) * Math.min(W, H) / im.naturalWidth * 1.15;
    var dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    var x = lerp(W * 0.72, W * 0.6, u) - dw / 2;
    var y = lerp(H * 0.3, H * 0.46, u) - dh / 2;
    // 高速逼近的星光拉线
    if (u > 0.55) {
      var k = (u - 0.55) / 0.45;
      ctx.strokeStyle = 'rgba(234,230,221,' + (0.25 * k * alpha).toFixed(3) + ')';
      ctx.lineWidth = 1 * DPR;
      for (var i = 0; i < 14; i++) {
        var sy = (i * 97 % H), sx = (i * 173 % W);
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 60 * DPR * k * (0.4 + i % 3 * 0.4), sy + 14 * DPR * k);
        ctx.stroke();
      }
    }
    // screen 模式:图的纯黑底自然消失
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x, y, dw, dh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- 二向箔降维 ---------- */
  function drawFoil(u) {
    if (u <= 0) return;
    var cy = H * 0.5;
    var w = easeIO(clamp01(u * 1.4)) * W * 1.1;
    var glow = 26 * DPR * (0.6 + 0.4 * Math.sin(u * 9));
    var g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, 'rgba(125,211,252,0)');
    g.addColorStop(0.3, 'rgba(125,211,252,' + 0.7 * u + ')');
    g.addColorStop(0.5, 'rgba(240,240,255,' + 0.9 * u + ')');
    g.addColorStop(0.7, 'rgba(192,132,252,' + 0.7 * u + ')');
    g.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.save();
    ctx.shadowColor = 'rgba(160,180,255,' + 0.8 * u + ')';
    ctx.shadowBlur = glow;
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, cy - 1.4 * DPR, w, 2.8 * DPR);
    ctx.restore();
  }

  /* ---------- 章节量尺:由 DOM 实际位置驱动 ---------- */
  var chs = [], marks = {};
  function measure() {
    chs = [];
    ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) chs.push({ id: id, top: el.offsetTop, h: el.offsetHeight });
    });
    var doc = document.documentElement;
    var max = doc.scrollHeight - innerHeight;
    marks = {};
    chs.forEach(function (c) {
      // 每章的进度锚:章顶进入视口底 → 章底离开视口顶
      marks[c.id] = { a: clamp01((c.top - innerHeight) / max), b: clamp01((c.top + c.h - innerHeight) / max) };
    });
    marks.total = max;
  }

  /* ---------- HUD ---------- */
  var hudEra = document.getElementById('hudEra');
  var hudLog = document.getElementById('hudLog');
  var hudDist = document.getElementById('hudDist');
  var hudProg = document.getElementById('hudProg');
  var perturbBtn = document.getElementById('perturbBtn');
  var lastEraTxt = '';
  function setHud(txt, chaos, log) {
    if (txt !== lastEraTxt && hudEra) {
      hudEra.textContent = txt;
      hudEra.classList.toggle('chaos', !!chaos);
      lastEraTxt = txt;
    }
    if (hudLog && log !== undefined && hudLog.textContent !== log) hudLog.textContent = log;
  }
  if (perturbBtn) perturbBtn.addEventListener('click', function () {
    useChaos = !useChaos;
    perturbBtn.textContent = useChaos ? '恢复秩序' : '扰动轨道';
  });

  /* ---------- 主渲染:一切皆 t 的函数 ---------- */
  var targetT = 0, curT = 0;
  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - innerHeight;
    targetT = max > 0 ? (scrollY || doc.scrollTop) / max : 0;
  }
  addEventListener('scroll', onScroll, { passive: true });

  function seg(id) { return marks[id] || { a: 0, b: 0 }; }

  function render(now) {
    curT += (targetT - curT) * 0.12;           // 平滑擦洗
    if (Math.abs(targetT - curT) < 0.0004) curT = targetT;
    var t = curT;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070605';
    ctx.fillRect(0, 0, W, H);

    var s0 = seg('ch0'), s1 = seg('ch1'), s2 = seg('ch2'),
        s3 = seg('ch3'), s4 = seg('ch4'), s5 = seg('ch5');

    /* 星云:序章满屏,随滚动推近,进入三体问题时沉入黑暗 */
    var zoomU = ph(t, 0, s1.b);
    var nebA = 1 - easeIO(ph(t, s1.a * 0.55, s1.a + (s1.b - s1.a) * 0.35));
    drawCover(img.nebula, nebA, 1 + zoomU * 0.55, -zoomU * 0.06);

    /* 恒星系统:三体问题章浮现,乱纪元章淡出 */
    var sysIn = easeIO(ph(t, s1.a * 0.75, s1.a + (s1.b - s1.a) * 0.3));
    var sysOut = 1 - easeIO(ph(t, s2.a, s2.a + (s2.b - s2.a) * 0.4));
    var sysA = Math.min(sysIn, sysOut);
    if (sysA > 0) {
      var tau = ph(t, s1.a, s2.a + (s2.b - s2.a) * 0.4);
      var idx = 1 + Math.floor(tau * (SAMPLES - 2));
      drawSystem(sysA, idx);
      var T2 = useChaos ? TRAJ_CHAOS : TRAJ_ORDER;
      if (sysA > 0.5) {
        var chaosNow = T2.era[idx] === 1;
        setHud(useChaos ? '● 已被扰动 · 不可预测' : (chaosNow ? '● 乱纪元' : '● 恒纪元'),
          chaosNow || useChaos,
          '数值积分 · 辛欧拉 dt=0.004 · 帧 ' + idx + '/' + SAMPLES);
        // 恒星-行星距离读数
        if (hudDist) {
          var d0 = [];
          for (var q = 0; q < 3; q++) {
            var dx = T2.pos[idx * 8 + q * 2] - T2.pos[idx * 8 + 6];
            var dy = T2.pos[idx * 8 + q * 2 + 1] - T2.pos[idx * 8 + 7];
            d0.push(Math.sqrt(dx * dx + dy * dy).toFixed(2));
          }
          hudDist.textContent = 'd₁ ' + d0[0] + ' · d₂ ' + d0[1] + ' · d₃ ' + d0[2] + ' AU';
        }
      }
      if (perturbBtn) perturbBtn.classList.toggle('show', sysA > 0.6);
    } else {
      if (perturbBtn) perturbBtn.classList.remove('show');
      if (hudDist && hudDist.textContent) hudDist.textContent = '';
    }
    document.body.classList.toggle('past-hero', t > s0.b * 0.85);

    /* 乱纪元:行星地表逼近 */
    var chA = easeIO(ph(t, s2.a + (s2.b - s2.a) * 0.15, s2.a + (s2.b - s2.a) * 0.5))
            * (1 - easeIO(ph(t, s3.a, s3.a + (s3.b - s3.a) * 0.35)));
    drawCover(img.chaos, chA, 1 + ph(t, s2.a, s3.a) * 0.18, 0.02);

    /* 黑暗森林:红岸从暗中升起,又归于沉寂 */
    var coA = easeIO(ph(t, s3.a + (s3.b - s3.a) * 0.2, s3.a + (s3.b - s3.a) * 0.55))
            * (1 - easeIO(ph(t, s4.a, s4.a + (s4.b - s4.a) * 0.3))) * 0.85;
    drawCover(img.coast, coA, 1.06, (1 - ph(t, s3.a, s3.b)) * 0.08);

    /* 星空:贯穿全程;乱纪元白昼淡出;终章向二维塌缩 */
    var stA = 0.9 * (1 - chA * 0.92) * (1 - coA * 0.45);
    var collapse = ph(t, s5.a + (s5.b - s5.a) * 0.25, s5.b * 0.99);
    stA *= (1 - easeIO(ph(t, s5.b * 0.96, 1)) * 0.9);
    drawStars(now, stA * (0.35 + 0.65 * (1 - nebA * 0.5)), collapse);

    /* 水滴:从深空逼近 */
    var drU = ph(t, s4.a + (s4.b - s4.a) * 0.1, s4.a + (s4.b - s4.a) * 0.85);
    var drA = easeIO(ph(t, s4.a, s4.a + (s4.b - s4.a) * 0.25))
            * (1 - easeIO(ph(t, s5.a, s5.a + (s5.b - s5.a) * 0.3)));
    if (drA > 0 && drU > 0) drawDroplet(drA, drU);

    /* 二向箔 */
    drawFoil(easeIO(ph(t, s5.a + (s5.b - s5.a) * 0.3, s5.b * 0.98)));

    /* HUD:非三体问题章的状态文案 */
    if (sysA <= 0.5) {
      if (t < s1.a) setHud('● 深空 · 接近半人马座', false, '距离目标 4.22 光年 · 巡航中');
      else if (chA > 0.3) setHud('● 乱纪元 · 脱水！', true, '地表温度骤变 · 文明第 ' + (137 + Math.floor(t * 100)) + ' 号纪元');
      else if (coA > 0.2) setHud('● 黑暗森林 · 保持静默', true, '1420MHz 监听中 · 不要回答');
      else if (drA > 0.3) setHud('● 警告 · 强互作用力探测器', true, '表面绝对光滑 · 无法击穿');
      else if (t > s5.a) setHud('● 降维打击 · 二维化进行中', true, '太阳系正在跌入二维平面');
    }
    if (hudProg) hudProg.style.width = (t * 100).toFixed(2) + '%';

    requestAnimationFrame(render);
  }

  /* ---------- 倒计时 ---------- */
  (function () {
    var el = document.getElementById('countdown');
    if (!el) return;
    var START = ((1379 * 60 + 52) * 60 + 40) * 1000;
    var t0 = Date.now();
    function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
    function tick() {
      var left = Math.max(0, START - (Date.now() - t0));
      el.textContent = pad(Math.floor(left / 3600000), 4) + ':' + pad(Math.floor(left / 60000) % 60, 2) +
        ':' + pad(Math.floor(left / 1000) % 60, 2) + '.' + pad(Math.floor(left / 10) % 100, 2);
      requestAnimationFrame(tick);
    }
    tick();
  })();

  /* ---------- 文字面板滚动显现 ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); } });
  }, { threshold: 0.25 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- 启动 ---------- */
  resize();
  addEventListener('resize', resize);
  addEventListener('load', measure);
  onScroll();
  requestAnimationFrame(render);
})();
