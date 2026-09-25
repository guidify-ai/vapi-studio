/**
 * EXAMPLE — Nest DI listener. Register via:
 *   VapiStudioModule.forRoot({ eventListeners: [AuditEventListener] })
 */
import { Injectable, Logger } from '@nestjs/common';
import type { StudioEvent, StudioEventListener } from '@guidify-ai/vapi-studio';

@Injectable()
export class AuditEventListener implements StudioEventListener {
  private readonly log = new Logger(AuditEventListener.name);

  async handle(event: StudioEvent): Promise<void> {
    if (event.type === 'ROUTE_DECISION' || event.type === 'ANALYTICS_TAG') {
      this.log.debug(`${event.type} ${event.conversationId ?? ''}`);
    }
  }
}
