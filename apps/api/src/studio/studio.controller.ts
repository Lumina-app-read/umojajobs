import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Header,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AI_IMPROVE_TARGETS,
  AI_LIMITS,
  type AiImproveInput,
  type AiImproveTarget,
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
  STUDIO_LIMITS,
  SUPPORTED_LOCALES,
  AI_LENGTHS,
  AI_TONES,
  type AiGenerateInput,
  type AiGenerationOptions,
  type AiGenerationResponse,
  type AiLength,
  type AiPricesResponse,
  type AiSectionInput,
  type AiTone,
  type AiUsageResponse,
  PERMISSIONS,
  PHOTO_LIMITS,
  type CareerDocumentBrief,
  type CareerDocumentContent,
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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth, Public, RequirePermissions } from '../security/decorators';
import { StudioGenerationService } from './studio-generation.service';
import { StudioPhotoService, type UploadedImage } from './studio-photo.service';
import { StudioUsageService } from './studio-usage.service';
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
  content?: CareerDocumentContent;

  /** Informations de départ de la génération, validées par le service selon le type. */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  brief?: CareerDocumentBrief;
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
  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant aléatoire de l’opération (débit unique).',
  })
  @IsUUID()
  idempotencyKey!: string;

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

class AiOptionsDto implements AiGenerationOptions {
  @ApiPropertyOptional({ enum: AI_TONES })
  @IsOptional()
  @IsIn(AI_TONES)
  tone?: AiTone;

  @ApiPropertyOptional({ enum: AI_LENGTHS })
  @IsOptional()
  @IsIn(AI_LENGTHS)
  length?: AiLength;
}

class AiGenerateDto implements AiGenerateInput {
  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant aléatoire de l’opération (débit unique).',
  })
  @IsUUID()
  idempotencyKey!: string;

  @ApiPropertyOptional({ type: AiOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiOptionsDto)
  options?: AiOptionsDto;
}

class AiSectionDto extends AiGenerateDto implements AiSectionInput {
  @ApiProperty({ example: 'summary' })
  @IsString()
  @Length(1, 60)
  section!: string;
}

class GenerationKeyParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  key!: string;
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
    private readonly generation: StudioGenerationService,
    private readonly photos: StudioPhotoService,
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

  /** Tarifs de l'IA pour ce document (fixés par le serveur) et solde de l'utilisateur. */
  @Get(':id/ai/prices')
  aiPrices(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
  ): Promise<AiPricesResponse> {
    return this.generation.prices(auth.user.id, params.id);
  }

  /**
   * Génération complète par l'IA, payée en crédits. La réponse décrit la génération : réussie
   * (résultat), échouée (crédits remboursés) ou encore en cours (à consulter ensuite).
   */
  @Post(':id/ai/generate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Génération et son résultat.' })
  generate(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: AiGenerateDto,
  ): Promise<AiGenerationResponse> {
    return this.generation.generate(auth.user.id, params.id, body);
  }

  /** Régénération d'une seule section (1 crédit). */
  @Post(':id/ai/sections')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  regenerateSection(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: AiSectionDto,
  ): Promise<AiGenerationResponse> {
    return this.generation.regenerateSection(auth.user.id, params.id, body);
  }

  /** Amélioration d'un texte existant (1 crédit) : suggestion jamais appliquée d'office. */
  @Post(':id/ai/improve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  improve(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @Body() body: AiImproveDto,
  ): Promise<AiGenerationResponse> {
    return this.generation.improve(auth.user.id, params.id, body);
  }

  /** État d'une génération par sa clé : à consulter avant de relancer après une coupure. */
  @Get(':id/ai/generations/:key')
  generationStatus(
    @CurrentAuth() auth: AuthContext,
    @Param() params: GenerationKeyParamDto,
  ): Promise<AiGenerationResponse> {
    return this.generation.status(auth.user.id, params.id, params.key);
  }

  /** Photo du CV (facultative) : image recadrée, ré-encodée et stockée en privé. */
  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: PHOTO_LIMITS.maxBytes, files: 1, fields: 0 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  uploadPhoto(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<{ version: string }> {
    return this.photos.upload(auth.user.id, params.id, file);
  }

  /** Image de la photo pour l'aperçu, réservée au propriétaire (jamais publique). */
  @Get(':id/photo')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=86400')
  async photo(
    @CurrentAuth() auth: AuthContext,
    @Param() params: IdParamDto,
  ): Promise<StreamableFile> {
    return new StreamableFile(await this.photos.read(auth.user.id, params.id));
  }

  @Delete(':id/photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePhoto(@CurrentAuth() auth: AuthContext, @Param() params: IdParamDto): Promise<void> {
    return this.photos.remove(auth.user.id, params.id);
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

class UsageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

/** Usage de l'IA du Career Studio pour l'administration (agrégats, aucun contenu privé). */
@ApiTags('studio')
@Controller('admin/studio')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_READ)
export class StudioAdminController {
  constructor(private readonly usage: StudioUsageService) {}

  @Get('ai-usage')
  @ApiOkResponse({ description: 'Générations, crédits, recettes et coûts OpenAI estimés.' })
  aiUsage(@Query() query: UsageQueryDto): Promise<AiUsageResponse> {
    return this.usage.summary(query.days ?? 30);
  }
}
