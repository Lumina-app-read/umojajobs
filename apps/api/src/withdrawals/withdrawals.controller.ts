import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminWithdrawalResponse,
  PERMISSIONS,
  WITHDRAWAL_ACTIONS,
  WITHDRAWAL_LIMITS,
  WITHDRAWAL_METHOD_TYPES,
  WITHDRAWAL_STATUSES,
  type WithdrawalAction,
  type WithdrawalDecisionInput,
  type WithdrawalMethodInput,
  type WithdrawalMethodResponse,
  type WithdrawalMethodType,
  type WithdrawalRequestInput,
  type WithdrawalResponse,
  type WithdrawalStatus,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, RequirePermissions } from '../security/decorators';
import { WithdrawalsService } from './withdrawals.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

class WithdrawalMethodInputDto implements WithdrawalMethodInput {
  @ApiProperty({ enum: WITHDRAWAL_METHOD_TYPES })
  @IsIn(WITHDRAWAL_METHOD_TYPES)
  type!: WithdrawalMethodType;

  @ApiProperty({ example: 'CD' })
  @IsString()
  @Length(2, 2)
  countryIso2!: string;

  @ApiProperty({ example: 'Orange Money' })
  @Transform(trim)
  @IsString()
  @Length(2, WITHDRAWAL_LIMITS.providerMax)
  provider!: string;

  @ApiProperty({ example: 'Awa Diallo' })
  @Transform(trim)
  @IsString()
  @Length(2, WITHDRAWAL_LIMITS.holderMax)
  accountHolder!: string;

  @ApiProperty({ example: '+243812345678' })
  @Transform(trim)
  @IsString()
  @Length(6, WITHDRAWAL_LIMITS.accountMax)
  accountNumber!: string;
}

class WithdrawalRequestInputDto implements WithdrawalRequestInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  methodId!: string;

  @ApiProperty({ example: '12.50' })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  amountUsd!: string;
}

class WithdrawalDecisionDto implements WithdrawalDecisionInput {
  @ApiProperty({ enum: WITHDRAWAL_ACTIONS })
  @IsIn(WITHDRAWAL_ACTIONS)
  action!: WithdrawalAction;

  @ApiPropertyOptional({ maxLength: WITHDRAWAL_LIMITS.referenceMax })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(WITHDRAWAL_LIMITS.referenceMax)
  payoutReference?: string;

  @ApiPropertyOptional({ example: '2026-11-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidOn?: string;

  @ApiPropertyOptional({ maxLength: WITHDRAWAL_LIMITS.noteMax })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(WITHDRAWAL_LIMITS.noteMax)
  note?: string;
}

class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

class StatusQueryDto {
  @ApiPropertyOptional({ enum: WITHDRAWAL_STATUSES })
  @IsOptional()
  @IsIn(WITHDRAWAL_STATUSES)
  status?: WithdrawalStatus;
}

/** Moyens et demandes de retrait de l'utilisateur connecté. */
@ApiTags('withdrawals')
@Controller('me')
export class MyWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get('withdrawal-methods')
  @ApiOkResponse({ description: 'Moyens de retrait actifs (coordonnées masquées).' })
  methods(@CurrentAuth() auth: AuthContext): Promise<WithdrawalMethodResponse[]> {
    return this.withdrawals.methods(auth.user.id);
  }

  @Post('withdrawal-methods')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOkResponse({ description: 'Moyen ajouté ; les coordonnées sont chiffrées.' })
  addMethod(
    @CurrentAuth() auth: AuthContext,
    @Body() body: WithdrawalMethodInputDto,
  ): Promise<WithdrawalMethodResponse> {
    return this.withdrawals.addMethod(auth, body);
  }

  @Delete('withdrawal-methods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveMethod(@CurrentAuth() auth: AuthContext, @Param() params: IdParamDto): Promise<void> {
    return this.withdrawals.archiveMethod(auth, params.id);
  }

  @Get('withdrawals')
  @ApiOkResponse({ description: 'Demandes de retrait et leur historique.' })
  mine(@CurrentAuth() auth: AuthContext): Promise<WithdrawalResponse[]> {
    return this.withdrawals.mine(auth.user.id);
  }

  @Post('withdrawals')
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOkResponse({ description: 'Demande créée ; le montant est réservé immédiatement.' })
  request(
    @CurrentAuth() auth: AuthContext,
    @Body() body: WithdrawalRequestInputDto,
    @Req() req: AppRequest,
  ): Promise<WithdrawalResponse> {
    return this.withdrawals.request(auth, body, getClientInfo(req));
  }
}

/** Traitement des retraits par l'administration. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
@Controller('admin/withdrawals')
export class AdminWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Demandes (par défaut : en cours), des plus anciennes aux plus récentes.',
  })
  list(@Query() query: StatusQueryDto): Promise<AdminWithdrawalResponse[]> {
    return this.withdrawals.adminList(query.status);
  }

  @Get(':id')
  get(@Param() params: IdParamDto): Promise<AdminWithdrawalResponse> {
    return this.withdrawals.adminGet(params.id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Examen, approbation, traitement, versement ou refus.' })
  decide(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: WithdrawalDecisionDto,
    @Req() req: AppRequest,
  ): Promise<AdminWithdrawalResponse> {
    return this.withdrawals.decide(auth, params.id, body, getClientInfo(req));
  }
}
