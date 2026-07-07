/* ============================================================
   三体 · 个人网站 交互脚本
   1) 星空 + 宇宙闪烁   2) 幽灵倒计时
   3) 三体问题展台(真实引力 · 可扰动)   4) 滚动显现
   ============================================================ */

/* ---------- 1. 星空与宇宙闪烁 ---------- */
(function () {
  var c = document.getElementById('sky');
  var ctx = c.getContext('2d');
  var stars = [];
  var flicker = 0;          // 0=正常, >0 表示闪烁强度包络
  var lastFlicker = 0;
  var note = document.getElementById('flickerNote');

  function resize() {
    c.width = innerWidth;
    c.height = innerHeight;
    stars = [];
    var n = Math.floor(innerWidth * innerHeight / 4200);
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.2 + 0.2,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.8 + 0.3
      });
    }
  }
  resize();
  addEventListener('resize', resize);

  function draw(t) {
    ctx.clearRect(0, 0, c.width, c.height);

    // 每 9 秒左右,全天星空同步"闪烁"两下(宇宙在闪烁)
    if (t - lastFlicker > 9000) { flicker = 1; lastFlicker = t; }
    var global = 1;
    if (flicker > 0) {
      global = 0.25 + 0.75 * Math.abs(Math.cos(flicker * Math.PI * 2)); // 两次明灭
      flicker -= 0.008;
      if (note) note.classList.add('lit');
    } else if (note) {
      note.classList.remove('lit');
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.4 + 0.45 * Math.abs(Math.sin(t / 1500 * s.s + s.p));
      ctx.globalAlpha = tw * global;
      ctx.fillStyle = (i % 11 === 0) ? '#d8c9b8' : '#eae6dd';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

/* ---------- 2. 幽灵倒计时(从 1379:52:40 起走) ---------- */
(function () {
  var el = document.getElementById('countdown');
  if (!el) return;
  var START = ((1379 * 60 + 52) * 60 + 40) * 1000; // 毫秒
  var t0 = Date.now();
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function tick() {
    var left = START - (Date.now() - t0);
    if (left < 0) left = 0;
    var cs = Math.floor(left / 10) % 100;
    var s = Math.floor(left / 1000) % 60;
    var m = Math.floor(left / 60000) % 60;
    var h = Math.floor(left / 3600000);
    el.textContent = pad(h, 4) + ':' + pad(m, 2) + ':' + pad(s, 2) + '.' + pad(cs, 2);
    requestAnimationFrame(tick);
  }
  tick();
})();

/* ---------- 3. 三体问题展台 ---------- */
(function () {
  var c = document.getElementById('threebody');
  if (!c) return;
  var ctx = c.getContext('2d');

  function fit() {
    var r = c.getBoundingClientRect();
    c.width = Math.floor(r.width * 2);   // 2x 抗锯齿
    c.height = Math.floor(r.height * 2);
  }
  fit();
  addEventListener('resize', fit);

  // Chenciner-Montgomery figure-8 周期解(稳定的"恒纪元")
  var G = 1, dt = 0.004, SUB = 6;
  var suns, planet, trails, perturbed;

  function reset() {
    suns = [
      { x: -0.97000436, y: 0.24308753, vx: 0.4662036850, vy: 0.4323657300, m: 1 },
      { x: 0.97000436, y: -0.24308753, vx: 0.4662036850, vy: 0.4323657300, m: 1 },
      { x: 0, y: 0, vx: -0.93240737, vy: -0.86473146, m: 1 }
    ];
    planet = { x: 1.7, y: 1.15, vx: -0.34, vy: 0.3 };
    trails = [[], [], []];
    perturbed = false;
    setState('系统运行中 · 周期解稳定', false);
    setEra('● 秩序 · 周期解', false);
  }

  var stateEl = document.getElementById('exhibitState');
  var eraEl = document.getElementById('eraTag');
  function setState(txt, alert) {
    if (!stateEl) return;
    stateEl.textContent = txt;
    stateEl.classList.toggle('alert', !!alert);
  }
  function setEra(txt, chaos) {
    if (!eraEl) return;
    eraEl.textContent = txt;
    eraEl.classList.toggle('chaos', !!chaos);
  }

  function acc(px, py, self) {
    var ax = 0, ay = 0;
    for (var i = 0; i < 3; i++) {
      if (suns[i] === self) continue;
      var dx = suns[i].x - px, dy = suns[i].y - py;
      var d2 = dx * dx + dy * dy + 0.004;
      var f = G * suns[i].m / (d2 * Math.sqrt(d2));
      ax += f * dx; ay += f * dy;
    }
    return [ax, ay];
  }

  var MAXTRAIL = 300;
  function step() {
    for (var s = 0; s < SUB; s++) {
      for (var i = 0; i < 3; i++) {
        var a = acc(suns[i].x, suns[i].y, suns[i]);
        suns[i].vx += a[0] * dt; suns[i].vy += a[1] * dt;
      }
      for (var j = 0; j < 3; j++) { suns[j].x += suns[j].vx * dt; suns[j].y += suns[j].vy * dt; }
      var pa = acc(planet.x, planet.y, null);
      planet.vx += pa[0] * dt; planet.vy += pa[1] * dt;
      planet.x += planet.vx * dt; planet.y += planet.vy * dt;
      if (planet.x * planet.x + planet.y * planet.y > 42) {
        planet.x = 1.7; planet.y = -1.2; planet.vx = -0.3; planet.vy = 0.34;
      }
    }
    for (var k = 0; k < 3; k++) {
      trails[k].push([suns[k].x, suns[k].y]);
      if (trails[k].length > MAXTRAIL) trails[k].shift();
    }
    // 恒星飞散(被扰动后可能发生) → 自动恢复秩序
    var far = 0;
    for (var q = 0; q < 3; q++) {
      if (suns[q].x * suns[q].x + suns[q].y * suns[q].y > 30) far++;
    }
    if (far > 0) reset();
  }

  var eraTimer = 0;
  function updateEra() {
    if (!perturbed) { setEra('● 秩序 · 周期解', false); return; }
    var ds = suns.map(function (s) {
      var dx = s.x - planet.x, dy = s.y - planet.y;
      return Math.sqrt(dx * dx + dy * dy);
    }).sort(function (a, b) { return a - b; });
    var stable = ds[0] < ds[1] * 0.45;
    setEra(stable ? '● 恒纪元 · 短暂' : '● 乱纪元', !stable);
  }

  function draw() {
    step();
    ctx.clearRect(0, 0, c.width, c.height);
    var cx = c.width / 2, cy = c.height / 2;
    var scale = Math.min(c.width, c.height) / 3.6;

    // 轨迹(纸白细线,越新越亮;扰动后泛红)
    for (var i = 0; i < 3; i++) {
      var tr = trails[i];
      for (var j = 1; j < tr.length; j++) {
        var a = j / tr.length * (perturbed ? 0.6 : 0.42);
        ctx.strokeStyle = perturbed
          ? 'rgba(220,90,80,' + a + ')'
          : 'rgba(234,230,221,' + a + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + tr[j - 1][0] * scale, cy + tr[j - 1][1] * scale);
        ctx.lineTo(cx + tr[j][0] * scale, cy + tr[j][1] * scale);
        ctx.stroke();
      }
    }
    // 三颗恒星(纸白实心点 + 微光)
    for (var k = 0; k < 3; k++) {
      var px = cx + suns[k].x * scale, py = cy + suns[k].y * scale;
      var g = ctx.createRadialGradient(px, py, 0, px, py, 34);
      g.addColorStop(0, 'rgba(234,230,221,.5)');
      g.addColorStop(1, 'rgba(234,230,221,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 34, 0, 7); ctx.fill();
      ctx.fillStyle = '#eae6dd';
      ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill();
    }
    // 行星(灰点)
    var ppx = cx + planet.x * scale, ppy = cy + planet.y * scale;
    ctx.fillStyle = '#8a857a';
    ctx.beginPath(); ctx.arc(ppx, ppy, 5, 0, 7); ctx.fill();

    if (++eraTimer % 30 === 0) updateEra();
    requestAnimationFrame(draw);
  }

  // 扰动:给每颗恒星一点随机速度踢击 → 周期解崩塌
  var perturbBtn = document.getElementById('perturbBtn');
  var resetBtn = document.getElementById('resetBtn');
  if (perturbBtn) perturbBtn.addEventListener('click', function () {
    for (var i = 0; i < 3; i++) {
      suns[i].vx += (Math.random() - 0.5) * 0.22;
      suns[i].vy += (Math.random() - 0.5) * 0.22;
    }
    perturbed = true;
    setState('警告 · 初始条件已被污染,轨道不再可预测', true);
  });
  if (resetBtn) resetBtn.addEventListener('click', reset);

  reset();
  requestAnimationFrame(draw);
})();

/* ---------- 4. 滚动显现 ---------- */
(function () {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
