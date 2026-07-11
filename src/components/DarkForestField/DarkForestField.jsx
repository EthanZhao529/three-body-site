import { useEffect, useRef } from 'react';

// 黑暗森林星野:每个亮点都是一个文明
// 交互=悬停锁定(金色瞄准框+坐标)→点击发射光粒→命中熄灭;若干秒后新文明诞生
// 命中/重生判定走 setTimeout(不依赖 rAF,后台标签页也能完成),绘制走 rAF
export default function DarkForestField({ onStrike, onSpawn, onCensus }) {
  const hostRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onStrike, onSpawn, onCensus };

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
    let hover = null;
    let cleansed = 0;
    let raf = 0;
    const timers = new Set();
    const rand = (a, b) => a + Math.random() * (b - a);

    const makeStar = born => {
      const fx = rand(0.02, 0.98);
      const fy = rand(0.1, 0.96);
      // 坐标体例与演算页 OL 标注一致:[x, y, z]
      const coordStr = `[ ${((fx - 0.5) * 24).toFixed(2)}, ${((0.5 - fy) * 14).toFixed(2)}, ${rand(-8, 8).toFixed(2)} ]`;
      return {
        fx,
        fy,
        coordStr,
        r: rand(0.8, 2.3),
        a: rand(0.5, 0.95),
        tw: rand(0.4, 1.8),
        ph: rand(0, Math.PI * 2),
        warm: Math.random() < 0.18,
        alive: true,
        targeted: false,
        death0: 0,
        birth0: born ? performance.now() : 0
      };
    };

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

    // 星数按视口面积取 45~110
    stars = Array.from(
      { length: Math.round(Math.min(Math.max((window.innerWidth * window.innerHeight) / 14000, 45), 110)) },
      () => makeStar(false)
    );
    census();

    const toLocal = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const findStar = (x, y) => {
      let best = null;
      let bd = 20; // 命中半径 20px
      for (const s of stars) {
        if (!s.alive || s.targeted) continue;
        const d = Math.hypot(s.fx * W - x, s.fy * H - y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };

    const impact = s => {
      if (!s.alive) return;
      s.alive = false;
      s.death0 = performance.now();
      flashes.push({ x: s.fx * W, y: s.fy * H, t0: performance.now() });
      cleansed += 1;
      cbRef.current.onStrike?.({ coordStr: s.coordStr, n: cleansed });
      census();
      // 12~26 秒后,新的文明在别处诞生
      const tid = setTimeout(() => {
        timers.delete(tid);
        const ns = makeStar(true);
        stars.push(ns);
        cbRef.current.onSpawn?.({ coordStr: ns.coordStr });
        census();
      }, rand(12000, 26000));
      timers.add(tid);
    };

    const strike = s => {
      if (s.targeted) return;
      s.targeted = true;
      if (hover === s) hover = null;
      // 光粒从上/左/右随机边缘射向目标
      const side = Math.floor(rand(0, 3));
      let x0;
      let y0;
      if (side === 0) {
        x0 = rand(0, W);
        y0 = -40;
      } else if (side === 1) {
        x0 = -40;
        y0 = rand(0, H * 0.6);
      } else {
        x0 = W + 40;
        y0 = rand(0, H * 0.6);
      }
      const dur = 260;
      streaks.push({ x0, y0, x1: s.fx * W, y1: s.fy * H, t0: performance.now(), dur });
      const tid = setTimeout(() => {
        timers.delete(tid);
        impact(s);
      }, dur);
      timers.add(tid);
    };

    const onMove = e => {
      const { x, y } = toLocal(e);
      hover = findStar(x, y);
      canvas.style.cursor = hover ? 'crosshair' : 'default';
    };
    const onClick = e => {
      const { x, y } = toLocal(e);
      const s = findStar(x, y);
      if (s) strike(s);
    };
    const onLeave = () => {
      hover = null;
    };
    canvas.addEventListener('mousemove', onMove, { passive: true });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', onLeave, { passive: true });

    const draw = now => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;

      // 文明星点(闪烁+出生淡入+熄灭淡出)
      for (const s of stars) {
        let alpha = s.a * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph));
        if (s.birth0) alpha *= Math.min((now - s.birth0) / 1500, 1);
        if (!s.alive) {
          const k = 1 - (now - s.death0) / 350;
          if (k <= 0) continue;
          alpha *= k;
        }
        const x = s.fx * W;
        const y = s.fy * H;
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

      // 光粒(打击流,金色)
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
        g.addColorStop(1, 'rgba(255,203,177,0.95)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }

      // 命中闪光(核心闪+扩散环)
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const k = (now - f.t0) / 550;
        if (k >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const alpha = (1 - k) * 0.85;
        ctx.strokeStyle = `rgba(255,203,177,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4 + k * 30, 0, 7);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,235,220,${(alpha * 0.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2.5 * (1 - k), 0.1), 0, 7);
        ctx.fill();
      }

      // 悬停锁定:金色瞄准框+坐标读数
      if (hover && hover.alive && !hover.targeted) {
        const x = hover.fx * W;
        const y = hover.fy * H;
        const d = 11;
        const l = 5;
        ctx.strokeStyle = 'rgba(255,162,106,0.9)';
        ctx.lineWidth = 1.2;
        const seg = (x1, y1, x2, y2) => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        };
        seg(x - d, y - d + l, x - d, y - d);
        seg(x - d, y - d, x - d + l, y - d);
        seg(x + d - l, y - d, x + d, y - d);
        seg(x + d, y - d, x + d, y - d + l);
        seg(x + d, y + d - l, x + d, y + d);
        seg(x + d, y + d, x + d - l, y + d);
        seg(x - d + l, y + d, x - d, y + d);
        seg(x - d, y + d, x - d, y + d - l);
        ctx.font = '11px Rajdhani, Consolas, monospace';
        ctx.fillStyle = 'rgba(255,162,106,0.95)';
        const tx = Math.min(x + d + 8, W - 130);
        ctx.fillText(hover.coordStr, tx, y - d - 4 < 12 ? y + d + 14 : y - d - 4);
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

  return <div ref={hostRef} className="h-full w-full" aria-label="黑暗森林星野:点击星点执行清理" />;
}
