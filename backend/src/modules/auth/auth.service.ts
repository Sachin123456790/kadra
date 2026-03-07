import { Injectable, Logger } from '@nestjs/common';
import {
  ExternalDependencyError,
  ValidationError,
} from '../../common/errors';
import { AuthenticatedUser, ADMIN_ROLES, UserRole } from '../../common/auth/auth.types';
import { LoginDto, SignupDto } from './auth.dto';

interface SupabaseAuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

interface SupabaseLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: SupabaseAuthUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly supabaseUrl = process.env.SUPABASE_URL ?? '';
  private readonly supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';
  private readonly supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  private readonly adminSignupSecret = process.env.ADMIN_SIGNUP_SECRET;

  async signup(dto: SignupDto) {
    this.assertSupabaseConfigured();

    const role = dto.role ?? 'investor';
    this.assertSignupRoleAllowed(role, dto.adminSignupSecret);

    const createUserBody = {
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: {
        full_name: dto.fullName ?? '',
        role,
      },
    };

    const response = await fetch(`${this.supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.supabaseServiceRoleKey}`,
        apikey: this.supabaseServiceRoleKey,
      },
      body: JSON.stringify(createUserBody),
    });

    if (!response.ok) {
      const body = await this.safeJson(response);
      const message =
        body?.msg ??
        body?.message ??
        body?.error_description ??
        'Signup failed';

      if (response.status === 422 || response.status === 409) {
        throw new ValidationError(`Signup failed: ${message}`);
      }

      this.logger.error(`Supabase signup failed: ${response.status} ${message}`);
      throw new ExternalDependencyError('SupabaseAuth', `signup failed: ${message}`);
    }

    return this.login({ email: dto.email, password: dto.password });
  }

  async login(dto: LoginDto) {
    this.assertSupabaseConfigured();

    const response = await fetch(
      `${this.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseAnonKey,
        },
        body: JSON.stringify({ email: dto.email, password: dto.password }),
      },
    );

    const body = (await this.safeJson(response)) as SupabaseLoginResponse & {
      error_description?: string;
      msg?: string;
    };

    if (!response.ok) {
      const message =
        body?.msg ?? body?.error_description ?? body?.toString() ?? 'Invalid credentials';
      throw new ValidationError(`Login failed: ${message}`);
    }

    if (!body?.access_token || !body?.user) {
      throw new ExternalDependencyError(
        'SupabaseAuth',
        'login response missing access token or user payload',
      );
    }

    const user = this.mapUser(body.user);

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      tokenType: body.token_type,
      user,
    };
  }

  async getMe(accessToken: string): Promise<AuthenticatedUser> {
    this.assertSupabaseConfigured();

    const response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: this.supabaseAnonKey,
      },
    });

    const body = (await this.safeJson(response)) as SupabaseAuthUser & {
      error_description?: string;
      msg?: string;
    };

    if (!response.ok) {
      const message = body?.msg ?? body?.error_description ?? 'Invalid token';
      throw new ValidationError(`Token validation failed: ${message}`);
    }

    return this.mapUser(body);
  }

  private assertSupabaseConfigured() {
    if (!this.supabaseUrl || !this.supabaseAnonKey || !this.supabaseServiceRoleKey) {
      throw new ExternalDependencyError(
        'SupabaseAuth',
        'SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY must be configured',
      );
    }
  }

  private assertSignupRoleAllowed(role: UserRole, providedSecret?: string) {
    if (!ADMIN_ROLES.includes(role)) {
      return;
    }

    if (!this.adminSignupSecret) {
      return;
    }

    if (providedSecret !== this.adminSignupSecret) {
      throw new ValidationError('Invalid admin signup secret');
    }
  }

  private mapUser(raw: SupabaseAuthUser): AuthenticatedUser {
    const metadataRole =
      (raw.app_metadata?.role as UserRole | undefined) ??
      (raw.user_metadata?.role as UserRole | undefined);

    return {
      id: raw.id,
      email: raw.email,
      role: metadataRole ?? 'investor',
      fullName: (raw.user_metadata?.full_name as string | undefined) ?? undefined,
    };
  }

  private async safeJson(response: Response): Promise<Record<string, any>> {
    try {
      return (await response.json()) as Record<string, any>;
    } catch {
      return {};
    }
  }
}
