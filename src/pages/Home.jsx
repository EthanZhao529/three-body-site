import { useRef } from 'react';
import { Link } from 'react-router-dom';
import TextType from '../components/TextType/TextType';
import LaserFlow from '../components/LaserFlow/LaserFlow';

// 隐匿入口(黑暗森林式:光标扫过才显现,显现处即可点击;金=行动/演算,蓝=信息)
const SECTOR_CARDS = [
  { label: 'FLEET', title: '星际舰队', desc: '末日之战前,人类最后的无敌舰队', to: '/fleet' },
  { label: 'CHAOTIC ERA', title: '乱纪元', desc: '脱水!三日凌空下的文明轮回', to: '/chaos' },
  {
    label: 'SIMULATION · LIVE',
    title: '三体实时演算',
    desc: '四体引力实时演算,点击进入全屏宇宙',
    href: './santi.html',
    gold: true
  },
  { label: 'DARK FOREST', title: '黑暗森林', desc: '生存是文明的第一需要', to: '/dark-forest' },
  { label: 'DROPLET', title: '水滴', desc: '绝对光滑的强互作用力宇宙探测器', to: '/droplet' },
  { label: 'DUAL VECTOR FOIL', title: '二向箔', desc: '降维打击:这是曼妙的死亡', to: '/2d-foil' }
];

const QUOTES = [
  '给岁月以文明,而不是给文明以岁月。',
  '弱小和无知不是生存的障碍,傲慢才是。',
  '藏好自己,做好清理。',
  '我们都是阴沟里的虫子,但总还是得有人仰望星空。'
];

// 显影遮罩:以光标为圆心,中心全亮向外 320px 渐隐(卡片尺度比官方图片版放大一档)
const REVEAL_MASK =
  'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 80px, rgba(255,255,255,0.6) 160px, rgba(255,255,255,0.25) 240px, rgba(255,255,255,0) 320px)';

function CardBody({ c }) {
  return (
    <>
      <span
        className={`font-tech text-[10px] tracking-[0.2em] ${c.gold ? 'text-[#FFA26A]' : 'text-[#97C3FF]'}`}
      >
        {c.label}
      </span>
      <span className="mt-1 block font-santi text-base text-white md:text-lg">{c.title}</span>
      <span className="mt-0.5 block truncate font-body text-xs text-[#8A93A8]">{c.desc}</span>
    </>
  );
}

export default function Home() {
  const cardsLayerRef = useRef(null);

  // 光标位置写入卡片层坐标系(官方 Box 示例的显影交互,显影对象换成入口卡片)
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
    `pointer-events-auto block rounded-xl border bg-[#060010]/85 px-4 py-3 transition-colors duration-200 ${
      gold
        ? 'border-[#7A5A40] hover:border-[#FFA26A] hover:bg-[#0B0906]'
        : 'border-[#16233f] hover:border-[#97C3FF] hover:bg-[#0a1020]'
    }`;

  return (
    <section className="relative h-dvh overflow-hidden" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {/* 激光:页面底部,焦点(0.5−0.15=0.35H)落在隐匿卡片区上缘 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62vh]"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%)'
        }}
      >
        <LaserFlow color="#97C3FF" horizontalBeamOffset={0} verticalBeamOffset={0.15} />
      </div>

      {/* ===== Hero(标题为烘焙图像:无边界、不可选中、不可拖拽) ===== */}
      <div className="pointer-events-none relative z-10 flex select-none flex-col items-center gap-5 px-6 pt-[15vh] text-center">
        <p className="font-orbit text-sm font-bold tracking-[0.6em] text-white/90 [text-shadow:0_0_18px_rgba(151,195,255,0.4)]">
          THREE-BODY UNIVERSE
        </p>
        <img
          src={`${import.meta.env.BASE_URL}assets/title.webp`}
          alt="三体宇宙"
          draggable={false}
          className="title-rise w-[min(92vw,574px)] select-none"
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

      {/* ===== 隐匿入口:光标扫过显现(触屏降级常显,见 index.css .reveal-mask) ===== */}
      <div className="absolute inset-x-0 bottom-0 z-[6] flex flex-col justify-end pb-[4vh]">
        <p className="mb-3 select-none text-center font-tech text-xs tracking-[0.4em] text-white/25 [@media(hover:none)]:hidden">
          SCAN THE DARK FOREST · 光标扫过显现隐匿坐标
        </p>
        <div
          ref={cardsLayerRef}
          className="reveal-mask pointer-events-none mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-3 md:gap-4"
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
              <a key={c.label} href={c.href} className={cardCls(c.gold)}>
                <CardBody c={c} />
              </a>
            ) : (
              <Link key={c.label} to={c.to} className={cardCls(c.gold)}>
                <CardBody c={c} />
              </Link>
            )
          )}
        </div>
      </div>
    </section>
  );
}
