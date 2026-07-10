/* ============================================================
   三体实时演算 · Wallpaper Engine 壁纸 1:1 浏览器复刻
   物理/文明/界面逻辑全部移植自壁纸 scene.pkg 内嵌脚本(SYKM);
   参数取用户机器 project.json 与录屏一致的组合:
   随机初始 ±1/±0.05(xcxc=2/vcvc=0.1) · G=1.3275e-8 · 步长7.5e-4×每帧≤10步 ·
   逃逸DD=6→延时2s重启 · kt=10 ·
   镜头调度 gjz:0s起8s easeOutQuart 50→0(用户distance=0),稳态观距≈6
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/jsm/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from './vendor/jsm/postprocessing/Pass.js';

/* ==================== 物理引擎(壁纸原样) ==================== */
// 微缩系统:1单位长度=1e12m,1单位质量=1e30/5e6,1单位时间=1年
const G = 6.6743e-11 * (1e30 / 5e6) * Math.pow(3.1536e7, 2) / Math.pow(1e12, 3); // 1.3275e-8
const MASS = [5e6, 5e6, 5e6, 5000];
const TS = 0.75 / 1000;          // 固定物理步长
const MAX_STEPS = 10;            // 每帧步数上限(壁纸防螺旋死亡)
const RAS = 0.1, KSOFT = 2.8, KRAS = KSOFT * RAS;
const A_BETA = 3 / (KSOFT - 1), A_ALPHA = 1 - A_BETA;
const DD = 6;                    // 逃逸阈值(对质心)
const XC = 2, VC = 0.1;          // 随机初始:位置±1,速度±0.05

// Yoshida 1990 四阶辛积分系数
const Yw1 = 1.35120719196, Yw0 = -1.70241438392;
const Yc1 = Yw1 / 2, Yc2 = (Yw0 + Yw1) / 2, Yc3 = Yc2, Yc4 = Yc1;
const Yd1 = Yw1, Yd2 = Yw0, Yd3 = Yw1;

let B = [];                      // 四体:三星 + 行星
function resetSystem() {
  B = [];
  for (let i = 0; i < 4; i++) {
    B.push({
      x: (Math.random() - 0.5) * XC, y: (Math.random() - 0.5) * XC, z: (Math.random() - 0.5) * XC,
      vx: (Math.random() - 0.5) * VC, vy: (Math.random() - 0.5) * VC, vz: (Math.random() - 0.5) * VC
    });
  }
  for (let i = 0; i < 4; i++) trailsData[i].length = 0;
}
function computeCOM() {
  let mx = 0, my = 0, mz = 0, mm = 0;
  for (let i = 0; i < 4; i++) {
    mx += B[i].x * MASS[i]; my += B[i].y * MASS[i]; mz += B[i].z * MASS[i]; mm += MASS[i];
  }
  return { x: mx / mm, y: my / mm, z: mz / mm };
}
// Aarseth 分段线性软化引力
function accOn(i) {
  let ax = 0, ay = 0, az = 0;
  for (let j = 0; j < 4; j++) {
    if (j === i) continue;
    const dx = B[j].x - B[i].x, dy = B[j].y - B[i].y, dz = B[j].z - B[i].z;
    const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-5);
    const gm = G * MASS[j];
    let mag;
    if (d <= RAS) mag = gm * d / (RAS * RAS * RAS);
    else if (d < KRAS) mag = (A_ALPHA + A_BETA * d / RAS) * gm / (d * d);
    else mag = gm / (d * d);
    ax += mag * dx / d; ay += mag * dy / d; az += mag * dz / d;
  }
  return [ax, ay, az];
}
function drift(c) {
  for (let i = 0; i < 4; i++) {
    B[i].x += c * TS * B[i].vx; B[i].y += c * TS * B[i].vy; B[i].z += c * TS * B[i].vz;
  }
}
function kick(d) {
  const acc = [];
  for (let i = 0; i < 4; i++) acc.push(accOn(i));
  for (let i = 0; i < 4; i++) {
    B[i].vx += d * TS * acc[i][0]; B[i].vy += d * TS * acc[i][1]; B[i].vz += d * TS * acc[i][2];
  }
}
function yoshidaStep() {
  drift(Yc1); kick(Yd1); drift(Yc2); kick(Yd2); drift(Yc3); kick(Yd3); drift(Yc4);
}

/* ==================== 文明纪年系统(壁纸原样,用户参数) ==================== */
const CIV = {
  LK_D: 0.3, FX_D: 2.0, FX_T: -70, COLL_D: 0.2, ROCHE_D: 0.21,
  LOW_T: -100, HIGH_T: 200, STAB_LO: -55, STAB_HI: 70,
  K_TEMP_DIST: 7, SURVIVE_FRAMES: 50
};
const civ = {
  years: 0, count: 1, alive: false, startYear: 0, lastLife: 0, suit: 0,
  log: [], last: { roche: '', pc: '', lk: '', fx: '', sc: '' },
  era: '乱纪元', state: '脱水', temp: 0, d: [1, 1, 1]
};
function surfaceTemp(runtime) {
  const toAU = 1e12 / CIV.K_TEMP_DIST / 1.496e11;
  const L = [1.5, 0.5, 0.1], SIG = 5.67e-8;
  let flux = 0;
  for (let i = 0; i < 3; i++) {
    const dAU = Math.max(civ.d[i], 0.01) * toAU;
    flux += 1361 * L[i] / (dAU * dAU);
  }
  let alb = 0.3;
  const base = Math.pow(flux * 0.7 / (4 * SIG), 0.25) - 273.15;
  if (base < 0) alb = 0.3 + 0.3 * Math.min(1, -base / 20);
  let t = Math.pow(flux * (1 - alb) / (4 * SIG), 0.25) - 273.15 + 10 * Math.sin(runtime);
  return Math.max(-270, Math.min(1500, t));
}
let civEscaped = false;
function civAdvance(dt, runtime) {
  civ.years += dt;                                  // kt=10 → 1年/秒
  const year = Math.floor(civ.years);
  for (let i = 0; i < 3; i++) {
    const dx = B[i].x - B[3].x, dy = B[i].y - B[3].y, dz = B[i].z - B[3].z;
    civ.d[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  const dp = [];
  const prs = [[0, 1], [0, 2], [1, 2]];
  for (let i = 0; i < 3; i++) {
    const q = prs[i];
    const ex = B[q[0]].x - B[q[1]].x, ey = B[q[0]].y - B[q[1]].y, ez = B[q[0]].z - B[q[1]].z;
    dp.push(Math.sqrt(ex * ex + ey * ey + ez * ez));
  }
  civ.temp = surfaceTemp(runtime);

  const cs = { roche: '', pc: '', lk: '', fx: '', sc: '' };
  const roche = [], coll = [], sc = [];
  for (let i = 0; i < 3; i++) {
    if (civ.d[i] < CIV.ROCHE_D) roche.push('恒星' + (i + 1));
    else if (civ.d[i] < CIV.COLL_D) coll.push('恒星' + (i + 1));
  }
  if (roche.length) cs.roche = '大撕裂' + roche.join('、');
  if (coll.length) cs.pc = '行星与' + coll.join('、') + '相撞';
  let lkN = 0, fxN = 0;
  for (let i = 0; i < 3; i++) if (civ.d[i] < CIV.LK_D) lkN++;
  cs.lk = lkN === 3 ? '三日凌空' : lkN === 2 ? '双日凌空' : lkN === 1 ? '巨日凌空' : '';
  if (civ.temp < CIV.FX_T) for (let i = 0; i < 3; i++) if (civ.d[i] > CIV.FX_D) fxN++;
  cs.fx = fxN === 3 ? '三飞星' : fxN === 2 ? '双飞星' : fxN === 1 ? '飞星' : '';
  const scNames = ['恒星1与恒星2', '恒星1与恒星3', '恒星2与恒星3'];
  for (let i = 0; i < 3; i++) if (dp[i] < CIV.COLL_D) sc.push(scNames[i]);
  cs.sc = sc.join('，');

  const ev = [];
  let destroyed = '';
  function destroy(cause) {
    if (!civ.alive || destroyed) return;
    civ.alive = false;
    civ.lastLife = Math.max(0, year - civ.startYear);
    destroyed = cause;
    ev.push('第' + civ.count + '号文明毁灭于' + cause);
    civ.count++; civ.suit = 0;
  }
  if (civEscaped) { destroy('天体逃逸'); civEscaped = false; }
  if (cs.roche) destroy(cs.roche);
  if (cs.pc) destroy(cs.pc);
  if (cs.sc) destroy(cs.sc);
  if (civ.temp < CIV.LOW_T || civ.temp > CIV.HIGH_T)
    destroy(cs.lk || cs.fx || (civ.temp < CIV.LOW_T ? '低温' : '高温'));

  const suitable = civ.temp >= CIV.LOW_T && civ.temp <= CIV.HIGH_T;
  if (suitable) {
    civ.suit++;
    if (!civ.alive && civ.suit >= CIV.SURVIVE_FRAMES) {
      civ.alive = true; civ.suit = 0; civ.startYear = year;
      ev.push('第' + civ.count + '号文明启动');
    }
  } else civ.suit = 0;

  for (const k of ['roche', 'lk', 'fx', 'pc', 'sc']) {
    if (cs[k] !== civ.last[k]) {
      if (cs[k] && (civ.alive || ev.length) && ev.indexOf(cs[k]) < 0 && cs[k] !== destroyed)
        ev.unshift(cs[k]);
      civ.last[k] = cs[k];
    }
  }
  if (ev.length) {
    civ.log.unshift({ y: year, txt: '第' + year + '年，' + ev.join('，') });
    if (civ.log.length > 10) civ.log.pop();
  }
  civ.era = cs.lk || cs.fx ||
    (civ.temp >= CIV.STAB_LO && civ.temp <= CIV.STAB_HI ? '恒纪元' : '乱纪元');
  civ.state = civ.era === '恒纪元' ? '浸泡' : '脱水';
}

/* ==================== Three.js 场景 ==================== */
THREE.ColorManagement.enabled = false;
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
// 无色调映射:WE 是线性合成 + 泛光/后处理链(scene.general 解码)
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setClearColor(0x000000, 1);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
// scene.general 解码:fov=50,相机位 objects[140] z=6
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);

const texLoader = new THREE.TextureLoader();
// 天空盒00(scene.json 解码):st2 原图·亮度1·白色调制·绕Y -135°·静止(WebP:暗部无压缩噪)
const skyTex = texLoader.load('assets/wp/sky8k.webp');
skyTex.anisotropy = MAX_ANISO;
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(80, 64, 40),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
);
sky.rotation.y = -2.35619;
scene.add(sky);

// 世界组:天体/轨迹/罗盘都在其中,旋转世界=壁纸的 applyRotation;
// ⭐镜头调度(objects[22] 解码):shared.gjz 每帧被该脚本覆盖——
//   startTime=0,duration=8s,easeOutQuart,startValue=50 → endValue=用户distance=0
//   即启动时天体从 z=50(相机后方)冲入镜头,8 秒内缓动落定 z≈0,稳态观距≈6;
//   引擎里 gjz=-9 只是"未定义时兜底",运行时恒被镜头调度接管(此前钉死-9是误读)
const world = new THREE.Group();
world.rotation.order = 'YXZ';
scene.add(world);
function gjzNow() {
  return runT >= 8 ? 0 : 50 * Math.pow(1 - runT / 8, 4);
}
let curGJZ = 50;

function glowTexture() {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}
// 0aun 日面 × 米粒组织 mask(Material__50_mask alpha 通道,三星共用同一张,
// 均值0.843/范围0.44-1.0,同UV → 离线烘焙相乘;随 angles 随机游走呈"沸腾"质感)
const sunMap = texLoader.load('assets/wp/sun_em.webp');
sunMap.colorSpace = THREE.NoColorSpace;
sunMap.anisotropy = MAX_ANISO;
const flareMap = texLoader.load('assets/wp/sa3.png');   // 真·sa3(512²带alpha:细四芒星+柔圆晕,峰值α0.79)
const taMap = texLoader.load('assets/wp/ta.png');        // 轨迹点贴图(32²白色柔点,ta.tex 解码)
const glowSoft = glowTexture();

// 三星材质(Material__50.json 纯解码,审计第1条修正):
// generic4 双通道 = 受光albedo(color×brightness) + 自发光(emissive×emissivebrightness);
// 场景无任何光源且 ambientcolor=(0,0,0) → 受光通道输出≈0,盘面只剩自发光:
//   星1 (1,1,1)×1        = (1.00, 1.00, 1.00)
//   星2 (1,.73333,.60784)×2 = (2.00, 1.4667, 1.2157)
//   星3 (1,.51373,.37255)×2 = (2.00, 1.0275, 0.7451)
// (此前把两通道相加得 2.0/2.85/3.0 是错的——albedo 通道在无光场景是死通道)
// sa3 星芒尺寸=真值 512px×scale脚本(0.13×hNz)=1.997/1.531/1.065 世界单位
// (贴图大部分透明,可见星芒约占画布47% → 视觉≈0.94/0.72/0.50 世界)
const SUNS = [
  { hdr: [1.00, 1.0000, 1.0000], r: 0.0867, flareScale: 1.9968 },   // 半径=2.89×hNz
  { hdr: [2.00, 1.4667, 1.2157], r: 0.0665, flareScale: 1.5309 },   // (观距6下与桌面
  { hdr: [2.00, 1.0275, 0.7451], r: 0.0462, flareScale: 1.0650 }    //  星盘3.1vh锚定)
];
const SA3_TINT = 0xffcbb1;   // 三星同色 _16/_24/_33 = (1,0.796,0.694)
const SA3_BASE = new THREE.Color(1, 0.796, 0.694);   // pulse 呼吸的基色(每帧×tint)
// util/noise(WE 内置 256²)红通道 CPU 采样器 —— pulse.frag 对噪声贴图做的是
// 单点采样(uv 只随时间平移),等效于逐帧取一个标量;双线性+环绕与纹理采样一致
const noiseR = { w: 0, h: 0, data: null };
(function () {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c2 = cv.getContext('2d');
    c2.drawImage(img, 0, 0);
    const d = c2.getImageData(0, 0, img.width, img.height).data;
    noiseR.w = img.width; noiseR.h = img.height;
    noiseR.data = new Uint8Array(img.width * img.height);
    for (let i = 0; i < noiseR.data.length; i++) noiseR.data[i] = d[i * 4];
  };
  img.src = 'assets/wp/wenoise.png';
})();
function sampleNoiseR(u, v) {
  if (!noiseR.data) return 0;
  const w = noiseR.w, h = noiseR.h, d = noiseR.data;
  let x = (u * w) % w; if (x < 0) x += w;
  let y = (v * h) % h; if (y < 0) y += h;
  const x0 = Math.floor(x) % w, y0 = Math.floor(y) % h;
  const x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  const fx = x - Math.floor(x), fy = y - Math.floor(y);
  return (d[y0 * w + x0] * (1 - fx) * (1 - fy) + d[y0 * w + x1] * fx * (1 - fy) +
          d[y1 * w + x0] * (1 - fx) * fy + d[y1 * w + x1] * fx * fy) / 255;
}
const suns = [];
for (let i = 0; i < 3; i++) {
  const t = SUNS[i];
  const g = new THREE.Group();
  const sunMat = new THREE.MeshBasicMaterial({ map: sunMap });
  sunMat.color.setRGB(t.hdr[0], t.hdr[1], t.hdr[2]);   // >1:进 HDR 缓冲,泛光阈值0.46同 WE 语义
  const core = new THREE.Mesh(new THREE.SphereGeometry(t.r, 48, 32), sunMat);
  // sa3 星芒(审计#3:材质json blending="translucent"=普通混合,非加色;alpha 0.59,
  // 色调 _16=(1,.796,.694),不旋转;亮度受 pulse 效果呼吸调制(渲染循环内更新)
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareMap, color: SA3_TINT, transparent: true,
    depthWrite: false, opacity: 0.59
  }));
  flare.scale.setScalar(t.flareScale);
  g.add(core, flare);
  world.add(g);
  suns.push({ group: g, core, flare });
}
// 行星(球体04 解码:单位球 × scale 脚本=x1z 滑条 0.01 → 世界半径 0.01 真值;
// 发光色随温度冻蓝↔灼红=材质 emissive 脚本原样;无光晕精灵,辉光交给泛光)
const earthMat = new THREE.MeshBasicMaterial({ map: texLoader.load('assets/wp/earth.jpg') });
const planetG = new THREE.Group();
const planetBall = new THREE.Mesh(new THREE.SphereGeometry(0.01, 16, 12), earthMat);
planetG.add(planetBall);
world.add(planetG);
// OL 标注套件(scene.json objects[95-111] 完整解码):
// · 圈+引线贴图 OL.png(400×400 纯白线稿:圆环 91px 居画布正中心,折线引线至右上,
//   横线 y≈132 一直到画布右缘)→ 锚点即中心(0.5,0.5),不染色;
//   四边形世界尺寸 = 400px×scale:三星 0.003→1.2,行星 0.002→0.8
// · 两个独立文本层(systemfont_arial,pointsize 32,水平/垂直居中):
//   坐标行 白色,origin=天体+(0.4,0.24)[星]/(0.26,0.18)[行星],内容 "[x,y,z]"(toFixed(2),z 含动态 gjz)
//   标签行 datacolor #97C3FF,origin=+(0.4,0.17)/(0.26,0.11) → 横线正好夹在两行文本之间
//   字高 em = pointsize×scale×K,K=2.875 为唯一经验换算系数(标定自作者工坊截图
//   1600×900:两行间距 0.07 世界单位=16px ⇒ em=6.3px=0.0276 → 星 0.0368/行星 0.0276)
// · 显隐 = 悬停交互(纯色 depthtest 命中层 cursorEnter/Leave 解码):鼠标进入该天体
//   OL 四边形范围 → alpha 以 0.04×k(k=1000·ft/30)步进升至 0.5,移出后降回 0;
//   engine.runtime<5s 强制 0,runtime<3s 不淡出;dd(菜单开关)用户配置 menuinit=false
//   → 行星强显分支永不触发,四体均为悬停显示
// · 偏移叠加在旋转后的 xxN 上(屏幕对齐)→ 套件放静止组,每帧用世界旋转后的坐标驱动
const OL_TEX = texLoader.load('assets/wp/ui/OL.png');
const OL_LABELS = ['L/1st-Arm/3S-S1', 'L/1st-Arm/3S-S2', 'L/1st-Arm/3S-S3', 'L/1st-Arm/3S:1P'];
const OL_K = 2.875, OL_TAN = Math.tan(25 * Math.PI / 180);
const olGroup = new THREE.Group();     // 与 world 同 z(每帧=gjz),但不随拖拽/自旋旋转
scene.add(olGroup);
let olMouseX = -1e5, olMouseY = -1e5;
function olTextSprite(color, emWorld) {
  const cv = document.createElement('canvas');
  cv.width = 1280; cv.height = 144;    // 96px 字高画布,1.5 倍留行高
  const c2 = cv.getContext('2d');
  c2.font = '96px Arial';
  c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.fillStyle = color;
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false
  }));
  const h = emWorld * 144 / 96;        // 画布高→世界高
  spr.scale.set(h * 1280 / 144, h, 1);
  return { spr, cv, c2, tex };
}
const olKits = [];
for (let i = 0; i < 4; i++) {
  const star = i < 3;
  const quad = star ? 1.2 : 0.8;
  const em = 32 * (star ? 0.0004 : 0.0003) * OL_K;
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({
    map: OL_TEX, transparent: true, opacity: 0, depthWrite: false
  }));
  ring.scale.set(quad, quad, 1);
  const coord = olTextSprite('#ffffff', em);
  const label = olTextSprite('#97c3ff', em);
  label.c2.fillText(OL_LABELS[i], 640, 72);   // 标签静态,画一次
  label.tex.needsUpdate = true;
  olGroup.add(ring, coord.spr, label.spr);
  olKits.push({
    ring, coord, label, a: 0, lastDraw: 0, half: quad / 2,
    offCx: star ? 0.4 : 0.26, offCy: star ? 0.24 : 0.18,
    offLx: star ? 0.4 : 0.26, offLy: star ? 0.17 : 0.11
  });
}
window.__ol = olKits;                  // 调试句柄(无头验收用,不影响渲染)
const _olP = new THREE.Vector3(), _olV = new THREE.Vector3();
function updateOL(i, x, y, z, dt, now) {
  const k = olKits[i];
  // 悬停检测:天体投影到屏幕,命中区=OL 四边形(±half 世界单位,按视深折算像素)
  _olP.set(x, y, z + curGJZ).project(camera);
  const sx = (_olP.x + 1) / 2 * innerWidth, sy = (1 - _olP.y) / 2 * innerHeight;
  const halfPx = k.half * (innerHeight / 2) / (OL_TAN * (6 - z - curGJZ));
  k.sx = sx; k.sy = sy; k.halfPx = halfPx;    // 调试句柄(无头验收用)
  const hover = Math.abs(olMouseX - sx) <= halfPx && Math.abs(olMouseY - sy) <= halfPx;
  // alpha 脚本原式:step=0.04×k,k=1000·ft/30;<5s 强制 0;<3s 不淡出
  const step = 0.04 * 1000 * dt / 30;
  if (runT < 5) k.a = 0;
  else if (hover) k.a = Math.min(k.a + step, 0.5);
  else if (runT > 3) k.a = Math.max(k.a - step, 0);
  k.ring.material.opacity = k.a;
  k.coord.spr.material.opacity = k.a;
  k.label.spr.material.opacity = k.a;
  k.ring.position.set(x, y, z);
  k.coord.spr.position.set(x + k.offCx, y + k.offCy, z);
  k.label.spr.position.set(x + k.offLx, y + k.offLy, z);
  if (k.a > 0 && now - k.lastDraw > 150) {
    k.lastDraw = now;
    const c2 = k.coord.c2;
    c2.clearRect(0, 0, 1280, 144);
    c2.fillText('[' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + (z + curGJZ).toFixed(2) + ']', 640, 72);
    k.coord.tex.needsUpdate = true;
  }
}

function planetTint(tem, out) {
  if (tem <= -100) { const k = Math.max(0, (tem + 210) / 110); out.setRGB(k, k, 1); }
  else if (tem >= 10) { const k = Math.min(1, (tem - 10) / 990); out.setRGB(1, 1 - k, 1 - k); }
  else out.setRGB(1, 1, 1);
  return out;
}

// 轨迹 ×4(审计#4,引擎 createLayer 原式):点=models/ta.json 图层(ta.png 32px 白色柔点,
// 材质 blending="normal" 普通混合非加色);每帧一点,最多 trailLength=400;
// scale 尾0.0001→头0.0004(引擎 trailStartSize/trailEndSize 平文值)×32px
// = 世界直径 0.0032→0.0128(旧值 0.0333→0.0512 是按 256px halo+错观距推的,粗了4倍);
// alpha 尾0→头1 线性;颜色=project.json 四色
const TRAIL_N = 400;
const TRAIL_SIZE_A = 32 * 0.0001, TRAIL_SIZE_B = 32 * 0.0004;
const TRAIL_COLS = [
  new THREE.Color(1, 1, 1),
  new THREE.Color(1, 0.839, 0.518),
  new THREE.Color(1, 0.62, 0.549),
  new THREE.Color(0.286, 0.604, 1)
];
const trailsData = [[], [], [], []];
const trailPoints = [];
const TRAIL_VERT =
  'attribute float aT;\n' +
  'varying float vT;\n' +
  'uniform float uPxScale;\n' +
  'uniform float uSizeA;\n' +
  'uniform float uSizeB;\n' +
  'void main(){\n' +
  '  vT = aT;\n' +
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
  '  float sz = mix(uSizeA, uSizeB, aT);\n' +
  '  gl_PointSize = sz * uPxScale / max(-mv.z, 0.1);\n' +
  '  gl_Position = projectionMatrix * mv;\n' +
  '}';
const TRAIL_FRAG =
  'varying float vT;\n' +
  'uniform vec3 uColor;\n' +
  'uniform sampler2D uMap;\n' +
  'void main(){\n' +
  '  vec4 t = texture2D(uMap, gl_PointCoord);\n' +      // ta.png:白色柔点(alpha径向)
  '  gl_FragColor = vec4(uColor * t.rgb, t.a * vT);\n' + // 普通混合:色=层色,α=贴图α×轨迹α
  '}';
for (let i = 0; i < 4; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(TRAIL_N), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: TRAIL_COLS[i] },
      uMap: { value: taMap },
      uPxScale: { value: 1000 },
      uSizeA: { value: TRAIL_SIZE_A },
      uSizeB: { value: TRAIL_SIZE_B }
    },
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FRAG,
    transparent: true, depthWrite: false    // 材质json blending="normal"(默认普通混合)
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  world.add(pts);
  trailPoints.push({ geo, mat });
}

// 尘埃粒子(审计#5,particles/star.json + 对象24/25 实例覆盖全解码):
// · 发射器 sphererandom r10~14 × 对象scale(0.22/0.42) = 壳层 2.20~3.08 / 4.20~5.88 世界
// · 粒子尺寸 = sizerandom(0.1~2) × size覆盖(0.1/0.07) = 0.01~0.2 / 0.007~0.14 世界
// · 寿命 lifetimerandom 5~10s,alphafade 三角包络(WE 缺省 fadein/fadeout 各半)
// · 颜色 = colorrandom 暖粉(1,.769,.769)↔蓝白(.710,.812,1) 随机插值 × colorn × brightness
//   × 材质 halo_1 overbright 1.21:sys1 ×(0.945,0.871,1)×2  sys2 ×(0.639,0.529,0.686)×4
// · alpha 0.95 / 1.0;速度 velocityrandom 恒定(-0.1,0,0) × speed 0.61
// · 贴图 = WE 内置 particle/halo_2(64² 柔光点);材质 translucent 普通混合·不写深度
// · 计数 = maxcount200 × count覆盖(0.5/1) = 100/200(rate 远超上限→恒满员,亡即重生)
// · 母组 = MAIN 0-1(origin.z = 0.4×gjz,渲染循环同步);emitter 10°俯仰对各向同性壳无感,略
const haloMap = texLoader.load('assets/wp/halo_p.png');
const dustGroup = new THREE.Group();
scene.add(dustGroup);
const DUST_VERT =
  'attribute float aSize;\n' +
  'attribute float aAlpha;\n' +
  'attribute vec3 aColor;\n' +
  'varying float vA;\n' +
  'varying vec3 vC;\n' +
  'uniform float uPxScale;\n' +
  'void main(){\n' +
  '  vA = aAlpha; vC = aColor;\n' +
  '  vec4 mv = modelViewMatrix * vec4(position, 1.0);\n' +
  '  gl_PointSize = aSize * uPxScale / max(-mv.z, 0.1);\n' +
  '  gl_Position = projectionMatrix * mv;\n' +
  '}';
const DUST_FRAG =
  'varying float vA;\n' +
  'varying vec3 vC;\n' +
  'uniform sampler2D uMap;\n' +
  'void main(){\n' +
  '  vec4 t = texture2D(uMap, gl_PointCoord);\n' +
  '  gl_FragColor = vec4(vC * t.rgb, t.a * vA);\n' +
  '}';
const DUST_WARM = [1, 0.769, 0.769], DUST_COOL = [0.710, 0.812, 1];
const dustSystems = [];
// objScale:WE 对象 scale 作用于整个粒子系统坐标系——发射器/粒子尺寸/速度同缩
// (桌面实测为细小微粒,证实尺寸随缩;只缩发射器会得到 4~5 倍大的错误光团)
function dustSystem(n, rMin, rMax, sizeK, objScale, tint, bright, baseAlpha) {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alp = new Float32Array(n),
        col = new Float32Array(n * 3), birth = new Float32Array(n), life = new Float32Array(n);
  const spawn = (i, t0) => {
    const r = rMin + Math.random() * (rMax - rMin);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    size[i] = (0.1 + Math.random() * 1.9) * sizeK * objScale;
    const k = Math.random();
    for (let c = 0; c < 3; c++)
      col[i * 3 + c] = (DUST_WARM[c] + (DUST_COOL[c] - DUST_WARM[c]) * k) * tint[c] * bright * 1.21;
    birth[i] = t0;
    life[i] = 5 + Math.random() * 5;
    alp[i] = 0;
  };
  for (let i = 0; i < n; i++) {
    spawn(i, -Math.random() * 10);       // 初始铺满生命周期相位
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: haloMap }, uPxScale: { value: 1000 } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
    transparent: true, depthWrite: false          // halo_1: translucent + depthwrite disabled
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  dustGroup.add(p);
  dustSystems.push({ g, mat, n, spawn, birth, life, baseAlpha, objScale });
}
dustSystem(100, 2.20, 3.08, 0.1, 0.22, [0.945, 0.871, 1], 2, 0.95);       // star1
dustSystem(200, 4.20, 5.88, 0.07, 0.42, [0.639, 0.529, 0.686], 4, 1.0);   // star2
function advanceDust(dt) {
  for (const s of dustSystems) {
    const pos = s.g.attributes.position.array, alp = s.g.attributes.aAlpha.array;
    for (let i = 0; i < s.n; i++) {
      const age = runT - s.birth[i];
      if (age > s.life[i]) {
        s.spawn(i, runT);
        continue;
      }
      pos[i * 3] += -0.1 * 0.61 * s.objScale * dt;   // velocityrandom(-0.1,0,0)×speed0.61×系统scale
      const a = Math.max(0, age) / s.life[i];    // alphafade 三角包络
      alp[i] = s.baseAlpha * (a < 0.5 ? a * 2 : (1 - a) * 2);
    }
    s.g.attributes.position.needsUpdate = true;
    s.g.attributes.aAlpha.needsUpdate = true;
    s.g.attributes.aSize.needsUpdate = true;
    s.g.attributes.aColor.needsUpdate = true;
  }
}

// 罗盘/导航盘:仅按住鼠标时浮现(壁纸 c_down 逻辑)
const compass = new THREE.Group();
(function () {
  const mkRing = (r, segs, color, op) => {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false });
    return new THREE.Line(geo, m);
  };
  compass.add(mkRing(2.0, 128, 0x4a6a94, 0.6));           // 赤道环(角尺寸不变,按观距6缩回)
  const yAxis = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -2.3, 0), new THREE.Vector3(0, 2.3, 0)
  ]);
  compass.add(new THREE.Line(yAxis, new THREE.LineBasicMaterial({
    color: 0x28496f, transparent: true, opacity: 0.3, depthWrite: false
  })));
  // 刻度
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r1 = 2.0, r2 = i % 6 === 0 ? 2.12 : 2.06;
    const t = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1),
      new THREE.Vector3(Math.cos(a) * r2, 0, Math.sin(a) * r2)
    ]);
    compass.add(new THREE.Line(t, new THREE.LineBasicMaterial({
      color: 0x4a6a94, transparent: true, opacity: 0.6, depthWrite: false
    })));
  }
})();
compass.visible = false;
world.add(compass);
let compassA = 0;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// WE HDR 泛光(scene.general 原值,审计#2):threshold=0.46 + feather=0.88
// (宽软膝,直接写入 Unreal 高通的 smoothWidth → 亮度 0.46~1.34 平滑进入泛光),
// iterations=6/scatter=2 → radius=1.0 宽散射;strength 为 WE↔Unreal 唯一量纲标定值。
// 原自创 ACES(exposure1.15)色调映射已删——WE hdr 显示端为线性直出(clamp),
// 此前"盘面调亮2-3×再靠ACES压回"的补偿链一并废除
// ⚠️顺序:WE 的超后处理层(godrays/CRT/颗粒)是场景内图层,处理的是"泛光前"的画面;
// scene 级泛光作用于最终合成 → bloomPass 在 addPass 链的最末(见 grainPass 之后)
const BLOOM_STRENGTH = 0.7;
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, 1.0, 0.46);
bloomPass.highPassUniforms['smoothWidth'].value = 0.88;

// godrays(审计#6,effects/godrays 五 pass 源码逐行移植,pkg 自带 .frag/.vert):
// ① downsample2 → 半分辨率RT1:rgb×=a 后按 step(0.45, dot((0.11,0.59,0.3),rgb)) 硬阈值,
//    clouds_256 双旋转采样噪声调制 alpha:mix(a, a·n1·n2, 0.4) → smoothstep(0.5∓0.2)
// ② cast → RT2:CASTER=Directional,dir=rotate((0,-0.5), π−π),dist=0.5×raylength(1),
//    30 采样权重 i/29,输出 ×0.1×rayintensity(0.3)×color(1,1,1)
// ③④ godrays_gaussian blur7a(精确 4 tap 权重)X/Y,blurscale=2/半分辨率
// ⑤ combine:BLENDMODE9=BlendAdd → rgb = mix(base, min(base+rays,1), rays.a)
const cloudsTex = texLoader.load('assets/wp/clouds256.png');
cloudsTex.wrapS = cloudsTex.wrapT = THREE.RepeatWrapping;
const FSQ_VERT =
  'varying vec2 vUv;\n' +
  'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
class GodraysPass extends Pass {
  constructor() {
    super();
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt1 = new THREE.WebGLRenderTarget(1, 1, opt);   // _rt_HalfCompoBuffer1(scale 2)
    this.rt2 = new THREE.WebGLRenderTarget(1, 1, opt);   // _rt_HalfCompoBuffer2
    this.mDown = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tNoise: { value: cloudsTex }, uTime: { value: 0 }
      },
      vertexShader:
        'varying vec2 vUv;\n' +
        'varying vec4 vN;\n' +
        'uniform float uTime;\n' +
        'void main(){\n' +
        '  vUv = uv;\n' +
        // downsample2.vert 原式:xy=(uv+t·speed)·scale;wz=(uv.y,-uv.x)·0.633+(-t,t)·0.5·speed 再 ·scale
        '  vN.xy = (uv + uTime * 0.15) * 3.0;\n' +
        '  vN.w = (uv.y * 0.633 - uTime * 0.5 * 0.15) * 3.0;\n' +
        '  vN.z = (-uv.x * 0.633 + uTime * 0.5 * 0.15) * 3.0;\n' +
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n' +
        '}',
      fragmentShader:
        'varying vec2 vUv;\n' +
        'varying vec4 vN;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'uniform sampler2D tNoise;\n' +
        'void main(){\n' +
        '  vec4 s = texture2D(tDiffuse, vUv);\n' +
        '  float n1 = texture2D(tNoise, vN.xy).r;\n' +
        '  float n2 = texture2D(tNoise, vN.zw).r;\n' +
        '  float noiseSample = mix(s.a, s.a * n1 * n2, 0.4);\n' +
        '  s.rgb *= s.a;\n' +
        '  s.a = 1.0;\n' +
        '  vec4 o = s * step(0.45, dot(vec3(0.11, 0.59, 0.3), s.rgb));\n' +
        '  o.a *= smoothstep(0.3, 0.7, noiseSample);\n' +   // 0.5∓noisesmoothness(0.2)
        '  gl_FragColor = o;\n' +
        '}'
    });
    this.mCast = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: FSQ_VERT,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'void main(){\n' +
        '  vec2 dir = vec2(0.0, -0.5);\n' +      // rotateVec2((0,-0.5), direction−π)|direction=π
        '  float dist = length(dir);\n' +
        '  dir /= dist;\n' +
        '  dist *= 1.0;\n' +                     // × g_Length(raylength=1)
        '  vec2 tc = vUv + dir * dist;\n' +
        '  vec2 stp = dir * dist / 29.0;\n' +
        '  vec4 alb = vec4(0.0);\n' +
        '  for (int i = 0; i < 30; i++) {\n' +
        // 越界样本记零:防 RT clamp 把画面边缘亮点拖成无限长光柱(画面外无光语义)
        '    float inb = step(0.0, tc.x) * step(tc.x, 1.0) * step(0.0, tc.y) * step(tc.y, 1.0);\n' +
        '    alb += texture2D(tDiffuse, tc) * inb * (float(i) / 29.0);\n' +
        '    tc -= stp;\n' +
        '  }\n' +
        '  gl_FragColor = vec4(0.3 * 0.1 * alb.rgb, clamp(0.3 * 0.1 * alb.a, 0.0, 1.0));\n' +
        '}'
    });
    const mkBlur = vertical => new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uD: { value: new THREE.Vector2() } },
      vertexShader: FSQ_VERT,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'uniform vec2 uD;\n' +
        'void main(){\n' +                       // common_blur.h blur7a 原 tap
        '  gl_FragColor = texture2D(tDiffuse, vUv + 2.3515644035337887 * uD) * 0.2028175528299753\n' +
        '    + texture2D(tDiffuse, vUv + 0.469433779698372 * uD) * 0.4044856614512112\n' +
        '    + texture2D(tDiffuse, vUv - 1.4091998770852121 * uD) * 0.3213933537319605\n' +
        '    + texture2D(tDiffuse, vUv - 3.0 * uD) * 0.0713034319868530;\n' +
        '}'
    });
    this.mBlurX = mkBlur(false);
    this.mBlurY = mkBlur(true);
    this.mComb = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tRays: { value: null } },
      vertexShader: FSQ_VERT,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'uniform sampler2D tRays;\n' +
        'void main(){\n' +
        '  vec4 rays = texture2D(tRays, vUv);\n' +
        '  vec4 base = texture2D(tDiffuse, vUv);\n' +
        '  base.rgb = mix(base.rgb, min(base.rgb + rays.rgb, vec3(1.0)), rays.a);\n' +  // BlendAdd
        '  base.a = clamp(base.a + rays.a, 0.0, 1.0);\n' +
        '  gl_FragColor = base;\n' +
        '}'
    });
    this.fsQuad = new FullScreenQuad(null);
    this.uTime = 0;
  }
  setSize(w, h) {
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    this.rt1.setSize(hw, hh);
    this.rt2.setSize(hw, hh);
    this.mBlurX.uniforms.uD.value.set(2 / hw, 0);   // blurscale=2 / RT 分辨率
    this.mBlurY.uniforms.uD.value.set(0, 2 / hh);
  }
  render(renderer, writeBuffer, readBuffer) {
    const run = (mat, target) => {
      this.fsQuad.material = mat;
      renderer.setRenderTarget(target);
      this.fsQuad.render(renderer);
    };
    this.mDown.uniforms.uTime.value = this.uTime;
    this.mDown.uniforms.tDiffuse.value = readBuffer.texture;
    run(this.mDown, this.rt1);
    this.mCast.uniforms.tDiffuse.value = this.rt1.texture;
    run(this.mCast, this.rt2);
    this.mBlurX.uniforms.tDiffuse.value = this.rt2.texture;
    run(this.mBlurX, this.rt1);
    this.mBlurY.uniforms.tDiffuse.value = this.rt1.texture;
    run(this.mBlurY, this.rt2);
    this.mComb.uniforms.tDiffuse.value = readBuffer.texture;
    this.mComb.uniforms.tRays.value = this.rt2.texture;
    run(this.mComb, this.renderToScreen ? null : writeBuffer);
  }
}
const godraysPass = new GodraysPass();
composer.addPass(godraysPass);

// CRT(审计#6,workshop/2821337237 双 pass 源码逐行移植;用户配置:SHADOWMASK=3 Grid/
// Resolution 0.38/静噪 0.49/ARTIFACTS 0/BLACKBORDERS 0/曲率 0/边框(0,0)/亮度 1.5/
// 饱和度 1/Light bleed 1.62/Opacity 0.03):
// pass1 shadow_map → RT:网格荫罩(Grille=smoothstep(0,1,sin(x·π/2)+1.3) 行×列)+
//   逐格 hash 静噪 ×0.49(坐标=uv×0.38/texel,即 0.38×设备像素)
// pass2 crt_screen:baseAlbedo=效果前原画面,处理链=Light bleed(pow1.62+四邻0.05)→
//   暗角(1−|uv−0.5|)→ ×(亮度+亮度)=×3 → 最终 mix(原画面, 处理后, 0.03×base.a)
class CrtPass extends Pass {
  constructor() {
    super();
    this.rtS = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mShadow = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: FSQ_VERT,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tDiffuse;\n' +
        'uniform float uTime;\n' +
        'uniform vec2 uRes;\n' +
        'float hash(vec2 p){\n' +
        '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n' +
        '  p3 += dot(p3, p3.yzx + 33.33);\n' +
        '  return fract((p3.x + p3.y) * p3.z);\n' +
        '}\n' +
        'float Grille(float x){ return smoothstep(0.0, 1.0, sin(x * 1.5707963) + 1.3); }\n' +
        'float MaskRows(vec2 uv){\n' +
        '  uv.x *= 0.5; uv.x -= floor(uv.x);\n' +
        '  if (uv.x < 0.0) uv.y += 0.5;\n' +
        '  return Grille(uv.y);\n' +
        '}\n' +
        'float MaskCols(vec2 uv){\n' +
        '  uv.y *= 0.5; uv.y -= floor(uv.y);\n' +
        '  if (uv.y < 0.0) uv.x += 0.5;\n' +
        '  return Grille(uv.x);\n' +
        '}\n' +
        'void main(){\n' +
        '  vec4 albedo = texture2D(tDiffuse, vUv);\n' +
        '  vec2 pc = vUv * 0.38 * uRes;\n' +               // uv×Resolution/g_TexelSize
        '  albedo.rgb *= MaskCols(pc) * MaskRows(pc);\n' + // SHADOWMASK=3 Grid
        '  albedo.rgb *= 1.0 - hash(floor(pc + 0.5) + vec2(uTime)) * 0.49;\n' +
        '  gl_FragColor = albedo;\n' +
        '}'
    });
    this.mScreen = new THREE.ShaderMaterial({
      uniforms: { tOrig: { value: null }, tShadow: { value: null } },
      vertexShader: FSQ_VERT,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tOrig;\n' +
        'uniform sampler2D tShadow;\n' +
        'vec3 bleed(vec3 color, vec2 uv){\n' +             // crt_screen bloom():Light bleed 1.62
        '  color = pow(color, vec3(1.62));\n' +
        '  vec2 r = vec2(0.002, 0.0), u = vec2(0.0, 0.002);\n' +
        '  vec3 s = texture2D(tShadow, uv + u).rgb + texture2D(tShadow, uv - u).rgb\n' +
        '         + texture2D(tShadow, uv - r).rgb + texture2D(tShadow, uv + r).rgb;\n' +
        '  return pow(color + s * 0.05, vec3(1.0 / 1.62));\n' +
        '}\n' +
        'void main(){\n' +
        '  vec4 base = texture2D(tOrig, vUv);\n' +
        '  float opacity = 0.03 * base.a;\n' +
        // 曲率0/边框(0,0):z=sqrt(0.5),uvImage=(uv−0.5)/(z·1.414)+0.5,屏幕uv=(0,0)
        '  vec2 perspCoord = vUv - 0.5;\n' +
        '  float z = sqrt(0.5);\n' +
        '  vec2 uvImage = (vUv - 0.5) / (z * 1.414) + 0.5;\n' +
        '  vec3 c = bleed(texture2D(tShadow, uvImage).rgb, uvImage);\n' +
        '  c *= 1.0 - length(perspCoord);\n' +             // 暗角
        '  c *= 3.0;\n' +                                   // ×(brightness+brightness),1.5×2
        '  gl_FragColor = vec4(mix(base.rgb, c, opacity), base.a);\n' +
        '}'
    });
    this.fsQuad = new FullScreenQuad(null);
    this.uTime = 0;
  }
  setSize(w, h) {
    this.rtS.setSize(w, h);                                 // fbos scale=1 全分辨率
    this.mShadow.uniforms.uRes.value.set(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.mShadow.uniforms.uTime.value = this.uTime;
    this.mShadow.uniforms.tDiffuse.value = readBuffer.texture;
    this.fsQuad.material = this.mShadow;
    renderer.setRenderTarget(this.rtS);
    this.fsQuad.render(renderer);
    this.mScreen.uniforms.tOrig.value = readBuffer.texture;
    this.mScreen.uniforms.tShadow.value = this.rtS.texture;
    this.fsQuad.material = this.mScreen;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
}
const crtPass = new CrtPass();
composer.addPass(crtPass);

// 胶片颗粒(审计#6 修正:filmgrain.vert/frag 逐行,噪声=WE 内置 util/noise 贴图,
// GREYSCALE=1 权重 (0.11,0.59,0.3),BLENDMODE12=SoftLight(此前"叠加族"是猜的已纠),
// scale=7 / strength=0.15 / exponent=1;旧并入的 CRT 近似已拆出为独立精确双 pass)
const noiseTex = texLoader.load('assets/wp/wenoise.png');
noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
const grainPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    tNoise: { value: noiseTex },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uGrain: { value: 0.15 }
  },
  vertexShader:
    'varying vec2 vUv;\n' +
    'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:
    'varying vec2 vUv;\n' +
    'uniform sampler2D tDiffuse;\n' +
    'uniform sampler2D tNoise;\n' +
    'uniform float uTime;\n' +
    'uniform float uAspect;\n' +
    'uniform float uGrain;\n' +
    'float grey(vec3 c){ return dot(c, vec3(0.11, 0.59, 0.3)); }\n' +   // common.h greyscale
    'float sl(float b, float n){\n' +                                    // BlendSoftLightf 原式
    '  return (n < 0.5) ? (2.0 * b * n + b * b * (1.0 - 2.0 * n))\n' +
    '                   : (sqrt(b) * (2.0 * n - 1.0) + 2.0 * b * (1.0 - n));\n' +
    '}\n' +
    'void main(){\n' +
    '  vec4 c = texture2D(tDiffuse, vUv);\n' +
    // filmgrain.vert 原式:uv1=(uv+t)·scale·(aspect,1), uv2=(uv−2.5t)·scale·0.52·(aspect,1)
    '  float t = fract(uTime);\n' +
    '  vec2 uv1 = (vUv + t) * 7.0 * vec2(uAspect, 1.0);\n' +
    '  vec2 uv2 = (vUv - t * 2.5) * 7.0 * 0.52 * vec2(uAspect, 1.0);\n' +
    // filmgrain.frag 原式:第二层取 .gbr 通道,灰度化后相乘,pow(exponent=1)
    '  float n1 = grey(texture2D(tNoise, uv1).rgb);\n' +
    '  float n2 = grey(texture2D(tNoise, uv2).gbr);\n' +
    '  float g = clamp(n1 * n2, 0.0, 1.0);\n' +
    '  vec3 b = clamp(c.rgb, 0.0, 1.0);\n' +
    '  vec3 s = vec3(sl(b.r, g), sl(b.g, g), sl(b.b, g));\n' +
    '  c.rgb = mix(c.rgb, s, uGrain);\n' +
    '  gl_FragColor = c;\n' +
    '}'
});
composer.addPass(grainPass);
composer.addPass(bloomPass);   // WE:scene 泛光最后作用于合成结果(效果层吃的是泛光前画面)

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth * DPR, innerHeight * DPR);
  grainPass.uniforms.uAspect.value = innerWidth / innerHeight;
  // 点精灵透视尺寸:设备像素/世界单位(单位距离处)
  const pxScale = innerHeight * DPR / (2 * Math.tan(25 * Math.PI / 180));
  for (const t of trailPoints) t.mat.uniforms.uPxScale.value = pxScale;
  for (const s of dustSystems) s.mat.uniforms.uPxScale.value = pxScale;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ==================== 视角(壁纸模式0:仅按住拖拽,带惯性) ==================== */
let cDown = false, lastPX = 0, lastPY = 0;
let rotY = 0, rotX = 0, rotVelY = 0, recenter = false;
addEventListener('pointerdown', e => { cDown = true; recenter = false; lastPX = e.clientX; lastPY = e.clientY; });
addEventListener('pointerup', () => { cDown = false; });
addEventListener('pointerout', e => {          // 鼠标离开窗口 = cursorLeave
  if (!e.relatedTarget) { olMouseX = -1e5; olMouseY = -1e5; }
});
addEventListener('blur', () => { olMouseX = -1e5; olMouseY = -1e5; });
addEventListener('pointermove', e => {
  olMouseX = e.clientX; olMouseY = e.clientY;
  if (!cDown) return;
  rotVelY += (e.clientX - lastPX) / innerWidth * 10;   // 灵敏度(壁纸 senx=1 量级)
  rotX += (e.clientY - lastPY) / innerHeight * 60;
  rotX = Math.max(-30, Math.min(30, rotX));            // 壁纸:X轴限±30°
  lastPX = e.clientX; lastPY = e.clientY;
});

/* ==================== HUD ==================== */
const $ = id => document.getElementById(id);
const elLog = $('logBlock'), elEra = $('hEra'), elState = $('hState'), elTempV = $('hTempV');
const elYears = $('hYears');
const hud = $('hud');
let hudOn = false;
function setHud(on) { hudOn = on; hud.classList.toggle('on', on); }

$('recenterBtn').addEventListener('click', e => {
  e.stopPropagation();
  recenter = true;
});

let lastLogHtml = '', lastEra = '';
function updateHud() {
  if (civ.era !== lastEra) { elEra.textContent = civ.era; lastEra = civ.era; }
  elState.textContent = 'State : ' + civ.state;
  elTempV.textContent = civ.temp.toFixed(2);
  elYears.textContent = civ.years.toFixed(2) + ' Years';
  let html = '<div class="lg-head">' +
    (civ.alive ? '第' + civ.count + '号文明正在运行' : '文明无法生存') + '</div>' +
    '<div class="lg-sub">' +
    (civ.alive ? '文明已存活: ' + Math.max(0, Math.floor(civ.years) - civ.startYear) + '年'
               : '上个文明寿命: ' + civ.lastLife + '年') + '</div>';
  for (let j = 0; j < civ.log.length; j++) {
    const op = Math.max(0.18, 0.85 - j * 0.07);
    html += '<div style="opacity:' + op.toFixed(2) + '">' + civ.log[j].txt + '</div>';
  }
  if (html !== lastLogHtml) { elLog.innerHTML = html; lastLogHtml = html; }
}

/* ==================== 系统启动/重启遮罩 ==================== */
const boot = $('boot');
const bootStatus = $('bootStatus');
const spinnerEl = $('bootSpinner');
let spinDeg = 0, spinTick = 0;
let bootSeq = null;   // {hold, secs, fade, done} 渲染循环驱动(定时器会被后台节流)
// fade>0 时按壁纸黑底 obj112 原式:保持 secs 秒全黑 → smoothstep 淡出 fade 秒
// (原版:startTime=2s + fadeTime=3s,t=5s 才全透 —— 恰好盖住 gjz 冲镜段:
//  t≈3.3s 天体穿过相机平面时黑幕仍有约56%,清屏时 gjz≈1 天体已基本落位)
function runBootSequence(text, seconds, done, translucent, fade) {
  bootStatus.textContent = text;
  boot.classList.toggle('seq', !!translucent);   // 重启=半透明罩(壁纸式),首启=全黑
  boot.classList.remove('gone');
  if (fade) { boot.style.transition = 'none'; boot.style.opacity = '1'; }
  bootSeq = { hold: 0, secs: seconds, fade: fade || 0, done };
}
function bootAdvance(dt) {
  if (!bootSeq) return;
  bootSeq.hold += dt;
  const t = bootSeq.hold - bootSeq.secs;
  if (t < 0) return;
  if (t < bootSeq.fade) {
    const p = t / bootSeq.fade;
    boot.style.opacity = String(1 - p * p * (3 - 2 * p));   // smoothstep 淡出
    return;
  }
  boot.style.opacity = '';
  boot.style.transition = '';
  boot.classList.add('gone');
  const cb = bootSeq.done;
  bootSeq = null;
  if (cb) cb();
}

/* ==================== 逃逸重启(壁纸:tj→延时120帧→重启) ==================== */
let numSeq = 0;        // >0 = 重启序列进行中(帧计)
function checkEscape() {
  if (numSeq > 0) return;
  const com = computeCOM();
  for (let i = 0; i < 4; i++) {
    const dx = B[i].x - com.x, dy = B[i].y - com.y, dz = B[i].z - com.z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) > DD) { numSeq = 1; break; }
  }
}

/* ==================== 主循环 ==================== */
resetSystem();
let acc = 0, lastT = performance.now(), runT = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now; runT += dt;

  // 物理:固定步长 + 每帧≤10步(壁纸節奏)
  acc = Math.min(acc + dt, TS * MAX_STEPS);
  let steps = 0;
  while (acc >= TS && steps < MAX_STEPS) { yoshidaStep(); acc -= TS; steps++; }

  const com = computeCOM();

  // 逃逸检测 → 重启序列(120帧≈2s 时换宇宙,遮罩显示"系统重启中")
  checkEscape();
  if (numSeq > 0) {
    numSeq += dt * 60;
    if (numSeq >= 120 && numSeq - dt * 60 < 120) {
      civEscaped = true;
      resetSystem();
      runBootSequence('系统重启中', 2.6, null, true);
    }
    if (numSeq > 400) numSeq = 0;
  }

  // 轨迹(每帧一点,质心系,壁纸同款)
  for (let i = 0; i < 4; i++) {
    trailsData[i].push([B[i].x - com.x, B[i].y - com.y, B[i].z - com.z]);
    if (trailsData[i].length > TRAIL_N) trailsData[i].shift();
  }

  // 文明纪年
  civAdvance(dt, runT);

  // 视角:仅拖拽改变(弱惯性);回正=平滑归位;世界旋转,天空缓慢自转
  if (recenter) {
    const tgtY = Math.round(rotY / 360) * 360;
    const k = Math.min(1, dt * 5);
    rotY += (tgtY - rotY) * k;
    rotX += (0 - rotX) * k;
    rotVelY = 0;
    if (Math.abs(rotY - tgtY) < 0.1 && Math.abs(rotX) < 0.1) {
      rotY = tgtY; rotX = 0; recenter = false;
    }
  } else {
    rotY += rotVelY;
    if (!cDown) rotVelY *= 0.88;        // 弱惯性:松手快速停稳
    if (Math.abs(rotVelY) < 0.001) rotVelY = 0;
  }
  world.rotation.y = rotY * Math.PI / 180;
  world.rotation.x = (6 + rotX) * Math.PI / 180;

  // 镜头调度:gjz 每帧驱动世界深度(启动 8s 由 50 冲入,稳态 0 → 观距≈6)
  curGJZ = gjzNow();
  world.position.z = curGJZ;
  olGroup.position.z = curGJZ;
  dustGroup.position.z = 0.4 * curGJZ;   // 母组 MAIN 0-1:origin.z = 0.4×gjz

  // 尘埃推进 + 后处理时间
  advanceDust(dt);
  grainPass.uniforms.uTime.value = runT;
  godraysPass.uTime = runT;
  crtPass.uTime = runT;

  // 天体位置(质心系) + 随机游走自旋(壁纸 angles 脚本:k=1.5×1000×ft/30 度)
  const kTumble = Math.min(1.5 * 1000 * dt / 30, 3) * Math.PI / 180;
  for (let i = 0; i < 3; i++) {
    suns[i].group.position.set(B[i].x - com.x, B[i].y - com.y, B[i].z - com.z);
    suns[i].core.rotation.y += kTumble * Math.random();
    suns[i].core.rotation.x += kTumble * Math.random();
  }
  // sa3 pulse(pulse.frag 逐行移植,AUDIOPROCESSING=0/PULSECOLOR=1/BLENDMODE9=BlendAdd):
  //   pulse = smoothstep(0,1, sin(t·1.37 + (0−π/2))·0.5+0.5) × amount1
  //   noise = noiseTex((t/12, t/36)·0.35).r × 0.38 ;  pulse = (pulse+noise)^0.89
  //   rgb′ = mix(rgb×tintlow, rgb×tintlow + rgb×tinthigh, pulse) → 系数 = 0.1137 + 0.8235×pulse
  const ps0 = Math.sin(runT * 1.37 - 1.5707963) * 0.5 + 0.5;
  const psm = ps0 * ps0 * (3 - 2 * ps0);
  const pnz = sampleNoiseR(runT * 0.08333333 * 0.35, runT * 0.02777777 * 0.35) * 0.38;
  const pt = 0.1137 + 0.8235 * Math.pow(psm + pnz, 0.89);
  for (const s of suns) s.flare.material.color.copy(SA3_BASE).multiplyScalar(pt);
  planetG.position.set(B[3].x - com.x, B[3].y - com.y, B[3].z - com.z);
  planetBall.rotation.y += kTumble * Math.random();
  planetBall.rotation.x -= kTumble * Math.random();
  const tmp = new THREE.Color();
  planetTint(civ.temp, tmp);
  earthMat.color.copy(tmp);   // 行星=纯自发光×1(brightness=3 属受光死通道;此前×2.2 为手调已纠)

  // 轨迹缓冲(点精灵:位置 + 线性比例 aT,尺寸/透明度在 shader 内按原式插值)
  for (let i = 0; i < 4; i++) {
    const tr = trailsData[i], geo = trailPoints[i].geo;
    const n = tr.length;
    const pos = geo.attributes.position.array;
    const at = geo.attributes.aT.array;
    for (let j = 0; j < n; j++) {
      const p = tr[j];
      pos[j * 3] = p[0]; pos[j * 3 + 1] = p[1]; pos[j * 3 + 2] = p[2];
      at[j] = n > 1 ? j / (n - 1) : 1;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aT.needsUpdate = true;
  }

  // OL 标注(引擎语义:xxN=世界旋转后的质心系坐标,文本偏移屏幕对齐,显示 z 含动态 gjz)
  for (let i = 0; i < 4; i++) {
    _olV.set(B[i].x - com.x, B[i].y - com.y, B[i].z - com.z).applyEuler(world.rotation);
    updateOL(i, _olV.x, _olV.y, _olV.z, dt, now);
  }

  // 罗盘:按住浮现
  compassA += ((cDown ? 1 : 0) - compassA) * Math.min(1, dt * 5);
  compass.visible = compassA > 0.02;
  if (compass.visible) compass.traverse(o => {
    if (o.material) o.material.opacity = (o.userData.baseOp ||
      (o.userData.baseOp = o.material.opacity)) * compassA;
  });

  // 开机序列推进 + 加载环旋转(每5帧转30°,壁纸同款)
  bootAdvance(dt);
  if (!boot.classList.contains('gone')) {
    spinTick += dt * 60;
    if (spinTick >= 5) { spinTick = 0; spinDeg -= 30; spinnerEl.style.transform = 'rotate(' + spinDeg + 'deg)'; }
  }

  // HUD
  if (hudOn) updateHud();

  composer.render();
}
// 首次进入:系统启动中
runBootSequence('系统启动中', 2, () => setHud(true), false, 3);   // 黑底原时序:2s保持+3s淡出
frame();
