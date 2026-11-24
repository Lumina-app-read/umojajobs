import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  AUDIT_RESULTS,
  type AuditLogPage,
  type AuditResult,
  PERMISSIONS,
} from '@opportinities/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermissions } from '../security/decorators';
import { AuditService } from './audit.service';

class AuditQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Page suivante : dernier identifiant reçu.' })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ enum: AUDIT_RESULTS })
  @IsOptional()
  @IsIn(AUDIT_RESULTS)
  result?: AuditResult;

  @ApiPropertyOptional({ description: 'Adresse email de l’administrateur (partielle).' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actor?: string;
}

/** Consultation du journal d'audit (lecture seule). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.AUDIT_LOGS_READ)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOkResponse({
    description: 'Actions d’administration, de la plus récente à la plus ancienne.',
  })
  list(@Query() query: AuditQueryDto): Promise<AuditLogPage> {
    return this.audit.list(query);
  }
}
