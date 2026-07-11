import { useState } from 'react';
import DarkForestField from '../components/DarkForestField/DarkForestField';

let uid = 0;

export default function DarkForest() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ alive: 0, cleansed: 0 });

  const push = (text, type) =>
    setEntries(l => [{ id: (uid += 1), text, type }, ...l].slice(0, 6));

  return (
    <section className="relative h-dvh overflow-hidden">
      {/* 星野交互层(canvas 接收点击,不被覆盖层遮挡) */}
      <div className="absolute inset-0">
        <DarkForestField
          onStrike={({ coordStr, n }) => push(`第 ${n} 次打击 · 坐标 ${coordStr} 已清理`, 'strike')}
          onSpawn={({ coordStr }) => push(`新的文明在 ${coordStr} 诞生`, 'spawn')}
          onCensus={setStats}
        />
      </div>

      {/* 顶部:标题+宇宙社会学两公理+操作提示 */}
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
        <p className="mt-5 font-tech text-xs tracking-[0.35em] text-[#FFA26A]/60">
          CLICK TO STRIKE · 点击星点,执行清理
        </p>
      </div>

      {/* 左下:打击日志(演算页体例,透明度阶梯) */}
      <div className="pointer-events-none absolute bottom-6 left-5 z-10 select-none space-y-1 font-santi text-xs md:text-sm">
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

      {/* 右下:文明统计 */}
      <div className="pointer-events-none absolute bottom-6 right-5 z-10 select-none text-right font-tech text-xs tracking-[0.2em] text-white/45">
        <p>
          SURVIVING · 现存文明 <span className="text-[#97C3FF]">{stats.alive}</span>
        </p>
        <p className="mt-1">
          CLEANSED · 已清理 <span className="text-[#FFA26A]">{stats.cleansed}</span>
        </p>
      </div>

      {/* 底部居中引文(小屏隐藏,避免与日志/统计拥挤) */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-10 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        宇宙就是一座黑暗森林,每个文明都是带枪的猎人。
      </p>
    </section>
  );
}
