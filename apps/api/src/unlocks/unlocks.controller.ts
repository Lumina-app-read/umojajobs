import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CommissionResponse,
  type CreditCostResponse,
  type DocumentPagesResponse,
  type UnlockedContentsResponse,
  type UnlockRequest,
  type UnlockResponse,
  type UnlockSummaryResponse,
  type WalletResponse,
} from '@opportinities/shared';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { type Response } from 'express';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { MAX_RENDERED_PAGES } from '../documents/document-render.service';
import { CurrentAuth, Public } from '../security/decorators';
import { UnlocksService } from './unlocks.service';

class UnlockRequestDto implements UnlockRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  jobOfferId!: string;
}

class UnlockParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  jobOfferId!: string;
}

class UnlockFileParamDto extends UnlockParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fileId!: string;
}

class UnlockPageParamDto extends UnlockFileParamDto {
  @ApiProperty({ minimum: 1, maximum: MAX_RENDERED_PAGES })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RENDERED_PAGES)
  page!: number;
}

/** Coûts des services en crédits, affichés avant toute action payante. */
@ApiTags('credits')
@Public()
@Controller('credit-costs')
export class CreditCostsController {
  constructor(private readonly unlocks: UnlocksService) {}

  @Get()
  @ApiOkResponse({ description: 'Coût de chaque service (null : service pas encore ouvert).' })
  list(): Promise<CreditCostResponse[]> {
    return this.unlocks.costs();
  }
}

/** Déverrouillages de l'utilisateur connecté. */
@ApiTags('unlocks')
@Controller('me/unlocks')
export class MyUnlocksController {
  constructor(private readonly unlocks: UnlocksService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({
    description:
      'Déverrouille une offre active contre des crédits. Sans effet (et sans débit) si elle l’est déjà.',
  })
  unlock(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UnlockRequestDto,
  ): Promise<UnlockResponse> {
    return this.unlocks.unlock(auth, body.jobOfferId);
  }

  @Get()
  @ApiOkResponse({ description: 'Offres déverrouillées, des plus récentes aux plus anciennes.' })
  list(@CurrentAuth() auth: AuthContext): Promise<UnlockSummaryResponse[]> {
    return this.unlocks.list(auth.user.id);
  }

  @Get(':jobOfferId')
  @ApiOkResponse({
    description: 'Coordonnées et documents de candidature d’une offre déverrouillée.',
  })
  contents(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UnlockParamDto,
  ): Promise<UnlockedContentsResponse> {
    return this.unlocks.contents(auth, params.jobOfferId);
  }

  @Get(':jobOfferId/files/:fileId')
  @ApiOkResponse({
    description: 'Nombre de pages d’un document, consultable dans le site uniquement.',
  })
  documentPages(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UnlockFileParamDto,
    @Req() req: AppRequest,
  ): Promise<DocumentPagesResponse> {
    return this.unlocks.documentPages(auth, params.jobOfferId, params.fileId, getClientInfo(req));
  }

  /**
   * Page rendue en image, mention de publication incrustée. Jamais le fichier d'origine,
   * jamais de pièce jointe ni de mise en cache partagée.
   */
  @Get(':jobOfferId/files/:fileId/pages/:page')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiProduces('image/webp')
  @ApiOkResponse({ description: 'Page du document au format WebP.' })
  async documentPage(
    @CurrentAuth() auth: AuthContext,
    @Param() params: UnlockPageParamDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const image = await this.unlocks.documentPage(
      auth,
      params.jobOfferId,
      params.fileId,
      params.page,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline');
    return new StreamableFile(image, { type: 'image/webp', length: image.length });
  }
}

/** Portefeuille du contributeur connecté. */
@ApiTags('wallet')
@Controller('me/wallet')
export class MyWalletController {
  constructor(private readonly unlocks: UnlocksService) {}

  @Get()
  @ApiOkResponse({
    description: 'Soldes en attente, disponible, réservé, gains et retraits (USD).',
  })
  wallet(@CurrentAuth() auth: AuthContext): Promise<WalletResponse> {
    return this.unlocks.wallet(auth.user.id);
  }
}

/** Commissions du contributeur connecté. */
@ApiTags('commissions')
@Controller('me/commissions')
export class MyCommissionsController {
  constructor(private readonly unlocks: UnlocksService) {}

  @Get()
  @ApiOkResponse({
    description: 'Commissions et leur état (en attente, disponible, payée, annulée).',
  })
  list(@CurrentAuth() auth: AuthContext): Promise<CommissionResponse[]> {
    return this.unlocks.commissions(auth.user.id);
  }
}
