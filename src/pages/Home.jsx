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

// 卡片内衬:扫描线纹理 + 纵向暗渐变(HUD 面板质感)
const cardBg = gold => ({
  backgroundImage: gold
    ? 'repeating-linear-gradient(0deg, rgba(255,162,106,0.035) 0 1px, transparent 1px 3px), linear-gradient(to bottom, rgba(20,16,10,0.92), rgba(7,5,3,0.92))'
    : 'repeating-linear-gradient(0deg, rgba(151,195,255,0.035) 0 1px, transparent 1px 3px), linear-gradient(to bottom, rgba(8,17,32,0.92), rgba(4,7,13,0.92))'
});

function CardBody({ c }) {
  const accent = c.gold ? '#FFA26A' : '#97C3FF';
  return (
    <>
      {/* 瞄准框角标 */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2"
        style={{ borderColor: accent }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2"
        style={{ borderColor: accent }}
      />
      <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1.5">
        <span className="font-tech text-[10px] tracking-[0.25em]" style={{ color: accent }}>
          {c.label}
        </span>
        <span className="font-tech text-[9px] tracking-[0.2em] text-white/35">SEC·{c.code}</span>
      </div>
      <div className="mt-2 font-santi text-base text-white md:text-lg">{dTitle(c.title)}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate font-body text-xs text-[#8A93A8]">{c.desc}</span>
        <span className="shrink-0 font-tech text-[9px] text-[#5B86C9]">{c.coord}</span>
      </div>
    </>
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

  const cardCls = gold =>
    `pointer-events-auto relative block border px-4 pb-3 pt-2.5 transition-all duration-200 ${
      gold
        ? 'border-[#7A5A40]/60 hover:border-[#FFA26A] hover:shadow-[0_0_18px_rgba(255,162,106,0.28)]'
        : 'border-[#1B2C4D]/70 hover:border-[#97C3FF] hover:shadow-[0_0_18px_rgba(151,195,255,0.28)]'
    }`;

  return (
    <section
      className="relative flex h-dvh flex-col overflow-hidden"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* 激光:贴页底,焦点(0.5−(−0.43)=0.93H)落在视口约 95vh 处,光束向上升起并波动 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[68vh]"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%)'
        }}
      >
        <LaserFlow color="#97C3FF" horizontalBeamOffset={0} verticalBeamOffset={-0.43} />
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
          {SECTOR_CARDS.map(c =>
            c.href ? (
              <a key={c.label} href={c.href} className={cardCls(c.gold)} style={cardBg(c.gold)}>
                <CardBody c={c} />
              </a>
            ) : (
              <Link key={c.label} to={c.to} className={cardCls(c.gold)} style={cardBg(c.gold)}>
                <CardBody c={c} />
              </Link>
            )
          )}
        </div>
      </div>
    </section>
  );
}
