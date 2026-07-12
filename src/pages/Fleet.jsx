import { useState } from 'react';
import ProfileCard from '../components/ProfileCard/ProfileCard';

const BASE = import.meta.env.BASE_URL;

// 舰长档案(原著已核实;画像=用户 GPT 成图,public/assets/captains/<id>.webp)
const CAPTAINS = [
  {
    id: 'zhangbeihai',
    name: '章北海',
    ship: '自然选择号 · 执行舰长',
    glow: 'rgba(255,162,106,0.5)',
    gradient: 'linear-gradient(145deg,#3a2a1a88 0%,#FFB07144 100%)',
    bio: '原中国太空军政治委员。坚定的胜利主义面孔之下,是清醒到冷酷的失败主义者;以"增援未来"之名冬眠近两个世纪,成为恒星级战舰"自然选择"号的执行舰长。',
    order: '为人类文明保存火种。末日之战前夕,他夺取"自然选择"号发出"前进四",孤舰奔向深空;黑暗战役降临时,他最后一刻没有按下攻击键——"没关系的,都一样。"'
  },
  {
    id: 'dongfangyanxu',
    name: '东方延绪',
    ship: '自然选择号 · 舰长',
    glow: 'rgba(125,190,255,0.55)',
    gradient: 'linear-gradient(145deg,#1a2c4e88 0%,#71C4FF44 100%)',
    bio: '亚洲舰队恒星级旗舰"自然选择"号舰长,在新时代太空舰队中成长起来的年轻指挥官。',
    order: '夺回自己的战舰。劫持发生时她在舰上竭力夺回控制权;而在此后的漫长航程中,她逐渐读懂了章北海——读懂了那个来自过去的军人背负了两个世纪的孤独使命。'
  },
  {
    id: 'chuyan',
    name: '褚岩',
    ship: '蓝色空间号 · 舰长',
    glow: 'rgba(125,190,255,0.55)',
    gradient: 'linear-gradient(145deg,#16324188 0%,#71C4FF44 100%)',
    bio: '恒星级战舰"蓝色空间"号舰长,追击编队指挥官。比任何人都更早接受了一个事实:离开太阳系的那一刻,他们已经是一个新的文明。',
    order: '活下去。黑暗战役中,他预先令全舰抽成真空、全员着舰内太空服,使"终极规律"号的次声波氢弹偷袭失效;反击之后,"蓝色空间"号成为唯一幸存的战舰,载着人类的另一支火种驶向深空。'
  }
];

// 单屏舰队页:2.5D 舰队为底(保留 iframe 指针交互,滚轮经 postMessage 翻模块),
// 舰长档案 ProfileCard 紧凑版列于左上,悬停/点击切换下方档案详情
export default function Fleet() {
  const [active, setActive] = useState(CAPTAINS[0]);

  return (
    <section className="relative h-dvh overflow-hidden bg-[#02040c]">
      <iframe
        src={`${BASE}fleet-bg.html`}
        title="星际舰队 · 2.5D"
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* 标题(右上,给左侧档案让位) */}
      <div className="pointer-events-none absolute right-6 top-24 z-10 select-none text-right md:right-10">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">FLEET · 末日之战</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          星际舰队
        </h1>
        <p className="mt-2 font-body text-xs text-[#C6CDDB]/75 md:text-sm">
          两千余艘恒星级战舰列阵太空
        </p>
      </div>

      {/* 舰长档案:左上排列(紧凑全息卡)+档案详情 */}
      <div className="absolute left-4 top-20 z-10 md:left-6">
        <p className="mb-2 select-none font-tech text-[10px] tracking-[0.4em] text-[#97C3FF]/60">
          THE CAPTAINS · 舰长档案
        </p>
        <div className="flex gap-3">
          {CAPTAINS.map(c => (
            <div
              key={c.id}
              className={`pc-mini cursor-pointer transition-opacity duration-300 ${
                active.id === c.id ? 'opacity-100' : 'opacity-55 hover:opacity-85'
              }`}
              onMouseEnter={() => setActive(c)}
              onClick={() => setActive(c)}
            >
              <ProfileCard
                name={c.name}
                title={c.ship}
                showUserInfo={false}
                enableTilt
                enableMobileTilt={false}
                behindGlowEnabled
                behindGlowColor={c.glow}
                innerGradient={c.gradient}
                avatarUrl={`${BASE}assets/captains/${c.id}.webp`}
                iconUrl=""
                grainUrl=""
              />
            </div>
          ))}
        </div>
        {/* 档案详情(液态玻璃,跟随所选舰长) */}
        <div className="liquid-glass mt-3 w-[min(660px,72vw)] select-none rounded-2xl px-5 py-4">
          <p className="font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/60">
            PROFILE · {active.name} · {active.ship}
          </p>
          <p className="mt-1.5 font-body text-xs leading-relaxed text-[#c6d6ef]">{active.bio}</p>
          <p className="mt-2.5 font-tech text-[10px] tracking-[0.3em] text-[#FFA26A]/70">
            STRATEGIC OBJECTIVE · 命令与选择
          </p>
          <p className="mt-1.5 font-body text-xs leading-relaxed text-[#9db0cc]">{active.order}</p>
        </div>
      </div>

      {/* 左下:引文 */}
      <div className="pointer-events-none absolute bottom-8 left-5 z-10 select-none md:left-8">
        <p className="font-santi text-base tracking-[2px] text-[#FFCBB1] md:text-lg [text-shadow:0_0_16px_rgba(255,162,106,0.35)]">
          前进!前进!!不择手段地前进!
        </p>
        <p className="mt-1 font-tech text-[10px] tracking-[0.3em] text-white/35">
          ADVANCE, BY ANY MEANS NECESSARY
        </p>
      </div>

      {/* 右下:舰队 HUD 读数 */}
      <div className="pointer-events-none absolute bottom-8 right-5 z-10 select-none text-right font-tech text-[11px] tracking-[0.2em] text-white/45 md:right-8">
        <p>
          WARSHIPS <span className="text-[#97C3FF]">2000+</span>
        </p>
        <p className="mt-1">
          FORMATION · <span className="text-[#97C3FF]">矩形阵列</span>
        </p>
        <p className="mt-1">
          TARGET · <span className="text-[#FFA26A]">强互作用力探测器「水滴」</span>
        </p>
      </div>
    </section>
  );
}
