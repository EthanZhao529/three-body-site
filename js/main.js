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
    fleet2: 'assets/fleet_lightspeed.png', frozen: 'assets/frozen.png' };
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

  /* ---------- 三体演算:四阶辛算法(Yoshida 1990) + Aarseth 分段线性软化
     逐行移植自用户提供的「三体实时演算」壁纸(SYKM)scene.pkg 内嵌引擎 ---------- */
  var DT = 0.004;
  // Yoshida1990 系数(与壁纸引擎一致)
  var Yw1 = 1.35120719196, Yw0 = -1.70241438392;
  var Yc1 = Yw1 / 2, Yc2 = (Yw0 + Yw1) / 2, Yc3 = Yc2, Yc4 = Yc1;
  var Yd1 = Yw1, Yd2 = Yw0, Yd3 = Yw1;
  // Aarseth 软化(壁纸默认 ras=0.1/k=2.8;此处 ras 调小以保周期解稳定)
  var RAS = 0.05, KSOFT = 2.8, KRAS = KSOFT * RAS;
  var BETA = 3 / (KSOFT - 1), ALPHA = 1 - BETA;
  var DD = 4.5;   // 逃逸重启距离(对质心,壁纸同款)

  var sim = { b: [], pl: {}, trails: [[], [], [], []], chaosMode: false };
  // 壁纸三星配色:恒星1 白(光度1.5) / 恒星2 奶橙(0.5) / 恒星3 红橙(0.1,红巨星最大)
  var SIM_COLS = [
    { core: '#fff8ef', mid: '244,247,255', r: 9 },
    { core: '#ffe3d2', mid: '255,187,155', r: 11 },
    { core: '#ffc0ad', mid: '255,131,95', r: 14 }
  ];
  function simReset() {
    sim.b = [
      { x: -0.97000436, y: 0.24308753, z: 0, vx: 0.4662036850, vy: 0.4323657300, vz: 0 },
      { x: 0.97000436, y: -0.24308753, z: 0, vx: 0.4662036850, vy: 0.4323657300, vz: 0 },
      { x: 0, y: 0, z: 0, vx: -0.93240737, vy: -0.86473146, vz: 0 }
    ];
    sim.pl = { x: 1.7, y: 1.15, z: 0.1, vx: -0.34, vy: 0.3, vz: 0.02 };
    sim.trails = [[], [], [], []];
    sim.chaosMode = false;
  }
  simReset();

  // Aarseth 分段线性软化引力(壁纸 computeAcceleration 的原样移植,G=m=1)
  function aarsethAcc(px, py, pz, skip) {
    var ax = 0, ay = 0, az = 0;
    for (var i = 0; i < 3; i++) {
      if (i === skip) continue;
      var dx = sim.b[i].x - px, dy = sim.b[i].y - py, dz = sim.b[i].z - pz;
      var d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-5);
      var mag;
      if (d <= RAS) mag = d / (RAS * RAS * RAS);
      else if (d < KRAS) mag = (ALPHA + BETA * d / RAS) / (d * d);
      else mag = 1 / (d * d);
      ax += mag * dx / d; ay += mag * dy / d; az += mag * dz / d;
    }
    return [ax, ay, az];
  }
  function drift(c) {
    for (var i = 0; i < 3; i++) {
      var b = sim.b[i];
      b.x += c * DT * b.vx; b.y += c * DT * b.vy; b.z += c * DT * b.vz;
    }
    sim.pl.x += c * DT * sim.pl.vx; sim.pl.y += c * DT * sim.pl.vy; sim.pl.z += c * DT * sim.pl.vz;
  }
  function kick(d) {
    var acc = [];
    for (var i = 0; i < 3; i++) acc.push(aarsethAcc(sim.b[i].x, sim.b[i].y, sim.b[i].z, i));
    for (var j = 0; j < 3; j++) {
      sim.b[j].vx += d * DT * acc[j][0];
      sim.b[j].vy += d * DT * acc[j][1];
      sim.b[j].vz += d * DT * acc[j][2];
    }
    var pa = aarsethAcc(sim.pl.x, sim.pl.y, sim.pl.z, -1);
    sim.pl.vx += d * DT * pa[0]; sim.pl.vy += d * DT * pa[1]; sim.pl.vz += d * DT * pa[2];
  }
  // 一步 = 7 段 drift-kick 序列(壁纸 updatePhysics 同款)
  function yoshidaStep() {
    drift(Yc1); kick(Yd1); drift(Yc2); kick(Yd2); drift(Yc3); kick(Yd3); drift(Yc4);
    var p = sim.pl;
    if (p.x * p.x + p.y * p.y + p.z * p.z > 60) {
      p.x = 1.7; p.y = -1.2; p.z = 0.1; p.vx = -0.3; p.vy = 0.34; p.vz = 0.02;
    }
  }
  var trailTick = 0;
  var simEscaped = false;   // 本帧发生"天体逃逸"重启(供文明系统记事)
  function simAdvance(steps) {
    for (var s = 0; s < steps; s++) {
      yoshidaStep();
      if (++trailTick % 3 === 0) {
        for (var i = 0; i < 3; i++) {
          sim.trails[i].push([sim.b[i].x, sim.b[i].y, sim.b[i].z]);
          if (sim.trails[i].length > 400) sim.trails[i].shift();
        }
        sim.trails[3].push([sim.pl.x, sim.pl.y, sim.pl.z]);
        if (sim.trails[3].length > 400) sim.trails[3].shift();
      }
    }
    // 质心距离超过 DD → 恢复秩序(壁纸的"重启",记为天体逃逸)
    var cx = (sim.b[0].x + sim.b[1].x + sim.b[2].x) / 3;
    var cy2 = (sim.b[0].y + sim.b[1].y + sim.b[2].y) / 3;
    var cz = (sim.b[0].z + sim.b[1].z + sim.b[2].z) / 3;
    for (var q = 0; q < 3; q++) {
      var rx = sim.b[q].x - cx, ry = sim.b[q].y - cy2, rz = sim.b[q].z - cz;
      if (Math.sqrt(rx * rx + ry * ry + rz * rz) > DD) { simEscaped = true; simReset(); break; }
    }
  }

  /* ---------- 视角旋转(壁纸同款:拖拽+惯性,阻尼0.985;闲时缓慢自旋) ---------- */
  var rot = { x: -18, y: 0, vx: 0, vy: 0, dragging: false, lx: 0, ly: 0 };
  function applyRotation(x, y, z) {
    var ax = -rot.x * Math.PI / 180, ay = rot.y * Math.PI / 180;
    var cX = Math.cos(ax), sX = Math.sin(ax);
    var y1 = y * cX - z * sX, z1 = y * sX + z * cX;
    var cY = Math.cos(ay), sY = Math.sin(ay);
    return { x: x * cY + z1 * sY, y: y1, z: -x * sY + z1 * cY };
  }
  function dragOK(e) {
    return (page === 1 || page === 4) &&
      !(e.target && e.target.closest && e.target.closest('.panel, .hud-br, #nav, #dots'));
  }
  addEventListener('mousedown', function (e) {
    if (!dragOK(e) || e.button !== 0) return;
    e.preventDefault();   // 阻止拖拽时选中文字
    rot.dragging = true; rot.lx = e.clientX; rot.ly = e.clientY;
  });
  addEventListener('mouseup', function () { rot.dragging = false; });
  addEventListener('mousemove', function (e) {
    if (!rot.dragging) return;
    rot.vy += (e.clientX - rot.lx) * 0.05;
    rot.vx += (e.clientY - rot.ly) * 0.05;
    rot.lx = e.clientX; rot.ly = e.clientY;
  });
  function rotAdvance() {
    rot.x += rot.vx; rot.y += rot.vy;
    rot.vx *= 0.985; rot.vy *= 0.985;             // 壁纸同款阻尼
    if (!rot.dragging && Math.abs(rot.vy) < 0.02) rot.y += 0.028; // 闲时自旋
    if (rot.x > 80) rot.x = 80; if (rot.x < -80) rot.x = -80;
  }
  var perturbBtn = document.getElementById('perturbBtn');
  var resetBtn = document.getElementById('resetBtn');
  if (perturbBtn) perturbBtn.addEventListener('click', function () {
    for (var i = 0; i < 3; i++) {
      sim.b[i].vx += (Math.random() - 0.5) * 0.24;
      sim.b[i].vy += (Math.random() - 0.5) * 0.24;
      sim.b[i].vz += (Math.random() - 0.5) * 0.18;  // 冲出轨道平面,拖拽旋转可见
    }
    sim.chaosMode = true;
  });
  if (resetBtn) resetBtn.addEventListener('click', function () {
    simEscaped = true;   // 壁纸:手动复位=天体逃逸
    simReset();
  });

  /* ============================================================
     文明纪年系统 —— 壁纸 scene.pkg 内嵌引擎的原样移植
     (阈值/公式/事件文案全部来自原脚本,一字未改)
     ============================================================ */
  var CIV = {
    LK_D: 0.3,       // 凌空距离阈值
    FX_D: 2.0,       // 飞星距离阈值
    FX_T: -60,       // 飞星温度阈值
    COLL_D: 0.2,     // 相撞距离阈值
    ROCHE_D: 0.05,   // 大撕裂(洛希极限)
    LOW_T: -100,     // 低温毁灭
    HIGH_T: 400,     // 高温毁灭
    STAB_LO: -50,    // 恒纪元低温阈值
    STAB_HI: 70      // 恒纪元高温阈值
  };
  var civ = {
    years: 0, count: 191, alive: false, startYear: 0, lastLife: 0, suit: 0,
    log: [],                                   // {y,txt} 最新在前,最多5条
    last: { roche: '', pc: '', lk: '', fx: '', sc: '' },
    era: '乱纪元', state: '脱水', temp: 0,
    d: [1, 1, 1], dp: [1, 1, 1]                // 星-行星距离 / 星-星距离
  };
  // 表面温度:斯特藩-玻尔兹曼平衡温度(壁纸公式,L=1.5/0.5/0.1,含冰雪反照率反馈)
  function simTemp(ds) {
    var toAU = 1e12 / 10 / 1.496e11;           // k_temp_dist=10
    var L = [1.5, 0.5, 0.1], SIG = 5.67e-8, flux = 0;
    for (var i = 0; i < 3; i++) {
      var dAU = Math.max(ds[i], 0.01) * toAU;
      flux += 1361 * L[i] / (dAU * dAU);
    }
    var alb = 0.3;
    var base = Math.pow(flux * 0.7 / (4 * SIG), 0.25) - 273.15;
    if (base < 0) alb = 0.3 + 0.3 * Math.min(1, -base / 20);
    var t = Math.pow(flux * (1 - alb) / (4 * SIG), 0.25) - 273.15
          + 10 * Math.sin(civ.years * 2.1);    // 壁纸的 ±10K 振荡
    return Math.max(-270, Math.min(1500, t));
  }
  function civLog(year, parts) {
    if (!parts.length) return;
    civ.log.unshift({ y: year, txt: '第' + year + '年，' + parts.join('，') });
    if (civ.log.length > 5) civ.log.pop();
  }
  function civAdvance(dt) {
    civ.years += dt * 0.8;                     // ≈壁纸 kt=10 的年速
    var year = Math.floor(civ.years);
    var b = sim.b, p = sim.pl, i;
    for (i = 0; i < 3; i++) {
      var dx = b[i].x - p.x, dy = b[i].y - p.y, dz = b[i].z - p.z;
      civ.d[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    var pairs = [[0, 1], [0, 2], [1, 2]];
    for (i = 0; i < 3; i++) {
      var q = pairs[i];
      var ex = b[q[0]].x - b[q[1]].x, ey = b[q[0]].y - b[q[1]].y, ez = b[q[0]].z - b[q[1]].z;
      civ.dp[i] = Math.sqrt(ex * ex + ey * ey + ez * ez);
    }
    civ.temp = simTemp(civ.d);

    // 当前天象(壁纸判定顺序)
    var cs = { roche: '', pc: '', lk: '', fx: '', sc: '' };
    var roche = [], coll = [], sc = [];
    for (i = 0; i < 3; i++) {
      if (civ.d[i] < CIV.ROCHE_D) roche.push('恒星' + (i + 1));
      else if (civ.d[i] < CIV.COLL_D) coll.push('恒星' + (i + 1));
    }
    if (roche.length) cs.roche = '大撕裂' + roche.join('、');
    if (coll.length) cs.pc = '行星与' + coll.join('、') + '相撞';
    var lkN = 0, fxN = 0;
    for (i = 0; i < 3; i++) if (civ.d[i] < CIV.LK_D) lkN++;
    cs.lk = lkN === 3 ? '三日凌空' : lkN === 2 ? '双日凌空' : lkN === 1 ? '巨日凌空' : '';
    if (civ.temp < CIV.FX_T) for (i = 0; i < 3; i++) if (civ.d[i] > CIV.FX_D) fxN++;
    cs.fx = fxN === 3 ? '三飞星' : fxN === 2 ? '双飞星' : fxN === 1 ? '飞星' : '';
    var scp = [['恒星1与恒星2', 0], ['恒星1与恒星3', 1], ['恒星2与恒星3', 2]];
    for (i = 0; i < 3; i++) if (civ.dp[scp[i][1]] < CIV.COLL_D) sc.push(scp[i][0]);
    cs.sc = sc.join('，');

    var ev = [];
    var destroyed = '';
    function destroy(cause) {
      if (!civ.alive || destroyed) return;
      civ.alive = false;
      civ.lastLife = Math.max(0, year - civ.startYear);
      destroyed = cause;
      ev.push('第' + civ.count + '号文明毁灭于' + cause);
      civ.count++;
      civ.suit = 0;
    }
    // 毁灭优先级:逃逸 > 大撕裂 > 行星相撞 > 恒星相撞 > 温度(原因优先取凌空/飞星)
    if (simEscaped) { destroy('天体逃逸'); simEscaped = false; }
    if (cs.roche) destroy(cs.roche);
    if (cs.pc) destroy(cs.pc);
    if (cs.sc) destroy(cs.sc);
    if (civ.temp < CIV.LOW_T || civ.temp > CIV.HIGH_T)
      destroy(cs.lk || cs.fx || (civ.temp < CIV.LOW_T ? '低温' : '高温'));

    // 文明启动:连续适宜期
    var suitable = civ.temp >= CIV.LOW_T && civ.temp <= CIV.HIGH_T;
    if (suitable) {
      civ.suit += dt;
      if (!civ.alive && civ.suit >= 2) {
        civ.alive = true; civ.suit = 0; civ.startYear = year;
        ev.push('第' + civ.count + '号文明启动');
      }
    } else civ.suit = 0;

    // 天象变化记入日志(壁纸:仅当有文明存在或发生文明事件时)
    var keys = ['roche', 'lk', 'fx', 'pc', 'sc'];
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (cs[k] !== civ.last[k]) {
        if (cs[k] && (civ.alive || ev.length) && ev.indexOf(cs[k]) < 0 &&
            cs[k] !== destroyed) ev.unshift(cs[k]);
        civ.last[k] = cs[k];
      }
    }
    civLog(year, ev);

    // 纪元大字:凌空 > 飞星 > 恒/乱纪元(壁纸判定顺序)
    civ.era = cs.lk || cs.fx ||
      (civ.temp >= CIV.STAB_LO && civ.temp <= CIV.STAB_HI ? '恒纪元' : '乱纪元');
    civ.state = civ.era === '恒纪元' ? '浸泡' : '脱水';
  }

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
  // 舰队页:向消失点收敛的光速星流(与曲率航迹同向)
  var warp = makeParts(85, function (p) {
    p.ang = Math.random() * Math.PI * 2;
    p.r = 0.15 + Math.random() * 1.0;          // 相对最大半径
    p.s = Math.random() * 0.8 + 0.25;          // 收敛速度
    p.b = Math.random() < 0.16;                // 少数更亮的"脉冲"
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
  // 消失点在图内的分数坐标(曲率航迹的汇聚处)
  var VP_FX = 0.895, VP_FY = 0.44;
  function scene0(a, d, now) {
    if (a <= 0) return;
    var im2 = img.fleet2;
    if (!im2.complete || !im2.naturalWidth) return;
    // 机位拉远:翻向第2页时整个舰队世界缩成远景
    var pull = easeIO(clamp01(d));
    var s = 1 - 0.86 * pull;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);

    // 舰队大图:锚定消失点的极缓推近 + 轻微起伏(航行呼吸感)
    var r = coverRect(im2, 1.06);
    var vpx = r[0] + VP_FX * r[2], vpy = r[1] + VP_FY * r[3];
    var z = 1.035 + 0.045 * Math.sin(now / 24000);
    ctx.save();
    ctx.translate(vpx, vpy); ctx.scale(z, z); ctx.translate(-vpx, -vpy);
    ctx.globalAlpha = a;
    ctx.drawImage(im2, r[0], r[1] + 4 * DPR * Math.sin(now / 5200), r[2], r[3]);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 光速航行:全屏星流向消失点收敛(与舰队同速前进,宇宙向后掠去)
    var maxR = Math.sqrt(W * W + H * H) * 1.12;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < warp.length; i++) {
      var p = warp[i];
      p.r *= (1 - 0.0075 * p.s);                    // 指数收敛
      if (p.r < 0.02) { p.r = 0.55 + Math.random() * 0.6; p.ang = Math.random() * Math.PI * 2; }
      var rad = p.r * maxR;
      var px = vpx + Math.cos(p.ang) * rad;
      var py = vpy + Math.sin(p.ang) * rad;
      if (px < -80 || px > W + 80 || py < -80 || py > H + 80) continue;
      var len = Math.min(90 * DPR, rad * 0.075) * (p.b ? 1.7 : 1);
      var fade = clamp01(rad / (140 * DPR)) * clamp01((1.05 - p.r) * 4);
      var al = a * fade * (p.b ? 0.4 : 0.07 + 0.14 * p.s);
      var tx = px + Math.cos(p.ang) * len, ty = py + Math.sin(p.ang) * len;
      var gr = ctx.createLinearGradient(px, py, tx, ty);
      gr.addColorStop(0, 'rgba(198,220,255,' + al.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(198,220,255,0)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = (p.b ? 1.7 : 1.1) * DPR;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ============================================================
     场景 1 · 三体模型实时演算(RK4)
     ============================================================ */
  function scene1(a, d, now) {
    if (a <= 0) return;
    if (window.__use3D) return;   // Three.js 层接管(sim3d.js)
    // 机位从"舰队近景"继续拉远进场:由大到常
    var zin = d < 0 ? 1 + 2.4 * easeIO(-d) : 1 + 0.12 * easeIO(clamp01(d));
    var cx = W / 2, cy = H * 0.47;
    var sc = Math.min(W, H) / 3.8 / zin;
    var tint = sim.chaosMode;

    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var tr = sim.trails[i];
      var col = tint ? '224,64,52' : SIM_COLS[i].mid;
      var prev = null;
      for (var j = 0; j < tr.length; j++) {
        var rp = applyRotation(tr[j][0], tr[j][1], tr[j][2]);
        var pt = [cx + rp.x * sc, cy + rp.y * sc];
        if (prev) {
          var al = j / tr.length;
          ctx.strokeStyle = 'rgba(' + col + ',' + (al * 0.09 * a).toFixed(3) + ')';
          ctx.lineWidth = 5 * DPR;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
          ctx.strokeStyle = 'rgba(' + col + ',' + (al * 0.5 * a).toFixed(3) + ')';
          ctx.lineWidth = 1.4 * DPR;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
        }
        prev = pt;
      }
    }
    for (var k = 0; k < 3; k++) {
      var rk = applyRotation(sim.b[k].x, sim.b[k].y, sim.b[k].z);
      var px = cx + rk.x * sc, py = cy + rk.y * sc;
      var depth = clamp01(0.5 + rk.z * 0.22);           // 近大远小的深度线索
      var R = SIM_COLS[k].r * DPR / Math.sqrt(zin) * (0.75 + depth * 0.5);
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
    var rpl = applyRotation(sim.pl.x, sim.pl.y, sim.pl.z);
    var ppx = cx + rpl.x * sc, ppy = cy + rpl.y * sc;
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
    if (window.__use3D) return;   // Three.js 水滴场景接管
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
    ['● 第二舰队 · 曲率驱动', false, '415 艘 · v = c · 目标 太阳系'],
    ['● 实时演算 · 文明纪年', false, 'Yoshida 四阶辛积分 · Aarseth 软化 · 拖拽旋转视角'],
    ['● 乱纪元 · 两种死法', true, '移动鼠标 · 拨动灾难的界限'],
    ['● 黑暗森林 · 保持静默', true, '1420MHz 广播中 · 不要回答'],
    ['● 警告 · 强互作用力探测器', true, 'v = 0.119c · 表面绝对光滑'],
    ['● 降维打击 · 二维化进行中', true, '太阳系正在跌入二维平面']
  ];

  /* ---------- 演算页壁纸式 HUD(日志/纪元/温度/滑条/波形/年份) ---------- */
  var elLog = document.getElementById('simLog');
  var elEra = document.getElementById('simEra');
  var elState = document.getElementById('simState');
  var elTemp = document.getElementById('simTemp');
  var elYears = document.getElementById('simYears');
  var sfEls = [document.getElementById('sfA'), document.getElementById('sfB'), document.getElementById('sfG')];
  var waveCv = document.getElementById('simWave');
  var waveCtx = waveCv ? waveCv.getContext('2d') : null;
  var tempHist = [], lastWaveT = 0, lastLogHtml = '', lastEraTxt = '';
  function slideFill(d) {
    var v = d > 10 ? 7.5 : d > 5 ? 5 + 0.5 * (d - 5) : d;   // 壁纸的远端压缩映射
    return Math.min(78, v * 10);                             // 满刻度 = 10
  }
  function updateSimHud(now) {
    if (!elEra) return;
    if (civ.era !== lastEraTxt) {
      elEra.textContent = civ.era;
      elEra.classList.toggle('harsh', civ.era !== '恒纪元');
      lastEraTxt = civ.era;
    }
    if (elState) elState.textContent = civ.state;
    if (elTemp) elTemp.textContent = civ.temp.toFixed(2);
    if (elYears) elYears.textContent = civ.years.toFixed(2) + ' Years';
    for (var i = 0; i < 3; i++)
      if (sfEls[i]) sfEls[i].style.width = slideFill(civ.d[i]).toFixed(1) + '%';
    // 文明日志栈(第一行最亮,越旧越淡 —— 壁纸排版)
    var html = '<div class="sl-head">' +
      (civ.alive ? '第' + civ.count + '号文明正在运行' : '文明无法生存') + '</div>' +
      '<div class="sl-sub">' +
      (civ.alive ? '文明已存活: ' + Math.max(0, Math.floor(civ.years) - civ.startYear) + '年'
                 : '上个文明寿命: ' + civ.lastLife + '年') + '</div>';
    for (var j = 0; j < civ.log.length; j++)
      html += '<div style="opacity:' + (0.60 - j * 0.11).toFixed(2) + '">' + civ.log[j].txt + '</div>';
    if (html !== lastLogHtml) { elLog.innerHTML = html; lastLogHtml = html; }
    // 温度史波形(底部时间轴)
    if (waveCtx) {
      if (now - lastWaveT > 180) {
        lastWaveT = now;
        tempHist.push(civ.temp);
        if (tempHist.length > 200) tempHist.shift();
      }
      var wv = waveCv.width, wh = waveCv.height;
      waveCtx.clearRect(0, 0, wv, wh);
      if (tempHist.length > 1) {
        var mn = Infinity, mx = -Infinity;
        for (var m = 0; m < tempHist.length; m++) {
          if (tempHist[m] < mn) mn = tempHist[m];
          if (tempHist[m] > mx) mx = tempHist[m];
        }
        if (mx - mn < 40) { var cmid = (mx + mn) / 2; mn = cmid - 20; mx = cmid + 20; }
        waveCtx.strokeStyle = 'rgba(142,166,200,0.75)';
        waveCtx.lineWidth = 1;
        waveCtx.beginPath();
        for (var w = 0; w < tempHist.length; w++) {
          var wx = w / 199 * wv;
          var wy = wh - 2 - (tempHist[w] - mn) / (mx - mn) * (wh - 4);
          if (w === 0) waveCtx.moveTo(wx, wy); else waveCtx.lineTo(wx, wy);
        }
        waveCtx.stroke();
      }
    }
  }

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

    // 实时演算持续推进(约 240 步/秒) + 文明纪年 + 视角惯性
    simAdvance(Math.max(1, Math.round(dtMs * 0.24)));
    civAdvance(dt);
    rotAdvance();
    // 暴露给 Three.js 渲染层(演算页 + 水滴页)
    window.__sim = sim; window.__rot = rot; window.__civ = civ;
    window.__view = { a1: clamp01(1 - Math.abs(pf - 1)), d1: pf - 1,
                      a4: clamp01(1 - Math.abs(pf - 4)), d4: pf - 4 };


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
    if (cur === 1) updateSimHud(now);
    if (HUD_PAGES[cur]) hud(HUD_PAGES[cur][0], HUD_PAGES[cur][1], HUD_PAGES[cur][2], '');
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
