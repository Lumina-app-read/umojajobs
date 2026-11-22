import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  COMMISSION_STATUSES,
  type CommissionRegistryResponse,
  type CommissionStatus,
  CREDIT_ORDER_STATUSES,
  type CreditOrderStatus,
  type PaymentRegistryResponse,
  PERMISSIONS,
  REGISTRY_MAX_PAGE,
  type UnlockRegistryResponse,
} from '@opportinities/shared';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RequirePermissions } from '../security/decorators';
import { RegistryService } from './registry.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

class RegistryQueryDto {
  @ApiPropertyOptional({ description: 'Recherche : personne, référence ou offre.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: REGISTRY_MAX_PAGE, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REGISTRY_MAX_PAGE)
  page = 1;
}

class PaymentRegistryQueryDto extends RegistryQueryDto {
  @ApiPropertyOptional({ enum: CREDIT_ORDER_STATUSES })
  @IsOptional()
  @IsIn(CREDIT_ORDER_STATUSES)
  status?: CreditOrderStatus;
}

class CommissionRegistryQueryDto extends RegistryQueryDto {
  @ApiPropertyOptional({ enum: COMMISSION_STATUSES })
  @IsOptional()
  @IsIn(COMMISSION_STATUSES)
  status?: CommissionStatus;
}

/** Registres financiers en consultation seule (administration). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_READ)
@Controller('admin')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get('payments')
  @ApiOkResponse({ description: 'Commandes de crédits, paiements et règlements Chariow.' })
  payments(@Query() query: PaymentRegistryQueryDto): Promise<PaymentRegistryResponse> {
    return this.registry.payments(query, query.status);
  }

  @Get('unlocks')
  @ApiOkResponse({ description: 'Déverrouillages et commission éventuelle de chacun.' })
  unlocks(@Query() query: RegistryQueryDto): Promise<UnlockRegistryResponse> {
    return this.registry.unlocks(query);
  }

  @Get('commissions')
  @ApiOkResponse({ description: 'Commissions des contributeurs et totaux par état.' })
  commissions(@Query() query: CommissionRegistryQueryDto): Promise<CommissionRegistryResponse> {
    return this.registry.commissions(query, query.status);
  }
}
