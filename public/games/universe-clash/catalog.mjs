// Canon references and the distinction between transformations and game-only
// power releases are recorded in CHARACTER_RESEARCH.md. Ratings are game balance.
export const ROSTER = Object.freeze([
  { id:'goku', name:'Goku', universe:'Universe 7', role:'Adaptive martial artist', color:'#ff913d', speed:7, power:1, description:'A joyful challenger who reads your rhythm and keeps finding another limit.', ai:'adaptive', special:'Dragon Rush', beam:'Kamehameha', ultimate:'Spirit Bomb', rating:1000 },
  { id:'vegeta', name:'Vegeta', universe:'Universe 7', role:'Relentless ki pressure', color:'#579bff', speed:6.7, power:1.06, description:'Saiyan pride, disciplined pressure, and devastating punishment at range.', ai:'pressure', special:'Galick Volley', beam:'Final Flash', ultimate:'Final Explosion', rating:1020 },
  { id:'jiren', name:'Jiren', universe:'Universe 11', role:'Patient counter fighter', color:'#ff5364', speed:5.8, power:1.2, description:'Conserves every motion. Lets you commit. Answers with overwhelming force.', ai:'counter', special:'Power Wall', beam:'Power Impact', ultimate:'Limit Break Impact', rating:1180 },
  { id:'frieza', name:'Frieza', universe:'Universe 7', role:'Precision zoner', color:'#c18aff', speed:8, power:.88, description:'Elegant cruelty, razor-thin death beams, and a refusal to be outclassed.', ai:'zoner', special:'Death Saucer', beam:'Death Beam', ultimate:'Death Ball', rating:960 },
  { id:'beerus', name:'Beerus', universe:'Universe 7', role:'God of Destruction', color:'#c19cfa', speed:7.1, power:1.22, description:'A languid destroyer. Interrupt his peace and discover how little effort he needs.', ai:'counter', special:'Forehead Flick', beam:'Sphere of Destruction', ultimate:'Planet Destroyer', rating:1250 },
  { id:'gohan', name:'Gohan', universe:'Universe 7', role:'Protective counter attacker', color:'#c8a1ff', speed:6.9, power:1.03, description:'Gentle until someone needs protecting. Hidden potential becomes explosive resolve.', ai:'reactive', special:'Burst Rush', beam:'Kamehameha', ultimate:'Special Beam Cannon', rating:990 },
  { id:'piccolo', name:'Piccolo', universe:'Universe 7', role:'Tactical reach fighter', color:'#8ccb70', speed:6.2, power:1.06, description:'An analytical mentor with commanding reach and carefully measured aggression.', ai:'tactical', special:'Explosive Wave', beam:'Special Beam Cannon', ultimate:'Light Grenade', rating:1010 },
  { id:'trunks', name:'Trunks', universe:'Universe 7', role:'Sword burst specialist', color:'#86bdf2', speed:7.5, power:.97, description:'The future taught him urgency. A decisive sword strike ends an unsafe opening.', ai:'rush', special:'Lightning Sword Slash', beam:'Burning Attack', ultimate:'Sword of Hope', rating:975 },
  { id:'android18', name:'Android 18', universe:'Universe 7', role:'Efficient kick pressure', color:'#8aa8ed', speed:7.3, power:.94, description:'Cool, practical, and unimpressed. Efficient strings outlast reckless energy use.', ai:'efficient', special:'Accel Dance', beam:'Destructo Disc', ultimate:'Infinity Barrage', rating:965 },
  { id:'cell', name:'Cell', universe:'Universe 7', role:'Analytical perfectionist', color:'#9bcd4d', speed:6.7, power:1.08, description:'A calculating perfectionist who studies repeated habits and turns them against you.', ai:'adaptive', special:'Perfect Barrier', beam:'Kamehameha', ultimate:'Solar Kamehameha', rating:1070 },
  { id:'buu', name:'Majin Buu', universe:'Universe 7', role:'Unpredictable elastic brawler', color:'#f39dcb', speed:5.6, power:1.15, description:'Playful, elastic, and alarmingly powerful. Never mistake his appetite for innocence.', ai:'erratic', special:'Candy Beam', beam:'Innocence Cannon', ultimate:'Angry Explosion', rating:1050 },
  { id:'hit', name:'Hit', universe:'Universe 6', role:'Time-skip punish specialist', color:'#a89bc8', speed:7.6, power:.98, description:'A quiet professional who learns your timing, then punishes the same opening.', ai:'assassin', special:'Time Skip', beam:'Flash Fist', ultimate:'Time Cage', rating:1080 },
  { id:'broly', name:'Broly', universe:'Universe 7', role:'Escalating power bruiser', color:'#b4ed73', speed:6.1, power:1.19, description:'A kind heart fighting a rising storm. Give him room, or face an eruption.', ai:'berserker', special:'Raging Quake', beam:'Gigantic Roar', ultimate:'Gigantic Catastrophe', rating:1150 },
  { id:'android17', name:'Android 17', universe:'Universe 7', role:'Barrier and stamina tactician', color:'#78d4a1', speed:7.2, power:.97, description:'A pragmatic ranger who uses barriers and patient positioning to protect his team.', ai:'efficient', special:'Android Barrier', beam:'Photon Flash', ultimate:'Infinity Barrage', rating:985 },
  { id:'krillin', name:'Krillin', universe:'Universe 7', role:'Feint and precision specialist', color:'#f5b56a', speed:7.7, power:.87, description:'A resourceful martial artist who turns smart footwork and distraction into openings.', ai:'tactical', special:'Solar Flare', beam:'Kamehameha', ultimate:'Destructo Disc', rating:910 },
  { id:'tien', name:'Tien', universe:'Universe 7', role:'Disciplined control fighter', color:'#91c7ae', speed:6.6, power:1.02, description:'A disciplined martial artist who controls space and commits everything to a clear opening.', ai:'pressure', special:'Dodon Ray', beam:'Tri-Beam', ultimate:'Neo Tri-Beam', rating:930 },
].map(Object.freeze));

const form = (id,label,damage,speed,drain,minResolve,kiCost,aura,hair,kind='transformation',scale=1) => Object.freeze({id,label,damage,speed,drain,minResolve,kiCost,aura,hair,kind,scale});
export const FORMS = Object.freeze({
  goku: [
    form('base','Base',1,1,0,0,0,'#e7e4cf','#171723','base'),
    form('ss1','Super Saiyan',1.12,1.025,.3,15,20,'#ffd25e','#f8ca43'),
    form('ss2','Super Saiyan 2',1.24,1.045,.6,25,25,'#ffe98a','#ffce48'),
    form('ss3','Super Saiyan 3',1.39,1.055,3.8,35,30,'#fff0ad','#ffd35c'),
    form('god','Super Saiyan God',1.47,1.09,1.1,45,30,'#ff666c','#dc324a'),
    form('blue','Super Saiyan Blue',1.59,1.12,1.8,55,35,'#75ecff','#36bfee'),
    form('ui','Ultra Instinct',1.74,1.17,3.5,70,40,'#e4eaff','#d5dced','technique'),
  ],
  vegeta: [
    form('base','Base',1,1,0,0,0,'#e7e4cf','#141622','base'),
    form('ss1','Super Saiyan',1.13,1.025,.3,15,20,'#ffd363','#f8cf48'),
    form('ss2','Super Saiyan 2',1.25,1.045,.6,25,25,'#ffe8a1','#fbd254'),
    form('god','Super Saiyan God',1.43,1.08,1.1,38,30,'#ff666c','#dc324a'),
    form('blue','Super Saiyan Blue',1.57,1.11,1.6,52,35,'#7ce8ff','#32aeee'),
    form('blue-evolved','Blue Evolved',1.72,1.13,3,68,40,'#629cff','#1d73d8', 'transformation',1.06),
  ],
  jiren: [form('base','Restrained',1,1,0,0,0,'#d96167',null,'base'),form('full-power','Full Power',1.35,1.06,1.5,28,30,'#ff534b',null,'release',1.1),form('limit-break','Limit Break',1.58,1.1,3,60,40,'#ffad80',null,'release',1.15)],
  frieza: [form('final','Final Form',1,1,0,0,0,'#c58aef',null,'base'),form('full-power','Full Power',1.22,.98,1.2,20,25,'#d0aaff',null,'release',1.12),form('golden','Golden Frieza',1.55,1.09,2.2,48,35,'#ffce64',null)],
  beerus: [form('suppressed','Suppressed',1,1,0,0,0,'#a57cd9',null,'base'),form('destroyer','Destroyer Power',1.3,1.06,1.2,25,30,'#c077ff',null,'release'),form('hakai','Destruction Unleashed',1.56,1.1,2.4,60,40,'#edafff',null,'release')],
  gohan: [form('base','Base',1,1,0,0,0,'#e3d9fc','#111321','base'),form('ss1','Super Saiyan',1.12,1.025,.3,15,20,'#ffdc74','#fbd35b'),form('ss2','Super Saiyan 2',1.26,1.05,.7,27,25,'#fff0ad','#fbd86d'),form('ultimate','Ultimate Gohan',1.47,1.09,.8,43,30,'#eee9ff','#111321','release'),form('beast','Beast Gohan',1.74,1.13,2.7,67,40,'#e4bfff','#e2deed')],
  piccolo: [form('base','Base',1,1,0,0,0,'#afe28a',null,'base'),form('unleashed','Potential Unleashed',1.24,1.04,.5,24,25,'#dde986',null,'release'),form('orange','Orange Piccolo',1.6,1.07,1.8,53,35,'#ffb954',null,'transformation',1.18)],
  trunks: [form('base','Base',1,1,0,0,0,'#b9d9f4','#70b4da','base'),form('ss1','Super Saiyan',1.15,1.025,.3,16,20,'#ffdb70','#f3d15f'),form('ss2','Super Saiyan 2',1.29,1.055,.7,29,25,'#ffeeab','#f8d466'),form('rage','Super Saiyan Rage',1.57,1.11,2.1,52,35,'#93e7ff','#ffdc76')],
  android18: [form('base','Balanced Output',1,1,0,0,0,'#a4ceff','#ecd6a1','base'),form('overdrive','Energy Overdrive',1.26,1.1,.4,35,25,'#c5e9ff','#ecd6a1','technique')],
  cell: [form('perfect','Perfect Cell',1,1,0,0,0,'#b8e666',null,'base'),form('super-perfect','Super Perfect',1.45,1.08,1.7,43,35,'#d5f78c',null,'release',1.035)],
  buu: [form('good','Good Buu',1,1,0,0,0,'#f3b6df',null,'base'),form('angry','Angry Power',1.35,1.07,1.2,30,30,'#ff84b4',null,'release',1.035)],
  hit: [form('base','Time Skip',1,1,0,0,0,'#ada0d8',null,'base'),form('refined','Refined Time Skip',1.27,1.11,.8,30,25,'#b5b8ff',null,'technique'),form('awakened','Assassin Focus',1.49,1.16,1.8,58,35,'#e3d6ff',null,'technique')],
  broly: [form('base','Base',1,1,0,0,0,'#c5e28a','#171e1b','base'),form('wrathful','Wrathful',1.2,1.04,.6,17,20,'#c6e673','#171e1b','release',1.08),form('ss1','Super Saiyan',1.42,1.06,1.5,35,30,'#d5ef88','#c9dd57','transformation',1.15),form('full-power','Super Saiyan Full Power',1.72,1.08,3,62,40,'#b2f784','#91d448','transformation',1.25)],
  android17: [form('base','Balanced Output',1,1,0,0,0,'#a4e5c7','#171c20','base'),form('barrier-focus','Barrier Focus',1.24,1.08,.5,32,25,'#75eccb','#171c20','technique')],
  krillin: [form('base','Base',1,1,0,0,0,'#f6e2bb',null,'base'),form('focused-ki','Focused Ki',1.25,1.09,.7,28,25,'#ffe298',null,'technique')],
  tien: [form('base','Base',1,1,0,0,0,'#cfe7d1',null,'base'),form('tri-beam-focus','Tri-Beam Focus',1.3,1.04,1,30,25,'#c4ffe2',null,'technique')],
});
for (const forms of Object.values(FORMS)) Object.freeze(forms);

export const STAGES = Object.freeze([
  {id:'void',name:'Null Horizon',region:'WORLD OF VOID',tag:'COSMIC RUINS',color:'#b590e0',description:'A shattered tournament platform beneath a silent eclipse.'},
  {id:'namek',name:'Emerald Namek',region:'PLANET NAMEK',tag:'ALIEN WATERS',color:'#69cfb2',description:'Turquoise water, three suns, and bulb-crowned trees.'},
  {id:'wasteland',name:'Crimson Badlands',region:'EARTH',tag:'SUNSET CANYON',color:'#df9f6a',description:'Layered mesas and drifting dust in the last light.'},
  {id:'cell-games',name:'Perfect Arena',region:'EARTH',tag:'STONE TOURNAMENT',color:'#adc78b',description:'A precise square ring surrounded by mountain wilderness.'},
  {id:'glacier',name:'Frozen Frontier',region:'POLAR EARTH',tag:'ICE & AURORA',color:'#8bdcf3',description:'Blue ice spires, snowfields, and a shifting aurora.'},
  {id:'west-city',name:'West City Afterdark',region:'EARTH',tag:'NEON SKYLINE',color:'#f2a9c9',description:'Domed future towers and lit avenues under a neon sky.'},
  {id:'beerus-world',name:'Destroyer Sanctuary',region:'BEERUS\' WORLD',tag:'DIVINE GARDEN',color:'#cca1f2',description:'A monumental tree and floating temple above a still lake.'},
  {id:'lookout',name:'Celestial Lookout',region:'ABOVE EARTH',tag:'PALACE IN CLOUDS',color:'#f1d9a2',description:'White marble, golden domes, and an endless cloud sea.'},
  {id:'time-chamber',name:'Room Beyond Time',region:'HYPERBOLIC CHAMBER',tag:'INFINITE WHITE',color:'#ddd3b6',description:'An impossible white horizon framed by hourglasses.'},
  {id:'volcanic',name:'Molten Reckoning',region:'DYING WORLD',tag:'LAVA & OBSIDIAN',color:'#f49154',description:'Broken obsidian, glowing lava rivers, and ash in the air.'},
].map(Object.freeze));

export const PERSONAS = Object.freeze({
  goku:{pitch:1.15,rate:1.08,style:'Bright / determined',intro:'A new opponent. Let us see what we can learn.',transform:'I can push a little further!',win:'That was something. We should train again.',hurt:'That rhythm is tricky. Let me try again.'},
  vegeta:{pitch:.88,rate:1.05,style:'Proud / precise',intro:'Show me the results of your training.',transform:'I refuse to stop at this level.',win:'There is always another height to reach.',hurt:'You will not catch me twice.'},
  jiren:{pitch:.72,rate:.82,style:'Low / economical',intro:'Show me your resolve.',transform:'Then I will answer seriously.',win:'Strength without focus is wasted.',hurt:'Your resolve is improving.'},
  frieza:{pitch:1.18,rate:.96,style:'Polite / cutting',intro:'How persistent. Shall I make this unpleasant?',transform:'Allow me a more impressive demonstration.',win:'Do try to remember the difference.',hurt:'You have made a very poor decision.'},
  beerus:{pitch:.9,rate:.85,style:'Languid / imperious',intro:'All this noise, and still no dessert.',transform:'Perhaps a little more effort.',win:'Now, about that meal.',hurt:'You have my attention. Briefly.'},
  gohan:{pitch:1.02,rate:.96,style:'Thoughtful / resolute',intro:'I wanted peace. Now I will make room for it.',transform:'There is more in me than I thought.',win:'Everyone can breathe again.',hurt:'Focus. They are counting on me.'},
  piccolo:{pitch:.77,rate:.89,style:'Measured / dry',intro:'Your feet announce the strike before your fists.',transform:'Now watch carefully.',win:'Learn from this. Do not waste it.',hurt:'Interesting. I will adjust.'},
  trunks:{pitch:1.03,rate:1.08,style:'Urgent / earnest',intro:'I have seen hesitation cost lives. Not today.',transform:'This future is worth fighting for.',win:'One step closer to a better future.',hurt:'There is no time to slow down.'},
  android18:{pitch:1.06,rate:.94,style:'Relaxed / sardonic',intro:'You are spending a lot of energy to miss.',transform:'Fine. Let us finish the warm up.',win:'Was that worth the effort?',hurt:'That was almost interesting.'},
  cell:{pitch:.9,rate:.96,style:'Composed / theatrical',intro:'An interesting approach. Allow me to improve it.',transform:'A refinement you will appreciate.',win:'A useful demonstration of the difference.',hurt:'A flaw in the analysis. Corrected.'},
  buu:{pitch:1.4,rate:.94,style:'Buoyant / childlike',intro:'You fall down, then we have pudding!',transform:'Buu is not playing now!',win:'Buu wins! Snack time!',hurt:'That hurt. Buu does not like that.'},
  hit:{pitch:.76,rate:.85,style:'Quiet / professional',intro:'Your timing changed. Your opening did not.',transform:'The interval just became smaller.',win:'The work is complete.',hurt:'I have measured that now.'},
  broly:{pitch:.68,rate:.86,style:'Restrained / rising anger',intro:'Give me space. I am trying to hold it.',transform:'I cannot hold this back!',win:'It is quiet again.',hurt:'Please. Stay back.'},
  android17:{pitch:.96,rate:.92,style:'Calm / pragmatic',intro:'I will handle this side. Keep your eyes open.',transform:'Let us use that energy properly.',win:'A little planning goes a long way.',hurt:'That changes the plan. Not the goal.'},
  krillin:{pitch:1.12,rate:1.06,style:'Warm / resourceful',intro:'Size is not everything. Watch my footwork.',transform:'Steady breath. Make this one count.',win:'Smart training pays off!',hurt:'Still here. Time for a different angle.'},
  tien:{pitch:.83,rate:.9,style:'Disciplined / direct',intro:'Let your technique speak for itself.',transform:'All my focus. One clear opening.',win:'There is always more work to do.',hurt:'Hold the stance. Read the next strike.'},
});
