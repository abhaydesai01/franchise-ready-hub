import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('internalWebhookSecret')?.trim();
    if (!expected) {
      throw new UnauthorizedException('Internal webhook not configured');
    }
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers['x-internal-secret'];
    const got = Array.isArray(raw) ? raw[0] : raw;
    if (got !== expected) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
