/* ============================================================
   三体实时演算 · Wallpaper Engine 壁纸 1:1 浏览器复刻
   物理/文明/界面逻辑全部移植自壁纸 scene.pkg 内嵌脚本(SYKM);
   参数取用户机器 project.json 与录屏一致的组合:
   随机初始 ±1/±0.05 · G=1.3275e-8 · 步长7.5e-4×每帧≤10步 ·
   逃逸DD=6→延时2s重启 · 引力牢笼关(录屏/T/T/D/D) · kt=10
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/jsm/postprocessing/ShaderPass.js';

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
// 引力牢笼(壁纸软牢笼,用户 project.json 参数:Mc=1.5e7,k1=0,re=0.1,k2=0.5,rc=0.2,n=2)
const CAGE_GM = G * 1.5e7, CAGE_K2 = 0.5, CAGE_RC = 0.2, CAGE_N = 2;

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
  // 引力牢笼:r>rc 时向质心回拉 k2·G·Mc·(r-rc)^n,防天体逃逸(壁纸软牢笼)
  const com = computeCOM();
  for (let i = 0; i < 4; i++) {
    const dx = B[i].x - com.x, dy = B[i].y - com.y, dz = B[i].z - com.z;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > CAGE_RC) {
      const mag = CAGE_K2 * CAGE_GM * Math.pow(r - CAGE_RC, CAGE_N) / Math.max(r, 1e-6);
      acc[i][0] -= mag * dx; acc[i][1] -= mag * dy; acc[i][2] -= mag * dz;
    }
  }
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

// 世界组:天体/轨迹/罗盘都在其中,旋转世界=壁纸的 applyRotation
const world = new THREE.Group();
world.rotation.order = 'YXZ';
scene.add(world);

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
const sunMap = texLoader.load('assets/wp/sun_gray.jpg');
sunMap.colorSpace = THREE.NoColorSpace;
const flareMap = texLoader.load('assets/wp/flare.png');
const glowSoft = glowTexture();

// 三星:染色标定自桌面截图,尺寸比 30:23:16(h1z/h2z/h3z),绝对值按桌面视占比标定
const SUNS = [
  { core: 0xffffff, glow: 0xeaf1ff, r: 0.100 },
  { core: 0xffa26a, glow: 0xffa26a, r: 0.077 },
  { core: 0xff6a48, glow: 0xff714f, r: 0.053 }
];
const suns = [];
for (let i = 0; i < 3; i++) {
  const t = SUNS[i];
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(t.r, 48, 32),
    new THREE.MeshBasicMaterial({ map: sunMap, color: t.core })
  );
  core.rotation.x = 0.4 * i;
  // sa3 光晕(壁纸自带贴图);大范围辉光交给 WE 同参的泛光
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareMap, color: t.glow, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9, rotation: i * 0.7
  }));
  flare.scale.setScalar(t.r * 7);
  g.add(core, flare);
  world.add(g);
  suns.push({ group: g, core, flare });
}
// 行星(0dq 贴图,发光色随温度:冻蓝↔灼红)
const earthMat = new THREE.MeshBasicMaterial({ map: texLoader.load('assets/wp/earth.jpg') });
const planetG = new THREE.Group();
const planetBall = new THREE.Mesh(new THREE.SphereGeometry(0.031, 32, 24), earthMat);
planetG.add(planetBall);
const pGlowMat = new THREE.SpriteMaterial({
  map: glowSoft, color: 0x96aabe, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45
});
const pGlow = new THREE.Sprite(pGlowMat);
pGlow.scale.setScalar(0.15);
planetG.add(pGlow);
world.add(planetG);
function planetTint(tem, out) {
  if (tem <= -100) { const k = Math.max(0, (tem + 210) / 110); out.setRGB(k, k, 1); }
  else if (tem >= 10) { const k = Math.min(1, (tem - 10) / 990); out.setRGB(1, 1 - k, 1 - k); }
  else out.setRGB(1, 1, 1);
  return out;
}

// 轨迹 ×4(加长至约23秒历史,颜色=project.json 天体颜色,桌面实机的长飘带感)
const TRAIL_N = 1400;
const TRAIL_COLS = [
  new THREE.Color(1, 1, 1),
  new THREE.Color(1, 0.839, 0.518),
  new THREE.Color(1, 0.62, 0.549),
  new THREE.Color(0.286, 0.604, 1)
];
const trailsData = [[], [], [], []];
const trailLines = [];
for (let i = 0; i < 4; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  line.frustumCulled = false;
  world.add(line);
  trailLines.push(geo);
}

// 尘埃粒子(壁纸 star1/star2 解码:尺寸0.1/0.07·计数0.5/1·亮度2·alpha0.95·
// 颜色(0.945,0.871,1)淡紫白·速度0.61·星星本身在 st2 贴图里,不另造)
const dustGroups = [];
function dustLayer(count, size) {
  const n = count, pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 3 + Math.random() * 14;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    vel[i * 3] = (Math.random() - 0.5) * 0.061;
    vel[i * 3 + 1] = (Math.random() - 0.5) * 0.061;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.061;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xf1defe, size, sizeAttenuation: true, map: glowSoft,
    transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  p.userData.vel = vel;
  scene.add(p);
  dustGroups.push(p);
}
dustLayer(40, 0.05);    // dust1:size 0.1 × count 0.5
dustLayer(80, 0.035);   // dust2:size 0.07 × count 1
function advanceDust(dt) {
  for (const p of dustGroups) {
    const pos = p.geometry.attributes.position.array, vel = p.userData.vel;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt;
      const d2 = pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2];
      if (d2 > 400) { pos[i] *= -0.9; pos[i + 1] *= -0.9; pos[i + 2] *= -0.9; }
    }
    p.geometry.attributes.position.needsUpdate = true;
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
  compass.add(mkRing(2.0, 128, 0x4a6a94, 0.6));           // 赤道环
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
// WE 内置 HDR 泛光(scene.general 解码:strength=4,scatter=2,threshold=0.46):
// threshold 原值;scatter→大半径;强度按桌面截图光晕标定(WE与Unreal强度量纲不同)
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 1.0, 0.46));

// godrays 移植(effects/godrays 解码:方向π·强度0.3·阈值0.45,含原版的噪声调制预处理)
const godraysPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.3 },
    uThreshold: { value: 0.45 }
  },
  vertexShader:
    'varying vec2 vUv;\n' +
    'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader:
    'varying vec2 vUv;\n' +
    'uniform sampler2D tDiffuse;\n' +
    'uniform float uTime;\n' +
    'uniform float uIntensity;\n' +
    'uniform float uThreshold;\n' +
    'float n2(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n' +
    'void main(){\n' +
    '  vec4 base = texture2D(tDiffuse, vUv);\n' +
    '  vec2 nd = vec2(0.0, -1.0);\n' +           // direction=π:光线向上蔓延
    '  float reach = 0.14;\n' +                  // 原版经降采样+双高斯后有效光程很短
    '  vec2 tc = vUv + nd * reach;\n' +
    '  vec2 stp = nd * reach / 23.0;\n' +
    '  vec3 rays = vec3(0.0);\n' +
    '  for (int i = 0; i < 24; i++) {\n' +
    '    vec3 s = max(texture2D(tDiffuse, tc).rgb - uThreshold, 0.0);\n' +
    '    tc -= stp;\n' +
    '    rays += s * (float(i) / 23.0);\n' +
    '  }\n' +
    // 原版 cast 前置噪声(amount0.4/scale3/speed0.15):光线碎化、缓慢流动
    '  float ns = 0.6 + 0.4 * n2(floor(vUv * 3.0 * 24.0) + floor(uTime * 0.15 * 24.0));\n' +
    '  base.rgb += rays * ns * uIntensity * 0.02;\n' +
    '  gl_FragColor = base;\n' +
    '}'
});
composer.addPass(godraysPass);

// 胶片颗粒(filmgrain.vert/frag 完整移植:双层连续滚动噪声纹理·通道错位·灰度相乘·
// scale=7·strength=0.15;混合取"黑处不变"的叠加族——原版 BLENDMODE 12 属 PS 叠加族)
// + CRT(0.03:荫罩 + 乘性静噪 0.49,黑处同样不变)
const noiseTex = (function () {
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const x = cv.getContext('2d');
  const d = x.createImageData(s, s);
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i] = Math.random() * 255;
    d.data[i + 1] = Math.random() * 255;
    d.data[i + 2] = Math.random() * 255;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
})();
const grainPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    tNoise: { value: noiseTex },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.15 },
    uCrt: { value: 0.03 }
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
    'uniform vec2 uRes;\n' +
    'uniform float uGrain;\n' +
    'uniform float uCrt;\n' +
    'float grey(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }\n' +
    'void main(){\n' +
    '  vec4 c = texture2D(tDiffuse, vUv);\n' +
    // filmgrain.vert 原式:uv1=(uv+t)·scale·(aspect,1), uv2=(uv−2.5t)·scale·0.52·(aspect,1)
    '  float t = fract(uTime);\n' +
    '  vec2 uv1 = (vUv + t) * 7.0 * vec2(uAspect, 1.0);\n' +
    '  vec2 uv2 = (vUv - t * 2.5) * 7.0 * 0.52 * vec2(uAspect, 1.0);\n' +
    // filmgrain.frag 原式:第二层取 .gbr 通道,灰度化后相乘
    '  float n1 = grey(texture2D(tNoise, uv1).rgb);\n' +
    '  float n2 = grey(texture2D(tNoise, uv2).gbr);\n' +
    '  float g = clamp(n1 * n2, 0.0, 1.0);\n' +
    // 叠加混合(黑处不变):base<0.5 → 2bg,否则 1−2(1−b)(1−g);按 strength 插值
    '  vec3 ov = mix(2.0 * c.rgb * g, 1.0 - 2.0 * (1.0 - c.rgb) * (1.0 - g), step(0.5, c.rgb));\n' +
    '  c.rgb = mix(c.rgb, ov, uGrain);\n' +
    // CRT:荫罩横纹 + 乘性静噪(振幅×0.49×0.03,黑处为零)
    '  float scan = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159);\n' +
    '  c.rgb *= 1.0 - uCrt * 0.5 * scan;\n' +
    '  float sn = texture2D(tNoise, vUv * uRes / 256.0 + t).r - 0.5;\n' +
    '  c.rgb *= 1.0 + sn * uCrt * 0.49;\n' +
    '  gl_FragColor = c;\n' +
    '}'
});
composer.addPass(grainPass);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth * DPR, innerHeight * DPR);
  grainPass.uniforms.uRes.value.set(innerWidth * DPR, innerHeight * DPR);
  grainPass.uniforms.uAspect.value = innerWidth / innerHeight;
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
addEventListener('pointermove', e => {
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
let bootSeq = null;   // {hold, done} 渲染循环驱动(定时器会被后台节流)
function runBootSequence(text, seconds, done, translucent) {
  bootStatus.textContent = text;
  boot.classList.toggle('seq', !!translucent);   // 重启=半透明罩(壁纸式),首启=全黑
  boot.classList.remove('gone');
  bootSeq = { hold: 0, secs: seconds, done };
}
function bootAdvance(dt) {
  if (!bootSeq) return;
  bootSeq.hold += dt;
  if (bootSeq.hold >= bootSeq.secs) {
    boot.classList.add('gone');
    const cb = bootSeq.done;
    bootSeq = null;
    if (cb) cb();
  }
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

  // 尘埃漂移(壁纸 speed=0.61 量级) + 后处理时间
  advanceDust(dt);
  grainPass.uniforms.uTime.value = runT;
  godraysPass.uniforms.uTime.value = runT;

  // 天体位置(质心系)
  for (let i = 0; i < 3; i++) {
    suns[i].group.position.set(B[i].x - com.x, B[i].y - com.y, B[i].z - com.z);
    suns[i].core.rotation.y = runT * 0.02 * (i + 1);
  }
  planetG.position.set(B[3].x - com.x, B[3].y - com.y, B[3].z - com.z);
  planetBall.rotation.y = runT * 0.3;
  const tmp = new THREE.Color();
  planetTint(civ.temp, tmp);
  earthMat.color.copy(tmp);
  pGlowMat.color.set(0x96aabe).lerp(tmp, 0.55);

  // 轨迹缓冲
  for (let i = 0; i < 4; i++) {
    const tr = trailsData[i], geo = trailLines[i];
    const n = tr.length;
    const pos = geo.attributes.position.array;
    const col = geo.attributes.color.array;
    const c = TRAIL_COLS[i];
    for (let j = 0; j < n; j++) {
      const p = tr[j];
      pos[j * 3] = p[0]; pos[j * 3 + 1] = p[1]; pos[j * 3 + 2] = p[2];
      const f = Math.pow(j / n, 1.3) * (i < 3 ? 1.0 : 0.9);
      col[j * 3] = c.r * f; col[j * 3 + 1] = c.g * f; col[j * 3 + 2] = c.b * f;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
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
runBootSequence('系统启动中', 2.8, () => setHud(true));
frame();
