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
  BUNDLE_LIMITS,
  type BundleCreateInput,
  type BundleExportResponse,
  type BundleResponse,
  type BundleSummary,
  type BundleUpdateInput,
  type CareerExportCreateInput,
  type CareerExportDownloadResponse,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../security/decorators';
import { BundlesService, type UploadedBundleFile } from './bundles.service';

const HOUR = 60 * 60 * 1000;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

class CreateBundleDto implements BundleCreateInput {
  @ApiProperty({ example: 'Candidature comptable' })
  @Transform(trim)
  @IsString()
  @Length(1, BUNDLE_LIMITS.titleMax)
  title!: string;
}

class UpdateBundleDto implements BundleUpdateInput {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, BUNDLE_LIMITS.titleMax)
  title?: string;

  @ApiPropertyOptional({ type: [String], description: 'Tous les fichiers, dans le nouvel ordre.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BUNDLE_LIMITS.filesMax)
  @IsUUID(undefined, { each: true })
  fileIds?: string[];
}

class ExportBundleDto implements CareerExportCreateInput {
  @ApiProperty({ format: 'uuid', description: 'Identifiant aléatoire généré par le navigateur.' })
  @IsUUID()
  idempotencyKey!: string;
}

class BundleIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

class BundleFileIdDto extends BundleIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fileId!: string;
}

class BundleExportIdDto extends BundleIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exportId!: string;
}

/** Dossiers rassemblés de l'utilisateur connecté. */
@ApiTags('bundles')
@Controller('me/document-bundles')
export class BundlesController {
  constructor(private readonly bundles: BundlesService) {}

  @Get()
  @ApiOkResponse({ description: 'Dossiers, du plus récemment modifié au plus ancien.' })
  list(@CurrentAuth() auth: AuthContext): Promise<BundleSummary[]> {
    return this.bundles.list(auth.user.id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: HOUR } })
  create(@CurrentAuth() auth: AuthContext, @Body() body: CreateBundleDto): Promise<BundleResponse> {
    return this.bundles.create(auth.user.id, body.title);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param() params: BundleIdDto): Promise<BundleResponse> {
    return this.bundles.get(auth.user.id, params.id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Titre ou ordre des fichiers modifié.' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param() params: BundleIdDto,
    @Body() body: UpdateBundleDto,
  ): Promise<BundleResponse> {
    return this.bundles.update(auth.user.id, params.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AuthContext, @Param() params: BundleIdDto): Promise<void> {
    return this.bundles.remove(auth.user.id, params.id);
  }

  @Post(':id/files')
  @Throttle({ default: { limit: 120, ttl: HOUR } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BUNDLE_LIMITS.fileMaxBytes, files: 1, fields: 0 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF, JPEG, PNG ou WebP.' },
      },
    },
  })
  addFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: BundleIdDto,
    @UploadedFile() file: UploadedBundleFile | undefined,
  ): Promise<BundleResponse> {
    return this.bundles.addFile(auth.user.id, params.id, file);
  }

  @Delete(':id/files/:fileId')
  @ApiOkResponse({ description: 'Fichier effacé du dossier et du stockage.' })
  removeFile(
    @CurrentAuth() auth: AuthContext,
    @Param() params: BundleFileIdDto,
  ): Promise<BundleResponse> {
    return this.bundles.removeFile(auth.user.id, params.id, params.fileId);
  }

  /** Export en un seul PDF : débite les crédits sauf pendant une période de ré-export gratuit. */
  @Post(':id/exports')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  export(
    @CurrentAuth() auth: AuthContext,
    @Param() params: BundleIdDto,
    @Body() body: ExportBundleDto,
  ): Promise<BundleExportResponse> {
    return this.bundles.export(auth.user.id, params.id, body.idempotencyKey);
  }

  @Get(':id/exports/:exportId/download')
  @ApiOkResponse({ description: 'Lien signé de courte durée vers le PDF.' })
  download(
    @CurrentAuth() auth: AuthContext,
    @Param() params: BundleExportIdDto,
  ): Promise<CareerExportDownloadResponse> {
    return this.bundles.download(auth.user.id, params.id, params.exportId);
  }
}
