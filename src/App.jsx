import Galaxy from './components/Galaxy/Galaxy';
import SplitText from './components/SplitText/SplitText';
import DecryptedText from './components/DecryptedText/DecryptedText';
import TextType from './components/TextType/TextType';
import MagicBento from './components/MagicBento/MagicBento';
import StarBorder from './components/StarBorder/StarBorder';
import ClickSpark from './components/ClickSpark/ClickSpark';

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
// 用色规则:金=行动/焦点(演算大卡),蓝=信息(其余)
const CARDS = [
  {
    color: '#080d18',
    label: 'FLEET',
    labelColor: '#97C3FF',
    title: dTitle('星际舰队'),
    description: '末日之战前,人类最后的无敌舰队 —— 建设中'
  },
  {
    color: '#080d18',
    label: 'CHAOTIC ERA',
    labelColor: '#97C3FF',
    title: dTitle('乱纪元'),
    description: '脱水!三日凌空下的文明轮回 —— 建设中'
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
    description: '宇宙社会学两公理:生存是文明的第一需要 —— 建设中'
  },
  {
    color: '#080d18',
    label: 'DROPLET',
    labelColor: '#97C3FF',
    title: dTitle('水滴'),
    description: '强相互作用力宇宙探测器,绝对光滑的镜面 —— 建设中'
  },
  {
    color: '#080d18',
    label: 'DUAL VECTOR FOIL',
    labelColor: '#97C3FF',
    title: dTitle('二向箔'),
    description: '降维打击:这是曼妙的死亡 —— 建设中'
  }
];

const QUOTES = [
  '给岁月以文明,而不是给文明以岁月。',
  '弱小和无知不是生存的障碍,傲慢才是。',
  '藏好自己,做好清理。',
  '我们都是阴沟里的虫子,但总还是得有人仰望星空。'
];

export default function App() {
  return (
    <ClickSpark sparkColor="#FFCBB1" sparkRadius={22} sparkCount={8} duration={450}>
      <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
        {/* 深空背景(轻量星系;真·演算在 santi.html 独立页) */}
        <div className="fixed inset-0 z-0">
          <Galaxy
            density={1}
            hueShift={210}
            glowIntensity={0.25}
            twinkleIntensity={0.35}
            starSpeed={0.35}
            rotationSpeed={0.05}
            mouseRepulsion={true}
            repulsionStrength={2}
            mouseInteraction={true}
            starScale={0.7}
          />
        </div>

        <main className="relative z-10">
          {/* ===== Hero ===== */}
          <header className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
              THREE-BODY UNIVERSE
            </p>
            <SplitText
              text="三体宇宙"
              tag="h1"
              className="font-santi text-6xl leading-tight md:text-8xl"
              delay={120}
              duration={1.1}
              from={{ opacity: 0, y: 60 }}
              to={{ opacity: 1, y: 0 }}
            />
            <DecryptedText
              text="实时演算 · 黑暗森林 · 降维打击"
              className="font-santi text-lg text-white/85 md:text-xl"
              encryptedClassName="font-tech text-lg text-[#97c3ff]/50 md:text-xl"
              animateOn="view"
              sequential
              speed={70}
              characters="01三体智子乱紀元恒·+-×"
            />
            <div className="mt-2 h-8 font-body text-base text-[#FFCBB1] md:text-lg">
              <TextType
                text={QUOTES}
                typingSpeed={80}
                deletingSpeed={30}
                pauseDuration={2600}
                cursorCharacter="_"
              />
            </div>
            <StarBorder
              as="a"
              href="./santi.html"
              color="#FFA26A"
              speed="5s"
              thickness={2}
              className="mt-6"
            >
              <span className="block bg-[#0B0906] px-10 py-4 font-santi text-lg text-[#FFCBB1] rounded-[18px] border border-[#FFA26A]/70">
                进入三体实时演算 →
              </span>
            </StarBorder>
            <a
              href="#universe"
              className="mt-10 animate-bounce font-tech text-2xl text-white/40"
              aria-label="向下滚动"
            >
              ↓
            </a>
          </header>

          {/* ===== 宇宙图景(入口卡片阵) ===== */}
          <section id="universe" className="mx-auto max-w-6xl px-4 py-24">
            <h2 className="mb-3 text-center font-santi text-3xl md:text-4xl">宇宙图景</h2>
            <p className="mb-10 text-center font-tech text-sm tracking-[0.35em] text-white/45">
              SELECT A SECTOR
            </p>
            <MagicBento
              cards={CARDS}
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
          </section>

          {/* ===== 页脚 ===== */}
          <footer className="border-t border-white/10 px-6 py-10 text-center">
            <p className="font-body text-sm text-[#ffcbb1]/60">给岁月以文明,而不是给文明以岁月。</p>
            <p className="mt-2 font-tech text-xs tracking-[0.3em] text-white/30">
              © 2026 THREE-BODY · SITE
            </p>
          </footer>
        </main>
      </div>
    </ClickSpark>
  );
}
