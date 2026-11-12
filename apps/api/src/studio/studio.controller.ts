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
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CAREER_DOCUMENT_TYPES,
  type CareerDocumentCreateInput,
  type CareerDocumentResponse,
  type CareerDocumentSummary,
  type CareerDocumentType,
  type CareerDocumentUpdateInput,
  type CvContent,
  STUDIO_LIMITS,
  SUPPORTED_LOCALES,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../security/decorators';
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

class IdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

/** Documents du Career Studio de l'utilisateur connecté (brouillons gratuits). */
@ApiTags('studio')
@Controller('me/career-documents')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AuthContext, @Param() params: IdParamDto): Promise<void> {
    return this.studio.remove(auth.user.id, params.id);
  }
}
