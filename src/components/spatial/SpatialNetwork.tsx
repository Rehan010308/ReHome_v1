import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The authenticated centrepiece: the product's actual sentence, drawn.
 *
 *   OBJECT  →  REHOME INTELLIGENCE  →  DESTINATION
 *
 * Every mark is bound to real data. Left-hand solids are the user's own items,
 * right-hand nodes are organizations that actually have open demand, and a
 * particle only travels a lane that exists. With no items the left lane is
 * empty and the core idles — the emptiness is the honest state, not a bug.
 *
 * Performance: one Points draw call for all particles, shared geometry and
 * materials, DPR capped, and the loop is suspended when the canvas leaves the
 * viewport or the tab is hidden. Reduced motion renders a single static frame.
 */

export interface SpatialObject {
  id: string;
  /** Drives colour temperature: further along the lifecycle reads warmer. */
  progress: number;
}

export interface SpatialDestination {
  id: string;
  /** 0–1; brighter nodes are stronger matches. */
  strength: number;
}

interface Props {
  objects: SpatialObject[];
  destinations: SpatialDestination[];
  className?: string;
}

const LIME = new THREE.Color("#a3e635");
const MINT = new THREE.Color("#7ce7b0");
const CYAN = new THREE.Color("#6ee7ff");
const DIM = new THREE.Color("#1d3a33");

export default function SpatialNetwork({ objects, destinations, className = "" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ objects, destinations });
  const rebuildRef = useRef<() => void>(() => {});
  dataRef.current = { objects, destinations };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 768;

    const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.6, small ? 15.5 : 13);
    camera.lookAt(0, 0.2, 0);

    scene.add(new THREE.HemisphereLight(0x9fe870, 0x061014, 0.7));
    const key = new THREE.DirectionalLight(0xd9ffb8, 1.1);
    key.position.set(-4, 6, 6);
    scene.add(key);

    const root = new THREE.Group();
    scene.add(root);

    // ── Intelligence core ────────────────────────────────────────────────
    const core = new THREE.Group();
    root.add(core);

    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.78, 1),
      new THREE.MeshStandardMaterial({
        color: 0x0f2a22, emissive: MINT, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.4,
      })
    );
    core.add(coreMesh);

    const coreShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.22, 1),
      new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: 0.22 })
    );
    core.add(coreShell);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = Math.PI / 2.1;
    core.add(ring);

    // ── Lanes ────────────────────────────────────────────────────────────
    const OBJ_X = small ? -3.9 : -5.4;
    const DEST_X = small ? 3.9 : 5.4;

    const objGeo = new THREE.BoxGeometry(0.5, 0.62, 0.16);
    const destGeo = new THREE.TorusGeometry(0.34, 0.055, 10, 28);
    const objMeshes: THREE.Mesh[] = [];
    const destMeshes: THREE.Mesh[] = [];

    const layout = (i: number, n: number, x: number) => {
      const spread = Math.min(4.4, n * 1.25);
      const y = n === 1 ? 0.2 : 0.2 + spread / 2 - (i / Math.max(1, n - 1)) * spread;
      return new THREE.Vector3(x + (i % 2 ? -0.5 : 0.35), y, (i % 3) * -0.7);
    };

    function build() {
      const { objects: objs, destinations: dests } = dataRef.current;

      objMeshes.forEach((m) => { root.remove(m); (m.material as THREE.Material).dispose(); });
      destMeshes.forEach((m) => { root.remove(m); (m.material as THREE.Material).dispose(); });
      objMeshes.length = 0;
      destMeshes.length = 0;

      objs.slice(0, 6).forEach((o, i, arr) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x14332b,
          emissive: MINT.clone().lerp(CYAN, o.progress),
          emissiveIntensity: 0.25 + o.progress * 0.5,
          roughness: 0.45, metalness: 0.3,
        });
        const mesh = new THREE.Mesh(objGeo, mat);
        mesh.position.copy(layout(i, arr.length, OBJ_X));
        mesh.userData.phase = i * 1.7;
        root.add(mesh);
        objMeshes.push(mesh);
      });

      dests.slice(0, 6).forEach((d, i, arr) => {
        const mat = new THREE.MeshBasicMaterial({
          color: DIM.clone().lerp(LIME, 0.25 + d.strength * 0.75),
          transparent: true,
          opacity: 0.5 + d.strength * 0.5,
        });
        const mesh = new THREE.Mesh(destGeo, mat);
        mesh.position.copy(layout(i, arr.length, DEST_X));
        mesh.userData.phase = i * 2.1;
        root.add(mesh);
        destMeshes.push(mesh);
      });
    }
    build();
    rebuildRef.current = build;

    // ── Particles: one draw call, curved along real lanes ────────────────
    const COUNT = small ? 48 : 90;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const state = Array.from({ length: COUNT }, () => ({
      t: Math.random(),
      speed: 0.13 + Math.random() * 0.16,
      leg: Math.random() < 0.5 ? 0 : 1,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      ctrl: new THREE.Vector3(),
      live: false,
    }));

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        size: small ? 0.075 : 0.062,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    root.add(points);

    const CORE_POS = new THREE.Vector3(0, 0.2, 0);
    const tmp = new THREE.Vector3();

    function assign(p: (typeof state)[number]) {
      // Inbound legs need an item; outbound legs need a destination. With
      // neither, the particle simply stays dark rather than inventing traffic.
      if (p.leg === 0 && objMeshes.length > 0) {
        p.from.copy(objMeshes[(Math.random() * objMeshes.length) | 0].position);
        p.to.copy(CORE_POS);
        p.live = true;
      } else if (p.leg === 1 && destMeshes.length > 0) {
        p.from.copy(CORE_POS);
        p.to.copy(destMeshes[(Math.random() * destMeshes.length) | 0].position);
        p.live = true;
      } else {
        p.live = false;
      }
      p.ctrl.copy(p.from).add(p.to).multiplyScalar(0.5);
      p.ctrl.y += 1.15 + Math.random() * 0.7;
      p.ctrl.z += (Math.random() - 0.5) * 1.4;
      p.t = 0;
    }
    state.forEach(assign);

    // ── Loop, suspended when off-screen or hidden ────────────────────────
    let raf = 0;
    let running = true;
    let visible = true;
    let last = performance.now();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(mount);
    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    let pointerX = 0;
    const onPointer = (e: PointerEvent) => {
      const r = mount.getBoundingClientRect();
      pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    };
    if (!small) mount.addEventListener("pointermove", onPointer);

    function frame(now: number) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (!visible) { last = now; return; }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      coreMesh.rotation.y += dt * 0.35;
      coreMesh.rotation.x += dt * 0.12;
      coreShell.rotation.y -= dt * 0.22;
      coreShell.rotation.z += dt * 0.08;
      const pulse = 1 + Math.sin(t * 1.7) * 0.035;
      core.scale.setScalar(pulse);
      ring.rotation.z += dt * 0.25;

      objMeshes.forEach((m) => {
        m.position.y += Math.sin(t * 0.9 + m.userData.phase) * dt * 0.16;
        m.rotation.y += dt * 0.4;
      });
      destMeshes.forEach((m) => {
        m.rotation.z += dt * 0.5;
        m.rotation.x = Math.PI / 2 + Math.sin(t * 0.6 + m.userData.phase) * 0.25;
      });

      for (let i = 0; i < COUNT; i++) {
        const p = state[i];
        if (!p.live) { positions[i * 3 + 1] = -999; continue; }
        p.t += dt * p.speed;
        if (p.t >= 1) { p.leg = p.leg === 0 ? 1 : 0; assign(p); }
        const s = p.t;
        const inv = 1 - s;
        tmp.set(
          inv * inv * p.from.x + 2 * inv * s * p.ctrl.x + s * s * p.to.x,
          inv * inv * p.from.y + 2 * inv * s * p.ctrl.y + s * s * p.to.y,
          inv * inv * p.from.z + 2 * inv * s * p.ctrl.z + s * s * p.to.z
        );
        positions[i * 3] = tmp.x;
        positions[i * 3 + 1] = tmp.y;
        positions[i * 3 + 2] = tmp.z;
        const c = p.leg === 0 ? MINT : LIME;
        const fade = Math.sin(s * Math.PI);
        colors[i * 3] = c.r * fade;
        colors[i * 3 + 1] = c.g * fade;
        colors[i * 3 + 2] = c.b * fade;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      root.rotation.y += (pointerX * 0.11 - root.rotation.y) * 0.04;
      renderer.render(scene, camera);
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reduced) renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    if (reduced) {
      state.forEach((p, i) => { p.t = (i / COUNT); });
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (!small) mount.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Items and matches arrive asynchronously, so the lanes are rebuilt whenever
  // the data changes shape rather than only on mount.
  const signature = `${objects.map((o) => o.id).join(",")}|${destinations.map((d) => d.id).join(",")}`;
  useEffect(() => {
    rebuildRef.current();
  }, [signature]);

  return <div ref={mountRef} className={`relative ${className}`} aria-hidden />;
}
