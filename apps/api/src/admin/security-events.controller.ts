import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@opportinities/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SecurityEventType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../security/decorators';

const SECURITY_EVENT_TYPES = Object.values(SecurityEventType);

export class SecurityEventsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: SECURITY_EVENT_TYPES })
  @IsOptional()
  @IsIn(SECURITY_EVENT_TYPES)
  type?: SecurityEventType;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Pagination : identifiant du dernier élément reçu.',
  })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SecurityEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: SECURITY_EVENT_TYPES }) type!: SecurityEventType;
  @ApiProperty({ nullable: true, type: String }) userId!: string | null;
  @ApiProperty({ nullable: true, type: String }) ip!: string | null;
  @ApiProperty({ nullable: true, type: String }) userAgent!: string | null;
  @ApiProperty({ nullable: true, type: String }) requestId!: string | null;
  @ApiProperty({ nullable: true, type: Object }) metadata!: unknown;
  @ApiProperty() createdAt!: Date;
}

/** Consultation du journal de sécurité (administration). Lecture seule. */
@ApiTags('admin')
@Controller('admin/security-events')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SECURITY_EVENTS_READ)
export class SecurityEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: SecurityEventDto, isArray: true })
  list(@Query() query: SecurityEventsQueryDto): Promise<SecurityEventDto[]> {
    // Les identifiants UUID v7 sont chronologiques : la pagination par identifiant suit l'ordre de création.
    return this.prisma.securityEvent.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.before ? { id: { lt: query.before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit ?? 50,
      select: {
        id: true,
        type: true,
        userId: true,
        ip: true,
        userAgent: true,
        requestId: true,
        metadata: true,
        createdAt: true,
      },
    });
  }
}
