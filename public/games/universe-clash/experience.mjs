import {ROSTER,FORMS,STAGES} from './catalog.mjs';
import {ATTACHMENTS,GEAR_SLOTS} from './gear.mjs';
import {SAGA,CHAPTERS,DRAW,normalizeStory,chapterUnlocked,completeChapter} from './story.mjs';
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = s => document.querySelector(s);
const fighters = Object.fromEntries(ROSTER.map(f=>[f.id,f]));
export const BADGES = Object.freeze([
  {id:'first-hit',title:'First contact',text:'Land your first hit.',xp:25},
  {id:'launcher',title:'A little rhythm',text:'Land a launcher combo.',xp:50},
  {id:'blink',title:'Gone in a flash',text:'Use an aimed teleport.',xp:25},
  {id:'prop',title:'Improvisation',text:'Throw an arena object.',xp:40},
  {id:'transform',title:'Beyond your limits',text:'Complete a transformation.',xp:60},
  {id:'perfect',title:'Read the moment',text:'Evade a real attack with perfect timing.',xp:75},
  {id:'victory',title:'One to remember',text:'Win a match against AI.',xp:100},
  {id:'pit',title:'Last fighter standing',text:'Win a 12-fighter pit.',xp:150},
  {id:'saga',title:'Everyone comes home',text:'Complete The Convergence.',xp:300},
]);

export function createExperience(api) {
  let progress = normalizeStory(api.read('convergence-v1',null));
  const raw = api.read('milestones-v1',[]);
  const earned = new Set(Array.isArray(raw) ? raw.filter(id=>BADGES.some(b=>b.id===id)) : []);
  let activeChapter = -1, lastWon = false, line = 0, sceneAfter = false, studioIndex = 0, studioTab = 'forms', toastTimer;
  let studioRotation = .4;
  const header = (eyebrow,title,id) => `<header class="dialog-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="${id}">${title}</h2></div><button data-close aria-label="Close ${title}">×</button></header>`;
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="story-dialog" class="screen-dialog" aria-labelledby="saga-heading">
      ${header('AN ORIGINAL FAN SAGA · SAVED IN THIS BROWSER','The Convergence','saga-heading')}
      <div class="dialog-body saga-layout"><section class="saga-intro"><span class="eyebrow">A TOURNAMENT AT THE END OF EVERYTHING</span><h3>What if winning<br>was the trap?</h3><p>${esc(SAGA.opening)}</p><button id="saga-continue" class="primary-button">Begin saga ↗</button><p id="saga-progress"></p><details><summary>The sixteen-fighter draw</summary><div id="saga-draw"></div></details></section><section id="episode-list" aria-label="Story episodes"></section></div>
    </dialog>
    <dialog id="scene-dialog" class="screen-dialog" aria-labelledby="scene-title">
      ${header('THE CONVERGENCE','Before the bell','scene-title')}
      <div class="scene-stage"><img id="scene-arena" alt=""><div class="scene-title-card"><span class="eyebrow" id="scene-act"></span><h3 id="scene-chapter"></h3><p id="scene-objective"></p></div><div class="dialogue-panel"><img id="scene-portrait" alt=""><div><span id="scene-speaker" class="eyebrow"></span><p id="scene-line"></p><small id="scene-count"></small></div></div></div>
      <div class="scene-actions"><button id="scene-skip">Skip dialogue</button><button id="scene-next" class="primary-button">Next →</button></div>
    </dialog>
    <dialog id="studio-dialog" class="screen-dialog" aria-labelledby="studio-title">
      ${header('16 FIGHTERS · LIVE 3D','Fighter Studio','studio-title')}
      <div class="studio-layout"><aside><span id="studio-number" class="eyebrow"></span><h3 id="studio-name"></h3><p id="studio-role"></p><p id="studio-bio"></p><div class="studio-switch"><button id="studio-prev" aria-label="Previous fighter">←</button><button id="studio-next" aria-label="Next fighter">→</button></div><div id="studio-roster" role="group" aria-label="Select fighter"></div></aside><div class="studio-view" aria-label="Live full-body fighter preview"><label>Rotate fighter<input id="studio-rotation" aria-label="Rotate fighter" type="range" min="-3.14" max="3.14" step=".01" value=".4"></label><button id="studio-select" class="primary-button">Use this fighter ↗</button></div><aside class="studio-detail"><div class="studio-tabs"><button data-studio-tab="forms" aria-pressed="true">Forms</button><button data-studio-tab="gear" aria-pressed="false">Gear</button><button data-studio-tab="moves" aria-pressed="false">Moves</button></div><div id="studio-content"></div></aside></div>
    </dialog>
    <dialog id="path-dialog" class="wide-dialog" aria-labelledby="path-title">${header('KI IS SPENT · RESOLVE IS EARNED','Your transformation path','path-title')}<div class="dialog-body"><p>Land hits to earn Resolve. Stop and hold T to refill Ki. Meet both requirements, then press R. Each advanced form consumes Ki over time.</p><div id="path-content"></div></div></dialog>
    <dialog id="achievements-dialog" class="wide-dialog" aria-labelledby="achievement-title">${header('YOUR FIGHTER JOURNEY','Milestones','achievement-title')}<div class="dialog-body"><p id="achievement-total"></p><div id="achievement-list"></div></div></dialog>
    <dialog id="credits-dialog" aria-labelledby="credits-title">${header('UNOFFICIAL FAN PROJECT','Credits','credits-title')}<div class="dialog-body"><h3>Dragon Ball</h3><p>Original characters and universe created by Akira Toriyama. Dragon Ball rights belong to their respective owners, including Bird Studio / Shueisha and Toei Animation.</p><h3>Universe Clash</h3><p>Fan game by Arnav. The Convergence is an original, non-canon fan story. Procedural 3D characters, environments, game balance and synthesized sound belong to this game’s implementation.</p><h3>Technology</h3><p>Three.js · MIT License. Original arena gateway and training demonstrations retained from the existing project.</p></div></dialog>
  `);

  function save(key,value) { api.save(key,value); }
  function portrait(id) { return api.portraits.get(id) || ''; }
  function formsMarkup(id,current = -1,interactive = false) {
    return FORMS[id].map((form,i)=>`<${interactive?'button':'article'} class="path-step ${i===current?'current':''}" ${interactive?`data-studio-form="${i}" aria-pressed="${i===current}"`:''}><span class="form-index" style="--form-color:${form.aura}">${String(i+1).padStart(2,'0')}</span><span><b>${esc(form.label)}</b><small>${i?`${form.minResolve} Resolve + ${form.kiCost} Ki`:'Starting form'}${i?` · ${form.drain} Ki/s upkeep`:''}</small></span>${i===current?'<em>NOW</em>':''}</${interactive?'button':'article'}>`).join('');
  }
  function openStory() {
    $('#saga-progress').textContent = `${progress.completed.length} / ${CHAPTERS.length} episodes completed`;
    $('#saga-continue').textContent = progress.completed.length===CHAPTERS.length ? 'Replay the saga ↗' : progress.completed.length ? 'Continue saga ↗' : 'Begin saga ↗';
    $('#episode-list').innerHTML = CHAPTERS.map((c,i)=>`<button class="episode-card" data-episode="${i}" ${chapterUnlocked(progress,i)?'':'disabled'}><span>${String(i+1).padStart(2,'0')}</span><div><small>${c.act} · ${fighters[c.player].name} vs ${fighters[c.rival].name}</small><b>${esc(c.title)}</b></div><em>${progress.completed.includes(c.id)?'✓':chapterUnlocked(progress,i)?'↗':'LOCKED'}</em></button>`).join('');
    $('#saga-draw').innerHTML = DRAW.map(([a,b])=>`<p>${esc(fighters[a].name)} <small>vs</small> ${esc(fighters[b].name)}</p>`).join('');
    api.show('story-dialog');
  }
  function renderLine() {
    const chapter = CHAPTERS[activeChapter], lines = sceneAfter ? chapter.after : chapter.before;
    const [speaker,text] = lines[line];
    $('#scene-act').textContent = `${chapter.act} · EPISODE ${activeChapter+1} / ${CHAPTERS.length}`;
    $('#scene-chapter').textContent = chapter.title;
    $('#scene-objective').textContent = sceneAfter ? 'Match complete' : chapter.objective;
    $('#scene-speaker').textContent = fighters[speaker]?.name || speaker;
    $('#scene-line').textContent = text;
    const speakerPortrait = portrait(speaker);
    $('#scene-portrait').hidden = !speakerPortrait;
    if (speakerPortrait) $('#scene-portrait').src = speakerPortrait;
    else $('#scene-portrait').removeAttribute('src');
    $('#scene-portrait').alt = fighters[speaker]?.name || speaker;
    $('#scene-arena').src = api.stageImages.get(chapter.stage) || '';
    $('#scene-count').textContent = `${line+1} / ${lines.length}`;
    $('#scene-next').textContent = line===lines.length-1 ? sceneAfter ? activeChapter===CHAPTERS.length-1 ? 'Everyone comes home →' : 'Next episode →' : 'Enter the fight →' : 'Next →';
  }
  function scene(index,after = false) {
    if (!chapterUnlocked(progress,index)) return;
    activeChapter = index; sceneAfter = after; line = 0;
    api.closeAll(); api.preview(CHAPTERS[index]); renderLine(); api.show('scene-dialog');
  }
  function finishScene() {
    api.closeAll();
    if (!sceneAfter) { lastWon = false; api.startEpisode(CHAPTERS[activeChapter],activeChapter); }
    else if (activeChapter+1<CHAPTERS.length) scene(activeChapter+1);
    else { api.menu(); openStory(); }
  }
  $('#saga-continue').addEventListener('click',()=>scene(progress.completed.length===CHAPTERS.length?0:progress.completed.length));
  $('#episode-list').addEventListener('click',event=>{const b=event.target.closest('[data-episode]');if(b)scene(Number(b.dataset.episode));});
  $('#scene-next').addEventListener('click',()=>{const lines=sceneAfter?CHAPTERS[activeChapter].after:CHAPTERS[activeChapter].before;if(++line<lines.length)renderLine();else finishScene();});
  $('#scene-skip').addEventListener('click',finishScene);

  function renderStudio() {
    const id = ROSTER[studioIndex].id, fighter = fighters[id], selection = api.selection();
    $('#studio-number').textContent = `${String(studioIndex+1).padStart(2,'0')} / 16 · ${fighter.universe}`;
    $('#studio-name').textContent = fighter.name;
    $('#studio-role').textContent = fighter.role;
    $('#studio-bio').textContent = fighter.description;
    $('#studio-roster').innerHTML = ROSTER.map(f=>`<button data-studio-fighter="${f.id}" aria-label="Preview ${esc(f.name)}" aria-pressed="${f.id===id}"><img src="${portrait(f.id)}" alt="" loading="lazy"></button>`).join('');
    document.querySelectorAll('[data-studio-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.studioTab===studioTab)));
    if (studioTab==='forms') $('#studio-content').innerHTML = `<p class="studio-note">Preview any form. In battle, earn its requirements.</p>${formsMarkup(id,selection.form,true)}${id==='goku'?'<p class="studio-note">This edition follows SS3 → God → Blue → Ultra Instinct. SS4 is not in this form path.</p>':''}`;
    if (studioTab==='moves') $('#studio-content').innerHTML = `<p class="studio-note">${esc(fighter.description)}</p><div class="move-entry"><kbd>J J K</kbd><b>Launcher combo</b><small>Two strikes, then heavy</small></div><div class="move-entry"><kbd>F</kbd><b>${esc(fighter.special)}</b><small>20 Ki</small></div><div class="move-entry"><kbd>U</kbd><b>${esc(fighter.beam)}</b><small>35 Ki</small></div><div class="move-entry"><kbd>V</kbd><b>${esc(fighter.ultimate)}</b><small>100 Ki</small></div><button id="studio-train" class="primary-button">Practice this fighter ↗</button>`;
    if (studioTab==='gear') $('#studio-content').innerHTML = `<p class="studio-note">One item per slot · ${selection.loadout.length} / 5 equipped</p>${GEAR_SLOTS.map(slot=>`<h4>${slot}</h4>${ATTACHMENTS.filter(g=>g.slot===slot).map(g=>`<button class="gear-choice" data-studio-gear="${g.id}" aria-pressed="${selection.loadout.includes(g.id)}"><b>${esc(g.name)}</b><small>${esc(g.description)}</small></button>`).join('')}`).join('')}`;
  }
  function openStudio() {
    studioIndex = Math.max(0,ROSTER.findIndex(f=>f.id===api.selection().fighter));
    api.closeAll(); renderStudio(); api.show('studio-dialog');
  }
  function changeFighter(index) { studioIndex=(index+ROSTER.length)%ROSTER.length;api.select(ROSTER[studioIndex].id);renderStudio(); }
  $('#studio-prev').addEventListener('click',()=>changeFighter(studioIndex-1));
  $('#studio-next').addEventListener('click',()=>changeFighter(studioIndex+1));
  $('#studio-roster').addEventListener('click',e=>{const b=e.target.closest('[data-studio-fighter]');if(b)changeFighter(ROSTER.findIndex(f=>f.id===b.dataset.studioFighter));});
  $('#studio-select').addEventListener('click',()=>api.closeAll());
  $('#studio-rotation').addEventListener('input',e=>{studioRotation=Number(e.target.value);});
  document.querySelectorAll('[data-studio-tab]').forEach(b=>b.addEventListener('click',()=>{studioTab=b.dataset.studioTab;renderStudio();}));
  $('#studio-content').addEventListener('click',e=>{
    const form=e.target.closest('[data-studio-form]'),gear=e.target.closest('[data-studio-gear]');
    if(form){api.form(Number(form.dataset.studioForm));renderStudio();}
    if(gear){api.gear(gear.dataset.studioGear);renderStudio();}
    if(e.target.closest('#studio-train'))api.train(ROSTER[studioIndex].id);
  });
  let swipeStart;
  $('.studio-view').addEventListener('pointerdown',e=>{if(e.target.matches('input,button'))return;swipeStart=e.clientX;});
  $('.studio-view').addEventListener('pointerup',e=>{if(Number.isFinite(swipeStart)&&Math.abs(e.clientX-swipeStart)>65)changeFighter(studioIndex+(e.clientX<swipeStart?1:-1));swipeStart=null;});
  $('.studio-view').addEventListener('pointercancel',()=>{swipeStart=null;});

  function award(id) {
    if(earned.has(id))return;
    const badge=BADGES.find(b=>b.id===id);if(!badge)return;
    earned.add(id);save('milestones-v1',[...earned]);
    const node=$('#achievement-toast');node.textContent=`${badge.title} · +${badge.xp} XP`;node.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.hidden=true;},3300);
  }
  function openAchievements() {
    const xp=BADGES.filter(b=>earned.has(b.id)).reduce((n,b)=>n+b.xp,0);
    $('#achievement-total').textContent=`Fighter level ${1+Math.floor(xp/200)} · ${xp} XP · ${earned.size} / ${BADGES.length} milestones · saved in this browser`;
    $('#achievement-list').innerHTML=BADGES.map(b=>`<article class="milestone ${earned.has(b.id)?'earned':''}"><span>${earned.has(b.id)?'✓':'◇'}</span><div><b>${b.title}</b><p>${b.text}</p></div><small>${b.xp} XP</small></article>`).join('');
    api.show('achievements-dialog');
  }
  return {
    openStory,openStudio,openAchievements,
    studio:()=>({open:$('#studio-dialog').open,rotation:studioRotation}),
    openPath(fighter){$('#path-title').textContent=`${fighters[fighter.char].name} · Form path`;$('#path-content').innerHTML=formsMarkup(fighter.char,fighter.form);api.show('path-dialog');},
    result(win){
      lastWon=win;
      if(win){progress=completeChapter(progress,activeChapter);save('convergence-v1',progress);if(progress.completed.length===CHAPTERS.length)award('saga');}
      return CHAPTERS[activeChapter];
    },
    advance(){if(lastWon)scene(activeChapter,true);else scene(activeChapter);},
    observe(event,localSlot){
      if(event.owner!==localSlot)return;
      if(event.type==='hit')award('first-hit');
      if(event.type==='combo'&&event.kind==='launcher')award('launcher');
      if(event.type==='transform')award('transform');
      if(event.type==='prop'&&event.kind==='throw')award('prop');
      if(event.type==='dodge'&&event.evadeKind==='vanish')award('blink');
      if(event.type==='dodge'&&event.kind==='perfect')award('perfect');
    },
    win(kind){award('victory');if(kind==='pit')award('pit');},
  };
}
