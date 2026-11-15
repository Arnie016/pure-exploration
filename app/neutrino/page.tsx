import type {Metadata} from 'next';
import NeutrinoWorld from './neutrino-world';
export const metadata:Metadata={title:'Neutrino Oscillation Atlas · Pure Exploration',description:'An immersive three-flavour neutrino experiment. Change energy, detector distance, flavour and CP phase, then explore real vacuum oscillation probabilities in 3D.'};
export default function NeutrinoPage(){return <NeutrinoWorld/>;}
