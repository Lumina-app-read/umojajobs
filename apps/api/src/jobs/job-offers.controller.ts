import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type FileDownloadResponse,
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
import { JobOfferFilesService, type UploadedPdf } from './job-offer-files.service';
import {
  JobOfferFileParamDto,
  JobOfferFileUploadDto,
  JobOfferIdParamDto,
  JobOfferInputDto,
  JobOfferSubmitDto,
  JobOfferUpdateDto,
  ModerationDecisionDto,
  ModerationQueueQueryDto,
} from './job-offers.dto';
import { JobOffersService } from './job-offers.service';

const HOUR = 60 * 60 * 1000;

/**
 * Réception d'un document : en mémoire (sans destination, multer n'écrit jamais sur le disque
 * du serveur), un seul fichier.
 * Le plafond technique (50 Mo) est le maximum autorisé par la configuration ; la limite réelle
 * (JOB_FILE_MAX_MB) est vérifiée par le service.
 */
const UPLOAD = FileInterceptor('file', {
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 5 },
});

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
  constructor(
    private readonly jobOffers: JobOffersService,
    private readonly files: JobOfferFilesService,
  ) {}

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

  @Post(':id/files')
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  @UseInterceptors(UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF, sans élément actif.' },
        kind: { type: 'string', enum: ['original', 'attachment'] },
      },
    },
  })
  @ApiOkResponse({ description: 'Document ajouté ; renvoie l’offre à jour.' })
  uploadFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferIdParamDto,
    @Body() dto: JobOfferFileUploadDto,
    @UploadedFile() file: UploadedPdf | undefined,
    @Req() req: AppRequest,
  ): Promise<JobOfferResponse> {
    return this.files.upload(auth, params.id, dto.kind, file, getClientInfo(req));
  }

  @Delete(':id/files/:fileId')
  @ApiOkResponse({ description: 'Document retiré (conservé pour la modération).' })
  removeFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferFileParamDto,
  ): Promise<JobOfferResponse> {
    return this.files.remove(auth, params.id, params.fileId);
  }

  @Post(':id/files/:fileId/download')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @ApiOkResponse({ description: 'Lien de téléchargement signé, valable quelques secondes.' })
  downloadFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferFileParamDto,
    @Req() req: AppRequest,
  ): Promise<FileDownloadResponse> {
    return this.files.ownerDownload(auth, params.id, params.fileId, getClientInfo(req));
  }
}

/** Modération des offres : réservée aux comptes ayant la permission jobs.moderate. */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.JOBS_MODERATE)
@Controller('admin/job-offers')
export class JobModerationController {
  constructor(
    private readonly moderation: JobModerationService,
    private readonly files: JobOfferFilesService,
  ) {}

  @Post(':id/files/:fileId/download')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Lien signé pour examiner un document (téléchargement journalisé).',
  })
  downloadFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: JobOfferFileParamDto,
    @Req() req: AppRequest,
  ): Promise<FileDownloadResponse> {
    return this.files.moderationDownload(auth, params.id, params.fileId, getClientInfo(req));
  }

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
