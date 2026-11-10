import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ERROR_CODES } from '@opportinities/shared';
import { type Response } from 'express';
import { generateToken } from '../common/crypto/tokens';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CookiesService } from '../security/cookies.service';
import { AllowPendingMfa, CurrentAuth, Public } from '../security/decorators';
import { type AuthContext } from './auth-context';
import {
  AcceptedDto,
  ChangePasswordDto,
  CsrfTokenDto,
  EmailDto,
  LoginDto,
  LoginResponseDto,
  MeDto,
  RegisterDto,
  ResetPasswordDto,
  SessionDto,
  TokenDto,
  UpdateProfileDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ACCEPTED: AcceptedDto = { status: 'accepted' };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionsService,
    private readonly cookies: CookiesService,
  ) {}

  /** Délivre le jeton CSRF (cookie + corps) à recopier dans l'en-tête X-CSRF-Token. */
  @Public()
  @Get('csrf')
  @ApiOkResponse({ type: CsrfTokenDto })
  csrf(@Res({ passthrough: true }) res: Response): CsrfTokenDto {
    const csrfToken = generateToken();
    this.cookies.setCsrfCookie(res, csrfToken);
    return { csrfToken };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @ApiAcceptedResponse({ type: AcceptedDto })
  async register(@Body() dto: RegisterDto, @Req() req: AppRequest): Promise<AcceptedDto> {
    await this.authService.register(dto, getClientInfo(req));
    return ACCEPTED;
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 15 * MINUTE } })
  @ApiNoContentResponse()
  async verifyEmail(@Body() dto: TokenDto, @Req() req: AppRequest): Promise<void> {
    await this.authService.verifyEmail(dto.token, getClientInfo(req));
  }

  @Public()
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 15 * MINUTE } })
  @ApiAcceptedResponse({ type: AcceptedDto })
  async resendVerification(@Body() dto: EmailDto, @Req() req: AppRequest): Promise<AcceptedDto> {
    await this.authService.resendVerification(dto.email, getClientInfo(req));
    return ACCEPTED;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto, getClientInfo(req));
    this.cookies.setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    // Nouveau jeton CSRF à chaque connexion (pas de réutilisation d'un jeton antérieur).
    const csrfToken = generateToken();
    this.cookies.setCsrfCookie(res, csrfToken);

    const auth = await this.sessions.resolve(result.sessionToken);
    if (!auth) {
      throw new Error('Session créée introuvable.');
    }
    return { user: AuthService.toMe(auth), csrfToken };
  }

  @AllowPendingMfa()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(auth, getClientInfo(req));
    this.cookies.clearSessionCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(auth, getClientInfo(req));
    this.cookies.clearSessionCookie(res);
  }

  @AllowPendingMfa()
  @Get('me')
  @ApiOkResponse({ type: MeDto })
  me(@CurrentAuth() auth: AuthContext): MeDto {
    return AuthService.toMe(auth);
  }

  /** Mise à jour du profil et des préférences ; renvoie le profil à jour. */
  @Patch('me')
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @ApiOkResponse({ type: MeDto })
  updateMe(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateProfileDto,
    @Req() req: AppRequest,
  ): Promise<MeDto> {
    return this.authService.updateProfile(auth, dto, getClientInfo(req));
  }

  @Get('sessions')
  @ApiOkResponse({ type: SessionDto, isArray: true })
  listSessions(@CurrentAuth() auth: AuthContext): Promise<SessionDto[]> {
    return this.sessions.listActive(auth.user.id, auth.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revokeSession(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AppRequest,
  ): Promise<void> {
    if (!(await this.authService.revokeSession(auth, id, getClientInfo(req)))) {
      throw new NotFoundException({ code: ERROR_CODES.SESSION_NOT_FOUND });
    }
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: HOUR } })
  @ApiAcceptedResponse({ type: AcceptedDto })
  async forgotPassword(@Body() dto: EmailDto, @Req() req: AppRequest): Promise<AcceptedDto> {
    await this.authService.forgotPassword(dto.email, getClientInfo(req));
    return ACCEPTED;
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @ApiNoContentResponse()
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: AppRequest): Promise<void> {
    await this.authService.resetPassword(dto, getClientInfo(req));
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: HOUR } })
  @ApiNoContentResponse()
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: AppRequest,
  ): Promise<void> {
    await this.authService.changePassword(auth, dto, getClientInfo(req));
  }
}
