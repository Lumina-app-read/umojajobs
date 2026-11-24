import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { NOTIFICATIONS_PAGE_SIZE, type NotificationsPage } from '@opportinities/shared';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { type AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../security/decorators';
import { NotificationsService } from './notifications.service';

class NotificationsQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Page suivante : dernier identifiant reçu.' })
  @IsOptional()
  @IsUUID()
  before?: string;
}

class MarkReadDto {
  @ApiPropertyOptional({ type: [String], description: 'Sans liste : tout marquer comme lu.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NOTIFICATIONS_PAGE_SIZE * 5)
  @IsUUID(undefined, { each: true })
  ids?: string[];
}

/** Centre de notifications de l'utilisateur connecté. */
@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ description: 'Notifications, de la plus récente à la plus ancienne.' })
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsPage> {
    return this.notifications.list(auth.user.id, query.before);
  }

  @Get('unread-count')
  async unread(@CurrentAuth() auth: AuthContext): Promise<{ unread: number }> {
    return { unread: await this.notifications.unread(auth.user.id) };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentAuth() auth: AuthContext,
    @Body() body: MarkReadDto,
  ): Promise<{ unread: number }> {
    return { unread: await this.notifications.markRead(auth.user.id, body.ids) };
  }
}
