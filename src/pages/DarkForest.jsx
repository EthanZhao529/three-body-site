import { useMemo, useRef, useState } from 'react';
import InfiniteMenu from '../components/InfiniteMenu/InfiniteMenu';

const BASE = import.meta.env.BASE_URL;

// 黑暗森林文明谱(每个=球体上一个格子;画像=用户 GPT 生成,public/assets/civs/<id>.webp)
// 提示词见交付说明;字段:名称/英文/坐标/发展阶段/科技等级/威胁度[名,色]/简介
const CIVS = [
  { id: 'terra', title: '地球文明', en: 'TERRA', coord: '[ 0.00, 0.00, 0.00 ]', stage: '行星文明', tech: 'K-0.73', threat: ['低', '#8fd9a8'], desc: '太阳系第三行星的碳基文明。刚刚点亮无线电,便向整个宇宙暴露了坐标——在黑暗森林里蹒跚学步的孩子。' },
  { id: 'trisolaris', title: '三体文明', en: 'TRISOLARIS', coord: '[ 4.37, -1.20, 0.80 ]', stage: '恒星际文明', tech: 'K-1.42', threat: ['极高', '#ff5a3c'], desc: '半人马座三星系统的文明,历经两百余次毁灭与重生。智子已锁死地球基础科学,星际舰队正在四光年外驶来。' },
  { id: 'singer', title: '歌者文明', en: 'THE SINGER', coord: '[ ∞, ∞, -9.0 ]', stage: '星系际清理者', tech: 'K-2.81', threat: ['极高', '#ff5a3c'], desc: '潜伏于宇宙深处的高等文明。随手抛出一片二向箔清理"感染源"——对它而言,毁灭一个文明只是日常的清理工作。' },
  { id: 'returners', title: '归零者', en: 'THE RETURNERS', coord: '[ ?, ?, ? ]', stage: '跨宇宙文明', tech: 'K-3.50', threat: ['未知', '#c39eff'], desc: '试图让整个宇宙归零、重启大爆炸的终极文明。在所有频段广播着回归田园时代的呼唤,等待质量回收。' },
  { id: 'ring', title: '魔戒', en: 'THE RING', coord: '[ 39.5, 0.00, 0.00 ]', stage: '高维观测者', tech: 'K-2.05', threat: ['高', '#ffa26a'], desc: '潜伏在冥王星轨道外的四维碎块残留文明。以冷漠的目光旁观低维世界的挣扎,偶尔留下无法理解的讯息。' },
  { id: 'silicon', title: '硅基集群', en: 'SILICON HIVE', coord: '[ -7.71, 2.08, 0.44 ]', stage: '机械文明', tech: 'K-1.10', threat: ['中', '#e8c66a'], desc: '抛弃血肉、以晶体计算矩阵为躯壳的机械集群。在红矮星旁筑起金属巢穴,以纳秒为思考的单位。' },
  { id: 'dyson', title: '戴森建造者', en: 'DYSON BUILDERS', coord: '[ 11.28, -0.02, 3.05 ]', stage: '能量文明', tech: 'K-1.63', threat: ['高', '#ffa26a'], desc: '用巨构包裹母星恒星、汲取每一缕光子的贪婪建造者。它们的天空里没有星辰,只有自己造物的阴影。' },
  { id: 'neutron', title: '中子星牧者', en: 'NEUTRON SHEPHERDS', coord: '[ 210.5, -3.16, 8.44 ]', stage: '简并态生命', tech: 'K-2.24', threat: ['高', '#ffa26a'], desc: '栖居于中子星表面的超致密文明,以磁场低语交流。一个念头跨越千年,寿命以亿年计,视人类如朝生暮死的微尘。' },
  { id: 'nomad', title: '曲率游牧', en: 'CURVATURE NOMADS', coord: '[ 移动中 ]', stage: '流浪舰队', tech: 'K-1.80', threat: ['中', '#e8c66a'], desc: '焚毁母星、乘曲率飞船永恒流浪的难民文明。不留航迹,不发信号,像黑暗森林里最警觉的猎人,沉默地掠过每一片星域。' },
  { id: 'blackdomain', title: '黑域隐者', en: 'BLACK DOMAIN', coord: '[ -1.06, 2.57, 7.25 ]', stage: '自囚文明', tech: 'K-1.55', threat: ['低', '#8fd9a8'], desc: '把家园周围的光速降到第三宇宙速度以下、将自己封进黑域的安全声明者。自愿放弃星辰大海,只为向宇宙宣告:我无害。' },
  { id: 'gasgiant', title: '风暴浮民', en: 'STORM DWELLERS', coord: '[ 0.93, 4.22, -1.37 ]', stage: '气态生命', tech: 'K-0.94', threat: ['低', '#8fd9a8'], desc: '漂浮于木星型行星风暴层的浮空生命。以电离层为神经,以飓风为诗篇,从不曾仰望自己厚厚云层之上的星空。' },
  { id: 'lightgrave', title: '光墓', en: 'THE LIGHT TOMB', coord: '[ 8.26, -0.47, -7.63 ]', stage: '文明遗迹', tech: 'K-2.60', threat: ['已逝', '#8a93a8'], desc: '一个被二向箔降维的文明遗骸。如今是一幅永远静止的二维画卷,以光速的速度飘向深空——它曾经也是猎人。' },
  { id: 'mirror', title: '镜面心智', en: 'MIRROR MINDS', coord: '[ 1.50, -0.25, 6.00 ]', stage: '拟态文明', tech: 'K-1.31', threat: ['中', '#e8c66a'], desc: '从不主动暴露自身,只反射邻居的信号。让每一个窥探它的文明,都以为自己看见了另一个自己——完美的黑暗森林伪装。' },
  { id: 'sowers', title: '播种者', en: 'THE SOWERS', coord: '[ 古老 ]', stage: '远古文明', tech: 'K-1.72', threat: ['未知', '#c39eff'], desc: '早已消亡的古老文明,却在银河各处播撒下休眠的生命种子。或许你我,都只是它某次实验里,一粒偶然发芽的孢子。' },
  { id: 'watcher', title: '瞭望者', en: 'THE WATCHER', coord: '[ -11.04, 4.84, 7.53 ]', stage: '监听文明', tech: 'K-1.20', threat: ['低', '#8fd9a8'], desc: '只听,不说。在冰冷的星际尘埃中架起无尽的天线,记录每一个文明诞生与熄灭的电波,自己却从不发出一个音节。' }
];

// 威胁颜色映射 → 卡片强调色边缘光
export default function DarkForest() {
  const bgRef = useRef(null);
  // items 引用必须稳定:否则 setActive 重渲染会让 InfiniteMenu 的 [items] effect 重跑→球体重建复位到第一张
  const items = useMemo(
    () => CIVS.map(c => ({ image: `${BASE}assets/civs/${c.id}.webp`, link: '', title: c.title, description: c.desc, meta: c })),
    []
  );
  const [active, setActive] = useState(CIVS[0]);

  const onMove = e => {
    const el = bgRef.current;
    if (!el) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    el.style.transform = `translate(${(-nx * 14).toFixed(1)}px, ${(-ny * 10).toFixed(1)}px)`;
  };

  return (
    <section className="relative h-dvh overflow-hidden bg-black" onMouseMove={onMove}>
      {/* 8K 星空背景(保留:呼吸+视差+暗角) */}
      <div ref={bgRef} className="absolute -inset-5 will-change-transform">
        <img
          src={`${BASE}assets/wp/sky8k.webp`}
          alt=""
          aria-hidden="true"
          className="bg-breathe h-full w-full select-none object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.62) 100%)' }}
      />

      {/* 文明球体(透明 canvas,露出星空;聚焦回调更新左上信息卡) */}
      <div className="absolute inset-0">
        <InfiniteMenu
          items={items}
          scale={2.9}
          showOverlay={false}
          onActiveChange={it => it?.meta && setActive(it.meta)}
        />
      </div>

      {/* 顶部标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex select-none flex-col items-center px-6 text-center [transform:translateZ(0)]">
        <p className="font-tech text-sm tracking-[0.6em] text-[#97c3ff]/70">DARK FOREST · 宇宙社会学</p>
        <h1 className="mt-2 font-santi text-4xl text-white md:text-5xl [text-shadow:0_0_24px_rgba(151,195,255,0.35)]">
          黑暗森林
        </h1>
        <p className="mt-3 font-tech text-xs tracking-[0.35em] text-[#97C3FF]/55">
          DRAG TO EXPLORE · 拖动球体,探测黑暗森林中的文明
        </p>
      </div>

      {/* 左上:聚焦文明信息卡(纯透明液玻,随球体停驻更新) */}
      <div className="pointer-events-none absolute left-5 top-40 z-20 w-[min(340px,82vw)] select-none md:left-8 md:top-44">
        <div
          key={active.id}
          className="liquid-glass route-elastic-up rounded-2xl px-5 py-4"
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), 0 0 30px ${active.threat[1]}22` }}
        >
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: active.threat[1] }} />
            <span className="font-tech text-[10px] tracking-[0.3em]" style={{ color: active.threat[1] }}>
              {active.en}
            </span>
          </div>
          <h2 className="mt-1.5 font-santi text-2xl text-white md:text-3xl">{active.title}</h2>
          <div className="mt-3 space-y-1 border-t border-white/10 pt-2.5 font-body text-xs">
            <p className="flex justify-between gap-4">
              <span className="text-white/40">发展阶段</span>
              <span className="text-[#c6d6ef]">{active.stage}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-white/40">科技等级</span>
              <span className="text-[#c6d6ef]">{active.tech}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-white/40">威胁评估</span>
              <span style={{ color: active.threat[1] }}>{active.threat[0]}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-white/40">坐标</span>
              <span className="font-tech text-[10px] text-[#5B86C9]">{active.coord}</span>
            </p>
          </div>
          <p className="mt-3 font-body text-xs leading-relaxed text-[#9db0cc]">{active.desc}</p>
        </div>
      </div>

      {/* 底部引文 */}
      <p className="pointer-events-none absolute inset-x-0 bottom-6 z-0 hidden select-none text-center font-body text-sm text-[#C6CDDB]/45 md:block">
        宇宙就是一座黑暗森林,每个文明都是带枪的猎人。
      </p>
    </section>
  );
}
