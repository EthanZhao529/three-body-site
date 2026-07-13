import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 二向箔 · 希尔伯特曲线降维打击(致敬 Ele 实验室 KikiLetGo/DimReduce 的思路,three.js 复刻)
// 体素化的地球(上千个小方块)→ 投放二向箔 → 每个体素沿【三维希尔伯特曲线】顺序被逐块抽出,
// 在二维平面上按【二维希尔伯特曲线】重新铺开。希尔伯特曲线保局部性→相邻体素在二维里仍相邻,
// 大陆/海洋的颜色连续摊开成一幅"被解构重铺的地球"——数学上真实的降维,而非视觉障眼法。
// onPhase 报三态 space|collapsing|plane;onReady 交出 { collapse, restore }。

// ---- 2D 希尔伯特:距离 d -> (x,y),n=2^order(Wikipedia 标准,已离线验证连续) ----
function d2xy(n, d) {
  let rx, ry, t = d, x = 0, y = 0;
  for (let s = 1; s < n; s *= 2) {
    rx = 1 & (t >> 1);
    ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const tmp = x; x = y; y = tmp;
    }
    x += s * rx; y += s * ry;
    t = Math.floor(t / 4);
  }
  return [x, y];
}
// ---- 3D 希尔伯特:坐标 (x,y,z) -> 距离 d(Skilling transpose,已离线验证连续) ----
function axesToHilbert(ax, bits) {
  const X = [ax[0], ax[1], ax[2]];
  const M = 1 << (bits - 1);
  let q, p, t, i;
  for (q = M; q > 1; q >>= 1) {
    p = q - 1;
    for (i = 0; i < 3; i++) {
      if (X[i] & q) X[0] ^= p;
      else { t = (X[0] ^ X[i]) & p; X[0] ^= t; X[i] ^= t; }
    }
  }
  for (i = 1; i < 3; i++) X[i] ^= X[i - 1];
  t = 0;
  for (q = M; q > 1; q >>= 1) if (X[2] & q) t ^= q - 1;
  for (i = 0; i < 3; i++) X[i] ^= t;
  let h = 0;
  for (let j = bits - 1; j >= 0; j--)
    for (i = 0; i < 3; i++) h = h * 2 + ((X[i] >> j) & 1);
  return h;
}

// ---- 轻量 3D value noise(程序化大陆,自包含) ----
function hash3(i, j, k) {
  const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
}

export default function HilbertReduce({ onPhase, onReady }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ss = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

    // ===== three 基础 =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.set(0, 0, 4.8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(2, 1.5, 3);
    scene.add(dir);

    // ===== 星空背景 =====
    const starGeo = new THREE.BufferGeometry();
    const starN = 900, sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 20 + Math.random() * 30;
      const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1);
      sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      sp[i * 3 + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb6d8, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
    scene.add(stars);

    // ===== 体素化地球 =====
    const GRID = 32, ORDER3 = 5, C = (GRID - 1) / 2; // 中心 15.5
    const R_VOX = 11, cubeSize = 1 / R_VOX;           // 球半径 world=1
    const cells = [];
    for (let gx = 0; gx < GRID; gx++)
      for (let gy = 0; gy < GRID; gy++)
        for (let gz = 0; gz < GRID; gz++) {
          const dx = gx - C, dy = gy - C, dz = gz - C;
          const rr = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (rr > R_VOX) continue;
          cells.push({ gx, gy, gz, dx, dy, dz, rr, d3: axesToHilbert([gx, gy, gz], ORDER3) });
        }
    cells.sort((a, b) => a.d3 - b.d3);        // 沿三维希尔伯特曲线顺序 → rank=索引
    const M = cells.length;

    // 二维希尔伯特目标(rank -> 2D 格坐标),order2 使容量 >= M
    let ORDER2 = 1; while ((1 << (2 * ORDER2)) < M) ORDER2++;
    const N2 = 1 << ORDER2;
    const g2 = new Array(M);
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let i = 0; i < M; i++) {
      const [px, py] = d2xy(N2, i);
      g2[i] = [px, py];
      if (px < minx) minx = px; if (px > maxx) maxx = px;
      if (py < miny) miny = py; if (py > maxy) maxy = py;
    }
    const c2x = (minx + maxx) / 2, c2y = (miny + maxy) / 2;
    const span = Math.max(maxx - minx, maxy - miny) || 1;

    // 颜色 + 基础坐标
    const base3 = new Float32Array(M * 3);      // 3D 局部坐标(未自转)
    const grid2 = new Float32Array(M * 2);      // 2D 格坐标(居中)
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
      new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, vertexColors: false }),
      M);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    for (let i = 0; i < M; i++) {
      const c = cells[i];
      base3[i * 3] = c.dx * cubeSize;
      base3[i * 3 + 1] = c.dy * cubeSize;
      base3[i * 3 + 2] = c.dz * cubeSize;
      grid2[i * 2] = g2[i][0] - c2x;
      grid2[i * 2 + 1] = g2[i][1] - c2y;
      // 程序化地球着色
      const nx = c.dx / (c.rr || 1), ny = c.dy / (c.rr || 1), nz = c.dz / (c.rr || 1);
      const rN = c.rr / R_VOX;                  // 0核心 → 1表面
      const cont = noise3(nx * 2.4 + 8, ny * 2.4 + 3, nz * 2.4 + 5); // 大陆噪声
      let r, g, b;
      if (Math.abs(ny) > 0.80) { r = 0.90; g = 0.94; b = 0.98; }       // 极地白
      else if (cont > 0.56) { r = 0.22 + cont * 0.3; g = 0.52 + cont * 0.25; b = 0.24; } // 陆地绿
      else { r = 0.10; g = 0.28 + cont * 0.2; b = 0.55 + cont * 0.25; }  // 海洋蓝
      // 内部体素向暖色地核过渡(降维摊开后露出的层次)
      const core = (1 - rN);
      r = r + (0.95 - r) * core * 0.55; g = g + (0.45 - g) * core * 0.55; b = b + (0.18 - b) * core * 0.55;
      col.setRGB(r, g, b);
      mesh.setColorAt(i, col);
    }
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    // 二向箔薄片(降维触发时掠过)
    const foil = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xdbeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(foil);

    // ===== 尺寸/2D 显示尺度 =====
    let W = 1, H = 1, cell2d = 0.03, displaySize = 3;
    const resize = () => {
      W = host.clientWidth || 1; H = host.clientHeight || 1;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      const visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI / 180) / 2);
      const visW = visH * camera.aspect;
      displaySize = Math.min(visH, visW) * 0.82;   // 2D 画铺满较短边的 82%
      cell2d = displaySize / span;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    if (typeof window !== 'undefined') window.__hilbert = { M, ORDER2, N2, span, coverage: +(M / (N2 * N2)).toFixed(3) };

    // ===== 状态机 =====
    let phase = 'space';               // space|collapsing|plane|restoring
    let p = 0, spin = 0, foilT = 0, foilOn = false;
    const COLLAPSE_DUR = 3.2, RESTORE_DUR = 1.8, BAND = Math.max(1, M * 0.14);
    const report = ph => onPhase && onPhase(ph);
    const dummy = new THREE.Object3D();

    const api = {
      collapse: () => { if (phase !== 'space') return; phase = 'collapsing'; foilOn = true; foilT = 0; report('collapsing'); },
      restore: () => { if (phase === 'space' || phase === 'restoring') return; phase = 'restoring'; foilOn = false; report('space'); },
    };
    onReady && onReady(api);

    // ===== 主循环 =====
    let raf = 0, last = performance.now();
    const frame = now => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      if (phase === 'space') spin += 0.18 * dt;
      else if (phase === 'collapsing') { p = Math.min(1, p + dt / COLLAPSE_DUR); if (p >= 1) { phase = 'plane'; report('plane'); } }
      else if (phase === 'restoring') { p = Math.max(0, p - dt / RESTORE_DUR); if (p <= 0) { phase = 'space'; report('space'); } }
      else if (phase === 'space' || phase === 'plane') { /* 静置 */ }

      // 二向箔薄片:降维前 0.6s 掠过
      if (foilOn) {
        foilT = Math.min(1, foilT + dt / 0.6);
        foil.position.set(0, (1 - foilT) * 1.6 - 0.2, 0.02);
        foil.material.opacity = Math.sin(foilT * Math.PI) * 0.9;
        if (foilT >= 1) foilOn = false;
      } else foil.material.opacity *= 0.9;

      // 波前沿(沿希尔伯特曲线)扫过:i 越小越先降维
      const front = p * (M + BAND);
      const ca = Math.cos(spin), sa = Math.sin(spin);
      for (let i = 0; i < M; i++) {
        const e = ss((front - i) / BAND);         // 0=还是3D,1=已铺成2D
        const bx = base3[i * 3], by = base3[i * 3 + 1], bz = base3[i * 3 + 2];
        // 自转后的 3D 位置
        const x3 = bx * ca + bz * sa, y3 = by, z3 = -bx * sa + bz * ca;
        // 2D 目标(面向相机的平面)
        const x2 = grid2[i * 2] * cell2d, y2 = grid2[i * 2 + 1] * cell2d, z2 = 0;
        const s = 1 + (cell2d / cubeSize - 1) * e;  // 2D 态方块缩到密铺间距
        dummy.position.set(x3 + (x2 - x3) * e, y3 + (y2 - y3) * e, z3 + (z2 - z3) * e);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      stars.rotation.y += 0.005 * dt;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mesh.geometry.dispose(); mesh.material.dispose();
      starGeo.dispose(); stars.material.dispose();
      foil.geometry.dispose(); foil.material.dispose();
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden="true" />;
}
