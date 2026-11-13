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
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AI_IMPROVE_TARGETS,
  AI_LIMITS,
  type AiImproveInput,
  type AiImproveTarget,
  type AiSuggestionResponse,
  CAREER_DOCUMENT_TYPES,
  LETTER_LIMITS,
  type CareerExportCreateInput,
  type CareerExportDownloadResponse,
  type CareerExportRenderData,
  type CareerExportResponse,
  type CareerExportsResponse,
  type CareerDocumentCreateInput,
  type CareerDocumentResponse,
  type CareerDocumentSummary,
  type CareerDocumentType,
  type CareerDocumentUpdateInput,
  type CvContent,
  STUDIO_LIMITS,
  SUPPORTED_LOCALES,
} from '@opportinities/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth, Public } from '../security/decorators';
import { StudioAiService } from './studio-ai.service';
import { StudioExportsService } from './studio-exports.service';
import { StudioService } from './studio.service';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

class CreateDocumentDto implements CareerDocumentCreateInput {
  @ApiProperty({ enum: CAREER_DOCUMENT_TYPES })
  @IsIn(CAREER_DOCUMENT_TYPES)
  type!: CareerDocumentType;

  @ApiProperty({ example: 'CV comptable' })
  @Transform(trim)
  @IsString()
  @Length(1, STUDIO_LIMITS.titleMax)
  title!: string;

  @ApiProperty({ enum: SUPPORTED_LOCALES })
  @IsIn(SUPPORTED_LOCALES)
  language!: 'fr' | 'en';
}

class UpdateDocumentDto implements CareerDocumentUpdateInput {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, STUDIO_LIMITS.titleMax)
  title?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  language?: 'fr' | 'en';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateKey?: string;

  /** Contenu complet, validé et normalisé par le service selon le type de document. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  content?: CvContent;
}

class AiContextDto {
  @ApiPropertyOptional({ example: 'Comptable' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(AI_LIMITS.contextMax)
  title?: string;

  @ApiPropertyOptional({ example: 'Logistique Ouest SA' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(AI_LIMITS.contextMax)
  organization?: string;
}

class AiImproveDto implements AiImproveInput {
  @ApiProperty({ enum: AI_IMPROVE_TARGETS })
  @IsIn(AI_IMPROVE_TARGETS)
  target!: AiImproveTarget;

  @ApiProperty({ minLength: AI_LIMITS.textMin, maxLength: LETTER_LIMITS.bodyMax })
  @Transform(trim)
  @IsString()
  @Length(AI_LIMITS.textMin, LETTER_LIMITS.bodyMax)
  text!: string;

  @ApiPropertyOptional({ type: AiContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiContextDto)
  context?: AiContextDto;
}

class CreateExportDto implements CareerExportCreateInput {
  @ApiProperty({ format: 'uuid', description: 'Identifiant aléatoire généré par le navigateur.' })
  @IsUUID()
  idempotencyKey!: string;
}

class ExportIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exportId!: string;
}

class RenderTokenQueryDto {
  @ApiProperty()
  @IsString()
  @Length(10, 200)
  token!: string;
}

class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

/** Documents du Career Studio de l'utilisateur connecté (brouillons gratuits). */
@ApiTags('studio')
@Controller('me/career-documents')
export class StudioController {
  constructor(
    private readonly studio: StudioService,
    private readonly studioAi: StudioAiService,
    private readonly exports: StudioExportsService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Documents, du plus récemment modifié au plus ancien.' })
  list(@CurrentAuth() auth: AuthContext): Promise<CareerDocumentSummary[]> {
    return this.studio.list(auth.user.id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60 * 60_000 } })
  @ApiOkResponse({ description: 'Nouveau document prérempli avec les informations du compte.' })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() body: CreateDocumentDto,
  ): Promise<CareerDocumentResponse> {
    return this.studio.create(auth, body);
  }

  @Get(':id')
  get(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
  ): Promise<CareerDocumentResponse> {
    return this.studio.get(auth.user.id, params.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 300, ttl: 60 * 60_000 } })
  @ApiOkResponse({ description: 'Enregistrement (version optimiste).' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: UpdateDocumentDto,
  ): Promise<CareerDocumentResponse> {
    return this.studio.update(auth.user.id, params.id, body);
  }

  /** Reformulation par l'IA : renvoie une suggestion, jamais appliquée d'office. */
  @Post(':id/ai/improve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ description: "Suggestion et nombre de suggestions restantes aujourd'hui." })
  improve(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: AiImproveDto,
  ): Promise<AiSuggestionResponse> {
    return this.studioAi.improve(auth.user.id, params.id, body);
  }

  @Get(':id/exports')
  @ApiOkResponse({ description: 'Exports du document, coût et période de ré-export gratuit.' })
  listExports(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
  ): Promise<CareerExportsResponse> {
    return this.exports.list(auth.user.id, params.id);
  }

  /** Export PDF : débite les crédits sauf pendant une période de ré-export gratuit. */
  @Post(':id/exports')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Export créé (ou rejoué pour la même clé).' })
  createExport(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: CreateExportDto,
  ): Promise<CareerExportResponse> {
    return this.exports.create(auth.user.id, params.id, body.idempotencyKey);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AuthContext, @Param() params: IdParamDto): Promise<void> {
    return this.studio.remove(auth.user.id, params.id);
  }
}

/** Téléchargement des PDF exportés par l'utilisateur connecté. */
@ApiTags('studio')
@Controller('me/career-exports')
export class CareerExportsController {
  constructor(private readonly exports: StudioExportsService) {}

  @Get(':exportId/download')
  @ApiOkResponse({ description: 'Lien signé de courte durée vers le PDF.' })
  download(
    @CurrentAuth() auth: AuthContext,
    @Param() params: ExportIdParamDto,
  ): Promise<CareerExportDownloadResponse> {
    return this.exports.download(auth.user.id, params.exportId);
  }
}

/**
 * Lecture interne de l'instantané à imprimer, par la page d'impression de l'application web.
 * Aucune session : accès réservé au jeton signé, propre à l'export et valable deux minutes.
 */
@ApiTags('studio')
@Controller('internal/career-exports')
export class CareerExportRenderController {
  constructor(private readonly exports: StudioExportsService) {}

  @Public()
  @Get(':exportId/render-data')
  renderData(
    @Param() params: ExportIdParamDto,
    @Query() query: RenderTokenQueryDto,
  ): Promise<CareerExportRenderData> {
    return this.exports.renderData(params.exportId, query.token);
  }
}
