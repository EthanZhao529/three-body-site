import { useEffect, useRef } from 'react';

// 黑暗森林星野(观测版):文明星点叠在 8K 真实星空背景之上;画布透明(clearRect)只画星点与交互
// 交互=纯观测(无毁灭):悬停→锁定情报卡;点击→记录观测(星点不消失,标记金环)
// 氛围=星点闪烁/摇曳 + 偶发流星;深空背景由页面的 8K 图提供
export default function DarkForestField({ onTarget, onObserve, onCensus }) {
  const hostRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onTarget, onObserve, onCensus };

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
    const pulses = [];        // 观测脉冲圈
    const observed = new Set();
    let hover = null;
    let raf = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    const STAGES = ['原始文明', '农耕文明', '工业文明', '原子文明', '信息文明', '星际文明'];
    const makeStar = () => {
      const fx = rand(0.03, 0.97);
      const fy = rand(0.12, 0.94);
      const coordStr = `[ ${((fx - 0.5) * 24).toFixed(2)}, ${((0.5 - fy) * 14).toFixed(2)}, ${rand(-8, 8).toFixed(2)} ]`;
      const si = Math.floor(rand(0, 6));
      return {
        fx, fy, coordStr,
        intel: {
          coordStr,
          dist: rand(4.2, 1200).toFixed(1) + ' 光年',
          aliveT: rand(0.3, 460).toFixed(1) + ' 万年',
          stage: STAGES[si],
          tech: 'K-' + (0.4 + si * 0.32 + rand(0, 0.28)).toFixed(2),
          threat: si <= 1 ? ['低', '#8fd9a8'] : si <= 3 ? ['中', '#e8c66a'] : si === 4 ? ['高', '#ffa26a'] : ['极高', '#ff5a3c']
        },
        r: rand(0.9, 2.4),
        a: rand(0.55, 0.95),
        tw: rand(0.4, 1.8),
        ph: rand(0, Math.PI * 2),
        ph2: rand(0, Math.PI * 2),
        warm: Math.random() < 0.18
      };
    };
    const starX = (s, t) => s.fx * W + Math.sin(t * 0.25 + s.ph2) * 3.5;
    const starY = (s, t) => s.fy * H + Math.cos(t * 0.21 + s.ph2) * 2.5;

    const census = () => cbRef.current.onCensus?.({ alive: stars.length, observed: observed.size });

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
      { length: Math.round(Math.min(Math.max((window.innerWidth * window.innerHeight) / 16000, 40), 96)) },
      () => makeStar()
    );
    census();

    // 流星(偶发划过)
    let meteor = null;
    let meteorNext = performance.now() + rand(6000, 14000);

    const toLocal = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const findStar = (x, y) => {
      const t = performance.now() / 1000;
      let best = null;
      let bd = 22;
      for (const s of stars) {
        const d = Math.hypot(starX(s, t) - x, starY(s, t) - y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };

    const onMove = e => {
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
      const s = findStar(x, y);
      if (!s) return;
      const t = performance.now() / 1000;
      pulses.push({ x: starX(s, t), y: starY(s, t), t0: performance.now() });
      if (!observed.has(s.coordStr)) {
        observed.add(s.coordStr);
        cbRef.current.onObserve?.({ intel: s.intel, coordStr: s.coordStr, n: observed.size });
        census();
      }
    };
    const onLeave = () => {
      hover = null;
      cbRef.current.onTarget?.(null);
    };
    canvas.addEventListener('mousemove', onMove, { passive: true });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', onLeave, { passive: true });

    const drawCross = (x, y, alpha, d) => {
      ctx.strokeStyle = `rgba(151,195,255,${alpha.toFixed(3)})`;
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
      ctx.clearRect(0, 0, W, H);           // 透明,露出下方 8K 星空背景
      const t = now / 1000;

      // 文明星点
      for (const s of stars) {
        const alpha = s.a * (0.72 + 0.28 * Math.sin(t * s.tw + s.ph));
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
        // 已观测标记:细金环
        if (observed.has(s.coordStr)) {
          ctx.strokeStyle = 'rgba(255,162,106,0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, s.r + 5, 0, 7);
          ctx.stroke();
        }
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

      // 观测脉冲圈(点击反馈)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const k = (now - p.t0) / 700;
        if (k >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(151,195,255,${((1 - k) * 0.7).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + k * 26, 0, 7);
        ctx.stroke();
      }

      // 悬停锁定框 + 坐标读数
      if (hover) {
        const x = starX(hover, t);
        const y = starY(hover, t);
        drawCross(x, y, 0.9, 11);
        ctx.font = '11px Rajdhani, Consolas, monospace';
        ctx.fillStyle = 'rgba(151,195,255,0.95)';
        const tx = Math.min(x + 19, W - 130);
        ctx.fillText(hover.coordStr, tx, y - 15 < 12 ? y + 26 : y - 15);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mouseleave', onLeave);
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="黑暗森林星野:悬停观测文明,点击记录坐标" />;
}
