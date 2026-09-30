import test from 'node:test';import assert from 'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync,readdirSync}from'node:fs';
test('clean database accepts all migrations and exposes production tables',()=>{const db=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+name,'utf8'));for(const name of ['visitors','sessions','events','favorites_v2','presence','journeys','garden_feed','reactions','feedback','owner_sessions'])assert.ok(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name));db.prepare('INSERT INTO visitors(id,public_id,alias,color,seen) VALUES(?,?,?,?,?)').run('v','pub','Test Fox','amber',1);db.prepare('INSERT INTO presence(visitor,x,z,seen) VALUES(?,?,?,?)').run('v',1.25,2.5,1);assert.equal(db.prepare('SELECT x FROM presence').get().x,1.25);db.close();});

test('hosting migration journal registers every SQL migration in application order',()=>{
 const files=readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort();
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8')).entries;
 assert.deepEqual(journal.map(entry=>entry.tag+'.sql'),files);
 for(let i=0;i<journal.length;i++){assert.equal(journal[i].idx,i);if(i)assert.ok(journal[i].when>journal[i-1].when,'migration timestamps must increase');}
});

test('production billing tables preserve sandbox schema without copying its records',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
   if(name.startsWith('0011_'))db.prepare('INSERT INTO skyline_members VALUES(?,?,?,?)').run('sandbox-fixture','fixture-session-hash','fixture-recovery-hash',1);
   db.exec(readFileSync('drizzle/'+name,'utf8'));
  }
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'skyline_production_%'").all().map(row=>row.name);
  assert.equal(names.length,13);
  for(const production of names){
   const sandbox=production.replace('skyline_production_','skyline_');
   assert.deepEqual(db.prepare(`PRAGMA table_info(${production})`).all(),db.prepare(`PRAGMA table_info(${sandbox})`).all(),production+' columns');
   const foreignKeys=db.prepare(`PRAGMA foreign_key_list(${production})`).all().map(row=>({...row,table:row.table.replace('skyline_production_','skyline_')}));
   assert.deepEqual(foreignKeys,db.prepare(`PRAGMA foreign_key_list(${sandbox})`).all().map(row=>({...row})),production+' foreign keys');
   assert.equal(db.prepare(`SELECT count(*) AS n FROM ${production}`).get().n,0,production+' must start empty');
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM skyline_members').get().n,1);
 }finally{db.close();}
});
