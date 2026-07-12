import * as THREE from 'three';
import { useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

// 黑暗森林·侦察透镜 v2:自写屏幕空间放大着色器(替换 MeshTransmissionMaterial——
// 后者在本场景出现奶白+同心环伪影且采样发糊)。
// 特性:①原生分辨率直接采样星野画布(像素拉满,不糊)
//      ②放大率从中心(≈2.2x)到边缘平滑衰减到 1x → 透镜边界与背景无缝融合
//      ③边缘轻微色散 + 极弱玻璃圈光;整层 pointer-events:none 点击穿透
const VERT = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform vec2 uRes;
uniform float uRadius;
varying vec2 vUv;
// 带色散的单次采样(caO=色散偏移向量,像素)
vec3 sampleCA(vec2 p, vec2 caO){
  return vec3(
    texture2D(uTex, (p - caO) / uRes).r,
    texture2D(uTex, p / uRes).g,
    texture2D(uTex, (p + caO) / uRes).b
  );
}
void main(){
  vec2 frag = vUv * uRes;
  vec2 c = uCenter * uRes;
  vec2 d = frag - c;
  float r = length(d) / uRadius;
  if (r >= 1.0) discard;
  float rr = smoothstep(0.0, 1.0, r * r);
  float k = mix(0.45, 1.0, rr);            // 采样压缩:中心放大~2.2x,边缘1x(无缝)
  float ca = 0.012 * r * r * uRadius;      // 色散(px),边缘增强
  vec2 nd = r > 0.0001 ? normalize(d) : vec2(0.0);
  vec2 caO = nd * ca;
  vec2 base = c + d * k;
  // 4-tap 旋转网格超采样:消除放大重采样产生的摩尔纹(边缘 k→1 处走样最重,采样扩散随之加大)
  float sp = mix(0.5, 1.0, rr);
  vec3 acc = sampleCA(base + vec2( 0.25,  0.75) * sp, caO)
           + sampleCA(base + vec2( 0.75, -0.25) * sp, caO)
           + sampleCA(base + vec2(-0.25, -0.75) * sp, caO)
           + sampleCA(base + vec2(-0.75,  0.25) * sp, caO);
  vec3 col = acc * 0.25 * mix(1.18, 1.0, rr);   // 镜内聚光,边缘归一保无缝
  float rim = smoothstep(0.90, 0.995, r) * (1.0 - smoothstep(0.995, 1.0, r));
  col += vec3(0.55, 0.72, 1.0) * rim * 0.10;          // 极弱玻璃圈光
  gl_FragColor = vec4(col, 1.0);
}
`;

function LensPlane({ sourceCanvas }) {
  const [uniforms] = useState(() => {
    const t = new THREE.CanvasTexture(sourceCanvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return {
      uTex: { value: t },
      uCenter: { value: new THREE.Vector2(0.5, 0.45) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 150 }
    };
  });

  useFrame((state, delta) => {
    uniforms.uTex.value.needsUpdate = true;
    const { pointer, size } = state;
    uniforms.uRes.value.set(size.width, size.height);
    uniforms.uRadius.value = Math.min(size.width, size.height) * 0.17;
    const tx = (pointer.x + 1) / 2;
    const ty = (pointer.y + 1) / 2;
    const c = uniforms.uCenter.value;
    const k = 1 - Math.exp(-delta / 0.09);   // 阻尼跟随
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function DarkLens({ sourceCanvas, eventSource }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <Canvas
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 2]}
        eventSource={eventSource}
        eventPrefix="client"
      >
        <LensPlane sourceCanvas={sourceCanvas} />
      </Canvas>
    </div>
  );
}
