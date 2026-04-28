import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Validates locally-signed JWTs (HS256 via JWT_SECRET). Delegates
 * verification to AuthService.verifyAccessToken so the signing secret never
 * leaves the service.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    const accessToken = this.extractBearerToken(authHeader);

    if (!accessToken) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const user = await this.authService.verifyAccessToken(accessToken);
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Token validation failed: token is expired or invalid',
      );
    }
  }

  private extractBearerToken(header?: string): string | null {
    if (!header) return null;
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
  }
}
