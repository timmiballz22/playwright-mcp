import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [target,mode,childProof,parentProof] = process.argv.slice(2);
let status=0,stdout='',stderr='';
// Capture stderr solely for the parent-side assertion, then forward it exactly
// as execFileSync does by default. This child executes actual owned lifetimes.
try { stdout=execFileSync(process.execPath,['/tmp/native93-parent-observation-calibration.mjs',target,path.join(target,'scripts/verify-guardian-parent-death.mjs'),'parent_death',mode,childProof],{encoding:'utf8'}); }
catch(error) { status=error.status;stdout=error.stdout ?? '';stderr=error.stderr ?? ''; }
const child=JSON.parse(await fs.readFile(childProof,'utf8'));
await fs.writeFile(parentProof,JSON.stringify({mode,status,child,stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),stdoutHasObservation:stdout.includes('parent_death_initial_observation'),stdoutHasAcceptance:stdout.includes('durable_guardian')},null,2)+'\n',{flag:'wx',mode:0o600});
