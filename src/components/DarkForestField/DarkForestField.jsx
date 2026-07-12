import { useEffect, useRef } from 'react';

// 黑暗森林星野:每个亮点都是一个文明(带完整档案)
// 交互:悬停锁定→onTarget 上报文明情报(页面显示情报卡)
//       点击→进入瞄准态 onAim(页面弹武器菜单)→api.fire('photoid'|'foil') 执行打击
// 武器:光粒=金色光矢+爆炸序列帧(CC0素材,金橙重调色)+冲击波+粒子+震屏+白闪
//       二向箔=虹彩薄膜投放展开,目标被压扁二维化,涟漪扩散
// 氛围:星云雾团漂移+偶发流星+星点摇曳;命中/重生判定走 setTimeout(后台安全)
export default function DarkForestField({ onStrike, onSpawn, onCensus, onTarget, onAim, onReady }) {
  const hostRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onStrike, onSpawn, onCensus, onTarget, onAim, onReady };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let W = 1;
    let H = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars = [];
    const streaks = [];
    const flashes = [];
    const explosions = [];
    const sparks = [];
    const shockwaves = [];
    const foils = [];
    let shake = null;
    let whiteFlash = null;
    let hover = null;
    let pending = null;     // 瞄准中的目标(武器菜单打开)
    let cleansed = 0;
    let raf = 0;
    const timers = new Set();
    const rand = (a, b) => a + Math.random() * (b - a);

    // 爆炸序列帧(OpenGameArt CC0"Explosion sprite",已重调为金橙;8×4=32帧,每帧256px)
    const sprite = new Image();
    sprite.src = `${import.meta.env.BASE_URL}assets/fx/explosion-gold.webp`;

    const STAGES = ['原始文明', '农耕文明', '工业文明', '原子文明', '信息文明', '星际文明'];
    const makeStar = born => {
      const fx = rand(0.02, 0.98);
      const fy = rand(0.1, 0.96);
      const coordStr = `[ ${((fx - 0.5) * 24).toFixed(2)}, ${((0.5 - fy) * 14).toFixed(2)}, ${rand(-8, 8).toFixed(2)} ]`;
      const si = Math.floor(rand(0, 6));
      return {
        fx, fy, coordStr,
        // 文明档案
        intel: {
          coordStr,
          dist: rand(4.2, 1200).toFixed(1) + ' 光年',
          aliveT: rand(0.3, 460).toFixed(1) + ' 万年',
          stage: STAGES[si],
          tech: 'K-' + (0.4 + si * 0.32 + rand(0, 0.28)).toFixed(2),
          threat: si <= 1 ? ['低', '#8fd9a8'] : si <= 3 ? ['中', '#e8c66a'] : si === 4 ? ['高', '#ffa26a'] : ['极高', '#ff5a3c']
        },
        r: rand(0.8, 2.3),
        a: rand(0.5, 0.95),
        tw: rand(0.4, 1.8),
        ph: rand(0, Math.PI * 2),
        ph2: rand(0, Math.PI * 2),
        warm: Math.random() < 0.18,
        alive: true,
        targeted: false,
        death0: 0,
        birth0: born ? performance.now() : 0
      };
    };
    const starX = (s, t) => s.fx * W + Math.sin(t * 0.25 + s.ph2) * 3.5;
    const starY = (s, t) => s.fy * H + Math.cos(t * 0.21 + s.ph2) * 2.5;

    const census = () =>
      cbRef.current.onCensus?.({ alive: stars.filter(s => s.alive).length, cleansed });

    const resize = () => {
      W = host.clientWidth || 1;
      H = host.clientHeight || 1;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    stars = Array.from(
      { length: Math.round(Math.min(Math.max((window.innerWidth * window.innerHeight) / 14000, 45), 110)) },
      () => makeStar(false)
    );
    census();

    // 星云雾团 + 流星
    const wisps = [
      { fx: 0.22, fy: 0.3, rF: 0.30, rgb: '90,130,210', a: 0.055, ang: rand(0, 7), sp: 0.0022 },
      { fx: 0.72, fy: 0.62, rF: 0.26, rgb: '120,100,200', a: 0.05, ang: rand(0, 7), sp: 0.0018 },
      { fx: 0.5, fy: 0.82, rF: 0.22, rgb: '80,120,190', a: 0.045, ang: rand(0, 7), sp: 0.0026 },
      { fx: 0.88, fy: 0.18, rF: 0.2, rgb: '170,120,100', a: 0.04, ang: rand(0, 7), sp: 0.002 }
    ];
    let meteor = null;
    let meteorNext = performance.now() + rand(6000, 14000);

    const toLocal = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const findStar = (x, y) => {
      const t = performance.now() / 1000;
      let best = null;
      let bd = 20;
      for (const s of stars) {
        if (!s.alive || s.targeted) continue;
        const d = Math.hypot(starX(s, t) - x, starY(s, t) - y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };

    /* ---------- 击毁结算(两种武器共用记账) ---------- */
    const destroy = (s, weapon) => {
      if (!s.alive) return;
      const t = performance.now() / 1000;
      const x = starX(s, t);
      const y = starY(s, t);
      s.alive = false;
      s.death0 = performance.now();
      if (hover === s) {
        hover = null;
        cbRef.current.onTarget?.(null);
      }
      cleansed += 1;
      cbRef.current.onStrike?.({ coordStr: s.coordStr, n: cleansed, weapon });
      census();
      if (weapon === 'photoid') {
        flashes.push({ x, y, t0: performance.now() });
        explosions.push({ x, y, t0: performance.now(), rot: rand(0, 6.28), size: rand(210, 260) });
        shockwaves.push({ x, y, t0: performance.now(), d: 0 });
        shockwaves.push({ x, y, t0: performance.now(), d: 140 });
        for (let i = 0; i < 26; i++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(70, 320);
          sparks.push({
            x, y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            t0: performance.now(), life: rand(650, 1100),
            warm: Math.random() < 0.7
          });
        }
        shake = { t0: performance.now(), dur: 420, amp: 7 };
        whiteFlash = { t0: performance.now(), dur: 320 };
      }
      // 12~26 秒后,新的文明诞生
      const tid = setTimeout(() => {
        timers.delete(tid);
        const ns = makeStar(true);
        stars.push(ns);
        cbRef.current.onSpawn?.({ coordStr: ns.coordStr });
        census();
      }, rand(12000, 26000));
      timers.add(tid);
    };

    /* ---------- 武器一:光粒(动能打击) ---------- */
    const firePhotoid = s => {
      const t = performance.now() / 1000;
      const side = Math.floor(rand(0, 3));
      let x0;
      let y0;
      if (side === 0) { x0 = rand(0, W); y0 = -40; }
      else if (side === 1) { x0 = -40; y0 = rand(0, H * 0.6); }
      else { x0 = W + 40; y0 = rand(0, H * 0.6); }
      const dur = 300;
      streaks.push({ x0, y0, x1: starX(s, t), y1: starY(s, t), t0: performance.now(), dur });
      const tid = setTimeout(() => { timers.delete(tid); destroy(s, 'photoid'); }, dur);
      timers.add(tid);
    };

    /* ---------- 武器二:二向箔(降维打击) ---------- */
    const fireFoil = s => {
      const t = performance.now() / 1000;
      const x = starX(s, t);
      const y = starY(s, t);
      foils.push({ x, y, t0: performance.now(), r: s.r, warm: s.warm });
      const tid = setTimeout(() => { timers.delete(tid); destroy(s, 'foil'); }, 1000);
      timers.add(tid);
    };

    /* ---------- 瞄准/开火 API(交给页面的武器菜单调用) ---------- */
    const fire = weapon => {
      const s = pending;
      if (!s) return;
      pending = null;
      if (weapon === 'foil') fireFoil(s);
      else firePhotoid(s);
    };
    const cancelAim = () => {
      if (pending) {
        pending.targeted = false;
        pending = null;
      }
    };
    cbRef.current.onReady?.({ canvas, fire, cancelAim });

    /* ---------- 指针 ---------- */
    const onMove = e => {
      if (pending) return;                    // 瞄准菜单打开时冻结锁定
      const { x, y } = toLocal(e);
      const prev = hover;
      hover = findStar(x, y);
      canvas.style.cursor = hover ? 'crosshair' : 'default';
      if (hover !== prev) {
        if (hover) {
          const t = performance.now() / 1000;
          cbRef.current.onTarget?.({ intel: hover.intel, sx: starX(hover, t), sy: starY(hover, t) });
        } else {
          cbRef.current.onTarget?.(null);
        }
      }
    };
    const onClick = e => {
      const { x, y } = toLocal(e);
      if (pending) {                          // 点击空处=取消瞄准
        cancelAim();
        cbRef.current.onAim?.(null);
        return;
      }
      const s = findStar(x, y);
      if (!s) return;
      s.targeted = true;
      pending = s;
      hover = null;
      cbRef.current.onTarget?.(null);
      const t = performance.now() / 1000;
      cbRef.current.onAim?.({ intel: s.intel, sx: starX(s, t), sy: starY(s, t) });
    };
    const onLeave = () => {
      hover = null;
      cbRef.current.onTarget?.(null);
    };
    canvas.addEventListener('mousemove', onMove, { passive: true });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', onLeave, { passive: true });

    /* ---------- 绘制 ---------- */
    const drawCross = (x, y, alpha, d) => {
      ctx.strokeStyle = `rgba(255,162,106,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      const l = 5;
      const seg = (x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      seg(x - d, y - d + l, x - d, y - d); seg(x - d, y - d, x - d + l, y - d);
      seg(x + d - l, y - d, x + d, y - d); seg(x + d, y - d, x + d, y - d + l);
      seg(x + d, y + d - l, x + d, y + d); seg(x + d, y + d, x + d - l, y + d);
      seg(x - d + l, y + d, x - d, y + d); seg(x - d, y + d, x - d, y + d - l);
    };

    const draw = now => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;

      // 震屏
      ctx.save();
      if (shake) {
        const k = (now - shake.t0) / shake.dur;
        if (k >= 1) shake = null;
        else {
          const a = shake.amp * (1 - k);
          ctx.translate(rand(-1, 1) * a, rand(-1, 1) * a);
        }
      }

      // 星云雾团
      for (const wsp of wisps) {
        wsp.fx += Math.cos(wsp.ang) * wsp.sp / 60;
        wsp.fy += Math.sin(wsp.ang) * wsp.sp / 60;
        if (wsp.fx < -0.25) wsp.fx = 1.25;
        if (wsp.fx > 1.25) wsp.fx = -0.25;
        if (wsp.fy < -0.25) wsp.fy = 1.25;
        if (wsp.fy > 1.25) wsp.fy = -0.25;
        const x = wsp.fx * W;
        const y = wsp.fy * H;
        const r = wsp.rF * Math.min(W, H) * 1.6;
        const a = wsp.a * (0.8 + 0.2 * Math.sin(t * 0.13 + wsp.ang));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${wsp.rgb},${a.toFixed(3)})`);
        g.addColorStop(1, `rgba(${wsp.rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 7);
        ctx.fill();
      }

      // 文明星点
      for (const s of stars) {
        let alpha = s.a * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph));
        if (s.birth0) alpha *= Math.min((now - s.birth0) / 1500, 1);
        if (!s.alive) {
          const k = 1 - (now - s.death0) / 350;
          if (k <= 0) continue;
          alpha *= k;
        }
        const x = starX(s, t);
        const y = starY(s, t);
        const c = s.warm ? '255,190,150' : '190,215,255';
        const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 6);
        g.addColorStop(0, `rgba(${c},${(alpha * 0.5).toFixed(3)})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 6, 0, 7);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, 7);
        ctx.fill();
      }

      // 流星
      if (!meteor && now >= meteorNext) {
        const fromLeft = Math.random() < 0.5;
        meteor = {
          x0: fromLeft ? -60 : W * rand(0.3, 1),
          y0: fromLeft ? H * rand(0, 0.5) : -60,
          ang: fromLeft ? rand(0.15, 0.5) : rand(1.0, 1.6),
          sp: rand(700, 1100),
          t0: now,
          dur: rand(1100, 1700)
        };
      }
      if (meteor) {
        const k = (now - meteor.t0) / meteor.dur;
        if (k >= 1) {
          meteor = null;
          meteorNext = now + rand(9000, 22000);
        } else {
          const dist = meteor.sp * (now - meteor.t0) / 1000;
          const hx = meteor.x0 + Math.cos(meteor.ang) * dist;
          const hy = meteor.y0 + Math.sin(meteor.ang) * dist;
          const tx2 = hx - Math.cos(meteor.ang) * 90;
          const ty2 = hy - Math.sin(meteor.ang) * 90;
          const fade = Math.sin(Math.min(k * 2, 1) * Math.PI / 2) * (1 - k);
          const g = ctx.createLinearGradient(tx2, ty2, hx, hy);
          g.addColorStop(0, 'rgba(170,205,255,0)');
          g.addColorStop(1, `rgba(210,230,255,${(0.55 * fade).toFixed(3)})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx2, ty2);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
      }

      // 光粒(打击流,金色,带辉光)
      for (let i = streaks.length - 1; i >= 0; i--) {
        const st = streaks[i];
        const k = (now - st.t0) / st.dur;
        if (k >= 1) {
          streaks.splice(i, 1);
          continue;
        }
        const hx = st.x0 + (st.x1 - st.x0) * k;
        const hy = st.y0 + (st.y1 - st.y0) * k;
        const k2 = Math.max(k - 0.22, 0);
        const tx = st.x0 + (st.x1 - st.x0) * k2;
        const ty = st.y0 + (st.y1 - st.y0) * k2;
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(255,203,177,0)');
        g.addColorStop(1, 'rgba(255,220,190,0.95)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        // 弹头辉光
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10);
        hg.addColorStop(0, 'rgba(255,235,210,0.9)');
        hg.addColorStop(1, 'rgba(255,203,177,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, 7);
        ctx.fill();
      }

      // 爆炸序列帧(光粒命中,CC0 素材)
      for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i];
        const k = (now - ex.t0) / 1150;
        if (k >= 1 || !sprite.complete || !sprite.naturalWidth) {
          if (k >= 1) explosions.splice(i, 1);
          continue;
        }
        const f = Math.min(Math.floor(k * 32), 31);
        const sx = (f % 8) * 256;
        const sy = Math.floor(f / 8) * 256;
        ctx.save();
        ctx.translate(ex.x, ex.y);
        ctx.rotate(ex.rot);
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(sprite, sx, sy, 256, 256, -ex.size / 2, -ex.size / 2, ex.size, ex.size);
        ctx.restore();
      }

      // 冲击波环
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        const k = (now - sw.t0 - sw.d) / 800;
        if (k >= 1) {
          shockwaves.splice(i, 1);
          continue;
        }
        if (k < 0) continue;
        const alpha = (1 - k) * 0.55;
        ctx.strokeStyle = `rgba(255,203,177,${alpha.toFixed(3)})`;
        ctx.lineWidth = 2 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, 6 + k * 110, 0, 7);
        ctx.stroke();
      }

      // 粒子火花
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        const age = now - p.t0;
        const k = age / p.life;
        if (k >= 1) {
          sparks.splice(i, 1);
          continue;
        }
        const decel = 1 - 0.6 * k;
        const x = p.x + p.vx * (age / 1000) * decel;
        const y = p.y + p.vy * (age / 1000) * decel;
        const alpha = (1 - k) * 0.9;
        ctx.fillStyle = p.warm
          ? `rgba(255,190,130,${alpha.toFixed(3)})`
          : `rgba(230,240,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4 * (1 - k * 0.5), 0, 7);
        ctx.fill();
      }

      // 二向箔(投放→展开→二维化→涟漪消散,虹彩)
      for (let i = foils.length - 1; i >= 0; i--) {
        const fo = foils[i];
        const age = now - fo.t0;
        if (age >= 2400) {
          foils.splice(i, 1);
          continue;
        }
        // ①投放(0-500ms):虹彩菱片从上方降至目标
        if (age < 500) {
          const k = age / 500;
          const y = fo.y - 140 * (1 - k);
          const hue = (t * 160) % 360;
          ctx.save();
          ctx.translate(fo.x, y);
          ctx.rotate(t * 2.2);
          ctx.fillStyle = `hsla(${hue.toFixed(0)},85%,72%,0.9)`;
          ctx.beginPath();
          ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // ②展开(500-2100ms):扁平虹彩涟漪环扩散
          const k = Math.min((age - 500) / 1600, 1);
          const ease = 1 - Math.pow(1 - k, 3);
          const fadeOut = age > 1800 ? 1 - (age - 1800) / 600 : 1;
          for (let ring = 0; ring < 4; ring++) {
            const rk = Math.max(ease - ring * 0.12, 0);
            if (rk <= 0) continue;
            const rx = 14 + rk * 165;
            const ry = rx * 0.14;
            const hue = (t * 160 + ring * 70) % 360;
            ctx.strokeStyle = `hsla(${hue.toFixed(0)},85%,70%,${(0.5 * (1 - rk * 0.6) * fadeOut).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(fo.x, fo.y, rx, ry, 0, 0, 7);
            ctx.stroke();
          }
          // 薄膜内芯
          const rx0 = 14 + ease * 120;
          const film = ctx.createRadialGradient(fo.x, fo.y, 0, fo.x, fo.y, rx0);
          film.addColorStop(0, `rgba(210,225,255,${(0.14 * fadeOut).toFixed(3)})`);
          film.addColorStop(1, 'rgba(210,225,255,0)');
          ctx.save();
          ctx.translate(fo.x, fo.y);
          ctx.scale(1, 0.14);
          ctx.fillStyle = film;
          ctx.beginPath();
          ctx.arc(0, 0, rx0, 0, 7);
          ctx.fill();
          ctx.restore();
          // ③二维化(500-1100ms):目标被压扁成一道横线后消散
          if (age < 1100) {
            const sk = (age - 500) / 600;
            const rxs = fo.r * (1 + sk * 8);
            const rys = Math.max(fo.r * (1 - sk), 0.1);
            ctx.fillStyle = `rgba(255,255,255,${(0.9 * (1 - sk * 0.6)).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(fo.x, fo.y, rxs, rys, 0, 0, 7);
            ctx.fill();
          }
        }
      }

      // 命中闪光(光粒核心)
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const k = (now - f.t0) / 550;
        if (k >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const alpha = (1 - k) * 0.85;
        ctx.fillStyle = `rgba(255,235,220,${(alpha * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(3 * (1 - k), 0.1), 0, 7);
        ctx.fill();
      }

      // 悬停锁定框 / 瞄准中的脉冲锁定框
      if (hover && hover.alive && !hover.targeted) {
        drawCross(starX(hover, t), starY(hover, t), 0.9, 11);
      }
      if (pending) {
        const pulse = 11 + Math.sin(t * 6) * 2.5;
        drawCross(starX(pending, t), starY(pending, t), 0.75 + 0.25 * Math.sin(t * 6), pulse);
      }

      ctx.restore();   // 震屏 translate 复位

      // 全屏白闪(光粒命中,最顶层)
      if (whiteFlash) {
        const k = (now - whiteFlash.t0) / whiteFlash.dur;
        if (k >= 1) whiteFlash = null;
        else {
          ctx.fillStyle = `rgba(255,240,222,${(0.30 * (1 - k)).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      timers.forEach(clearTimeout);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mouseleave', onLeave);
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="黑暗森林星野:点击星点选择打击方式" />;
}
