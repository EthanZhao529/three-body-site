// 星际舰队:2.5D 视差舰队图(ComfyUI 产出,自包含 HTML 原样嵌入)+ HUD 覆盖层
// fleet-bg.html 自带鼠标视差/星闪/引擎灯/尾迹流光,iframe 保持指针事件以启用视差
export default function Fleet() {
  return (
    <section className="relative h-dvh overflow-hidden bg-[#02040c]">
      <iframe
        src={`${import.meta.env.BASE_URL}fleet-bg.html`}
        title="星际舰队 · 2.5D"
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* 顶部标题(不挡鼠标视差) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex select-none flex-col items-center px-6 pt-24 text-center">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">FLEET · 末日之战</p>
        <h1 className="mt-3 font-santi text-4xl text-white md:text-6xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          星际舰队
        </h1>
        <p className="mt-3 font-body text-sm text-[#C6CDDB]/75 md:text-base">
          两千余艘恒星级战舰列阵太空,人类最后的无敌舰队
        </p>
      </div>

      {/* 左下:引文 */}
      <div className="pointer-events-none absolute bottom-8 left-5 z-10 select-none md:bottom-10 md:left-8">
        <p className="font-santi text-base tracking-[2px] text-[#FFCBB1] md:text-lg [text-shadow:0_0_16px_rgba(255,162,106,0.35)]">
          前进!前进!!不择手段地前进!
        </p>
        <p className="mt-1 font-tech text-[10px] tracking-[0.3em] text-white/35">
          ADVANCE, BY ANY MEANS NECESSARY
        </p>
      </div>

      {/* 右下:舰队 HUD 读数 */}
      <div className="pointer-events-none absolute bottom-8 right-5 z-10 select-none text-right font-tech text-[11px] tracking-[0.2em] text-white/45 md:bottom-10 md:right-8">
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
