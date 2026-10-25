'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HIDDEN, inspect, type TrainingState } from './model';

type Props = {
  model: TrainingState;
  probeIndex: number;
  phase: number;
  running: boolean;
  batchSize: number;
  onInspect: (node: string) => void;
};

/** A conceptual GPU floor with a live, real CPU-trained model flowing above it. */
export default function GpuTrainingScene({ model, probeIndex, phase, running, batchSize, onInspect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ model, probeIndex, phase, running, batchSize, onInspect });
  latest.current = { model, probeIndex, phase, running, batchSize, onInspect };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power', alpha: false }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x070d18);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.domElement.setAttribute('aria-label', '3D neural network and conceptual GPU. Drag to orbit, scroll to zoom, tap a neuron to inspect it. Training runs on the JavaScript CPU.');
    mount.appendChild(renderer.domElement);

    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0x070d18, 0.025);
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 70);
    camera.position.set(7.7, 5.5, 11.7);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.45, -0.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 23;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.enablePan = false;
    controls.update();

    scene.add(new T.HemisphereLight(0x7bb7db, 0x080c18, 2));
    const key = new T.PointLight(0x7edbd7, 80, 22);
    key.position.set(-4, 6, 3);
    scene.add(key);
    const rim = new T.PointLight(0xf3a568, 48, 18);
    rim.position.set(4, 5, -4);
    scene.add(rim);
    const built = new T.Group();
    scene.add(built);
    const box = new T.BoxGeometry(1, 1, 1);
    const platform = new T.Mesh(box, new T.MeshStandardMaterial({ color: 0x0e2334, metalness: .75, roughness: .32 }));
    platform.position.set(0, -0.34, -1);
    platform.scale.set(10.5, .56, 8.1);
    built.add(platform);
    const inner = new T.Mesh(box, new T.MeshStandardMaterial({ color: 0x173946, metalness: .9, roughness: .26 }));
    inner.position.set(0, -0.025, -1);
    inner.scale.set(9.4, .10, 7.1);
    built.add(inner);

    const tileGeometry = new T.BoxGeometry(.57, .065, .43);
    const tiles = new T.InstancedMesh(tileGeometry, new T.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x116a65, emissiveIntensity: .35, metalness: .5, roughness: .35,
    }), 8 * 12);
    const tmp = new T.Object3D();
    for (let i = 0; i < 96; i++) {
      const column = i % 12, row = Math.floor(i / 12);
      tmp.position.set(-4.15 + column * .75, .064, -3.95 + row * .82);
      tmp.updateMatrix();
      tiles.setMatrixAt(i, tmp.matrix);
    }
    tiles.instanceMatrix.needsUpdate = true;
    built.add(tiles);
    const traceMaterial = new T.MeshBasicMaterial({ color: 0x53dfd4, transparent: true, opacity: .7 });
    for (const x of [-4.85, 4.85]) {
      const trace = new T.Mesh(box, traceMaterial);
      trace.position.set(x, .12, -1);
      trace.scale.set(.035, .03, 7.45);
      built.add(trace);
    }
    for (const z of [-4.68, 2.7]) {
      const trace = new T.Mesh(box, traceMaterial);
      trace.position.set(0, .12, z);
      trace.scale.set(9.73, .03, .035);
      built.add(trace);
    }

    const nodePositions = [
      new T.Vector3(-3.2, 2.65, 1.5), new T.Vector3(-3.2, 1.35, 1.5),
      ...Array.from({ length: HIDDEN }, (_, h) => new T.Vector3(0, 3.78 - h * .54, .4)),
      new T.Vector3(3.2, 2.15, 1.5),
    ];
    const nodeGeometry = new T.IcosahedronGeometry(.24, 2);
    const nodeMeshes = nodePositions.map((point, index) => {
      const m = new T.Mesh(nodeGeometry, new T.MeshStandardMaterial({
        color: 0x84c6be, emissive: 0x2f8e88, emissiveIntensity: .8, metalness: .38, roughness: .2,
      }));
      m.position.copy(point);
      m.userData.node = index;
      built.add(m);
      const halo = new T.Mesh(new T.TorusGeometry(.37, .016, 6, 48),
        new T.MeshBasicMaterial({ color: 0x7acdbf, transparent: true, opacity: .5 }));
      halo.position.copy(point);
      halo.rotation.set(.3, 0, .15);
      built.add(halo);
      return m;
    });
    const beamGeometry = new T.CylinderGeometry(1, 1, 1, 6);
    const pulseGeometry = new T.SphereGeometry(.07, 8, 6);
    const beams: { mesh: T.Mesh; pulse: T.Mesh; from: T.Vector3; to: T.Vector3; weight: number }[] = [];
    const addBeam = (start: number, end: number, weight: number) => {
      const from = nodePositions[start], to = nodePositions[end];
      const direction = new T.Vector3().subVectors(to, from);
      const material = new T.MeshBasicMaterial({ color: 0x65c9c3, transparent: true, opacity: .4, depthWrite: false });
      const mesh = new T.Mesh(beamGeometry, material);
      mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize());
      mesh.scale.set(.014, direction.length() - .4, .014);
      built.add(mesh);
      const pulse = new T.Mesh(pulseGeometry, new T.MeshBasicMaterial({ color: 0xf5cf8d }));
      pulse.position.copy(from);
      built.add(pulse);
      beams.push({ mesh, pulse, from, to, weight });
    };
    for (let h = 0; h < HIDDEN; h++) {
      addBeam(0, 2 + h, h * 2);
      addBeam(1, 2 + h, h * 2 + 1);
      addBeam(2 + h, 8, 18 + h);
    }
    const ray = new T.Raycaster();
    const pointer = new T.Vector2();
    let down: [number, number] = [0, 0];
    const pointerDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(nodeMeshes)[0];
      if (!hit) return;
      const i = Number(hit.object.userData.node);
      latest.current.onInspect(i < 2 ? 'Input ' + (i + 1) : i === 8 ? 'Output' : 'Hidden ' + (i - 1));
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();
    let visible = true;
    const io = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; });
    io.observe(mount);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = 0, visualKey = '';
    const animation = (time: number) => {
      raf = requestAnimationFrame(animation);
      if (!visible || document.hidden || time - last < 33) return;
      last = time;
      const current = latest.current;
      const probe = inspect(current.model, current.probeIndex);
      const version = [current.model.step, current.probeIndex, current.phase, current.batchSize].join(':');
      if (version !== visualKey) {
        visualKey = version;
        const values = [...probe.sample.input, ...probe.hidden, probe.prediction * 2 - 1];
        nodeMeshes.forEach((node, i) => {
          const value = values[i];
          const mat = node.material as T.MeshStandardMaterial;
          mat.color.setHSL(value < 0 ? .56 : .11, .65, .35 + Math.min(.3, Math.abs(value) * .22));
          mat.emissive.copy(mat.color);
          mat.emissiveIntensity = .55 + Math.abs(value) * .7;
        });
        beams.forEach(beam => {
          const w = current.model.weights[beam.weight];
          const mat = beam.mesh.material as T.MeshBasicMaterial;
          mat.color.setHex(w >= 0 ? 0x69e2ce : 0xf1a47d);
          mat.opacity = .16 + Math.min(.65, Math.abs(w) * .43);
          const width = .008 + Math.min(.026, Math.abs(w) * .012);
          beam.mesh.scale.x = beam.mesh.scale.z = width;
        });
        for (let i = 0; i < 96; i++) {
          const row = Math.floor(i / 12);
          const active = row < Math.min(8, current.batchSize);
          const heat = (Math.sin(i * .89 + current.model.step * .29) + 1) * .5;
          const color = new T.Color().setHSL(active ? .48 - heat * .08 : .58, .65, active ? .15 + .3 * heat : .10);
          tiles.setColorAt(i, color);
        }
        if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      }
      for (let i = 0; i < beams.length; i++) {
        const b = beams[i], forward = current.phase !== 2;
        const t = reduce ? .45 : (time * (current.running ? .0008 : .00022) + i * .17) % 1;
        b.pulse.position.copy(forward ? b.from : b.to).lerp(forward ? b.to : b.from, t);
        b.pulse.visible = current.phase === 0 || current.phase === 2;
        (b.pulse.material as T.MeshBasicMaterial).color.setHex(current.phase === 2 ? 0xf4a16d : 0xf2dfb0);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animation);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        geometries.add(object.geometry);
        const owned = Array.isArray(object.material) ? object.material : [object.material];
        owned.forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div className="gpu-scene" ref={host}>{failed && <div className="gpu-webgl-fallback" role="status">3D rendering is unavailable here. The real training controls, outputs and loss chart still work below.</div>}</div>;
}
