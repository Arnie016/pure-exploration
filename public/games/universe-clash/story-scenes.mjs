import {CHAPTERS, normalizeStory, chapterUnlocked} from './story.mjs';

// Direction and dialogue stay outside the combat simulation. No scene grants a win.
export const ARCS = Object.freeze([
  {id:'invitation',title:'The stolen sky',range:[0,7],color:'#edbe72',logline:'Enter the draw. Discover what the arena takes from its fighters.'},
  {id:'anchors',title:'The people who stay',range:[8,11],color:'#79cfd4',logline:'The defeated fighters become the only thing keeping their worlds alive.'},
  {id:'rebellion',title:'Break the bargain',range:[12,14],color:'#dc96ed',logline:'Reach the final while the others prepare to turn the tournament against itself.'},
  {id:'homecoming',title:'No one left behind',range:[15,15],color:'#91d2ad',logline:'The wish was never the answer. Bring every world home.'},
]);

// Establishing shot, consequence, extra exchange, and two contextual battle lines.
const direction = [
  ['A second sky hangs over the Lookout. Below it, a city flickers like a memory someone is trying to erase.',
   'The first bell fades. Under Krillin’s feet, a ring of light locks into place. He is still here. The tournament has kept something else.',
   ['krillin','When this is over, I’m telling everyone you nearly lost the first match.'],['goku','Nearly? You haven’t even hit me yet!'],
   ['piccolo','Watch the ring beneath you. It lights up every time either of you attacks.'],['krillin','There it is again. Whatever happens, don’t agree to that wish yet.']],
  ['Across a broken desert, sixteen pillars pulse in time with the fighters’ hearts. Vegeta counts them. One has stopped moving.',
   'Tien kneels beside the first anchor. His hands tremble. The ring steadies. Strength can hold a world together without winning a match.',
   ['tien','There are people on the other side of those cracks. They don’t get a second round.'],['vegeta','Then watch closely. Control is not the same as weakness.'],
   ['tien','You can guard a strike without giving the arena another blast to eat.'],['vegeta','It can measure my power. It cannot decide how I use it.']],
  ['The chamber’s endless white is broken by a long black seam. On the other side, Gohan hears a familiar school bell.',
   'Piccolo presses his palm to the seam. A classroom comes into focus. For a moment, someone on the other side waves back.',
   ['gohan','If we stop fighting, does it stop taking energy?'],['piccolo','The gate collapses. We need a better answer. Find it while you move.'],
   ['piccolo','Breathe. Recover your Ki while there’s space between us.'],['gohan','The anchors aren’t prisoners. They’re holding the seams apart.']],
  ['West City has become a street with no horizon. Trunks finds a shop window from his future beside a building he remembers losing.',
   'Eighteen catches the edge of the street as it begins to fold. Trunks reaches for her. She points him toward the next gate instead.',
   ['trunks','That window has my mother’s handwriting on it. It wasn’t there a moment ago.'],['android18','Then keep it in sight. Give yourself something to come back for.'],
   ['android18','Eyes up. The city needs you standing, not staring.'],['trunks','I’m done letting the past decide who gets saved.']],
  ['On a stolen shore of Namek, a perfect silver cup waits on an empty pedestal. Its reflection shows a throne that is not there.',
   'Frieza touches the cup. His reflection smiles before he does. For the first time, he steps away from the prize.',
   ['buu','Cup smells wrong. Like a promise with nothing inside.'],['frieza','For once, your vocabulary is adequate.'],
   ['buu','Buu can feel the little worlds shaking!'],['frieza','You may observe my technique. You may not take it.']],
  ['Cell’s arena rebuilds every broken tile before the dust settles. Seventeen watches the cracks. Each repair is a fraction slower.',
   'Seventeen leaves one cracked tile untouched. Beneath it, sixteen streams of light flow toward the same dark centre.',
   ['cell','It will reproduce every perfect move I show it.'],['android17','Then let’s show it a move it can’t understand. Helping someone who beat you.'],
   ['android17','It repeats patterns. Change yours before it finishes learning.'],['cell','A system without choice. That is not perfection.']],
  ['Inside the ice, Broly sees a hundred reflections of himself. All of them are shouting. Hit closes his eyes and counts one breath.',
   'One reflection lowers its hands. Then the others follow. Broly stands at his anchor, breathing to a rhythm of his own.',
   ['broly','If I let go, I might hurt everyone.'],['hit','You do not have to let go. Choose where the strength goes.'],
   ['hit','Watch me. When the pressure comes, leave the place it expects you to be.'],['broly','One breath. I can do one breath.']],
  ['Beerus’s world hangs above the void, its roots tied to the same sixteen streams. He lifts one finger. The roots tighten.',
   'Beerus lowers his hand. Somewhere far away, the trembling stops. Jiren understands why even a god needs someone else today.',
   ['jiren','You are holding back because of them.'],['beerus','Try not to sound so surprised. Now show me you can reach that seal.'],
   ['beerus','The champion gets through its shield. Everyone else becomes part of it.'],['jiren','Then the champion will open a door for everyone.']],
  ['The quarterfinal gate opens onto a world already burning. Trunks recognises the skyline. It is the future he has not lost yet.',
   'Trunks steps into an anchor voluntarily. The burning skyline slows, frozen one heartbeat from collapse.',
   ['trunks','If I become an anchor, I can buy you time.'],['goku','Then I’m borrowing it. Not keeping it. You hear me?'],
   ['trunks','Keep moving. I’ll hold the city when the match ends.'],['goku','Nobody here is a sacrifice. Not you, not anyone.']],
  ['Back at the Lookout, the anchors now shine through the floor. Gohan can hear Piccolo on the far side of the fracture.',
   'Gohan sends a pulse backward through his ring. For an instant, the machine’s heartbeat misses a beat.',
   ['gohan','What if the anchors send their energy back at the same moment?'],['vegeta','Then make certain Kakarot is listening when it happens.'],
   ['piccolo','Gohan, the current changes when a round ends. Remember the direction.'],['vegeta','You found its weakness. Now finish the match and use it.']],
  ['The silver cup is gone. In its place, the arena projects every wish Frieza has ever refused to speak aloud.',
   'Frieza fires once into the empty pedestal. The projection breaks. Seventeen quietly marks another ally on his count.',
   ['android17','Funny. It offered everyone else their home.'],['frieza','It has mistaken ambition for gullibility. An expensive error.'],
   ['android17','A wish that needs permission to leave is a cage.'],['frieza','Tell your friends I am cooperating for entirely selfish reasons.']],
  ['Hit lets a grain of dust fall. Between two bells, it hangs in the air. The shield is gone for exactly that long.',
   'Jiren takes the interval into his own rhythm. Outside, Hit turns toward the other anchors. Someone must give the signal.',
   ['jiren','Can you hold the opening?'],['hit','No. But I can tell you when to trust it.'],
   ['hit','Do not chase the opening. Be ready before it arrives.'],['jiren','I used to trust only strength. This will require more.']],
  ['Thirteen voices reach the semifinal arena. Some argue. One asks about pudding. For the first time, the silence at the core sounds afraid.',
   'Seventeen steps backward into the light. Across ten broken worlds, the anchors begin to answer one another.',
   ['goku','What did you promise Frieza?'],['android17','That you’d be insufferable if he let the machine beat you. Worked immediately.'],
   ['android17','Every anchor is ready. This is the last part I can do for you.'],['goku','You’ve already done enough. We take it from here.']],
  ['The final gate has room for one name. Vegeta looks at it, then at the second shadow standing beside his own.',
   'Jiren braces the final gate with both hands. It opens wider than its builders intended.',
   ['jiren','There was a time I would have taken that seal alone.'],['vegeta','There was a time I would have let you. We have both improved.'],
   ['jiren','The others are carrying the worlds. I will carry the opening.'],['vegeta','Then neither of us has an excuse to fall short.']],
  ['The last arena is an empty circle in a sky of ten worlds. No crowd. No cup. Two friends who would never call it that.',
   'The final bell rings. Sixteen anchors reverse at once. The champion’s gate opens into a darkness wearing a familiar face.',
   ['goku','We could just pretend to fight.'],['vegeta','If you suggest that again, I’m saving the worlds without you.'],
   ['piccolo','Hold your positions. Wait for the final bell.'],['vegeta','Whatever you have left, Kakarot. Now!']],
  ['The core borrows Jiren’s face. Beyond its shoulders are sixteen empty spaces where the worlds should be. Goku hears the others counting down.',
   'The stolen pieces find their places. A shop window. A classroom. A forest. Nobody receives a wish. Everyone receives a way home.',
   ['goku','You’ve copied every attack we showed you. There’s one thing you missed.'],['android17','The ones who lost never stopped fighting for us.'],
   ['trunks','We’re holding the way back. Keep going!'],['vegeta','You are not alone in there. Finish it, and come home.']],
];

export function arcFor(index) { return ARCS.find(arc=>index>=arc.range[0] && index<=arc.range[1]) || ARCS[0]; }
export function sceneLines(index, after=false) {
  const chapter=CHAPTERS[index], d=direction[index];
  if (!chapter || !d) return [];
  const narration={speaker:'narrator',text:d[after?1:0],shot:after?'aftermath':'wide'};
  const dialogue=(after?chapter.after:[...chapter.before,d[2],d[3]]).map(([speaker,text],i)=>({speaker,text,shot:i%2?'reverse':'close'}));
  return [narration,...dialogue];
}
export function chapterRecap(index) {
  if(index===0)return 'A fracture has stolen pieces of ten worlds. Sixteen fighters must enter a tournament to keep those worlds apart.';
  const previous=CHAPTERS[index-1];
  return previous ? direction[index-1][1] : '';
}
export function normalizeBookmark(value,progress) {
  if(!value || !chapterUnlocked(progress,value.chapter))return null;
  const after=value.after===true;
  if(after&&!normalizeStory(progress).completed.includes(CHAPTERS[value.chapter].id))return null;
  const lines=sceneLines(value.chapter,after);
  return {chapter:value.chapter,after,line:Number.isInteger(value.line)?Math.max(0,Math.min(lines.length-1,value.line)):0};
}
export function battleCue(index,elapsed,healthRatio,played) {
  const d=direction[index];if(!d)return null;
  const cue=!played.has(0)&&elapsed>=6?0:!played.has(1)&&played.has(0)&&(healthRatio<=.5||elapsed>=38)?1:-1;
  if(cue<0)return null;
  const [speaker,text]=d[4+cue];return {id:cue,speaker,text};
}
