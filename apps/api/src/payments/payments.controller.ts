import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  type RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  type AdminCreditPackResponse,
  type CreditCheckoutInput,
  type CreditCheckoutResponse,
  type CreditOrderResponse,
  type CreditPackInput,
  type CreditPackResponse,
  ERROR_CODES,
  PERMISSIONS,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, Public, RequirePermissions, SkipCsrf } from '../security/decorators';
import { CreditPurchasesService } from './credit-purchases.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

class CheckoutDto implements CreditCheckoutInput {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  packId!: string;

  @ApiProperty({ required: false, example: '+243812345678' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(8, 20)
  phone?: string;
}

class CreditPackDto implements CreditPackInput {
  @ApiProperty({ example: 'pack_100' })
  @Transform(trim)
  @Matches(/^[a-z0-9_]{3,40}$/)
  sku!: string;

  @ApiProperty({ example: 'Pack 100 crédits' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ minimum: 1, maximum: 100_000 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  credits!: number;

  @ApiProperty({ example: '10.00' })
  @Transform(trim)
  @Matches(/^\d{1,8}(\.\d{1,2})?$/)
  priceUsd!: string;

  @ApiProperty({ nullable: true, example: 'prd_abc123' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : trim({ value }),
  )
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-Za-z0-9_-]{3,100}$/)
  chariowProductId!: string | null;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ minimum: 0, maximum: 1000 })
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder!: number;
}

class ReferenceParamDto {
  @ApiProperty({ example: 'CR-20261112-1A2B3C4D' })
  @Matches(/^CR-\d{8}-[0-9A-F]{8}$/)
  reference!: string;
}

class PackIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

/** Packs de crédits en vente (public : affichés avant toute inscription). */
@ApiTags('credits')
@Public()
@Controller('credit-packs')
export class CreditPacksController {
  constructor(private readonly purchases: CreditPurchasesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Packs actifs reliés à un produit Chariow (vide si paiement fermé).',
  })
  list(): Promise<CreditPackResponse[]> {
    return this.purchases.packs();
  }
}

/** Commandes de recharge de l'utilisateur connecté. */
@ApiTags('credits')
@Controller('me/credit-orders')
export class MyCreditOrdersController {
  constructor(private readonly purchases: CreditPurchasesService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOkResponse({
    description: 'Commande créée et paiement ouvert chez Chariow (adresse de paiement).',
  })
  checkout(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CheckoutDto,
  ): Promise<CreditCheckoutResponse> {
    return this.purchases.checkout(auth, body, auth.user.locale);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<CreditOrderResponse[]> {
    return this.purchases.orders(auth.user.id);
  }

  @Get(':reference')
  @ApiOkResponse({ description: 'État de la commande (la page de retour l’interroge).' })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param() params: ReferenceParamDto,
  ): Promise<CreditOrderResponse> {
    return this.purchases.order(auth.user.id, params.reference);
  }
}

/**
 * Pulses Chariow (webhooks). Point d'entrée public, sans jeton CSRF : l'authenticité repose
 * sur la signature HMAC du corps brut. Réponse immédiate, traitement asynchrone.
 */
@Public()
@SkipCsrf()
@SkipThrottle()
@Controller('payments/chariow')
export class ChariowPulseController {
  constructor(private readonly purchases: CreditPurchasesService) {}

  @Post('pulse')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async pulse(
    @Req() req: RawBodyRequest<AppRequest>,
    @Headers('x-chariow-signature') signature: string | undefined,
    @Headers('x-pulse-delivery-id') deliveryId: string | undefined,
    @Headers('x-pulse-event') event: string | undefined,
  ): Promise<{ received: true }> {
    const valid = await this.purchases.receivePulse(req.rawBody ?? Buffer.alloc(0), {
      signature,
      deliveryId,
      event,
    });
    if (!valid) throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED });
    return { received: true };
  }
}

/** Packs de crédits (administration financière). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_READ)
@Controller('admin/credit-packs')
export class AdminCreditPacksController {
  constructor(private readonly purchases: CreditPurchasesService) {}

  @Get()
  list(): Promise<AdminCreditPackResponse[]> {
    return this.purchases.adminPacks();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreditPackDto,
    @Req() req: AppRequest,
  ): Promise<AdminCreditPackResponse[]> {
    return this.purchases.savePack(auth, null, body, getClientInfo(req));
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_MANAGE)
  update(
    @CurrentAuth() auth: AuthContext,
    @Param() params: PackIdParamDto,
    @Body() body: CreditPackDto,
    @Req() req: AppRequest,
  ): Promise<AdminCreditPackResponse[]> {
    return this.purchases.savePack(auth, params.id, body, getClientInfo(req));
  }
}
