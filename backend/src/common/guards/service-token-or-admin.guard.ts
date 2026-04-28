import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from '../../modules/auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';

const ADMIN_ROLES = [
  'admin',
  'platform_admin',
  'fund_admin',
  'operations_analyst',
];

@Injectable()
export class ServiceTokenOrAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();

    const serviceToken = request.headers['x-service-token'] as
      | string
      | undefined;
    const expectedServiceToken = process.env.CRON_SERVICE_TOKEN;
    if (
      serviceToken &&
      expectedServiceToken &&
      serviceToken === expectedServiceToken
    ) {
      return true;
    }

    const authHeader = request.headers?.authorization as string | undefined;
    const bearer = this.extractBearer(authHeader);
    if (bearer) {
      try {
        const user = await this.authService.getMe(bearer);
        if (user && ADMIN_ROLES.includes(user.role)) {
          request.user = user;
          return true;
        }
      } catch {
        // fall through to 401
      }
    }

    throw new UnauthorizedException(
      'Requires valid service token or admin session',
    );
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
