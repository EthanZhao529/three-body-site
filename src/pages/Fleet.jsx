import ProfileCard from '../components/ProfileCard/ProfileCard';

const BASE = import.meta.env.BASE_URL;

// 舰长档案(原著已核实:自然选择号舰长东方延绪/执行舰长章北海"前进四";
// 黑暗战役中"终极规律"号先射次声波氢弹,褚岩的"蓝色空间"号预先抽真空幸存并反击)
// 画像:public/assets/captains/<id>.png,现为占位剪影,GPT 成图后同名替换即可
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

export default function Fleet() {
  return (
    <div className="h-dvh overflow-y-auto bg-[#02040c]">
      {/* ===== 第一屏:2.5D 视差舰队(iframe 保留鼠标视差) ===== */}
      <section className="relative h-dvh overflow-hidden">
        <iframe
          src={`${BASE}fleet-bg.html`}
          title="星际舰队 · 2.5D"
          className="absolute inset-0 h-full w-full border-0"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
          <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">FLEET · 末日之战</p>
          <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
            星际舰队
          </h1>
          <p className="mt-3 font-body text-sm text-[#C6CDDB]/75 md:text-base">
            两千余艘恒星级战舰列阵太空,人类最后的无敌舰队
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-14 left-5 z-10 select-none md:bottom-16 md:left-8">
          <p className="font-santi text-base tracking-[2px] text-[#FFCBB1] md:text-lg [text-shadow:0_0_16px_rgba(255,162,106,0.35)]">
            前进!前进!!不择手段地前进!
          </p>
          <p className="mt-1 font-tech text-[10px] tracking-[0.3em] text-white/35">
            ADVANCE, BY ANY MEANS NECESSARY
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-14 right-5 z-10 select-none text-right font-tech text-[11px] tracking-[0.2em] text-white/45 md:bottom-16 md:right-8">
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

        {/* 向下滚动提示 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 select-none text-center">
          <p className="animate-bounce font-tech text-xs tracking-[0.4em] text-white/35">
            ↓ 舰长档案
          </p>
        </div>
      </section>

      {/* ===== 第二屏:舰长档案(ProfileCard 全息卡 + 简介/战略抉择) ===== */}
      <section className="relative min-h-dvh px-6 py-24">
        <div className="flex select-none flex-col items-center text-center">
          <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">THE CAPTAINS</p>
          <h2 className="mt-3 font-santi text-3xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.3)]">
            舰长档案
          </h2>
          <p className="mt-3 font-body text-xs text-[#8A93A8] md:text-sm">
            他们的命令与选择,决定了人类火种的去向
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-10">
          {CAPTAINS.map(c => (
            <div key={c.id} className="flex flex-col items-center">
              <ProfileCard
                name={c.name}
                title={c.ship}
                showUserInfo={false}
                enableTilt
                enableMobileTilt={false}
                behindGlowEnabled
                behindGlowColor={c.glow}
                innerGradient={c.gradient}
                avatarUrl={`${BASE}assets/captains/${c.id}.png`}
                iconUrl=""
                grainUrl=""
              />
              <div className="liquid-glass mt-6 w-full max-w-[390px] rounded-2xl px-5 py-4">
                <p className="font-tech text-[10px] tracking-[0.3em] text-[#97C3FF]/60">PROFILE · 简介</p>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-[#c6d6ef] md:text-sm">
                  {c.bio}
                </p>
                <p className="mt-3 font-tech text-[10px] tracking-[0.3em] text-[#FFA26A]/70">
                  STRATEGIC OBJECTIVE · 命令与选择
                </p>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-[#9db0cc] md:text-sm">
                  {c.order}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
