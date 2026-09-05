import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * HeroScene3D — the ReHome "intelligence stage".
 *
 * Visual story: unused objects (backpack, books, laptop, electronics,
 * clothing) float around a glowing ReHome Intelligence core. A radar sweep
 * continuously scans them, and each featured object is highlighted as it is
 * "sent" to its best destination (school, government school, refurbisher,
 * recycler, shelter).
 *
 * All geometry is procedural and lightweight (no external model downloads).
 * The scene is lazy-loaded by the Hero and adapts to mobile and
 * prefers-reduced-motion.
 */

export interface FlowDef {
  id: string;
  label: string;
  dest: string;
  tag: string;
  accent: string;
}

export const FLOWS: FlowDef[] = [
  { id: "backpack", label: "BACKPACK", dest: "SCHOOL", tag: "Education · direct reuse", accent: "#7ce7b0" },
  { id: "books", label: "MATHS BOOKS", dest: "GOVERNMENT SCHOOL", tag: "Demand · 30 units", accent: "#a3e635" },
  { id: "laptop", label: "LAPTOP", dest: "STUDENT / REFURBISHER", tag: "Repair · resell · reuse", accent: "#6ee7ff" },
  { id: "ewaste", label: "BROKEN ELECTRONICS", dest: "CERTIFIED RECYCLER", tag: "Materials recovered", accent: "#fbbf24" },
  { id: "clothes", label: "CLOTHING", dest: "LOCAL SHELTER", tag: "Warmth, not waste", accent: "#c084fc" },
];

const BG = 0x071016;

interface ClusterHandle {
  group: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh;
  phase: number;
  speed: number;
}

function makeGlowTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stdMat(color: number, emissive: number, rough = 0.5, metal = 0.18): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.06,
    roughness: rough,
    metalness: metal,
  });
}

function basicTransparent(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function boxMesh(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return mesh;
}

/** Add a flat glowing ring "slot" under an object. */
function addSlotRing(radius: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.86, radius * 1.0, 64);
  const mat = basicTransparent(0x86efac, 0.22);
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
}

export default function HeroScene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const triggerRef = useRef<(index: number) => void>(() => {});
  const [featured, setFeatured] = useState(0);
  const featuredRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 640;

    // ── Renderer ────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.6 : 2));
    renderer.setClearColor(BG);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 42, 110);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const camBase = { x: 0, y: small ? 7.2 : 6.3, z: small ? 15.5 : 18.5 };
    camera.position.set(camBase.x, camBase.y, camBase.z);
    camera.lookAt(0, 1.05, 0);

    // ── Lights ──────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x3b4a58, 0.55));
    const hemi = new THREE.HemisphereLight(0x9fe870, 0x0b1520, 0.5);
    scene.add(hemi);

    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(9, 11, 7);
    scene.add(fill);

    const key = new THREE.SpotLight(0xd9ffb8, 2.1, 90, 0.75, 0.85, 0);
    key.position.set(0, 17, 6);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0004;
    scene.add(key, key.target);

    const amberRim = new THREE.PointLight(0xffb454, 0.6, 0, 0);
    amberRim.position.set(-13, 5, -6);
    scene.add(amberRim);
    const limeRim = new THREE.PointLight(0x43d99b, 0.5, 0, 0);
    limeRim.position.set(12, 4, 8);
    scene.add(limeRim);

    // ── Platform ────────────────────────────────────────────────
    const platform = new THREE.Mesh(
      new THREE.CircleGeometry(30, 96),
      new THREE.MeshStandardMaterial({ color: 0x050a10, roughness: 0.92, metalness: 0 })
    );
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = -0.02;
    platform.receiveShadow = true;
    scene.add(platform);

    const glowTex = makeGlowTexture();
    const spotGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0x2b6d50,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    spotGlow.rotation.x = -Math.PI / 2;
    spotGlow.position.y = 0.012;
    scene.add(spotGlow);

    // ── Arrangement root (sways + drag rotation) ────────────────
    const root = new THREE.Group();
    scene.add(root);

    // ── Core: ReHome Intelligence ───────────────────────────────
    const coreGroup = new THREE.Group();
    coreGroup.position.y = 1.05;
    root.add(coreGroup);

    const coreInner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.02, 0),
      new THREE.MeshStandardMaterial({
        color: 0x0e2418,
        emissive: 0xaef447,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.35,
        flatShading: true,
      })
    );
    coreInner.castShadow = true;
    coreGroup.add(coreInner);

    const coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: 0x9fffb0, wireframe: true, transparent: true, opacity: 0.4 })
    );
    coreGroup.add(coreWire);

    const coreGlowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x9dff6a,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coreGlow = new THREE.Sprite(coreGlowMat);
    coreGlow.scale.setScalar(7.4);
    coreGroup.add(coreGlow);

    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.016, 8, 100),
      basicTransparent(0xa3e635, 0.5)
    );
    ringA.rotation.x = Math.PI / 2;
    ringA.position.y = 0.03;
    root.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(3.7, 0.012, 8, 100),
      basicTransparent(0x35d0a2, 0.28)
    );
    ringB.rotation.set(Math.PI / 2.15, 0, 0.35);
    ringB.position.y = 0.03;
    root.add(ringB);

    const orbitDots = new THREE.Group();
    orbitDots.position.y = 1.05;
    const dotGeo = new THREE.IcosahedronGeometry(0.09, 0);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0xd7ff8c, emissive: 0xb6f24b, emissiveIntensity: 1 });
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      const a = (i / 5) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 2.0, Math.sin(i) * 0.4, Math.sin(a) * 2.0);
      orbitDots.add(dot);
    }
    root.add(orbitDots);

    // ── Build clusters ──────────────────────────────────────────
    const handles: ClusterHandle[] = [];

    // 0 · Backpack → School
    {
      const g = new THREE.Group();
      const bodyMat = stdMat(0x1d6b50, 0x37e0a2);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.05, 8, 24), bodyMat);
      body.scale.set(1, 1, 0.62);
      body.position.y = 1.18;
      body.castShadow = true;
      const pocket = boxMesh(0.72, 0.52, 0.2, stdMat(0x17543f, 0x37e0a2));
      pocket.position.set(0, 0.42, 0.5);
      pocket.castShadow = true;
      const flapMat = stdMat(0x2a7f60, 0x37e0a2);
      const flap = boxMesh(0.9, 0.22, 0.85, flapMat);
      flap.position.y = 2.05;
      flap.castShadow = true;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 20), stdMat(0x123c2e, 0x37e0a2));
      handle.position.y = 2.3;
      g.add(body, pocket, flap, handle);
      g.position.set(-6.4, 0.0, -1.6);
      g.rotation.y = 0.5;
      g.add(addSlotRing(1.7));
      g.userData.slot = g.children[g.children.length - 1] as THREE.Mesh;
      handles.push({ group: g, mats: [bodyMat, flapMat], ring: g.userData.slot, phase: 0, speed: 0.9 });
      root.add(g);
    }

    // 1 · Maths books → Government school
    {
      const g = new THREE.Group();
      const bookColors = [0x1a6a4f, 0x2f9e77, 0x1b5340, 0x3caf87];
      let y = 0;
      const coverMats: THREE.MeshStandardMaterial[] = [];
      for (let i = 0; i < 3; i++) {
        const coverMat = stdMat(bookColors[i % bookColors.length], 0x7cffae);
        coverMats.push(coverMat);
        const cover = boxMesh(1.62, 0.07, 1.18, coverMat);
        cover.position.y = y + 0.045;
        cover.castShadow = true;
        const pages = boxMesh(1.46, 0.16, 1.04, stdMat(0xece7d6, 0x0));
        pages.position.y = y + 0.16;
        g.add(cover, pages);
        y += 0.36;
      }
      const topCover = boxMesh(1.62, 0.05, 1.18, coverMats[2]);
      topCover.position.y = y - 0.015;
      g.add(topCover);
      g.position.set(6.7, 0.0, -2.3);
      g.rotation.y = -0.45;
      g.add(addSlotRing(1.75));
      g.userData.slot = g.children[g.children.length - 1] as THREE.Mesh;
      handles.push({ group: g, mats: coverMats, ring: g.userData.slot, phase: 1.7, speed: 0.75 });
      root.add(g);
    }

    // 2 · Laptop → Refurbisher
    {
      const g = new THREE.Group();
      const baseMat = stdMat(0x24313c, 0x35d9ff);
      const keyboard = boxMesh(2.1, 0.09, 1.45, baseMat);
      keyboard.position.y = 0.06;
      keyboard.castShadow = true;
      const screen = boxMesh(2.02, 1.42, 0.06, stdMat(0x111b24, 0x0));
      screen.position.y = 0.78;
      screen.rotation.x = -0.16;
      screen.castShadow = true;
      const displayMat = new THREE.MeshStandardMaterial({
        color: 0x06121c,
        emissive: 0x46d4ff,
        emissiveIntensity: 0.28,
        roughness: 0.35,
        metalness: 0,
      });
      const display = boxMesh(1.86, 1.28, 0.012, displayMat);
      display.position.set(0, 0.78, 0.045);
      const stand = boxMesh(0.9, 0.16, 1.1, baseMat);
      stand.position.y = 0.16;
      g.add(keyboard, screen, display, stand);
      g.position.set(-5.7, 0.0, 3.4);
      g.rotation.y = 0.75;
      g.add(addSlotRing(2.1));
      g.userData.slot = g.children[g.children.length - 1] as THREE.Mesh;
      handles.push({ group: g, mats: [baseMat, displayMat], ring: g.userData.slot, phase: 3.1, speed: 1 });
      root.add(g);
    }

    // 3 · Broken electronics → Recycler
    {
      const g = new THREE.Group();
      const bodyMat = stdMat(0x24333f, 0xffd24a);
      const body = boxMesh(0.8, 1.6, 0.11, bodyMat);
      body.position.y = 0.86;
      body.rotation.z = -0.08;
      body.castShadow = true;
      const crackedMat = new THREE.MeshStandardMaterial({
        color: 0x141f2a,
        emissive: 0xffc94d,
        emissiveIntensity: 0.2,
        roughness: 0.4,
        metalness: 0.1,
      });
      const cracked = boxMesh(0.66, 1.42, 0.04, crackedMat);
      cracked.position.set(0.02, 0.87, 0.075);
      const chunk = boxMesh(0.5, 0.3, 0.5, stdMat(0x3a4a56, 0xffd24a));
      chunk.position.set(0.62, 0.2, 0.3);
      chunk.rotation.z = 0.5;
      chunk.castShadow = true;
      g.add(body, cracked, chunk);
      g.position.set(2.3, 0.0, 5.9);
      g.rotation.y = -0.3;
      g.add(addSlotRing(1.4));
      g.userData.slot = g.children[g.children.length - 1] as THREE.Mesh;
      handles.push({ group: g, mats: [bodyMat, crackedMat], ring: g.userData.slot, phase: 4.4, speed: 1.1 });
      root.add(g);
    }

    // 4 · Clothing → Shelter
    {
      const g = new THREE.Group();
      const foldColors = [0x8f7f6c, 0x6f9a85, 0xa86a4f];
      let y = 0.14;
      const foldMats: THREE.MeshStandardMaterial[] = [];
      for (let i = 0; i < 3; i++) {
        const m = stdMat(foldColors[i % foldColors.length], 0xe2a9ff);
        foldMats.push(m);
        const fold = boxMesh(1.7, 0.26, 1.32, m);
        fold.position.y = y;
        fold.rotation.z = i % 2 === 0 ? 0.02 : -0.02;
        fold.castShadow = true;
        g.add(fold);
        y += 0.28;
      }
      const top = boxMesh(0.95, 0.14, 0.8, stdMat(0xb8a2c9, 0xe2a9ff));
      top.position.set(0.35, y + 0.05, 0.25);
      top.castShadow = true;
      g.add(top);
      g.position.set(-2.9, 0.0, 6.2);
      g.rotation.y = 0.5;
      g.add(addSlotRing(1.7));
      g.userData.slot = g.children[g.children.length - 1] as THREE.Mesh;
      handles.push({ group: g, mats: foldMats, ring: g.userData.slot, phase: 5.6, speed: 0.85 });
      root.add(g);
    }

    // Hide a couple of clusters on small screens (simpler composition).
    if (small) {
      handles[3].group.visible = false;
      handles[4].group.visible = false;
    }

    // ── Radar sweep ─────────────────────────────────────────────
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x86ffc4,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.4), sweepMat);
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.y = 0.06;
    root.add(sweep);
    const sweepCore = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.22), basicTransparent(0x9dffd0, 0.35));
    sweepCore.rotation.x = -Math.PI / 2;
    sweepCore.position.y = 0.075;
    root.add(sweepCore);

    // ── Starfield particles ─────────────────────────────────────
    const starCount = small ? 150 : 300;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 17 + Math.random() * 26;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.7;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        map: glowTex,
        color: 0x9de8ff,
        size: 0.16,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(stars);

    // ── Featured highlight state ─────────────────────────────────
    const pulses: THREE.Mesh[] = [];
    const pulseLifetimes: number[] = [];
    const spawnPulse = () => {
      const geo = new THREE.RingGeometry(0.9, 1.1, 64);
      const mat = basicTransparent(0xa3e635, 0.55);
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      root.add(ring);
      pulses.push(ring);
      pulseLifetimes.push(0);
    };

    let glowBoost = 0;
    let boostDecay = 0;
    const matsTargets: number[] = handles.map(() => 0.05);

    const trigger = (index: number) => {
      featuredRef.current = index;
      setFeatured(index);
      spawnPulse();
      glowBoost = 1;
      boostDecay = 0;
      handles.forEach((_, i) => {
        matsTargets[i] = i === index ? 0.85 : 0.05;
      });
      const slot = handles[index]?.group.userData.slot as THREE.Mesh | undefined;
      if (slot) (slot.material as THREE.MeshBasicMaterial).opacity = 0.8;
    };
    triggerRef.current = trigger;

    // ── Resize ──────────────────────────────────────────────────
    const resize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    // Render one frame immediately so there is never a blank stage.
    renderer.render(scene, camera);

    let raf = 0;
    let running = true;
    let lastTime = performance.now();

    // ── Interaction: drag rotate + pointer parallax ─────────────
    let dragging = false;
    let lastPointerX = 0;
    let dragTarget = 0;
    let pointerX = 0;
    let pointerY = 0;
    let parallaxX = 0;
    let parallaxY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      dragging = true;
      lastPointerX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pointerX = nx;
      pointerY = ny;
      if (dragging) {
        dragTarget -= (e.clientX - lastPointerX) * 0.006;
        lastPointerX = e.clientX;
      }
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };
    if (!small) {
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointerleave", onPointerLeave);
    }
    canvas.style.touchAction = "pan-y";

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const raw = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(raw, 0.05);
      const t = performance.now() / 1000;

      // Sway + bob + gentle spin
      root.rotation.y = Math.sin(t * 0.06) * 0.05 + dragTarget;
      root.rotation.z = Math.sin(t * 0.05) * 0.008;
      handles.forEach((h, i) => {
        const up = 0.05 + (1 + Math.sin(t * h.speed + h.phase)) * 0.09;
        h.group.position.y = up;
        h.group.rotation.y += dt * 0.05 * (i % 2 === 0 ? 1 : -1);
        const active = featuredRef.current === i;
        const targetRingScale = active ? 1.35 : 1;
        const s = h.ring.scale.x + (targetRingScale - h.ring.scale.x) * 0.08;
        h.ring.scale.setScalar(s);
        const ringMat = h.ring.material as THREE.MeshBasicMaterial;
        ringMat.opacity = active ? 0.75 : ringMat.opacity * 0.94 + 0.24 * 0.06;
        h.mats.forEach((m, mi) => {
          const tg = mi === 0 ? matsTargets[i] : matsTargets[i] * 0.5;
          m.emissiveIntensity += (tg - m.emissiveIntensity) * 0.12;
        });
      });

      // Core pulse
      boostDecay += dt;
      const boost = Math.max(0, glowBoost - boostDecay * 1.1);
      coreInner.material.emissiveIntensity = 0.85 + boost * 1.1;
      (coreWire.material as THREE.MeshBasicMaterial).opacity = 0.4 + boost * 0.35;
      coreGlowMat.opacity = 0.5 + boost * 0.3;
      const cs = 7.4 + boost * 3.4;
      coreGlow.scale.setScalar(cs);
      coreInner.rotation.y += dt * 0.35;
      coreInner.rotation.x += dt * 0.12;
      coreWire.rotation.y -= dt * 0.08;
      orbitDots.rotation.y += dt * 0.25;
      ringA.rotation.z += dt * 0.1;
      ringB.rotation.z -= dt * 0.14;
      stars.rotation.y += dt * 0.008;

      // Radar sweep
      sweep.rotation.z -= dt * 0.3;
      sweepCore.rotation.z -= dt * 0.3;

      // Expanding pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const life = pulseLifetimes[i];
        pulseLifetimes[i] = life + dt;
        const scale = 1.4 + life * 11;
        pulses[i].scale.setScalar(scale);
        (pulses[i].material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - life * 0.45);
        if (life > 1.6) {
          root.remove(pulses[i]);
          pulses[i].geometry.dispose();
          (pulses[i].material as THREE.Material).dispose();
          pulses.splice(i, 1);
          pulseLifetimes.splice(i, 1);
        }
      }

      // Camera breathe + pointer parallax
      parallaxX += (pointerX - parallaxX) * 0.03;
      parallaxY += (pointerY - parallaxY) * 0.03;
      camera.position.x = camBase.x + parallaxX * 1.15;
      camera.position.y = camBase.y + Math.sin(t * 0.3) * 0.18 - parallaxY * 0.45;
      camera.lookAt(0, 1.05, 0);

      renderer.render(scene, camera);
    };

    // ── Auto cycle featured flow ─────────────────────────────────
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!reduced) {
      trigger(0);
      interval = setInterval(() => {
        trigger((featuredRef.current + 1) % FLOWS.length);
      }, 3400);
      raf = requestAnimationFrame(tick);
    } else {
      trigger(0);
    }

    // ── Cleanup ─────────────────────────────────────────────────
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (interval) clearInterval(interval);
      ro.disconnect();
      if (!small) {
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointerleave", onPointerLeave);
      }
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      glowTex.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Overlay: flow caption + destination selectors ─────────────
  const active = FLOWS[featured];

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Status label */}
      <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-lime-300" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-300" />
        </span>
        <span className="text-[10px] tracking-[0.3em] uppercase text-lime-100/70 font-semibold">
          ReHome Intelligence
        </span>
      </div>

      {/* Scanline */}
      <style>{`
        @keyframes rehomeScan { 0% { top: -2%; opacity: 0; } 6% { opacity: .5; } 90% { opacity: .5; } 100% { top: 102%; opacity: 0; } }
        .rehome-scanline { position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(163,230,53,.65), rgba(120,255,190,.9), rgba(163,230,53,.65), transparent);
          animation: rehomeScan 6.8s linear infinite; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .rehome-scanline { animation: none; display: none; } }
      `}</style>
      <div className="rehome-scanline" />

      {/* Active flow readout */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 pointer-events-none">
        <div className="flex items-end gap-2.5 md:gap-3">
          <span className="text-sm md:text-base font-bold tracking-wide text-white">{active.label}</span>
          <svg width="20" height="10" viewBox="0 0 20 10" className="text-lime-300/90 shrink-0 mb-1.5">
            <path d="M0 5 H16 M12 1 L17 5 L12 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
          <span className="text-sm md:text-base font-bold tracking-wide" style={{ color: active.accent }}>
            {active.dest}
          </span>
        </div>
        <p className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-white/45 mt-1.5">{active.tag}</p>
      </div>

      {/* Destination selectors */}
      <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6 hidden sm:flex items-center gap-1.5">
        {FLOWS.map((f, i) => (
          <button
            key={f.id}
            onClick={() => triggerRef.current(i)}
            title={f.label}
            aria-label={`Highlight ${f.label} → ${f.dest}`}
            className="group flex items-center gap-2 px-2 py-1 rounded-full transition-colors hover:bg-white/10"
          >
            <span
              className="block h-1.5 w-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === featured ? f.accent : "rgba(255,255,255,0.28)",
                boxShadow: i === featured ? `0 0 8px ${f.accent}` : "none",
                transform: i === featured ? "scale(1.5)" : "scale(1)",
              }}
            />
            {i === featured && (
              <span className="text-[9px] tracking-[0.2em] uppercase text-white/60">{f.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}