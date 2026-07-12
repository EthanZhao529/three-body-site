import * as THREE from 'three';
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';

// 黑暗森林·侦察透镜(React Bits FluidGlass lens 模式的适配版):
// 玻璃球跟随光标,以 MeshTransmissionMaterial 折射/放大下方 2D 星野画布
// (星野画布每帧作为 CanvasTexture 喂入 buffer,故透镜里是"活"的画面);
// 整层 pointer-events:none,点击穿透到星野执行打击,互不干扰。
function LensBall({ sourceCanvas }) {
  const ref = useRef();
  const [tex] = useState(() => {
    const t = new THREE.CanvasTexture(sourceCanvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  });

  useFrame((state, delta) => {
    tex.needsUpdate = true;
    const { pointer, viewport } = state;
    easing.damp3(
      ref.current.position,
      [(pointer.x * viewport.width) / 2, (pointer.y * viewport.height) / 2, 0],
      0.12,
      delta
    );
  });

  return (
    <mesh ref={ref} scale={0.62}>
      <sphereGeometry args={[1, 64, 32]} />
      <MeshTransmissionMaterial
        buffer={tex}
        ior={1.15}
        thickness={2}
        anisotropy={0.01}
        chromaticAberration={0.08}
        transmission={1}
        roughness={0}
      />
    </mesh>
  );
}

export default function DarkLens({ sourceCanvas, eventSource }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      <Canvas
        camera={{ position: [0, 0, 20], fov: 15 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        eventSource={eventSource}
        eventPrefix="client"
      >
        <LensBall sourceCanvas={sourceCanvas} />
      </Canvas>
    </div>
  );
}
