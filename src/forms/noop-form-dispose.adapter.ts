import { Injectable } from '@nestjs/common';
import type {
  FormDisposeAdapter,
  FormDisposePayload,
} from './form.types';

/**
 * Default dispose — phone / unknown channels cannot show a Studio modal.
 * FormsService treats dispose failure / missing ACK as deliver timeout so
 * Nodes can fall back to voice collection.
 */
@Injectable()
export class NoopFormDisposeAdapter implements FormDisposeAdapter {
  readonly id = 'noop';
  readonly branch = 'unavailable';

  async dispose(_payload: FormDisposePayload): Promise<void> {
    // Intentionally no-op: nothing to show; ACK will never arrive.
  }
}
