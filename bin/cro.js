#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultDataDirectory } from '../src/server/data-directory.js';

const args=process.argv.slice(2);
if(args.includes('--help')) {
  console.log(`Credential Rotation Orchestrator\n\nUsage: cro [--port 8787] [--data-dir DIRECTORY]\n\nIndependent local application. Open http://127.0.0.1:8787.\nDefault mode: simulation and signed template workshop.\nReal SIT rotations require explicitly configured fixtures.\nStop with Ctrl+C. No system service or SER5 integration is installed.`);
} else if(args.includes('--version')) {
  console.log(JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
} else {
  const legacy=fileURLToPath(new URL('../.cro-data/',import.meta.url));
  // Keep an existing checkout's identity; never silently replace or migrate it.
  if(!process.env.CRO_DATA_DIR && !args.includes('--data-dir'))process.env.CRO_DATA_DIR=existsSync(legacy)?legacy:defaultDataDirectory();
  await import('../src/server/main.js');
}
