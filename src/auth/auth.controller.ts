import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  AuthLoginBody,
  AuthLoginResponseDto,
  AuthMeResponseDto,
} from './auth.dto';
import {
  AuthGuard,
  buildSessionCookie,
  clearSessionCookie,
  requireAuthPrincipal,
} from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { authLoginHtml, authSignupHtml } from './auth.frontend';
import { AuthService } from './auth.service';
import { SecurityRateLimiterService } from './rate-limiter.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimiter: SecurityRateLimiterService,
  ) {}

  @Get('login')
  loginPage(@Res() response: Response): void {
    response.type('html').send(authLoginHtml());
  }

  @Get('signup')
  signupPage(@Res() response: Response): void {
    response.type('html').send(authSignupHtml());
  }

  @Post('login')
  async login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: AuthLoginBody,
  ): Promise<AuthLoginResponseDto> {
    await this.rateLimiter.assertAllowed(
      `auth:login:ip:${clientIp(request)}`,
      50,
      15 * 60 * 1000,
    );
    await this.rateLimiter.assertAllowed(
      `auth:login:account:${normalizeRateEmail(body?.email)}`,
      10,
      15 * 60 * 1000,
    );
    const result = await this.auth.login(body);
    response.setHeader(
      'Set-Cookie',
      buildSessionCookie(
        result.token,
        result.expiresAt,
        this.auth.sessionCookieSecure(),
      ),
    );
    return result;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthMeResponseDto {
    return { principal: requireAuthPrincipal(request) };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    if (request.authToken) {
      await this.auth.revokeToken(request.authToken);
    }
    response.setHeader(
      'Set-Cookie',
      clearSessionCookie(this.auth.sessionCookieSecure()),
    );
    return { ok: true };
  }
}

function clientIp(request: AuthenticatedRequest): string {
  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}

function normalizeRateEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 320) : '';
}
