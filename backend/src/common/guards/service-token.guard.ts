import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-service-token'] as string;
    const expected = process.env.CRON_SERVICE_TOKEN;

    if (!expected) {
      throw new UnauthorizedException('Service token not configured');
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid or missing service token');
    }
    return true;
  }
}
