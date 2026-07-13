// 二向箔 · 降维打击 —— 播放真实生成的降维大片(Seedance 出素材,剪映精修)。
// 视频 public/foil.mp4 全屏循环播放,叠简约 HUD(标题 + 引文),保持站点调性。
const BASE = import.meta.env.BASE_URL;

export default function Foil() {
  return (
    <section className="relative h-dvh select-none overflow-hidden bg-black">
      {/* 降维大片:全屏循环、静音自动播放(浏览器要求 muted 才自动播) */}
      <video
        src={`${BASE}foil.mp4`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 顶部标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center px-6 text-center [transform:translateZ(0)]">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">DUAL VECTOR FOIL · 降维打击</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          二向箔
        </h1>
      </div>

      {/* 底部引文 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 px-8 text-center">
        <p className="font-santi text-lg text-[#FFCBB1] md:text-xl [text-shadow:0_0_16px_rgba(255,163,90,0.4)]">
          毁灭你,与你何干。
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-[#C6CDDB]/55">
          给岁月以文明,而不是给文明以岁月 —— 太阳系的一切,都凝在了这幅降维的画里。
        </p>
      </div>
    </section>
  );
}
