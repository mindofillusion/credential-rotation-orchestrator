import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export function defaultDataDirectory({platform=process.platform,env=process.env,home=homedir()}={}) {
  if(platform==='win32')return join(env.LOCALAPPDATA || join(home,'AppData','Local'),'CredentialRotationOrchestrator');
  if(platform==='darwin')return join(home,'Library','Application Support','CredentialRotationOrchestrator');
  const base=env.XDG_DATA_HOME && isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : join(home,'.local','share');
  return join(base,'credential-rotation-orchestrator');
}
