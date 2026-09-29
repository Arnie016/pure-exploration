/** Hub edition: single documented CC0 mount. Original checkout is unchanged.
 * Animated GLB sampled across the flight clip: 6.063-unit native wingspan.
 * Normalize to 14 world units; the old 12x scale produced a 72.8-unit dragon. */
export const DRAGON_RIGS=Object.freeze([{id:'quaternius',asset:'licensed-assets/models/dragon_quaternius_cc0.glb',loreName:'Ember Wyrm',epithet:'Warden of the storm',note:'Animated dragon by Quaternius, CC0. Follow the beacons through the storm.',nativeFlightWingspan:6.063,worldWingspan:14,scale:14/6.063,flapClip:'DragonArmature|Dragon_Flying',glideClip:'DragonArmature|Dragon_Flying',licensed:true,default:true}]);
export function resolveRigFromQuery(){return DRAGON_RIGS[0];}
export function rigCatalog(){return DRAGON_RIGS;}
