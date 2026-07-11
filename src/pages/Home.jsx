import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SplitText from '../components/SplitText/SplitText';
import DecryptedText from '../components/DecryptedText/DecryptedText';
import TextType from '../components/TextType/TextType';
import MagicBento from '../components/MagicBento/MagicBento';
import LaserFlow from '../components/LaserFlow/LaserFlow';

// 卡片标题:悬停乱码重解(DecryptedText,字符集=三体电波风)
const dTitle = t => (
  <DecryptedText
    text={t}
    animateOn="hover"
    sequential
    speed={80}
    characters="01三体智子乱紀元恒·+-×"
    parentClassName="inline-block cursor-default"
    encryptedClassName="text-[#97C3FF]/70"
  />
);

// Bento 槽位:第 3、4 张为 2×2 大卡(组件内置网格),演算放 3、黑暗森林放 4
// 用色规则:金=行动/焦点(演算大卡),蓝=信息(其余);to=站内路由,href=独立全屏页
const CARDS = [
  {
    color: '#080d18',
    label: 'FLEET',
    labelColor: '#97C3FF',
    title: dTitle('星际舰队'),
    description: '末日之战前,人类最后的无敌舰队',
    to: '/fleet'
  },
  {
    color: '#080d18',
    label: 'CHAOTIC ERA',
    labelColor: '#97C3FF',
    title: dTitle('乱纪元'),
    description: '脱水!三日凌空下的文明轮回',
    to: '/chaos'
  },
  {
    color: '#0A0D14',
    label: 'SIMULATION · LIVE',
    labelColor: '#FFA26A',
    borderColor: '#7A5A40',
    title: dTitle('三体实时演算'),
    description:
      '四体引力实时演算 · 恒纪元与乱纪元 · 文明纪年系统。已上线,点击进入全屏宇宙。',
    href: './santi.html'
  },
  {
    color: '#080d18',
    label: 'DARK FOREST',
    labelColor: '#97C3FF',
    title: dTitle('黑暗森林'),
    description: '宇宙社会学两公理:生存是文明的第一需要',
    to: '/dark-forest'
  },
  {
    color: '#080d18',
    label: 'DROPLET',
    labelColor: '#97C3FF',
    title: dTitle('水滴'),
    description: '强相互作用力宇宙探测器,绝对光滑的镜面',
    to: '/droplet'
  },
  {
    color: '#080d18',
    label: 'DUAL VECTOR FOIL',
    labelColor: '#97C3FF',
    title: dTitle('二向箔'),
    description: '降维打击:这是曼妙的死亡',
    to: '/2d-foil'
  }
];

const QUOTES = [
  '给岁月以文明,而不是给文明以岁月。',
  '弱小和无知不是生存的障碍,傲慢才是。',
  '藏好自己,做好清理。',
  '我们都是阴沟里的虫子,但总还是得有人仰望星空。'
];

export default function Home() {
  const navigate = useNavigate();
  const revealImgRef = useRef(null);
  // 站内卡片走客户端路由(不整页刷新);演算大卡保留 href 硬跳独立页
  const cards = CARDS.map(c => (c.to ? { ...c, onClick: () => navigate(c.to) } : c));

  return (
    <>
      {/* ===== Hero(标题字体=未来荧黑宽体重黑+Orbitron,影视片头感) ===== */}
      <header className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="font-orbit text-sm font-bold tracking-[0.6em] text-white/90 [text-shadow:0_0_18px_rgba(151,195,255,0.4)]">
          THREE-BODY UNIVERSE
        </p>
        <SplitText
          text="三体宇宙"
          tag="h1"
          className="font-title text-6xl leading-tight md:text-8xl [text-shadow:0_0_28px_rgba(151,195,255,0.45),0_0_90px_rgba(151,195,255,0.18)]"
          delay={120}
          duration={1.1}
          from={{ opacity: 0, y: 60 }}
          to={{ opacity: 1, y: 0 }}
        />
        {/* 滚动名句:字体与颜色与主标题同步 */}
        <div className="mt-2 h-8 font-title text-base text-white md:text-lg [text-shadow:0_0_18px_rgba(151,195,255,0.35)]">
          <TextType
            text={QUOTES}
            typingSpeed={80}
            deletingSpeed={30}
            pauseDuration={2600}
            cursorCharacter="_"
          />
        </div>
        <a
          href="#universe"
          className="mt-10 animate-bounce font-tech text-2xl text-white/40"
          aria-label="向下滚动"
        >
          ↓
        </a>
      </header>

      {/* ===== 宇宙图景:LaserFlow 激光打在卡片容器顶边(React Bits Box 样式) ===== */}
      {/* 激光焦点距画布顶 = 画布高×(0.5−verticalBeamOffset)=0.7H,section 的 pt 与之对齐 */}
      <section
        id="universe"
        className="relative pb-24 pt-[434px] md:pt-[476px]"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const el = revealImgRef.current;
          if (el) {
            el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
            el.style.setProperty('--my', `${e.clientY - rect.top}px`);
          }
        }}
        onMouseLeave={() => {
          const el = revealImgRef.current;
          if (el) {
            el.style.setProperty('--mx', '-9999px');
            el.style.setProperty('--my', '-9999px');
          }
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-[620px] md:h-[680px]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 7%, black 80%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 7%, black 80%, transparent 100%)'
          }}
        >
          <LaserFlow color="#97C3FF" horizontalBeamOffset={0.1} verticalBeamOffset={-0.2} />
        </div>

        {/* 官方 Box 示例的悬停显影层:鼠标扫过激光区时以光标为圆心显现银河(照亮混合) */}
        <img
          ref={revealImgRef}
          src={`${import.meta.env.BASE_URL}assets/wp/galaxy-reveal.jpg`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[620px] w-full object-cover md:h-[680px]"
          style={{
            mixBlendMode: 'lighten',
            opacity: 0.3,
            '--mx': '-9999px',
            '--my': '-9999px',
            WebkitMaskImage:
              'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)',
            maskImage:
              'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,1) 0px, rgba(255,255,255,0.95) 60px, rgba(255,255,255,0.6) 120px, rgba(255,255,255,0.25) 180px, rgba(255,255,255,0) 240px)',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat'
          }}
        />

        {/* 卡片容器:顶边正对激光焦点,边框/辉光与激光同色,内衬点阵 */}
        <div
          className="relative z-[6] mx-4 max-w-6xl rounded-[20px] border-2 border-[#97C3FF] bg-[#060010] px-4 py-10 shadow-[0_0_30px_rgba(151,195,255,0.45)] md:px-8 xl:mx-auto"
          style={{
            backgroundImage: 'radial-gradient(rgba(151,195,255,0.13) 1px, transparent 1px)',
            backgroundSize: '26px 26px'
          }}
        >
          <h2 className="mb-3 text-center font-santi text-3xl md:text-4xl">宇宙图景</h2>
          <p className="mb-10 text-center font-tech text-sm tracking-[0.35em] text-white/45">
            SELECT A SECTOR
          </p>
          <MagicBento
            cards={cards}
            textAutoHide={false}
            enableStars
            enableSpotlight
            enableBorderGlow
            enableTilt={false}
            enableMagnetism
            clickEffect
            spotlightRadius={320}
            particleCount={8}
            glowColor="151, 195, 255"
          />
        </div>
      </section>
    </>
  );
}
