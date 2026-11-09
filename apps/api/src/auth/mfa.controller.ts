import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { AllowPendingMfa, CurrentAuth } from '../security/decorators';
import { type AuthContext } from './auth-context';
import { MfaVerifyDto, RecoveryCodesDto, TotpCodeDto, TotpSetupDto } from './auth.dto';
import { MfaService } from './mfa.service';

const MINUTE = 60_000;

@ApiTags('auth')
@AllowPendingMfa()
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE } })
  @ApiOkResponse({ type: TotpSetupDto })
  setup(@CurrentAuth() auth: AuthContext, @Req() req: AppRequest): Promise<TotpSetupDto> {
    return this.mfa.startSetup(auth, getClientInfo(req));
  }

  @Post('totp/enable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiOkResponse({ type: RecoveryCodesDto })
  enable(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: TotpCodeDto,
    @Req() req: AppRequest,
  ): Promise<RecoveryCodesDto> {
    return this.mfa.enable(auth, dto.code, getClientInfo(req));
  }

  @Post('verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @ApiNoContentResponse()
  async verify(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MfaVerifyDto,
    @Req() req: AppRequest,
  ): Promise<void> {
    await this.mfa.verify(auth, dto, getClientInfo(req));
  }
}
