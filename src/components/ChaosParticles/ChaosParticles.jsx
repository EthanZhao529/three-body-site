import { useEffect, useRef } from 'react';

// 乱纪元氛围粒子:让静态状态图"活"起来
// fire(三日凌空)=飘升的橙红余烬火星;frost(三飞星)=飘落的冷白寒雪
// 随当前上层态切换,透明叠在图上(pointer-events:none,不挡 X-ray/点击)
export default function ChaosParticles({ mode }) {
  const hostRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 1, H = 1, raf = 0, last = performance.now();
    const rand = (a, b) => a + Math.random() * (b - a);

    const resize = () => {
      W = host.clientWidth || 1; H = host.clientHeight || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const N = Math.round(Math.min(Math.max((window.innerWidth * window.innerHeight) / 22000, 40), 90));
    const P = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      r: rand(0.6, 2.2), a: rand(0.3, 0.75),
      sp: rand(0.02, 0.06), sway: rand(0.2, 0.9), ph: rand(0, 6.28), tw: rand(0.6, 1.8)
    }));

    const draw = now => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;
      const fire = modeRef.current === 'fire';
      ctx.globalCompositeOperation = fire ? 'lighter' : 'source-over';

      for (const p of P) {
        // fire 上升(y 减),frost 下落(y 增);横向摇摆
        p.y += (fire ? -p.sp : p.sp) * dt;
        if (p.y < -0.03) { p.y = 1.03; p.x = Math.random(); }
        if (p.y > 1.03) { p.y = -0.03; p.x = Math.random(); }
        const x = (p.x + Math.sin(t * p.sway + p.ph) * 0.01) * W;
        const y = p.y * H;
        const flick = 0.6 + 0.4 * Math.sin(t * p.tw + p.ph);
        const alpha = (p.a * flick).toFixed(3);
        const c = fire
          ? `rgba(255,${(120 + p.r * 30) | 0},${(50 + p.r * 20) | 0},${alpha})`
          : `rgba(205,222,255,${alpha})`;
        // 柔光核
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 3);
        g.addColorStop(0, c);
        g.addColorStop(1, fire ? 'rgba(255,120,50,0)' : 'rgba(205,222,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, p.r * 3, 0, 7); ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
