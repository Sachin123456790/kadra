import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { LoginDto, RefreshDto, SignupDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() body: SignupDto) {
    const data = await this.authService.signup(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    const data = await this.authService.login(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: RefreshDto) {
    const data = await this.authService.refresh(body.refreshToken);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: user,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
