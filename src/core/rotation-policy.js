const TRIGGERS=new Set(['manual','compromised','weak','reused','periodic']);
export function evaluateRotationPolicy(policy,{accountId,origin,trigger='manual'}){
  if(!policy||policy.enabled!==true)return {allowed:false,reason:'rotation_not_enabled'};
  if(!Array.isArray(policy.accounts)||!policy.accounts.includes(accountId))return {allowed:false,reason:'account_not_authorized'};
  if(!Array.isArray(policy.origins)||!policy.origins.includes(origin))return {allowed:false,reason:'site_not_authorized'};
  if(!TRIGGERS.has(trigger)||!Array.isArray(policy.triggers)||!policy.triggers.includes(trigger))return {allowed:false,reason:'trigger_not_authorized'};
  if(trigger==='periodic'&&(policy.periodicEnabled!==true||typeof policy.periodicJustification!=='string'||policy.periodicJustification.trim().length<20))return {allowed:false,reason:'periodic_rotation_requires_justification'};
  return {allowed:true};
}
