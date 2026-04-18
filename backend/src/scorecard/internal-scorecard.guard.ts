import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalScorecardKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-internal-api-key'];
    const expected = this.config.get<string>('scorecardInternalSecret') ?? '';
    if (!expected || typeof key !== 'string' || key !== expected) {
      throw new ForbiddenException();
    }
    return true;
  }
}
