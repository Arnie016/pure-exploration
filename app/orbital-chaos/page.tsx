import type {Metadata} from 'next';
import OrbitalChaosLab from './lab';
export const metadata: Metadata = {title:'Three-Body Chaos Lab · Pure Exploration',description:'Build and perturb three gravitating bodies. Explore deterministic chaos in an interactive orbitable 3D simulation with energy diagnostics.'};
export default function OrbitalChaosPage(){return <OrbitalChaosLab/>;}
