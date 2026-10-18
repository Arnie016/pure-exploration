import * as T from 'three';
import {intensityAt,type InterferenceSettings} from './physics';
export function detectorFace(s:InterferenceSettings){
 const canvas=document.createElement('canvas');
 canvas.width=256;canvas.height=64;
 const ctx=canvas.getContext('2d');
 if(ctx)for(let i=0;i<256;i++){const v=intensityAt((i/256-.5)*80,s);ctx.fillStyle='rgb(10,'+Math.round(30+180*v)+',140)';ctx.fillRect(i,0,1,64);}
 const texture=new T.CanvasTexture(canvas);
 return {material:new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}),texture};
}
