/** Ephemeral invitation timing, never a stored engagement score. */
export type ReflectionTiming={activeSeconds:number;actions:number;lastInput:number};
export function reflectionTick(state:ReflectionTiming,now:number,eligible:boolean):{state:ReflectionTiming;invite:boolean}{
 if(!eligible||now-state.lastInput>45000||state.lastInput===0)return{state,invite:false};
 const next={...state,activeSeconds:state.activeSeconds+15};
 return{state:next,invite:next.activeSeconds>=240&&next.actions>=8};
}
