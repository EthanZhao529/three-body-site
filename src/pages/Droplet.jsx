import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL;
const LIGHT = 299792.458; // km/s

// 水滴:壁纸复刻页实装(droplet.html)。iframe 保留指针交互(光标旋转/BGM/滚轮翻页);
// 覆盖层:左上介绍框 + 实时遥测(速度/坐标,模拟水滴向舰队逼近)
// ?v=8:iframe 子资源缓存击穿(旧版 js 带时钟/公式/godrays 方块光效,普通强刷刷不掉)
export default function Droplet() {
  const [tele, setTele] = useState({ kms: 4530, c: 0.0151, x: 0.31, y: -0.12, z: 61.4 });

  useEffect(() => {
    const id = setInterval(() => {
      setTele(() => {
        const now = Date.now();
        const c = 0.0151 + (Math.random() - 0.5) * 0.0005; // 近光速微抖
        // 逼近:z 缓慢递减,到近距回绕重来(叙事:一次次接近舰队)
        const z = 61.4 - ((now / 1000) % 190) * 0.3;
        return {
          kms: Math.round(LIGHT * c),
          c: +c.toFixed(4),
          x: +(0.31 + Math.sin(now / 3000) * 0.5).toFixed(2),
          y: +(-0.12 + Math.cos(now / 3700) * 0.35).toFixed(2),
          z: +z.toFixed(2)
        };
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative h-dvh overflow-hidden bg-black">
      <iframe
        src={`${BASE}droplet.html?v=8`}
        title="水滴 · Droplet"
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* 左上:标题 + 介绍框 + 实时遥测 */}
      <div className="pointer-events-none absolute left-5 top-24 z-10 w-[min(380px,80vw)] select-none md:left-8">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DROPLET · 强互作用力探测器
        </p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          水滴
        </h1>

        {/* 介绍框(纯透明液玻) */}
        <div className="liquid-glass mt-4 rounded-2xl px-5 py-4">
          <p className="font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/60">PROFILE · 探测器档案</p>
          <p className="mt-2 font-body text-xs leading-relaxed text-[#c6d6ef] md:text-sm">
            三体世界派往太阳系的先遣探测器。通体由强相互作用力材料构成,表面绝对光滑、
            可反射一切,能承受任何冲击而毫发无损。以近光速航行,是人类联合舰队的终结者。
          </p>

          {/* 实时遥测:速度 + 坐标 */}
          <div className="mt-3 border-t border-white/10 pt-2.5 font-tech text-[11px] tracking-[0.15em]">
            <p className="flex items-baseline justify-between gap-4">
              <span className="text-white/40">航速 · VELOCITY</span>
              <span className="text-[#FFCBB1]">
                {tele.kms.toLocaleString()} km/s
                <span className="ml-1.5 text-[#97C3FF]">{tele.c} c</span>
              </span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-4">
              <span className="text-white/40">坐标 · POSITION</span>
              <span className="text-[#97C3FF]">
                [ {tele.x.toFixed(2)}, {tele.y.toFixed(2)}, {tele.z.toFixed(2)} ]
              </span>
            </p>
            <p className="mt-1 flex items-baseline justify-between gap-4">
              <span className="text-white/40">威胁评估</span>
              <span className="text-[#8fd9a8]">无害 —— 舰队联席会议判定</span>
            </p>
          </div>
        </div>
      </div>

      {/* 右下:壁纸原作署名 */}
      <p className="pointer-events-none absolute bottom-3 right-4 z-10 select-none font-tech text-[9px] tracking-[0.25em] text-white/25">
        WALLPAPER ORIGINAL · SYKM
      </p>
    </section>
  );
}
