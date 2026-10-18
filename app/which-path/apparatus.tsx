'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
export default function Apparatus(){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState(false);
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false});}catch{setError(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.3));
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,60);
  camera.position.set(6,6,12);camera.lookAt(0,0,0);
  const material=new THREE.MeshStandardMaterial({color:0x34545b,metalness:.7,roughness:.35});
  const geometry=new THREE.BoxGeometry(8,.3,4);
  scene.add(new THREE.Mesh(geometry,material));
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const resize=()=>{const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
  const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  return()=>{observer.disconnect();geometry.dispose();material.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="wi-apparatus" ref={host}>{error&&<p>WebGL preview unavailable. The experiment remains usable below.</p>}</div>;
}
