import { Module } from '@nestjs/common';
import { JobModerationService } from './job-moderation.service';
import {
  JobCategoriesController,
  JobModerationController,
  MyJobOffersController,
} from './job-offers.controller';
import { JobOffersService } from './job-offers.service';

/** Offres d'emploi : publication par les contributeurs et modération (phase 2). */
@Module({
  controllers: [JobCategoriesController, MyJobOffersController, JobModerationController],
  providers: [JobOffersService, JobModerationService],
  exports: [JobOffersService],
})
export class JobsModule {}
