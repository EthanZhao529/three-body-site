import { useEffect, useRef } from 'react';

// 二向箔 · 降维打击(纯 Canvas 2D,零依赖)
// 三态:三维太阳系 → 投放二向箔 → 整个黄道盘被"拍平"成二维之画。
// 核心数学即降维隐喻:黄道盘 pitch 从斜视(≈47°)转到正对(90°),投影短轴 ry=rx·sin(pitch)→rx,
// z 深度随 pitch 归零 —— 立体感消失,太阳系摊成一个正圆平面,再溶解为梵高漩涡星空/丝绸。
// onPhase 对外只报三态 'space' | 'collapsing' | 'plane';onReady 交出 { collapse, restore } 供 HUD 驱动。
export default function FoilCollapse({ onPhase, onReady }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const TAU = Math.PI * 2;
    const HALF_PI = Math.PI / 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

    // ---- 画布尺寸 / 场景锚点 ----
    let W = 1, H = 1, cx = 0, cy = 0, U = 1;
    const resize = () => {
      W = host.clientWidth || 1; H = host.clientHeight || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H * 0.52; U = Math.min(W, H);
      seedStars(); seedSilk();
    };

    // ---- 太阳系(人类太阳系,视觉尺度,非真实比例) ----
    const PLANETS = [
      { a: 0.15, size: 2.0, color: '#b8a99a', spd: 1.55, hue: 32 },              // 水星
      { a: 0.22, size: 3.6, color: '#e6c48a', spd: 1.15, hue: 42 },              // 金星
      { a: 0.30, size: 3.9, color: '#7fb0ff', spd: 1.0, hue: 212 },              // 地球
      { a: 0.385, size: 3.0, color: '#e0674a', spd: 0.81, hue: 14 },             // 火星
      { a: 0.55, size: 8.6, color: '#d8a878', spd: 0.44, hue: 30 },              // 木星
      { a: 0.70, size: 7.2, color: '#e8d29a', spd: 0.33, hue: 46, ring: true },  // 土星
      { a: 0.84, size: 5.2, color: '#a8e6e6', spd: 0.24, hue: 180 },             // 天王星
      { a: 0.97, size: 5.4, color: '#5f86e0', spd: 0.19, hue: 220 },             // 海王星
    ];
    PLANETS.forEach(p => { p.theta = Math.random() * TAU; p.trail = []; });

    // ---- 背景星野 ----
    let STARS = [];
    const seedStars = () => {
      const n = clamp((W * H) / 5200, 90, 260) | 0;
      STARS = Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(), r: rand(0.4, 1.5),
        a: rand(0.25, 0.85), tw: rand(0.5, 1.8), ph: rand(0, TAU),
        warm: Math.random() < 0.15,
      }));
    };

    // ---- 流光粒子(二维之画:漩涡星空/丝绸) ----
    let SILK = [];
    const seedSilk = () => {
      const n = clamp((W * H) / 8600, 130, 440) | 0;
      SILK = Array.from({ length: n }, () => ({
        ang: Math.random() * TAU,
        rr: Math.sqrt(Math.random()) * 0.6,   // 极径(相对 U)
        seed: Math.random() * TAU,
        x: 0, y: 0, px: 0, py: 0, init: false,
      }));
    };

    // ---- 状态机 ----
    let phase = 'space';           // space | dropping | collapsing | plane | restoring
    let p = 0;                     // 降维进度 0..1
    let dropT = 0;                 // 二向箔下落进度 0..1
    let flash = 0;                 // 降维前沿闪光 0..1
    let sysAngle = rand(0, TAU);   // 系统绕 Y 缓慢自转
    const DROP_DUR = 1.0, COLLAPSE_DUR = 2.7, RESTORE_DUR = 1.5;
    const report = ph => onPhase && onPhase(ph);

    // 随 p 变化的相机参数(斜视立体 → 正对平面 → 放大铺开)
    const pitchOf = pp => lerp(0.82, HALF_PI, easeIO(pp));  // 47° → 90°(正对=纯平面)
    const wsOf = pp => U * lerp(0.44, 0.74, easeIO(pp));    // 世界尺度(像素),塌缩放大
    const camOf = pp => U * lerp(1.35, 4.8, easeIO(pp));    // 相机距,塌缩趋正交(透视消失)

    // 3D 世界点(黄道面 y=0)→ 屏幕。先绕 Y 自转,再绕 X 倾斜 pitch,末端透视。
    const project = (wx, wy, wz, pitch, wsPx, camPx) => {
      const sy0 = Math.sin(sysAngle), cy0 = Math.cos(sysAngle);
      const x1 = wx * cy0 - wz * sy0;
      const z1 = wx * sy0 + wz * cy0;
      const sinP = Math.sin(pitch), cosP = Math.cos(pitch);
      const y2 = wy * cosP - z1 * sinP;
      const z2 = wy * sinP + z1 * cosP;
      const Xp = x1 * wsPx, Yp = y2 * wsPx, Zp = z2 * wsPx;
      const persp = camPx / (camPx + Zp);
      return { sx: cx + Xp * persp, sy: cy - Yp * persp, depth: z2, persp };
    };

    // ---- 绘制:太阳系 ----
    const drawSystem = (alpha, pitch, wsPx, camPx, t) => {
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = alpha;

      // 轨道线
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1;
      for (const pl of PLANETS) {
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * TAU;
          const q = project(Math.cos(a) * pl.a, 0, Math.sin(a) * pl.a, pitch, wsPx, camPx);
          i ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy);
        }
        ctx.strokeStyle = 'rgba(151,195,255,0.10)';
        ctx.stroke();
      }

      // 太阳(中心)
      const sun = project(0, 0, 0, pitch, wsPx, camPx);
      ctx.globalCompositeOperation = 'lighter';
      const sunR = U * 0.11;
      const sg = ctx.createRadialGradient(sun.sx, sun.sy, 0, sun.sx, sun.sy, sunR);
      sg.addColorStop(0, 'rgba(255,244,214,0.95)');
      sg.addColorStop(0.2, 'rgba(255,207,138,0.85)');
      sg.addColorStop(0.5, 'rgba(255,163,90,0.35)');
      sg.addColorStop(1, 'rgba(255,140,70,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sun.sx, sun.sy, sunR, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,196,0.95)';
      ctx.beginPath(); ctx.arc(sun.sx, sun.sy, U * 0.016, 0, TAU); ctx.fill();

      // 行星(按深度排序:远的先画)
      const items = PLANETS.map(pl => {
        const q = project(Math.cos(pl.theta) * pl.a, 0, Math.sin(pl.theta) * pl.a, pitch, wsPx, camPx);
        return { pl, q };
      }).sort((a, b) => a.q.depth - b.q.depth);

      for (const { pl, q } of items) {
        const r = pl.size * (0.7 + q.persp * 0.5);
        // 行星拖尾(塌缩时被拉进画里的流光,p 越大越长越亮)
        if (p > 0.02 && pl.trail.length > 1) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          for (let i = 1; i < pl.trail.length; i++) {
            const s0 = pl.trail[i - 1], s1 = pl.trail[i];
            const f = i / pl.trail.length;
            ctx.strokeStyle = `hsla(${pl.hue},80%,65%,${(f * 0.5 * p).toFixed(3)})`;
            ctx.lineWidth = r * f * 0.9;
            ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
          }
        }
        // 土星环
        if (pl.ring) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = 'rgba(232,210,154,0.5)';
          ctx.lineWidth = r * 0.5;
          ctx.beginPath();
          ctx.ellipse(q.sx, q.sy, r * 2.5, r * 2.5 * Math.sin(pitch), 0, 0, TAU);
          ctx.stroke();
        }
        // 光晕 + 星体
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createRadialGradient(q.sx, q.sy, 0, q.sx, q.sy, r * 3.4);
        hg.addColorStop(0, `hsla(${pl.hue},75%,70%,0.55)`);
        hg.addColorStop(1, `hsla(${pl.hue},75%,70%,0)`);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r * 3.4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = pl.color;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };

    // ---- 绘制:二维之画(漩涡流光) ----
    const drawPlane = (alpha, pitch, t, dt) => {
      if (alpha <= 0.001) return;
      const squash = Math.sin(pitch);           // 与黄道盘一致:π/2 时=1 正圆
      const spread = U * lerp(0.46, 0.66, alpha);

      // 画布底:深靛蓝径向雾(梵高星空的夜底)
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, U * 0.85);
      bg.addColorStop(0, 'rgba(30,44,92,0.55)');
      bg.addColorStop(0.5, 'rgba(16,24,58,0.55)');
      bg.addColorStop(1, 'rgba(4,6,20,0.4)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 流光粒子:漩涡场(内快外慢的切向流 + 径向起伏)
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const s of SILK) {
        s.ang += (0.18 + 0.42 * (1 - s.rr)) * dt;
        s.rr += Math.sin(t * 0.5 + s.seed + s.ang * 2.5) * 0.0016;
        s.rr = clamp(s.rr, 0.03, 0.62);
        const R = s.rr * spread;
        s.px = s.x; s.py = s.y;
        s.x = cx + Math.cos(s.ang) * R;
        s.y = cy + Math.sin(s.ang) * R * squash;
        if (!s.init) { s.px = s.x; s.py = s.y; s.init = true; }
        // 梵高蓝金:多蓝,金点缀
        const mix = 0.5 + 0.5 * Math.sin(s.ang * 2 + s.rr * 9 + t * 0.5 + s.seed);
        const hue = lerp(212, 44, mix * mix);
        const li = 55 + 12 * Math.sin(t + s.seed);
        ctx.strokeStyle = `hsla(${hue | 0},88%,${li | 0}%,${(0.42 * alpha).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
      }

      // 中心金核(太阳成为画的漩涡核)
      const cr = U * 0.14;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, `rgba(255,238,200,${0.9 * alpha})`);
      cg.addColorStop(0.35, `rgba(255,180,110,${0.5 * alpha})`);
      cg.addColorStop(1, 'rgba(255,150,90,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
      ctx.restore();
    };

    // ---- 绘制:二向箔本体(下落) ----
    const drawFoil = t => {
      if (phase !== 'dropping') return;
      const e = easeIO(clamp(dropT, 0, 1));
      const fx = lerp(W * 0.86, cx, e);
      const fy = lerp(-H * 0.12, cy, e);
      const rot = t * 2.4 + dropT * 6;
      const len = U * 0.05 * (1 - e * 0.5);
      const wid = U * 0.006;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      ctx.globalCompositeOperation = 'lighter';
      // 彩虹微光薄片
      const grd = ctx.createLinearGradient(-len, 0, len, 0);
      grd.addColorStop(0, 'rgba(150,200,255,0)');
      grd.addColorStop(0.4, 'rgba(200,230,255,0.9)');
      grd.addColorStop(0.5, 'rgba(255,255,255,1)');
      grd.addColorStop(0.6, 'rgba(255,220,180,0.9)');
      grd.addColorStop(1, 'rgba(255,180,140,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(-len, -wid, len * 2, wid * 2);
      ctx.shadowColor = 'rgba(200,225,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillRect(-len, -wid * 0.4, len * 2, wid * 0.8);
      ctx.restore();
    };

    // ---- 主循环 ----
    let raf = 0, last = performance.now();
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;

      // 状态推进
      if (phase === 'space') {
        sysAngle += 0.05 * dt;
      } else if (phase === 'dropping') {
        sysAngle += 0.05 * dt;
        dropT += dt / DROP_DUR;
        if (dropT >= 1) { phase = 'collapsing'; p = 0; flash = 1; }
      } else if (phase === 'collapsing') {
        sysAngle += 0.05 * dt * (1 - easeIO(p));
        p = Math.min(1, p + dt / COLLAPSE_DUR);
        if (p >= 1) { phase = 'plane'; report('plane'); }
      } else if (phase === 'restoring') {
        p = Math.max(0, p - dt / RESTORE_DUR);
        if (p <= 0) { phase = 'space'; PLANETS.forEach(pl => (pl.trail = [])); report('space'); }
      }
      // 行星公转(space/dropping 全速;塌缩逐渐定格)
      const spin = phase === 'plane' ? 0 : (1 - easeIO(p));
      for (const pl of PLANETS) pl.theta += pl.spd * 0.2 * dt * spin;

      const pitch = pitchOf(p), wsPx = wsOf(p), camPx = camOf(p);

      // 更新行星拖尾(存屏幕点)
      for (const pl of PLANETS) {
        const q = project(Math.cos(pl.theta) * pl.a, 0, Math.sin(pl.theta) * pl.a, pitch, wsPx, camPx);
        pl.trail.push({ x: q.sx, y: q.sy });
        if (pl.trail.length > 22) pl.trail.shift();
      }

      // 分层透明度:塌缩后半段,二维之画淡入、太阳系淡隐
      const planeAlpha = clamp((p - 0.5) / 0.5, 0, 1);
      const sysAlpha = 1 - planeAlpha * 0.82;

      ctx.clearRect(0, 0, W, H);

      // 背景星野(被二维画覆盖时淡出)
      const starA = 1 - planeAlpha;
      if (starA > 0.01) {
        ctx.globalCompositeOperation = 'source-over';
        for (const s of STARS) {
          const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
          ctx.fillStyle = s.warm
            ? `rgba(255,225,190,${(s.a * tw * starA).toFixed(3)})`
            : `rgba(200,222,255,${(s.a * tw * starA).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
        }
      }

      drawSystem(sysAlpha, pitch, wsPx, camPx, t);
      drawPlane(planeAlpha, pitch, t, dt);
      drawFoil(t);

      // 降维前沿闪光(二向箔落定瞬间的白色扩散环)
      if (flash > 0.01) {
        flash = Math.max(0, flash - dt / 0.8);
        const fr = U * (1 - flash) * 0.9;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(220,235,255,${(flash * 0.8).toFixed(3)})`;
        ctx.lineWidth = U * 0.01 * flash + 1;
        ctx.beginPath(); ctx.arc(cx, cy, fr, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    };

    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    raf = requestAnimationFrame(frame);

    // ---- 对外 API ----
    const api = {
      collapse: () => {
        if (phase !== 'space') return;
        phase = 'dropping'; dropT = 0; report('collapsing');
      },
      restore: () => {
        if (phase === 'space' || phase === 'restoring') return;
        phase = 'restoring'; flash = 0; report('space');
      },
    };
    onReady && onReady(api);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
