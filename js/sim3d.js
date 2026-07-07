/* ============================================================
   三体演算 · Three.js 真 3D 渲染层(第二页)
   物理引擎在 main.js(Yoshida 四阶辛积分,壁纸同款);
   本模块只负责渲染:3D 恒星球体 + 程序化日冕 + UnrealBloom 泛光。
   WebGL 不可用时静默回退 main.js 的 2D 渲染。
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';

try {
  THREE.ColorManagement.enabled = false;   // 所见即所得:不做任何色彩空间转换
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x070605, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);

  /* ---------- 壁纸原生贴图(从 scene.pkg 解包) ---------- */
  const texLoader = new THREE.TextureLoader();
  function loadTex(url) {
    const t = texLoader.load(url);
    return t;
  }
  // 银河全景天空球(三体演算壁纸的 st2 天空盒)
  const skyGeo = new THREE.SphereGeometry(80, 48, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    map: loadTex('assets/wp/milkyway.jpg'), side: THREE.BackSide,
    depthWrite: false
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  /* ---------- 程序化贴图(全部自制,零外部素材) ---------- */
  // 恒星表面:米粒组织 + 临边昏暗
  function sunTexture() {
    const s = 256, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff8ee';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const px = Math.random() * s, py = Math.random() * s;
      const r = Math.random() * 7 + 2;
      const warm = Math.random();
      x.fillStyle = warm < 0.5
        ? 'rgba(255,205,130,' + (Math.random() * 0.16).toFixed(3) + ')'
        : 'rgba(120,60,20,' + (Math.random() * 0.10).toFixed(3) + ')';
      x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    return new THREE.CanvasTexture(cv);
  }
  // 日冕:柔和径向衰减
  function glowTexture(hard) {
    const s = 256, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    if (hard) {
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,.6)');
      g.addColorStop(0.5, 'rgba(255,255,255,.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }
  const sunMap = loadTex('assets/wp/sun_gray.jpg');   // 壁纸 0sun 日面(灰度,染色用)
  sunMap.colorSpace = THREE.NoColorSpace;
  const glowHard = glowTexture(true);
  const glowSoft = glowTexture(false);

  /* ---------- 三颗恒星(色温与 2D 版一致) ---------- */
  const TINTS = [
    { core: 0xffc46e, glow: 0xffb864, r: 0.082 },   // 琥珀
    { core: 0xff8454, glow: 0xff7a4a, r: 0.068 },   // 红橙
    { core: 0xffecbe, glow: 0xffe9b0, r: 0.096 }    // 白金
  ];
  const CHAOS = new THREE.Color(0xe04034);
  const suns = [];
  for (const t of TINTS) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(t.r, 48, 32),
      new THREE.MeshBasicMaterial({ map: sunMap, color: t.core })
    );
    const s1 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowHard, color: t.glow, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
    }));
    s1.scale.setScalar(t.r * 5.2);
    const s2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSoft, color: t.glow, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22
    }));
    s2.scale.setScalar(t.r * 9);
    g.add(core, s1, s2);
    scene.add(g);
    suns.push({ group: g, core, s1, s2, tint: t, baseCore: new THREE.Color(t.core), baseGlow: new THREE.Color(t.glow) });
  }

  /* ---------- 行星:地球(壁纸 0dq 贴图 —— 被三日拉扯的就是我们) ---------- */
  const planet = new THREE.Group();
  const earthBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 32, 24),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/wp/earth.jpg') })
  );
  planet.add(earthBall);
  const pGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSoft, color: 0x96aabe, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5
  }));
  pGlow.scale.setScalar(0.16);
  planet.add(pGlow);
  scene.add(planet);

  /* ---------- 3D 轨迹(顶点渐隐,加色混合,泛光负责辉光) ---------- */
  const TRAIL_N = 240;
  const trails = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    scene.add(line);
    trails.push({ geo, line });
  }

  /* ---------- 深空星点(3D 壳层,补足纵深) ---------- */
  (function () {
    const n = 1200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 24 + Math.random() * 50;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xd9d4c8, size: 0.045, sizeAttenuation: true,
      transparent: true, opacity: 0.75, depthWrite: false
    })));
  })();

  /* ============================================================
     水滴场景(水滴壁纸移植:0mxx2 星空 + 镜面泪滴 + szcl 尾部光环)
     ============================================================ */
  const dropScene = new THREE.Scene();
  const dropSkyTex = loadTex('assets/wp/droplet_sky.jpg');
  const dropSky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 48, 32),
    new THREE.MeshBasicMaterial({ map: dropSkyTex, side: THREE.BackSide, depthWrite: false })
  );
  dropScene.add(dropSky);
  dropScene.add(new THREE.AmbientLight(0x222633, 1.6));
  // 绝对光滑的镜面:不打直射光(会留下光斑),全靠银河环境反射成像

  // 泪滴外形:半球头 + 幂律收细的尾
  function dropletGeometry() {
    // 单条连续曲线:r(u)=R·sin(π·u^0.62),圆头渐收到针尖,无折痕
    const pts = [];
    const R = 0.5, L = 2.0;
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const r = Math.max(0.0008, R * Math.sin(Math.PI * Math.pow(u, 0.62)));
      pts.push(new THREE.Vector2(r, -R + u * (L + R)));
    }
    pts.push(new THREE.Vector2(0, L));
    return new THREE.LatheGeometry(pts, 96);
  }
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 1.0, roughness: 0.05, envMapIntensity: 3.2
  });
  const droplet = new THREE.Mesh(dropletGeometry(), dropMat);
  droplet.rotation.z = -Math.PI / 2;   // 尾指 +x,头朝 -x(航向)
  const dropGroup = new THREE.Group();
  dropGroup.add(droplet);
  dropGroup.scale.setScalar(0.68);
  dropGroup.position.x = 0.1;
  dropScene.add(dropGroup);
  // 环境反射:用更亮的银河全景做反射源(暗星空反射会变成黑镜)
  texLoader.load('assets/wp/milkyway.jpg', function (t) {
    t.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    dropMat.envMap = pmrem.fromEquirectangular(t).texture;
    dropMat.needsUpdate = true;
  });
  // 尾部扩散光环(szcl)
  const ringMat = new THREE.SpriteMaterial({
    map: loadTex('assets/wp/rings.png'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55,
    color: 0xbfd6ff
  });
  const ringSprite = new THREE.Sprite(ringMat);
  ringSprite.position.set(1.05, 0, 0);
  ringSprite.scale.setScalar(1.15);
  dropGroup.add(ringSprite);

  // 亚光速星流(多普勒:前方蓝移,后方红移 —— 致敬 0mxx3 渐变)
  function makeStreaks(colorHex, xmin, xmax, n) {
    const pos = new Float32Array(n * 6);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = xmin + Math.random() * (xmax - xmin);
      const y = (Math.random() * 2 - 1) * 16;
      const z = (Math.random() * 2 - 1) * 16;
      const len = 2.5 + Math.random() * 6;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - len; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z;
      spd[i] = 14 + Math.random() * 26;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({
      color: colorHex, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const lines = new THREE.LineSegments(g, m);
    lines.frustumCulled = false;
    lines.userData = { spd, xmin, xmax, n };
    dropScene.add(lines);
    return lines;
  }
  const streaksBlue = makeStreaks(0x9db6ff, -46, -4, 130);  // 前方:蓝移
  const streaksRed = makeStreaks(0xff9d8a, 4, 46, 130);     // 后方:红移
  const streaksMid = makeStreaks(0xdce4ff, -30, 30, 90);    // 中性
  function advanceStreaks(lines, dt) {
    const p = lines.geometry.attributes.position.array;
    const u = lines.userData;
    for (let i = 0; i < u.n; i++) {
      const dx = u.spd[i] * dt;
      p[i * 6] += dx; p[i * 6 + 3] += dx;
      if (p[i * 6 + 3] > u.xmax) {
        const len = p[i * 6] - p[i * 6 + 3];
        p[i * 6 + 3] = u.xmin; p[i * 6] = u.xmin + len;
        p[i * 6 + 1] = p[i * 6 + 4] = (Math.random() * 2 - 1) * 16;
        p[i * 6 + 2] = p[i * 6 + 5] = (Math.random() * 2 - 1) * 16;
      }
    }
    lines.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- 泛光后处理 ---------- */
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.4, 0.35);
  composer.addPass(bloom);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w * DPR, h * DPR);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- 渲染循环:读 main.js 的物理与视角状态 ---------- */
  const tmpColor = new THREE.Color();
  let chaosMix = 0;
  let lastT = performance.now();

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const st = window.__sim, rot = window.__rot, view = window.__view;
    const a1 = view ? (view.a1 !== undefined ? view.a1 : view.a) : 0;
    const a4 = view ? (view.a4 || 0) : 0;
    const alive = Math.max(a1, a4);
    if (!st || !rot || !view || alive <= 0.004) {
      if (canvas.style.display !== 'none') canvas.style.display = 'none';
      return;
    }
    if (canvas.style.display !== 'block') canvas.style.display = 'block';
    canvas.style.opacity = Math.min(1, alive * 1.15).toFixed(3);

    /* ===== 水滴场景 ===== */
    if (a4 > a1) {
      renderPass.scene = dropScene;
      dropSky.rotation.y += dt * 0.004;
      dropGroup.position.y = 0.05 * Math.sin(now / 4200);
      dropGroup.rotation.z = 0.03 * Math.sin(now / 5100);
      dropGroup.rotation.y = 0.05 * Math.sin(now / 7300);
      ringSprite.scale.setScalar(1.1 + 0.18 * Math.sin(now / 1400));
      ringMat.opacity = 0.5 + 0.22 * Math.sin(now / 950);
      advanceStreaks(streaksBlue, dt);
      advanceStreaks(streaksRed, dt);
      advanceStreaks(streaksMid, dt);
      const zin4 = view.d4 < 0 ? 1 + 1.8 * Math.pow(-view.d4, 2) * (3 - 2 * -view.d4) : 1;
      const R4 = 3.4 * zin4;
      const az4 = (rot.y * 0.6) * Math.PI / 180;
      const el4 = Math.max(-1.1, Math.min(1.1, (6 - rot.x * 0.6) * Math.PI / 180));
      const ch4 = R4 * Math.cos(el4);
      camera.position.set(ch4 * Math.sin(az4) + 0.3, R4 * Math.sin(el4), ch4 * Math.cos(az4));
      camera.lookAt(0.2, 0, 0);
      composer.render();
      return;
    }

    /* ===== 三体演算场景 ===== */
    renderPass.scene = scene;
    sky.rotation.y += dt * 0.0035;             // 银河缓旋(壁纸感)
    earthBall.rotation.y = now * 0.00025;

    // 相机:方位角=拖拽 rotY,仰角=拖拽 rotX;机位拉远接翻页过渡
    const d1 = view.d1 !== undefined ? view.d1 : view.d;
    const zin = d1 < 0 ? 1 + 2.4 * Math.pow(-d1, 2) * (3 - 2 * -d1) : 1;
    const R = 4.1 * zin;
    const azim = rot.y * Math.PI / 180;
    const elev = Math.max(-1.35, Math.min(1.35, (12 - rot.x) * Math.PI / 180));
    const ch = R * Math.cos(elev);
    camera.position.set(ch * Math.sin(azim), R * Math.sin(elev), ch * Math.cos(azim));
    camera.lookAt(0, 0, 0);

    // 混沌红移(平滑过渡)
    chaosMix += ((st.chaosMode ? 1 : 0) - chaosMix) * 0.06;

    // 恒星与行星位置(sim 平面 x,y → 世界 x,z;出平面 z → 世界 y)
    for (let i = 0; i < 3; i++) {
      const b = st.b[i], s = suns[i];
      s.group.position.set(b.x, b.z, b.y);
      s.core.material.color.copy(s.baseCore).lerp(CHAOS, chaosMix);
      tmpColor.copy(s.baseGlow).lerp(CHAOS, chaosMix);
      s.s1.material.color.copy(tmpColor);
      s.s2.material.color.copy(tmpColor);
    }
    planet.position.set(st.pl.x, st.pl.z, st.pl.y);

    // 轨迹缓冲更新
    for (let i = 0; i < 3; i++) {
      const tr = st.trails[i], t3 = trails[i];
      const n = Math.min(tr.length, TRAIL_N);
      const pos = t3.geo.attributes.position.array;
      const col = t3.geo.attributes.color.array;
      tmpColor.copy(suns[i].baseGlow).lerp(CHAOS, chaosMix);
      for (let j = 0; j < n; j++) {
        const p = tr[tr.length - n + j];
        pos[j * 3] = p[0]; pos[j * 3 + 1] = p[2]; pos[j * 3 + 2] = p[1];
        const f = Math.pow(j / n, 1.4) * 0.9;
        col[j * 3] = tmpColor.r * f; col[j * 3 + 1] = tmpColor.g * f; col[j * 3 + 2] = tmpColor.b * f;
      }
      t3.geo.setDrawRange(0, n);
      t3.geo.attributes.position.needsUpdate = true;
      t3.geo.attributes.color.needsUpdate = true;
    }

    composer.render();
  }
  frame();

  window.__use3D = true;   // 通知 main.js 关闭 2D 演算渲染
} catch (err) {
  // WebGL 不可用 → 保持 2D 回退,不打断页面
  console.warn('3D 渲染不可用,回退 2D:', err);
}
