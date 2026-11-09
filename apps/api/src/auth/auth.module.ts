import { Module } from '@nestjs/common';
import { SecurityEventsController } from '../admin/security-events.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { VerificationTokensService } from './verification-tokens.service';

@Module({
  controllers: [AuthController, MfaController, SecurityEventsController],
  providers: [
    AuthService,
    MfaService,
    PasswordService,
    SessionsService,
    VerificationTokensService,
    LoginThrottleService,
  ],
  exports: [SessionsService, PasswordService],
})
export class AuthModule {}
