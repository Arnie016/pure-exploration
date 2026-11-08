'use client';

import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { disposeScene, textSprite } from '../three-kit';
import { antennaStations, skyDirection } from './physics';

type Props = { baseline: number; sourceAz: number; steerAz: number; elevation: number; wavefronts: boolean };

/** An on-demand scene: no perpetual render loop, no extra network requests. */
export default function RadioSkyScene({ baseline, sourceAz, steerAz, elevation, wavefronts }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const syncRef = useRef<(() => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x050f20, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '3D radio interferometer with four antennas, radio wavefront planes and pointing vectors.');
    renderer.domElement.style.touchAction = 'pan-y';

    const scene = new T.Scene();
    scene.fog = new T.Fog(0x071427, 28, 90);
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 110);
    camera.position.set(25, 23, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 14;
    controls.maxDistance = 75;
    controls.target.set(0, 2.2, 0);
    controls.update();

    scene.add(new T.HemisphereLight(0xbedaff, 0x142635, 2.2));
    const key = new T.DirectionalLight(0xffdaac, 3.1);
    key.position.set(-10, 23, 8);
    scene.add(key);
    const ground = new T.Mesh(
      new T.CircleGeometry(25, 90),
      new T.MeshStandardMaterial({ color: 0x172c37, roughness: 0.97, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.18;
    scene.add(ground);
    const grid = new T.GridHelper(46, 46, 0x426b79, 0x1d4050);
    grid.position.y = -0.14;
    scene.add(grid);
    const centre = new T.Mesh(new T.TorusGeometry(3, 0.025, 6, 88), new T.MeshBasicMaterial({ color: 0x7bbaa9, transparent: true, opacity: 0.45 }));
    centre.rotation.x = Math.PI / 2;
    centre.position.y = -0.12;
    scene.add(centre);

    // Shared geometry and materials for the four receivers.
    const dishCurve = Array.from({ length: 19 }, (_, n) => {
      const radius = n / 18 * 1.55;
      return new T.Vector2(radius, radius * radius * 0.24);
    });
    const dishGeo = new T.LatheGeometry(dishCurve, 40);
    const ringGeo = new T.TorusGeometry(1.55, 0.07, 8, 48);
    const stemGeo = new T.CylinderGeometry(0.14, 0.23, 1.38, 12);
    const feedGeo = new T.SphereGeometry(0.16, 12, 10);
    const padGeo = new T.CylinderGeometry(1.9, 2, 0.18, 32);
    const dishMat = new T.MeshStandardMaterial({ color: 0x8cb7c4, metalness: 0.75, roughness: 0.25, side: T.DoubleSide });
    const edgeMat = new T.MeshBasicMaterial({ color: 0x68d7e2 });
    const stemMat = new T.MeshStandardMaterial({ color: 0x516f81, metalness: 0.66, roughness: 0.32 });
    const padMat = new T.MeshStandardMaterial({ color: 0x33495a, metalness: 0.25, roughness: 0.88 });
    const signalMat = new T.MeshBasicMaterial({ color: 0xe5b877 });
    const antennaGroups: T.Group[] = [];

    for (const id of ['A', 'B', 'C', 'D']) {
      const group = new T.Group();
      const pad = new T.Mesh(padGeo, padMat);
      pad.position.y = -0.04;
      group.add(pad);
      const stem = new T.Mesh(stemGeo, stemMat);
      stem.position.y = 0.71;
      group.add(stem);
      const dish = new T.Mesh(dishGeo, dishMat);
      dish.position.y = 1.4;
      group.add(dish);
      const rim = new T.Mesh(ringGeo, edgeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.4 + 1.55 * 1.55 * 0.24;
      group.add(rim);
      const feed = new T.Mesh(feedGeo, signalMat);
      feed.position.y = 2.44;
      group.add(feed);
      const label = textSprite('RECEIVER ' + id, '#c5e8f0', 4.8);
      label.position.y = 3.5;
      group.add(label);
      scene.add(group);
      antennaGroups.push(group);
    }

    const waveGroup = new T.Group();
    const waveMaterial = new T.MeshBasicMaterial({ color: 0x80e6ef, side: T.DoubleSide, transparent: true, opacity: 0.075, depthWrite: false });
    const planeGeo = new T.PlaneGeometry(32, 32);
    const planes = Array.from({ length: 7 }, (_, n) => {
      const plane = new T.Mesh(planeGeo, waveMaterial);
      plane.userData.offset = (n - 3) * 4.0;
      waveGroup.add(plane);
      return plane;
    });
    scene.add(waveGroup);
    const sourceArrow = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(0, 2.0, 0), 14, 0xf5c47b, 1.1, 0.52);
    const steerArrow = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(0, 2.0, 0), 10, 0x5cdbef, 0.95, 0.48);
    scene.add(sourceArrow, steerArrow);
    const sourceStar = new T.Mesh(new T.SphereGeometry(0.44, 16, 12), new T.MeshBasicMaterial({ color: 0xffd29c }));
    scene.add(sourceStar);
    const starPositions: number[] = [];
    let seed = 20261108;
    for (let n = 0; n < 220; n++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const az = seed / 4294967296 * Math.PI * 2;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const high = 0.22 + seed / 4294967296 * 0.75;
      const radial = Math.sqrt(1 - high * high);
      starPositions.push(50 * radial * Math.cos(az), 50 * high, 50 * radial * Math.sin(az));
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.Float32BufferAttribute(starPositions, 3));
    scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: 0xc1dcff, size: 0.17, sizeAttenuation: true })));

    const render = () => {
      if (!document.hidden && host.clientWidth > 0 && host.clientHeight > 0) renderer.render(scene, camera);
    };
    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      render();
    };
    controls.addEventListener('change', render);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    document.addEventListener('visibilitychange', render);

    syncRef.current = () => {
      const p = antennaStations(baseline);
      for (let i = 0; i < p.length; i++) antennaGroups[i].position.set(p[i].x * 0.43, 0, p[i].z * 0.43);
      const s = skyDirection(sourceAz, elevation), direction = new T.Vector3(s.x, s.y, s.z);
      const t = skyDirection(steerAz, elevation), target = new T.Vector3(t.x, t.y, t.z);
      sourceArrow.setDirection(direction);
      steerArrow.setDirection(target);
      sourceStar.position.copy(direction).multiplyScalar(18).add(new T.Vector3(0, 2.0, 0));
      waveGroup.visible = wavefronts;
      for (const plane of planes) {
        plane.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), direction);
        plane.position.copy(direction).multiplyScalar(plane.userData.offset as number).add(new T.Vector3(0, 2.0, 0));
      }
      render();
    };
    syncRef.current();
    resize();
    return () => {
      syncRef.current = null;
      controls.removeEventListener('change', render);
      controls.dispose();
      observer.disconnect();
      document.removeEventListener('visibilitychange', render);
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []); // Initialize the GPU resources once; update values below.

  useEffect(() => { syncRef.current?.(); }, [baseline, sourceAz, steerAz, elevation, wavefronts]);

  return <div className="radio-sky-scene" ref={mount}>
    {unavailable && <div className="radio-sky-webgl-fallback" role="status">3D rendering is unavailable here. The numerical array and sky scan still work below.</div>}
    <div className="radio-sky-scene-key"><span><i className="source-dot" /> Source direction</span><span><i className="steer-dot" /> Digital pointing</span></div>
  </div>;
}
