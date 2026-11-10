import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type JobCategoryResponse,
  type JobOfferResponse,
  type JobOfferSummaryResponse,
  type ModerationJobOfferResponse,
  PERMISSIONS,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest, getClientInfo } from '../common/http/app-request';
import { CurrentAuth, Public, RequirePermissions } from '../security/decorators';
import { JobModerationService } from './job-moderation.service';
import {
  JobOfferIdParamDto,
  JobOfferInputDto,
  JobOfferSubmitDto,
  JobOfferUpdateDto,
  ModerationDecisionDto,
  ModerationQueueQueryDto,
} from './job-offers.dto';
import { JobOffersService } from './job-offers.service';

const HOUR = 60 * 60 * 1000;

/** Catégories professionnelles actives (formulaires et filtres). */
@ApiTags('job-offers')
@Public()
@Controller('job-categories')
export class JobCategoriesController {
  constructor(private readonly jobOffers: JobOffersService) {}

  @Get()
  @ApiOkResponse({ description: 'Catégories actives, dans l’ordre d’affichage.' })
  list(): Promise<JobCategoryResponse[]> {
    return this.jobOffers.listCategories();
  }
}

/** Offres du contributeur connecté : brouillons, modifications, soumission. */
@ApiTags('job-offers')
@Controller('me/job-offers')
export class MyJobOffersController {
  constructor(private readonly jobOffers: JobOffersService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @ApiOkResponse({ description: 'Brouillon créé (champs privés compris).' })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: JobOfferInputDto,
    @Req() req: AppRequest,
  ): Promise<JobOfferResponse> {
    return this.jobOffers.create(auth, dto, getClientInfo(req));
  }

  @Get()
  @ApiOkResponse({ description: 'Offres du contributeur, les plus récentes d’abord.' })
  list(@CurrentAuth() auth: AuthContext): Promise<JobOfferSummaryResponse[]> {
    return this.jobOffers.listMine(auth);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Offre complète avec son historique.' })
  get(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
  ): Promise<JobOfferResponse> {
    return this.jobOffers.getMine(auth, params.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @ApiOkResponse({ description: 'Offre modifiée (brouillon ou correction demandée).' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: JobOfferUpdateDto,
  ): Promise<JobOfferResponse> {
    return this.jobOffers.update(auth, params.id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @ApiOkResponse({ description: 'Offre soumise à la modération (statut pending_review).' })
  submit(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: JobOfferSubmitDto,
    @Req() req: AppRequest,
  ): Promise<JobOfferResponse> {
    return this.jobOffers.submit(auth, params.id, dto, getClientInfo(req));
  }
}

/** Modération des offres : réservée aux comptes ayant la permission jobs.moderate. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.JOBS_MODERATE)
@Controller('admin/job-offers')
export class JobModerationController {
  constructor(private readonly moderation: JobModerationService) {}

  @Get()
  @ApiOkResponse({ description: 'File de modération (par défaut : en attente de vérification).' })
  queue(@Query() query: ModerationQueueQueryDto): Promise<JobOfferSummaryResponse[]> {
    return this.moderation.queue(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Offre, contributeur, doublons potentiels et historique.' })
  get(@Param() params: JobOfferIdParamDto): Promise<ModerationJobOfferResponse> {
    return this.moderation.get(params.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Offre validée : programmée ou active selon sa date de début.' })
  approve(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: ModerationDecisionDto,
    @Req() req: AppRequest,
  ): Promise<ModerationJobOfferResponse> {
    return this.moderation.decide(auth, params.id, 'approve', dto, getClientInfo(req));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Offre rejetée (motif obligatoire).' })
  reject(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: ModerationDecisionDto,
    @Req() req: AppRequest,
  ): Promise<ModerationJobOfferResponse> {
    return this.moderation.decide(auth, params.id, 'reject', dto, getClientInfo(req));
  }

  @Post(':id/request-correction')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Correction demandée au contributeur (message obligatoire).' })
  requestCorrection(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: ModerationDecisionDto,
    @Req() req: AppRequest,
  ): Promise<ModerationJobOfferResponse> {
    return this.moderation.decide(auth, params.id, 'request-correction', dto, getClientInfo(req));
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Offre suspendue (motif obligatoire) : plus visible ni achetable.',
  })
  suspend(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: ModerationDecisionDto,
    @Req() req: AppRequest,
  ): Promise<ModerationJobOfferResponse> {
    return this.moderation.decide(auth, params.id, 'suspend', dto, getClientInfo(req));
  }
}
