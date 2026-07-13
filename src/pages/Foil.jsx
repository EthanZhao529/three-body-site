import { useEffect, useRef } from 'react';
import HilbertReduce from '../components/HilbertReduce/HilbertReduce';

// 二向箔页:全屏播放真实降维大片 + 左上信息框(介绍二向箔) + 右下演示框(希尔伯特曲线降维动画,自动循环)。
// ⚠️定位与玻璃分层:外层 div 负责 absolute 定位,内层才用 liquid-glass;
//   因为 .liquid-glass{position:relative} 会覆盖 Tailwind 的 absolute(index.css 在其后加载)。
const BASE = import.meta.env.BASE_URL;

export default function Foil() {
  const apiRef = useRef(null);

  // 右下演示:自动循环希尔伯特降维(3D体素 → 二维铺开 → 复原 → 再降维)
  useEffect(() => {
    let state = 'space';
    const t = setInterval(() => {
      const api = apiRef.current;
      if (!api) return;
      if (state === 'space') { api.collapse(); state = 'plane'; }
      else { api.restore(); state = 'space'; }
    }, 5500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative h-dvh select-none overflow-hidden bg-black">
      {/* 降维大片:全屏循环、静音自动播放 */}
      <video
        src={`${BASE}foil.mp4`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 顶部标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center px-6 text-center [transform:translateZ(0)]">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">DUAL VECTOR FOIL · 降维打击</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          二向箔
        </h1>
      </div>

      {/* 左上:二向箔信息框(外层定位 + 内层玻璃) */}
      <div className="absolute left-5 top-40 z-10 w-[min(340px,80vw)] md:left-8 md:top-44">
        <div
          className="liquid-glass rounded-2xl px-5 py-4"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px rgba(151,195,255,.2)' }}
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#97c3ff]" />
            <span className="font-tech text-[10px] tracking-[0.3em] text-[#97c3ff]">WEAPON · 降维武器</span>
          </div>
          <h2 className="mt-1.5 font-santi text-2xl text-white">二向箔</h2>
          <div className="mt-3 space-y-2 border-t border-white/10 pt-2.5 font-body text-xs leading-relaxed text-[#c6d6ef]">
            <p><span className="text-white/40">来源 </span>高等文明「歌者」随手投出的降维武器,形如一张不比信用卡大的白色薄膜。</p>
            <p><span className="text-white/40">原理 </span>展开后将周围三维空间以光速坍缩为二维,所过之处万物被拍平,无法逃脱——除非逃逸速度达到光速。</p>
            <p><span className="text-white/40">结局 </span>整个太阳系连同其中一切,被压成一幅悬在黑暗中、绚烂而永恒的二维画卷。</p>
          </div>
          <p className="mt-3 font-body text-xs italic text-[#9db0cc]">「毁灭你,与你何干。」</p>
        </div>
      </div>

      {/* 右下:降维原理演示(希尔伯特曲线降维,自动循环;外层定位 + 内层玻璃) */}
      <div className="absolute bottom-6 right-5 z-10 w-[min(340px,82vw)] md:right-8">
        <div
          className="liquid-glass overflow-hidden rounded-2xl"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px rgba(255,163,90,.18)' }}
        >
          <div className="flex items-center gap-2 px-4 pt-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFA26A]" />
            <span className="font-tech text-[10px] tracking-[0.3em] text-[#FFCBB1]">PRINCIPLE · 降维原理演示</span>
          </div>
          <div className="relative mt-2 h-[190px] w-full">
            <HilbertReduce onReady={api => { apiRef.current = api; }} />
          </div>
          <p className="px-4 pb-3 pt-1 font-body text-[11px] leading-snug text-[#c6d6ef]/80">
            三维物体沿希尔伯特曲线被逐块抽出,在二维平面按同一曲线重新铺开——降维后信息不丢,只是失去了一个维度。
          </p>
        </div>
      </div>
    </section>
  );
}
