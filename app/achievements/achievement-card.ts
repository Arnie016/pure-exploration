import {type Achievement} from '../achievement-model';
/** Original, self-contained image. No remote fonts or third-party artwork. */
export async function renderAchievementCard(badge:Achievement):Promise<Blob>{
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;
 const c=canvas.getContext('2d');if(!c)throw new Error('This browser could not create an image.');
 const gradient=c.createLinearGradient(0,0,1200,800);gradient.addColorStop(0,'#071820');gradient.addColorStop(1,'#183633');c.fillStyle=gradient;c.fillRect(0,0,1200,800);
 c.strokeStyle='#547575';c.lineWidth=1;c.strokeRect(38,38,1124,724);
 for(let i=0;i<82;i++){const x=70+(i*193%1060),y=70+(i*127%660);c.fillStyle=i%4?'#8baba933':'#edce9188';c.beginPath();c.arc(x,y,i%3?1:2,0,Math.PI*2);c.fill();}
 c.textAlign='center';c.fillStyle='#97bab7';c.font='600 20px sans-serif';c.fillText('PURE EXPLORATION',600,103);
 c.strokeStyle='#e9cb9255';c.beginPath();c.arc(600,278,100,0,Math.PI*2);c.stroke();c.beginPath();c.arc(600,278,86,0,Math.PI*2);c.stroke();
 c.fillStyle='#efce97';c.font='82px serif';c.fillText(badge.symbol,600,306);
 c.fillStyle='#f6f1dd';c.font='54px Georgia, serif';c.fillText(badge.title,600,463,1040);
 c.fillStyle='#b6cfca';c.font='24px sans-serif';c.fillText(badge.description,600,514,1020);
 c.fillStyle='#e9cb92';c.font='20px sans-serif';c.fillText('A little curiosity. A world of possibilities.',600,608);
 c.fillStyle='#9ab7b2';c.font='18px sans-serif';c.fillText('Worlds by @itsArnz · pure-exploration.arnz.chatgpt.site',600,682);
 c.fillStyle='#7b9995';c.font='15px sans-serif';c.fillText('Personal collection · saved on this device',600,721);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be created.')),'image/png'));
}
