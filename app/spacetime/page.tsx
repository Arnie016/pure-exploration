import {redirect} from 'next/navigation';
export const metadata={title:'Space-Time Laboratory · Light Years From Home',description:'The original Solar System Laboratory: orbital dynamics, light paths, relativity and guided physics experiments.'};
export default function SpacetimePage(){redirect('/world/spacetime');}
