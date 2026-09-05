import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The authenticated centrepiece: the product's sentence, drawn.
 *
 *   OBJECT  →  REHOME INTELLIGENCE  →  DESTINATION
 *
 * The lanes are always drawn as standing paths, so the relationship is legible
 * even with a single item and no traffic. Particles ride those same paths, so
 * motion reinforces the structure instead of floating independently of it.
 *
 * Everything is bound to real data: left-hand solids are the user's items
 * coloured by lifecycle progress, right-hand rings are organizations with
 * genuine open demand scaled by match score, and a path only exists where a
 * real relationship does.
 */

export interface SpatialObject {
  id: string;
  progress: number;
}

export interface SpatialDestination {
  id: string;
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

interface Lane {
  from: THREE.Vector3;
  ctrl: THREE.Vector3;
  to: THREE.Vector3;
  leg: 0 | 1;
}

function bezier(out: THREE.Vector3, l: Lane, s: number) {
  const inv = 1 - s;
  out.set(
    inv * inv * l.from.x + 2 * inv * s * l.ctrl.x + s * s * l.to.x,
    inv * inv * l.from.y + 2 * inv * s * l.ctrl.y + s * s * l.to.y,
    inv * inv * l.from.z + 2 * inv * s * l.ctrl.z + s * s * l.to.z
  );
}

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
    // Closer and wider than before: the stage was mostly empty air.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0.9, small ? 11.5 : 9.4);
    camera.lookAt(0, 0.1, 0);

    scene.add(new THREE.HemisphereLight(0x9fe870, 0x061014, 0.85));
    const key = new THREE.DirectionalLight(0xd9ffb8, 1.25);
    key.position.set(-5, 6, 7);
    scene.add(key);
    const rim = new THREE.PointLight(0x43d99b, 0.8, 40);
    rim.position.set(5, 2, 3);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    // ── Intelligence core ────────────────────────────────────────────────
    const core = new THREE.Group();
    root.add(core);

    core.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.92, 1),
        new THREE.MeshStandardMaterial({
          color: 0x10322a, emissive: MINT, emissiveIntensity: 0.75, roughness: 0.3, metalness: 0.45,
        })
      )
    );
    const coreMesh = core.children[0] as THREE.Mesh;

    const coreShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: 0.26 })
    );
    core.add(coreShell);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.25, 0.014, 8, 110),
      new THREE.MeshBasicMaterial({ color: MINT, transparent: true, opacity: 0.4 })
    );
    ring.rotation.x = Math.PI / 2.15;
    core.add(ring);

    // ── Lane endpoints ───────────────────────────────────────────────────
    const OBJ_X = small ? -3.5 : -4.6;
    const DEST_X = small ? 3.5 : 4.6;
    const CORE_POS = new THREE.Vector3(0, 0.1, 0);

    const objGeo = new THREE.BoxGeometry(0.92, 1.16, 0.3);
    const destGeo = new THREE.TorusGeometry(0.56, 0.085, 12, 40);
    const objMeshes: THREE.Mesh[] = [];
    const destMeshes: THREE.Mesh[] = [];
    const lanes: Lane[] = [];
    const laneGroup = new THREE.Group();
    root.add(laneGroup);

    const place = (i: number, n: number, x: number) => {
      const spread = Math.min(3.4, (n - 1) * 1.5);
      const y = n === 1 ? 0.1 : 0.1 + spread / 2 - (i / Math.max(1, n - 1)) * spread;
      return new THREE.Vector3(x, y, ((i % 3) - 1) * 0.55);
    };

    function makeLane(from: THREE.Vector3, to: THREE.Vector3, leg: 0 | 1): Lane {
      const ctrl = from.clone().add(to).multiplyScalar(0.5);
      ctrl.y += 1.05;
      ctrl.z += 0.35;
      return { from: from.clone(), ctrl, to: to.clone(), leg };
    }

    /** The standing path. Visible structure, so the flow reads without traffic. */
    function drawLane(lane: Lane, strength: number) {
      const pts: THREE.Vector3[] = [];
      const v = new THREE.Vector3();
      for (let i = 0; i <= 28; i++) {
        bezier(v, lane, i / 28);
        pts.push(v.clone());
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: lane.leg === 0 ? MINT : LIME,
          transparent: true,
          opacity: 0.1 + strength * 0.22,
        })
      );
      laneGroup.add(line);
    }

    function build() {
      const { objects: objs, destinations: dests } = dataRef.current;

      [...objMeshes, ...destMeshes].forEach((m) => {
        root.remove(m);
        (m.material as THREE.Material).dispose();
      });
      objMeshes.length = 0;
      destMeshes.length = 0;
      lanes.length = 0;
      laneGroup.children.slice().forEach((c) => {
        laneGroup.remove(c);
        const l = c as THREE.Line;
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      });

      objs.slice(0, 5).forEach((o, i, arr) => {
        const mesh = new THREE.Mesh(
          objGeo,
          new THREE.MeshStandardMaterial({
            color: 0x16382e,
            emissive: MINT.clone().lerp(CYAN, o.progress),
            emissiveIntensity: 0.4 + o.progress * 0.7,
            roughness: 0.4, metalness: 0.35,
          })
        );
        mesh.position.copy(place(i, arr.length, OBJ_X));
        mesh.userData.phase = i * 1.7;
        root.add(mesh);
        objMeshes.push(mesh);
        const lane = makeLane(mesh.position, CORE_POS, 0);
        lanes.push(lane);
        drawLane(lane, 0.5 + o.progress * 0.5);
      });

      dests.slice(0, 5).forEach((d, i, arr) => {
        // Ring faces the camera, so a destination reads as a portal rather
        // than the edge-on dash it was before.
        const mesh = new THREE.Mesh(
          destGeo,
          new THREE.MeshStandardMaterial({
            color: 0x1d3a33,
            emissive: LIME,
            emissiveIntensity: 0.35 + d.strength * 0.9,
            roughness: 0.35, metalness: 0.3,
          })
        );
        mesh.position.copy(place(i, arr.length, DEST_X));
        mesh.rotation.y = -0.35;
        mesh.userData.phase = i * 2.1;
        root.add(mesh);
        destMeshes.push(mesh);
        const lane = makeLane(CORE_POS, mesh.position, 1);
        lanes.push(lane);
        drawLane(lane, d.strength);
      });
    }
    build();
    rebuildRef.current = build;

    // ── Particles riding the same paths ──────────────────────────────────
    const COUNT = small ? 40 : 72;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const state = Array.from({ length: COUNT }, () => ({
      t: Math.random(),
      speed: 0.16 + Math.random() * 0.2,
      lane: null as Lane | null,
    }));

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        size: small ? 0.16 : 0.13,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    root.add(points);

    const tmp = new THREE.Vector3();
    function assign(p: (typeof state)[number]) {
      p.lane = lanes.length ? lanes[(Math.random() * lanes.length) | 0] : null;
      p.t = 0;
    }
    state.forEach((p) => { assign(p); p.t = Math.random(); });

    // ── Loop ─────────────────────────────────────────────────────────────
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

      coreMesh.rotation.y += dt * 0.3;
      coreMesh.rotation.x += dt * 0.1;
      coreShell.rotation.y -= dt * 0.2;
      coreShell.rotation.z += dt * 0.07;
      core.scale.setScalar(1 + Math.sin(t * 1.6) * 0.03);
      ring.rotation.z += dt * 0.22;

      objMeshes.forEach((m, i) => {
        m.position.y = place(i, objMeshes.length, OBJ_X).y + Math.sin(t * 0.8 + m.userData.phase) * 0.12;
        m.rotation.y += dt * 0.35;
        m.rotation.x = Math.sin(t * 0.5 + m.userData.phase) * 0.15;
      });
      destMeshes.forEach((m, i) => {
        m.position.y = place(i, destMeshes.length, DEST_X).y + Math.sin(t * 0.6 + m.userData.phase) * 0.1;
        m.rotation.z += dt * 0.4;
      });

      for (let i = 0; i < COUNT; i++) {
        const p = state[i];
        if (!p.lane) { positions[i * 3 + 1] = -999; continue; }
        p.t += dt * p.speed;
        if (p.t >= 1) assign(p);
        bezier(tmp, p.lane, p.t);
        positions[i * 3] = tmp.x;
        positions[i * 3 + 1] = tmp.y;
        positions[i * 3 + 2] = tmp.z;
        const c = p.lane.leg === 0 ? MINT : LIME;
        const fade = Math.sin(p.t * Math.PI) * 1.15;
        colors[i * 3] = c.r * fade;
        colors[i * 3 + 1] = c.g * fade;
        colors[i * 3 + 2] = c.b * fade;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      root.rotation.y += (pointerX * 0.09 - root.rotation.y) * 0.04;
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
      state.forEach((p, i) => { p.t = i / COUNT; });
      for (let i = 0; i < COUNT; i++) {
        const p = state[i];
        if (!p.lane) continue;
        bezier(tmp, p.lane, p.t);
        positions[i * 3] = tmp.x;
        positions[i * 3 + 1] = tmp.y;
        positions[i * 3 + 2] = tmp.z;
        const c = p.lane.leg === 0 ? MINT : LIME;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
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

  const signature = `${objects.map((o) => o.id).join(",")}|${destinations.map((d) => d.id).join(",")}`;
  useEffect(() => {
    rebuildRef.current();
  }, [signature]);

  return <div ref={mountRef} className={`relative ${className}`} aria-hidden />;
}
