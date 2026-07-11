import { Link } from 'react-router-dom';
import SplitText from '../components/SplitText/SplitText';
import DecryptedText from '../components/DecryptedText/DecryptedText';

// 子页占位骨架:各分区做成后整页替换(此壳只保证导航期观感统一)
export default function SectorShell({ label, title, quote, desc }) {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 pt-20 text-center">
      <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">{label}</p>
      <SplitText
        text={title}
        tag="h1"
        className="font-santi text-5xl leading-tight md:text-7xl"
        delay={90}
        duration={1}
        from={{ opacity: 0, y: 50 }}
        to={{ opacity: 1, y: 0 }}
      />
      {quote && (
        <DecryptedText
          text={quote}
          className="font-santi text-base text-white/85 md:text-lg"
          encryptedClassName="font-tech text-base text-[#97c3ff]/50 md:text-lg"
          animateOn="view"
          sequential
          speed={60}
          characters="01三体智子乱紀元恒·+-×"
        />
      )}
      <p className="max-w-xl font-body text-sm leading-relaxed text-[#8A93A8] md:text-base">
        {desc}
      </p>
      <div className="mt-4 rounded-full border border-white/15 px-6 py-2 font-tech text-xs tracking-[0.4em] text-white/40">
        UNDER CONSTRUCTION · 建设中
      </div>
      <Link
        to="/"
        className="mt-8 font-tech text-sm tracking-[0.2em] text-[#97C3FF]/70 transition-colors hover:text-[#97C3FF]"
      >
        ← RETURN / 返回首页
      </Link>
    </section>
  );
}
