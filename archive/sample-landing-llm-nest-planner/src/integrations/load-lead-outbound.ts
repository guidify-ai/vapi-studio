import { existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import type { LeadOutbound } from './lead-outbound.types';
import { stubLeadOutbound } from './lead-outbound.stub';

const log = new Logger('LeadOutbound');

/**
 * Load never-committed `src/private/lead-outbound` when present.
 * Public clones get the stub only — no destinations, keys, or inboxes in git.
 */
export function loadLeadOutbound(): LeadOutbound {
  const dir = join(__dirname, '..', 'private');
  const js = join(dir, 'lead-outbound.js');
  const ts = join(dir, 'lead-outbound.ts');
  const file = existsSync(js) ? js : existsSync(ts) ? ts : null;
  if (!file) {
    log.log('Using stub outbound (src/private/lead-outbound not found)');
    return stubLeadOutbound;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as {
      leadOutbound?: LeadOutbound;
      default?: LeadOutbound;
      createLeadOutbound?: () => LeadOutbound;
    };
    if (typeof mod.createLeadOutbound === 'function') {
      return mod.createLeadOutbound();
    }
    return mod.leadOutbound || mod.default || stubLeadOutbound;
  } catch (err) {
    log.warn(`private outbound failed to load — using stub (${err})`);
    return stubLeadOutbound;
  }
}
