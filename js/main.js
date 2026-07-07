/* ============================================================
   三体 · 弹性翻页 × 实时演算
   每一页都是独立的实时场景;翻页用弹簧动画(带轻微过冲的弹性)。
   第1↔2页之间有"机位拉远"的镜头衔接。
   三体演算:RK4 四阶龙格库塔(借鉴 Wallpaper Engine
   「三体实时演算」by SYKM 的运算逻辑,美术为本站自制)。
   ============================================================ */
(function () {
  'use strict';

  var PAGES = 6;

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
    os.width = W; os.height = H;
    buildStars();
  }
  var os = document.createElement('canvas');   // 离屏:极寒侧羽化蒙版
  var osx = os.getContext('2d');

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function easeIO(u) { return u * u * (3 - 2 * u); }

  /* ---------- 资源 ---------- */
  var FILES = { nebula: 'assets/hero_nebula.png', chaos: 'assets/chaotic_era.png',
    coast: 'assets/red_coast.png', droplet: 'assets/droplet.png',
    fleet: 'assets/fleet_ships.png', starsea: 'assets/starsea.png', frozen: 'assets/frozen.png' };
  var img = {}, loaded = 0, total = Object.keys(FILES).length;
  var loaderEl = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  Object.keys(FILES).forEach(function (k) {
    img[k] = new Image();
    img[k].onload = img[k].onerror = function () {
      loaded++;
      if (loaderBar) loaderBar.style.width = (loaded / total * 100) + '%';
      if (loaded >= total && loaderEl) {
        loaderEl.classList.add('done');
        setTimeout(function () { loaderEl.remove(); }, 900);
      }
    };
    img[k].src = FILES[k];
  });

  function coverRect(im, zoom) {
    var s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * (zoom || 1);
    var dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    return [(W - dw) / 2, (H - dh) / 2, dw, dh];
  }
  function drawCover(c2, im, alpha, zoom, ox, oy) {
    if (!im.complete || !im.naturalWidth || alpha <= 0) return;
    var r = coverRect(im, zoom);
    c2.globalAlpha = alpha;
    c2.drawImage(im, r[0] + (ox || 0), r[1] + (oy || 0), r[2], r[3]);
    c2.globalAlpha = 1;
  }

  /* ---------- 弹性翻页引擎 ---------- */
  var page = 0;          // 目标页(整数)
  var pf = 0, pv = 0;    // 弹簧位置/速度
  var K = 120, C = 13.5; // 刚度/阻尼 → 轻微过冲的弹性
  var lastFlip = 0;
  var pagesEl = document.getElementById('pages');
  var dots = [];

  function go(n) {
    n = Math.max(0, Math.min(PAGES - 1, n));
    if (n === page) return;
    page = n;
    lastFlip = performance.now();
    document.querySelectorAll('.page').forEach(function (el, i) {
      el.classList.toggle('active', i === page);
    });
    dots.forEach(function (d, i) { d.classList.toggle('on', i === page); });
    document.body.className = 'on-p' + page;
  }

  var acc = 0;
  addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = performance.now();
    if (now - lastFlip < 550) return;
    acc += e.deltaY;
    if (Math.abs(acc) > 40) { go(page + (acc > 0 ? 1 : -1)); acc = 0; }
  }, { passive: false });

  var ty0 = null;
  addEventListener('touchstart', function (e) { ty0 = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', function (e) {
    if (ty0 === null) return;
    var dy = ty0 - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 55 && performance.now() - lastFlip > 500) go(page + (dy > 0 ? 1 : -1));
    ty0 = null;
  }, { passive: true });

  addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(page + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(page - 1); }
  });

  document.querySelectorAll('[data-page]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      go(parseInt(el.getAttribute('data-page'), 10));
    });
  });
  var dotsWrap = document.getElementById('dots');
  if (dotsWrap) {
    for (var di = 0; di < PAGES; di++) {
      (function (n) {
        var d = document.createElement('button');
        d.type = 'button';
        d.addEventListener('click', function () { go(n); });
        dotsWrap.appendChild(d); dots.push(d);
      })(di);
    }
    dots[0].classList.add('on');
  }
  document.body.className = 'on-p0';
  var p0 = document.querySelector('.page');
  if (p0) p0.classList.add('active');

  /* ---------- RK4 三体演算(实时,借鉴壁纸运算逻辑) ---------- */
  var DT = 0.004;
  var sim = { b: [], pl: {}, trails: [[], [], []], chaosMode: false };
  var SIM_COLS = [
    { core: '#fff6e0', mid: '255,196,110', r: 11 },
    { core: '#ffefe6', mid: '255,132,84', r: 9 },
    { core: '#fffdf4', mid: '255,236,190', r: 13 }
  ];
  function simReset() {
    sim.b = [
      { x: -0.97000436, y: 0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
      { x: 0.97000436, y: -0.24308753, vx: 0.4662036850, vy: 0.4323657300 },
      { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 }
    ];
    sim.pl = { x: 1.7, y: 1.15, vx: -0.34, vy: 0.3 };
    sim.trails = [[], [], []];
    sim.chaosMode = false;
  }
  simReset();
  function accAt(px, py, skip) {
    var ax = 0, ay = 0;
    for (var i = 0; i < 3; i++) {
      if (i === skip) continue;
      var dx = sim.b[i].x - px, dy = sim.b[i].y - py;
      var d2 = dx * dx + dy * dy + 0.004;
      var f = 1 / (d2 * Math.sqrt(d2));
      ax += f * dx; ay += f * dy;
    }
    return [ax, ay];
  }
  // RK4:对 12 维状态(3体位置+速度)做四阶积分
  function deriv(st) {
    // st: [x0,y0,vx0,vy0, x1,...] 长度12
    var d = new Array(12);
    for (var i = 0; i < 3; i++) {
      var ax = 0, ay = 0;
      for (var j = 0; j < 3; j++) {
        if (i === j) continue;
        var dx = st[j * 4] - st[i * 4], dy = st[j * 4 + 1] - st[i * 4 + 1];
        var d2 = dx * dx + dy * dy + 0.004;
        var f = 1 / (d2 * Math.sqrt(d2));
        ax += f * dx; ay += f * dy;
      }
      d[i * 4] = st[i * 4 + 2]; d[i * 4 + 1] = st[i * 4 + 3];
      d[i * 4 + 2] = ax; d[i * 4 + 3] = ay;
    }
    return d;
  }
  function rk4Step() {
    var st = [];
    for (var i = 0; i < 3; i++) { st.push(sim.b[i].x, sim.b[i].y, sim.b[i].vx, sim.b[i].vy); }
    var k1 = deriv(st), s2 = [], j;
    for (j = 0; j < 12; j++) s2[j] = st[j] + k1[j] * DT / 2;
    var k2 = deriv(s2), s3 = [];
    for (j = 0; j < 12; j++) s3[j] = st[j] + k2[j] * DT / 2;
    var k3 = deriv(s3), s4 = [];
    for (j = 0; j < 12; j++) s4[j] = st[j] + k3[j] * DT;
    var k4 = deriv(s4);
    for (j = 0; j < 12; j++) st[j] += (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) * DT / 6;
    for (i = 0; i < 3; i++) {
      sim.b[i].x = st[i * 4]; sim.b[i].y = st[i * 4 + 1];
      sim.b[i].vx = st[i * 4 + 2]; sim.b[i].vy = st[i * 4 + 3];
    }
    // 行星(试探质点,半隐式)
    var pa = accAt(sim.pl.x, sim.pl.y, -1);
    sim.pl.vx += pa[0] * DT; sim.pl.vy += pa[1] * DT;
    sim.pl.x += sim.pl.vx * DT; sim.pl.y += sim.pl.vy * DT;
    if (sim.pl.x * sim.pl.x + sim.pl.y * sim.pl.y > 60) {
      sim.pl.x = 1.7; sim.pl.y = -1.2; sim.pl.vx = -0.3; sim.pl.vy = 0.34;
    }
  }
  var trailTick = 0;
  function simAdvance(steps) {
    for (var s = 0; s < steps; s++) {
      rk4Step();
      if (++trailTick % 3 === 0) {
        for (var i = 0; i < 3; i++) {
          sim.trails[i].push([sim.b[i].x, sim.b[i].y]);
          if (sim.trails[i].length > 240) sim.trails[i].shift();
        }
      }
    }
    // 恒星飞散 → 恢复秩序
    for (var q = 0; q < 3; q++) {
      if (sim.b[q].x * sim.b[q].x + sim.b[q].y * sim.b[q].y > 34) { simReset(); break; }
    }
  }
  var perturbBtn = document.getElementById('perturbBtn');
  var resetBtn = document.getElementById('resetBtn');
  if (perturbBtn) perturbBtn.addEventListener('click', function () {
    for (var i = 0; i < 3; i++) {
      sim.b[i].vx += (Math.random() - 0.5) * 0.24;
      sim.b[i].vy += (Math.random() - 0.5) * 0.24;
    }
    sim.chaosMode = true;
  });
  if (resetBtn) resetBtn.addEventListener('click', simReset);

  /* ---------- 星空粒子 ---------- */
  var stars = [];
  function buildStars() {
    stars = [];
    var n = Math.floor(W * H / (5600 * DPR));
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
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var tw = 0.4 + 0.45 * Math.abs(Math.sin(now / 1500 * st.s + st.p));
      var y = collapse > 0 ? lerp(st.y, H * 0.5, easeIO(collapse * ((i % 7) / 7))) : st.y;
      ctx.globalAlpha = alpha * tw * g;
      ctx.fillStyle = (i % 11 === 0) ? '#d8c9b8' : '#eae6dd';
      ctx.beginPath(); ctx.arc(st.x, y, st.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 通用粒子池 ---------- */
  function makeParts(n, init) {
    var a = [];
    for (var i = 0; i < n; i++) { var p = { i: i }; init(p); a.push(p); }
    return a;
  }
  // 舰队页:掠过的星流
  var flow = makeParts(90, function (p) {
    p.x = Math.random(); p.y = Math.random(); p.z = Math.random() * 0.8 + 0.2;
  });
  // 极寒侧:飘雪
  var snow = makeParts(150, function (p) {
    p.x = Math.random(); p.y = Math.random(); p.s = Math.random() * 0.7 + 0.3; p.w = Math.random() * 7;
  });
  // 水滴页:亚光速星光拉线
  var streaks = makeParts(110, function (p) {
    p.x = Math.random(); p.y = Math.random(); p.z = Math.random() * 0.85 + 0.15;
    p.hue = Math.random();
  });

  /* ============================================================
     场景 0 · 三体舰队穿越星海(动态)
     ============================================================ */
  function scene0(a, d, now) {
    if (a <= 0) return;
    // 机位拉远:翻向第2页时整个舰队世界缩成远景
    var pull = easeIO(clamp01(d));
    var s = 1 - 0.86 * pull;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);

    // 星海底图:缓慢漂移 + 呼吸缩放
    drawCover(ctx, img.starsea, a, 1.12 + 0.03 * Math.sin(now / 9000), 18 * Math.sin(now / 13000), 10 * Math.sin(now / 17000));

    // 星流:向后掠过(航行感)
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < flow.length; i++) {
      var p = flow[i];
      p.x -= 0.00022 * p.z * (16.7);
      if (p.x < -0.05) { p.x = 1.05; p.y = Math.random(); }
      var px = p.x * W, py = p.y * H;
      var len = 26 * DPR * p.z;
      var al = 0.5 * p.z * a;
      var gr = ctx.createLinearGradient(px, py, px + len, py);
      gr.addColorStop(0, 'rgba(210,225,255,' + al.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(210,225,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 1.1 * DPR * p.z;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + len, py); ctx.stroke();
    }
    // 舰队:screen 混合(纯黑底自然消隐),缓慢巡航漂移
    ctx.globalCompositeOperation = 'screen';
    drawCover(ctx, img.fleet, a,
      1.04 + 0.025 * Math.sin(now / 8000),
      26 * Math.sin(now / 11000),
      10 * Math.sin(now / 5200) + 6 * Math.sin(now / 3100));
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ============================================================
     场景 1 · 三体模型实时演算(RK4)
     ============================================================ */
  function scene1(a, d, now) {
    if (a <= 0) return;
    // 机位从"舰队近景"继续拉远进场:由大到常
    var zin = d < 0 ? 1 + 2.4 * easeIO(-d) : 1 + 0.12 * easeIO(clamp01(d));
    var cx = W / 2, cy = H * 0.47;
    var sc = Math.min(W, H) / 3.8 / zin;
    var tint = sim.chaosMode;

    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var tr = sim.trails[i];
      var col = tint ? '224,64,52' : SIM_COLS[i].mid;
      for (var j = 1; j < tr.length; j++) {
        var al = j / tr.length;
        var x1 = cx + tr[j - 1][0] * sc, y1 = cy + tr[j - 1][1] * sc;
        var x2 = cx + tr[j][0] * sc, y2 = cy + tr[j][1] * sc;
        ctx.strokeStyle = 'rgba(' + col + ',' + (al * 0.09 * a).toFixed(3) + ')';
        ctx.lineWidth = 5 * DPR;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + col + ',' + (al * 0.5 * a).toFixed(3) + ')';
        ctx.lineWidth = 1.4 * DPR;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    for (var k = 0; k < 3; k++) {
      var px = cx + sim.b[k].x * sc, py = cy + sim.b[k].y * sc;
      var R = SIM_COLS[k].r * DPR / Math.sqrt(zin);
      var mid = tint ? '224,64,52' : SIM_COLS[k].mid;
      var g1 = ctx.createRadialGradient(px, py, 0, px, py, R * 9);
      g1.addColorStop(0, 'rgba(' + mid + ',' + 0.3 * a + ')');
      g1.addColorStop(0.4, 'rgba(' + mid + ',' + 0.1 * a + ')');
      g1.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(px, py, R * 9, 0, 7); ctx.fill();
      var g2 = ctx.createRadialGradient(px, py, 0, px, py, R * 3.2);
      g2.addColorStop(0, 'rgba(' + mid + ',' + 0.85 * a + ')');
      g2.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, R * 3.2, 0, 7); ctx.fill();
      ctx.globalAlpha = a; ctx.fillStyle = SIM_COLS[k].core;
      ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      var sp = ctx.createLinearGradient(px - R * 7, py, px + R * 7, py);
      sp.addColorStop(0, 'rgba(' + mid + ',0)');
      sp.addColorStop(0.5, 'rgba(' + mid + ',' + 0.32 * a + ')');
      sp.addColorStop(1, 'rgba(' + mid + ',0)');
      ctx.fillStyle = sp; ctx.fillRect(px - R * 7, py - DPR, R * 14, 2 * DPR);
    }
    var ppx = cx + sim.pl.x * sc, ppy = cy + sim.pl.y * sc;
    var pg = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 13 * DPR);
    pg.addColorStop(0, 'rgba(150,170,190,' + 0.5 * a + ')');
    pg.addColorStop(1, 'rgba(150,170,190,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(ppx, ppy, 13 * DPR, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a; ctx.fillStyle = '#9db2c4';
    ctx.beginPath(); ctx.arc(ppx, ppy, 4 * DPR, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     场景 2 · 乱纪元:三日凌空 ⇆ 三飞星(60° 模糊界限随鼠标)
     ============================================================ */
  var mouseR = 0.5, mouseSm = 0.5;
  addEventListener('mousemove', function (e) { mouseR = e.clientX / innerWidth; });
  addEventListener('touchmove', function (e) {
    if (e.touches[0]) mouseR = e.touches[0].clientX / innerWidth;
  }, { passive: true });

  function drawHot(c2, a, now) {
    // 三日凌空:热浪扭曲(横向切片错位)+ 灼热脉动
    var im = img.chaos;
    if (!im.complete || !im.naturalWidth) return;
    var r = coverRect(im, 1.05 + 0.02 * Math.sin(now / 5000));
    var strips = 26, sh = Math.ceil(H / strips);
    var ihPer = im.naturalHeight / (H / sh) / (r[3] / H);
    c2.globalAlpha = a;
    for (var i = 0; i < strips; i++) {
      var sy = i * sh;
      var off = Math.sin(sy / 44 + now / 260) * 3.2 * DPR * (0.4 + i / strips);
      var srcY = (sy - r[1]) / r[3] * im.naturalHeight;
      var srcH = sh / r[3] * im.naturalHeight;
      if (srcY < 0 || srcY + srcH > im.naturalHeight) continue;
      c2.drawImage(im, 0, srcY, im.naturalWidth, srcH, r[0] + off, sy, r[2], sh + 1);
    }
    // 灼热脉动
    var pulse = 0.1 + 0.06 * Math.sin(now / 900);
    var g = c2.createRadialGradient(W * 0.5, H * 0.16, 0, W * 0.5, H * 0.16, H * 0.9);
    g.addColorStop(0, 'rgba(255,190,90,' + (pulse * a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, W, H);
    c2.globalAlpha = 1;
  }
  function drawCold(c2, a, now) {
    var im = img.frozen;
    if (!im.complete || !im.naturalWidth) return;
    drawCover(c2 === ctx ? ctx : c2, im, a, 1.07 + 0.02 * Math.sin(now / 7000), 14 * Math.sin(now / 9000), 0);
    // 极光微闪
    var au = 0.06 + 0.05 * Math.sin(now / 1700);
    var g = c2.createLinearGradient(0, 0, 0, H * 0.5);
    g.addColorStop(0, 'rgba(110,230,220,' + (au * a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(110,230,220,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, W, H * 0.5);
    // 飘雪
    c2.globalAlpha = a;
    c2.fillStyle = '#dcebf5';
    for (var i = 0; i < snow.length; i++) {
      var p = snow[i];
      var y = (p.y + now / 16000 * p.s) % 1;
      var x = (p.x + Math.sin(now / 1100 + p.w) * 0.012 + now / 90000 * 0.3) % 1;
      c2.globalAlpha = a * (0.25 + 0.5 * p.s);
      c2.beginPath(); c2.arc(x * W, y * H, (0.6 + p.s * 1.6) * DPR, 0, 7); c2.fill();
    }
    // 底部吹雪雾
    var fog = c2.createLinearGradient(0, H * 0.72, 0, H);
    fog.addColorStop(0, 'rgba(190,215,235,0)');
    fog.addColorStop(1, 'rgba(190,215,235,' + (0.16 * a + 0.05 * Math.sin(now / 2300) * a).toFixed(3) + ')');
    c2.fillStyle = fog; c2.fillRect(0, H * 0.72, W, H * 0.28);
    c2.globalAlpha = 1;
  }
  function scene2(a, d, now) {
    if (a <= 0) return;
    mouseSm += (mouseR - mouseSm) * 0.07;
    // 炙烤面打底(alpha 必须传进去,helper 会覆盖外层 globalAlpha)
    drawHot(ctx, a, now);
    // 极寒面画进离屏,再用 60° 斜线+羽化蒙版切出右侧
    osx.clearRect(0, 0, W, H);
    drawCold(osx, 1, now);
    var mid = lerp(W * 0.22, W * 0.78, mouseSm);   // 界限在屏中高度处的 x
    var slope = Math.tan((90 - 60) * Math.PI / 180); // 60°斜率 → 每单位y偏移
    var feather = 90 * DPR;
    // 蒙版:沿法线方向的渐变(用斜向线性渐变近似)
    var nx = Math.cos(Math.PI / 3), ny = Math.sin(Math.PI / 3) * slope; // 近似法线
    var gx0 = mid - feather, gx1 = mid + feather;
    var mgrad = osx.createLinearGradient(gx0, H / 2 - feather * slope, gx1, H / 2 + feather * slope);
    mgrad.addColorStop(0, 'rgba(0,0,0,0)');
    mgrad.addColorStop(1, 'rgba(0,0,0,1)');
    osx.globalCompositeOperation = 'destination-in';
    // 用大平行四边形填充渐变(覆盖整屏,方向垂直于60°界限)
    osx.fillStyle = mgrad;
    osx.fillRect(0, 0, W, H);
    osx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    ctx.drawImage(os, 0, 0);
    // 界限辉光
    ctx.save();
    ctx.translate(mid, H / 2);
    ctx.rotate(-Math.PI / 3 + Math.PI / 2);
    var lw = ctx.createLinearGradient(-6 * DPR, 0, 6 * DPR, 0);
    lw.addColorStop(0, 'rgba(234,230,221,0)');
    lw.addColorStop(0.5, 'rgba(234,230,221,' + (0.22 * a).toFixed(3) + ')');
    lw.addColorStop(1, 'rgba(234,230,221,0)');
    ctx.fillStyle = lw;
    ctx.fillRect(-6 * DPR, -H, 12 * DPR, H * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     场景 3 · 黑暗森林:红岸在广播(动态)
     ============================================================ */
  var rings = [];
  function scene3(a, d, now) {
    if (a <= 0) return;
    ctx.save();
    drawCover(ctx, img.coast, 0.9 * a, 1.06 + 0.03 * Math.sin(now / 11000), 10 * Math.sin(now / 9000), 0);
    // 漂移暗云
    ctx.globalCompositeOperation = 'multiply';
    for (var i = 0; i < 2; i++) {
      var cxp = ((now / (26000 + i * 9000)) % 1.4 - 0.2 + i * 0.5) * W;
      var cg = ctx.createRadialGradient(cxp, H * (0.2 + i * 0.14), 0, cxp, H * (0.2 + i * 0.14), W * 0.4);
      cg.addColorStop(0, 'rgba(120,60,50,' + (0.35 * a).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(120,60,50,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 天线尖端信标 + 1420MHz 广播圈
    var bx = W * 0.545, by = H * 0.235;
    if (rings.length === 0 || now - rings[rings.length - 1].t0 > 2600) rings.push({ t0: now });
    if (rings.length > 4) rings.shift();
    ctx.globalCompositeOperation = 'lighter';
    for (var r = 0; r < rings.length; r++) {
      var u = (now - rings[r].t0) / 5200;
      if (u > 1) continue;
      ctx.strokeStyle = 'rgba(232,86,77,' + ((1 - u) * 0.4 * a).toFixed(3) + ')';
      ctx.lineWidth = 1.6 * DPR;
      ctx.beginPath(); ctx.arc(bx, by, u * W * 0.42, 0, 7); ctx.stroke();
    }
    var bp = 0.5 + 0.5 * Math.sin(now / 640);
    var bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, 22 * DPR);
    bg2.addColorStop(0, 'rgba(232,86,77,' + (0.8 * bp * a).toFixed(3) + ')');
    bg2.addColorStop(1, 'rgba(232,86,77,0)');
    ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bx, by, 22 * DPR, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ============================================================
     场景 4 · 水滴:亚光速巡航(星光拉线,复刻壁纸质感)
     ============================================================ */
  function scene4(a, d, now) {
    if (a <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < streaks.length; i++) {
      var p = streaks[i];
      p.x -= 0.003 * p.z * 1.4;
      if (p.x < -0.3) { p.x = 1.1 + Math.random() * 0.2; p.y = Math.random(); }
      var px = p.x * W, py = p.y * H;
      var len = (60 + 340 * p.z) * DPR;
      var al = (0.05 + 0.3 * p.z) * a;
      var col = p.hue < 0.75 ? '220,228,255' : (p.hue < 0.9 ? '255,220,235' : '190,160,255');
      var gr = ctx.createLinearGradient(px, py, px + len, py);
      gr.addColorStop(0, 'rgba(' + col + ',' + al.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = (0.8 + p.z * 1.4) * DPR;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + len, py); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'screen';
    var im = img.droplet;
    if (im.complete && im.naturalWidth) {
      var s = (0.42 + 0.02 * Math.sin(now / 3600)) * Math.min(W, H) / im.naturalWidth * 1.6;
      var dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      var x = W * 0.56 - dw / 2 + 8 * DPR * Math.sin(now / 5200);
      var y = H * 0.44 - dh / 2 + 6 * DPR * Math.sin(now / 4100);
      ctx.save();
      ctx.translate(x + dw / 2, y + dh / 2);
      ctx.rotate(-0.16);
      ctx.globalAlpha = a;
      ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ============================================================
     场景 5 · 二向箔:持续降维
     ============================================================ */
  function scene5(a, d, now) {
    if (a <= 0) return;
    var cy = H * 0.5;
    var u = 0.75 + 0.25 * Math.sin(now / 4000);
    var w = W * 1.05;
    var g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, 'rgba(125,211,252,0)');
    g.addColorStop(0.3, 'rgba(125,211,252,' + 0.7 * u * a + ')');
    g.addColorStop(0.5, 'rgba(240,240,255,' + 0.9 * u * a + ')');
    g.addColorStop(0.7, 'rgba(192,132,252,' + 0.7 * u * a + ')');
    g.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.save();
    ctx.shadowColor = 'rgba(160,180,255,' + 0.8 * u * a + ')';
    ctx.shadowBlur = 30 * DPR;
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, cy - 1.4 * DPR, w, 2.8 * DPR);
    ctx.restore();
    // 平面上的倒影微光
    var rg = ctx.createLinearGradient(0, cy, 0, cy + H * 0.22);
    rg.addColorStop(0, 'rgba(140,170,255,' + (0.10 * a).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(140,170,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, cy, W, H * 0.22);
  }

  /* ---------- HUD ---------- */
  var hudEra = document.getElementById('hudEra');
  var hudDist = document.getElementById('hudDist');
  var hudLog = document.getElementById('hudLog');
  var lastEra = '';
  function hud(txt, chaos, log, dist) {
    if (hudEra && txt !== lastEra) { hudEra.textContent = txt; hudEra.classList.toggle('chaos', !!chaos); lastEra = txt; }
    if (hudLog && log !== undefined && hudLog.textContent !== log) hudLog.textContent = log;
    if (hudDist && dist !== undefined && hudDist.textContent !== dist) hudDist.textContent = dist;
  }
  var HUD_PAGES = [
    ['● 第一舰队 · 巡航', false, '目标 太阳系 · 距离 4.22 光年'],
    null, // 实时演算页动态生成
    ['● 乱纪元 · 两种死法', true, '移动鼠标 · 拨动灾难的界限'],
    ['● 黑暗森林 · 保持静默', true, '1420MHz 广播中 · 不要回答'],
    ['● 警告 · 强互作用力探测器', true, 'v = 0.119c · 表面绝对光滑'],
    ['● 降维打击 · 二维化进行中', true, '太阳系正在跌入二维平面']
  ];

  /* ---------- 主循环 ---------- */
  var lastNow = performance.now();
  function frame(now) {
    var dtMs = Math.min(50, now - lastNow); lastNow = now;
    // 弹簧
    var dt = dtMs / 1000;
    pv += (page - pf) * K * dt; pv *= Math.exp(-C * dt);
    pf += pv * dt;
    if (Math.abs(page - pf) < 0.0006 && Math.abs(pv) < 0.002) { pf = page; pv = 0; }
    if (pagesEl) pagesEl.style.transform = 'translateY(' + (-pf * 100) + 'vh)';

    // 实时演算持续推进(约 240 步/秒)
    simAdvance(Math.max(1, Math.round(dtMs * 0.24)));

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070605'; ctx.fillRect(0, 0, W, H);

    function av(i) { return clamp01(1 - Math.abs(pf - i)); }
    // 星空底(舰队页外全程,乱纪元被日光压暗)
    var starA = 0.85 * Math.max(av(1), av(3) * 0.7, av(4) * 0.5, av(5));
    drawStars(now, starA, av(5) > 0.5 ? (0.4 + 0.3 * Math.sin(now / 5000)) : 0);

    scene0(av(0), pf - 0, now);
    scene1(av(1), pf - 1, now);
    scene2(av(2), pf - 2, now);
    scene3(av(3), pf - 3, now);
    scene4(av(4), pf - 4, now);
    scene5(av(5), pf - 5, now);

    // HUD
    var cur = Math.round(pf);
    if (cur === 1) {
      var ds = [];
      for (var q = 0; q < 3; q++) {
        var dx = sim.b[q].x - sim.pl.x, dy = sim.b[q].y - sim.pl.y;
        ds.push(Math.sqrt(dx * dx + dy * dy));
      }
      var sorted = ds.slice().sort(function (m, n) { return m - n; });
      var stable = sorted[0] < sorted[1] * 0.45;
      hud(sim.chaosMode ? '● 已被扰动 · 不可预测' : (stable ? '● 恒纪元' : '● 乱纪元'),
        sim.chaosMode || !stable,
        'RK4 四阶积分 · dt=0.004 · 实时演算中',
        'd₁ ' + ds[0].toFixed(2) + ' · d₂ ' + ds[1].toFixed(2) + ' · d₃ ' + ds[2].toFixed(2) + ' AU');
    } else if (HUD_PAGES[cur]) {
      hud(HUD_PAGES[cur][0], HUD_PAGES[cur][1], HUD_PAGES[cur][2], '');
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 倒计时(仅第一页) ---------- */
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

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
