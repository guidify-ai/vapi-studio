import { Injectable } from '@nestjs/common';
import type {
  FormDisposeAdapter,
  FormDisposePayload,
} from '@guidify-ai/vapi-studio';

/**
 * Flow Studio dispose adapter id: `studio-developer-tools-chat`.
 * Dispose is a no-op success — the form lives on FormsService pending;
 * Studio polls GET …/forms/pending, ACKs, opens the modal, then submits.
 */
@Injectable()
export class StudioFormDisposeAdapter implements FormDisposeAdapter {
  readonly id = 'studio-developer-tools-chat';
  /** Delivery lane: Flow Studio modal (poll + ACK from UI). */
  readonly branch = 'studio';

  async dispose(_payload: FormDisposePayload): Promise<void> {
    // UI discovers via FormsService.getPending (polled during the open turn).
  }
}
