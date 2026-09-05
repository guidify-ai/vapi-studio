import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class VapiWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req.body as { message?: { call?: { id?: string } } };
    const callId = body?.message?.call?.id;
    if (!callId || typeof callId !== 'string' || !callId.trim()) {
      throw new BadRequestException({
        error: 'missing_message_call_id',
        message: 'Vapi webhook requires message.call.id',
      });
    }
    return true;
  }
}
