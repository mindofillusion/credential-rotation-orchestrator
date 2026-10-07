// Execute the locally signed fixture recipes; never print vault or browser secrets.
const base='http://127.0.0.1:18787';
const rounds=Number(process.argv[2] || 2);
if(!Number.isInteger(rounds)||rounds<1||rounds>2)throw new Error('Usage: node sit/forums/regression.mjs [1|2]');
const first=await fetch(base+'/api/overview');
if(!first.ok)throw new Error('SIT UI unavailable');
const overview=await first.json();
if(overview.forums?.length!==3)throw new Error('Three fixtures must be enabled');
for(let round=1;round<=rounds;round++)for(const engine of ['phpbb','mybb','smf']) {
 const fixture=overview.forums.find(f=>f.engine===engine);
 if(!fixture?.account||fixture.recoveryPending||fixture.running)throw new Error(`Fixture unavailable: ${engine}`);
 const versions=overview.templates.filter(t=>t.id===`org.${engine}.sit-password`);
 // Avoid silently selecting an unvalidated new version.
 const version='0.1.0';
 if(!versions.some(t=>t.version===version))throw new Error(`Missing pinned recipe: ${engine}`);
 const response=await fetch(base+'/api/sit/forums/run',{method:'POST',headers:{'content-type':'application/json',origin:base,'x-cro-sit-token':overview.sitToken},body:JSON.stringify({engine,id:`org.${engine}.sit-password`,version})});
 const result=await response.json();
 const passed=response.ok&&result.status==='succeeded'&&['remoteChanged','vaultUpdated','newPasswordLogin','oldPasswordRejected','vaultReadbackLogin'].every(k=>result[k]===true)&&result.recoveryPending===false;
 console.log(JSON.stringify({engine,round,passed,completedAt:result.completedAt,templateDigest:result.templateDigest}));
 if(!passed)throw new Error(`Regression stopped on ${engine}; inspect local recovery state before retrying`);
}
