import { useRef, useState } from 'react';
import ChaosParticles from '../components/ChaosParticles/ChaosParticles';

const BASE = import.meta.env.BASE_URL;

// 乱纪元双态:三日凌空(炙烤) / 三飞星(严寒)。
// 上层=当前状态"文明覆灭后"的废墟;X光透视洞里露出下层=同一个地方"文明覆灭前"繁荣的样子。
// 鼠标=时空透视(照见覆灭前),点击=切换乱纪元状态(sunfire↔starflight,废墟+繁荣整对切换)。
// ruin/alive 两图必须同视角同构图同地标(alive 由 ruin 编辑而来)。
const STATES = {
  sunfire: {
    id: 'sunfire',
    ruin: 'sunfire.webp',         // 覆灭后:三日炙烤焦土 + 熔岩
    alive: 'sunfire-alive.webp',  // 覆灭前:同一地方的恒纪元沃土城郭
    era: '三日凌空',
    en: 'TRI-SOLAR ZENITH',
    accent: '#ff7a3c',
    sun: '三颗恒星同时悬于天顶',
    surf: '行星表面 +1200°C · 岩浆横流,大气蒸腾',
    alive_head: '恒纪元 · 覆灭前',
    alive_desc: '温暖的一日当空 · 沃野连绵,城郭鼎盛',
    quote: '把能带走的都带走,剩下的,烧掉。'
  },
  starflight: {
    id: 'starflight',
    ruin: 'starflight.webp',
    alive: 'starflight-alive.webp',
    era: '三飞星',
    en: 'TRI-STELLAR FLIGHT',
    accent: '#7db8ff',
    sun: '三颗恒星尽数远去,化作飞星',
    surf: '行星表面 −190°C · 大气冻结,坠入永夜',
    alive_head: '恒纪元 · 覆灭前',
    alive_desc: '明亮的白昼 · 塔楼耸立,街衢灯火',
    quote: '脱水!把自己叠成一张薄薄的干皮,等待下一次日出。'
  }
};

// 上层 X-ray 遮罩:鼠标处挖大圆洞(透明)露下层。洞半径 340px(在放大一倍的基础上按用户要求缩小 15%)。
const XRAY_MASK =
  'radial-gradient(circle at var(--mx) var(--my), transparent 0px, transparent 340px, rgba(0,0,0,0.35) 510px, black 680px)';

export default function Chaos() {
  const layerRef = useRef(null);
  const [topId, setTopId] = useState('sunfire'); // 当前乱纪元状态
  const st = STATES[topId];

  const onMove = e => {
    const el = layerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const toggle = () => setTopId(id => (id === 'sunfire' ? 'starflight' : 'sunfire'));

  return (
    <section
      className="relative h-dvh cursor-crosshair select-none overflow-hidden bg-black"
      onMouseMove={onMove}
      onClick={toggle}
    >
      {/* 下层:文明覆灭前(繁荣) —— 透视洞里显现 */}
      <img
        src={`${BASE}assets/chaos/${st.alive}`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 上层:文明覆灭后(废墟) + X-ray 遮罩(鼠标洞露出覆灭前) */}
      <div
        ref={layerRef}
        className="absolute inset-0"
        style={{ '--mx': '-999px', '--my': '-999px' }}
      >
        <img
          src={`${BASE}assets/chaos/${st.ruin}`}
          alt=""
          aria-hidden="true"
          className="chaos-pulse absolute inset-0 h-full w-full object-cover"
          style={{ maskImage: XRAY_MASK, WebkitMaskImage: XRAY_MASK }}
        />
      </div>

      {/* 氛围粒子:三日凌空飘升余烬 / 三飞星飘落寒雪(随状态切换) */}
      <div className="pointer-events-none absolute inset-0 z-[6]">
        <ChaosParticles mode={topId === 'sunfire' ? 'fire' : 'frost'} />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/15" aria-hidden="true" />

      {/* 顶部标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center px-6 text-center [transform:translateZ(0)]">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">CHAOTIC ERA · 乱纪元</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          乱纪元
        </h1>
        <p className="mt-3 font-tech text-xs tracking-[0.35em]" style={{ color: `${st.accent}bb` }}>
          时空透视 · 鼠标照见文明覆灭前 · 点击切换乱纪元
        </p>
      </div>

      {/* 左上:当前状态 · 覆灭后读数 + 覆灭前对照 */}
      <div
        key={topId}
        className="route-elastic-up liquid-glass pointer-events-none absolute left-5 top-40 z-10 w-[min(340px,82vw)] rounded-2xl px-5 py-4 md:left-8 md:top-44"
        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px ${st.accent}33` }}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: st.accent }} />
          <span className="font-tech text-[10px] tracking-[0.3em]" style={{ color: st.accent }}>
            {st.en}
          </span>
        </div>
        <h2 className="mt-1.5 font-santi text-2xl text-white md:text-3xl">{st.era}</h2>
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 font-body text-xs">
          <p>
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">恒星状态</span>
            <br />
            <span className="text-[#c6d6ef]">{st.sun}</span>
          </p>
          <p>
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">行星状态</span>
            <br />
            <span style={{ color: st.accent }}>{st.surf}</span>
          </p>
        </div>
        {/* 覆灭前对照(透视洞看到的) */}
        <div className="mt-2.5 border-t border-white/10 pt-2.5">
          <p className="font-tech text-[10px] tracking-[0.2em] text-white/35">{st.alive_head}</p>
          <p className="mt-0.5 font-body text-xs text-[#9fb2cf]">{st.alive_desc}</p>
        </div>
        <p className="mt-3 font-body text-xs italic leading-relaxed text-[#9db0cc]">「{st.quote}」</p>
      </div>

      {/* 右下:透视提示 */}
      <div className="pointer-events-none absolute bottom-8 right-5 z-10 text-right font-tech text-[11px] tracking-[0.2em] text-white/45 md:right-8">
        <p>
          透视洞内 · <span className="text-[#9fb2cf]">文明覆灭前</span>
        </p>
        <p className="mt-1 text-white/30">CLICK · 切换乱纪元状态</p>
      </div>

      {/* 底部引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        乱纪元与恒纪元交替无常 —— 眼前的废墟之下,曾是文明鼎盛的家园。
      </p>
    </section>
  );
}
