import AttentionWorkspace from './workspace';

export const metadata={
 title:'Attention Observatory · Pure Exploration',
 description:'An interactive 3D transformer attention laboratory. Change tokens, heads, temperature and masking to inspect real scaled dot-product attention.'
};

export default function AttentionPage(){return <AttentionWorkspace/>;}
