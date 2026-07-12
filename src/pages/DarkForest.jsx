import { lazy, Suspense, useRef, useState } from 'react';
import DarkForestField from '../components/DarkForestField/DarkForestField';

// 侦察透镜(自写放大着色器)依赖 r3f,按需懒加载,不拖累其他页面
const DarkLens = lazy(() => import('../components/DarkLens/DarkLens'));

let uid = 0;

// 玻璃小面板(与全站玻璃语言一致)
const glassPanel =
  'rounded-xl border border-[#97C3FF]/15 bg-gradient-to-br from-[#97C3FF]/10 via-[#0a1428]/25 to-transparent px-4 py-3 shadow-[inset_0_1px_0_rgba(220,235,255,0.18)] backdrop-blur-md';

// 浮层定位:跟随目标星,右侧偏移并夹取在视口内
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
  const sectionRef = useRef(null);
  const apiRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ alive: 0, cleansed: 0 });
  const [fieldCanvas, setFieldCanvas] = useState(null);
  const [target, setTarget] = useState(null);   // 悬停情报
  const [aim, setAim] = useState(null);         // 瞄准中(武器菜单)

  const push = (text, type) =>
    setEntries(l => [{ id: (uid += 1), text, type }, ...l].slice(0, 6));

  const fire = weapon => {
    apiRef.current?.fire(weapon);
    setAim(null);
  };

  return (
    <section ref={sectionRef} className="relative h-dvh overflow-hidden">
      {/* 星野交互层 */}
      <div className="absolute inset-0">
        <DarkForestField
          onStrike={({ coordStr, n, weapon }) =>
            push(
              weapon === 'foil'
                ? `第 ${n} 次打击 · 二向箔降维 ${coordStr}`
                : `第 ${n} 次打击 · 光粒击毁 ${coordStr}`,
              'strike'
            )
          }
          onSpawn={({ coordStr }) => push(`新的文明在 ${coordStr} 诞生`, 'spawn')}
          onCensus={setStats}
          onTarget={setTarget}
          onAim={setAim}
          onReady={api => {
            apiRef.current = api;
            setFieldCanvas(api.canvas);
          }}
        />
      </div>

      {/* 侦察透镜:屏幕空间放大镜(点击穿透) */}
      {fieldCanvas && (
        <Suspense fallback={null}>
          <DarkLens sourceCanvas={fieldCanvas} eventSource={sectionRef} />
        </Suspense>
      )}

      {/* 顶部:标题+两公理+概念徽章+操作提示 */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DARK FOREST · 宇宙社会学
        </p>
        <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          黑暗森林
        </h1>
        <div className="mt-4 space-y-1.5 font-body text-xs text-[#8A93A8] md:text-sm">
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
        <p className="mt-5 font-tech text-xs tracking-[0.35em] text-[#FFA26A]/60">
          LOCK &amp; STRIKE · 点击星点,选择打击方式
        </p>
      </div>

      {/* 目标情报卡(悬停锁定时浮现) */}
      {target && !aim && (
        <div
          className={`pointer-events-none absolute z-20 w-[230px] select-none ${glassPanel}`}
          style={anchorStyle(target.sx, target.sy, 230, 190)}
        >
          <p className="mb-1.5 flex items-center gap-2 font-tech text-[10px] tracking-[0.3em] text-[#FFA26A]/80">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#FFA26A]" />
            TARGET LOCKED
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

      {/* 武器选择菜单(点击目标后浮现) */}
      {aim && (
        <div
          className={`absolute z-20 w-[240px] select-none ${glassPanel}`}
          style={anchorStyle(aim.sx, aim.sy, 240, 170)}
        >
          <p className="mb-2 flex items-center justify-between font-tech text-[10px] tracking-[0.25em] text-[#FFA26A]/80">
            <span>SELECT WEAPON</span>
            <span style={{ color: aim.intel.threat[1] }}>威胁·{aim.intel.threat[0]}</span>
          </p>
          <button
            type="button"
            onClick={() => fire('photoid')}
            className="mb-2 block w-full rounded-lg border border-[#FFA26A]/40 bg-[#FFA26A]/10 px-3 py-2 text-left transition-colors hover:border-[#FFA26A] hover:bg-[#FFA26A]/20"
          >
            <span className="block font-santi text-sm text-[#FFCBB1]">光粒 · PHOTOID</span>
            <span className="block font-body text-[10px] text-[#c8a488]">
              恒星级动能打击,即刻粉碎
            </span>
          </button>
          <button
            type="button"
            onClick={() => fire('foil')}
            className="block w-full rounded-lg border border-[#97C3FF]/40 bg-[#97C3FF]/10 px-3 py-2 text-left transition-colors hover:border-[#97C3FF] hover:bg-[#97C3FF]/20"
          >
            <span className="block font-santi text-sm text-[#c6d6ef]">二向箔 · 2D FOIL</span>
            <span className="block font-body text-[10px] text-[#8fa3c4]">
              降维打击,将目标压入二维
            </span>
          </button>
          <p className="mt-1.5 text-center font-tech text-[9px] tracking-[0.2em] text-white/25">
            点击空域取消
          </p>
        </div>
      )}

      {/* 左下:打击日志 */}
      {entries.length > 0 && (
        <div className={`pointer-events-none absolute bottom-6 left-5 z-10 select-none ${glassPanel}`}>
          <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">
            STRIKE LOG
          </p>
          <div className="space-y-1 font-santi text-xs md:text-sm">
            {entries.map((e, i) => (
              <p
                key={e.id}
                className={e.type === 'strike' ? 'text-[#FFA26A]' : 'text-[#97C3FF]'}
                style={{ opacity: Math.max(0.9 - i * 0.15, 0.12) }}
              >
                {e.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 右下:文明统计 */}
      <div
        className={`pointer-events-none absolute bottom-6 right-5 z-10 select-none text-right ${glassPanel}`}
      >
        <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">CENSUS</p>
        <div className="font-tech text-xs tracking-[0.2em] text-white/45">
          <p>
            SURVIVING · 现存文明 <span className="text-[#97C3FF]">{stats.alive}</span>
          </p>
          <p className="mt-1">
            CLEANSED · 已清理 <span className="text-[#FFA26A]">{stats.cleansed}</span>
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
