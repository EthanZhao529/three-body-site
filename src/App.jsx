import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Galaxy from './components/Galaxy/Galaxy';
import ClickSpark from './components/ClickSpark/ClickSpark';
import GooeyNav from './components/GooeyNav/GooeyNav';
import Home from './pages/Home';
import Fleet from './pages/Fleet';
import Chaos from './pages/Chaos';
import DarkForest from './pages/DarkForest';
import Droplet from './pages/Droplet';
import Foil from './pages/Foil';

// GitHub Pages 项目站点前缀(dev 与线上同为 /three-body-site)
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

// 全站分区(导航顺序=叙事顺序;演算是独立全屏页,由 Hero 按钮/演算大卡进入,不进路由)
const SECTORS = [
  { label: '首页', to: '/' },
  { label: '舰队', to: '/fleet' },
  { label: '乱纪元', to: '/chaos' },
  { label: '黑暗森林', to: '/dark-forest' },
  { label: '水滴', to: '/droplet' },
  { label: '二向箔', to: '/2d-foil' }
];

// 导航粒子用色:蓝为主(信息层)+一点金,与 ClickSpark 呼应
const NAV_COLORS = {
  '--color-1': '#97C3FF',
  '--color-2': '#5B86C9',
  '--color-3': '#FFCBB1',
  '--color-4': '#FFFFFF'
};

// 路由切换回到页顶(SPA 默认保留滚动位置)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Chrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeIndex = Math.max(0, SECTORS.findIndex(s => s.to === location.pathname));

  return (
    <ClickSpark sparkColor="#FFCBB1" sparkRadius={22} sparkCount={8} duration={450}>
      <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
        {/* 深空背景(轻量星系;真·演算在 santi.html 独立页;黑暗森林页要纯黑不渲染) */}
        <div className="fixed inset-0 z-0">
          {location.pathname !== '/dark-forest' && <Galaxy
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
          />}
        </div>

        {/* 顶部导航:GooeyNav 与路由双向同步(首页为无 UI 沉浸屏,不展示) */}
        {location.pathname !== '/' && (
          <header className="fixed inset-x-0 top-0 z-30 flex justify-center border-b border-white/5 bg-black/30 py-2.5 backdrop-blur-sm">
            <div className="max-w-full overflow-x-auto px-2 font-santi text-sm" style={NAV_COLORS}>
              <GooeyNav
                items={SECTORS.map(s => ({ label: s.label, href: `${BASENAME}${s.to}` }))}
                activeIndex={activeIndex}
                initialActiveIndex={activeIndex}
                onNavigate={i => {
                  if (SECTORS[i].to !== location.pathname) navigate(SECTORS[i].to);
                }}
                particleCount={12}
                particleDistances={[70, 10]}
                animationTime={500}
              />
            </div>
          </header>
        )}

        <main className="relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/chaos" element={<Chaos />} />
            <Route path="/dark-forest" element={<DarkForest />} />
            <Route path="/droplet" element={<Droplet />} />
            <Route path="/2d-foil" element={<Foil />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* ===== 页脚(首页为单屏沉浸布局,不展示) ===== */}
        {location.pathname !== '/' && (
          <footer className="relative z-10 border-t border-white/10 px-6 py-10 text-center">
            <p className="font-body text-sm text-[#ffcbb1]/60">给岁月以文明,而不是给文明以岁月。</p>
            <p className="mt-2 font-tech text-xs tracking-[0.3em] text-white/30">
              © 2026 THREE-BODY · SITE
            </p>
          </footer>
        )}
      </div>
    </ClickSpark>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <ScrollToTop />
      <Chrome />
    </BrowserRouter>
  );
}
