import { generatePassword } from './password-generator.js';

export class RotationOrchestrator {
  #active = new Set();

  constructor({ vault, runner, events, recoveryStore }) {
    this.vault = vault;
    this.runner = runner;
    this.events = events;
    this.recoveryStore = recoveryStore;
  }

  async rotate({ accountId, template, passwordLength = 24 }) {
    if (this.#active.has(accountId)) return {status:'blocked', reason:'rotation_in_progress'};
    this.#active.add(accountId);
    const subject = `account/${accountId}`;
    let site;
    let enteredRunner = false;
    let remoteChanged = false;
    let reason = 'prepare_failed';
    try {
      site = template.manifest.allowedOrigins[0];
      if (await this.recoveryStore.has?.(accountId)) {
        return {status:'blocked', reason:'recovery_pending'};
      }
      this.events.emit('credential.rotation.started', subject, {
        site, template:template.id, templateVersion:template.version
      });
      const credential = await this.vault.getCredential(accountId);
      const nextPassword = generatePassword(passwordLength);
      // Fail closed: persist the candidate before a browser can submit it.
      // Real runners must supply a durable private store; memory is simulation only.
      await this.recoveryStore.put(accountId, nextPassword);
      enteredRunner = true;
      remoteChanged = null; // A thrown runner cannot prove that submission did not occur.
      reason = 'remote_outcome_unknown';
      const change = await this.runner.execute({template, credential, nextPassword});
      remoteChanged = change.remoteChanged === true ? true : change.remoteChanged === false ? false : null;
      if (remoteChanged !== true || change.verified !== true) {
        reason = remoteChanged === false ? 'remote_change_rejected' : 'remote_verification_failed';
        if (remoteChanged === false) await this.recoveryStore.clear?.(accountId);
        throw new Error('Unverified remote change');
      }
      reason = 'vault_update_failed';
      await this.vault.updateCredential(accountId, nextPassword);
      reason = 'vault_readback_failed';
      const stored = await this.vault.getCredential(accountId);
      if (stored.password !== nextPassword || stored.username !== credential.username) {
        throw new Error('Vault readback mismatch');
      }
      reason = 'recovery_cleanup_failed';
      await this.recoveryStore.clear?.(accountId);
      this.events.emit('credential.rotation.succeeded', subject, {site, template:template.id});
      return {status:'succeeded', remoteChanged:true, vaultUpdated:true};
    } catch {
      const ambiguous = enteredRunner && remoteChanged !== false;
      // Adapter/browser exception messages can contain credentials or URLs.
      this.events.emit(ambiguous ? 'credential.rotation.state_ambiguous' : 'credential.rotation.failed', subject, {site, reason});
      return {status:ambiguous ? 'ambiguous' : 'failed', remoteChanged, vaultUpdated:false};
    } finally {
      this.#active.delete(accountId);
    }
  }
}
