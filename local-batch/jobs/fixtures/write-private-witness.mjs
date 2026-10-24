// Checkout-only observation file: complete before visibility, never replace a target.
import { writeFileSync, linkSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export function writePrivateWitness(directory, name, value) {
  const temporary = path.join(directory, '.witness-' + randomUUID() + '.tmp');
  let primary;
  try {
    writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    linkSync(temporary, path.join(directory, name));
  } catch (error) { primary = error; throw error; }
  finally {
    try { unlinkSync(temporary); }
    catch (error) {
      if (error.code !== 'ENOENT') throw primary ? new AggregateError([primary, error], 'Witness publication and private cleanup failed', { cause: primary }) : error;
    }
  }
}
