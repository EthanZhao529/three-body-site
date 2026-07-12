const BASE = import.meta.env.BASE_URL;

// 水滴:壁纸复刻页实装(droplet.html——光速星流隧道+纯镜面水滴,SYKM 壁纸解包重建;
// 时钟/纪年/公式模块已按需求关闭)。iframe 保留指针交互(光标旋转/BGM 按钮),
// 滚轮由页内脚本 postMessage 转发给主站 WheelNav 完成模块翻页
export default function Droplet() {
  return (
    <section className="relative h-dvh overflow-hidden bg-black">
      <iframe
        src={`${BASE}droplet.html`}
        title="水滴 · Droplet"
        className="absolute inset-0 h-full w-full border-0"
      />

      {/* 标题(左上,水滴主体在画面右侧) */}
      <div className="pointer-events-none absolute left-6 top-24 z-10 select-none md:left-10">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">
          DROPLET · 强互作用力探测器
        </p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          水滴
        </h1>
        <p className="mt-2 font-body text-xs text-[#C6CDDB]/75 md:text-sm">
          绝对光滑的全反射镜面,倒映着光速掠过的星海
        </p>
      </div>

      {/* 左下:读数(无时间/坐标模块) */}
      <div className="pointer-events-none absolute bottom-8 left-5 z-10 select-none font-tech text-[11px] tracking-[0.2em] text-white/45 md:left-8">
        <p>
          PROBE · <span className="text-[#97C3FF]">强互作用力宇宙探测器</span>
        </p>
        <p className="mt-1">
          SURFACE · <span className="text-[#97C3FF]">绝对光滑 全反射镜面</span>
        </p>
        <p className="mt-1">
          威胁评估 · <span className="text-[#8fd9a8]">无害 —— 舰队联席会议判定</span>
        </p>
      </div>

      {/* 右下:壁纸原作署名(BGM 按钮在 iframe 内右下上方) */}
      <p className="pointer-events-none absolute bottom-3 right-4 z-10 select-none font-tech text-[9px] tracking-[0.25em] text-white/25">
        WALLPAPER ORIGINAL · SYKM
      </p>
    </section>
  );
}
