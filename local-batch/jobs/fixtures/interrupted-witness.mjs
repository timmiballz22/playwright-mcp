// Trusted actual-filesystem interruption immediately before atomic publication.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
const link = fs.linkSync;
fs.linkSync = function(temporary, target) {
  process.send({ stage: 'before_link', temporary: path.basename(temporary), targetAbsent: !fs.existsSync(target), value: JSON.parse(fs.readFileSync(temporary, 'utf8')) });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  return Reflect.apply(link, this, [temporary, target]);
};
syncBuiltinESMExports();
const { writePrivateWitness } = await import('./write-private-witness.mjs');
writePrivateWitness(process.argv[2], 'witness.json', { calibration: true });
