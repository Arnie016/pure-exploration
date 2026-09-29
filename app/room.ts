import * as T from 'three';
/** Original procedural observing room. No downloaded models or textures. */
export function observingRoom(scene:T.Scene) {
 const root=new T.Group();root.name='The midnight study';scene.add(root);
 const mat=(c:number,roughness=.7,metalness=.1)=>new T.MeshStandardMaterial({color:c,roughness,metalness});
 const wood=mat(0x43312a),walnut=mat(0x261e1c),wall=mat(0x14242d),brass=mat(0xa88752,.32,.8),ink=mat(0x132d36),linen=mat(0xa9987c),leaf=mat(0x294e3c),glow=new T.MeshBasicMaterial({color:0xffd8a1});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;}
 function cyl(x:number,y:number,z:number,r:number,h:number,m:T.Material,r2=r){const o=new T.Mesh(new T.CylinderGeometry(r2,r,h,32),m);o.position.set(x,y,z);o.castShadow=true;root.add(o);return o;}
 // Open-front dollhouse: optical bench centered before a tall panoramic window.
 for(let i=0;i<22;i++)box(-9+i*.85,-2.4,-1,.825,.16,13,i%3?wood:walnut);
 box(0,-2.55,-1,19,.22,13,walnut);box(0,1.1,-7.3,19,7.3,.22,wall);
 // The objective looks along -X. Leave a genuine opening on that axis, not a wall or painting.
 box(-9.45,1.1,-5.45,.22,7.3,3.7,wall);box(-9.45,1.1,4.65,.22,7.3,1.7,wall);
 box(-9.45,-1.85,0,.22,1.25,7.2,wall);box(-9.45,4.45,0,.22,.9,7.2,wall);
 for(const z of[-3.6,3.6])box(-9.3,1.4,z,.2,5.3,.14,brass);
 for(const y of[-1.25,4.05])box(-9.3,y,0,.2,.14,7.35,brass);
 box(-9.2,-1.24,0,.75,.12,7.6,walnut);
 // Open shutters sit against the facade; no window pane in the observing beam.
 for(const z of[-4.1,4.1]){box(-9.15,1.35,z,.12,5.1,.85,ink);for(let i=0;i<17;i++)box(-9.05,-1+i*.29,z,.04,.025,.75,brass);}
 const outside=new T.MeshBasicMaterial({color:0x061322});box(-14.5,3,0,.1,16,24,outside);
 const mountain=new T.MeshStandardMaterial({color:0x172d36,roughness:1});
 for(let i=0;i<11;i++){const peak=new T.Mesh(new T.ConeGeometry(1.4+Math.sin(i*3.2)*.4,2.8+Math.cos(i*2.1),4),mountain);peak.position.set(-13,-1.6,-10+i*2);peak.rotation.y=i*.62;root.add(peak);}
 const outsideStars=new T.BufferGeometry(),starPoints=[];for(let i=0;i<120;i++)starPoints.push(-14.3,Math.abs(Math.sin(i*13.17))*10-1,Math.sin(i*29.3)*11);outsideStars.setAttribute('position',new T.Float32BufferAttribute(starPoints,3));root.add(new T.Points(outsideStars,new T.PointsMaterial({color:0xd1dde9,size:.035})));
 const observingMoon=new T.Mesh(new T.SphereGeometry(.38,24,18),new T.MeshBasicMaterial({color:0xd6e4e8}));observingMoon.position.set(-13.4,2.9,1.8);root.add(observingMoon);
 const windowLight=new T.DirectionalLight(0x8fc3dd,.55);windowLight.position.set(-12,5,0);windowLight.target.position.set(0,-1,0);root.add(windowLight,windowLight.target);
 
 const night=new T.MeshBasicMaterial({color:0x091321});box(1.2,1.8,-7.1,10.2,4.6,.1,night);
 for(const x of[-4.1,1.2,6.5])box(x,1.8,-6.95,.095,5,.16,brass);for(const y of[-.65,4.25])box(1.2,y,-6.95,10.75,.11,.22,brass);
 // Distant city, mountain ridge, stars beyond the glass.
 for(let i=0;i<28;i++){const x=-3.8+i*.36,h=.25+Math.abs(Math.sin(i*31.2))*.7;box(x,-.5+h/2,-7.01,.23,h,.06,ink);if(i%3===0)box(x,h/2-.35,-6.965,.025,.05,.025,glow);}
 let seed=31;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<120;i++){const star=new T.Mesh(new T.SphereGeometry(i%15===0?.025:.012,5,4),new T.MeshBasicMaterial({color:i%3?0xadcadc:0xfce3ad}));star.position.set(-3.8+rand()*9.8,.6+rand()*3.3,-7);root.add(star);}
 const moon=new T.Mesh(new T.SphereGeometry(.25,32,24),new T.MeshStandardMaterial({color:0xcacbbb,emissive:0x6d7f88,emissiveIntensity:.6,roughness:1}));moon.position.set(4.8,3.15,-6.9);root.add(moon);
 // A low optical table, brass edge, drawers, an open notebook.
 box(0,-2.13,0,7.8,.22,3.5,walnut);for(const z of[-1.72,1.72])box(0,-2.01,z,7.8,.025,.035,brass);for(const x of[-3.87,3.87])box(x,-2.01,0,.035,.025,3.5,brass);
 for(const x of[-3.4,3.4])for(const z of[-1.35,1.35])box(x,-2.27,z,.18,.42,.18,brass);
 box(-3,-1.95,1.15,.85,.045,.65,linen).rotation.y=.15;box(-2.56,-1.94,1.15,.035,.04,.65,walnut);for(let i=0;i<7;i++)box(-3,-1.918,.92+i*.065,.65,.002,.006,brass);
 cyl(2.9,-1.76,.94,.11,.4,brass);cyl(2.9,-1.55,.94,.15,.06,ink);cyl(3.3,-1.84,1.15,.16,.26,linen);
 // Floor rug and reading corner.
 box(4.8,-2.28,2.5,5,.025,4,ink);for(let i=0;i<8;i++)box(4.8,-2.26,.65+i*.51,4.8,.008,.012,brass);
 box(6.8,-1.7,-2.6,3,.55,1.65,ink);box(6.8,-1,-3.22,3,1.35,.3,ink);for(const x of[5.3,8.3])box(x,-1.2,-2.6,.3,1.1,1.65,ink);for(const x of[5.95,7.5])box(x,-1.36,-2.6,1.25,.16,1.4,linen);box(5.85,-.9,-2.9,.8,.6,.18,brass).rotation.z=.15;
 cyl(6.6,-1.8,.2,1.05,.16,wood);cyl(6.6,-2.05,.2,.15,.5,brass);box(6.5,-1.7,.2,.6,.09,.45,ink);
 // Tall bookshelf with individually varied books and celestial objects.
 for(const x of[-8.8,-6])box(x,.05,-5.95,.13,4.7,1.2,walnut);for(const y of[-2.18,-1.05,.1,1.25,2.38])box(-7.4,y,-5.95,3,.12,1.2,wood);
 const bookM=[ink,linen,brass,mat(0x674440),mat(0x607878)];for(let row=0;row<3;row++)for(let j=0;j<10;j++){const h=.5+rand()*.35;box(-8.5+j*.25,-.97+row*1.15+h/2,-5.8,.15+rand()*.07,h,.66,bookM[(j+row)%5]);box(-8.5+j*.25,-.77+row*1.15,-5.46,.08,.018,.005,brass);}
 const globe=new T.Mesh(new T.SphereGeometry(.37,32,24),ink);globe.position.set(-7.1,-1.65,-5.8);root.add(globe);const band=new T.Mesh(new T.TorusGeometry(.42,.015,8,64),brass);band.position.copy(globe.position);band.rotation.x=.25;root.add(band);cyl(-7.1,-2,-5.8,.13,.2,brass);
 // Warm reading lamp, plant, brass star chart.
 cyl(8,-1,-.2,.025,2.6,brass);cyl(8,-2.27,-.2,.35,.07,walnut);cyl(8,.35,-.2,.48,.55,linen,.22);const l=new T.PointLight(0xffcf96,22,10,2);l.position.set(8,.05,-.2);root.add(l);cyl(8,.05,-.2,.12,.08,glow);
 for(const [x,z]of[[-7.4,1.2],[7.5,-5.4]]){cyl(x,-1.85,z,.4,.8,walnut,.52);for(let i=0;i<15;i++){const a=i*2.4,blade=new T.Mesh(new T.SphereGeometry(1,10,8),leaf);blade.scale.set(.18,.7,.08);blade.position.set(x+Math.sin(a)*.4,-1.3+rand()*.6,z+Math.cos(a)*.4);blade.rotation.set(Math.cos(a)*.5,0,-Math.sin(a)*.5);root.add(blade);}}
 box(-5.25,2.05,-7.12,1.45,1.65,.06,brass);box(-5.25,2.05,-7.05,1.3,1.5,.05,ink);for(let i=0;i<25;i++){const star=new T.Mesh(new T.SphereGeometry(.018,6,5),glow);star.position.set(-5.83+rand()*1.18,1.38+rand()*1.34,-7);root.add(star);}
 // An instrument tray with eyepieces, adjustment tools and a second finder scope.
 box(2.25,-1.96,-1.15,2.4,.12,.62,ink);for(let i=0;i<4;i++){cyl(1.4+i*.46,-1.69,-1.15,.14,.45,walnut);cyl(1.4+i*.46,-1.46,-1.15,.13,.02,brass);cyl(1.4+i*.46,-1.444,-1.15,.105,.008,new T.MeshPhysicalMaterial({color:0x74a4bc,metalness:.6,roughness:.08}));}
 // A rolling astronomy cart, stacked atlases, and a small star tracker.
 box(4,-1.4,-5,1.6,.12,1.1,wood);box(4,-2,-5,1.6,.12,1.1,wood);for(const x of[3.3,4.7])for(const z of[-5.4,-4.6]){cyl(x,-1.85,z,.025,.95,brass);const wheel=new T.Mesh(new T.TorusGeometry(.11,.025,8,16),walnut);wheel.position.set(x,-2.25,z);root.add(wheel);}
 for(let i=0;i<4;i++)box(3.8,-1.85+i*.12,-5,.8,.1,.72,bookM[i]);cyl(4.2,-1.16,-5,.23,.35,ink);cyl(4.2,-.97,-5,.2,.03,brass);
 // Warm wall battens and ceiling beams give the room a readable architectural rhythm.
 for(let i=0;i<13;i++)box(7.15+i*.14,1.2,-7.1,.045,6.3,.1,wood);
 for(const z of[-6.8,-3.4,0,3.4])box(0,4.65,z,19,.19,.2,walnut);
 
 // Practical light paints the reading nook while the moon cuts shadows through the rafters.
 const readingPool=new T.SpotLight(0xffb968,75,12,.75,.8,1.7);readingPool.position.set(8,.16,-.2);readingPool.target.position.set(5.8,-2.3,1.2);root.add(readingPool,readingPool.target);
 const strip=new T.MeshBasicMaterial({color:0xe9a668});for(const y of[-1.02,.13,1.28])box(-7.4,y,-5.4,2.6,.025,.035,strip);
 const shelfLight=new T.PointLight(0xf1ba78,7,5,2);shelfLight.position.set(-7,1,-4.8);root.add(shelfLight);
 // Slim astronomical relief and a softly lit wall give the study depth without a flat backdrop.
 const orrery=new T.Group();orrery.position.set(6.6,-1.55,.2);root.add(orrery);for(let i=0;i<3;i++){const orbit=new T.Mesh(new T.TorusGeometry(.25+i*.12,.008,6,48),brass);orbit.rotation.set(Math.PI/2+i*.3,.25*i,0);orrery.add(orbit);const planet=new T.Mesh(new T.SphereGeometry(.045,12,8),i===1?glow:brass);planet.position.set(Math.cos(i*2)*(.25+i*.12),Math.sin(i)*.1,Math.sin(i*2)*(.25+i*.12));orrery.add(planet);}
 return root;
}
