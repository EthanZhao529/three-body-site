import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Galaxy from './components/Galaxy/Galaxy';
import ClickSpark from './components/ClickSpark/ClickSpark';
import HudNav from './components/HudNav/HudNav';
import SplashCursor from './components/SplashCursor/SplashCursor';
import Home from './pages/Home';
import Fleet from './pages/Fleet';
import Chaos from './pages/Chaos';
import DarkForest from './pages/DarkForest';
import Droplet from './pages/Droplet';
import Foil from './pages/Foil';

// GitHub Pages 项目站点前缀(dev 与线上同为 /three-body-site)
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

// 站点级滚轮翻页顺序(模块之间翻页:首页⇄舰队⇄乱纪元⇄黑暗森林⇄水滴⇄二向箔)
const ROUTE_ORDER = ['/', '/fleet', '/chaos', '/dark-forest', '/droplet', '/2d-foil'];

// 路由切换回到页顶(SPA 默认保留滚动位置)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// 鼠标滚轮在模块之间翻页;若光标所在处页内还有可滚动内容(如舰队页舰长档案),
// 先让页内滚动,滚到尽头后下一次滚轮再翻模块
function WheelNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const locRef = useRef(location.pathname);
  locRef.current = location.pathname;

  useEffect(() => {
    let lock = false;
    const canScrollMore = (start, dy) => {
      for (let n = start; n && n !== document.body; n = n.parentElement) {
        if (!(n instanceof Element)) break;
        const ov = getComputedStyle(n).overflowY;
        // +40 阈值:route-fade 入场 translateY 会临时撑出 ~28px 假滚动区,须忽略
        if ((ov === 'auto' || ov === 'scroll') && n.scrollHeight > n.clientHeight + 40) {
          if (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true;
          if (dy < 0 && n.scrollTop > 1) return true;
        }
      }
      return false;
    };
    const flip = dy => {
      if (lock || Math.abs(dy) < 20) return;
      const idx = ROUTE_ORDER.indexOf(locRef.current);
      if (idx === -1) return;
      const next = idx + (dy > 0 ? 1 : -1);
      if (next < 0 || next >= ROUTE_ORDER.length) return;
      lock = true;
      navigate(ROUTE_ORDER[next]);
      setTimeout(() => {
        lock = false;
      }, 1100);
    };
    const onWheel = e => {
      if (e.ctrlKey) return;                       // 缩放手势放行
      const idx = ROUTE_ORDER.indexOf(locRef.current);
      if (idx === -1) return;
      if (Math.abs(e.deltaY) < 20) return;
      if (canScrollMore(e.target, e.deltaY)) return;
      e.preventDefault();
      flip(e.deltaY);
    };
    // iframe 页(舰队 2.5D/水滴复刻)内滚轮经 postMessage 转发到这里
    const onMsg = e => {
      if (e.data && e.data.type === 'tb-wheel') flip(e.data.deltaY);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('message', onMsg);
    };
  }, [navigate]);
  return null;
}

function Chrome() {
  const location = useLocation();
  // 翻页方向(下翻=新页从下方弹入,上翻=从上方弹入;导航点击也按路由序判向)
  const prevRef = useRef(location.pathname);
  const dirRef = useRef(1);
  if (prevRef.current !== location.pathname) {
    const a = ROUTE_ORDER.indexOf(prevRef.current);
    const b = ROUTE_ORDER.indexOf(location.pathname);
    dirRef.current = a === -1 || b === -1 || b >= a ? 1 : -1;
    prevRef.current = location.pathname;
  }

  // 空闲预取黑暗森林 8K 背景(已压至 ~210KB),进页前即缓存,消除首次加载等待
  useEffect(() => {
    const preload = () => {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}assets/wp/sky8k.webp`;
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(preload, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ClickSpark sparkColor="#FFCBB1" sparkRadius={22} sparkCount={8} duration={450}>
      {/* overflow-hidden:根容器不产生滚动(overflow-x-hidden 会隐式把 y 变 auto,干扰滚轮翻页判定) */}
      <div className="relative min-h-screen overflow-hidden bg-black text-white">
        {/* 深空背景(轻量星系;真·演算在 santi.html 独立页;黑暗森林页要纯黑不渲染) */}
        <div className="fixed inset-0 z-0">
          {location.pathname !== '/dark-forest' && (
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
          )}
        </div>

        {/* 顶部导航:舰桥 HUD(全站含首页) */}
        <HudNav />
        <SplashCursor DENSITY_DISSIPATION={3.5} VELOCITY_DISSIPATION={2} PRESSURE={0.1} CURL={3} SPLAT_RADIUS={0.2} SPLAT_FORCE={6000} COLOR_UPDATE_SPEED={10} SHADING RAINBOW_MODE={false} COLOR="#A855F7" />

        <main className="relative z-10">
          {/* 模块翻页过渡:按路径重挂,弹性入场(带方向) */}
          <div key={location.pathname} className={dirRef.current > 0 ? 'route-elastic-up' : 'route-elastic-down'}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/chaos" element={<Chaos />} />
              <Route path="/dark-forest" element={<DarkForest />} />
              <Route path="/droplet" element={<Droplet />} />
              <Route path="/2d-foil" element={<Foil />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </ClickSpark>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <ScrollToTop />
      <WheelNav />
      <Chrome />
    </BrowserRouter>
  );
}
