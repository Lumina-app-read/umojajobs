import { Module } from '@nestjs/common';
import { JobModerationService } from './job-moderation.service';
import {
  JobCategoriesController,
  JobModerationController,
  MyJobOffersController,
} from './job-offers.controller';
import { JobOfferFilesService } from './job-offer-files.service';
import { JobOfferLifecycleService } from './job-offer-lifecycle.service';
import { JobOfferSchedulerService } from './job-offer-scheduler.service';
import { JobOffersService } from './job-offers.service';
import { PublicJobOffersController, SavedJobsController } from './job-search.controller';
import { JobSearchService } from './job-search.service';

/** Offres d'emploi : publication par les contributeurs et modération (phase 2). */
@Module({
  controllers: [
    JobCategoriesController,
    MyJobOffersController,
    JobModerationController,
    PublicJobOffersController,
    SavedJobsController,
  ],
  providers: [
    JobOffersService,
    JobModerationService,
    JobOfferLifecycleService,
    JobOfferSchedulerService,
    JobOfferFilesService,
    JobSearchService,
  ],
  exports: [JobOffersService, JobOfferLifecycleService],
})
export class JobsModule {}
