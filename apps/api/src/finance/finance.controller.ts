import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type CreditBalanceResponse,
  type CreditGrantResponse,
  ERROR_CODES,
  type FinancialSettingResponse,
  type FinanceUserLookupResponse,
  PERMISSIONS,
  type ServiceCostResponse,
} from '@opportinities/shared';
import { isUUID } from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, RequirePermissions } from '../security/decorators';
import { CreditsService } from './credits.service';
import {
  CreditGrantInputDto,
  FinancialSettingInputDto,
  FinancialSettingKeyParamDto,
  FinanceUserLookupQueryDto,
  ServiceCostInputDto,
  ServiceParamDto,
} from './finance.dto';
import { FinancialSettingsService } from './financial-settings.service';

/** Solde et historique des crédits de l'utilisateur connecté. */
@ApiTags('credits')
@Controller('me/credits')
export class MyCreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  @ApiOkResponse({ description: 'Solde de crédits et derniers mouvements.' })
  balance(@CurrentAuth() auth: AuthContext): Promise<CreditBalanceResponse> {
    return this.credits.balance(auth.user.id);
  }
}

/** Paramètres financiers et dotations de crédits (administration). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_READ)
@Controller('admin/finance')
export class FinanceAdminController {
  constructor(
    private readonly settings: FinancialSettingsService,
    private readonly credits: CreditsService,
  ) {}

  @Get('settings')
  @ApiOkResponse({ description: 'Valeur en vigueur de chaque paramètre (null : non configuré).' })
  listSettings(): Promise<FinancialSettingResponse[]> {
    return this.settings.list();
  }

  @Put('settings/:key')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  @ApiOkResponse({ description: 'Nouvelle valeur effective immédiatement, ancienne historisée.' })
  updateSetting(
    @CurrentAuth() auth: AuthContext,
    @Param() params: FinancialSettingKeyParamDto,
    @Body() body: FinancialSettingInputDto,
    @Req() req: AppRequest,
  ): Promise<FinancialSettingResponse[]> {
    return this.settings.update(auth, params.key, body.value, body.reason, getClientInfo(req));
  }

  @Get('service-costs')
  @ApiOkResponse({ description: 'Coût en vigueur de chaque service, en crédits.' })
  listCosts(): Promise<ServiceCostResponse[]> {
    return this.settings.listCosts();
  }

  @Put('service-costs/:service')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  @ApiOkResponse({ description: 'Nouveau coût effectif immédiatement, ancien historisé.' })
  updateCost(
    @CurrentAuth() auth: AuthContext,
    @Param() params: ServiceParamDto,
    @Body() body: ServiceCostInputDto,
    @Req() req: AppRequest,
  ): Promise<ServiceCostResponse[]> {
    return this.settings.updateCost(
      auth,
      params.service,
      body.credits,
      body.reason,
      getClientInfo(req),
    );
  }

  @Get('users/lookup')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  @ApiOkResponse({ description: 'Bénéficiaire d’une dotation, retrouvé par son email exact.' })
  lookupUser(@Query() query: FinanceUserLookupQueryDto): Promise<FinanceUserLookupResponse> {
    return this.credits.lookupUser(query.email);
  }

  @Post('credit-grants')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID unique par dotation.' })
  @ApiOkResponse({ description: 'Crédits gratuits attribués (lot non commissionnable).' })
  grant(
    @CurrentAuth() auth: AuthContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreditGrantInputDto,
    @Req() req: AppRequest,
  ): Promise<CreditGrantResponse> {
    if (!idempotencyKey || !isUUID(idempotencyKey)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED });
    }
    return this.credits.grant(auth, { ...body, idempotencyKey }, getClientInfo(req));
  }
}
