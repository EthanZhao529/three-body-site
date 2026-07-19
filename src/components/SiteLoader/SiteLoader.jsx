import { useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

// 首屏加载遮罩(2026-07-19 用户需求:结束后必须保证全站资源加载完毕、流畅预览,包括视频)。
// 门禁清单=六个模块的全部运行时资源(约47MB,含二向箔视频+水滴整页);
// fetch 流式读取按字节计进度,真实反映大文件下载;条目=[路径, 预估KB](拿到响应头后以真实大小替换)。
const ASSETS = [
  // 全站字体/首页
  ['css/fonts.css', 3],
  ['assets/wp/fonts/FZTieXHJW_Cu.TTF', 2519],
  ['assets/wp/fonts/Rajdhani-Medium.otf', 132],
  ['fonts/GlowSansSC-Wide-Heavy.subset.woff2', 151],
  ['fonts/Orbitron-var.subset.woff2', 7],
  ['assets/title.webp', 48],
  // 舰队
  ['fleet-bg.html', 1987],
  ['assets/captains/zhangbeihai.webp', 38],
  ['assets/captains/dongfangyanxu.webp', 34],
  ['assets/captains/chuyan.webp', 30],
  // 乱纪元
  ['assets/chaos/sunfire.webp', 1055],
  ['assets/chaos/starflight.webp', 822],
  ['assets/chaos/sunfire-alive.webp', 266],
  ['assets/chaos/starflight-alive.webp', 331],
  // 黑暗森林
  ['assets/wp/sky8k.webp', 212],
  ...['terra', 'trisolaris', 'singer', 'returners', 'ring', 'silicon',
    'dyson', 'blackdomain', 'gasgiant', 'mirror', 'sowers', 'watcher']
    .map(id => [`assets/civs/${id}.webp`, 52]),
  // 水滴(整页 iframe:html/css/js/three/后处理链/模型/纹理/字体)
  ['droplet.html?v=8', 6],
  ['css/droplet.css?v=8', 6],
  ['js/droplet.js?v=8', 29],
  ['js/vendor/three.module.js', 1243],
  ['js/vendor/jsm/postprocessing/EffectComposer.js', 5],
  ['js/vendor/jsm/postprocessing/RenderPass.js', 2],
  ['js/vendor/jsm/postprocessing/UnrealBloomPass.js', 12],
  ['js/vendor/jsm/postprocessing/Pass.js', 2],
  ['js/vendor/jsm/postprocessing/ShaderPass.js', 2],
  ['js/vendor/jsm/postprocessing/MaskPass.js', 2],
  ['js/vendor/jsm/shaders/CopyShader.js', 1],
  ['js/vendor/jsm/shaders/LuminosityHighPassShader.js', 1],
  ['assets/droplet/sd.bin', 8907],
  ['assets/droplet/uc.bin', 1713],
  ['assets/droplet/hc.bin', 11],
  ['assets/droplet/star.webp', 564],
  ['assets/droplet/ring.webp', 164],
  ['assets/droplet/doppler.webp', 1],
  ['assets/wp/clouds256.png', 60],
  ['assets/droplet/fonts/SairaCondensed-Thin.ttf', 150],
  ['assets/droplet/fonts/CormorantSC-Regular.ttf', 749],
  // 二向箔降维视频(最大件,门禁内保证进页即流畅播放)
  ['foil.mp4?v=2', 28171],
];

const MIN_SHOW = 900;     // 最短展示(ms),避免秒闪
const HARD_CAP = 120000;  // 兜底:网络异常最多等120s放行(正常网络远达不到)

export default function SiteLoader() {
  const [prog, setProg] = useState({ pct: 0, gotMB: 0, totMB: 0 });
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    let finished = false;
    // 每条:est=预估字节,total=响应头真实字节(未知前用est),got=已收字节,done
    const items = ASSETS.map(([path, kb]) => ({ path, est: kb * 1024, total: null, got: 0, done: false }));

    const snapshot = () => {
      let num = 0, den = 0;
      for (const it of items) {
        const t = it.total ?? it.est;
        den += t;
        num += it.done ? t : Math.min(it.got, t);
      }
      return { pct: den ? Math.min(100, Math.round((num / den) * 100)) : 100, gotMB: num / 1048576, totMB: den / 1048576 };
    };

    const finish = () => {
      if (!alive || finished) return;
      finished = true;
      const wait = Math.max(0, MIN_SHOW - (Date.now() - startRef.current));
      setTimeout(() => {
        if (!alive) return;
        setProg(p => ({ ...p, pct: 100 }));
        setLeaving(true);                                          // 淡出
        setTimeout(() => { if (alive) setGone(true); }, 750);
        fetch(BASE + 'assets/droplet/bgm.ogg', { cache: 'default' }).catch(() => {}); // BGM按需播,后台静默预取
      }, wait);
    };

    let doneCount = 0;
    const markDone = it => {
      if (it.done) return;
      it.done = true;
      doneCount += 1;
      if (doneCount >= items.length) finish();
    };

    items.forEach(async it => {
      try {
        const res = await fetch(BASE + it.path, { cache: 'default' });
        const cl = parseInt(res.headers.get('content-length') || '0', 10);
        if (cl > 0) it.total = cl;
        const reader = res.body && res.body.getReader ? res.body.getReader() : null;
        if (!reader) {
          await res.blob();
        } else {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            it.got += value.length;
          }
        }
      } catch { /* 单条失败不卡整站,按完成计 */ }
      if (alive) markDone(it);
    });

    const tick = setInterval(() => { if (alive && !finished) setProg(snapshot()); }, 150);
    const cap = setTimeout(finish, HARD_CAP);
    return () => { alive = false; clearInterval(tick); clearTimeout(cap); };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <p className="font-tech text-[11px] tracking-[0.6em] text-[#97c3ff]/60">TRISOLARIS · UNIVERSE</p>
      <h1 className="mt-3 select-none font-santi text-4xl text-white [text-shadow:0_0_28px_rgba(151,195,255,0.4)]">
        三体宇宙
      </h1>

      {/* 进度条 */}
      <div className="mt-10 h-[2px] w-[min(320px,70vw)] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${prog.pct}%`,
            background: 'linear-gradient(90deg,#97C3FF,#FFCBB1)',
            boxShadow: '0 0 12px rgba(151,195,255,0.8)',
          }}
        />
      </div>

      <div className="mt-4 flex w-[min(320px,70vw)] items-baseline justify-between font-tech text-[11px] tracking-[0.25em]">
        <span className="text-white/35">正在构建宇宙 · INITIALIZING</span>
        <span className="text-[#97C3FF]">{prog.pct}%</span>
      </div>
      <p className="mt-1.5 font-tech text-[10px] tracking-[0.2em] text-white/25">
        {prog.totMB ? `${prog.gotMB.toFixed(1)} / ${prog.totMB.toFixed(1)} MB` : ''}
      </p>
    </div>
  );
}
