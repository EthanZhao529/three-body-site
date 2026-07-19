/* ============================================================
   水滴 · Droplet | Wallpaper Engine 壁纸 1:1 浏览器复刻(SYKM,workshopid 3470948192)
   一切参数移植自 scene.pkg 解码(桌面\水滴\水滴解析_事实底座.md):
   星流=星空图贴超长圆柱内壁(u绕圆周/v沿长度,星被拉伸~300倍)+scroll(速度平方)
   水滴=506122顶点纯镜面(albedo黑/metallic1/reflectivity1)+CubeCamera反射+两盏平行光
   多普勒=蓝红渐变球壳管 alpha=0.025 | godrays中心=水滴 颜色随音频蓝↔暖
   开场=黑幕7s(SYKM 0-4s/引言4-9s)→星流3-4.3s加速→8-9.3s水滴俯冲+白闪(×1.5→×6→×1.2)
   β=0.123−0.02·光标+0.01·sin(t) 驱动公式数字+隧道半径脉动
   调试:URL 加 #t=12 快进时钟;?movie=0 关开场
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from './vendor/jsm/postprocessing/Pass.js';

/* ==================== 用户配置(project.json 默认值) ==================== */
const CFG = {
  // ⭐站点实装(2026-07-13 用户需求):时间/日期/公式(坐标)模块全部关闭,开场关闭秒进
  clock: 'none',           // '12h' | '24h' | 'none'
  era: 'none',             // 'AD' 公元 | 'CE' 危机纪元 | 'SD' 水滴 | 'none'
  formula: false,          // 钟慢公式
  formulaOpacity: 0.2,     // 公式透明度
  cursorRotation: true,    // 光标控制旋转
  rx: 50, ry: 6,           // 关闭光标旋转时的固定偏航/俯仰(度)
  hdr: 0.3,                // HDR 亮度(泛光强度滑条)
  doppler: 0.012,          // 多普勒效应(2026-07-13:0.025→0.012,减弱蓝红罩的蓝)
  audioflashing: true,     // 音频闪烁(godrays+亮度脉动)
  rgb: false,              // RGB 效果
  rgbLow: [0.0824, 0, 1], rgbHigh: [1, 0, 0],
  movie: false,            // 开场动画(站点内嵌翻页流,秒进)
  ring: false,             // 尾部扩散光环
  ringColor: [0.2627, 0.6196, 1], ringBrightness: 5, ringPeriod: 0.5, ringSize: 0.002,
  px: 0, py: 0,            // 世界位置微调(壁纸滑条)
  cx: 0, cy: 0,            // 文字组位置微调
};
/* WE↔three 量纲标定(唯一允许手调的旋钮,逐项对照桌面壁纸) */
const CAL = {
  bloom: 4.0,        // WE bloomhdrstrength=0.3 → UnrealBloom strength = 0.3×此值(2026-07-19 八轮:3.0→4.0,封顶后能量有界,柔光更饱满)
  yawSign: -1,       // WE 偏航方向 ↔ three.js 旋向(左右手系差异)
  light: 2.2,       // WE 平行光 9.84/8.95 ×brightness4 → three 标定
  env: 8.0,          // 反射强度(2026-07-19 八轮:6→8,菲涅尔边缘高光更亮,轮廓照亮如 preview)
  rough: 0.08,       // 镜面锐化(0.45 磨砂→0.08 近纯镜面,根治塑料感;512 探针+mip 不露块)
  lookAtY: 0.05,     // 运行时相机注视点(scene.json camera.center 是编辑器残值,同 santi 教训;
                     // 依据=preview 里时钟与水滴同轴居中、水滴略低于中心)
  tunnel: 1.75,      // 圆柱材质亮度(2026-07-19 四轮定稿:1.45→1.75,星流亮度对齐壁纸 preview;嫌亮/暗只拧这一个)
  cubeBoost: 2.2,    // 反射探针里的隧道壁增亮(2026-07-19 八轮:1.6→2.2;方块真凶已证实是 bloom mip 过曝,GradePass 封顶后此值只管水滴反射亮度)
  cursorPx: 1.0,     // 光标像素→WE cursorWorldPosition 比例
  text: 1.0,         // 文字尺寸整体缩放
};

const qs = new URLSearchParams(location.search);
if (qs.get('movie') === '0') CFG.movie = false;
const T_OFF = parseFloat((location.hash.match(/t=([\d.]+)/) || [])[1] || 0);
const FREEZE = /freeze/.test(location.hash);   // #t=N&freeze:动画时钟钉死在 N 秒(无头验收用)

/* ==================== 渲染器/相机(scene.json 原值) ==================== */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // WE 同款 gamma 工作流
renderer.toneMapping = THREE.NoToneMapping;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
camera.position.set(-0.05628, 0.03727, 0.40262);
camera.lookAt(0, CAL.lookAtY, 0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

/* 旋转骨架 id55:所有 3D 挂它下面 */
const rig = new THREE.Group();
rig.position.set(CFG.px, CFG.py, 0);
scene.add(rig);

/* ==================== 资产加载 ==================== */
const texLoader = new THREE.TextureLoader();
function loadTex(url, wrap) {
  const t = texLoader.load(url);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
async function loadBin(url) {
  const r = await fetch(url);
  return await r.arrayBuffer();
}
function geoFromMSH1(buf) {   // 小模型:f32 pos/normal/uv + u32 idx
  const dv = new DataView(buf);
  const vc = dv.getUint32(4, true), ic = dv.getUint32(8, true);
  let o = 12;
  const pos = new Float32Array(buf, o, vc * 3); o += vc * 12;
  const nor = new Float32Array(buf, o, vc * 3); o += vc * 12;
  const uv  = new Float32Array(buf, o, vc * 2); o += vc * 8;
  const idx = new Uint32Array(buf, o, ic);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
function geoFromDRP1(buf) {   // 水滴:int16 量化 pos/normal + u32 idx
  const dv = new DataView(buf);
  const vc = dv.getUint32(4, true), ic = dv.getUint32(8, true);
  const hx = dv.getFloat32(12, true), hy = dv.getFloat32(16, true), hz = dv.getFloat32(20, true);
  let o = 24;
  const pq = new Int16Array(buf, o, vc * 3); o += vc * 6;
  const nq = new Int16Array(buf, o, vc * 3); o += vc * 6;
  const idx = new Uint32Array(buf, o, ic);
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
  for (let i = 0; i < vc; i++) {
    pos[i*3]   = pq[i*3]   / 32767 * hx;
    pos[i*3+1] = pq[i*3+1] / 32767 * hy;
    pos[i*3+2] = pq[i*3+2] / 32767 * hz;
    nor[i*3]   = nq[i*3]   / 32767;
    nor[i*3+1] = nq[i*3+1] / 32767;
    nor[i*3+2] = nq[i*3+2] / 32767;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/* ==================== 星流隧道(Hollow Cylinder) ==================== */
const starTex = loadTex('assets/droplet/star.webp', true);
let tunnel = null;
const Q_ROLL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)); // 局部Y→世界X
loadBin('assets/droplet/hc.bin').then(buf => {
  const mat = new THREE.MeshBasicMaterial({ map: starTex, side: THREE.DoubleSide, toneMapped: false });
  mat.color.setScalar(CAL.tunnel);
  tunnel = new THREE.Mesh(geoFromMSH1(buf), mat);
  tunnel.scale.set(1, 2000, 1);
  rig.add(tunnel);
});

/* ==================== 多普勒罩(uc) ==================== */
loadBin('assets/droplet/uc.bin').then(buf => {
  const mat = new THREE.MeshBasicMaterial({
    map: loadTex('assets/droplet/doppler.webp'),
    transparent: true, opacity: CFG.doppler, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  });
  mat.color.setScalar(0.5);              // 材质 Brigtness 0.5
  const uc = new THREE.Mesh(geoFromMSH1(buf), mat);
  uc.position.set(-7, 0, 0);
  uc.quaternion.copy(Q_ROLL);
  uc.scale.set(1, 200, 1);
  rig.add(uc);
});

/* ==================== 水滴(sd) ==================== */
const cubeRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
const cubeCam = new THREE.CubeCamera(0.01, 5000, cubeRT);
scene.add(cubeCam);

const droplet = new THREE.Group();          // 对象 id14
droplet.quaternion.setFromEuler(new THREE.Euler(Math.PI, -Math.PI / 2, Math.PI, 'XYZ'));
droplet.scale.setScalar(0.05);
rig.add(droplet);

let dropletMesh = null;
loadBin('assets/droplet/sd.bin').then(buf => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000, metalness: 0.0, roughness: CAL.rough,   // WE=黑albedo+菲涅尔反射(中心暗边缘亮),≠金属均匀镜面
    envMap: cubeRT.texture, envMapIntensity: CAL.env,
  });
  dropletMesh = new THREE.Mesh(geoFromDRP1(buf), mat);
  droplet.add(dropletMesh);
});

/* 两盏平行光(壁纸挂在水滴上;颜色/强度=解码值,方向=WE欧拉约定不明,按 preview 光斑位置标定:
   主灯下前方(照亮下缘轮廓+尾尖)、辅灯上后方(勾上缘细线) */
function addDirLight(pos, color, intensity) {
  const l = new THREE.DirectionalLight(color, intensity * CAL.light);
  l.position.set(...pos);
  rig.add(l);
  rig.add(l.target);
  return l;
}
addDirLight([2, 7, 9], new THREE.Color(1.0, 0.92549, 0.89412), 9.84);
addDirLight([-6, -9, -4], new THREE.Color(1.0, 0.91765, 0.87059), 8.95 * 0.5);

/* 光环(默认关) */
let ringSprite = null;
if (CFG.ring) {
  const rmat = new THREE.SpriteMaterial({
    map: loadTex('assets/droplet/ring.webp'), transparent: true,
    color: new THREE.Color(...CFG.ringColor), blending: THREE.AdditiveBlending, depthWrite: false,
  });
  ringSprite = new THREE.Sprite(rmat);
  ringSprite.position.set(0, 0, -1.7);
  droplet.add(ringSprite);
}

/* ==================== 缓动函数(壁纸脚本原式) ==================== */
const easeC = {   // 三点动画器用(cubic 族)
  linear: t => t,
  easeIn: t => t * t * t,
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};
const easeQ = {   // 文本淡入用(quadratic 族)
  linear: t => t,
  easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};
/* 三点两段动画器:t1 前保持 a,t1→t2 a→b,t2→t3 b→c,之后保持 c */
function anim3(t, t1, t2, t3, a, b, c, e1, e2) {
  if (t < t1) return a;
  if (t < t2) return a + (b - a) * easeC[e1]((t - t1) / (t2 - t1));
  if (t < t3) return b + (c - b) * easeC[e2]((t - t2) / (t3 - t2));
  return c;
}
/* 四点淡入淡出(线性) */
function fade4(t, t1, t2, t3, t4, v1, v2, v3, v4) {
  if (t < t1) return v1;
  if (t < t2) return v1 + (v2 - v1) * (t - t1) / (t2 - t1);
  if (t < t3) return v2 + (v3 - v2) * (t - t2) / (t3 - t2);
  if (t < t4) return v3 + (v4 - v3) * (t - t3) / (t4 - t3);
  return v4;
}
function fadeIn(t, t1, t2, ease) {
  if (t <= t1) return 0;
  if (t >= t2) return 1;
  return easeQ[ease]((t - t1) / (t2 - t1));
}

/* ==================== 后处理 ==================== */
const BLUR_OFF = [0.0, 1.4117647, 3.2941176, 5.1764706];
const BLUR_W = [0.19648255, 0.29690696, 0.0944704, 0.01038136];
const cloudsTex = loadTex('assets/wp/clouds256.png', true);

class GodraysPass extends Pass {
  constructor() {
    super();
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opt);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opt);
    this.uTime = { value: 0 };
    this.uColor = { value: new THREE.Color(0.52, 0.5, 0.47) };  // 静音默认改中性微暖淡(2026-07-13:原纯蓝致背景发蓝+白团,去蓝)
    /* pass1: 半分辨率降采样+阈值+云噪声(downsample2.frag 原式) */
    this.mDown = new THREE.ShaderMaterial({
      uniforms: {
        tD: { value: null }, tN: { value: cloudsTex }, uTime: this.uTime,
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD, tN; uniform float uTime;
        void main(){
          const float SPD=0.15, SCL=0.65, AMT=0.4, SMT=0.2, THR=0.1;
          vec2 n1=(vUv+uTime*SPD)*SCL;
          vec2 n2=vec2(-vUv.x*0.633+uTime*0.5*SPD, vUv.y*0.633-uTime*0.5*SPD)*SCL;
          float noise=texture2D(tN,n1).r*texture2D(tN,n2).r;
          float ns=mix(1.0, noise, AMT);
          vec3 c=texture2D(tD,vUv).rgb;
          float lum=dot(vec3(0.11,0.59,0.3), c);
          gl_FragColor=vec4(c*step(THR,lum), smoothstep(0.5-SMT,0.5+SMT,ns));
        }`,
    });
    /* pass2: 径向 cast(SAMPLES=1→50步,中心=水滴屏幕位) */
    this.mCast = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uColor: this.uColor, uCenter: { value: new THREE.Vector2(0.6016311, 1.0 - 0.28507793) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform vec3 uColor; uniform vec2 uCenter;
        void main(){
          const float LEN=0.04, INT=0.05, SINT=0.06;   // rayintensity(2026-07-13 二次:0.10→0.05,进一步收敛)
          vec2 dir=uCenter-vUv; float dist=length(dir); dir/=max(dist,1e-6);
          dist*=LEN; vec2 tc=vUv+dir*dist; vec2 st=dir*dist/49.0;
          vec4 acc=vec4(0.);
          for(int i=0;i<50;i++){ acc+=texture2D(tD,tc)*(float(i)/49.0); tc-=st; }
          gl_FragColor=vec4(INT*SINT*acc.rgb*uColor, clamp(INT*SINT*acc.a,0.,1.));
        }`,
    });
    /* pass3/4: blur13a 双向 */
    this.mBlur = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform vec2 uDir, uRes;
        void main(){
          vec2 px=uDir/uRes;
          vec4 c=texture2D(tD,vUv)*${BLUR_W[0]};
          c+=(texture2D(tD,vUv+px*${BLUR_OFF[1]})+texture2D(tD,vUv-px*${BLUR_OFF[1]}))*${BLUR_W[1]};
          c+=(texture2D(tD,vUv+px*${BLUR_OFF[2]})+texture2D(tD,vUv-px*${BLUR_OFF[2]}))*${BLUR_W[2]};
          c+=(texture2D(tD,vUv+px*${BLUR_OFF[3]})+texture2D(tD,vUv-px*${BLUR_OFF[3]}))*${BLUR_W[3]};
          gl_FragColor=c;
        }`,
    });
    /* pass5: 加色合成(BLENDMODE 9 线性减淡) */
    this.mComb = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, tRays: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD, tRays;
        void main(){
          vec4 base=texture2D(tD,vUv); vec4 rays=texture2D(tRays,vUv);
          base.rgb+=rays.rgb*rays.a;
          gl_FragColor=base;
        }`,
    });
    this.quad = new FullScreenQuad(this.mDown);
  }
  setSize(w, h) {
    // 2026-07-13:半分辨率(w>>1)导致 godrays 亮点降采样成方块伪影→改全分辨率消除方形炫光
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.mBlur.uniforms.uRes.value.set(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    const run = (mat, rt) => { this.quad.material = mat; renderer.setRenderTarget(rt); this.quad.render(renderer); };
    this.mDown.uniforms.tD.value = readBuffer.texture; run(this.mDown, this.rtA);
    this.mCast.uniforms.tD.value = this.rtA.texture; run(this.mCast, this.rtB);
    this.mBlur.uniforms.tD.value = this.rtB.texture; this.mBlur.uniforms.uDir.value.set(1, 0); run(this.mBlur, this.rtA);
    this.mBlur.uniforms.tD.value = this.rtA.texture; this.mBlur.uniforms.uDir.value.set(0, 1); run(this.mBlur, this.rtB);
    this.mComb.uniforms.tD.value = readBuffer.texture; this.mComb.uniforms.tRays.value = this.rtB.texture;
    run(this.mComb, this.renderToScreen ? null : writeBuffer);
  }
}

/* 色阶:入场白闪 × 音频亮度 × RGB tint —— color_grading TOOLS=0: rgb×(B+1) */
class GradePass extends Pass {
  constructor() {
    super();
    this.uB1 = { value: 0.2 };
    this.uB2 = { value: 0 };
    this.uTint = { value: new THREE.Color(1, 1, 1) };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uB1: this.uB1, uB2: this.uB2, uTint: this.uTint, uCap: { value: 12.0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform float uB1,uB2,uCap; uniform vec3 uTint;
        void main(){
          vec4 c=texture2D(tD,vUv);
          c.rgb*=(uB1+1.0)*(uB2+1.0);
          c.rgb*=uTint;
          c.rgb=min(c.rgb,vec3(uCap));   // 2026-07-19 六轮:HDR 封顶——水滴高光天文数字喂进 bloom 高层 mip 会被双线性放大成方块反光,封顶后辉光圆润(星流亮度<2 不受影响)
          gl_FragColor=c;
        }`,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.mat.uniforms.tD.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const godraysPass = new GodraysPass();
// 2026-07-13:方块炫光根治——godrays(音频体积光)彻底移除。静音时它只是从水滴高光爆出的
// 半分辨率方块伪影,无音乐时纯属多余;不 addPass 即可(对象保留供 frame 更新 uTime 不报错)
// composer.addPass(godraysPass);
const gradePass = new GradePass();
composer.addPass(gradePass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), CFG.hdr * CAL.bloom, 0.4, 1.0);  // 阈值 2.2→1.0/半径0.4(2026-07-19 七轮:轮廓高光+星流都进柔光,HDR 已封顶不会再炸方块)
composer.addPass(bloomPass);   // WE:scene HDR 泛光最后作用(效果层吃泛光前画面)

/* ==================== 音频(16 段频谱,WE 公式原样) ==================== */
const audio = new Audio();
audio.preload = 'none';                 // 3.7MB BGM 不随页面预载,点击播放时才拉
audio.src = 'assets/droplet/bgm.ogg';
audio.loop = true;
let analyser = null, freq = null;
const bands = new Float32Array(16);
document.getElementById('audioBtn').addEventListener('click', function () {
  if (audio.paused) {
    if (!analyser) {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser); analyser.connect(ctx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
    }
    audio.play(); this.classList.add('on');
  } else { audio.pause(); this.classList.remove('on'); }
});
function updateBands() {
  bands.fill(0);
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(freq);
    const per = Math.floor(freq.length / 16);
    for (let b = 0; b < 16; b++) {
      let s = 0;
      for (let i = 0; i < per; i++) s += freq[b * per + i];
      bands[b] = Math.min(s / per / 255 * 1.5, 1);
    }
  }
}
const clampB = v => Math.min(Math.max(v, 0.5), 0.8);

/* ==================== 屏幕文字(世界坐标投影摆放) ==================== */
const elEra = document.getElementById('eraLine');
const elClockWrap = document.getElementById('clockWrap');
const elClk = document.getElementById('clk');
const elAmpm = document.getElementById('ampm');
const elFormula = document.getElementById('formula');
const elBeta = document.getElementById('beta');
const elBlack = document.getElementById('blackout');
const elLogo = document.getElementById('logoSYKM');
const elQCN = document.getElementById('quoteCN');
const elQEN = document.getElementById('quoteEN');
const elTCN = document.getElementById('titleCN');
const elTEN = document.getElementById('titleEN');

function project(x, y, z) {   // 世界点 → CSS px
  const v = new THREE.Vector3(x, y, z).project(camera);
  return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
}
function layoutTexts() {
  const cx = CFG.cx, cy = CFG.cy;
  const clockOrigin = CFG.clock === '24h' ? [0, 0.15] : [0.02236, 0.14756];
  let p = project(clockOrigin[0] + cx, clockOrigin[1] + cy, 0);
  elClockWrap.style.left = p[0] + 'px'; elClockWrap.style.top = p[1] + 'px';
  p = project(-0.00433 + cx, 0.18302 + cy, 0);
  elEra.style.left = p[0] + 'px'; elEra.style.top = p[1] + 'px';
  p = project(0.012 + cx, 0.090 + cy, 0);   // 公式组中心(组178原点+子项摊开的几何中心)
  elFormula.style.left = p[0] + 'px'; elFormula.style.top = p[1] + 'px';
  /* 尺寸(按 preview.jpg 量取,vh 基准) */
  const vh = innerHeight / 100 * CAL.text;
  elClockWrap.style.fontSize = (6.7 * vh) + 'px';
  elEra.style.fontSize = (2.75 * vh) + 'px';
  elFormula.style.fontSize = (2.3 * vh) + 'px';
  elLogo.style.fontSize = (2.4 * vh) + 'px';
  elLogo.style.letterSpacing = '0.4em';
  // 引言组是屏幕合成层(z=0.5 在相机后,不能投影):按解码行距换算 vh 固定居中
  // 世界y→vh:0.0048世界≈1.26vh 行高 → 1世界≈262vh
  for (const [el, y, fs] of [[elQCN, 0.003, 1.55], [elQEN, -0.003, 1.5], [elTCN, -0.01768, 1.5], [elTEN, -0.02254, 1.35]]) {
    el.style.top = 'calc(50% + ' + (-y * 420).toFixed(2) + 'vh)';   // 行距系数按可读性放宽(解码262vh/世界)
    el.style.fontSize = (fs * vh) + 'px';
  }
}

const WEEK_MONTHS_SP = ['J a n u a r y','F e b r u a r y','M a r c h','A p r i l','M a y','J u n e','J u l y','A u g u s t','S e p t e m b e r','O c t o b e r','N o v e m b e r','D e c e m b e r'];
function updateClockTexts() {
  const now = new Date();
  if (CFG.clock === '24h') {
    elClk.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    elAmpm.textContent = '';
  } else if (CFG.clock === '12h') {
    let h = now.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    elClk.textContent = String(h).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    elAmpm.textContent = ap;
  } else { elClk.textContent = ''; elAmpm.textContent = ''; }
  if (CFG.era === 'AD') {
    elEra.textContent = `A . D .  ${String(now.getDate()).padStart(2, '0')}  .  ${WEEK_MONTHS_SP[now.getMonth()]}  .  ${now.getFullYear()}`;
  } else if (CFG.era === 'CE') {
    elEra.textContent = `C r i s i s  E r a :  Y e a r  -- ${now.getFullYear() - 2007} --`;
  } else if (CFG.era === 'SD') {
    elEra.textContent = `-- ${2212 - now.getFullYear()} --   Y e a r s   u n t i l   t h e   D r o p l e t   r e a c h e s   E a r t h`;
  } else elEra.textContent = '';
}

/* ==================== 光标交互(壁纸脚本原式) ==================== */
let curPx = 0, curPy = 0;     // 光标相对屏幕中心像素
let xx = 0, yy = 0;           // shared.xx / shared.yy
addEventListener('pointermove', e => {
  curPx = (e.clientX - innerWidth / 2) * CAL.cursorPx;
  curPy = (innerHeight / 2 - e.clientY) * CAL.cursorPx;
});

/* ==================== 主循环 ==================== */
const clock3 = new THREE.Clock();
let t0 = performance.now();
const D2R = Math.PI / 180;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(clock3.getDelta(), 0.1);
  const t = FREEZE ? T_OFF : (now - t0) / 1000 + T_OFF;     // engine.runtime
  const movie = CFG.movie;

  /* --- 光标平滑(obj01 原式,k=1000·ft/30) --- */
  const k = 1000 * dt / 30;
  xx += 0.15 * k * (curPx / 9000 - xx / 4) * 3;
  yy += 0.09 * k * (curPy / 9000 - yy / 4) * 3;

  /* --- 骨架角度(id55 angles 脚本原式,脚本单位=度) --- */
  let yawDeg, rzDeg;
  if (CFG.cursorRotation) {
    if (xx >= 5) yawDeg = 180;
    else if (xx <= -5) yawDeg = -180;
    else {
      const angx = 180 / Math.PI * Math.asin(xx / 5);
      yawDeg = 60 + (1.5 - Math.abs(xx / 5)) * angx * 0.7;
    }
    if (yy >= 3) rzDeg = -60;
    else if (yy <= -3) rzDeg = 60;
    else {
      const angy = 60 / Math.PI * Math.asin(yy / 3);
      rzDeg = 0 - (1.5 - Math.abs(yy / 5)) * angy * 0.7;   // 原作 /5 笔误照抄
    }
  } else { yawDeg = CFG.rx; rzDeg = CFG.ry; }
  rig.rotation.set(0, CAL.yawSign * yawDeg * D2R, CAL.yawSign * rzDeg * D2R);

  /* --- β 与隧道脉动(obj24 原式) --- */
  const beta = 0.123 - 0.02 * Math.max(-1, Math.min(1, xx / 5)) + 0.01 * Math.sin(t);
  elBeta.textContent = beta.toFixed(3);
  const vvv = beta + 0.6;
  const pulse = 1 - 2 * (vvv - 0.73) / 0.73;

  /* --- 星流滚动(scroll:速度平方×时间)+ 圆柱慢滚 --- */
  const sy = movie ? anim3(t, 3, 4, 4.3, -0.1, -0.43, -0.5, 'linear', 'easeOut') : -0.5;
  starTex.offset.y = Math.sign(sy) * sy * sy * t;
  if (tunnel) {
    tunnel.scale.set(pulse, 2000, pulse);
    const qSpin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (-0.1 * 1000 / 30 * t) * D2R, 0));
    tunnel.quaternion.copy(Q_ROLL).multiply(qSpin);   // 先自转(局部Y=隧道轴)再横置
  }

  /* --- 水滴入场(obj08 origin 脚本) --- */
  droplet.position.x = movie ? anim3(t, 8, 9, 9.3, 30, 0.2, 0, 'easeIn', 'easeOut') : 0;

  /* --- 光环(默认关) --- */
  if (ringSprite) {
    const ph = (t % CFG.ringPeriod) / CFG.ringPeriod;
    ringSprite.material.opacity = 1 - ph;
    const s = CFG.ringSize * ph * 1200;
    ringSprite.scale.set(s, s, 1);
    ringSprite.material.color.setRGB(...CFG.ringColor).multiplyScalar(CFG.ringBrightness);
  }

  /* --- 音频驱动(WE 公式原样) --- */
  updateBands();
  let sum = 0;
  for (let j = 0; j < 15; j++) sum += clampB(bands[j]);
  const sv = Math.max(0, Math.min(1, 6 * (sum / 15 - 0.5)));
  godraysPass.uColor.value.setRGB(
    0 + sv * (1 - 0), 0.01568 + sv * (0.62745 - 0.01568), 1 + sv * (0.54509 - 1));
  godraysPass.uTime.value = t;
  let b2 = 0;
  if (CFG.audioflashing) {
    let s2 = 0;
    for (let j = 5; j < 16; j++) s2 += clampB(bands[j]);
    b2 = 0.1 + 3 * (s2 - 0.5 * 10) / 10;
  }
  gradePass.uB2.value = b2;
  gradePass.uB1.value = movie ? anim3(t, 8.7, 9, 9.3, 0.5, 5, 0.2, 'linear', 'linear') : 0.2;
  if (CFG.rgb) {
    let s3 = 0;
    for (let j = 0; j < 15; j++) s3 += clampB(bands[j]);
    const sv3 = Math.max(0, Math.min(1, 3 * (s3 / 15 - 0.5)));
    gradePass.uTint.value.setRGB(
      CFG.rgbLow[0] + sv3 * (CFG.rgbHigh[0] - CFG.rgbLow[0]),
      CFG.rgbLow[1] + sv3 * (CFG.rgbHigh[1] - CFG.rgbLow[1]),
      CFG.rgbLow[2] + sv3 * (CFG.rgbHigh[2] - CFG.rgbLow[2]));
  }

  /* --- 反射立方体相机 --- */
  if (dropletMesh) {
    droplet.getWorldPosition(cubeCam.position);
    dropletMesh.visible = false;
    if (tunnel) tunnel.material.color.setScalar(CAL.tunnel * CAL.cubeBoost);
    cubeCam.update(renderer, scene);
    if (tunnel) tunnel.material.color.setScalar(CAL.tunnel);
    dropletMesh.visible = true;
  }

  /* --- 开场遮罩/署名/引言 --- */
  if (movie) {
    elBlack.style.opacity = anim3(t, 7, 8, 8, 1, 0, 0, 'easeOut', 'linear').toFixed(3);
    elLogo.style.opacity = fade4(t, 0, 1, 3, 4, 0, 1, 1, 0).toFixed(3);
    const q = fade4(t, 4, 5, 7, 9, 0, 1, 1, 0).toFixed(3);
    elQCN.style.opacity = q; elQEN.style.opacity = q;
    elTCN.style.opacity = q; elTEN.style.opacity = q;
  } else {
    elBlack.style.opacity = 0;
    elLogo.style.opacity = 0;
    elQCN.style.opacity = elQEN.style.opacity = elTCN.style.opacity = elTEN.style.opacity = 0;
  }

  /* --- 文字淡入(时钟/纪年 10→12s;公式 10.5→12.5s) --- */
  const fadeClock = movie ? fadeIn(t, 10, 12, 'linear') : 1;
  const fadeEra = movie ? fadeIn(t, 10, 12, 'easeInOut') : 1;
  const fadeF = movie ? fadeIn(t, 10.5, 12.5, 'easeInOut') : 1;
  elClockWrap.style.opacity = (CFG.clock === 'none' ? 0 : fadeClock * 1.0).toFixed(3);
  elEra.style.opacity = (CFG.era === 'none' ? 0 : fadeEra * 0.48).toFixed(3);
  elFormula.style.opacity = (CFG.formula ? fadeF * CFG.formulaOpacity / 0.2 * 0.2 : 0).toFixed(3);

  composer.render();
}

/* ==================== 尺寸/启动 ==================== */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
  layoutTexts();
}
addEventListener('resize', resize);
resize();
updateClockTexts();
setInterval(updateClockTexts, 1000);
requestAnimationFrame(t => { t0 = t; requestAnimationFrame(frame); });
