import { useEffect, useRef, useState } from 'react';
import DarkForestField from '../components/DarkForestField/DarkForestField';

const BASE = import.meta.env.BASE_URL;

// 情报卡定位:跟随目标星,右侧偏移并夹取在视口内
const anchorStyle = (sx, sy, w, h) => ({
  left: Math.min(Math.max(sx + 22, 12), (typeof window !== 'undefined' ? window.innerWidth : 1280) - w - 12),
  top: Math.min(Math.max(sy - 30, 64), (typeof window !== 'undefined' ? window.innerHeight : 800) - h - 12)
});

function IntelRow({ k, v, color }) {
  return (
    <p className="flex justify-between gap-6">
      <span className="text-white/40">{k}</span>
      <span style={color ? { color } : undefined} className={color ? '' : 'text-[#c6d6ef]'}>
        {v}
      </span>
    </p>
  );
}

// 液态玻璃情报卡:出现/消失线性过渡(延迟卸载留出退场动画),位置切换随 left/top 过渡滑移
function IntelCard({ target }) {
  const [card, setCard] = useState(null);
  const [on, setOn] = useState(false);
  const tRef = useRef(null);

  useEffect(() => {
    if (target) {
      clearTimeout(tRef.current);
      setCard(target);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(id);
    }
    setOn(false);
    tRef.current = setTimeout(() => setCard(null), 320);
    return undefined;
  }, [target]);

  if (!card) return null;
  return (
    <div
      className={`liquid-glass pointer-events-none fixed z-20 w-[230px] select-none rounded-2xl px-4 py-3 transition-[opacity,transform,left,top] duration-300 ease-linear ${
        on ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-95 opacity-0'
      }`}
      style={anchorStyle(card.sx, card.sy, 230, 190)}
    >
      <p className="mb-1.5 flex items-center gap-2 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/80">
        <span className="h-1 w-1 animate-pulse rounded-full bg-[#97C3FF]" />
        OBSERVING · 观测中
      </p>
      <div className="space-y-1 font-body text-xs">
        <IntelRow k="距离" v={card.intel.dist} />
        <IntelRow k="文明存活" v={card.intel.aliveT} />
        <IntelRow k="发展阶段" v={card.intel.stage} />
        <IntelRow k="科技水平" v={card.intel.tech} />
        <IntelRow k="威胁度" v={card.intel.threat[0]} color={card.intel.threat[1]} />
      </div>
      <p className="mt-1.5 font-tech text-[9px] tracking-[0.1em] text-[#5B86C9]">
        {card.intel.coordStr}
      </p>
    </div>
  );
}

export default function DarkForest() {
  const bgRef = useRef(null);
  const [stats, setStats] = useState({ alive: 0, observed: 0 });
  const [target, setTarget] = useState(null);
  const [archive, setArchive] = useState([]);

  // 鼠标视差(仅背景层,叠加在 img 的呼吸缩放之外)
  const onMove = e => {
    const el = bgRef.current;
    if (!el) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    el.style.transform = `translate(${(-nx * 14).toFixed(1)}px, ${(-ny * 10).toFixed(1)}px)`;
  };

  return (
    <section className="relative h-dvh overflow-hidden bg-black" onMouseMove={onMove}>
      {/* 8K 星空背景(呼吸+视差) + 压暗暗角 */}
      <div ref={bgRef} className="absolute -inset-5 will-change-transform">
        <img
          src={`${BASE}assets/wp/sky8k.webp`}
          alt=""
          aria-hidden="true"
          className="bg-breathe h-full w-full select-none object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* 星野交互层 */}
      <div className="absolute inset-0">
        <DarkForestField
          onTarget={setTarget}
          onObserve={({ coordStr, intel, n }) =>
            setArchive(l => [{ id: n, coordStr, intel, n }, ...l])
          }
          onCensus={setStats}
        />
      </div>

      {/* 液态玻璃情报卡 */}
      <IntelCard target={target} />

      {/* 顶部:标题+操作提示 */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DARK FOREST · 宇宙社会学
        </p>
        <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          黑暗森林
        </h1>
        <p className="mt-5 font-tech text-xs tracking-[0.35em] text-[#97C3FF]/55">
          HOVER TO OBSERVE · 悬停观测文明,点击记录坐标
        </p>
      </div>

      {/* 左侧信息栏:统计+观测日志,竖直排列,无色纯透明 */}
      <div className="pointer-events-none absolute left-5 top-24 z-10 flex w-[300px] select-none flex-col gap-3">
        <div className="glass-clear rounded-2xl px-4 py-3">
          <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">CENSUS</p>
          <div className="font-tech text-xs tracking-[0.2em] text-white/45">
            <p>
              DETECTED · 探测到文明 <span className="text-[#97C3FF]">{stats.alive}</span>
            </p>
            <p className="mt-1">
              OBSERVED · 已观测 <span className="text-[#FFCBB1]">{stats.observed}</span>
            </p>
          </div>
        </div>
        {archive.length > 0 && (
          <div className="glass-clear rounded-2xl px-4 py-3">
            <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">
              OBSERVATION LOG
            </p>
            <div className="space-y-1 font-santi text-xs">
              {archive.slice(0, 6).map((e, i) => (
                <p key={e.id} className="text-[#97C3FF]" style={{ opacity: Math.max(0.9 - i * 0.15, 0.12) }}>
                  观测 No.{String(e.n).padStart(3, '0')} · {e.coordStr} · {e.intel.stage}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部居中引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        宇宙就是一座黑暗森林,每个文明都是带枪的猎人。
      </p>
    </section>
  );
}
