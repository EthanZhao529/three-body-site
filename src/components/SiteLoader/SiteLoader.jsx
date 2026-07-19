import { useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

// 首屏加载遮罩:预载各模块关键资源(约6MB),保证翻页浏览流畅。
// 大文件(水滴 sd.bin 8.9MB / 二向箔视频等)不阻塞进度条,遮罩结束后在后台静默预取。
const CORE_ASSETS = [
  'assets/title.webp',
  'fleet-bg.html',
  'assets/captains/zhangbeihai.webp',
  'assets/captains/dongfangyanxu.webp',
  'assets/captains/chuyan.webp',
  'assets/chaos/sunfire.webp',
  'assets/chaos/starflight.webp',
  'assets/chaos/sunfire-alive.webp',
  'assets/chaos/starflight-alive.webp',
  'assets/wp/sky8k.webp',
  ...['terra', 'trisolaris', 'singer', 'returners', 'ring', 'silicon',
    'dyson', 'blackdomain', 'gasgiant', 'mirror', 'sowers', 'watcher']
    .map(id => `assets/civs/${id}.webp`),
];

// 遮罩结束后后台预取(顺序拉,不与用户当前浏览抢带宽)
const LAZY_ASSETS = [
  'droplet.html?v=8',
  'css/droplet.css?v=8',
  'js/droplet.js?v=8',
  'js/vendor/three.module.js',
  'assets/droplet/star.webp',
  'assets/droplet/uc.bin',
  'assets/droplet/sd.bin',
  'foil.mp4?v=2',
];

const MIN_SHOW = 900;    // 最短展示时长(ms),避免秒闪
const HARD_CAP = 15000;  // 兜底:网络极差时最多等15s,直接放行

async function prefetchLazy() {
  for (const u of LAZY_ASSETS) {
    try {
      await fetch(BASE + u, { cache: 'default' });
    } catch { /* 静默失败,进页时再正常加载 */ }
  }
}

export default function SiteLoader() {
  const [done, setDone] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    let finished = false;

    const finish = () => {
      if (!alive || finished) return;
      finished = true;
      const wait = Math.max(0, MIN_SHOW - (Date.now() - startRef.current));
      setTimeout(() => {
        if (!alive) return;
        setLeaving(true);                    // 淡出
        setTimeout(() => { if (alive) setGone(true); }, 750);
        prefetchLazy();                      // 大文件转入后台
      }, wait);
    };

    let n = 0;
    CORE_ASSETS.forEach(u => {
      fetch(BASE + u, { cache: 'default' })
        .catch(() => {})
        .finally(() => {
          if (!alive) return;
          n += 1;
          setDone(n);
          if (n >= CORE_ASSETS.length) finish();
        });
    });
    const cap = setTimeout(finish, HARD_CAP);
    return () => { alive = false; clearTimeout(cap); };
  }, []);

  if (gone) return null;
  const pct = Math.round((done / CORE_ASSETS.length) * 100);

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <p className="font-tech text-[11px] tracking-[0.6em] text-[#97c3ff]/60">TRISOLARIS · UNIVERSE</p>
      <h1 className="mt-3 select-none font-santi text-4xl text-white [text-shadow:0_0_28px_rgba(151,195,255,0.4)]">
        三体宇宙
      </h1>

      {/* 进度条 */}
      <div className="mt-10 h-[2px] w-[min(320px,70vw)] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg,#97C3FF,#FFCBB1)',
            boxShadow: '0 0 12px rgba(151,195,255,0.8)',
          }}
        />
      </div>

      <div className="mt-4 flex w-[min(320px,70vw)] items-baseline justify-between font-tech text-[11px] tracking-[0.25em]">
        <span className="text-white/35">正在构建宇宙 · INITIALIZING</span>
        <span className="text-[#97C3FF]">{pct}%</span>
      </div>
    </div>
  );
}
