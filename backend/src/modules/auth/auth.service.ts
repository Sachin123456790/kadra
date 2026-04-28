import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ValidationError, ExternalDependencyError } from '../../common/errors';
import {
  AuthenticatedUser,
  ADMIN_ROLES,
  UserRole,
} from '../../common/auth/auth.types';
import { LoginDto, SignupDto } from './auth.dto';
import { PrismaService } from '../../prisma/prisma.service';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '24h'; // matches prior Supabase default
const REFRESH_TOKEN_TTL = '30d';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  name?: string;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly jwtSecret = process.env.JWT_SECRET ?? '';
  private readonly jwtRefreshSecret =
    process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? '';
  private readonly adminSignupSecret = process.env.ADMIN_SIGNUP_SECRET;

  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    this.assertConfigured();

    const role = dto.role ?? 'investor';
    this.assertSignupRoleAllowed(role, dto.adminSignupSecret);

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ValidationError('Signup failed: email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Create auth user + investor domain row in a single transaction so we
    // never orphan a login without a domain record.
    const authUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.authUser.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role,
          fullName: dto.fullName?.trim() || null,
          emailVerified: true,
        },
      });

      if (role === 'investor') {
        await tx.investor.upsert({
          where: { externalRef: normalizedEmail },
          create: {
            externalRef: normalizedEmail,
            email: normalizedEmail,
            legalName:
              dto.fullName && dto.fullName.trim().length > 0
                ? dto.fullName.trim()
                : normalizedEmail,
            verificationStatus: 'UNKNOWN',
            kycStatus: 'PENDING',
            accreditationStatus: 'PENDING',
            metadata: {
              profileCompleted: false,
              signupSource: 'self',
            },
          },
          update: { email: normalizedEmail },
        });
      }

      return created;
    });

    return this.issueSession(authUser);
  }

  async login(dto: LoginDto) {
    this.assertConfigured();

    const normalizedEmail = dto.email.trim().toLowerCase();
    const authUser = await this.prisma.authUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!authUser || authUser.deletedAt) {
      throw new ValidationError('Login failed: invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, authUser.passwordHash);
    if (!ok) {
      throw new ValidationError('Login failed: invalid credentials');
    }

    await this.prisma.authUser.update({
      where: { id: authUser.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(authUser);
  }

  async refresh(refreshToken: string) {
    this.assertConfigured();

    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(
        refreshToken,
        this.jwtRefreshSecret,
      ) as RefreshTokenPayload;
    } catch {
      throw new ValidationError('Refresh failed: token expired or invalid');
    }

    if (payload.type !== 'refresh') {
      throw new ValidationError('Refresh failed: wrong token type');
    }

    const authUser = await this.prisma.authUser.findUnique({
      where: { id: payload.sub },
    });
    if (!authUser || authUser.deletedAt) {
      throw new ValidationError('Refresh failed: account not found');
    }

    return this.issueSession(authUser);
  }

  /**
   * Used by JwtAuthGuard on every protected request to map the bearer token
   * back to an AuthenticatedUser.
   */
  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    this.assertConfigured();

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(accessToken, this.jwtSecret) as AccessTokenPayload;
    } catch {
      throw new ValidationError('Token validation failed: invalid or expired');
    }

    if (payload.type !== 'access') {
      throw new ValidationError('Token validation failed: wrong token type');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.name,
    };
  }

  /**
   * Kept for API parity with the pre-existing `getMe` call. Returns the
   * decoded token without an extra DB round-trip.
   */
  async getMe(accessToken: string): Promise<AuthenticatedUser> {
    return this.verifyAccessToken(accessToken);
  }

  private issueSession(authUser: {
    id: string;
    email: string;
    role: string;
    fullName: string | null;
  }) {
    const accessToken = this.signAccessToken({
      sub: authUser.id,
      email: authUser.email,
      role: authUser.role as UserRole,
      name: authUser.fullName ?? undefined,
      type: 'access',
    });
    const refreshToken = this.signRefreshToken({
      sub: authUser.id,
      type: 'refresh',
    });

    const expiresIn = 60 * 60 * 24; // 24h in seconds

    const user: AuthenticatedUser = {
      id: authUser.id,
      email: authUser.email,
      role: (authUser.role as UserRole) ?? 'investor',
      fullName: authUser.fullName ?? undefined,
    };

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user,
    };
  }

  private signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
  }

  private signRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: REFRESH_TOKEN_TTL,
    });
  }

  private assertConfigured() {
    if (!this.jwtSecret) {
      throw new ExternalDependencyError(
        'AuthService',
        'JWT_SECRET must be configured',
      );
    }
  }

  private assertSignupRoleAllowed(role: UserRole, providedSecret?: string) {
    if (!ADMIN_ROLES.includes(role)) {
      return;
    }

    if (!this.adminSignupSecret) {
      throw new ValidationError('Admin signup is not enabled');
    }

    if (providedSecret !== this.adminSignupSecret) {
      throw new ValidationError('Invalid admin signup secret');
    }
  }
}
