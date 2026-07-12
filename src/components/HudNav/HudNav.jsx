import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DecryptedText from '../DecryptedText/DecryptedText';

const ITEMS = [
  { label: '首页', en: 'HOME', to: '/' },
  { label: '舰队', en: 'FLEET', to: '/fleet' },
  { label: '乱纪元', en: 'CHAOS', to: '/chaos' },
  { label: '黑暗森林', en: 'FOREST', to: '/dark-forest' },
  { label: '水滴', en: 'DROPLET', to: '/droplet' },
  { label: '二向箔', en: 'FOIL', to: '/2d-foil' }
];

// 悬停乱码重解(智子干扰风,同卡片标题)
const scramble = text => (
  <DecryptedText
    text={text}
    animateOn="hover"
    sequential
    speed={55}
    characters="01三体智子乱紀元恒·+-×"
    parentClassName="inline-block"
    encryptedClassName="text-[#97C3FF]/70"
  />
);

// 舰桥 HUD 导航:毛玻璃顶栏+角标+扫描线+乱码悬停+金色锁定+实时时钟;移动端全屏交错菜单
export default function HudNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 路由切换自动收起移动端菜单
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-30 select-none">
      <div className="relative flex h-12 items-center justify-between bg-gradient-to-b from-[#97C3FF]/[0.07] to-black/40 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md md:px-6">
        {/* 两端 HUD 角标 */}
        <span aria-hidden="true" className="absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 border-[#97C3FF]/60" />
        <span aria-hidden="true" className="absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 border-[#97C3FF]/60" />

        {/* 品牌 */}
        <Link to="/" className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse bg-[#FFA26A]" />
          <span className="font-santi text-base text-white">三体宇宙</span>
          <span className="hidden font-orbit text-[9px] font-bold tracking-[0.3em] text-[#97C3FF]/60 sm:inline">
            THREE-BODY
          </span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden items-center gap-1 lg:flex">
          {ITEMS.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className="group relative px-3 py-1 text-center">
                {active && (
                  <>
                    <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 border-l border-t border-[#FFA26A]" />
                    <span aria-hidden="true" className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-[#FFA26A]" />
                  </>
                )}
                <span
                  className={`block font-santi text-sm leading-tight ${
                    active ? 'text-[#FFCBB1]' : 'text-[#C6CDDB] group-hover:text-white'
                  }`}
                >
                  {scramble(item.label)}
                </span>
                <span
                  className={`block font-tech text-[8px] leading-tight tracking-[0.3em] ${
                    active ? 'text-[#FFA26A]/80' : 'text-[#97C3FF]/40'
                  }`}
                >
                  {item.en}
                </span>
              </Link>
            );
          })}
          {/* 实时演算:独立全屏页(金=行动) */}
          <a
            href="./santi.html"
            className="ml-3 flex items-center gap-2 border border-[#7A5A40]/70 px-3 py-1.5 transition-colors hover:border-[#FFA26A] hover:bg-[#0B0906]"
          >
            <span aria-hidden="true" className="h-1 w-1 animate-pulse bg-[#FFA26A]" />
            <span className="font-santi text-sm text-[#FFCBB1]">实时演算</span>
          </a>
        </nav>

        {/* 系统状态+时钟(超宽屏) */}
        <div className="hidden items-center gap-3 font-tech text-[10px] tracking-[0.2em] text-white/40 xl:flex">
          <span>SYS·ONLINE</span>
          <span className="w-[64px] text-[#97C3FF]">{clock}</span>
        </div>

        {/* 移动端菜单钮(信号条) */}
        <button
          type="button"
          aria-label="打开导航"
          onClick={() => setOpen(true)}
          className="flex flex-col items-end gap-1 p-2 lg:hidden"
        >
          <span className="h-px w-5 bg-[#97C3FF]" />
          <span className="h-px w-3.5 bg-[#97C3FF]/70" />
          <span className="h-px w-4 bg-[#97C3FF]/40" />
        </button>
      </div>
      {/* 底部扫描线 */}
      <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-[#97C3FF]/60 to-transparent" />

      {/* 移动端全屏菜单(交错入场) */}
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/95 backdrop-blur-md lg:hidden">
          <div className="flex h-12 items-center justify-between px-4">
            <span className="font-tech text-xs tracking-[0.4em] text-[#97C3FF]/60">NAVIGATION</span>
            <button
              type="button"
              aria-label="关闭导航"
              onClick={() => setOpen(false)}
              className="p-2 font-tech text-lg text-white/70"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-1 flex-col items-center justify-center gap-6 pb-16">
            {ITEMS.map((item, i) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="nav-stagger text-center"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className={`font-santi text-2xl ${active ? 'text-[#FFCBB1]' : 'text-white'}`}>
                    {item.label}
                  </span>
                  <span className="mt-0.5 block font-tech text-[10px] tracking-[0.4em] text-[#97C3FF]/50">
                    {item.en}
                  </span>
                </Link>
              );
            })}
            <a
              href="./santi.html"
              className="nav-stagger mt-2 border border-[#7A5A40] px-6 py-2.5 font-santi text-lg text-[#FFCBB1]"
              style={{ animationDelay: `${ITEMS.length * 70}ms` }}
            >
              三体实时演算 →
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
