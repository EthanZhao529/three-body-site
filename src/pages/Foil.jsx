import { useRef, useState } from 'react';
import HilbertReduce from '../components/HilbertReduce/HilbertReduce';

// 二向箔 · 降维打击。三维太阳系 → 点击投放二向箔 → 整个太阳系被拍平成一幅二维之画。
// Canvas 负责演算与画面(FoilCollapse),本页只叠 HUD(舰桥式信息卡),三态由 onPhase 驱动。
const INFO = {
  space: {
    tag: 'THREE-DIMENSIONAL',
    accent: '#97c3ff',
    era: '三维 · 地球',
    dim: '3',
    state: '人类的家园,悬于三维空间',
    line: '一片薄膜,一个碎块 —— 它叫二向箔。',
  },
  collapsing: {
    tag: 'DIMENSION COLLAPSING',
    accent: '#FFA26A',
    era: '降维进行中',
    dim: '3 → 2',
    state: '沿希尔伯特曲线,逐块跌落二维',
    line: '跌落是从一个方向开始的,谁也躲不开。',
  },
  plane: {
    tag: 'TWO-DIMENSIONAL',
    accent: '#FFCBB1',
    era: '二维 · 展开的地球',
    dim: '2',
    state: '家园被展开成一幅平面的画',
    line: '毁灭你,与你何干。',
  },
};

export default function Foil() {
  const apiRef = useRef(null);
  const [phase, setPhase] = useState('space');
  const info = INFO[phase] || INFO.space;

  return (
    <section
      className={`relative h-dvh select-none overflow-hidden bg-black ${phase === 'space' ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={() => phase === 'space' && apiRef.current?.collapse()}
    >
      {/* 演算画布 */}
      <div className="absolute inset-0 z-0">
        <HilbertReduce onPhase={setPhase} onReady={api => { apiRef.current = api; }} />
      </div>

      {/* 顶部标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center px-6 text-center [transform:translateZ(0)]">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">DUAL VECTOR FOIL · 降维打击</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          二向箔
        </h1>
      </div>

      {/* 左上:维度读数卡(随三态弹性切换) */}
      <div
        key={phase}
        className="route-elastic-up liquid-glass pointer-events-none absolute left-5 top-40 z-10 w-[min(340px,82vw)] rounded-2xl px-5 py-4 md:left-8 md:top-44"
        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px ${info.accent}33` }}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: info.accent }} />
          <span className="font-tech text-[10px] tracking-[0.3em]" style={{ color: info.accent }}>
            {info.tag}
          </span>
        </div>
        <h2 className="mt-1.5 font-santi text-2xl text-white md:text-3xl">{info.era}</h2>
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 font-body text-xs">
          <p className="flex items-baseline gap-2">
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">空间维度</span>
            <span className="font-tech text-lg tracking-widest" style={{ color: info.accent }}>{info.dim}</span>
          </p>
          <p>
            <span className="font-tech text-[10px] tracking-[0.2em] text-white/40">系统状态</span>
            <br />
            <span className="text-[#c6d6ef]">{info.state}</span>
          </p>
        </div>
        <p className="mt-3 font-body text-xs italic leading-relaxed text-[#9db0cc]">「{info.line}」</p>
      </div>

      {/* 中央提示:仅三维态,提示投放 */}
      {phase === 'space' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10 flex flex-col items-center gap-1 text-center">
          <p className="animate-pulse font-tech text-sm tracking-[0.4em] text-[#FFCBB1]/85">点击投放二向箔</p>
          <p className="font-tech text-[10px] tracking-[0.35em] text-white/35">CLICK ANYWHERE TO RELEASE</p>
        </div>
      )}

      {/* 右下:二维态显示"重演"按钮 */}
      {phase === 'plane' && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); apiRef.current?.restore(); }}
          className="glass-clear route-elastic-up absolute bottom-8 right-5 z-20 rounded-full px-5 py-2.5 font-tech text-xs tracking-[0.28em] text-[#97c3ff] transition-colors hover:text-white md:right-8"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(151,195,255,.28)' }}
        >
          ⟲ 重演 · RESTORE
        </button>
      )}

      {/* 底部引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none px-8 text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        {phase === 'plane'
          ? '给岁月以文明,而不是给文明以岁月 —— 家园的一切,都留在了这幅展开的二维画里。'
          : '歌者随手掷来一片二向箔 —— 三维的地球,将沿一条曲线被逐块抽向二维。'}
      </p>
    </section>
  );
}
