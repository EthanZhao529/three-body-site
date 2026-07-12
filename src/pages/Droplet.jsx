import { useRef } from 'react';

const BASE = import.meta.env.BASE_URL;

// 水滴:末日之战前夕——联合舰队列阵全景(舰队图 v2 实装),
// 画面光迹汇聚的亮点即正在接近的水滴;背景呼吸+鼠标视差,HUD 为 iOS 纯透明液玻
export default function Droplet() {
  const bgRef = useRef(null);
  const onMove = e => {
    const el = bgRef.current;
    if (!el) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    el.style.transform = `translate(${(-nx * 16).toFixed(1)}px, ${(-ny * 10).toFixed(1)}px)`;
  };

  return (
    <section className="relative h-dvh overflow-hidden bg-black" onMouseMove={onMove}>
      {/* 末日之战全景(呼吸推近+视差) */}
      <div ref={bgRef} className="absolute -inset-5 will-change-transform">
        <img
          src={`${BASE}assets/doomsday.webp`}
          alt=""
          aria-hidden="true"
          className="bg-breathe h-full w-full select-none object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/15" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }}
      />

      {/* 水滴接近标记(光迹汇聚点) */}
      <div className="pointer-events-none absolute right-[6%] top-[44%] z-10 select-none">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFCBB1] opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FFCBB1]/90" />
        </span>
        <p className="mt-2 -translate-x-1/3 whitespace-nowrap font-tech text-[10px] tracking-[0.3em] text-[#FFCBB1]/80">
          INBOUND · 水滴
        </p>
      </div>

      {/* 顶部标题 */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DROPLET · 强互作用力探测器
        </p>
        <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          水滴
        </h1>
        <p className="mt-3 font-body text-sm text-[#C6CDDB]/80 md:text-base">
          绝对光滑的全反射镜面 · 人类舰队的末日
        </p>
      </div>

      {/* 左下:末日之战叙事卡 */}
      <div className="liquid-glass pointer-events-none absolute bottom-8 left-5 z-10 max-w-[400px] select-none rounded-2xl px-5 py-4 md:bottom-10 md:left-8">
        <p className="font-tech text-[10px] tracking-[0.3em] text-[#FFA26A]/80">
          DOOMSDAY BATTLE · 末日之战
        </p>
        <p className="mt-2 font-body text-xs leading-relaxed text-[#c6d6ef] md:text-sm">
          联合舰队两千余艘战舰列阵以待,迎接一个来自三体世界的小小探测器。
          没有人想到,这场检阅将变成一场葬礼。
        </p>
      </div>

      {/* 右下:探测器读数卡 */}
      <div className="liquid-glass pointer-events-none absolute bottom-8 right-5 z-10 select-none rounded-2xl px-5 py-4 text-right md:bottom-10 md:right-8">
        <p className="font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/60">PROBE READOUT</p>
        <div className="mt-2 space-y-1 font-tech text-[11px] tracking-[0.15em] text-white/50">
          <p>
            PROBE · <span className="text-[#97C3FF]">强互作用力宇宙探测器</span>
          </p>
          <p>
            SURFACE · <span className="text-[#97C3FF]">绝对光滑 全反射镜面</span>
          </p>
          <p>
            威胁评估 · <span className="text-[#8fd9a8]">无害 —— 舰队联席会议判定</span>
          </p>
        </div>
      </div>
    </section>
  );
}
