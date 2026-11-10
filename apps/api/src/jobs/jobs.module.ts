import { Module } from '@nestjs/common';
import { JobModerationService } from './job-moderation.service';
import {
  JobCategoriesController,
  JobModerationController,
  MyJobOffersController,
} from './job-offers.controller';
import { JobOfferLifecycleService } from './job-offer-lifecycle.service';
import { JobOfferSchedulerService } from './job-offer-scheduler.service';
import { JobOffersService } from './job-offers.service';

/** Offres d'emploi : publication par les contributeurs et modération (phase 2). */
@Module({
  controllers: [JobCategoriesController, MyJobOffersController, JobModerationController],
  providers: [
    JobOffersService,
    JobModerationService,
    JobOfferLifecycleService,
    JobOfferSchedulerService,
  ],
  exports: [JobOffersService, JobOfferLifecycleService],
})
export class JobsModule {}
