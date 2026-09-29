/** Local teaching sky: recognisable star patterns at composed, fixed bearings. */
export type Aim = {azimuth:number;altitude:number};
export type RoomMood = 'moonlit'|'lamplight'|'aurora';
export const initialAim:Aim={azimuth:270,altitude:12};
export const skyPatterns=[
 {id:'cygnus',name:'Cygnus',azimuth:270,altitude:35,story:'Follow the long cross through the Milky Way. The familiar pattern joins stars at very different distances.',stars:[[0,-8],[0,0],[0,10],[-8,1],[8,1]],links:[[0,1],[1,2],[3,1],[1,4]]},
 {id:'orion',name:'Orion',azimuth:95,altitude:38,story:'Three close stars mark the belt. Try recognising the hourglass shape before switching its guide lines off.',stars:[[-7,10],[7,9],[-2,1],[0,0],[2,-1],[-6,-10],[6,-9]],links:[[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6],[0,1]]},
 {id:'cassiopeia',name:'Cassiopeia',azimuth:20,altitude:55,story:'A five-star zigzag makes a useful pattern to remember. Its apparent W changes orientation as the sky turns.',stars:[[-10,4],[-5,-3],[0,3],[5,-2],[10,7]],links:[[0,1],[1,2],[2,3],[3,4]]},
 {id:'ursa',name:'The Big Dipper',azimuth:155,altitude:64,story:'A familiar asterism within Ursa Major. Its bowl and bent handle are a pattern, rather than a separate constellation.',stars:[[-10,2],[-6,5],[-2,4],[2,1],[9,3],[8,-3],[1,-4]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]},
 {id:'scorpius',name:'Scorpius',azimuth:205,altitude:26,story:'Trace the curving body into a hooked tail. A constellation is a direction on the sky, not a group of nearby stars.',stars:[[-9,8],[-5,5],[-2,1],[0,-5],[4,-8],[8,-7],[10,-3]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]}
] as const;
export function skyDirection(azimuth:number,altitude:number):[number,number,number]{const a=azimuth*Math.PI/180,h=altitude*Math.PI/180;return[Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];}
export function angularSeparation(a:Aim,b:Aim){const u=skyDirection(a.azimuth,a.altitude),v=skyDirection(b.azimuth,b.altitude);return Math.acos(Math.max(-1,Math.min(1,u.reduce((n,x,i)=>n+x*v[i],0))))*180/Math.PI;}
export function bearingName(azimuth:number){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(((azimuth%360)+360)%360/45)%8];}
export function nearestPattern(aim:Aim){return [...skyPatterns].sort((a,b)=>angularSeparation(aim,a)-angularSeparation(aim,b))[0];}
