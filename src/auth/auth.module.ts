import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthPrincipal } from './entities/auth-principal.entity';
import { AuthSession } from './entities/auth-session.entity';
import { WebhookReplayEvent } from './entities/webhook-replay-event.entity';
import { SecurityRateLimiterService } from './rate-limiter.service';
import { WebhookSecurityService } from './webhook-security.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthPrincipal, AuthSession, WebhookReplayEvent]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    SecurityRateLimiterService,
    WebhookSecurityService,
  ],
  exports: [
    AuthService,
    AuthGuard,
    SecurityRateLimiterService,
    WebhookSecurityService,
  ],
})
export class AuthModule {}
