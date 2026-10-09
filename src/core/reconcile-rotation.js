import {createHash} from 'node:crypto';
import {canonicalJson} from './canonical-json.js';

export const recoveryBinding=template=>createHash('sha256').update(canonicalJson(template)).digest('hex');

// The durable account lock covers reads, site probes, writes and cleanup.
// verifyCredential performs only a fresh login, never a password change.
export async function reconcileRotation({accountId,template,vault,runner,recoveryStore,authGuard}) {
  if(!authGuard)return {status:'blocked',reason:'site_authentication_guard_required'};
  if(typeof recoveryStore.withLock!=='function')return {status:'blocked',reason:'durable_lock_unavailable'};
  try{return await recoveryStore.withLock(accountId,()=>reconcileLocked({accountId,template,vault,runner,recoveryStore,authGuard}));}
  catch{return {status:'ambiguous',reason:'recovery_lock_failed'};}
}

async function reconcileLocked({accountId,template,vault,runner,recoveryStore,authGuard}) {
  let reason='recovery_read_failed';
  try {
    const pending=await recoveryStore.get(accountId);
    const {credential,binding}=pending.context||{};
    if(!credential||binding!==recoveryBinding(template)||typeof pending.password!=='string'||!pending.password)return {status:'blocked',reason:'recovery_context_mismatch'};
    reason='site_verification_failed';
    const candidate={...credential,password:pending.password};
    if(await authGuard.attempt(template.manifest.allowedOrigins[0],()=>runner.verifyCredential({template,credential:candidate}))!==true)return {status:'ambiguous',reason};
    reason='vault_read_failed';
    const current=await vault.getCredential(accountId);
    if(current.username!==credential.username)return {status:'blocked',reason:'vault_identity_changed'};
    if(current.password!==pending.password){
      if(current.password!==credential.password)return {status:'blocked',reason:'vault_modified_since_rotation'};
      // The adapter must enforce an atomic revision precondition; ordinary PUT is insufficient.
      if(typeof vault.compareAndUpdateCredential!=='function')return {status:'blocked',reason:'conditional_write_unavailable'};
      reason='vault_write_failed';
      await vault.compareAndUpdateCredential(accountId,pending.password,current);
    }
    reason='vault_readback_failed';
    const stored=await vault.getCredential(accountId);
    if(stored.password!==pending.password||stored.username!==credential.username)return {status:'ambiguous',reason};
    reason='vault_credential_login_failed';
    if(await authGuard.attempt(template.manifest.allowedOrigins[0],()=>runner.verifyCredential({template,credential:stored}))!==true)return {status:'ambiguous',reason};
    reason='recovery_cleanup_failed';await recoveryStore.clear(accountId);
    return {status:'succeeded',vaultUpdated:true,reconciled:true};
  }catch{return {status:'ambiguous',reason};}
}
