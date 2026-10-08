// Deliberately narrow SIT policy. This is not a generic email instruction parser.
export function keycloakMailLink(text,{origin,realm}){
  if(typeof text!=='string'||text.length>128*1024||!/^cro-sit-[a-f0-9]{12}$/.test(realm))throw new Error('Invalid mail input');
  if(!['http://127.0.0.1:18251','http://127.0.0.1:18261'].includes(origin))throw new Error('Invalid SIT origin');
  const candidates=[...text.matchAll(/https?:\/\/[^\s<>"']+/g)].map(m=>m[0]);
  const links=new Set();
  for(const candidate of candidates){
    const u=new URL(candidate);
    if(u.origin!==origin||u.username||u.password||u.hash||u.pathname!==`/realms/${realm}/login-actions/action-token`)throw new Error('Unexpected mail link');
    const keys=[...u.searchParams.keys()];
    if(keys.some(k=>!['key','client_id','tab_id','client_data'].includes(k))||new Set(keys).size!==keys.length||!u.searchParams.get('key'))throw new Error('Unexpected link parameters');
    links.add(u.href);
  }
  if(links.size!==1)throw new Error('Missing or ambiguous mail link');
  return [...links][0];
}
