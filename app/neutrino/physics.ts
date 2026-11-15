/** Vacuum three-flavour neutrino oscillations. No matter potential or decoherence.
 * Teaching parameters (normal ordering) adapted from Bari 2026.a preliminary:
 * https://global-nu.org/ (accessed 2026-11-15). They are not a fitted model.
 */
export type Flavor = 0 | 1 | 2;
export const FLAVORS = ['Electron', 'Muon', 'Tau'] as const;
export const COLORS = ['#ffcb82', '#68d7f1', '#c7a1ff'] as const;
export const MIXING = {
  sin2theta12: .3047, sin2theta13: .02218, sin2theta23: .491,
  dm21: 7.465e-5, dm31: 2.472e-3 + 7.465e-5 / 2,
  defaultDelta: 214.2,
} as const;
const PHASE = 1.2669328; // sin^2(1.267 Δm²[eV²] L[km]/E[GeV])
type Complex = {re:number;im:number};
const real = (re:number):Complex => ({re,im:0});
const add = (a:Complex,b:Complex):Complex => ({re:a.re+b.re,im:a.im+b.im});
const multiply = (a:Complex,b:Complex):Complex => ({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const conjugate = (a:Complex):Complex => ({re:a.re,im:-a.im});
const cis = (phase:number):Complex => ({re:Math.cos(phase),im:Math.sin(phase)});
const scale = (a:Complex,s:number):Complex => ({re:a.re*s,im:a.im*s});

/** Standard PDG PMNS parameterization, U[flavour][mass eigenstate]. */
export function pmns(deltaDeg = MIXING.defaultDelta):Complex[][] {
  const s12=Math.sqrt(MIXING.sin2theta12),c12=Math.sqrt(1-MIXING.sin2theta12);
  const s13=Math.sqrt(MIXING.sin2theta13),c13=Math.sqrt(1-MIXING.sin2theta13);
  const s23=Math.sqrt(MIXING.sin2theta23),c23=Math.sqrt(1-MIXING.sin2theta23);
  const phase=cis(deltaDeg*Math.PI/180),negPhase=conjugate(phase);
  return [
    [real(c12*c13),real(s12*c13),scale(negPhase,s13)],
    [add(real(-s12*c23),scale(phase,-c12*s23*s13)),add(real(c12*c23),scale(phase,-s12*s23*s13)),real(s23*c13)],
    [add(real(s12*s23),scale(phase,-c12*c23*s13)),add(real(-c12*s23),scale(phase,-s12*c23*s13)),real(c23*c13)],
  ];
}
export type OscillationInput={initial:Flavor;energyGeV:number;baselineKm:number;deltaDeg:number;antineutrino:boolean};
/** P(alpha -> beta) = |sum_i U[beta,i] U*[alpha,i] exp(-i m_i^2 L/2E)|^2.
 * The antineutrino case complex-conjugates U. The global mass phase is removed.
 */
export function probabilities({initial,energyGeV,baselineKm,deltaDeg,antineutrino}:OscillationInput):[number,number,number] {
  const U=pmns(deltaDeg),energy=Math.max(.001,Number.isFinite(energyGeV)?energyGeV:1);
  const length=Math.max(0,Number.isFinite(baselineKm)?baselineKm:0);
  const masses=[0,MIXING.dm21,MIXING.dm31];
  const out=([0,1,2] as Flavor[]).map(target=>{
    let amplitude:Complex=real(0);
    for(let i=0;i<3;i++){
      const source=antineutrino?U[initial][i]:conjugate(U[initial][i]);
      const detector=antineutrino?conjugate(U[target][i]):U[target][i];
      amplitude=add(amplitude,multiply(multiply(source,detector),cis(-2*PHASE*masses[i]*length/energy)));
    }
    return amplitude.re**2+amplitude.im**2;
  });
  return [out[0],out[1],out[2]];
}
export type OscillationPoint={km:number;p:[number,number,number]};
export function sampleProbabilities(input:Omit<OscillationInput,'baselineKm'>,maxKm=1600,steps=120):OscillationPoint[]{
  const n=Math.max(2,Math.min(300,Math.round(steps)));
  return Array.from({length:n+1},(_,i)=>({km:maxKm*i/n,p:probabilities({...input,baselineKm:maxKm*i/n})}));
}
