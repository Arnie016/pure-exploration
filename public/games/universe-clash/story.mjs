// An original, non-canon fan saga. Every episode launches the real combat engine.
export const SAGA = {
  title:'THE CONVERGENCE',
  premise:'Sixteen fighters. Ten fractured worlds. One wish that could erase them all.',
  opening:'A second sky appears above Earth. Trunks follows the fracture to Null Horizon, an arena assembled from stolen pieces of ten worlds. Its keeper offers a tournament: sixteen entrants, one champion, one wish to put everything back. Piccolo notices the catch. Every transformation makes the fracture grow.',
};
const episode = (id, act, title, player, rival, stage, objective, before, after) => Object.freeze({id,act,title,player,rival,stage,objective,before,after});
export const CHAPTERS = Object.freeze([
  episode('first-bell','ROUND OF 16','A sky that doesn’t belong','goku','krillin','lookout','Win the opening match as Goku.',[
    ['trunks','That tear was above my city yesterday. Today there is no city underneath it.'],
    ['piccolo','Sixteen signatures hold the gate open. If even one of us leaves, the worlds collide.'],
    ['krillin','So we win a tournament to save everything. No pressure, right?'],
    ['goku','Then let’s figure it out together. Don’t go easy on me, Krillin.'],
  ],[['krillin','You win. But look at the sky. That thing got bigger when you powered up.'],['goku','Yeah. I felt it taking something.']]),
  episode('measured-power','ROUND OF 16','The price of pride','vegeta','tien','wasteland','Win as Vegeta. Use guard to create an opening.',[
    ['tien','The arena is counting every burst of energy. Restraint may matter more than strength.'],
    ['vegeta','I know exactly how much force I need. Stand ready.'],
  ],[['tien','You held back the final blast.'],['vegeta','The machine wanted it. That was reason enough.']]),
  episode('mentor','ROUND OF 16','Listen between the blows','gohan','piccolo','time-chamber','Win as Gohan. Charge safely between exchanges.',[
    ['piccolo','You’re watching the fracture. Watch my shoulders. Save the worlds after you survive this punch.'],
    ['gohan','You really don’t change your teaching style.'],
  ],[['piccolo','Each defeated fighter becomes an anchor. That is why the gate stays open.'],['gohan','So losing doesn’t mean we’re out of this.']]),
  episode('future-debt','ROUND OF 16','A future worth keeping','trunks','android18','west-city','Win as Trunks in West City.',[
    ['android18','Whatever happened in your future, I’m not that person.'],
    ['trunks','I know. This time I get to fight for a future, not against the past.'],
    ['android18','Good. Then stop apologizing and move.'],
  ],[['android18','Tell Seventeen the winner’s wish is a trap. The walls have a heartbeat.']]),
  episode('sweet-deal','ROUND OF 16','A very generous offer','frieza','buu','namek','Win as Frieza. Keep your distance from Buu.',[
    ['frieza','A single wish. Such a waste in the hands of these sentimental amateurs.'],
    ['buu','Buu wishes for the sky to stop breaking. Then pudding.'],
    ['frieza','How touching. I shall try to remember the order.'],
  ],[['buu','Bad machine ate Buu’s big attack. Buu did not say it could!'],['frieza','Then it has been stealing from both of us. Unacceptable.']]),
  episode('perfect-error','ROUND OF 16','The flaw in perfection','android17','cell','cell-games','Win as Android 17. Punish predictable attacks.',[
    ['cell','An arena that learns from combat. Finally, architecture with taste.'],
    ['android17','It’s not learning. It’s feeding. And you’re making yourself the main course.'],
  ],[['cell','It copied my output, but not my judgment.'],['android17','First useful thing you’ve said. Help the anchors hold.']]),
  episode('quiet-second','ROUND OF 16','One quiet second','hit','broly','glacier','Win as Hit. Teleport to escape pressure.',[
    ['broly','The noise won’t stop. Every time I get angry, it gets louder.'],
    ['hit','Then follow my breathing. One second. Nothing else.'],
  ],[['broly','I can hear myself again.'],['hit','Keep that rhythm. We will need your strength without its anger.']]),
  episode('gods-watch','ROUND OF 16','When a god pays attention','jiren','beerus','beerus-world','Win as Jiren against Beerus’s restrained trial.',[
    ['beerus','I could erase the arena. Unfortunately, it has wrapped itself around your worlds.'],
    ['jiren','Then give me a path to its centre.'],
    ['beerus','Win your match first. Even catastrophes have rules.'],
  ],[['beerus','There. The champion’s seal reaches the core. Break the seal from inside.']]),
  episode('borrowed-time','QUARTERFINAL','Borrowed time','goku','trunks','volcanic','Win as Goku and keep the tournament moving.',[
    ['trunks','The anchors are holding, but the dying world is already bleeding through.'],
    ['goku','Then we make this quick. And afterward, we bring your city back.'],
  ],[['trunks','Promise me you’ll come back from the core.'],['goku','Save me a spot at the table.']]),
  episode('inheritance','QUARTERFINAL','What strength is for','vegeta','gohan','lookout','Win as Vegeta.',[
    ['gohan','We can’t keep feeding it just to climb the bracket.'],
    ['vegeta','Then make every strike count. That was always the lesson.'],
  ],[['gohan','Piccolo found a way to reverse the anchors. We need the finalists together.']]),
  episode('wishbreaker','QUARTERFINAL','No one owns the wish','android17','frieza','namek','Win as Android 17.',[
    ['frieza','Give me the seal, and I may consider returning your delightful little planet.'],
    ['android17','I protect a nature reserve. I’ve heard better offers from poachers.'],
  ],[['frieza','If that machine thinks it can use me as a battery, it has miscalculated.'],['android17','Great. Aim that attitude at the core.']]),
  episode('interval','QUARTERFINAL','The missing interval','jiren','hit','time-chamber','Win as Jiren and uncover the core’s timing.',[
    ['hit','Between rounds, its shield disappears for one second.'],
    ['jiren','One second is enough. Show me exactly when.'],
  ],[['hit','The opening is yours. Do not hesitate.']]),
  episode('trust','SEMIFINAL','Trust the ones behind you','goku','android17','west-city','Win as Goku.',[
    ['android17','The others are ready. Even Frieza. Don’t ask what I promised him.'],
    ['goku','You’re sure the anchors can take it?'],
    ['android17','That’s our part. Yours is getting to the final.'],
  ],[['android17','No wish. No deal. Bring everyone home.']]),
  episode('pride','SEMIFINAL','Beyond a solitary strength','vegeta','jiren','wasteland','Win as Vegeta.',[
    ['jiren','If the seal can hold only one champion, one of you must stay.'],
    ['vegeta','Then the seal is badly designed. I’m not leaving Kakarot to fix it alone.'],
  ],[['jiren','Then fight together. I will hold the interval open.']]),
  episode('last-bell','FINAL','The last bell','goku','vegeta','void','Win the final as Goku to open the champion’s gate.',[
    ['vegeta','One last match. No excuses. No machine decides which of us is stronger.'],
    ['goku','I wouldn’t have it any other way. After this, we break the rules together.'],
    ['piccolo','Everyone, take your positions. When the bell rings, reverse the flow.'],
  ],[['vegeta','There’s your opening, Kakarot. Make it count.'],['goku','All sixteen of us. Right now!']]),
  episode('home','AFTERMATH','The worlds answer','goku','jiren','glacier','Defeat the core’s Jiren echo. The real Jiren holds the gate outside.',[
    ['jiren','It has made an echo of my strength. It has not learned why I use it.'],
    ['goku','Then let’s teach it something new.'],
    ['krillin','We’re all here, Goku. Every single one of us.'],
  ],[['trunks','The sky is whole. I can see my city.'],['broly','It’s quiet.'],['beerus','Excellent. Now someone explain why there is still no food.'],['goku','Hey, Vegeta. Same time next week?'],['vegeta','Only if you’re ready to lose.']]),
]);

export const DRAW = CHAPTERS.slice(0,8).map(c => [c.player,c.rival]);
export function normalizeStory(value) {
  const completed = [];
  for (const chapter of CHAPTERS) {
    if (!Array.isArray(value?.completed) || !value.completed.includes(chapter.id)) break;
    completed.push(chapter.id);
  }
  return {version:1,completed};
}
export function chapterUnlocked(progress, index) { return Number.isInteger(index) && index >= 0 && index < CHAPTERS.length && index <= normalizeStory(progress).completed.length; }
export function completeChapter(progress, index) {
  const next = normalizeStory(progress);
  if (chapterUnlocked(next,index) && !next.completed.includes(CHAPTERS[index].id)) next.completed.push(CHAPTERS[index].id);
  return next;
}
