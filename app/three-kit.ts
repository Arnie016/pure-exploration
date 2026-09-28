import * as T from 'three';
export const material=(color:number,roughness=.65,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
export function kit(group:T.Group|T.Scene){
 const add=(o:T.Mesh,x=0,y=0,z=0)=>{o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>add(new T.Mesh(new T.BoxGeometry(w,h,d),m),x,y,z);
 const cyl=(x:number,y:number,z:number,r:number,h:number,m:T.Material,rTop=r,sides=32)=>add(new T.Mesh(new T.CylinderGeometry(rTop,r,h,sides),m),x,y,z);
 const ball=(x:number,y:number,z:number,r:number,m:T.Material)=>add(new T.Mesh(new T.SphereGeometry(r,24,16),m),x,y,z);
 const rod=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material)=>{const mesh=new T.Mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),8),m);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());group.add(mesh);return mesh;};
 return{box,cyl,ball,rod,add};
}
export function textSprite(text:string,color='#d2e6db',size=2){const c=document.createElement('canvas');c.width=640;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(8,24,25,.86)';ctx.beginPath();ctx.roundRect(8,16,624,96,28);ctx.fill();ctx.font='500 34px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,320,78);const m=new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false});const sp=new T.Sprite(m);sp.scale.set(size,size*.2,1);return sp;}
export function disposeScene(scene:T.Object3D){const materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof T.Sprite)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>{const t=(m as T.MeshBasicMaterial).map;t?.dispose();m.dispose();});}
export const foxColors:Record<string,number>={amber:0xcd7c49,mint:0x5caaa1,silver:0x9daeb8,rose:0xc47b89};
export function fox(color='amber'){
 const root=new T.Group(),{ball,cyl,add}=kit(root),fur=material(foxColors[color]||foxColors.amber,.88),cream=material(0xffebce,.95),dark=material(0x14232a,.45),pink=material(0xc58b81),visor=material(0x7ce0d3,.2,.5);
 const body=ball(0,.68,0,.4,fur);body.scale.set(.78,1.15,1.1);const bib=ball(0,.88,.2,.28,cream);bib.scale.set(.85,1.25,.7);
 const head=ball(0,1.32,.09,.41,fur);head.scale.set(1.08,.9,1);const muzzle=ball(0,1.17,.4,.24,cream);muzzle.scale.set(1.3,.68,1);ball(0,1.22,.61,.065,dark);
 for(const sign of[-1,1]){const ear=add(new T.Mesh(new T.ConeGeometry(.19,.53,4),fur),sign*.27,1.72,.06);ear.rotation.z=-sign*.19;const inner=add(new T.Mesh(new T.ConeGeometry(.115,.34,4),pink),sign*.27,1.74,.105);inner.rotation.z=-sign*.19;ball(sign*.205,1.35,.405,.05,dark);ball(sign*.215,1.37,.435,.014,cream);const foot=ball(sign*.22,.16,.06,.16,dark);foot.scale.set(.8,.75,1.4);const arm=cyl(sign*.32,.65,.1,.095,.48,fur);arm.rotation.z=sign*.18;}
 const tailRoot=new T.Group();tailRoot.position.set(0,.5,-.31);root.add(tailRoot);const tail=new T.Mesh(new T.SphereGeometry(.26,24,16),fur);tail.scale.set(1,1,2.5);tail.position.set(.18,0,-.45);tail.rotation.y=-.36;tailRoot.add(tail);const tip=new T.Mesh(new T.SphereGeometry(.225,24,16),cream);tip.scale.set(.86,.95,1.15);tip.position.set(.38,.06,-.96);tailRoot.add(tip);
 const collar=cyl(0,1.03,.05,.28,.075,visor);collar.rotation.z=0;root.userData.tail=tailRoot;return root;
}
