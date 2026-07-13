import { useRef, useState } from 'react';
import ChaosParticles from '../components/ChaosParticles/ChaosParticles';

const BASE = import.meta.env.BASE_URL;

// 乱纪元双态:三日凌空(炙烤) / 三飞星(严寒)。两张远景图叠加,
// 鼠标处 X-ray 透视洞露出下层,点击切换上下层。图=用户 GPT 生成后替换占位。
const STATES = {
  sunfire: {
    id: 'sunfire',
    img: 'sunfire.webp',
    era: '三日凌空',
    en: 'TRI-SOLAR ZENITH',
    accent: '#ff7a3c',
    sun: '三颗恒星同时悬于天顶',
    surf: '行星表面 +1200°C · 岩浆横流,大气蒸腾',
    quote: '把能带走的都带走,剩下的,烧掉。'
  },
  starflight: {
    id: 'starflight',
    img: 'starflight.webp',
    era: '三飞星',
    en: 'TRI-STELLAR FLIGHT',
    accent: '#7db8ff',
    sun: '三颗恒星尽数远去,化作飞星',
    surf: '行星表面 −190°C · 大气冻结,坠入永夜',
    quote: '脱水!把自己叠成一张薄薄的干皮,等待下一次日出。'
  }
};

// 上层 X-ray 遮罩:鼠标处挖圆洞(透明)露下层,外围不透明显示上层
const XRAY_MASK =
  'radial-gradient(circle at var(--mx) var(--my), transparent 0px, transparent 96px, rgba(0,0,0,0.4) 128px, black 168px)';

export default function Chaos() {
  const layerRef = useRef(null);
  const [topId, setTopId] = useState('sunfire'); // 当前在上层的状态
  const top = STATES[topId];
  const bottomId = topId === 'sunfire' ? 'starflight' : 'sunfire';
  const bottom = STATES[bottomId];

  const onMove = e => {
    const el = layerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.style.setProperty('--rx', `${e.clientX - r.left}px`);
    el.style.setProperty('--ry', `${e.clientY - r.top}px`);
  };
  const toggle = () => setTopId(id => (id === 'sunfire' ? 'starflight' : 'sunfire'));

  return (
    <section
      className="relative h-dvh cursor-crosshair select-none overflow-hidden bg-black"
      onMouseMove={onMove}
      onClick={toggle}
    >
      {/* 下层(透视洞里显现) */}
      <img
        src={`${BASE}assets/chaos/${bottom.img}`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 上层 + X-ray 遮罩(鼠标洞露下层) */}
      <div
        ref={layerRef}
        className="absolute inset-0"
        style={{ '--mx': '-999px', '--my': '-999px', '--rx': '-999px', '--ry': '-999px' }}
      >
        <img
          src={`${BASE}assets/chaos/${top.img}`}
          alt=""
          aria-hidden="true"
          className="chaos-pulse absolute inset-0 h-full w-full object-cover"
          style={{ maskImage: XRAY_MASK, WebkitMaskImage: XRAY_MASK }}
        />
        {/* 透视镜发光圈(跟随鼠标) */}
        <div
          className="pointer-events-none absolute h-[192px] w-[192px] rounded-full"
          style={{
            left: 'var(--rx)',
            top: 'var(--ry)',
            transform: 'translate(-50%, -50%)',
            border: `1px solid ${bottom.accent}88`,
            boxShadow: `0 0 24px ${bottom.accent}55, inset 0 0 24px ${bottom.accent}33`
          }}
        />
      </div>

      {/* 氛围粒子:三日凌空飘升余烬 / 三飞星飘落寒雪(随上层态切换) */}
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
        <p className="mt-3 font-tech text-xs tracking-[0.35em]" style={{ color: `${top.accent}bb` }}>
          X-RAY · 鼠标透视另一态 · 点击切换上下层
        </p>
      </div>

      {/* 左上:当前上层态 · 恒星/行星状态读数 */}
      <div
        key={topId}
        className="route-elastic-up liquid-glass pointer-events-none absolute left-5 top-40 z-10 w-[min(340px,82vw)] rounded-2xl px-5 py-4 md:left-8 md:top-44"
        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px ${top.accent}33` }}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: top.accent }} />
          <span className="font-tech text-[10px] tracking-[0.3em]" style={{ color: top.accent }}>
            {top.en}
          </span>
        </div>
        <h2 className="mt-1.5 font-santi text-2xl text-white md:text-3xl">{top.era}</h2>
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 font-body text-xs">
          <p>
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">恒星状态</span>
            <br />
            <span className="text-[#c6d6ef]">{top.sun}</span>
          </p>
          <p>
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">行星状态</span>
            <br />
            <span style={{ color: top.accent }}>{top.surf}</span>
          </p>
        </div>
        <p className="mt-3 font-body text-xs italic leading-relaxed text-[#9db0cc]">「{top.quote}」</p>
      </div>

      {/* 右下:透视目标态提示 */}
      <div className="pointer-events-none absolute bottom-8 right-5 z-10 text-right font-tech text-[11px] tracking-[0.2em] text-white/45 md:right-8">
        <p>
          透视洞内 · <span style={{ color: bottom.accent }}>{bottom.era}</span>
        </p>
        <p className="mt-1 text-white/30">CLICK TO SWAP LAYERS</p>
      </div>

      {/* 底部引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        乱纪元与恒纪元交替无常,文明在脱水与浸泡间轮回求生。
      </p>
    </section>
  );
}
