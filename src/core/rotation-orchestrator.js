import { generatePassword } from './password-generator.js';

export class RotationOrchestrator {
  constructor({ vault, runner, events, recoveryStore }) {
    this.vault = vault;
    this.runner = runner;
    this.events = events;
    this.recoveryStore = recoveryStore;
  }

  async rotate({ accountId, template, passwordLength = 24 }) {
    const subject = `account/${accountId}`;
    this.events.emit('credential.rotation.started', subject, {
      site: template.manifest.allowedOrigins[0],
      template: template.id,
      templateVersion: template.version
    });

    const credential = await this.vault.getCredential(accountId);
    const nextPassword = generatePassword(passwordLength);
    let remoteChanged = false;

    try {
      const change = await this.runner.execute({ template, credential, nextPassword });
      remoteChanged = change.remoteChanged === true;
      if (!remoteChanged || change.verified !== true) {
        throw new Error('Remote change could not be verified in a fresh session');
      }

      try {
        await this.vault.updateCredential(accountId, nextPassword);
      } catch (error) {
        await this.recoveryStore.put(accountId, nextPassword);
        this.events.emit('credential.rotation.state_ambiguous', subject, {
          site: template.manifest.allowedOrigins[0],
          reason: 'vault_update_failed',
          message: error.message
        });
        return { status: 'ambiguous', remoteChanged: true, vaultUpdated: false };
      }

      this.events.emit('credential.rotation.succeeded', subject, {
        site: template.manifest.allowedOrigins[0],
        template: template.id
      });
      return { status: 'succeeded', remoteChanged: true, vaultUpdated: true };
    } catch (error) {
      const type = remoteChanged
        ? 'credential.rotation.state_ambiguous'
        : 'credential.rotation.failed';
      this.events.emit(type, subject, {
        site: template.manifest.allowedOrigins[0],
        message: error.message
      });
      return { status: remoteChanged ? 'ambiguous' : 'failed', remoteChanged, vaultUpdated: false };
    }
  }
}
