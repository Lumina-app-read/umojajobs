import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  type AdminEmailsPage,
  NOTIFICATION_EMAIL_STATUSES,
  type NotificationEmailStatus,
  PERMISSIONS,
} from '@opportinities/shared';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { RequirePermissions } from '../security/decorators';
import { NotificationsAdminService } from './notifications-admin.service';

class AdminEmailsQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_EMAIL_STATUSES })
  @IsOptional()
  @IsIn(NOTIFICATION_EMAIL_STATUSES)
  status?: NotificationEmailStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Page suivante : dernier identifiant reçu.' })
  @IsOptional()
  @IsUUID()
  before?: string;
}

/** Supervision des emails de notification (paramètres de la plateforme). */
@ApiTags('admin')
@RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.SETTINGS_MANAGE)
@Controller('admin/notifications/emails')
export class NotificationsAdminController {
  constructor(private readonly emails: NotificationsAdminService) {}

  @Get()
  @ApiOkResponse({ description: "File d'envoi : emails du plus récent au plus ancien, totaux." })
  list(@Query() query: AdminEmailsQueryDto): Promise<AdminEmailsPage> {
    return this.emails.list(query);
  }

  @Post('retry')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Remet en file tous les emails en échec (dans la limite prévue).' })
  retryAll(): Promise<{ requeued: number }> {
    return this.emails.retry(null);
  }

  @Post(':id/retry')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Remet en file un email en échec.' })
  retryOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ requeued: number }> {
    return this.emails.retry(id);
  }
}
