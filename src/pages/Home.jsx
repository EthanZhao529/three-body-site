import { useRef } from 'react';
import { Link } from 'react-router-dom';
import TextType from '../components/TextType/TextType';
import DecryptedText from '../components/DecryptedText/DecryptedText';
import LaserFlow from '../components/LaserFlow/LaserFlow';

// 卡片标题:悬停乱码重解(智子干扰风,字符集=三体电波)
const dTitle = t => (
  <DecryptedText
    text={t}
    animateOn="hover"
    sequential
    speed={80}
    characters="01三体智子乱紀元恒·+-×"
    parentClassName="inline-block"
    encryptedClassName="text-[#97C3FF]/70"
  />
);

// 隐匿入口(黑暗森林式:光标扫过才显现,显现处即可点击;金=行动/演算,蓝=信息)
// coord=宇宙坐标(呼应演算页 OL 标注的 [x,y,z] 体例)
const SECTOR_CARDS = [
  {
    code: '01',
    label: 'FLEET',
    title: '星际舰队',
    desc: '末日之战前,人类最后的无敌舰队',
    coord: '[ 210.05, -3.16, 8.44 ]',
    to: '/fleet'
  },
  {
    code: '02',
    label: 'CHAOTIC ERA',
    title: '乱纪元',
    desc: '脱水!三日凌空下的文明轮回',
    coord: '[ 0.93, 4.22, -1.37 ]',
    to: '/chaos'
  },
  {
    code: '03',
    label: 'SIMULATION · LIVE',
    title: '三体实时演算',
    desc: '四体引力实时演算,点击进入全屏宇宙',
    coord: '[ 1.50, -0.25, 6.00 ]',
    href: './santi.html',
    gold: true
  },
  {
    code: '04',
    label: 'DARK FOREST',
    title: '黑暗森林',
    desc: '生存是文明的第一需要',
    coord: '[ -7.71, 2.08, 0.44 ]',
    to: '/dark-forest'
  },
  {
    code: '05',
    label: 'DROPLET',
    title: '水滴',
    desc: '绝对光滑的强互作用力宇宙探测器',
    coord: '[ 11.28, -0.02, 3.05 ]',
    to: '/droplet'
  },
  {
    code: '06',
    label: 'DUAL VECTOR FOIL',
    title: '二向箔',
    desc: '降维打击:这是曼妙的死亡',
    coord: '[ ∞, ∞, 0.00 ]',
    to: '/2d-foil'
  }
];

const QUOTES = [
  '给岁月以文明,而不是给文明以岁月。',
  '弱小和无知不是生存的障碍,傲慢才是。',
  '藏好自己,做好清理。',
  '我们都是阴沟里的虫子,但总还是得有人仰望星空。'
];

// 显影遮罩:以光标为圆心,中心全亮向外 320px 渐隐
const REVEAL_MASK =
  'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 80px, rgba(255,255,255,0.6) 160px, rgba(255,255,255,0.25) 240px, rgba(255,255,255,0) 320px)';

// 科幻玻璃 HUD 卡(FluidGlass 质感的原生实现):
// 背后画面实时模糊折光(backdrop-blur)+顶棱高光+悬停扫光(.glass-sheen)
// 保留状态灯/SEC 编号/宇宙坐标/幽灵编号水印/悬停乱码解密
function SectorCard({ c }) {
  const accent = c.gold ? '#FFA26A' : '#97C3FF';
  // iOS 纯透明液玻:无边框,悬停用 drop-shadow 泛光(保住玻璃内高光)
  const cls = `liquid-glass glass-sheen group pointer-events-auto relative block overflow-hidden rounded-3xl px-4 pb-4 pt-2.5 transition-all duration-300 ${
    c.gold
      ? 'hover:drop-shadow-[0_0_22px_rgba(255,162,106,0.35)]'
      : 'hover:drop-shadow-[0_0_22px_rgba(151,195,255,0.32)]'
  }`;
  const inner = (
    <>
      {/* 幽灵编号水印 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1 right-4 select-none font-orbit text-5xl font-black leading-none text-white/[0.07]"
      >
        {c.code}
      </span>
      {/* 状态灯 + 标签行 */}
      <span className="flex items-center gap-2 border-b border-white/10 pb-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span className="font-tech text-[10px] tracking-[0.25em]" style={{ color: accent }}>
          {c.label}
        </span>
        <span className="ml-auto font-tech text-[9px] tracking-[0.2em] text-white/35">
          SEC·{c.code}
        </span>
      </span>
      <span className="mt-2 block font-santi text-lg text-white md:text-xl">{dTitle(c.title)}</span>
      <span className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate font-body text-xs text-[#9db0cc]">{c.desc}</span>
        <span className="shrink-0 font-tech text-[9px] text-[#7FA5D9]">{c.coord}</span>
      </span>
    </>
  );
  return c.href ? (
    <a href={c.href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={c.to} className={cls}>
      {inner}
    </Link>
  );
}

export default function Home() {
  const cardsLayerRef = useRef(null);

  // 光标位置写入卡片层坐标系(官方 Box 示例的显影交互,显影对象=入口卡片)
  const handleMove = e => {
    const el = cardsLayerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const handleLeave = () => {
    const el = cardsLayerRef.current;
    if (!el) return;
    el.style.setProperty('--mx', '-9999px');
    el.style.setProperty('--my', '-9999px');
  };

  return (
    <section
      className="relative flex h-dvh flex-col overflow-hidden"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* 激光:页底光之地面,光束居右 70% 处;screen 混合置于隐匿卡片之上(黑=透明,光=叠加) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] h-[68vh] mix-blend-screen">
        <LaserFlow color="#97C3FF" horizontalBeamOffset={0.2} verticalBeamOffset={-0.43} />
      </div>

      {/* ===== Hero(标题为烘焙图像:无边界、不可选中、不可拖拽) ===== */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center gap-5 px-6 pt-[12vh] text-center">
        <p className="font-orbit text-sm font-bold tracking-[0.6em] text-white/90 [text-shadow:0_0_18px_rgba(151,195,255,0.4)]">
          THREE-BODY UNIVERSE
        </p>
        <img
          src={`${import.meta.env.BASE_URL}assets/title.webp`}
          alt="三体宇宙"
          draggable={false}
          className="title-rise h-auto max-h-[26vh] w-[min(92vw,574px)] select-none object-contain"
        />
        {/* 滚动名句:字体与颜色与主标题同步 */}
        <div className="h-8 font-title text-base text-white md:text-lg [text-shadow:0_0_18px_rgba(151,195,255,0.35)]">
          <TextType
            text={QUOTES}
            typingSpeed={80}
            deletingSpeed={30}
            pauseDuration={2600}
            cursorCharacter="_"
          />
        </div>
      </div>

      <div className="flex-1" />

      {/* ===== 隐匿入口:激光上方的黑暗空间,光标扫过显现(触屏降级常显) ===== */}
      <div className="relative z-[6] px-4 pb-[11vh]">
        <p className="mb-3 select-none text-center font-tech text-xs tracking-[0.4em] text-white/25 [@media(hover:none)]:hidden">
          SCAN THE DARK FOREST · 光标扫过显现隐匿坐标
        </p>
        <div
          ref={cardsLayerRef}
          className="reveal-mask pointer-events-none mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 md:grid-cols-3 md:gap-4"
          style={{
            '--mx': '-9999px',
            '--my': '-9999px',
            maskImage: REVEAL_MASK,
            WebkitMaskImage: REVEAL_MASK,
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat'
          }}
        >
          {SECTOR_CARDS.map(c => (
            <SectorCard key={c.label} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
