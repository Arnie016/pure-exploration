import * as T from 'three';
import type {ShrinePortal} from './garden-shrines';

/** Screen-sized wayfinding, anchored above the actual shrine rather than to the HUD. */
export function buildPortalLabels(mount:HTMLElement,portals:ShrinePortal[],open:(id:string)=>void){
 const layer=document.createElement('div');layer.className='garden-portal-labels';mount.appendChild(layer);
 let focused='',last=0;const point=new T.Vector3();
 const labels=portals.map(portal=>{
  const button=document.createElement('button');button.type='button';button.className='garden-portal-label';button.hidden=true;
  button.style.setProperty('--portal-tint','#'+new T.Color(portal.color).getHexString());
  button.setAttribute('aria-label',`${portal.title}. ${portal.description} Enter this world.`);
  const name=document.createElement('strong');name.textContent=portal.title;
  const description=document.createElement('span');description.className='garden-portal-description';description.textContent=portal.description;
  button.appendChild(name);button.appendChild(description);layer.appendChild(button);
  button.addEventListener('click',()=>open(portal.id));
  button.addEventListener('pointerenter',()=>{focused=portal.id;});button.addEventListener('pointerleave',()=>{if(document.activeElement!==button)focused='';});
  button.addEventListener('focus',()=>{focused=portal.id;});button.addEventListener('blur',()=>{focused='';});
  return{portal,button};
 });
 return{
  isEngaged:()=>!!focused,
  setReveal:(value:number)=>{layer.style.opacity=String(value);},
  update(t:number,camera:T.PerspectiveCamera,visitor:T.Vector3,walking:boolean){
   if(t-last<100)return;last=t;const width=mount.clientWidth,height=mount.clientHeight,narrow=width<600;
   const boxes:{left:number;right:number;top:number;bottom:number}[]=[],bounds=mount.getBoundingClientRect();
   // Keep scenery labels clear of real controls and introductory copy.
   for(const control of mount.parentElement?.querySelectorAll<HTMLElement>('.garden-intro,.garden-presence,.garden-camera,.guardian-controls,.garden-feed')||[]){
    if(getComputedStyle(control).opacity==='0')continue;const b=control.getBoundingClientRect();boxes.push({left:b.left-bounds.left-8,right:b.right-bounds.left+8,top:b.top-bounds.top-8,bottom:b.bottom-bounds.top+8});
   }
   const candidates=labels.map(item=>{point.set(item.portal.x,walking?5.35:8.2,item.portal.z).project(camera);return{...item,x:(point.x*.5+.5)*width,y:(.5-point.y*.5)*height,z:point.z,distance:camera.position.distanceTo(new T.Vector3(item.portal.x,6,item.portal.z)),near:Math.hypot(visitor.x-item.portal.x,visitor.z-item.portal.z)<11};})
    .sort((a,b)=>a.portal.id===focused?-1:b.portal.id===focused?1:Number(b.near)-Number(a.near)||a.distance-b.distance);
   let shown=0;
   for(const item of candidates){
    const expanded=item.portal.id===focused||(walking&&item.near),w=expanded?(narrow?194:224):(narrow?143:176),h=expanded?105:44;
    const x=Math.max(w/2+12,Math.min(width-w/2-12,item.x)),y=walking?Math.max(h+80,item.y):item.y;
    const box={left:x-w/2,right:x+w/2,top:y-h,bottom:y+9};
    const collides=boxes.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top);
    const visible=item.z>-1&&item.z<1&&item.x>0&&item.x<width&&item.y>-100&&y>h+74&&y<height-(narrow?215:125)&&!collides&&shown<(narrow?3:7);
    item.button.hidden=!visible;if(!visible)continue;
    item.button.classList.toggle('is-near',expanded);item.button.style.width=`${w}px`;item.button.style.left=`${x}px`;item.button.style.top=`${y}px`;
    boxes.push(box);shown++;
   }
  },
  dispose(){layer.remove();}
 };
}
