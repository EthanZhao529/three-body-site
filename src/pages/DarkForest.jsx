import { useEffect, useRef, useState } from 'react';
import DarkForestField from '../components/DarkForestField/DarkForestField';

const BASE = import.meta.env.BASE_URL;

// 玻璃小面板(iOS 纯透明液玻,无边框)
const glassPanel = 'liquid-glass rounded-2xl px-4 py-3';

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

// 宇宙社会学法则(第二屏内容)
const LAWS = [
  {
    code: 'AXIOM·01',
    title: '生存是文明的第一需要',
    body: '任何文明的一切行为,最终都服务于同一个目的——活下去。'
  },
  {
    code: 'AXIOM·02',
    title: '文明不断增长和扩张,但宇宙中的物质总量保持不变',
    body: '资源有限而扩张无限,文明之间的竞争因此不可避免。'
  },
  {
    code: 'CONCEPT·A',
    title: '猜疑链',
    body: '两个文明相隔光年,无法判断对方善意与否;沟通无法消除猜疑,而猜疑没有尽头。'
  },
  {
    code: 'CONCEPT·B',
    title: '技术爆炸',
    body: '文明的技术可能在极短时间内爆发式跃迁——今天的弱者,可能就是明天的毁灭者。'
  }
];

const PAGES = ['观测', '法则', '档案'];

export default function DarkForest() {
  const scrollRef = useRef(null);
  const bgRef = useRef(null);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState({ alive: 0, observed: 0 });
  const [target, setTarget] = useState(null);
  const [archive, setArchive] = useState([]);   // 全部观测记录(第三屏档案)

  const onScroll = e => {
    const el = e.currentTarget;
    setPage(Math.min(Math.round(el.scrollTop / el.clientHeight), PAGES.length - 1));
  };
  const goto = i => {
    const el = scrollRef.current;
    el?.scrollTo({ top: i * el.clientHeight, behavior: 'smooth' });
  };
  // 鼠标滚轮翻页:一次滚轮=翻一整页,翻页动画期间锁定;边界放行原生滚动(页脚可达)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let lock = false;
    const onWheel = e => {
      const cur = Math.round(el.scrollTop / el.clientHeight);
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.min(Math.max(cur + dir, 0), PAGES.length - 1);
      if (next === cur) return;
      e.preventDefault();
      if (lock || Math.abs(e.deltaY) < 10) return;
      lock = true;
      el.scrollTo({ top: next * el.clientHeight, behavior: 'smooth' });
      setTimeout(() => {
        lock = false;
      }, 800);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  // 鼠标视差(仅背景层,叠加在 img 的呼吸缩放之外)
  const onMove = e => {
    const el = bgRef.current;
    if (!el) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    el.style.transform = `translate(${(-nx * 14).toFixed(1)}px, ${(-ny * 10).toFixed(1)}px)`;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      onMouseMove={onMove}
      className="relative h-dvh snap-y snap-mandatory overflow-y-auto scroll-smooth bg-black"
    >
      {/* ===== 固定星空层(不随滚动):8K 背景呼吸+视差 / 压暗暗角 / 交互星野 ===== */}
      <div className="fixed inset-0 z-0">
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
        <div className="absolute inset-0">
          <DarkForestField
            onTarget={setTarget}
            onObserve={({ coordStr, intel, n }) =>
              setArchive(l => [{ id: n, coordStr, intel, n }, ...l])
            }
            onCensus={setStats}
          />
        </div>
      </div>

      {/* 液态玻璃情报卡(视口定位,跟随目标星滑移) */}
      <IntelCard target={target} />

      {/* 右侧页点导航 */}
      <div className="fixed right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-4">
        {PAGES.map((label, i) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => goto(i)}
            className="group flex items-center gap-2 p-1"
          >
            <span
              className={`block h-2 w-2 rounded-full border transition-all duration-300 ${
                page === i
                  ? 'scale-125 border-[#97C3FF] bg-[#97C3FF] shadow-[0_0_8px_rgba(151,195,255,0.8)]'
                  : 'border-white/40 bg-transparent group-hover:border-white'
              }`}
            />
          </button>
        ))}
      </div>

      {/* ===== 第一屏:观测(覆盖层全部 pointer-events-none,星野可交互) ===== */}
      <section className="pointer-events-none relative z-10 h-dvh snap-start">
        <div className="flex select-none flex-col items-center px-6 pt-24 text-center">
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

        {/* 左下:观测日志(近6条) */}
        {archive.length > 0 && (
          <div className={`absolute bottom-14 left-5 select-none ${glassPanel}`}>
            <p className="mb-1.5 font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/50">
              OBSERVATION LOG
            </p>
            <div className="space-y-1 font-santi text-xs md:text-sm">
              {archive.slice(0, 6).map((e, i) => (
                <p key={e.id} className="text-[#97C3FF]" style={{ opacity: Math.max(0.9 - i * 0.15, 0.12) }}>
                  观测 No.{String(e.n).padStart(3, '0')} · {e.coordStr} · {e.intel.stage}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 右下:观测统计 */}
        <div className={`absolute bottom-14 right-5 select-none text-right ${glassPanel}`}>
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

        {/* 底部:翻页提示 */}
        <div className="absolute inset-x-0 bottom-4 select-none text-center">
          <p className="animate-bounce font-tech text-xs tracking-[0.4em] text-white/35">
            ↓ 黑暗森林法则
          </p>
        </div>
      </section>

      {/* ===== 第二屏:宇宙社会学法则 ===== */}
      <section className="relative z-10 flex h-dvh snap-start flex-col items-center justify-center bg-[#010208]/85 px-6">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">COSMIC SOCIOLOGY</p>
        <h2 className="mt-3 font-santi text-3xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.3)]">
          宇宙社会学
        </h2>
        <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          {LAWS.map(law => (
            <div key={law.code} className="liquid-glass rounded-2xl px-6 py-5">
              <p className="font-tech text-[10px] tracking-[0.3em] text-[#FFA26A]/80">{law.code}</p>
              <p className="mt-2 font-santi text-base text-white md:text-lg">{law.title}</p>
              <p className="mt-2 font-body text-xs leading-relaxed text-[#9db0cc] md:text-sm">
                {law.body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-center font-santi text-base leading-relaxed text-[#FFCBB1] md:text-lg [text-shadow:0_0_16px_rgba(255,162,106,0.3)]">
          宇宙就是一座黑暗森林,每个文明都是带枪的猎人。
        </p>
        <p className="mt-2 font-tech text-[10px] tracking-[0.3em] text-white/30">
          刘慈欣 ·《三体 Ⅱ · 黑暗森林》
        </p>
      </section>

      {/* ===== 第三屏:观测档案 ===== */}
      <section className="relative z-10 flex h-dvh snap-start flex-col items-center bg-[#010208]/85 px-6 pt-24">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">OBSERVATION ARCHIVE</p>
        <h2 className="mt-3 font-santi text-3xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.3)]">
          观测档案
        </h2>
        <p className="mt-3 font-tech text-xs tracking-[0.2em] text-white/40">
          DETECTED {stats.alive} · OBSERVED {stats.observed}
        </p>
        {archive.length === 0 ? (
          <p className="mt-16 font-body text-sm text-[#8A93A8]">
            尚无观测记录 —— 回到观测屏,悬停并点击星点开始记录。
          </p>
        ) : (
          <div className="mt-8 grid w-full max-w-5xl flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-16 sm:grid-cols-2 lg:grid-cols-3">
            {archive.map(e => (
              <div key={e.id} className="liquid-glass rounded-xl px-4 py-3">
                <p className="flex items-baseline justify-between font-tech text-[10px] tracking-[0.2em]">
                  <span className="text-[#97C3FF]/70">No.{String(e.n).padStart(3, '0')}</span>
                  <span style={{ color: e.intel.threat[1] }}>威胁·{e.intel.threat[0]}</span>
                </p>
                <p className="mt-1.5 font-santi text-sm text-white">{e.intel.stage}</p>
                <p className="mt-1 font-body text-[11px] text-[#9db0cc]">
                  {e.intel.dist} · 存活 {e.intel.aliveT} · {e.intel.tech}
                </p>
                <p className="mt-1 font-tech text-[9px] tracking-[0.1em] text-[#5B86C9]">{e.coordStr}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
