import { useState } from 'react';
import DarkForestField from '../components/DarkForestField/DarkForestField';

let uid = 0;

const BASE = import.meta.env.BASE_URL;

// 玻璃小面板(与全站玻璃语言一致)
const glassPanel =
  'rounded-xl border border-[#97C3FF]/15 bg-gradient-to-br from-[#97C3FF]/10 via-[#0a1428]/25 to-transparent px-4 py-3 shadow-[inset_0_1px_0_rgba(220,235,255,0.18)] backdrop-blur-md';

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

export default function DarkForest() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ alive: 0, observed: 0 });
  const [target, setTarget] = useState(null);   // 悬停情报

  const push = text => setEntries(l => [{ id: (uid += 1), text }, ...l].slice(0, 6));

  return (
    <section className="relative h-dvh overflow-hidden bg-black">
      {/* 8K 真实星空背景(照搬演算页 sky8k.webp) + 压暗/暗角,聚焦文明目标 */}
      <img
        src={`${BASE}assets/wp/sky8k.webp`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* 星野交互层(透明画布,只画文明星点) */}
      <div className="absolute inset-0">
        <DarkForestField
          onTarget={setTarget}
          onObserve={({ coordStr, intel, n }) =>
            push(`观测 No.${String(n).padStart(3, '0')} · ${coordStr} · ${intel.stage}`)
          }
          onCensus={setStats}
        />
      </div>

      {/* 顶部:标题+两公理+概念徽章+操作提示 */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DARK FOREST · 宇宙社会学
        </p>
        <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          黑暗森林
        </h1>
        <div className="mt-4 space-y-1.5 font-body text-xs text-[#c6cddb]/80 md:text-sm">
          <p>
            <span className="mr-2 font-tech tracking-[0.15em] text-[#97C3FF]">AXIOM·01</span>
            生存是文明的第一需要。
          </p>
          <p>
            <span className="mr-2 font-tech tracking-[0.15em] text-[#97C3FF]">AXIOM·02</span>
            文明不断增长和扩张,但宇宙中的物质总量保持不变。
          </p>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <span className="rounded-full border border-[#97C3FF]/25 bg-[#97C3FF]/5 px-4 py-1 font-santi text-xs tracking-[2px] text-[#97C3FF]/80 backdrop-blur-sm">
            猜疑链 · CHAIN OF SUSPICION
          </span>
          <span className="rounded-full border border-[#97C3FF]/25 bg-[#97C3FF]/5 px-4 py-1 font-santi text-xs tracking-[2px] text-[#97C3FF]/80 backdrop-blur-sm">
            技术爆炸 · TECH EXPLOSION
          </span>
        </div>
        <p className="mt-5 font-tech text-xs tracking-[0.35em] text-[#97C3FF]/55">
          HOVER TO OBSERVE · 悬停观测文明,点击记录坐标
        </p>
      </div>

      {/* 目标情报卡(悬停锁定时浮现) */}
      {target && (
        <div
          className={`pointer-events-none absolute z-20 w-[230px] select-none ${glassPanel}`}
          style={anchorStyle(target.sx, target.sy, 230, 190)}
        >
          <p className="mb-1.5 flex items-center gap-2 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/80">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#97C3FF]" />
            OBSERVING · 观测中
          </p>
          <div className="space-y-1 font-body text-xs">
            <IntelRow k="距离" v={target.intel.dist} />
            <IntelRow k="文明存活" v={target.intel.aliveT} />
            <IntelRow k="发展阶段" v={target.intel.stage} />
            <IntelRow k="科技水平" v={target.intel.tech} />
            <IntelRow k="威胁度" v={target.intel.threat[0]} color={target.intel.threat[1]} />
          </div>
          <p className="mt-1.5 font-tech text-[9px] tracking-[0.1em] text-[#5B86C9]">
            {target.intel.coordStr}
          </p>
        </div>
      )}

      {/* 左下:观测日志 */}
      {entries.length > 0 && (
        <div className={`pointer-events-none absolute bottom-6 left-5 z-10 select-none ${glassPanel}`}>
          <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">
            OBSERVATION LOG
          </p>
          <div className="space-y-1 font-santi text-xs md:text-sm">
            {entries.map((e, i) => (
              <p key={e.id} className="text-[#97C3FF]" style={{ opacity: Math.max(0.9 - i * 0.15, 0.12) }}>
                {e.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 右下:文明观测统计 */}
      <div
        className={`pointer-events-none absolute bottom-6 right-5 z-10 select-none text-right ${glassPanel}`}
      >
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

      {/* 底部居中引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        宇宙就是一座黑暗森林,每个文明都是带枪的猎人。
      </p>
    </section>
  );
}
