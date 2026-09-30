import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
const built=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{stdio:'inherit',env:process.env});
if(built.error)throw built.error;
if(built.status!==0)process.exit(built.status||1);
// Glorp has no catalogue portal. Keep its source, exclude its unused hosted media.
rmSync('dist/client/games/glorp',{recursive:true,force:true});
