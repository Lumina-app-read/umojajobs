import { Module } from '@nestjs/common';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationsAdminService } from './notifications-admin.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { NotificationsService } from './notifications.service';

/** Notifications internes et emails transactionnels des événements métier (phase 5). */
@Module({
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [NotificationsService, NotificationsSchedulerService, NotificationsAdminService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
