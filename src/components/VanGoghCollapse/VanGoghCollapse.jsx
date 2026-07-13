import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 二向箔 · 梵高《星空》流体降维(GLSL fragment shader,电影级)
// 静默的三维深空 → 投放二向箔 → 一道二维化前沿从中心扫过 → 空间被卷成一幅流动的梵高星空:
// domain-warping 流体漩涡笔触、明亮星核同心光晕、蓝金配色、辉光。progress 控制前沿。
// onPhase 报三态 space|collapsing|plane;onReady 交出 { collapse, restore }。

const VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uProgress;   // 0=静默深空, 1=完整梵高星空巨画
  uniform vec2  uRes;

  // ---- 噪声 / fbm ----
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  const mat2 M2 = mat2(1.6,1.2,-1.2,1.6);
  float fbm(vec2 p){
    float v=0.0, a=0.55;
    for(int i=0;i<6;i++){ v += a*noise(p); p = M2*p; a *= 0.5; }
    return v;
  }

  // 梵高漩涡:域扭曲(IQ domain warping),qOut/rOut 供配色
  float warp(vec2 p, float t, out vec2 qOut, out vec2 rOut){
    vec2 q = vec2(fbm(p + vec2(0.0,0.0) + 0.12*t), fbm(p + vec2(5.2,1.3) - 0.12*t));
    vec2 r = vec2(fbm(p + 3.5*q + vec2(1.7,9.2) + 0.15*t), fbm(p + 3.5*q + vec2(8.3,2.8) - 0.15*t));
    qOut = q; rOut = r;
    return fbm(p + 4.0*r);
  }

  // 明亮星核 + 同心光晕(梵高标志),返回发光量
  float starGlow(vec2 p, vec2 c, float sz, float t){
    float d = length(p - c);
    float core = sz*0.05 / (d + 0.02);                       // 核心辉光
    float rings = (0.5 + 0.5*sin(d*34.0 - t*2.2)) * exp(-d*5.0); // 螺旋同心环
    return core + rings*sz*0.5;
  }

  void main(){
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2;
    float t = uTime;

    // ---------- 梵高星空巨画 ----------
    vec2 q, r;
    float f = warp(p*1.15, t, q, r);
    // 蓝金配色堆叠
    vec3 col = vec3(0.03, 0.06, 0.20);                         // 深靛底
    col = mix(col, vec3(0.09, 0.26, 0.62), clamp(f*1.15, 0.0, 1.0));         // 主蓝
    col = mix(col, vec3(0.16, 0.52, 0.72), clamp(dot(q,q)*0.9, 0.0, 1.0));    // 青绿翻卷
    col = mix(col, vec3(1.0, 0.82, 0.34), pow(clamp(r.x*1.1, 0.0, 1.0), 2.2)); // 金色高光
    // 梵高笔触肌理(高频层沿流场调制明暗)
    float brush = fbm(p*7.0 + r*3.2 + t*0.15);
    col *= 0.82 + 0.36*brush;
    col += vec3(1.0,0.85,0.45) * pow(clamp(brush,0.0,1.0), 6.0) * 0.5;         // 笔触上的金点

    // 星核:一个大"太阳"金核 + 若干行星星点(被卷入画中的太阳系)
    float glow = 0.0;
    glow += starGlow(p, vec2(-0.55, 0.42), 2.4, t);                            // 大太阳/月
    glow += starGlow(p, vec2(0.72, -0.30), 1.1, t*1.1 + 2.0);
    glow += starGlow(p, vec2(0.30, 0.66), 0.8, t*0.9 + 5.0);
    glow += starGlow(p, vec2(-0.20, -0.55), 0.7, t*1.2 + 9.0);
    glow += starGlow(p, vec2(1.05, 0.55), 0.6, t*0.8 + 12.0);
    vec3 vangogh = col + vec3(1.0, 0.86, 0.5) * glow;

    // ---------- 静默三维深空 ----------
    vec3 calm = vec3(0.015, 0.03, 0.08) * (0.8 + 0.5*fbm(p*0.8));              // 暗蓝云
    float sv = hash(floor((uv*uRes)/2.5));                                     // 稀疏冷星
    calm += vec3(0.7,0.8,1.0) * step(0.9975, sv) * (0.6 + 0.4*sin(t*3.0 + sv*30.0));

    // ---------- 降维前沿:从中心向外扫过 ----------
    float rad = length(p);
    float front = uProgress * 3.0;                                            // 前沿半径
    float reveal = smoothstep(front, front - 0.55, rad);                      // 内=1(梵高) 外=0(深空)
    vec3 outc = mix(calm, vangogh, reveal);
    // 前沿本身的一道亮环(二维化边界)
    float edge = exp(-pow((rad - front)/0.14, 2.0)) * smoothstep(0.02, 0.2, uProgress) * (1.0 - step(1.0, uProgress));
    outc += vec3(0.8, 0.9, 1.0) * edge * 0.9;

    // 整体色调映射 + 轻微暗角
    outc = outc / (outc + 0.85) * 1.55;                                       // 柔性压高光(保辉光)
    outc *= 1.0 - 0.28*pow(length((uv-0.5)*vec2(aspect,1.0)), 2.2);
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export default function VanGoghCollapse({ onPhase, onReady }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    scene.add(quad);

    let W = 1, H = 1;
    const resize = () => {
      W = host.clientWidth || 1; H = host.clientHeight || 1;
      renderer.setSize(W, H, false);
      const dpr = renderer.getPixelRatio();
      uniforms.uRes.value.set(W * dpr, H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    // 强制编译一次 shader(便于挂载即暴露编译错误,不依赖 rAF)
    renderer.render(scene, camera);

    // ---- 状态机 ----
    let phase = 'space';                       // space|collapsing|plane|restoring
    let p = 0;
    const COLLAPSE_DUR = 3.4, RESTORE_DUR = 1.8;
    const report = ph => onPhase && onPhase(ph);
    const api = {
      collapse: () => { if (phase !== 'space') return; phase = 'collapsing'; report('collapsing'); },
      restore: () => { if (phase === 'space' || phase === 'restoring') return; phase = 'restoring'; report('space'); },
    };
    onReady && onReady(api);

    let raf = 0, last = performance.now();
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      uniforms.uTime.value = now / 1000;
      if (phase === 'collapsing') { p = Math.min(1, p + dt / COLLAPSE_DUR); if (p >= 1) { phase = 'plane'; report('plane'); } }
      else if (phase === 'restoring') { p = Math.max(0, p - dt / RESTORE_DUR); if (p <= 0) { phase = 'space'; report('space'); } }
      uniforms.uProgress.value = p;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      quad.geometry.dispose(); mat.dispose(); renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
